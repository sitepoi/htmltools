// CodeDevTool - renderer shell logic
// Plain JS, no framework. Wires the header to the preload bridge:
// health badge, project root display, and the Open Folder dialog.
// See code-devtool-ssot.html section 7.6 for the caller contract.

(function () {
  'use strict'

  const bridge = window.codedevtool

  function setElementText(elementId, text) {
    const element = document.getElementById(elementId)
    if (element) element.textContent = text
  }

  // ── Folder tabs (CODE-23) ──
  let folderTabsState = { projectRoots: [], activeProjectRoot: null }

  function folderNameOf(folder) {
    const normalized = String(folder || '').replace(/[\\/]+$/, '')
    const parts = normalized.split(/[\\/]/)
    return parts[parts.length - 1] || normalized || 'folder'
  }

  function renderFolderTabs() {
    const container = document.getElementById('folder-tabs')
    if (!container) return
    container.textContent = ''
    const roots = folderTabsState.projectRoots || []
    roots.forEach((folder) => {
      const tab = document.createElement('div')
      tab.className = 'folder-tab' + (folder === folderTabsState.activeProjectRoot ? ' folder-tab-active' : '')
      const nameLabel = document.createElement('span')
      nameLabel.className = 'folder-tab-name'
      nameLabel.textContent = folderNameOf(folder)
      nameLabel.title = folder
      nameLabel.addEventListener('click', () => switchToFolder(folder))
      const closeButton = document.createElement('button')
      closeButton.type = 'button'
      closeButton.className = 'folder-tab-close'
      closeButton.textContent = 'x'
      closeButton.title = 'Close this folder tab'
      closeButton.addEventListener('click', () => closeFolderTab(folder))
      tab.appendChild(nameLabel)
      tab.appendChild(closeButton)
      container.appendChild(tab)
    })
  }

  function editorHasUnsavedChanges() {
    const editorApi = window.codedevtoolEditorApi
    return Boolean(editorApi && typeof editorApi.hasDirtyTabs === 'function' && editorApi.hasDirtyTabs())
  }

  function confirmLosingUnsavedChanges() {
    if (!editorHasUnsavedChanges()) return true
    return window.confirm('Unsaved editor changes will be lost when switching folders. Continue?')
  }

  async function switchToFolder(folder) {
    if (folder === folderTabsState.activeProjectRoot) return
    if (!confirmLosingUnsavedChanges()) return
    try {
      folderTabsState = await bridge.switchFolder(folder)
      renderFolderTabs()
    } catch (_error) {
      // The main process broadcasts the authoritative state anyway.
    }
  }

  async function closeFolderTab(folder) {
    if (!confirmLosingUnsavedChanges()) return
    try {
      folderTabsState = await bridge.closeFolder(folder)
      renderFolderTabs()
    } catch (_error) {
      // The main process broadcasts the authoritative state anyway.
    }
  }

  async function openProjectFolder() {
    if (!confirmLosingUnsavedChanges()) return
    try {
      folderTabsState = await bridge.openFolder()
      renderFolderTabs()
    } catch (_error) {
      setElementText('bridge-status', 'Could not open the folder dialog')
    }
  }

  async function restoreProjectState() {
    try {
      folderTabsState = await bridge.getState()
      renderFolderTabs()
    } catch (_error) {
      // State read failed; the UI keeps working with no folder tabs.
    }
  }

  function showBridgeMissing() {
    setElementText('bridge-status', 'bridge missing - run with npm start')
    const openFolderButton = document.getElementById('open-folder-button')
    if (openFolderButton) openFolderButton.disabled = true
  }

  function showLivePreview() {
    window.dispatchEvent(new CustomEvent('codedevtool:show-preview'))
  }

  function toggleExplorerPanel() {
    document.body.classList.toggle('explorer-open')
  }

  function updateTerminalToggleLabels() {
    const isTerminalCollapsed = document.body.classList.contains('terminal-collapsed')
    const terminalHeadToggleButton = document.getElementById('terminal-head-toggle-button')
    if (terminalHeadToggleButton) {
      terminalHeadToggleButton.textContent = isTerminalCollapsed ? 'expand' : 'collapse'
    }
  }

  function toggleTerminalPanel() {
    document.body.classList.toggle('terminal-collapsed')
    updateTerminalToggleLabels()
  }

  function openSsotOverlay() {
    const overlay = document.getElementById('ssot-overlay')
    if (!overlay) return
    overlay.hidden = false
    refreshProjectDocuments()
  }

  function closeSsotOverlay() {
    const overlay = document.getElementById('ssot-overlay')
    if (overlay) overlay.hidden = true
  }

  // ── Project documents overlay (CODE-36) ──
  // The overlay shows the OPENED folder's documents (SSOT first, then
  // plans, reports, marketing, help, social media) served from the active
  // project root. Unicon Studio's own SSOT stays available as a built-in.
  let projectDocuments = []
  const builtinDocumentOption = { name: 'code-devtool-ssot.html', relativePath: '', type: 'builtin', label: 'Unicon Studio SSOT (built-in)' }

  function documentUrl(documentRecord) {
    if (!documentRecord || documentRecord.type === 'builtin') return '/docs/code-devtool-ssot.html'
    return '/project-docs/' + documentRecord.relativePath
  }

  function refreshProjectDocuments() {
    if (!bridge || typeof bridge.listProjectDocuments !== 'function') return
    bridge.listProjectDocuments().then((result) => {
      projectDocuments = result && Array.isArray(result.docs) ? result.docs : []
      renderDocumentSelector()
    }).catch(() => {
      projectDocuments = []
      renderDocumentSelector()
    })
  }

  function renderDocumentSelector() {
    const select = document.getElementById('ssot-doc-select')
    if (!select) return
    const previousValue = select.value
    select.textContent = ''
    const allOptions = projectDocuments.concat([builtinDocumentOption])
    allOptions.forEach((documentRecord) => {
      const option = document.createElement('option')
      option.value = documentRecord.type === 'builtin' ? 'builtin' : documentRecord.relativePath
      const nestedHint = documentRecord.relativePath.includes('/') ? ' - ' + documentRecord.relativePath : ''
      option.textContent = documentRecord.type === 'builtin'
        ? documentRecord.label
        : documentRecord.label + ': ' + documentRecord.name + nestedHint
      select.appendChild(option)
    })
    const preferredValue = projectDocuments.length > 0 ? projectDocuments[0].relativePath : 'builtin'
    const previousStillExists = allOptions.some((documentRecord) =>
      documentRecord.type === 'builtin' ? previousValue === 'builtin' : documentRecord.relativePath === previousValue
    )
    select.value = previousStillExists ? previousValue : preferredValue
    const title = document.getElementById('ssot-overlay-title')
    if (title) {
      title.textContent = projectDocuments.length > 0
        ? 'Documents - ' + projectDocuments.length + ' file(s) in this folder'
        : 'No project documents found - showing Unicon Studio SSOT'
    }
    updateDocumentFrame()
  }

  function updateDocumentFrame() {
    const overlay = document.getElementById('ssot-overlay')
    const frame = document.getElementById('ssot-frame')
    const select = document.getElementById('ssot-doc-select')
    if (!overlay || !frame || !select || overlay.hidden) return
    const selectedValue = select.value
    const selectedDocument = projectDocuments.find((documentRecord) => documentRecord.relativePath === selectedValue)
    const url = selectedDocument ? documentUrl(selectedDocument) : documentUrl(builtinDocumentOption)
    if (frame.getAttribute('src') !== url) frame.src = url
  }

  function wireInterface() {
    const openFolderButton = document.getElementById('open-folder-button')
    if (openFolderButton) openFolderButton.addEventListener('click', openProjectFolder)
    const showPreviewButton = document.getElementById('show-preview-button')
    if (showPreviewButton) showPreviewButton.addEventListener('click', showLivePreview)
    const toggleExplorerButton = document.getElementById('toggle-explorer-button')
    if (toggleExplorerButton) toggleExplorerButton.addEventListener('click', toggleExplorerPanel)
    const toggleTerminalButton = document.getElementById('toggle-terminal-button')
    if (toggleTerminalButton) toggleTerminalButton.addEventListener('click', toggleTerminalPanel)
    const terminalHeadToggleButton = document.getElementById('terminal-head-toggle-button')
    if (terminalHeadToggleButton) terminalHeadToggleButton.addEventListener('click', toggleTerminalPanel)
    const ssotButton = document.getElementById('ssot-button')
    if (ssotButton) ssotButton.addEventListener('click', openSsotOverlay)
    const ssotCloseButton = document.getElementById('ssot-close-button')
    if (ssotCloseButton) ssotCloseButton.addEventListener('click', closeSsotOverlay)
    const documentSelect = document.getElementById('ssot-doc-select')
    if (documentSelect) documentSelect.addEventListener('change', updateDocumentFrame)
    if (bridge && typeof bridge.onFolderTabsChanged === 'function') {
      bridge.onFolderTabsChanged((tabsState) => {
        folderTabsState = tabsState || folderTabsState
        renderFolderTabs()
        refreshProjectDocuments()
      })
    }
    if (bridge && typeof bridge.onProjectChanged === 'function') {
      bridge.onProjectChanged(() => {
        restoreProjectState()
        refreshProjectDocuments()
      })
    }
  }

  function initialize() {
    if (!bridge) {
      showBridgeMissing()
      return
    }
    wireInterface()
    updateTerminalToggleLabels()
    restoreProjectState()
    setElementText('bridge-status', 'ready')
  }

  document.addEventListener('DOMContentLoaded', initialize)
})()
