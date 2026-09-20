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
  let agentThinkingElement = null
  let pendingToolLineElement = null
  let pendingToolLineSymbol = null

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
    agentThinkingElement = null
    pendingToolLineElement = null
    pendingToolLineSymbol = null
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
        showAgentThinking('Thinking...')
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

  // CODE-32: a visible "what is the agent doing right now" line with an
  // animated spinner while the model is thinking or a tool is waiting.
  function showAgentThinking(text) {
    ensureAgentActivity()
    if (!agentThinkingElement) {
      agentThinkingElement = document.createElement('div')
      agentThinkingElement.className = 'agent-thinking'
      const symbol = document.createElement('span')
      symbol.className = 'agent-thinking-symbol'
      const label = document.createElement('span')
      label.className = 'agent-thinking-label'
      agentThinkingElement.appendChild(symbol)
      agentThinkingElement.appendChild(label)
    }
    if (!agentThinkingElement.parentElement) agentActivityElement.appendChild(agentThinkingElement)
    agentThinkingElement.querySelector('.agent-thinking-label').textContent = text || 'Thinking...'
    const container = chatMessagesContainer()
    if (container) container.scrollTop = container.scrollHeight
  }

  function hideAgentThinking() {
    if (agentThinkingElement && agentThinkingElement.parentElement) {
      agentThinkingElement.remove()
    }
  }

  function updatePlanStepStatuses(activeIndex) {
    if (!agentPlanElement) return
    const items = agentPlanElement.querySelectorAll('li')
    items.forEach((item, itemIndex) => {
      item.classList.remove('agent-step-active')
      if (itemIndex < activeIndex) {
        item.classList.remove('agent-step-pending')
        item.classList.add('agent-step-done')
      } else if (itemIndex === activeIndex) {
        item.classList.add('agent-step-active')
      }
    })
  }

  function markPlanStepsFinished(failed) {
    if (!agentPlanElement) return
    const items = agentPlanElement.querySelectorAll('li')
    items.forEach((item) => {
      if (item.classList.contains('agent-step-active')) {
        item.classList.remove('agent-step-active')
        item.classList.add(failed ? 'agent-step-failed' : 'agent-step-done')
      }
    })
  }

  function handleAgentEvent(event) {
    if (!event) return
    if (!currentRequestId) currentRequestId = event.requestId
    if (event.requestId !== currentRequestId) return

    if (event.type === 'thinking') {
      showAgentThinking(event.text)
    } else if (event.type === 'plan') {
      hideAgentThinking()
      let stepList = agentPlanElement
      if (!stepList) {
        const bubble = document.createElement('div')
        bubble.className = 'chat-bubble chat-bubble-assistant'
        const planBox = document.createElement('div')
        planBox.className = 'agent-plan'
        const planHead = document.createElement('div')
        planHead.className = 'agent-plan-head'
        planHead.textContent = 'Agent plan'
        planBox.appendChild(planHead)
        stepList = document.createElement('ol')
        stepList.className = 'agent-step-list'
        planBox.appendChild(stepList)
        bubble.appendChild(planBox)
        const container = chatMessagesContainer()
        if (container) {
          container.appendChild(bubble)
          container.scrollTop = container.scrollHeight
        }
        agentPlanElement = stepList
      }
      stepList.textContent = ''
      ;(event.steps || []).forEach((step) => {
        const item = document.createElement('li')
        item.className = 'agent-step-pending'
        item.textContent = step.title + (step.file ? ' (' + step.file + ')' : '')
        stepList.appendChild(item)
      })
    } else if (event.type === 'step') {
      hideAgentThinking()
      updatePlanStepStatuses(event.index)
    } else if (event.type === 'tool') {
      hideAgentThinking()
      if (event.status === 'running') {
        const line = document.createElement('div')
        line.className = 'agent-tool-line'
        const symbol = document.createElement('span')
        symbol.className = 'agent-tool-symbol agent-tool-symbol-running'
        const label = document.createElement('span')
        label.className = 'agent-tool-label'
        label.textContent = event.name + (event.summary ? ' - ' + truncateText(event.summary, 120) : '')
        line.appendChild(symbol)
        line.appendChild(label)
        appendAgentActivityLine(line)
        pendingToolLineElement = line
        pendingToolLineSymbol = symbol
      } else {
        const toolFinishedOk = event.status === 'done'
        let line = pendingToolLineElement
        let symbol = pendingToolLineSymbol
        if (!line) {
          line = document.createElement('div')
          line.className = 'agent-tool-line'
          symbol = document.createElement('span')
          symbol.className = 'agent-tool-symbol'
          const label = document.createElement('span')
          label.className = 'agent-tool-label'
          line.appendChild(symbol)
          line.appendChild(label)
          appendAgentActivityLine(line)
        }
        symbol.className = 'agent-tool-symbol ' + (toolFinishedOk ? 'agent-tool-symbol-done' : 'agent-tool-symbol-error')
        line.classList.toggle('agent-tool-error', !toolFinishedOk)
        line.querySelector('.agent-tool-label').textContent = event.name + (event.summary ? ' - ' + truncateText(event.summary, 120) : '')
        pendingToolLineElement = null
        pendingToolLineSymbol = null
      }
    } else if (event.type === 'tool-output') {
      const line = document.createElement('div')
      line.className = 'agent-tool-output'
      line.textContent = truncateText(event.text, 300)
      appendAgentActivityLine(line)
    } else if (event.type === 'approval-request') {
      hideAgentThinking()
      if (event.autoApproved) {
        // CODE-31: after "Approve all in session", later commands never
        // wait - they are shown as auto-approved so nothing runs invisibly.
        const line = document.createElement('div')
        line.className = 'agent-approval-line agent-approval-approved'
        const symbol = document.createElement('span')
        symbol.className = 'agent-tool-symbol agent-tool-symbol-done'
        const label = document.createElement('span')
        label.className = 'agent-approval-command'
        label.textContent = 'Auto-approved: ' + event.command
        line.appendChild(symbol)
        line.appendChild(label)
        appendAgentActivityLine(line)
        return
      }
      const row = document.createElement('div')
      row.className = 'agent-approval-row'
      const label = document.createElement('span')
      label.className = 'agent-approval-command'
      label.textContent = 'Run command: ' + event.command
      const approveButton = document.createElement('button')
      approveButton.className = 'approve'
      approveButton.textContent = 'Approve'
      const approveAllButton = document.createElement('button')
      approveAllButton.className = 'approve approve-all'
      approveAllButton.textContent = 'Approve all in session'
      const denyButton = document.createElement('button')
      denyButton.textContent = 'Deny'
      const markDecision = (approved, allSession) => {
        row.className = 'agent-approval-row ' + (approved ? 'agent-approval-approved' : 'agent-approval-denied')
        row.textContent = ''
        const symbol = document.createElement('span')
        symbol.className = 'agent-approval-symbol'
        symbol.textContent = approved ? '✓' : '✗'
        const stateLabel = document.createElement('span')
        stateLabel.className = 'agent-approval-command'
        const statePrefix = approved ? (allSession ? 'Approved (all in session)' : 'Approved') : 'Denied'
        stateLabel.textContent = statePrefix + ': ' + event.command
        row.appendChild(symbol)
        row.appendChild(stateLabel)
        if (allSession) {
          const noteLine = document.createElement('div')
          noteLine.className = 'agent-approval-line agent-approval-approved'
          const noteSymbol = document.createElement('span')
          noteSymbol.className = 'agent-tool-symbol agent-tool-symbol-done'
          const noteLabel = document.createElement('span')
          noteLabel.className = 'agent-approval-command'
          noteLabel.textContent = 'Auto-approve is ON for this run - later commands will show as auto-approved.'
          noteLine.appendChild(noteSymbol)
          noteLine.appendChild(noteLabel)
          appendAgentActivityLine(noteLine)
        }
      }
      const decide = (decision, approved, allSession) => {
        markDecision(approved, allSession)
        bridge.approveAgentCommand(currentRequestId, decision)
      }
      approveButton.addEventListener('click', () => decide('approve', true, false))
      approveAllButton.addEventListener('click', () => decide('approve-all', true, true))
      denyButton.addEventListener('click', () => decide('deny', false, false))
      row.appendChild(label)
      row.appendChild(approveButton)
      row.appendChild(approveAllButton)
      row.appendChild(denyButton)
      appendAgentActivityLine(row)
    } else if (event.type === 'change') {
      const line = document.createElement('div')
      line.className = 'agent-change-line'
      line.textContent = 'changed ' + event.path
      appendAgentActivityLine(line)
    } else if (event.type === 'done') {
      const doneRequestId = event.requestId
      hideAgentThinking()
      markPlanStepsFinished(false)
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
      agentThinkingElement = null
      pendingToolLineElement = null
      pendingToolLineSymbol = null
    } else if (event.type === 'undo-done') {
      appendMessageBubble('assistant', 'Changes undone.')
    } else if (event.type === 'error') {
      hideAgentThinking()
      markPlanStepsFinished(true)
      appendMessageBubble('assistant', '[Agent error: ' + event.message + ']')
      setStreaming(false)
      currentRequestId = ''
      currentRunIsAgent = false
      agentPlanElement = null
      agentActivityElement = null
      agentThinkingElement = null
      pendingToolLineElement = null
      pendingToolLineSymbol = null
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

  function updateProviderDependentFields() {
    const providerSelect = document.getElementById('ai-provider-select')
    const providerName = providerSelect ? providerSelect.value : 'copilot'
    const uniconBlocks = document.querySelectorAll('.unicon-settings-block')
    uniconBlocks.forEach((block) => { block.hidden = providerName !== 'unicon' })
    const modelInput = document.getElementById('ai-model-input')
    if (modelInput) {
      modelInput.placeholder = providerName === 'unicon' ? 'deepseek-v4-pro' : (providerName === 'openai' ? 'gpt-4o-mini' : 'gpt-4o-copilot')
    }
    const baseUrlInput = document.getElementById('ai-base-url-input')
    if (baseUrlInput) {
      baseUrlInput.placeholder = providerName === 'unicon' ? 'https://your-gateway.example.com' : 'https://your-ai-gateway.example.com/v1'
    }
  }

  async function loadSettingsIntoForm() {
    const config = await bridge.getAiConfig()
    if (!config) return
    const providerSelect = document.getElementById('ai-provider-select')
    if (providerSelect) providerSelect.value = config.provider
    const baseUrlInput = document.getElementById('ai-base-url-input')
    if (baseUrlInput) {
      if (config.provider === 'unicon') baseUrlInput.value = config.uniconBaseUrl || ''
      else if (config.provider === 'copilot') baseUrlInput.value = config.copilotBaseUrl
      else baseUrlInput.value = config.openAiBaseUrl
    }
    const uniconProviderInput = document.getElementById('unicon-provider-input')
    if (uniconProviderInput) uniconProviderInput.value = config.uniconProvider || 'deepseek'
    const uniconHostInput = document.getElementById('unicon-host-input')
    if (uniconHostInput) uniconHostInput.value = config.uniconHost || ''
    const uniconJwtCheckbox = document.getElementById('unicon-jwt-checkbox')
    if (uniconJwtCheckbox) uniconJwtCheckbox.checked = config.uniconAuthMode === 'jwt'
    updateProviderDependentFields()
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
      const tokenSaved = config.provider === 'copilot' ? config.copilotHasToken : (config.provider === 'unicon' ? config.uniconHasToken : config.openAiHasToken)
      status.textContent = 'Token: ' + (tokenSaved ? 'saved' : 'not set') + (config.safeStorageAvailable ? '' : ' - OS encryption unavailable')
    }
  }

  async function saveSettingsFromForm() {
    const providerSelect = document.getElementById('ai-provider-select')
    const baseUrlInput = document.getElementById('ai-base-url-input')
    const modelInput = document.getElementById('ai-model-input')
    const patch = { provider: providerSelect.value, model: modelInput.value.trim() }
    if (providerSelect.value === 'copilot') patch.copilotBaseUrl = baseUrlInput.value.trim()
    else if (providerSelect.value === 'unicon') {
      patch.uniconBaseUrl = baseUrlInput.value.trim()
      const uniconProviderInput = document.getElementById('unicon-provider-input')
      if (uniconProviderInput) patch.uniconProvider = uniconProviderInput.value.trim()
      const uniconHostInput = document.getElementById('unicon-host-input')
      if (uniconHostInput) patch.uniconHost = uniconHostInput.value.trim()
      const uniconJwtCheckbox = document.getElementById('unicon-jwt-checkbox')
      if (uniconJwtCheckbox) patch.uniconAuthMode = uniconJwtCheckbox.checked ? 'jwt' : 'key'
    }
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
    if (providerSelect) providerSelect.addEventListener('change', updateProviderDependentFields)
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
