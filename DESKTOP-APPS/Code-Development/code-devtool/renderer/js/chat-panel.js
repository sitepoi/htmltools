// CodeDevTool - AI chat view
// The left panel (CODE-17): provider settings, session switching, streamed
// messages, slash commands (T-19), MCP server settings (T-20), and file
// attachments from the explorer (T-07/T-08/T-09).

(function () {
  'use strict'

  const bridge = window.codedevtool
  const maximumAttachments = 5
  let activeSessionId = ''
  let attachedFilePaths = []
  let isStreaming = false
  let currentRequestId = ''
  let currentRunIsAgent = false
  let agentModeOn = false
  let agentPlanElement = null
  let agentActivityElement = null

  // ── Slash commands (T-19) ──
  const slashCommands = [
    {
      command: '/explain',
      description: 'Explain code or the project',
      template: (filePath) => filePath
        ? 'Explain the code in #' + filePath + ' section by section, in simple terms.'
        : 'Explain how this project works and what its main files do.'
    },
    {
      command: '/fix',
      description: 'Find and fix bugs',
      template: (filePath) => filePath
        ? 'Find and fix the bugs in #' + filePath + '. Explain every fix you make.'
        : 'Look over this project, find the bugs worth fixing, and explain each one.'
    },
    {
      command: '/refactor',
      description: 'Refactor for readability',
      template: (filePath) => filePath
        ? 'Refactor #' + filePath + ' for readability and structure without changing its behavior. List the changes you make.'
        : 'Refactor this project for readability without changing its behavior. List the changes.'
    },
    {
      command: '/preview-check',
      description: 'Check the live preview output',
      template: () => 'Check the live preview in the center panel. If the preview console shows errors or warnings, explain what is wrong and how to fix it.'
    }
  ]
  let slashMenuElement = null
  let slashMenuOpen = false
  let slashSelectedIndex = 0
  let slashVisibleCommands = []

  function chatMessagesContainer() { return document.getElementById('chat-messages') }
  function chatInput() { return document.getElementById('chat-input') }

  function activeEditorFilePath() {
    if (window.codedevtoolEditorApi && typeof window.codedevtoolEditorApi.getActiveFilePath === 'function') {
      return window.codedevtoolEditorApi.getActiveFilePath() || ''
    }
    return ''
  }

  function slashCommandFor(inputValue) {
    const trimmed = inputValue.trim()
    for (const entry of slashCommands) {
      if (trimmed === entry.command) return entry
    }
    return null
  }

  function ensureSlashMenu() {
    if (slashMenuElement) return slashMenuElement
    slashMenuElement = document.createElement('div')
    slashMenuElement.id = 'slash-menu'
    slashMenuElement.className = 'slash-menu'
    slashMenuElement.hidden = true
    const panel = document.getElementById('chat-panel')
    if (panel) panel.appendChild(slashMenuElement)
    return slashMenuElement
  }

  function renderSlashMenu() {
    const menu = ensureSlashMenu()
    menu.textContent = ''
    slashVisibleCommands.forEach((entry, index) => {
      const item = document.createElement('div')
      item.className = 'slash-menu-item' + (index === slashSelectedIndex ? ' slash-menu-item-selected' : '')
      const commandLabel = document.createElement('span')
      commandLabel.className = 'slash-menu-command'
      commandLabel.textContent = entry.command
      const descriptionLabel = document.createElement('span')
      descriptionLabel.className = 'slash-menu-description'
      descriptionLabel.textContent = entry.description
      item.appendChild(commandLabel)
      item.appendChild(descriptionLabel)
      item.addEventListener('mousedown', (event) => event.preventDefault())
      item.addEventListener('click', () => chooseSlashCommand(entry))
      menu.appendChild(item)
    })
    menu.hidden = slashVisibleCommands.length === 0
  }

  function openSlashMenu(inputValue) {
    slashVisibleCommands = slashCommands.filter((entry) => entry.command.startsWith(inputValue.trim().toLowerCase()))
    if (slashVisibleCommands.length === 0) {
      slashMenuOpen = false
      renderSlashMenu()
      return
    }
    slashSelectedIndex = 0
    slashMenuOpen = true
    renderSlashMenu()
  }

  function closeSlashMenu() {
    slashMenuOpen = false
    const menu = ensureSlashMenu()
    menu.hidden = true
  }

  function chooseSlashCommand(entry) {
    const input = chatInput()
    if (!input) return
    input.value = entry.template(activeEditorFilePath())
    closeSlashMenu()
    input.focus()
  }

  function appendMessageBubble(role, text) {
    const container = chatMessagesContainer()
    if (!container) return null
    const bubble = document.createElement('div')
    bubble.className = 'chat-bubble chat-bubble-' + role
    const bubbleText = document.createElement('div')
    bubbleText.className = 'chat-bubble-text'
    bubbleText.textContent = text || ''
    bubble.appendChild(bubbleText)
    container.appendChild(bubble)
    container.scrollTop = container.scrollHeight
    return bubbleText
  }

  function appendTokenToBubble(bubbleText, tokenText) {
    if (!bubbleText) return
    bubbleText.textContent += tokenText
    const container = chatMessagesContainer()
    if (container) container.scrollTop = container.scrollHeight
  }

  function clearMessagesView() {
    const container = chatMessagesContainer()
    if (container) container.textContent = ''
  }

  function setStreaming(isActive) {
    isStreaming = isActive
    const sendButton = document.getElementById('chat-send-button')
    if (sendButton) sendButton.disabled = isActive
    const stopButton = document.getElementById('chat-stop-button')
    if (stopButton) stopButton.hidden = !isActive
    const input = chatInput()
    if (input) input.disabled = isActive
  }

  // ── Attachments (T-09) ──
  function renderAttachmentChips() {
    const container = document.getElementById('chat-attachments')
    if (!container) return
    container.textContent = ''
    attachedFilePaths.forEach((filePath) => {
      const chip = document.createElement('span')
      chip.className = 'chat-attachment-chip'
      const chipLabel = document.createElement('span')
      chipLabel.textContent = filePath
      const removeButton = document.createElement('button')
      removeButton.type = 'button'
      removeButton.textContent = 'x'
      removeButton.addEventListener('click', () => removeAttachment(filePath))
      chip.appendChild(chipLabel)
      chip.appendChild(removeButton)
      container.appendChild(chip)
    })
    container.hidden = attachedFilePaths.length === 0
  }

  function addAttachment(filePath) {
    if (attachedFilePaths.length >= maximumAttachments || attachedFilePaths.includes(filePath)) return
    attachedFilePaths.push(filePath)
    renderAttachmentChips()
  }

  function removeAttachment(filePath) {
    attachedFilePaths = attachedFilePaths.filter((path) => path !== filePath)
    renderAttachmentChips()
  }

  // ── Sessions (T-08) ──
  async function refreshSessionSelect() {
    const select = document.getElementById('chat-session-select')
    if (!select) return
    select.textContent = ''
    const result = await bridge.listChatSessions()
    result.sessions.forEach((session) => {
      const option = document.createElement('option')
      option.value = session.id
      option.textContent = (session.title || 'New chat') + ' (' + session.messageCount + ')'
      select.appendChild(option)
    })
    select.value = activeSessionId
  }

  async function switchActiveSession(sessionId) {
    await bridge.switchChatSession(sessionId)
    activeSessionId = sessionId
    clearMessagesView()
    const result = await bridge.getChatMessages(sessionId)
    result.messages.forEach((message) => appendMessageBubble(message.role, message.text))
    await refreshSessionSelect()
  }

  async function createNewSession() {
    const result = await bridge.createChatSession()
    if (result && result.sessionId) {
      activeSessionId = result.sessionId
      clearMessagesView()
      await refreshSessionSelect()
    }
  }

  async function ensureUiSession() {
    const result = await bridge.listChatSessions()
    if (result.sessions.length === 0) {
      await createNewSession()
      return
    }
    activeSessionId = result.activeSessionId || result.sessions[0].id
    clearMessagesView()
    const messagesResult = await bridge.getChatMessages(activeSessionId)
    messagesResult.messages.forEach((message) => appendMessageBubble(message.role, message.text))
    await refreshSessionSelect()
  }

  // ── Sending ──
  async function resolveTypedMentions(text) {
    // "#path" mentions: when the path resolves to a file in the project,
    // attach it; the mention itself stays in the text for the model.
    const mentionPattern = /#([A-Za-z0-9_\-./\\]+)/g
    const resolvedPaths = []
    let match = mentionPattern.exec(text)
    while (match) {
      const mentionPath = match[1]
      const readResult = await bridge.readFile(mentionPath)
      if (readResult && readResult.content && !readResult.error) resolvedPaths.push(mentionPath)
      match = mentionPattern.exec(text)
    }
    return resolvedPaths
  }

  async function sendCurrentMessage() {
    const input = chatInput()
    if (!input || isStreaming) return
    const text = input.value.trim()
    if (!text) return
    input.value = ''
    appendMessageBubble('user', text)
    const mentionedPaths = await resolveTypedMentions(text)
    const attachmentPaths = attachedFilePaths.concat(mentionedPaths.filter((path) => !attachedFilePaths.includes(path)))
    attachedFilePaths = []
    renderAttachmentChips()
    const assistantBubbleText = appendMessageBubble('assistant', '')
    setStreaming(true)
    agentPlanElement = null
    agentActivityElement = null
    try {
      if (agentModeOn) {
        currentRunIsAgent = true
        const startResult = await bridge.startAgent({ text: text, attachmentPaths: attachmentPaths })
        if (startResult && startResult.error) {
          assistantBubbleText.textContent = startResult.error
          setStreaming(false)
          return
        }
        currentRequestId = startResult.requestId
      } else {
        currentRunIsAgent = false
        const startResult = await bridge.startChat({ text: text, attachmentPaths: attachmentPaths })
        if (startResult && startResult.error) {
          assistantBubbleText.textContent = startResult.error
          setStreaming(false)
          return
        }
        currentRequestId = startResult.requestId
      }
    } catch (startError) {
      assistantBubbleText.textContent = (agentModeOn ? 'Agent' : 'Chat') + ' failed: ' + (startError && startError.message ? startError.message : 'unknown error')
      setStreaming(false)
    }
  }

  function handleChatEvent(event) {
    if (!event || (currentRequestId && event.requestId !== currentRequestId)) return
    const container = chatMessagesContainer()
    const assistantBubbles = container ? container.querySelectorAll('.chat-bubble-assistant .chat-bubble-text') : []
    const lastBubbleText = assistantBubbles.length ? assistantBubbles[assistantBubbles.length - 1] : null
    if (event.type === 'token') {
      appendTokenToBubble(lastBubbleText, event.text)
    } else if (event.type === 'done') {
      setStreaming(false)
      currentRequestId = ''
      refreshSessionSelect()
    } else if (event.type === 'error') {
      appendTokenToBubble(lastBubbleText, '\n[Error: ' + event.message + ']')
      setStreaming(false)
      currentRequestId = ''
    }
  }

  function stopStreaming() {
    if (currentRequestId) {
      if (currentRunIsAgent) bridge.stopAgent(currentRequestId)
      else bridge.cancelChat(currentRequestId)
    }
  }

  // ── Agent events (T-11/T-12/T-13) ──
  function truncateText(text, maximumLength) {
    return String(text).length > maximumLength ? String(text).slice(0, maximumLength) + '...' : String(text)
  }

  function ensureAgentActivity() {
    if (agentActivityElement) return
    const bubble = document.createElement('div')
    bubble.className = 'chat-bubble chat-bubble-assistant'
    const activity = document.createElement('div')
    activity.className = 'agent-activity'
    bubble.appendChild(activity)
    const container = chatMessagesContainer()
    if (container) {
      container.appendChild(bubble)
      container.scrollTop = container.scrollHeight
    }
    agentActivityElement = activity
  }

  function appendAgentActivityLine(lineElement) {
    ensureAgentActivity()
    agentActivityElement.appendChild(lineElement)
    agentActivityElement.scrollTop = agentActivityElement.scrollHeight
    const container = chatMessagesContainer()
    if (container) container.scrollTop = container.scrollHeight
  }

  function handleAgentEvent(event) {
    if (!event) return
    if (!currentRequestId) currentRequestId = event.requestId
    if (event.requestId !== currentRequestId) return

    if (event.type === 'plan') {
      const bubble = document.createElement('div')
      bubble.className = 'chat-bubble chat-bubble-assistant'
      const planBox = document.createElement('div')
      planBox.className = 'agent-plan'
      const planHead = document.createElement('div')
      planHead.className = 'agent-plan-head'
      planHead.textContent = 'Agent plan'
      planBox.appendChild(planHead)
      const stepList = document.createElement('ol')
      stepList.className = 'agent-step-list'
      ;(event.steps || []).forEach((step) => {
        const item = document.createElement('li')
        item.textContent = step.title + (step.file ? ' (' + step.file + ')' : '')
        stepList.appendChild(item)
      })
      planBox.appendChild(stepList)
      bubble.appendChild(planBox)
      const container = chatMessagesContainer()
      if (container) {
        container.appendChild(bubble)
        container.scrollTop = container.scrollHeight
      }
      agentPlanElement = stepList
    } else if (event.type === 'step') {
      if (agentPlanElement) {
        const items = agentPlanElement.querySelectorAll('li')
        if (items[event.index]) items[event.index].classList.add('agent-step-active')
      }
    } else if (event.type === 'tool') {
      const line = document.createElement('div')
      line.className = 'agent-tool-line' + (event.status === 'error' ? ' agent-tool-error' : '')
      line.textContent = (event.status === 'done' ? 'ok  ' : (event.status === 'error' ? 'fail ' : '...  ')) + event.name + (event.summary ? ' - ' + truncateText(event.summary, 120) : '')
      appendAgentActivityLine(line)
    } else if (event.type === 'tool-output') {
      const line = document.createElement('div')
      line.className = 'agent-tool-output'
      line.textContent = truncateText(event.text, 300)
      appendAgentActivityLine(line)
    } else if (event.type === 'approval-request') {
      const row = document.createElement('div')
      row.className = 'agent-approval-row'
      const label = document.createElement('span')
      label.textContent = 'Run command: ' + event.command
      const approveButton = document.createElement('button')
      approveButton.className = 'approve'
      approveButton.textContent = 'Approve'
      const denyButton = document.createElement('button')
      denyButton.textContent = 'Deny'
      const decide = (decision) => {
        approveButton.disabled = true
        denyButton.disabled = true
        bridge.approveAgentCommand(currentRequestId, decision)
      }
      approveButton.addEventListener('click', () => decide('approve'))
      denyButton.addEventListener('click', () => decide('deny'))
      row.appendChild(label)
      row.appendChild(approveButton)
      row.appendChild(denyButton)
      appendAgentActivityLine(row)
    } else if (event.type === 'change') {
      const line = document.createElement('div')
      line.className = 'agent-change-line'
      line.textContent = 'changed ' + event.path
      appendAgentActivityLine(line)
    } else if (event.type === 'done') {
      const doneRequestId = event.requestId
      setStreaming(false)
      currentRequestId = ''
      currentRunIsAgent = false
      refreshSessionSelect()
      if (!event.aborted) appendMessageBubble('assistant', event.summary || 'Done.')
      if (event.changes && event.changes.length) {
        const undoRow = document.createElement('div')
        undoRow.className = 'agent-undo-row'
        const label = document.createElement('span')
        label.textContent = event.changes.length + ' file(s) changed'
        const undoButton = document.createElement('button')
        undoButton.className = 'agent-undo-button'
        undoButton.textContent = 'Undo all changes'
        undoButton.addEventListener('click', () => {
          undoButton.disabled = true
          bridge.undoAgentChanges(doneRequestId)
        })
        undoRow.appendChild(label)
        undoRow.appendChild(undoButton)
        const container = chatMessagesContainer()
        if (container) {
          container.appendChild(undoRow)
          container.scrollTop = container.scrollHeight
        }
      }
      agentPlanElement = null
      agentActivityElement = null
    } else if (event.type === 'undo-done') {
      appendMessageBubble('assistant', 'Changes undone.')
    } else if (event.type === 'error') {
      appendMessageBubble('assistant', '[Agent error: ' + event.message + ']')
      setStreaming(false)
      currentRequestId = ''
      currentRunIsAgent = false
    }
  }

  // ── Agent mode toggle ──
  function setAgentMode(isOn) {
    agentModeOn = isOn
    const agentButton = document.getElementById('chat-agent-button')
    if (agentButton) agentButton.classList.toggle('chat-agent-on', isOn)
    try {
      localStorage.setItem('codedevtool-agent-mode', isOn ? '1' : '0')
    } catch (_storageError) {
      // Mode stays for the session only.
    }
  }

  // ── Settings (T-07) ──
  function toggleSettings() {
    const settings = document.getElementById('chat-settings')
    if (!settings) return
    settings.hidden = !settings.hidden
    if (!settings.hidden) loadSettingsIntoForm()
  }

  async function loadSettingsIntoForm() {
    const config = await bridge.getAiConfig()
    if (!config) return
    const providerSelect = document.getElementById('ai-provider-select')
    if (providerSelect) providerSelect.value = config.provider
    const baseUrlInput = document.getElementById('ai-base-url-input')
    if (baseUrlInput) baseUrlInput.value = config.provider === 'copilot' ? config.copilotBaseUrl : config.openAiBaseUrl
    const modelInput = document.getElementById('ai-model-input')
    if (modelInput) modelInput.value = config.model || ''
    const mcpEnabledCheckbox = document.getElementById('mcp-enabled-checkbox')
    if (mcpEnabledCheckbox) mcpEnabledCheckbox.checked = Boolean(config.mcp && config.mcp.enabled)
    const mcpServersInput = document.getElementById('mcp-servers-input')
    if (mcpServersInput) {
      const servers = config.mcp && Array.isArray(config.mcp.servers) ? config.mcp.servers : []
      mcpServersInput.value = servers.map((server) => server.name + ' ' + server.url).join('\n')
    }
    const status = document.getElementById('ai-settings-status')
    if (status) {
      const tokenSaved = config.provider === 'copilot' ? config.copilotHasToken : config.openAiHasToken
      status.textContent = 'Token: ' + (tokenSaved ? 'saved' : 'not set') + (config.safeStorageAvailable ? '' : ' - OS encryption unavailable')
    }
  }

  async function saveSettingsFromForm() {
    const providerSelect = document.getElementById('ai-provider-select')
    const baseUrlInput = document.getElementById('ai-base-url-input')
    const modelInput = document.getElementById('ai-model-input')
    const patch = { provider: providerSelect.value, model: modelInput.value.trim() }
    if (providerSelect.value === 'copilot') patch.copilotBaseUrl = baseUrlInput.value.trim()
    else patch.openAiBaseUrl = baseUrlInput.value.trim()
    const mcpEnabledCheckbox = document.getElementById('mcp-enabled-checkbox')
    const mcpServersInput = document.getElementById('mcp-servers-input')
    if (mcpEnabledCheckbox && mcpServersInput) {
      const servers = []
      mcpServersInput.value.split('\n').forEach((line) => {
        const parts = line.trim().split(/\s+/)
        if (parts.length === 0 || !parts[0]) return
        if (parts.length >= 2) servers.push({ name: parts[0], url: parts.slice(1).join(' ') })
        else servers.push({ name: '', url: parts[0] })
      })
      patch.mcp = { enabled: mcpEnabledCheckbox.checked, servers: servers }
    }
    await bridge.saveAiConfig(patch)
    const status = document.getElementById('ai-settings-status')
    if (status) status.textContent = 'Settings saved.'
  }

  async function saveTokenFromForm() {
    const providerSelect = document.getElementById('ai-provider-select')
    const tokenInput = document.getElementById('ai-token-input')
    await bridge.saveAiToken(providerSelect.value, tokenInput.value.trim())
    tokenInput.value = ''
    const status = document.getElementById('ai-settings-status')
    if (status) status.textContent = 'Token saved with OS encryption.'
  }

  async function clearTokenFromForm() {
    const providerSelect = document.getElementById('ai-provider-select')
    await bridge.clearAiToken(providerSelect.value)
    const status = document.getElementById('ai-settings-status')
    if (status) status.textContent = 'Token cleared.'
  }

  async function testConnection() {
    const status = document.getElementById('ai-settings-status')
    if (status) status.textContent = 'Testing...'
    const result = await bridge.listAiModels()
    if (status) {
      status.textContent = result.error
        ? 'Test failed: ' + result.error
        : 'OK - models: ' + (result.models || []).join(', ')
    }
    if (result.models && result.models.length) {
      const modelInput = document.getElementById('ai-model-input')
      if (modelInput && !modelInput.value) modelInput.value = result.models[0]
    }
  }

  function initialize() {
    if (!bridge) return
    const newButton = document.getElementById('chat-new-button')
    if (newButton) newButton.addEventListener('click', createNewSession)
    const sessionSelect = document.getElementById('chat-session-select')
    if (sessionSelect) sessionSelect.addEventListener('change', () => switchActiveSession(sessionSelect.value))
    const sendButton = document.getElementById('chat-send-button')
    if (sendButton) sendButton.addEventListener('click', sendCurrentMessage)
    const stopButton = document.getElementById('chat-stop-button')
    if (stopButton) stopButton.addEventListener('click', stopStreaming)
    const settingsButton = document.getElementById('chat-settings-button')
    if (settingsButton) settingsButton.addEventListener('click', toggleSettings)
    const agentButton = document.getElementById('chat-agent-button')
    if (agentButton) agentButton.addEventListener('click', () => setAgentMode(!agentModeOn))
    try {
      if (localStorage.getItem('codedevtool-agent-mode') === '0') setAgentMode(false)
      else setAgentMode(true)
    } catch (_storageError) {
      setAgentMode(true)
    }
    const input = chatInput()
    if (input) {
      input.addEventListener('input', () => {
        const value = input.value
        const looksLikePartialCommand = /^\/[a-z\-]*$/i.test(value) && value.length <= 14
        if (slashMenuOpen || looksLikePartialCommand) openSlashMenu(value)
        else closeSlashMenu()
      })
      input.addEventListener('blur', (event) => {
        const menu = ensureSlashMenu()
        if (event.relatedTarget && menu && menu.contains(event.relatedTarget)) return
        closeSlashMenu()
      })
      input.addEventListener('keydown', (event) => {
        if (slashMenuOpen && slashVisibleCommands.length > 0) {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            slashSelectedIndex = (slashSelectedIndex + 1) % slashVisibleCommands.length
            renderSlashMenu()
            return
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            slashSelectedIndex = (slashSelectedIndex - 1 + slashVisibleCommands.length) % slashVisibleCommands.length
            renderSlashMenu()
            return
          }
          if (event.key === 'Enter' || event.key === 'Tab') {
            event.preventDefault()
            chooseSlashCommand(slashVisibleCommands[slashSelectedIndex])
            return
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            closeSlashMenu()
            return
          }
        }
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault()
          const directCommand = slashCommandFor(input.value)
          if (directCommand) input.value = directCommand.template(activeEditorFilePath())
          sendCurrentMessage()
        }
      })
    }
    const tokenSaveButton = document.getElementById('ai-token-save-button')
    if (tokenSaveButton) tokenSaveButton.addEventListener('click', saveTokenFromForm)
    const tokenClearButton = document.getElementById('ai-token-clear-button')
    if (tokenClearButton) tokenClearButton.addEventListener('click', clearTokenFromForm)
    const testButton = document.getElementById('ai-test-button')
    if (testButton) testButton.addEventListener('click', testConnection)
    const configSaveButton = document.getElementById('ai-config-save-button')
    if (configSaveButton) configSaveButton.addEventListener('click', saveSettingsFromForm)
    const providerSelect = document.getElementById('ai-provider-select')
    if (providerSelect) providerSelect.addEventListener('change', loadSettingsIntoForm)
    if (typeof bridge.onChatEvent === 'function') bridge.onChatEvent(handleChatEvent)
    if (typeof bridge.onAgentEvent === 'function') bridge.onAgentEvent(handleAgentEvent)
    window.addEventListener('codedevtool:attach-file', (event) => {
      if (event.detail && event.detail.path) addAttachment(event.detail.path)
    })
    if (typeof bridge.onProjectChanged === 'function') {
      bridge.onProjectChanged(() => {
        attachedFilePaths = []
        renderAttachmentChips()
        ensureUiSession()
      })
    }
    ensureUiSession()
  }

  document.addEventListener('DOMContentLoaded', initialize)
})()
