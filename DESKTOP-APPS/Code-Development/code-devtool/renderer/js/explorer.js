// CodeDevTool - file explorer view
// Renders the project tree in the explorer panel (T-04). Folders load
// lazily on click, node_modules/.git/.next stay hidden, and the tree
// refreshes after project changes and file changes. Clicking a file selects
// it in the editor panel until the editor arrives with T-05.

(function () {
  'use strict'

  const bridge = window.codedevtool
  const expandedFolderPaths = new Set()
  let refreshTimer = null
  let searchTimer = null

  function explorerTree() { return document.getElementById('explorer-tree') }

  function createEmptyLine(text) {
    const emptyLine = document.createElement('div')
    emptyLine.className = 'explorer-empty'
    emptyLine.textContent = text
    return emptyLine
  }

  function selectFile(entry) {
    window.dispatchEvent(new CustomEvent('codedevtool:open-file', { detail: { path: entry.relativePath } }))
  }

  async function loadFolderChildren(relativePath, childrenContainer, depth, arrowSpan) {
    const result = await bridge.listDirectory(relativePath)
    childrenContainer.textContent = ''
    if (!result.entries || result.entries.length === 0) {
      childrenContainer.appendChild(createEmptyLine('Empty folder'))
      return
    }
    result.entries.forEach((entry) => {
      childrenContainer.appendChild(buildRow(entry, depth + 1))
    })
    if (arrowSpan) arrowSpan.textContent = '\u25BE'
  }

  function buildRow(entry, depth) {
    const rowWrapper = document.createElement('div')
    const row = document.createElement('div')
    row.className = 'explorer-row' + (entry.isDirectory ? ' explorer-row-folder' : '')
    row.style.paddingLeft = (8 + depth * 14) + 'px'

    const marker = document.createElement('span')
    marker.className = 'explorer-marker'
    marker.textContent = entry.isDirectory ? '\u25B8' : '\u00B7'
    const name = document.createElement('span')
    name.className = 'explorer-name'
    name.textContent = entry.name
    row.appendChild(marker)
    row.appendChild(name)
    rowWrapper.appendChild(row)

    if (entry.isDirectory) {
      const childrenContainer = document.createElement('div')
      childrenContainer.className = 'explorer-children'
      childrenContainer.hidden = true
      rowWrapper.appendChild(childrenContainer)
      row.addEventListener('click', async () => {
        const isOpen = !childrenContainer.hidden
        if (isOpen) {
          childrenContainer.hidden = true
          marker.textContent = '\u25B8'
          expandedFolderPaths.delete(entry.relativePath)
          return
        }
        expandedFolderPaths.add(entry.relativePath)
        if (childrenContainer.childNodes.length === 0) {
          await loadFolderChildren(entry.relativePath, childrenContainer, depth, marker)
        } else {
          marker.textContent = '\u25BE'
        }
        childrenContainer.hidden = false
      })
      // Re-open folders the user expanded before a refresh.
      if (expandedFolderPaths.has(entry.relativePath)) {
        childrenContainer.hidden = false
        marker.textContent = '\u25BE'
        loadFolderChildren(entry.relativePath, childrenContainer, depth, marker)
      }
    } else {
      row.addEventListener('click', () => selectFile(entry))
      const attachButton = document.createElement('button')
      attachButton.type = 'button'
      attachButton.className = 'explorer-attach'
      attachButton.textContent = '+'
      attachButton.title = 'Attach this file to the AI chat'
      attachButton.addEventListener('click', (clickEvent) => {
        clickEvent.stopPropagation()
        window.dispatchEvent(new CustomEvent('codedevtool:attach-file', { detail: { path: entry.relativePath } }))
      })
      row.appendChild(attachButton)
    }
    return rowWrapper
  }

  async function renderRoot() {
    const treeContainer = explorerTree()
    if (!treeContainer) return
    treeContainer.textContent = ''
    const state = await bridge.getState()
    const projectRoot = state && state.activeProjectRoot
    if (!projectRoot) {
      treeContainer.appendChild(createEmptyLine('No folder open - use Open Folder.'))
      return
    }
    const result = await bridge.listDirectory('')
    if (!result.entries || result.entries.length === 0) {
      treeContainer.appendChild(createEmptyLine('Empty project folder'))
      return
    }
    result.entries.forEach((entry) => treeContainer.appendChild(buildRow(entry, 0)))
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer)
    refreshTimer = setTimeout(renderRoot, 500)
  }

  async function runSearch(query) {
    const resultsContainer = document.getElementById('explorer-search-results')
    if (!resultsContainer) return
    resultsContainer.textContent = ''
    if (!query || query.length < 2) return
    const result = await bridge.searchText(query)
    if (!result.results || result.results.length === 0) {
      resultsContainer.appendChild(createEmptyLine('No matches'))
      return
    }
    result.results.forEach((match) => {
      const row = document.createElement('div')
      row.className = 'search-result-row'
      const pathLabel = document.createElement('span')
      pathLabel.className = 'search-result-path'
      pathLabel.textContent = match.path + ':' + match.lineNumber
      const previewLabel = document.createElement('span')
      previewLabel.className = 'search-result-line'
      previewLabel.textContent = match.preview
      row.appendChild(pathLabel)
      row.appendChild(previewLabel)
      row.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('codedevtool:open-file', { detail: { path: match.path, line: match.lineNumber } }))
      })
      resultsContainer.appendChild(row)
    })
  }

  // ── Shared workspace context (CODE-24) ──
  async function renderSharedContext() {
    const container = document.getElementById('explorer-shared-context')
    if (!container) return
    container.textContent = ''
    try {
      const sharedContext = await bridge.getSharedContext()
      if (!sharedContext || !sharedContext.workspaceRoot || !sharedContext.fileNames || sharedContext.fileNames.length === 0) {
        container.hidden = true
        return
      }
      const label = document.createElement('div')
      label.className = 'explorer-shared-label'
      label.textContent = 'Workspace rules - auto-attached to AI'
      label.title = sharedContext.workspaceRoot
      container.appendChild(label)
      sharedContext.fileNames.forEach((fileName) => {
        const row = document.createElement('div')
        row.className = 'explorer-shared-file'
        row.textContent = fileName
        container.appendChild(row)
      })
      container.hidden = false
    } catch (_contextError) {
      container.hidden = true
    }
  }

  function initialize() {
    if (!bridge) return
    const refreshButton = document.getElementById('explorer-refresh-button')
    if (refreshButton) refreshButton.addEventListener('click', renderRoot)
    if (typeof bridge.onProjectChanged === 'function') {
      bridge.onProjectChanged(() => {
        expandedFolderPaths.clear()
        renderRoot()
        renderSharedContext()
      })
    }
    if (typeof bridge.onFileChanged === 'function') bridge.onFileChanged(scheduleRefresh)
    const searchInput = document.getElementById('explorer-search-input')
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer)
        searchTimer = setTimeout(() => runSearch(searchInput.value.trim()), 400)
      })
    }
    renderRoot()
    renderSharedContext()
  }

  document.addEventListener('DOMContentLoaded', initialize)
})()
