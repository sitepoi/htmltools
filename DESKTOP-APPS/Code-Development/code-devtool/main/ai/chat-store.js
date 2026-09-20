// Unicon Studio - chat session store
// Per-project chat sessions persisted as JSON under userData (CODE-08).
// Messages are bounded per session; the active session is remembered.

const { app } = require('electron')
const fs = require('fs')
const path = require('path')

const maximumMessagesPerSession = 200
const maximumMessageCharacters = 8000
let cachedStore = null

function getStoreFilePath() {
  return path.join(app.getPath('userData'), 'chat-sessions.json')
}

function createEmptyStore() {
  return { version: 1, projects: {} }
}

function loadStore() {
  if (cachedStore) return cachedStore
  try {
    cachedStore = JSON.parse(fs.readFileSync(getStoreFilePath(), 'utf8'))
  } catch (_readError) {
    cachedStore = createEmptyStore()
  }
  return cachedStore
}

function saveStore(store) {
  cachedStore = store
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    fs.writeFileSync(getStoreFilePath(), JSON.stringify(store, null, 2), 'utf8')
  } catch (_writeError) {
    // Best-effort persistence.
  }
}

function getProjectChat(store, projectRoot) {
  if (!projectRoot) return null
  if (!store.projects[projectRoot]) {
    store.projects[projectRoot] = { activeSessionId: '', sessions: [] }
  }
  return store.projects[projectRoot]
}

function createSessionId() {
  return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function ensureActiveSession(projectRoot) {
  const store = loadStore()
  const projectChat = getProjectChat(store, projectRoot)
  if (!projectChat) return ''
  if (!projectChat.activeSessionId) {
    const newSession = createSessionObject()
    projectChat.sessions.unshift(newSession)
    projectChat.activeSessionId = newSession.id
    saveStore(store)
  }
  return projectChat.activeSessionId
}

function createSessionObject() {
  return {
    id: createSessionId(),
    title: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: []
  }
}

function createSession(projectRoot) {
  const store = loadStore()
  const projectChat = getProjectChat(store, projectRoot)
  if (!projectChat) return ''
  const newSession = createSessionObject()
  projectChat.sessions.unshift(newSession)
  projectChat.activeSessionId = newSession.id
  saveStore(store)
  return newSession.id
}

function listSessions(projectRoot) {
  const store = loadStore()
  const projectChat = getProjectChat(store, projectRoot)
  if (!projectChat) return []
  return projectChat.sessions.map((session) => ({
    id: session.id,
    title: session.title || 'New chat',
    updatedAt: session.updatedAt,
    messageCount: session.messages.length
  }))
}

function getActiveSessionId(projectRoot) {
  const store = loadStore()
  const projectChat = getProjectChat(store, projectRoot)
  return projectChat ? projectChat.activeSessionId : ''
}

function getMessages(projectRoot, sessionId) {
  const store = loadStore()
  const projectChat = getProjectChat(store, projectRoot)
  if (!projectChat) return []
  const session = projectChat.sessions.find((candidate) => candidate.id === sessionId)
  return session ? session.messages.slice() : []
}

function addMessage(projectRoot, sessionId, role, text) {
  const store = loadStore()
  const projectChat = getProjectChat(store, projectRoot)
  if (!projectChat) return
  const session = projectChat.sessions.find((candidate) => candidate.id === sessionId)
  if (!session) return
  const trimmedText = String(text).slice(0, maximumMessageCharacters)
  session.messages.push({ role: role, text: trimmedText, time: new Date().toISOString() })
  if (session.messages.length > maximumMessagesPerSession) {
    session.messages = session.messages.slice(-maximumMessagesPerSession)
  }
  if (role === 'user' && !session.title) {
    session.title = trimmedText.slice(0, 40)
  }
  session.updatedAt = new Date().toISOString()
  saveStore(store)
}

function switchSession(projectRoot, sessionId) {
  const store = loadStore()
  const projectChat = getProjectChat(store, projectRoot)
  if (!projectChat) return false
  if (!projectChat.sessions.some((session) => session.id === sessionId)) return false
  projectChat.activeSessionId = sessionId
  saveStore(store)
  return true
}

function deleteSession(projectRoot, sessionId) {
  const store = loadStore()
  const projectChat = getProjectChat(store, projectRoot)
  if (!projectChat) return false
  projectChat.sessions = projectChat.sessions.filter((session) => session.id !== sessionId)
  if (projectChat.activeSessionId === sessionId) {
    projectChat.activeSessionId = projectChat.sessions.length ? projectChat.sessions[0].id : ''
  }
  saveStore(store)
  return true
}

module.exports = {
  ensureActiveSession,
  createSession,
  listSessions,
  getActiveSessionId,
  getMessages,
  addMessage,
  switchSession,
  deleteSession
}
