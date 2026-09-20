// CodeDevTool - code editor view (T-05)
// Monaco Editor loaded from the local bundle (/monaco/vs) with real web
// workers enabled by the app server (CODE-14). Tabs with dirty markers,
// Ctrl+S save, external-change reload, and open-file events from the
// explorer and the search results.

(function () {
  'use strict'

  const bridge = window.codedevtool
  let openFiles = []
  let monacoModule = null
  let editorInstance = null
  let activeFilePath = ''

  function editorPanel() { return document.getElementById('editor-panel') }
  function tabsContainer() { return document.getElementById('editor-tabs') }
  function monacoContainer() { return document.getElementById('monaco-container') }
  function statusLabel() { return document.getElementById('editor-status') }

  function fileNameOf(filePath) {
    return filePath.split(/[\\/]/).pop()
  }

  function languageForPath(filePath) {
    const extension = filePath.split('.').pop().toLowerCase()
    const languageByExtension = {
      html: 'html',
      css: 'css',
      js: 'javascript',
      mjs: 'javascript',
      cjs: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      json: 'json',
      md: 'markdown',
      txt: 'plaintext',
      svg: 'xml',
      xml: 'xml',
      scss: 'scss',
      less: 'less'
    }
    return languageByExtension[extension] || 'plaintext'
  }

  function activeRecord() {
    return openFiles.find((entry) => entry.path === activeFilePath) || null
  }

  function renderTabs() {
    const container = tabsContainer()
    if (!container) return
    container.textContent = ''
    openFiles.forEach((record) => {
      const tab = document.createElement('div')
      tab.className = 'editor-tab' + (record.path === activeFilePath ? ' editor-tab-active' : '')
      const nameLabel = document.createElement('span')
      nameLabel.textContent = record.name
      tab.appendChild(nameLabel)
      if (record.dirty) {
        const dirtyLabel = document.createElement('span')
        dirtyLabel.className = 'editor-tab-dirty'
        dirtyLabel.textContent = '*'
        tab.appendChild(dirtyLabel)
      }
      const closeButton = document.createElement('button')
      closeButton.type = 'button'
      closeButton.className = 'editor-tab-close'
      closeButton.textContent = 'x'
      closeButton.title = 'Close ' + record.name
      closeButton.addEventListener('click', (clickEvent) => {
        clickEvent.stopPropagation()
        closeTab(record.path)
      })
      tab.appendChild(closeButton)
      tab.addEventListener('click', () => activateTab(record.path))
      container.appendChild(tab)
    })
  }

  function updateStatus() {
    const status = statusLabel()
    if (!status) return
    const record = activeRecord()
    if (!record) {
      status.textContent = ''
      return
    }
    status.textContent = record.path + (record.dirty ? ' - unsaved changes (Ctrl+S to save)' : ' - saved')
  }

  function showEditorPanel() {
    const panel = editorPanel()
    if (panel) panel.classList.remove('panel-hidden')
    const previewPanel = document.getElementById('preview-panel')
    if (previewPanel) previewPanel.classList.add('panel-hidden')
  }

  function hideEditorPanel() {
    const panel = editorPanel()
    if (panel) panel.classList.add('panel-hidden')
    const previewPanel = document.getElementById('preview-panel')
    if (previewPanel) previewPanel.classList.remove('panel-hidden')
  }

  async function openTab(filePath, revealLine) {
    if (!monacoModule) return
    let record = openFiles.find((entry) => entry.path === filePath)
    if (!record) {
      const readResult = await bridge.readFile(filePath)
      const content = readResult && readResult.content ? readResult.content : ''
      const model = monacoModule.editor.createModel(content, languageForPath(filePath))
      record = { path: filePath, name: fileNameOf(filePath), model: model, dirty: false, savedVersionId: model.getVersionId() }
      model.onDidChangeContent(() => {
        record.dirty = model.getVersionId() !== record.savedVersionId
        renderTabs()
        updateStatus()
      })
      openFiles.push(record)
    }
    activeFilePath = filePath
    editorInstance.setModel(record.model)
    showEditorPanel()
    renderTabs()
    updateStatus()
    if (revealLine) editorInstance.revealLineInCenter(revealLine)
  }

  function activateTab(filePath) {
    const record = openFiles.find((entry) => entry.path === filePath)
    if (!record || !editorInstance) return
    activeFilePath = filePath
    editorInstance.setModel(record.model)
    renderTabs()
    updateStatus()
  }

  function closeTab(filePath) {
    const record = openFiles.find((entry) => entry.path === filePath)
    if (!record) return
    if (record.dirty) {
      const discardChanges = window.confirm('Discard unsaved changes to ' + record.name + '?')
      if (!discardChanges) return
    }
    record.model.dispose()
    const recordIndex = openFiles.indexOf(record)
    openFiles.splice(recordIndex, 1)
    if (activeFilePath === filePath) {
      if (openFiles.length > 0) {
        activateTab(openFiles[0].path)
      } else {
        activeFilePath = ''
        editorInstance.setModel(null)
        hideEditorPanel()
        updateStatus()
      }
    }
    renderTabs()
  }

  async function saveActive() {
    const record = activeRecord()
    if (!record) return
    const result = await bridge.saveFile(record.path, record.model.getValue())
    if (result && result.ok) {
      record.savedVersionId = record.model.getVersionId()
      record.dirty = false
      renderTabs()
      updateStatus()
    } else {
      const status = statusLabel()
      if (status) status.textContent = 'Save failed: ' + ((result && result.error) || 'unknown error')
    }
  }

  function handleFileChanged(fileName) {
    if (!fileName || !monacoModule) return
    const normalizedName = fileName.replace(/\\/g, '/')
    openFiles.forEach((record) => {
      if (record.dirty) return
      if (record.path !== normalizedName && !record.path.endsWith('/' + normalizedName)) return
      bridge.readFile(record.path).then((readResult) => {
        if (record.dirty || !readResult || !readResult.content) return
        record.model.setValue(readResult.content)
        record.savedVersionId = record.model.getVersionId()
      })
    })
  }

  function initializeMonaco() {
    window.MonacoEnvironment = {
      getWorkerUrl: function () {
        const monacoBaseUrl = window.location.origin + '/monaco/'
        return URL.createObjectURL(new Blob([
          'self.MonacoEnvironment={baseUrl:"' + monacoBaseUrl + '"};importScripts("' + monacoBaseUrl + 'vs/base/worker/workerMain.js");'
        ], { type: 'text/javascript' }))
      }
    }
    require.config({ paths: { vs: '/monaco/vs' } })
    require(['vs/editor/editor.main'], function () {
      monacoModule = window.monaco
      editorInstance = monacoModule.editor.create(monacoContainer(), {
        value: '',
        language: 'plaintext',
        theme: 'vs',
        fontSize: 13,
        wordWrap: 'on',
        automaticLayout: true,
        minimap: { enabled: true },
        scrollBeyondLastLine: false
      })
      const status = statusLabel()
      if (status) status.textContent = 'Editor ready - open a file from the Explorer.'
    })
  }

  function initialize() {
    if (!bridge) return
    // Lets other panels (e.g. slash commands in chat-panel.js) read the
    // active file for context (T-19).
    window.codedevtoolEditorApi = {
      getActiveFilePath: function () { return activeFilePath || '' },
      hasDirtyTabs: function () { return openFiles.some((record) => record.dirty) }
    }
    // L-09: closing the app with unsaved tabs shows the native confirm.
    window.addEventListener('beforeunload', (event) => {
      if (window.codedevtoolEditorApi && window.codedevtoolEditorApi.hasDirtyTabs()) {
        event.returnValue = 'Unsaved editor changes will be lost. Close anyway?'
        return event.returnValue
      }
    })
    window.addEventListener('codedevtool:open-file', (event) => {
      const filePath = event.detail && event.detail.path
      if (!filePath) return
      const revealLine = event.detail && event.detail.line ? Number(event.detail.line) : 0
      openTab(filePath, revealLine)
    })
    const closeButton = document.getElementById('editor-close-button')
    if (closeButton) closeButton.addEventListener('click', hideEditorPanel)
    // The header Preview button returns to the live preview from anywhere.
    window.addEventListener('codedevtool:show-preview', hideEditorPanel)
    document.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        saveActive()
      }
    })
    if (typeof bridge.onFileChanged === 'function') bridge.onFileChanged(handleFileChanged)
    if (typeof bridge.onProjectChanged === 'function') {
      // Editor tabs belong to the active folder tab (CODE-23): switching
      // folders closes them all (the folder switch itself was already
      // confirmed in the shell).
      bridge.onProjectChanged(() => {
        openFiles.forEach((record) => {
          const model = record.model
          if (model && typeof model.dispose === 'function') model.dispose()
        })
        openFiles = []
        activeFilePath = ''
        renderTabs()
        updateStatus()
        hideEditorPanel()
      })
    }
    initializeMonaco()
  }

  document.addEventListener('DOMContentLoaded', initialize)
})()
