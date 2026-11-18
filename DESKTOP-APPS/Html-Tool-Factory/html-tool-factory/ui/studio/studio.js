'use strict';
/* UniconHub Studio - projects on the left, chat in the middle, results on the right.
   Read only for the repository: every action here is a GET except the chat,
   which only asks the model a question and never writes a file. */

(function () {
  var STUDIO_BUILD = '0.13.11';
  var RAIL_KEY = 'uniconhub_studio_rail_v1';
  var RAIL_VIEW_KEY = 'uniconhub_studio_rail_view_v1';
  var TASKS_KEY = 'uniconhub_studio_tasks_v1';
  var LINE_CAP = 3000;
  var DOC_LABELS = {
    webpage: 'Webpage', help: 'Help', presentation: 'Presentation', updates: 'Updates',
    social: 'Social', ssot: 'SSOT', index: 'Index'
  };
  var DOC_ORDER = ['webpage', 'help', 'presentation', 'updates', 'social', 'ssot', 'index'];
  var CODE_ORDER = ['html', 'css', 'js'];
  var TASK_FILTERS = [
    { id: 'open', label: 'Open' },
    { id: 'in-progress', label: 'In progress' },
    { id: 'done', label: 'Done' },
    { id: 'all', label: 'All' }
  ];

  var state = {
    tools: null,
    activeTool: null,
    groupFilter: 'all',
    statusFilter: 'all',
    toolQuery: '',
    railView: 'tools',
    railOpen: true,
    file: null,
    tasks: null,
    pendingTask: null,
    tasksOpen: false,
    sessions: {},
    chatModel: 'deepseek-flash',
    copyNoteTimer: null,
    lastContext: null,
    search: { q: '', hits: [], truncated: false },
    tree: { loaded: {}, open: {}, index: {} }
  };

  /* ---------------- helpers ---------------- */
  function $(id) { return document.getElementById(id); }
  function on(id, eventName, handler) {
    var element = $(id);
    if (element) element.addEventListener(eventName, handler);
    return element;
  }
  function esc(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function api(url, options) {
    var settings = options || {};
    var init = { cache: 'no-store', method: settings.method || 'GET' };
    if (settings.body) {
      init.headers = { 'Content-Type': 'application/json' };
      init.body = settings.body;
    }
    return fetch(url, init).then(function (response) {
      return response.json().then(function (payload) {
        if (!response.ok || payload.ok === false) {
          throw new Error(payload.reason || payload.error || ('HTTP ' + response.status));
        }
        return payload;
      });
    });
  }
  function bytesLabel(value) {
    var bytes = Number(value || 0);
    if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    if (bytes >= 1024) return Math.round(bytes / 1024) + ' KB';
    return bytes + ' B';
  }
  function charsLabel(value) {
    var chars = Number(value || 0);
    if (chars >= 1000) return Math.round(chars / 1000) + 'k';
    return String(chars);
  }
  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(null, args); }, wait);
    };
  }

  /* ---------------- url state ---------------- */
  function setHash(value) {
    var next = value ? '#' + value : '#';
    if (window.location.hash === next) return;
    try { history.replaceState(null, '', next); } catch (error) { window.location.hash = next; }
  }
  function readHash() {
    var raw = String(window.location.hash || '').replace(/^#/, '');
    try {
      if (raw.indexOf('tool/') === 0) return { view: 'tool', path: decodeURIComponent(raw.slice(5)) };
      if (raw.indexOf('file/') === 0) return { view: 'file', path: decodeURIComponent(raw.slice(5)) };
      if (raw.indexOf('tasks/') === 0) return { view: 'tasks', path: decodeURIComponent(raw.slice(6)) };
      if (raw.indexOf('search/') === 0) return { view: 'search', query: decodeURIComponent(raw.slice(7)) };
    } catch (error) {
      return { view: 'none' };
    }
    return { view: 'none' };
  }
  function applyHash() {
    var parsed = readHash();
    if (parsed.view === 'file' && parsed.path) {
      openFile(parsed.path);
      expandToPath(parsed.path);
      return;
    }
    if (parsed.view === 'tasks' && parsed.path) {
      openTasks(parsed.path);
      expandToPath(parsed.path);
      return;
    }
    if (parsed.view === 'search' && parsed.query) {
      var searchInput = $('searchInput');
      if (searchInput) searchInput.value = parsed.query;
      runSearch(parsed.query);
      return;
    }
    if (parsed.view === 'tool' && parsed.path) {
      var tool = toolByPath(parsed.path);
      if (tool) selectProject(tool);
      return;
    }
    showRightView('file');
  }

  /* ---------------- server build guard ---------------- */
  function checkServerBuild() {
    api('/api/state')
      .then(function (result) {
        if (result.config && result.config.studio && result.config.studio.chatModel) {
          state.chatModel = result.config.studio.chatModel;
          renderChat();
        }
        if (result.build === STUDIO_BUILD) return;
        var chip = $('serverChip');
        if (!chip) return;
        chip.hidden = false;
        chip.className = 'chip chip-warn';
        chip.textContent = 'server ' + result.build + ' · page ' + STUDIO_BUILD + ' - restart the server';
        chip.title = 'The server is running older code than this page, so new routes answer Not found. Stop it and run npm start again.';
      })
      .catch(function () {
        var chip = $('serverChip');
        if (!chip) return;
        chip.hidden = false;
        chip.className = 'chip chip-bad';
        chip.textContent = 'server not reachable';
      });
  }

  /* ---------------- project selection ---------------- */
  function toolByPath(toolPath) {
    var tools = (state.tools && state.tools.tools) || [];
    return tools.filter(function (tool) { return tool.relativePath === toolPath; })[0] || null;
  }
  function toolForPath(filePath) {
    var tools = (state.tools && state.tools.tools) || [];
    var best = null;
    tools.forEach(function (tool) {
      if (filePath === tool.relativePath || String(filePath).indexOf(tool.relativePath + '/') === 0) {
        if (!best || tool.relativePath.length > best.relativePath.length) best = tool;
      }
    });
    return best;
  }
  function selectProject(tool, options) {
    var previous = state.activeTool ? state.activeTool.relativePath : '';
    state.activeTool = tool || null;
    var next = tool ? tool.relativePath : '';
    if (previous !== next) {
      state.pendingTask = null;
      renderPendingTask();
      if (state.tools) renderToolList();
      if (options && options.hash !== false) setHash(next ? 'tool/' + encodeURIComponent(next) : '');
    }
    renderProjectLine();
    renderChat();
    renderToolContext();
    if (tool) {
      var store = sessionStore(tool.relativePath);
      if (!store.loaded && !store.loading) loadSessions(tool.relativePath);
    }
    if (tool && state.tasksOpen && (!state.tasks || state.tasks.path !== next)) {
      // An open drawer follows the project instead of showing a stale backlog.
      loadTasks(next);
    }
  }
  function renderProjectLine() {
    var line = $('projectLine');
    if (!line) return;
    var tool = state.activeTool;
    if (!tool) {
      line.textContent = 'no project selected - pick one on the left';
      line.classList.remove('has-project');
      return;
    }
    line.textContent = tool.toolName + '  ·  ' + tool.relativePath;
    line.title = tool.relativePath;
    line.classList.add('has-project');
  }

  /* ---------------- left rail: projects / files ---------------- */
  function showRailView(name) {
    state.railView = name === 'files' ? 'files' : 'tools';
    $('rail-tools').hidden = state.railView !== 'tools';
    $('rail-files').hidden = state.railView !== 'files';
    var buttons = $('railSwitch').querySelectorAll('button[data-rail]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle('is-active', buttons[i].getAttribute('data-rail') === state.railView);
    }
    try { localStorage.setItem(RAIL_VIEW_KEY, state.railView); } catch (error) {}
  }
  function setRailOpen(open) {
    state.railOpen = open;
    document.body.classList.toggle('rail-closed', !open);
    var handle = $('railHandle');
    if (handle) {
      handle.textContent = open ? '\u00ab' : '\u00bb';
      handle.title = open ? 'Hide the left panel' : 'Show the left panel';
    }
    try { localStorage.setItem(RAIL_KEY, open ? '1' : '0'); } catch (error) {}
  }

  /* ---------------- tool registry (project list) ---------------- */
  function meterHtml(subjects, total, okClass) {
    var html = '<span class="meter">';
    for (var i = 0; i < total; i++) {
      html += '<i class="' + (subjects.length > i ? (okClass || 'on') : '') + '"></i>';
    }
    return html + '<span>' + subjects.length + '/' + total + '</span></span>';
  }
  function visibleTools() {
    var tools = (state.tools && state.tools.tools) || [];
    var query = state.toolQuery.toLowerCase();
    return tools.filter(function (tool) {
      if (state.groupFilter !== 'all' && tool.group !== state.groupFilter) return false;
      if (state.statusFilter !== 'all' && tool.status !== state.statusFilter) return false;
      if (!query) return true;
      return (tool.toolName + ' ' + tool.relativePath + ' ' + tool.slug).toLowerCase().indexOf(query) !== -1;
    });
  }
  function renderGroupFilter() {
    var groups = (state.tools && state.tools.groups) || [];
    var buttons = [{ key: 'all', label: 'All' }].concat(groups.map(function (group) {
      return { key: group.group, label: group.group + ' ' + group.tools };
    }));
    $('groupFilter').innerHTML = buttons.map(function (button) {
      return '<button type="button" data-group="' + esc(button.key) + '"' + (state.groupFilter === button.key ? ' class="is-active"' : '') + '>' + esc(button.label) + '</button>';
    }).join('');
  }
  function renderStatusFilter() {
    var statuses = ['all', 'published', 'ready', 'documented', 'in-progress', 'draft'];
    $('statusFilter').innerHTML = statuses.map(function (status) {
      return '<button type="button" data-status="' + status + '"' + (state.statusFilter === status ? ' class="is-active"' : '') + '>' + (status === 'all' ? 'Any' : status) + '</button>';
    }).join('');
  }
  function renderToolList() {
    var rows = visibleTools();
    var host = $('toolList');
    if (!rows.length) {
      host.innerHTML = '<p class="empty">No project matches those filters.</p>';
    } else {
      host.innerHTML = rows.map(function (tool) {
        var isActive = state.activeTool && state.activeTool.relativePath === tool.relativePath;
        return '<div class="tool-card' + (isActive ? ' is-active' : '') + '" data-project="' + esc(tool.relativePath) + '">' +
          '<div class="tool-card-top">' +
          '<span class="status-pill st-' + esc(tool.status) + '">' + esc(tool.status) + '</span>' +
          '<span class="tool-card-name">' + esc(tool.toolName) + '</span>' +
          '</div>' +
          '<div class="tool-card-trail">' + esc(tool.trail || tool.group) + '</div>' +
          '<div class="tool-card-meta">' +
          meterHtml(tool.package.present || [], 8) +
          meterHtml(tool.publish.present || [], 8, 'on-ok') +
          '<span class="tool-card-actions">' +
          '<button type="button" data-open="' + esc(tool.relativePath) + '">open</button>' +
          '<button type="button" data-tasks="' + esc(tool.relativePath) + '">tasks</button>' +
          '</span></div></div>';
      }).join('');
    }
    var registry = state.tools;
    if (registry) {
      var counts = { published: 0, ready: 0, documented: 0, 'in-progress': 0, draft: 0 };
      registry.tools.forEach(function (tool) { counts[tool.status] = (counts[tool.status] || 0) + 1; });
      $('toolFoot').textContent = registry.total + ' projects · ' + counts.documented + ' documented · ' +
        counts['in-progress'] + ' in progress · ' + counts.draft + ' draft · ' + counts.published + ' published';
    }
  }
  function loadRegistry() {
    return api('/api/workspace/tools')
      .then(function (registry) {
        state.tools = registry;
        renderGroupFilter();
        renderStatusFilter();
        renderToolList();
        // The registry knows which folder is a tool, so a refresh on a file or
        // tool hash can only resolve the project after it arrives.
        if (state.file) {
          selectProject(toolForPath(state.file.path), { hash: false });
        } else if (!state.activeTool) {
          // A refresh straight onto #tool/<path> can only resolve now.
          applyHash();
        }
        // A drawer that was open stays open, with the same project's backlog.
        if (state.tasksOpen && state.activeTool && (!state.tasks || state.tasks.path !== state.activeTool.relativePath)) {
          loadTasks(state.activeTool.relativePath);
        }
      })
      .catch(function (error) {
        $('toolList').innerHTML = '<p class="empty">' + esc(error.message) + '</p>';
        $('projectLine').textContent = 'the repository is not readable';
      });
  }

  /* ---------------- folder tree ---------------- */
  function makeNode(entry, parentList) {
    var li = document.createElement('li');
    li.className = 'tree-item';
    var node = document.createElement('div');
    node.className = 'node' + (entry.tool ? ' is-tool' : '');
    node.setAttribute('role', 'treeitem');
    node.dataset.path = entry.path;
    node.dataset.type = entry.type;
    var toggle = document.createElement('span');
    toggle.className = 'node-toggle';
    toggle.textContent = entry.type === 'dir' ? '\u25b8' : '';
    var icon = document.createElement('span');
    icon.className = 'node-icon';
    icon.textContent = entry.type === 'dir' ? (entry.tool ? '\u25c6' : '\u25b8') : '\u00b7';
    var name = document.createElement('span');
    name.className = 'node-name';
    name.textContent = entry.name + (entry.type === 'dir' ? '/' : '');
    node.appendChild(toggle);
    node.appendChild(icon);
    node.appendChild(name);
    if (entry.tool) {
      var tag = document.createElement('span');
      tag.className = 'node-tag';
      tag.textContent = 'tool';
      node.appendChild(tag);
    }
    li.appendChild(node);
    parentList.appendChild(li);
    state.tree.index[entry.path] = { li: li, node: node, entry: entry };
    node.addEventListener('click', function () {
      if (entry.type === 'dir') toggleDirectory(entry.path);
      else openFile(entry.path);
    });
    return li;
  }
  function directoryList(li) {
    var existing = li.querySelector(':scope > ul');
    if (existing) return existing;
    var list = document.createElement('ul');
    li.appendChild(list);
    return list;
  }
  function toggleDirectory(path) {
    var record = state.tree.index[path];
    if (!record) return;
    var li = record.li;
    if (state.tree.open[path] === true) {
      state.tree.open[path] = false;
      var openList = li.querySelector(':scope > ul');
      if (openList) openList.hidden = true;
      record.node.querySelector('.node-toggle').textContent = '\u25b8';
      return;
    }
    state.tree.open[path] = true;
    record.node.querySelector('.node-toggle').textContent = '\u25be';
    var loadedList = li.querySelector(':scope > ul');
    if (loadedList) { loadedList.hidden = false; return; }
    var target = directoryList(li);
    var loading = document.createElement('li');
    loading.className = 'node-loading';
    loading.textContent = 'loading...';
    target.appendChild(loading);
    api('/api/workspace/tree?path=' + encodeURIComponent(path))
      .then(function (payload) {
        target.innerHTML = '';
        payload.entries.forEach(function (entry) { makeNode(entry, target); });
        if (!payload.entries.length) {
          var emptyItem = document.createElement('li');
          emptyItem.className = 'node-loading';
          emptyItem.textContent = '(empty)';
          target.appendChild(emptyItem);
        }
        if (payload.truncated) {
          var cut = document.createElement('li');
          cut.className = 'node-loading';
          cut.textContent = '... first ' + payload.entries.length + ' of ' + payload.total + ' entries';
          target.appendChild(cut);
        }
        state.tree.loaded[path] = true;
      })
      .catch(function (error) {
        target.innerHTML = '';
        var failed = document.createElement('li');
        failed.className = 'node-error';
        failed.textContent = error.message;
        target.appendChild(failed);
        state.tree.open[path] = false;
      });
  }
  function loadTree() {
    var tree = $('tree');
    tree.innerHTML = '';
    state.tree = { loaded: {}, open: {}, index: {} };
    $('railFoot').textContent = 'Folders load as you open them.';
    return api('/api/workspace/tree')
      .then(function (payload) {
        payload.entries.forEach(function (entry) { makeNode(entry, tree); });
        $('railFoot').textContent = payload.total + ' top level entries' + (payload.truncated ? ' (truncated)' : '');
        ['BUSINESS', 'PERSONAL'].forEach(function (name) {
          if (state.tree.index[name]) toggleDirectory(name);
        });
      })
      .catch(function (error) {
        tree.innerHTML = '<li class="node-error">' + esc(error.message) + '</li>';
      });
  }
  function expandToPath(path, onDone) {
    var segments = String(path || '').split('/').filter(Boolean);
    var chain = [];
    var walked = '';
    segments.forEach(function (segment) {
      walked = walked ? walked + '/' + segment : segment;
      chain.push(walked);
    });
    var index = 0;
    function step() {
      if (index >= chain.length) { if (onDone) onDone(); return; }
      var current = chain[index];
      var record = state.tree.index[current];
      if (!record) { if (onDone) onDone(); return; }
      if (record.entry.type !== 'dir') { highlightNode(current); if (onDone) onDone(); return; }
      if (state.tree.open[current] !== true) toggleDirectory(current);
      var waitForLoad = setInterval(function () {
        if (!state.tree.loaded[current]) return;
        clearInterval(waitForLoad);
        index += 1;
        step();
      }, 40);
    }
    step();
  }
  function highlightNode(path) {
    Object.keys(state.tree.index).forEach(function (key) {
      state.tree.index[key].node.classList.remove('is-active');
    });
    var record = state.tree.index[path];
    if (!record) return;
    record.node.classList.add('is-active');
    if (record.li.scrollIntoView) record.li.scrollIntoView({ block: 'center' });
  }

  /* ---------------- right pane: file ---------------- */
  var PREVIEW_EXTENSIONS = ['.html', '.htm', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.txt', '.md'];
  function extensionOf(filePath) {
    var match = String(filePath || '').match(/\.[^./\\]+$/);
    return match ? match[0].toLowerCase() : '';
  }
  function repoUrl(filePath) {
    return '/repo/' + String(filePath || '').split('/').map(encodeURIComponent).join('/');
  }
  function defaultModeFor(filePath) {
    return PREVIEW_EXTENSIONS.indexOf(extensionOf(filePath)) !== -1 ? 'preview' : 'code';
  }
  function showRightView(name) {
    ['file', 'search'].forEach(function (viewName) {
      $('view-' + viewName).hidden = viewName !== name;
    });
    var tabs = $('tabs').querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('is-active', tabs[i].getAttribute('data-view') === name);
    }
  }
  function openFile(path, focusLine) {
    showRightView('file');
    setHash('file/' + encodeURIComponent(path));
    selectProject(toolForPath(path), { hash: false });
    state.file = {
      path: path,
      // A search hit opens the code so the hit line can be highlighted.
      mode: focusLine ? 'code' : defaultModeFor(path),
      text: null,
      meta: '',
      error: '',
      focusLine: focusLine || 0
    };
    renderFileView();
    highlightNode(path);
  }
  function renderFileView() {
    var file = state.file;
    if (!file) return;
    renderToolContext();
    $('filePath').textContent = file.path;
    $('btnCopyCode').disabled = false;
    $('btnOpenTab').disabled = file.mode !== 'preview';
    var modeButtons = $('fileMode').querySelectorAll('button[data-mode]');
    for (var i = 0; i < modeButtons.length; i++) {
      modeButtons[i].classList.toggle('is-active', modeButtons[i].getAttribute('data-mode') === file.mode);
    }
    $('previewWrap').hidden = file.mode !== 'preview';
    $('codeWrap').hidden = file.mode === 'preview';
    if (file.mode === 'preview') {
      var frame = $('fileFrame');
      var wanted = repoUrl(file.path);
      if (frame.getAttribute('src') !== wanted) frame.setAttribute('src', wanted);
      $('fileMeta').textContent = '';
      return;
    }
    $('fileMeta').textContent = file.meta || 'reading...';
    if (file.error) {
      $('codeWrap').innerHTML = '<p class="empty">' + esc(file.error) + '</p>';
      return;
    }
    if (file.text === null) {
      $('codeWrap').innerHTML = '<p class="empty">Reading ' + esc(file.path) + '...</p>';
      api('/api/workspace/file?path=' + encodeURIComponent(file.path))
        .then(function (payload) {
          file.text = payload.text;
          file.meta = bytesLabel(payload.bytes) + ' · ' + payload.lines + ' lines · modified ' + String(payload.modifiedAt).replace('T', ' ').slice(0, 19);
          if (state.file === file) renderFileView();
        })
        .catch(function (error) {
          file.error = error.message;
          if (state.file === file) renderFileView();
        });
      return;
    }
    renderCode(file.text, file.focusLine);
  }
  function setFileMode(mode) {
    if (!state.file) return;
    state.file.mode = mode === 'preview' ? 'preview' : 'code';
    renderFileView();
  }
  function copyText(text) {
    var value = String(text == null ? '' : text);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(value).then(function () { return true; }, function () { return false; });
    }
    return Promise.resolve(false);
  }
  function setCopyNote(text) {
    var note = $('copyNote');
    if (!note) return;
    note.textContent = text;
    clearTimeout(state.copyNoteTimer);
    state.copyNoteTimer = setTimeout(function () { note.textContent = ''; }, 4000);
  }
  function readFileText(filePath) {
    return api('/api/workspace/file?path=' + encodeURIComponent(filePath)).then(function (payload) { return payload.text; });
  }
  function copyCurrentFile() {
    var file = state.file;
    if (!file) return;
    var ready = file.text !== null ? Promise.resolve(file.text) : readFileText(file.path);
    ready.then(function (text) {
      return copyText(text).then(function (ok) {
        setCopyNote(ok ? 'copied ' + file.path.split('/').pop() : 'clipboard blocked by the browser');
      });
    }).catch(function (error) { setCopyNote('copy failed: ' + error.message); });
  }
  // The [HTML] [CSS] [JS] shape is the one html-tool-rules.txt asks a model for
  // and the one ApplicationStoreItem reads back with "Paste all code".
  function copyAllCode() {
    var tool = state.activeTool;
    if (!tool) return;
    var groups = toolGroups(tool);
    if (!groups.code.length) { setCopyNote('this tool has no code files'); return; }
    setCopyNote('reading code...');
    Promise.all(groups.code.map(function (item) {
      return readFileText(item.path).then(function (text) { return { label: item.label, text: text }; });
    })).then(function (parts) {
      var bundle = parts.map(function (part) {
        return '[' + part.label + ']\n' + String(part.text).replace(/\s+$/, '');
      }).join('\n\n');
      return copyText(bundle).then(function (ok) {
        setCopyNote(ok
          ? 'copied ' + parts.length + ' files (' + parts.map(function (part) { return part.label; }).join(' + ') + ')'
          : 'clipboard blocked by the browser');
      });
    }).catch(function (error) { setCopyNote('copy failed: ' + error.message); });
  }
  function renderCode(text, focusLine) {
    var wrap = $('codeWrap');
    wrap.innerHTML = '';
    var lines = String(text).split('\n');
    var shown = Math.min(lines.length, LINE_CAP);
    var table = document.createElement('table');
    table.className = 'code-table';
    var body = document.createElement('tbody');
    var fragment = document.createDocumentFragment();
    for (var i = 0; i < shown; i++) {
      var tr = document.createElement('tr');
      if (focusLine && i + 1 === focusLine) tr.className = 'is-hit';
      var numberCell = document.createElement('td');
      numberCell.className = 'ln';
      numberCell.textContent = String(i + 1);
      var codeCell = document.createElement('td');
      codeCell.textContent = lines[i] === '' ? ' ' : lines[i];
      tr.appendChild(numberCell);
      tr.appendChild(codeCell);
      fragment.appendChild(tr);
    }
    body.appendChild(fragment);
    table.appendChild(body);
    wrap.appendChild(table);
    if (lines.length > shown) {
      var note = document.createElement('p');
      note.className = 'foot-note';
      note.textContent = 'Showing the first ' + shown + ' of ' + lines.length + ' lines.';
      wrap.appendChild(note);
    }
    if (focusLine) {
      var hit = wrap.querySelector('tr.is-hit');
      if (hit && hit.scrollIntoView) hit.scrollIntoView({ block: 'center' });
    }
  }

  /* ---------------- tool tabs: Code / Test / Docs ---------------- */
  function toolGroups(tool) {
    var code = [];
    CODE_ORDER.forEach(function (kind) {
      var targetPath = tool.codeFiles && tool.codeFiles[kind];
      if (targetPath) code.push({ id: kind, label: kind.toUpperCase(), path: targetPath });
    });
    var test = tool.harness ? { id: 'test', label: 'Test harness', path: tool.harness } : null;
    var docs = [];
    DOC_ORDER.forEach(function (kind) {
      var targetPath = tool.documents && tool.documents[kind];
      if (targetPath) docs.push({ id: kind, label: DOC_LABELS[kind] || kind, path: targetPath });
    });
    return { code: code, test: test, docs: docs };
  }
  function toolGroupOfFile(tool, filePath) {
    var groups = toolGroups(tool);
    if (groups.test && groups.test.path === filePath) return { group: 'test', items: [] };
    var codeMatch = groups.code.filter(function (item) { return item.path === filePath; })[0];
    if (codeMatch) return { group: 'code', items: groups.code };
    var docsMatch = groups.docs.filter(function (item) { return item.path === filePath; })[0];
    if (docsMatch) return { group: 'docs', items: groups.docs };
    return { group: '', items: [] };
  }
  function toolGroupItems(groups, groupId) {
    if (groupId === 'code') return groups.code;
    if (groupId === 'docs') return groups.docs;
    if (groupId === 'test') return groups.test ? [groups.test] : [];
    return [];
  }
  function renderToolContext() {
    var host = $('toolContext');
    if (!host) return;
    var tool = state.activeTool;
    if (!tool || !state.file) { host.hidden = true; return; }
    host.hidden = false;
    $('toolContextName').textContent = tool.toolName;
    $('toolContextTrail').textContent = tool.relativePath;
    var groups = toolGroups(tool);
    var current = toolGroupOfFile(tool, state.file.path);
    var groupDefs = [
      { id: 'code', label: 'Code', count: groups.code.length },
      { id: 'test', label: 'Test', count: groups.test ? 1 : 0 },
      { id: 'docs', label: 'Docs', count: groups.docs.length }
    ];
    $('toolGroup').innerHTML = groupDefs.map(function (def) {
      var disabled = def.count === 0;
      return '<button type="button" data-tool-group="' + def.id + '"' +
        (def.id === current.group ? ' class="is-active"' : '') +
        (disabled ? ' disabled="disabled"' : '') +
        ' title="' + (disabled ? 'This tool has no ' + def.label.toLowerCase() + ' files' : def.label) + '">' +
        def.label + '</button>';
    }).join('');
    $('toolSubtabs').innerHTML = current.items.map(function (item) {
      return '<button type="button" data-tool-file="' + esc(item.path) + '"' +
        (item.path === state.file.path ? ' class="is-active"' : '') + '>' + esc(item.label) + '</button>';
    }).join('');
    $('toolSubtabs').hidden = current.items.length === 0;
  }

  /* ---------------- right drawer: tasks ---------------- */
  // What a project click puts on screen: its harness, or the first code file
  // when a tool has no harness.
  function openProjectSurface(tool) {
    var groups = toolGroups(tool);
    var target = groups.test || groups.code[0] || groups.docs[0];
    if (target) openFile(target.path);
  }
  function setTasksOpen(open) {
    state.tasksOpen = open;
    var drawer = $('tasksDrawer');
    if (drawer) drawer.hidden = !open;
    try { localStorage.setItem(TASKS_KEY, open ? '1' : '0'); } catch (error) {}
  }
  // Fetches and renders; it does not decide whether the drawer is open.
  function loadTasks(toolPath) {
    state.tasks = { path: toolPath, filter: 'open', query: '', data: null, error: '', loading: true };
    $('tasksTool').textContent = String(toolPath).split('/').pop() + ' tasks';
    $('tasksMeta').textContent = 'reading docs/ssot.html...';
    $('btnTasksSsot').disabled = true;
    renderTaskFilters();
    renderTaskList();
    api('/api/workspace/tasks?path=' + encodeURIComponent(toolPath))
      .then(function (payload) {
        if (!state.tasks || state.tasks.path !== toolPath) return;
        state.tasks.data = payload;
        state.tasks.loading = false;
        $('tasksCount').textContent = String(payload.counts.open) + ' open';
        $('btnTasksSsot').disabled = false;
        renderTaskList();
      })
      .catch(function (error) {
        if (!state.tasks || state.tasks.path !== toolPath) return;
        state.tasks.loading = false;
        state.tasks.error = error.message;
        $('tasksCount').textContent = '-';
        renderTaskList();
      });
  }
  function openTasks(toolPath) {
    var tool = toolByPath(toolPath);
    if (tool) selectProject(tool, { hash: false });
    setHash('tasks/' + encodeURIComponent(toolPath));
    var alreadyLoaded = state.tasksOpen && state.tasks && state.tasks.path === toolPath &&
      (state.tasks.loading || state.tasks.data);
    setTasksOpen(true);
    if (!alreadyLoaded) loadTasks(toolPath);
  }
  function renderTaskFilters() {
    var host = $('taskFilter');
    if (!host) return;
    var filter = (state.tasks && state.tasks.filter) || 'open';
    host.innerHTML = TASK_FILTERS.map(function (entry) {
      return '<button type="button" data-task-filter="' + entry.id + '"' + (entry.id === filter ? ' class="is-active"' : '') + '>' + entry.label + '</button>';
    }).join('');
  }
  function visibleTasks() {
    var data = state.tasks && state.tasks.data;
    if (!data || !data.tasks) return [];
    var filter = state.tasks.filter;
    var query = String(state.tasks.query || '').toLowerCase();
    return data.tasks.filter(function (task) {
      if (filter === 'open' && (task.done || task.ignored)) return false;
      if (filter === 'in-progress' && task.status !== 'in-progress') return false;
      if (filter === 'done' && !task.done) return false;
      if (!query) return true;
      return (task.id + ' ' + task.title + ' ' + task.group).toLowerCase().indexOf(query) !== -1;
    });
  }
  function renderTaskList() {
    var tasks = state.tasks || {};
    var host = $('taskRows');
    if (!host) return;
    if (!tasks.path) { host.innerHTML = '<p class="empty">No project selected.</p>'; return; }
    if (tasks.loading) { host.innerHTML = '<p class="empty">Reading the SSOT task list...</p>'; return; }
    if (tasks.error) {
      host.innerHTML = '<p class="empty">' + esc(tasks.error) + '</p>';
      $('tasksMeta').textContent = 'not readable';
      return;
    }
    var data = tasks.data;
    var counts = data.counts || { total: 0, done: 0, open: 0, ignored: 0 };
    $('tasksTool').textContent = data.tool + ' tasks';
    $('tasksMeta').textContent = counts.done + ' done · ' + counts.open + ' open' +
      (counts.ignored ? ' · ' + counts.ignored + ' ignored' : '') +
      (counts.pointsTotal ? ' · ' + counts.pointsDone + '/' + counts.pointsTotal + ' pts' : '');
    $('tasksFoot').textContent = 'docs/ssot.html · ' + String(data.modifiedAt).replace('T', ' ').slice(0, 16) +
      ' · "chat" puts a task into the conversation.';
    var rows = visibleTasks();
    if (!rows.length) { host.innerHTML = '<p class="empty">Nothing in this filter.</p>'; return; }
    host.innerHTML = rows.map(function (task) {
      var stateClass = task.done ? 'st-published' : (task.status === 'in-progress' ? 'st-in-progress' : (task.ignored ? 'st-draft' : 'st-ready'));
      return '<div class="task-item">' +
        '<div class="task-item-top">' +
        '<span class="status-pill ' + stateClass + '">' + esc(task.status) + '</span>' +
        '<span class="task-item-id">' + esc(task.id) + '</span>' +
        '<span class="task-item-points">' + (task.points ? task.points + (task.pointsOf ? '/' + task.pointsOf : '') + ' pts' : '') + '</span>' +
        '</div>' +
        '<div class="task-item-title">' + esc(task.title || '(no title)') + '</div>' +
        '<div class="task-item-foot">' +
        '<span class="task-item-group">' + esc(task.group || '') + '</span>' +
        '<button type="button" data-task-chat="' + esc(task.id) + '">chat</button>' +
        '</div></div>';
    }).join('');
  }

  /* ---------------- center: chat (sessions live in <tool>/Chats) ---------------- */
  function sessionStore(toolPath) {
    if (!state.sessions[toolPath]) {
      state.sessions[toolPath] = { list: [], activeKey: '', chats: {}, loaded: false, loading: false };
    }
    return state.sessions[toolPath];
  }
  function activeChat() {
    var tool = state.activeTool;
    if (!tool) return null;
    var store = sessionStore(tool.relativePath);
    return store.activeKey ? (store.chats[store.activeKey] || null) : null;
  }
  function createChat(store, name) {
    var key = 'local-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
    store.chats[key] = {
      key: key,
      id: '',
      name: name || ('Chat ' + (Object.keys(store.chats).length + 1)),
      messages: [],
      attachments: [],
      inflight: false,
      loaded: true
    };
    store.activeKey = key;
    return store.chats[key];
  }
  function loadSessions(toolPath) {
    var store = sessionStore(toolPath);
    store.loading = true;
    renderChat();
    return api('/api/studio/chats?path=' + encodeURIComponent(toolPath))
      .then(function (result) {
        store.list = result.chats || [];
        store.loaded = true;
        store.loading = false;
        if (!store.activeKey || !store.chats[store.activeKey]) {
          if (store.list.length) openSession(toolPath, store.list[0].id, { silent: true });
          else createChat(store, 'Chat 1');
        }
        renderChat();
      })
      .catch(function () {
        store.loaded = true;
        store.loading = false;
        if (!store.activeKey) createChat(store, 'Chat 1');
        renderChat();
      });
  }
  function openSession(toolPath, id, options) {
    var store = sessionStore(toolPath);
    if (store.chats[id] && store.chats[id].loaded) {
      store.activeKey = id;
      renderChat();
      return;
    }
    api('/api/studio/chats/load?path=' + encodeURIComponent(toolPath) + '&id=' + encodeURIComponent(id))
      .then(function (result) {
        store.chats[id] = {
          key: id,
          id: id,
          name: result.chat.name,
          messages: result.chat.messages || [],
          attachments: [],
          inflight: false,
          loaded: true
        };
        store.activeKey = id;
        renderChat();
      })
      .catch(function (error) {
        if (!options || !options.silent) {
          var chat = store.chats[store.activeKey];
          if (chat) chat.messages.push({ role: 'error', text: 'Could not open that chat: ' + error.message });
          renderChat();
        }
      });
  }
  function persistChat(chat) {
    var tool = state.activeTool;
    if (!tool || !chat) return Promise.resolve(null);
    var store = sessionStore(tool.relativePath);
    var oldKey = chat.key;
    return api('/api/studio/chats/save', {
      method: 'POST',
      body: JSON.stringify({
        toolPath: tool.relativePath,
        id: chat.id || '',
        name: chat.name,
        model: state.chatModel,
        messages: chat.messages.filter(function (message) { return message.role !== 'error'; })
      })
    })
      .then(function (result) {
        chat.id = result.id;
        chat.name = result.name;
        if (oldKey !== result.id) {
          delete store.chats[oldKey];
          store.chats[result.id] = chat;
          chat.key = result.id;
          store.activeKey = result.id;
        }
        var row = {
          id: result.id, name: result.name, updatedAt: result.updatedAt,
          messages: result.messages, model: state.chatModel, file: result.file
        };
        var found = store.list.some(function (entry) { return entry.id === result.id; });
        store.list = found
          ? store.list.map(function (entry) { return entry.id === result.id ? row : entry; })
          : [row].concat(store.list);
        renderChat();
        return result;
      })
      .catch(function (error) {
        chat.messages.push({ role: 'error', text: 'Could not save this chat: ' + error.message });
        renderChat();
        return null;
      });
  }
  function renderMessageHtml(text) {
    var parts = String(text == null ? '' : text).split('```');
    return parts.map(function (part, index) {
      if (index % 2 === 1) {
        var body = part.replace(/^[a-zA-Z0-9]*\n/, '');
        return '<pre class="msg-pre">' + esc(body) + '</pre>';
      }
      return esc(part).replace(/`([^`]+)`/g, '<code>$1</code>');
    }).join('');
  }
  function renderChat() {
    var tool = state.activeTool;
    var log = $('chatLog');
    var input = $('chatInput');
    var send = $('btnChatSend');
    var title = $('chatTitle');
    var contextChip = $('chatContext');
    var sessionSelect = $('chatSession');
    var attachHost = $('chatAttach');
    if (!tool) {
      title.textContent = 'Chat';
      contextChip.textContent = '';
      sessionSelect.innerHTML = '';
      input.disabled = true;
      send.disabled = true;
      input.placeholder = 'Select a project on the left to start.';
      attachHost.hidden = true;
      log.innerHTML = '<p class="chat-empty">Pick a project on the left. The assistant then reads that tool\'s SSOT, its code and the file you have open.</p>';
      return;
    }
    var store = sessionStore(tool.relativePath);
    if (store.loading) {
      title.textContent = 'Chat · ' + tool.toolName;
      contextChip.textContent = 'loading chats...';
      log.innerHTML = '<p class="chat-empty">Reading the chats saved in this project...</p>';
      return;
    }
    var chat = activeChat();
    if (!chat) {
      title.textContent = 'Chat · ' + tool.toolName;
      contextChip.textContent = '';
      log.innerHTML = '<p class="chat-empty">No chat open. Press + to start one.</p>';
      input.disabled = true;
      send.disabled = true;
      return;
    }
    title.textContent = chat.name + ' · ' + tool.toolName;
    contextChip.textContent = (state.chatModel ? state.chatModel + ' · ' : '') +
      (state.lastContext ? charsLabel(state.lastContext.chars) + ' chars in context' : 'SSOT + code + open file');
    var options = store.list.map(function (entry) {
      return '<option value="' + esc(entry.id) + '"' + (entry.id === chat.key ? ' selected="selected"' : '') + '>' +
        esc(entry.name) + ' (' + entry.messages + ')</option>';
    });
    if (!chat.id) {
      options = ['<option value="' + esc(chat.key) + '" selected="selected">' + esc(chat.name) + ' (unsaved)</option>'].concat(options);
    }
    sessionSelect.innerHTML = options.join('');
    input.disabled = false;
    send.disabled = chat.inflight;
    input.placeholder = chat.inflight ? 'Waiting for the answer...' : 'Ask about this project, or add a task from the Tasks tab.';
    attachHost.hidden = chat.attachments.length === 0;
    attachHost.innerHTML = chat.attachments.map(function (attachment, index) {
      return '<span class="chat-attach-chip"><b>' + (attachment.kind === 'image' ? 'IMG' : 'FILE') + '</b>' +
        esc(attachment.name) +
        '<button type="button" data-attach-remove="' + index + '" title="Remove">&#215;</button></span>';
    }).join('');
    if (!chat.messages.length) {
      log.innerHTML = '<p class="chat-empty">' + esc(chat.name) + '. Ask what this tool does, how a part works, why something breaks, or take a task from the Tasks tab.</p>';
      return;
    }
    log.innerHTML = chat.messages.map(function (message) {
      var attachments = (message.attachments || []).length
        ? '<div class="msg-attachments">' + message.attachments.map(function (attachment) {
          return '<span class="msg-attachment">' + esc(attachment.name || attachment.path) + '</span>';
        }).join('') + '</div>'
        : '';
      if (message.role === 'user') {
        return '<div class="msg msg-user"><span class="msg-who">You</span><div class="msg-text">' +
          renderMessageHtml(message.text) + attachments + '</div></div>';
      }
      if (message.role === 'error') {
        return '<div class="msg msg-error"><span class="msg-who">Could not answer</span><div class="msg-text">' + esc(message.text) + '</div></div>';
      }
      return '<div class="msg"><span class="msg-who">Assistant</span><div class="msg-text">' + renderMessageHtml(message.text) + '</div>' +
        (message.meta ? '<span class="msg-meta">' + esc(message.meta) + '</span>' : '') + '</div>';
    }).join('') + (chat.inflight ? '<div class="msg"><span class="msg-thinking">thinking...</span></div>' : '');
    log.scrollTop = log.scrollHeight;
  }
  function renderPendingTask() {
    var host = $('chatPending');
    var input = $('chatInput');
    if (!host) return;
    if (!state.pendingTask) {
      host.hidden = true;
      host.innerHTML = '';
      return;
    }
    host.hidden = false;
    host.innerHTML = '<span>Task ' + esc(state.pendingTask.id) + ': ' + esc(state.pendingTask.title) + '</span>' +
      '<button type="button" id="btnPendingClear" title="Remove the task from the message">&#215;</button>';
    var clear = $('btnPendingClear');
    if (clear) clear.addEventListener('click', function () {
      state.pendingTask = null;
      renderPendingTask();
      if (input) { input.value = ''; input.focus(); }
    });
    if (input) {
      input.value = 'Apply task ' + state.pendingTask.id + ': ' + state.pendingTask.title +
        '. Read the code and the SSOT, then tell me exactly what to change.';
      input.focus();
    }
  }
  function ensureChatId(chat) {
    if (chat.id) return Promise.resolve(chat.id);
    return persistChat(chat).then(function (result) { return result ? result.id : ''; });
  }
  function addAttachmentFiles(fileList) {
    var chat = activeChat();
    if (!chat || !fileList || !fileList.length) return;
    var files = Array.prototype.slice.call(fileList);
    ensureChatId(chat).then(function (chatId) {
      files.forEach(function (file) {
        var reader = new FileReader();
        reader.onload = function () {
          var dataUrl = String(reader.result || '');
          var base64 = dataUrl.indexOf(',') >= 0 ? dataUrl.split(',')[1] : '';
          api('/api/studio/chat/attachment', {
            method: 'POST',
            body: JSON.stringify({ toolPath: state.activeTool.relativePath, chatId: chatId || 'unsaved', name: file.name, dataBase64: base64 })
          })
            .then(function (result) {
              chat.attachments.push({ path: result.path, name: result.name, kind: result.kind });
              renderChat();
            })
            .catch(function (error) {
              chat.messages.push({ role: 'error', text: 'Attachment failed: ' + error.message });
              renderChat();
            });
        };
        reader.readAsDataURL(file);
      });
    });
  }
  function sendChat() {
    var tool = state.activeTool;
    var input = $('chatInput');
    var chat = activeChat();
    if (!tool || !input || !chat || chat.inflight) return;
    var text = String(input.value || '').trim();
    if (!text && !chat.attachments.length) return;
    var attachments = chat.attachments.slice();
    chat.messages.push({
      role: 'user',
      text: text,
      at: new Date().toISOString(),
      attachments: attachments
    });
    chat.attachments = [];
    input.value = '';
    var task = state.pendingTask;
    state.pendingTask = null;
    renderPendingTask();
    chat.inflight = true;
    renderChat();
    persistChat(chat);
    log('Sending to the assistant (' + charsLabel(text.length) + ' chars)');
    api('/api/studio/chat', {
      method: 'POST',
      body: JSON.stringify({
        toolPath: tool.relativePath,
        messages: chat.messages.filter(function (message) { return message.role !== 'error'; })
          .map(function (message) { return { role: message.role, text: message.text }; }),
        openFile: state.file ? state.file.path : '',
        task: task || null,
        attachments: attachments.map(function (attachment) {
          return { path: attachment.path, name: attachment.name, kind: attachment.kind };
        })
      })
    })
      .then(function (result) {
        state.lastContext = result.context || null;
        chat.messages.push({
          role: 'assistant',
          text: result.reply.text,
          at: new Date().toISOString(),
          meta: [result.reply.provider, result.reply.model, result.reply.tokens ? result.reply.tokens + ' tokens' : '']
            .filter(Boolean).join(' · ')
        });
        chat.inflight = false;
        renderChat();
        persistChat(chat);
      })
      .catch(function (error) {
        chat.messages.push({ role: 'error', text: error.message });
        chat.inflight = false;
        renderChat();
      });
  }
  function log(message) {
    // Developer detail belongs in the console, never in the transcript.
    try { console.log('[studio] ' + message); } catch (error) {}
  }

  /* ---------------- right pane: search ---------------- */
  function runSearch(query) {
    var wanted = String(query || '').trim();
    showRightView('search');
    if (!wanted) {
      state.search = { q: '', hits: [], truncated: false };
      $('searchCount').textContent = '-';
      $('searchMeta').textContent = 'Type in the search box above.';
      $('searchHits').innerHTML = '<p class="empty">No search yet.</p>';
      return;
    }
    setHash('search/' + encodeURIComponent(wanted));
    $('searchMeta').textContent = 'Searching for "' + wanted + '"...';
    api('/api/workspace/search?q=' + encodeURIComponent(wanted))
      .then(function (payload) {
        state.search = { q: wanted, hits: payload.hits, truncated: payload.truncated };
        $('searchCount').textContent = String(payload.hits.length);
        $('searchMeta').textContent = payload.hits.length + ' hit(s) in ' + payload.scanned + ' scanned files' +
          (payload.truncated ? ' - stopped at the limit, narrow the query' : '');
        renderHits();
      })
      .catch(function (error) {
        $('searchMeta').textContent = error.message;
        $('searchHits').innerHTML = '';
      });
  }
  function renderHits() {
    var host = $('searchHits');
    host.innerHTML = '';
    if (!state.search.hits.length) {
      host.innerHTML = '<p class="empty">Nothing matches.</p>';
      return;
    }
    var fragment = document.createDocumentFragment();
    state.search.hits.forEach(function (hit) {
      var card = document.createElement('div');
      card.className = 'hit';
      var head = document.createElement('div');
      head.innerHTML = '<span class="hit-path">' + esc(hit.path) + '</span><span class="hit-line">:' + hit.line + '</span>';
      var text = document.createElement('div');
      text.className = 'hit-text';
      text.textContent = hit.text;
      card.appendChild(head);
      card.appendChild(text);
      card.addEventListener('click', function () { openFile(hit.path, hit.line); });
      fragment.appendChild(card);
    });
    host.appendChild(fragment);
  }

  /* ---------------- wiring ---------------- */
  function initRail() {
    var savedOpen = null;
    var savedView = null;
    var savedTasks = null;
    try {
      savedOpen = localStorage.getItem(RAIL_KEY);
      savedView = localStorage.getItem(RAIL_VIEW_KEY);
      savedTasks = localStorage.getItem(TASKS_KEY);
    } catch (error) {}
    setRailOpen(savedOpen !== '0');
    showRailView(savedView === 'files' ? 'files' : 'tools');
    setTasksOpen(savedTasks === '1');
  }
  function wire() {
    var tabs = $('tabs').querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
      (function (tab) {
        tab.addEventListener('click', function () {
          var name = tab.getAttribute('data-view');
          showRightView(name);
          if (name === 'file' && state.file) setHash('file/' + encodeURIComponent(state.file.path));
          if (name === 'search' && state.search.q) setHash('search/' + encodeURIComponent(state.search.q));
        });
      })(tabs[i]);
    }

    on('railSwitch', 'click', function (event) {
      var button = event.target.closest('button[data-rail]');
      if (!button) return;
      showRailView(button.getAttribute('data-rail'));
    });
    on('railHandle', 'click', function () { setRailOpen(!state.railOpen); });
    on('btnRailClose', 'click', function () { setRailOpen(false); });
    on('btnTasksClose', 'click', function () {
      setTasksOpen(false);
      if (state.file) setHash('file/' + encodeURIComponent(state.file.path));
      else if (state.activeTool) setHash('tool/' + encodeURIComponent(state.activeTool.relativePath));
    });
    on('btnCollapseAll', 'click', function () { loadTree(); });
    on('btnRefresh', 'click', function () { loadTree(); loadRegistry(); });

    on('toolList', 'click', function (event) {
      var tasksButton = event.target.closest('button[data-tasks]');
      if (tasksButton) { openTasks(tasksButton.getAttribute('data-tasks')); return; }
      var openButton = event.target.closest('button[data-open]');
      if (openButton) {
        var tool = toolByPath(openButton.getAttribute('data-open'));
        if (tool) {
          var groups = toolGroups(tool);
          var first = groups.code[0] || groups.test || groups.docs[0];
          if (first) openFile(first.path);
        }
        return;
      }
      var card = event.target.closest('[data-project]');
      if (!card) return;
      var selected = toolByPath(card.getAttribute('data-project'));
      if (!selected) return;
      selectProject(selected);
      // A project click means: show me its backlog, and put its harness on screen.
      openTasks(selected.relativePath);
      openProjectSurface(selected);
    });
    on('toolFilter', 'input', debounce(function (event) {
      state.toolQuery = String(event.target.value || '').trim();
      renderToolList();
    }, 180));
    on('groupFilter', 'click', function (event) {
      var button = event.target.closest('button[data-group]');
      if (!button) return;
      state.groupFilter = button.getAttribute('data-group');
      renderGroupFilter();
      renderToolList();
    });
    on('statusFilter', 'click', function (event) {
      var button = event.target.closest('button[data-status]');
      if (!button) return;
      state.statusFilter = button.getAttribute('data-status');
      renderStatusFilter();
      renderToolList();
    });

    on('btnOpenTab', 'click', function () {
      if (!state.file) return;
      window.open(repoUrl(state.file.path), '_blank', 'noopener');
    });
    on('fileMode', 'click', function (event) {
      var button = event.target.closest('button[data-mode]');
      if (!button) return;
      setFileMode(button.getAttribute('data-mode'));
    });
    on('btnCopyCode', 'click', function () { copyCurrentFile(); });
    on('btnCopyAll', 'click', function () { copyAllCode(); });
    on('toolGroup', 'click', function (event) {
      var button = event.target.closest('button[data-tool-group]');
      if (!button || !state.activeTool) return;
      var groups = toolGroups(state.activeTool);
      var items = toolGroupItems(groups, button.getAttribute('data-tool-group'));
      if (!items.length) return;
      var current = state.file && items.filter(function (item) { return item.path === state.file.path; })[0];
      openFile((current || items[0]).path);
    });
    on('toolSubtabs', 'click', function (event) {
      var button = event.target.closest('button[data-tool-file]');
      if (!button) return;
      openFile(button.getAttribute('data-tool-file'));
    });

    on('taskFilter', 'click', function (event) {
      var button = event.target.closest('button[data-task-filter]');
      if (!button || !state.tasks) return;
      state.tasks.filter = button.getAttribute('data-task-filter');
      renderTaskFilters();
      renderTaskList();
    });
    on('taskSearch', 'input', debounce(function (event) {
      if (!state.tasks) return;
      state.tasks.query = String(event.target.value || '').trim();
      renderTaskList();
    }, 180));
    on('taskRows', 'click', function (event) {
      var button = event.target.closest('button[data-task-chat]');
      if (!button) return;
      var taskId = button.getAttribute('data-task-chat');
      var data = state.tasks && state.tasks.data;
      var task = data && data.tasks.filter(function (entry) { return entry.id === taskId; })[0];
      if (!task) return;
      state.pendingTask = { id: task.id, title: task.title, group: task.group, status: task.status };
      if (state.activeTool) setHash('tool/' + encodeURIComponent(state.activeTool.relativePath));
      renderChat();
      renderPendingTask();
      var input = $('chatInput');
      if (input) input.focus();
    });
    on('btnTasksSsot', 'click', function () {
      if (!state.tasks || !state.tasks.path) return;
      openFile(state.tasks.path + '/docs/ssot.html');
    });

    on('chatForm', 'submit', function (event) {
      event.preventDefault();
      sendChat();
    });
    on('chatInput', 'keydown', function (event) {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        sendChat();
      }
    });
    on('btnChatNew', 'click', function () {
      if (!state.activeTool) return;
      var store = sessionStore(state.activeTool.relativePath);
      createChat(store, 'Chat ' + (store.list.length + Object.keys(store.chats).length + 1));
      renderChat();
      var input = $('chatInput');
      if (input) input.focus();
    });
    on('btnChatRename', 'click', function () {
      var chat = activeChat();
      if (!chat) return;
      var name = window.prompt('Chat name', chat.name);
      if (!name || !name.trim()) return;
      chat.name = name.trim().slice(0, 80);
      renderChat();
      persistChat(chat);
    });
    on('btnChatDelete', 'click', function () {
      var tool = state.activeTool;
      var chat = activeChat();
      if (!tool || !chat) return;
      if (!window.confirm('Delete the chat "' + chat.name + '"?')) return;
      var store = sessionStore(tool.relativePath);
      delete store.chats[chat.key];
      store.activeKey = '';
      if (chat.id) {
        api('/api/studio/chats/delete', { method: 'POST', body: JSON.stringify({ toolPath: tool.relativePath, id: chat.id }) })
          .then(function () { return loadSessions(tool.relativePath); })
          .catch(function () { renderChat(); });
      } else {
        renderChat();
      }
    });
    on('chatSession', 'change', function (event) {
      if (!state.activeTool) return;
      var value = String(event.target.value || '');
      if (!value) return;
      openSession(state.activeTool.relativePath, value);
    });
    on('btnChatAttach', 'click', function () {
      var fileInput = $('chatFile');
      if (fileInput) fileInput.click();
    });
    on('chatFile', 'change', function (event) {
      addAttachmentFiles(event.target.files);
      event.target.value = '';
    });
    on('chatAttach', 'click', function (event) {
      var button = event.target.closest('button[data-attach-remove]');
      if (!button) return;
      var chat = activeChat();
      if (!chat) return;
      var index = Number(button.getAttribute('data-attach-remove'));
      if (!isNaN(index)) chat.attachments.splice(index, 1);
      renderChat();
    });
    on('btnChatPing', 'click', function () {
      var tool = state.activeTool;
      if (!tool) return;
      var hint = $('chatHint');
      if (hint) hint.textContent = 'testing the gateway...';
      api('/api/studio/chat/ping', { method: 'POST', body: JSON.stringify({ toolPath: tool.relativePath }) })
        .then(function (result) {
          if (hint) hint.textContent = 'gateway ok · ' + result.provider + ' · ' + result.model + ' · ' + result.latencyMs + ' ms';
        })
        .catch(function (error) {
          if (hint) hint.textContent = 'gateway failed: ' + error.message;
        });
    });

    on('searchInput', 'input', debounce(function (event) { runSearch(event.target.value); }, 320));
    on('searchInput', 'keydown', function (event) {
      if (event.key === 'Enter') runSearch(event.target.value);
    });
  }

  wire();
  initRail();
  checkServerBuild();
  loadTree().then(applyHash);
  loadRegistry();
  renderProjectLine();
  renderChat();
  window.addEventListener('hashchange', applyHash);
})();
