// Unicon Studio - application state service
// Persists small JSON state (open folder tabs, the active folder, recent
// projects) under Electron userData. No database. CODE-08, CODE-23.

const { app } = require('electron')
const fs = require('fs')
const path = require('path')

const stateFileVersion = 2
const maximumRecentProjects = 10
const maximumOpenFolders = 8
let cachedState = null

function getStateFilePath() {
  return path.join(app.getPath('userData'), 'code-devtool-state.json')
}

function createEmptyState() {
  return {
    version: stateFileVersion,
    projectRoots: [],
    activeProjectRoot: null,
    recentProjects: []
  }
}

// Migrates v1 state (a single projectRoot) to the folder-tab list.
function normalizeState(state) {
  if (state.projectRoots === undefined) {
    state.projectRoots = state.projectRoot ? [state.projectRoot] : []
    state.activeProjectRoot = state.projectRoot || null
    delete state.projectRoot
  }
  if (typeof state.activeProjectRoot !== 'string') state.activeProjectRoot = null
  if (!Array.isArray(state.projectRoots)) state.projectRoots = []
  if (!Array.isArray(state.recentProjects)) state.recentProjects = []
  if (!state.projectRoots.includes(state.activeProjectRoot) && state.projectRoots.length > 0) {
    state.activeProjectRoot = state.projectRoots[state.projectRoots.length - 1]
  }
  state.version = stateFileVersion
  return state
}

function loadState() {
  if (cachedState) return cachedState
  try {
    const rawFileContent = fs.readFileSync(getStateFilePath(), 'utf8')
    cachedState = normalizeState(JSON.parse(rawFileContent))
  } catch (_readError) {
    cachedState = createEmptyState()
  }
  return cachedState
}

function saveState(state) {
  cachedState = state
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    fs.writeFileSync(getStateFilePath(), JSON.stringify(state, null, 2), 'utf8')
  } catch (_writeError) {
    // Best-effort persistence; the app keeps working with in-memory state.
  }
}

function getActiveProjectRoot() {
  return loadState().activeProjectRoot
}

function addProjectRoot(projectRoot) {
  const currentState = loadState()
  currentState.projectRoots = [
    projectRoot,
    ...currentState.projectRoots.filter((folder) => folder !== projectRoot)
  ].slice(0, maximumOpenFolders)
  currentState.activeProjectRoot = projectRoot
  currentState.recentProjects = [
    projectRoot,
    ...currentState.recentProjects.filter((folder) => folder !== projectRoot)
  ].slice(0, maximumRecentProjects)
  saveState(currentState)
  return currentState
}

function switchProjectRoot(projectRoot) {
  const currentState = loadState()
  if (!currentState.projectRoots.includes(projectRoot)) return currentState
  currentState.activeProjectRoot = projectRoot
  saveState(currentState)
  return currentState
}

function closeProjectRoot(projectRoot) {
  const currentState = loadState()
  const closedIndex = currentState.projectRoots.indexOf(projectRoot)
  if (closedIndex === -1) return currentState
  currentState.projectRoots.splice(closedIndex, 1)
  if (currentState.activeProjectRoot === projectRoot) {
    currentState.activeProjectRoot = currentState.projectRoots.length > 0
      ? currentState.projectRoots[Math.min(closedIndex, currentState.projectRoots.length - 1)]
      : null
  }
  saveState(currentState)
  return currentState
}

module.exports = { loadState, addProjectRoot, switchProjectRoot, closeProjectRoot, getActiveProjectRoot }
