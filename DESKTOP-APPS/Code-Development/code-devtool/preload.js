// Unicon Studio - preload bridge
// The ONLY path between the renderer and Node.js power. Exposes a fixed
// allowlist through contextBridge. See code-devtool-ssot.html sections 7.4
// and decision CODE-07.

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('codedevtool', {
  getState: () => ipcRenderer.invoke('app:get-state'),
  openFolder: () => ipcRenderer.invoke('app:open-folder'),
  switchFolder: (folder) => ipcRenderer.invoke('app:switch-folder', { folder: folder }),
  closeFolder: (folder) => ipcRenderer.invoke('app:close-folder', { folder: folder }),
  getSharedContext: () => ipcRenderer.invoke('fs:get-shared-context'),
  listDirectory: (relativePath) => ipcRenderer.invoke('fs:list-dir', relativePath),
  readFile: (relativePath) => ipcRenderer.invoke('fs:read-file', relativePath),
  saveFile: (filePath, content) => ipcRenderer.invoke('fs:write-file', { path: filePath, content: content }),
  searchText: (query) => ipcRenderer.invoke('fs:search', { query: query }),
  getAiConfig: () => ipcRenderer.invoke('ai:get-config'),
  saveAiConfig: (configPatch) => ipcRenderer.invoke('ai:save-config', configPatch),
  saveAiToken: (providerName, token) => ipcRenderer.invoke('ai:set-token', { provider: providerName, token: token }),
  clearAiToken: (providerName) => ipcRenderer.invoke('ai:clear-token', { provider: providerName }),
  listAiModels: () => ipcRenderer.invoke('ai:list-models'),
  startChat: (request) => ipcRenderer.invoke('ai:chat-start', request),
  cancelChat: (requestId) => ipcRenderer.invoke('ai:chat-cancel', { requestId: requestId }),
  startAgent: (request) => ipcRenderer.invoke('agent:start', request),
  stopAgent: (requestId) => ipcRenderer.invoke('agent:stop', { requestId: requestId }),
  approveAgentCommand: (requestId, decision) => ipcRenderer.invoke('agent:approval-command', { requestId: requestId, decision: decision }),
  undoAgentChanges: (requestId) => ipcRenderer.invoke('agent:undo-changes', { requestId: requestId }),
  onAgentEvent: (listener) => {
    const wrappedListener = (_event, event) => listener(event)
    ipcRenderer.on('ai:agent-event', wrappedListener)
    return () => ipcRenderer.removeListener('ai:agent-event', wrappedListener)
  },
  listChatSessions: () => ipcRenderer.invoke('ai:list-sessions'),
  createChatSession: () => ipcRenderer.invoke('ai:create-session'),
  switchChatSession: (sessionId) => ipcRenderer.invoke('ai:switch-session', { sessionId: sessionId }),
  deleteChatSession: (sessionId) => ipcRenderer.invoke('ai:delete-session', { sessionId: sessionId }),
  getChatMessages: (sessionId) => ipcRenderer.invoke('ai:get-session-messages', { sessionId: sessionId }),
  onChatEvent: (listener) => {
    const wrappedListener = (_event, event) => listener(event)
    ipcRenderer.on('ai:chat-event', wrappedListener)
    return () => ipcRenderer.removeListener('ai:chat-event', wrappedListener)
  },
  startPreview: () => ipcRenderer.invoke('preview:start'),
  stopPreview: () => ipcRenderer.invoke('preview:stop'),
  openPreviewDevTools: () => ipcRenderer.invoke('preview:open-devtools'),
  startTerminal: () => ipcRenderer.invoke('term:start'),
  sendTerminalInput: (text) => ipcRenderer.invoke('term:input', { text: text }),
  stopTerminal: () => ipcRenderer.invoke('term:stop'),
  onTerminalOutput: (listener) => {
    const wrappedListener = (_event, payload) => listener(payload)
    ipcRenderer.on('term:output', wrappedListener)
    return () => ipcRenderer.removeListener('term:output', wrappedListener)
  },
  onTerminalExited: (listener) => {
    const wrappedListener = (_event, payload) => listener(payload)
    ipcRenderer.on('term:exited', wrappedListener)
    return () => ipcRenderer.removeListener('term:exited', wrappedListener)
  },
  onProjectChanged: (listener) => {
    const wrappedListener = (_event, projectRoot) => {
      // One throwing listener must not abort dispatch for the others
      // (shared EventEmitter emit loop).
      try {
        listener(projectRoot)
      } catch (listenerError) {
        console.error('[Unicon Studio] project-changed listener failed:', listenerError)
      }
    }
    ipcRenderer.on('app:project-changed', wrappedListener)
    return () => ipcRenderer.removeListener('app:project-changed', wrappedListener)
  },
  onFolderTabsChanged: (listener) => {
    const wrappedListener = (_event, tabsState) => listener(tabsState)
    ipcRenderer.on('app:folders-changed', wrappedListener)
    return () => ipcRenderer.removeListener('app:folders-changed', wrappedListener)
  },
  onPreviewStatus: (listener) => {
    const wrappedListener = (_event, status) => listener(status)
    ipcRenderer.on('preview:status', wrappedListener)
    return () => ipcRenderer.removeListener('preview:status', wrappedListener)
  },
  onNextjsEvent: (listener) => {
    const wrappedListener = (_event, event) => listener(event)
    ipcRenderer.on('preview:nextjs-event', wrappedListener)
    return () => ipcRenderer.removeListener('preview:nextjs-event', wrappedListener)
  },
  onFileChanged: (listener) => {
    const wrappedListener = (_event, fileName) => listener(fileName)
    ipcRenderer.on('fs:changed', wrappedListener)
    return () => ipcRenderer.removeListener('fs:changed', wrappedListener)
  }
})
