'use strict';
/* UniconHub Studio - local repository browser and tool registry.
   Read only: every action here is a GET. Writes belong to build runs, queued
   tasks and publish plans, never to a stray click in a browser. */

(function () {
  var state = {
    tools: null,
    groupFilter: 'all',
    statusFilter: 'all',
    toolQuery: '',
    file: null,
    tasks: null,
    search: { q: '', hits: [], truncated: false, meta: '' },
    tree: { loaded: {}, open: {}, index: {} }
  };
  var LINE_CAP = 3000;
  // Kept equal to APP_BUILD by test/check-sources.cjs. A page older than the
  // server, or a server older than the page, is a trap: routes exist on one side
  // only and every click answers "Not found". Compare, then say so.
  var STUDIO_BUILD = '0.13.5';

  function $(id) { return document.getElementById(id); }
  function esc(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function api(url) {
    return fetch(url, { cache: 'no-store' }).then(function (response) {
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
  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(null, args); }, wait);
    };
  }

  /* ---------------- url state ---------------- */
  // #file/<path>, #tasks/<path>, #search/<query>, #tools. Refresh restores the
  // tree, the view and the open item instead of dropping the operator back to
  // an empty page.
  function setHash(value) {
    var next = value ? '#' + value : '#';
    if (window.location.hash === next) return;
    try {
      history.replaceState(null, '', next);
    } catch (error) {
      window.location.hash = next;
    }
  }
  function readHash() {
    var raw = String(window.location.hash || '').replace(/^#/, '');
    try {
      if (raw.indexOf('file/') === 0) return { view: 'file', path: decodeURIComponent(raw.slice(5)) };
      if (raw.indexOf('tasks/') === 0) return { view: 'tasks', path: decodeURIComponent(raw.slice(6)) };
      if (raw.indexOf('search/') === 0) return { view: 'search', query: decodeURIComponent(raw.slice(7)) };
    } catch (error) {
      return { view: 'tools' };
    }
    return { view: 'tools' };
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
    showView('tools');
  }
  function checkServerBuild() {
    api('/api/state')
      .then(function (state) {
        if (state.build === STUDIO_BUILD) return;
        var chip = $('serverChip');
        if (!chip) return;
        chip.hidden = false;
        chip.className = 'chip chip-warn';
        chip.textContent = 'server ' + state.build + ' · page ' + STUDIO_BUILD + ' - restart the server';
        chip.title = 'The server is running older code than this page, so new routes (like the preview) answer Not found. Stop it and run npm start again.';
      })
      .catch(function () {
        var chip = $('serverChip');
        if (!chip) return;
        chip.hidden = false;
        chip.className = 'chip chip-bad';
        chip.textContent = 'server not reachable';
      });
  }

  /* ---------------- tree ---------------- */
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
    toggle.textContent = entry.type === 'dir' ? '▸' : '';
    var icon = document.createElement('span');
    icon.className = 'node-icon';
    icon.textContent = entry.type === 'dir' ? (entry.tool ? '◆' : '▸') : '·';
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
    if (entry.type === 'file' && entry.text === false) {
      var binTag = document.createElement('span');
      binTag.className = 'node-tag';
      binTag.textContent = 'bin';
      node.appendChild(binTag);
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
    var isOpen = state.tree.open[path] === true;
    if (isOpen) {
      state.tree.open[path] = false;
      var list = li.querySelector(':scope > ul');
      if (list) list.hidden = true;
      record.node.querySelector('.node-toggle').textContent = '▸';
      return;
    }
    state.tree.open[path] = true;
    record.node.querySelector('.node-toggle').textContent = '▾';
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
        var focus = ['BUSINESS', 'PERSONAL'];
        focus.forEach(function (name) {
          if (state.tree.index[name]) toggleDirectory(name);
        });
      })
      .catch(function (error) {
        tree.innerHTML = '<li class="node-error">' + esc(error.message) + '</li>';
      });
  }
  // Opens every ancestor of a path, then marks the folder - used by the tool
  // registry "open" action and by search hits.
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

  /* ---------------- file view ---------------- */
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
  function showView(name) {
    ['tools', 'file', 'tasks', 'search'].forEach(function (viewName) {
      $('view-' + viewName).hidden = viewName !== name;
    });
    var tabs = $('tabs').querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('is-active', tabs[i].getAttribute('data-view') === name);
    }
  }
  function openFile(path, focusLine) {
    showView('file');
    setHash('file/' + encodeURIComponent(path));
    state.file = {
      path: path,
      // A search hit opens the code so the hit line can be highlighted; every
      // other open starts in the preview because that is what is being read.
      mode: focusLine ? 'code' : defaultModeFor(path),
      text: null,
      meta: '',
      error: '',
      focusLine: focusLine || 0
    };
    $('fileCount').textContent = extensionOf(path).replace('.', '') || 'txt';
    renderFileView();
    highlightNode(path);
  }
  function renderFileView() {
    var file = state.file;
    if (!file) return;
    $('filePath').textContent = file.path;
    $('btnCopyPath').disabled = false;
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
      $('fileMeta').textContent = 'preview · ' + extensionOf(file.path) + ' · relative CSS, JS and images resolve as in the folder';
      $('previewNote').textContent = 'Rendered from ' + wanted + ' - the same file the CMS would load. Switch to Code for the source.';
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

  /* ---------------- tasks (the tool SSOT backlog) ---------------- */
  var TASK_FILTERS = [
    { id: 'open', label: 'Open' },
    { id: 'in-progress', label: 'In progress' },
    { id: 'done', label: 'Done' },
    { id: 'all', label: 'All' }
  ];
  function openTasks(toolPath) {
    showView('tasks');
    setHash('tasks/' + encodeURIComponent(toolPath));
    state.tasks = { path: toolPath, filter: 'open', query: '', data: null, error: '', loading: true };
    $('tasksTool').textContent = String(toolPath).split('/').pop() + ' — task list';
    $('tasksMeta').textContent = 'reading docs/ssot.html...';
    $('btnTasksSsot').disabled = true;
    renderTaskFilters();
    renderTaskRows();
    api('/api/workspace/tasks?path=' + encodeURIComponent(toolPath))
      .then(function (payload) {
        state.tasks.data = payload;
        state.tasks.loading = false;
        $('taskCount').textContent = String(payload.counts.open);
        $('btnTasksSsot').disabled = false;
        renderTaskRows();
      })
      .catch(function (error) {
        state.tasks.loading = false;
        state.tasks.error = error.message;
        $('taskCount').textContent = '-';
        renderTaskRows();
      });
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
  function renderTaskRows() {
    var tasks = state.tasks || {};
    var body = $('taskRows');
    if (tasks.loading) { body.innerHTML = '<tr><td colspan="6" class="empty">Reading the SSOT task list...</td></tr>'; return; }
    if (tasks.error) { body.innerHTML = '<tr><td colspan="6" class="empty">' + esc(tasks.error) + '</td></tr>'; $('tasksMeta').textContent = 'not readable'; return; }
    var data = tasks.data;
    var counts = data.counts || { total: 0, done: 0, open: 0, ignored: 0 };
    $('tasksTool').textContent = data.tool + ' — task list';
    $('tasksMeta').textContent = counts.done + ' done · ' + counts.open + ' open' +
      (counts.ignored ? ' · ' + counts.ignored + ' ignored' : '') +
      ' · ' + counts.total + ' tasks' +
      (counts.pointsTotal ? ' · ' + counts.pointsDone + '/' + counts.pointsTotal + ' points' : '');
    $('tasksFoot').textContent = 'Source: ' + data.file + ' · modified ' + String(data.modifiedAt).replace('T', ' ').slice(0, 19) +
      '. Studio reads this list; the SSOT stays the place where it is edited.';
    var rows = visibleTasks();
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="6" class="empty">Nothing in this filter.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(function (task) {
      var stateClass = task.done ? 'st-published' : (task.status === 'in-progress' ? 'st-in-progress' : (task.ignored ? 'st-draft' : 'st-ready'));
      return '<tr>' +
        '<td><span class="status-pill ' + stateClass + '">' + esc(task.status) + '</span></td>' +
        '<td class="col-task-id">' + esc(task.id) + '</td>' +
        '<td class="task-title-cell">' + esc(task.title || '(no title)') + '</td>' +
        '<td class="cell-trail">' + esc(task.group || '-') + '</td>' +
        '<td class="col-num"><span class="task-points">' + (task.points ? task.points + (task.pointsOf ? '/' + task.pointsOf : '') : '-') + '</span></td>' +
        '<td class="task-priority">' + esc(task.priority || '-') + '</td>' +
        '</tr>';
    }).join('');
  }

  /* ---------------- search ---------------- */
  function runSearch(query) {
    var wanted = String(query || '').trim();
    if (!wanted) {
      state.search = { q: '', hits: [], truncated: false, meta: '' };
      $('searchCount').textContent = '-';
      $('searchMeta').textContent = 'Type in the search box above.';
      $('searchHits').innerHTML = '<p class="empty">No search yet.</p>';
      return;
    }
    showView('search');
    setHash('search/' + encodeURIComponent(wanted));
    $('searchMeta').textContent = 'Searching for "' + wanted + '"...';
    api('/api/workspace/search?q=' + encodeURIComponent(wanted))
      .then(function (payload) {
        state.search = { q: wanted, hits: payload.hits, truncated: payload.truncated, meta: '' };
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

  /* ---------------- tool registry ---------------- */
  function meterHtml(subjects, total, okClass) {
    var html = '<span class="meter">';
    for (var i = 0; i < total; i++) {
      var on = subjects.length > i;
      html += '<i class="' + (on ? (okClass || 'on') : '') + '"></i>';
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
  function renderStats() {
    var registry = state.tools;
    if (!registry) return;
    var counts = { published: 0, ready: 0, documented: 0, 'in-progress': 0, draft: 0 };
    registry.tools.forEach(function (tool) { counts[tool.status] = (counts[tool.status] || 0) + 1; });
    var cards = [
      { label: 'tools', value: registry.total },
      { label: 'published', value: counts.published, cls: 'is-ok' },
      { label: 'ready', value: counts.ready, cls: counts.ready ? 'is-ok' : '' },
      { label: 'documented', value: counts.documented },
      { label: 'in progress', value: counts['in-progress'], cls: counts['in-progress'] ? 'is-warn' : '' },
      { label: 'draft', value: counts.draft, cls: counts.draft ? 'is-warn' : '' }
    ];
    $('statRow').innerHTML = cards.map(function (card) {
      return '<div class="stat ' + (card.cls || '') + '"><b>' + card.value + '</b>' + esc(card.label) + '</div>';
    }).join('');
    $('toolCount').textContent = String(registry.total);
    var ledgerNote = registry.ledger.ok
      ? 'Publish ledger read from ' + registry.ledger.path + ' (built ' + String(registry.ledger.generatedAt).slice(0, 19).replace('T', ' ') + ').'
      : 'Publish ledger not readable: ' + registry.ledger.reason;
    $('toolsFoot').textContent = ledgerNote + ' "Documented" means code, harness and all five documents exist; screenshots and the store are still missing. Repo: ' + registry.repoRoot;
  }
  function renderGroupFilter() {
    var groups = (state.tools && state.tools.groups) || [];
    var buttons = [{ key: 'all', label: 'All folders' }].concat(groups.map(function (group) {
      return { key: group.group, label: group.group + ' (' + group.tools + ')' };
    }));
    $('groupFilter').innerHTML = buttons.map(function (button) {
      return '<button type="button" data-group="' + esc(button.key) + '"' + (state.groupFilter === button.key ? ' class="is-active"' : '') + '>' + esc(button.label) + '</button>';
    }).join('');
  }
  function renderStatusFilter() {
    var statuses = ['all', 'published', 'ready', 'documented', 'in-progress', 'draft'];
    $('statusFilter').innerHTML = statuses.map(function (status) {
      return '<button type="button" data-status="' + status + '"' + (state.statusFilter === status ? ' class="is-active"' : '') + '>' + (status === 'all' ? 'Any state' : status) + '</button>';
    }).join('');
  }
  function renderTools() {
    var rows = visibleTools();
    var body = $('toolRows');
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="7" class="empty">No tool matches those filters.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(function (tool) {
      var docs = ['webpage', 'help', 'presentation', 'updates', 'social'].filter(function (kind) {
        return tool.documents && tool.documents[kind];
      });
      var packageSubjects = tool.package.present || [];
      return '<tr>' +
        '<td><span class="status-pill st-' + esc(tool.status) + '">' + esc(tool.status) + '</span></td>' +
        '<td><div class="cell-name">' + esc(tool.toolName) + '</div><div class="cell-trail">' + esc(tool.trail) + '</div></td>' +
        '<td class="cell-trail">' + esc(tool.folderName) + '</td>' +
        '<td class="col-num">' + meterHtml(packageSubjects, 8) + '</td>' +
        '<td class="col-num">' + meterHtml(tool.publish.present || [], 8, 'on-ok') + '</td>' +
        '<td class="col-build">' + esc(tool.toolBuild || '-') + '</td>' +
        '<td class="col-act"><button class="btn btn-ghost btn-sm" type="button" data-tasks="' + esc(tool.relativePath) + '">tasks</button> ' +
        '<button class="btn btn-ghost btn-sm" type="button" data-open="' + esc(tool.relativePath) + '">open</button></td>' +
        '</tr>';
    }).join('');
    var docsNote = 'Showing ' + rows.length + ' of ' + state.tools.total + ' tools.';
    if (state.tools.problems.length) docsNote += ' ' + state.tools.problems.length + ' folder problem(s) - run a build check.';
    $('railFoot').textContent = docsNote;
  }
  function loadRegistry() {
    return api('/api/workspace/tools')
      .then(function (registry) {
        state.tools = registry;
        $('repoLine').textContent = 'repository: ' + registry.repoRoot;
        renderStats();
        renderGroupFilter();
        renderStatusFilter();
        renderTools();
      })
      .catch(function (error) {
        $('toolRows').innerHTML = '<tr><td colspan="7" class="empty">' + esc(error.message) + '</td></tr>';
        $('repoLine').textContent = 'repository: not readable';
      });
  }

  /* ---------------- wiring ---------------- */
  function wire() {
    var tabs = $('tabs').querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
      (function (tab) {
        tab.addEventListener('click', function () {
          var name = tab.getAttribute('data-view');
          showView(name);
          if (name === 'tools') setHash('tools');
          if (name === 'file' && state.file) setHash('file/' + encodeURIComponent(state.file.path));
          if (name === 'tasks' && state.tasks) setHash('tasks/' + encodeURIComponent(state.tasks.path));
          if (name === 'search' && state.search && state.search.q) setHash('search/' + encodeURIComponent(state.search.q));
        });
      })(tabs[i]);
    }
    $('btnRefresh').addEventListener('click', function () {
      loadTree();
      loadRegistry();
    });
    $('btnCollapseAll').addEventListener('click', function () { loadTree(); });
    $('btnCopyPath').addEventListener('click', function () {
      if (!state.file || !state.file.path) return;
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(state.file.path);
    });
    $('btnOpenTab').addEventListener('click', function () {
      if (!state.file || !state.file.path) return;
      window.open(repoUrl(state.file.path), '_blank', 'noopener');
    });
    $('fileMode').addEventListener('click', function (event) {
      var button = event.target.closest('button[data-mode]');
      if (!button) return;
      setFileMode(button.getAttribute('data-mode'));
    });
    $('taskFilter').addEventListener('click', function (event) {
      var button = event.target.closest('button[data-task-filter]');
      if (!button || !state.tasks) return;
      state.tasks.filter = button.getAttribute('data-task-filter');
      renderTaskFilters();
      renderTaskRows();
    });
    $('taskSearch').addEventListener('input', debounce(function (event) {
      if (!state.tasks) return;
      state.tasks.query = String(event.target.value || '').trim();
      renderTaskRows();
    }, 180));
    $('btnTasksSsot').addEventListener('click', function () {
      if (!state.tasks || !state.tasks.path) return;
      openFile(state.tasks.path + '/docs/ssot.html');
    });
    $('searchInput').addEventListener('input', debounce(function (event) {
      runSearch(event.target.value);
    }, 320));
    $('searchInput').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') runSearch(event.target.value);
    });
    $('toolFilter').addEventListener('input', debounce(function (event) {
      state.toolQuery = String(event.target.value || '').trim();
      renderTools();
    }, 200));
    $('groupFilter').addEventListener('click', function (event) {
      var button = event.target.closest('button[data-group]');
      if (!button) return;
      state.groupFilter = button.getAttribute('data-group');
      renderGroupFilter();
      renderTools();
    });
    $('statusFilter').addEventListener('click', function (event) {
      var button = event.target.closest('button[data-status]');
      if (!button) return;
      state.statusFilter = button.getAttribute('data-status');
      renderStatusFilter();
      renderTools();
    });
    $('toolRows').addEventListener('click', function (event) {
      var tasksButton = event.target.closest('button[data-tasks]');
      if (tasksButton) {
        openTasks(tasksButton.getAttribute('data-tasks'));
        return;
      }
      var button = event.target.closest('button[data-open]');
      if (!button) return;
      var path = button.getAttribute('data-open');
      showView('tools');
      expandToPath(path, function () {
        highlightNode(path);
        var record = state.tree.index[path];
        if (record) {
          var appPath = path + '/app';
          if (state.tree.index[appPath]) toggleDirectory(appPath);
        }
      });
    });
  }

  wire();
  checkServerBuild();
  loadTree().then(applyHash);
  loadRegistry();
  window.addEventListener('hashchange', applyHash);
})();
