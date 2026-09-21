/* ==========================================================================
   Shared behavior for html-tool SSOT documents
   --------------------------------------------------------------------------
   Lives ONCE in _docs/assets/ssot.js and is linked by every generated
   docs/ssot.html. It drives:
   - the table-of-contents sidebar (generated from the document headings)
   - the four tabs (Document / Tasks / Push / Risks)
   - the always-visible task panel (generated from section 15)
   - task / idea / risk statistics, chips and progress bars
   - checkbox persistence (localStorage, per document)
   - the push gate view (PUSH READY per release group)
   Everything task-related is generated from section 15; edit tasks only
   there. Risks come from section 18. Ideas come from section 16.
   ========================================================================== */
(function () {
  'use strict';
  if (window.__ssotEngineBooted) { return; }
  window.__ssotEngineBooted = true;

  var STORAGE_KEY_PREFIX = 'ssot_document_';

  // ---------- small helpers ----------
  function byId(id) { return document.getElementById(id); }
  function all(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }
  function documentName() {
    var name = window.location.pathname.split('/').pop().replace(/\.html$/, '');
    return name || 'document';
  }
  function storageKey(itemId) { return STORAGE_KEY_PREFIX + documentName() + '_' + itemId; }
  function storageRead(itemId) {
    try { return window.localStorage.getItem(storageKey(itemId)); } catch (error) { return null; }
  }
  function storageWrite(itemId, value) {
    try { window.localStorage.setItem(storageKey(itemId), value); } catch (error) { /* storage unavailable */ }
  }
  function slugifyHeading(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  // ---------- sidebar (table of contents) ----------
  function ensureHeadingIds() {
    var usedIds = {};
    all('#view-document h2, #view-document h3').forEach(function (heading) {
      var baseId = heading.id || slugifyHeading(heading.textContent);
      var uniqueId = baseId;
      var counter = 2;
      while (usedIds[uniqueId]) { uniqueId = baseId + '-' + counter; counter++; }
      usedIds[uniqueId] = true;
      heading.id = uniqueId;
    });
  }
  function buildTableOfContents() {
    ensureHeadingIds();
    var toc = byId('sidebar-toc');
    if (!toc) { return; }
    var items = all('#view-document h2, #view-document h3').map(function (heading) {
      var level = heading.tagName.toLowerCase();
      return '<a class="' + (level === 'h3' ? 'toc-h3' : 'toc-h2') + '" href="#' + heading.id + '">'
        + escapeHtml(heading.textContent) + '</a>';
    });
    toc.innerHTML = items.join('');
    all('#sidebar-toc a', toc).forEach(function (link) {
      link.addEventListener('click', function () { closeSidebar(); });
    });
  }
  function openSidebar() {
    byId('sidebar').classList.add('open');
    byId('sidebar-overlay').classList.add('open');
  }
  function closeSidebar() {
    byId('sidebar').classList.remove('open');
    byId('sidebar-overlay').classList.remove('open');
  }
  function wireSidebar() {
    var toggle = byId('sidebar-toggle');
    var closeButton = byId('sidebar-close');
    var overlay = byId('sidebar-overlay');
    if (toggle) { toggle.addEventListener('click', openSidebar); }
    if (closeButton) { closeButton.addEventListener('click', closeSidebar); }
    if (overlay) { overlay.addEventListener('click', closeSidebar); }
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { closeSidebar(); closeTaskPanel(); }
    });
  }

  // ---------- task panel drawer (narrow screens) ----------
  function openTaskPanel() { byId('task-panel').classList.add('open'); }
  function closeTaskPanel() { byId('task-panel').classList.remove('open'); }
  function wireTaskPanelToggle() {
    var toggle = byId('task-panel-toggle');
    if (toggle) { toggle.addEventListener('click', function () { byId('task-panel').classList.toggle('open'); }); }
  }

  // ---------- tabs ----------
  var TAB_VIEWS = { document: 'view-document', tasks: 'view-tasks', push: 'view-push', risks: 'view-risks' };
  function wireTabs() {
    all('#tab-bar .tab-button').forEach(function (button) {
      button.addEventListener('click', function () {
        all('#tab-bar .tab-button').forEach(function (other) { other.classList.remove('active'); });
        button.classList.add('active');
        Object.keys(TAB_VIEWS).forEach(function (tabName) {
          var viewElement = byId(TAB_VIEWS[tabName]);
          if (viewElement) { viewElement.style.display = tabName === button.dataset.tab ? '' : 'none'; }
        });
        if (button.dataset.tab === 'tasks') { renderTaskBoard(); }
        if (button.dataset.tab === 'push') { renderPushGateView(); }
        if (button.dataset.tab === 'risks') { renderRiskDashboard(); }
      });
    });
  }

  // ---------- escape helper ----------
  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ---------- task group model ----------
  function collectTaskGroups() {
    return all('.task-group').map(function (groupElement) {
      var groupKey = groupElement.dataset.releaseGroup || '';
      var groupStatus = groupElement.dataset.groupStatus || 'planned';
      var tasks = all('.task-item', groupElement).map(function (taskElement) {
        var checkbox = taskElement.querySelector('.task-done-checkbox');
        var titleElement = taskElement.querySelector('.task-title');
        return {
          id: taskElement.dataset.taskId || '',
          groupKey: groupKey,
          statusAttribute: taskElement.dataset.taskStatus || 'not-started',
          title: titleElement ? titleElement.textContent.trim() : '',
          checkbox: checkbox,
          element: taskElement,
          pushedVersion: taskElement.dataset.pushedVersion || '',
        };
      });
      return {
        key: groupKey,
        status: groupStatus,
        nameElement: groupElement.querySelector('.task-group-name'),
        chipElement: groupElement.querySelector('[data-group-status-chip]'),
        badgeElement: groupElement.querySelector('.task-group-badge'),
        progressElement: groupElement.querySelector('[data-group-progress]'),
        progressFillElement: groupElement.querySelector('[data-group-progress-fill]'),
        tasks: tasks,
        element: groupElement,
      };
    });
  }
  function taskIsDone(task) {
    return (task.checkbox && task.checkbox.checked) || task.statusAttribute === 'done';
  }
  function taskEffectiveStatus(task) {
    if (taskIsDone(task)) { return 'done'; }
    if (task.statusAttribute === 'ignored') { return 'ignored'; }
    if (task.statusAttribute === 'in-progress') { return 'in-progress'; }
    return 'not-started';
  }
  function collectRisks() {
    return all('.risk-item').map(function (riskElement) {
      var checkbox = riskElement.querySelector('.risk-solved-checkbox');
      return {
        id: riskElement.dataset.riskId || '',
        groupKey: riskElement.dataset.group || '',
        level: riskElement.dataset.riskLevel || 'medium',
        statusAttribute: riskElement.dataset.riskStatus || 'open',
        titleElement: riskElement.querySelector('.risk-title'),
        checkbox: checkbox,
        element: riskElement,
      };
    });
  }
  function riskIsOpen(risk) {
    var solved = risk.checkbox && risk.checkbox.checked;
    return !solved && risk.statusAttribute !== 'accepted' && risk.statusAttribute !== 'solved';
  }
  function collectIdeas() {
    return all('.idea-item').map(function (ideaElement) {
      var checkbox = ideaElement.querySelector('.idea-done-checkbox');
      return {
        id: ideaElement.dataset.ideaId || '',
        statusAttribute: ideaElement.dataset.ideaStatus || 'new',
        checkbox: checkbox,
        element: ideaElement,
      };
    });
  }
  function ideaIsDone(idea) { return Boolean(idea.checkbox && idea.checkbox.checked); }
  function ideaIsIgnored(idea) { return idea.statusAttribute === 'ignored' && !ideaIsDone(idea); }

  // ---------- chips ----------
  var TASK_CHIP_LABELS = {
    done: ['Done', 'chip-done'],
    'in-progress': ['In progress', 'chip-progress'],
    ignored: ['Ignored', 'chip-ignored'],
    'not-started': ['Not started', 'chip-not-started'],
  };
  var GROUP_CHIP_LABELS = {
    planned: ['Planned', 'chip-planned'],
    'in-progress': ['In progress', 'chip-in-progress'],
    testing: ['Testing', 'chip-testing'],
    pushed: ['Pushed', 'chip-pushed'],
  };
  var RISK_LEVEL_LABELS = {
    critical: ['Critical', 'chip-critical'],
    high: ['High', 'chip-high'],
    medium: ['Medium', 'chip-medium'],
    low: ['Low', 'chip-low'],
  };
  function setChip(element, text, cssClass) {
    if (!element) { return; }
    element.textContent = text;
    element.className = element.className.replace(/\bchip-[a-z-]+\b/g, '').replace(/\s+/g, ' ').trim() + ' ' + cssClass;
  }
  function refreshStatusChips(groups, risks, ideas) {
    groups.forEach(function (group) {
      group.tasks.forEach(function (task) {
        var chipInfo = TASK_CHIP_LABELS[taskEffectiveStatus(task)] || TASK_CHIP_LABELS['not-started'];
        setChip(task.element.querySelector('[data-task-status-chip]'), chipInfo[0], 'chip ' + chipInfo[1]);
      });
      var doneCount = group.tasks.filter(taskIsDone).length;
      var allDone = doneCount === group.tasks.length;
      var openRisksForGroup = risks.filter(function (risk) { return risk.groupKey === group.key && riskIsOpen(risk); });
      var ready = allDone && group.tasks.length > 0 && openRisksForGroup.length === 0;
      var groupChipInfo = ready && group.status !== 'pushed'
        ? ['Push ready', 'chip chip-ready']
        : (GROUP_CHIP_LABELS[group.status] || GROUP_CHIP_LABELS.planned);
      setChip(group.chipElement, groupChipInfo[0], groupChipInfo[1]);
    });
    risks.forEach(function (risk) {
      var chipElement = risk.element.querySelector('[data-risk-severity-chip]');
      var levelInfo = RISK_LEVEL_LABELS[risk.level] || RISK_LEVEL_LABELS.medium;
      setChip(chipElement, levelInfo[0], 'chip ' + levelInfo[1]);
      var statusElement = risk.element.querySelector('[data-risk-status-chip]');
      if (riskIsOpen(risk)) { setChip(statusElement, 'Open', 'chip chip-open'); }
      else if (risk.checkbox && risk.checkbox.checked) { setChip(statusElement, 'Solved', 'chip chip-solved'); }
      else { setChip(statusElement, 'Accepted', 'chip chip-accepted'); }
    });
    ideas.forEach(function (idea) {
      var chipElement = idea.element.querySelector('[data-idea-status-chip]');
      if (ideaIsDone(idea)) { setChip(chipElement, 'Done', 'chip chip-done'); }
      else if (ideaIsIgnored(idea)) { setChip(chipElement, 'Ignored', 'chip chip-ignored'); }
      else { setChip(chipElement, 'Discussing', 'chip chip-in-progress'); }
    });
  }

  // ---------- statistics ----------
  function percent(done, total) {
    if (!total) { return 0; }
    return Math.round((done / total) * 100);
  }
  function refreshStatistics(groups, risks, ideas) {
    var allTasks = [];
    groups.forEach(function (group) { allTasks = allTasks.concat(group.tasks); });
    var tasksDone = allTasks.filter(taskIsDone).length;
    var tasksActive = allTasks.filter(function (task) { return task.statusAttribute !== 'ignored'; }).length;
    var tasksIgnored = allTasks.length - tasksActive;

    var openRisks = risks.filter(riskIsOpen);
    var acceptedRisks = risks.filter(function (risk) {
      return !(risk.checkbox && risk.checkbox.checked) && risk.statusAttribute === 'accepted';
    });
    var solvedRisks = risks.filter(function (risk) { return risk.checkbox && risk.checkbox.checked; });
    var ideasDone = ideas.filter(ideaIsDone).length;
    var ideasIgnored = ideas.filter(ideaIsIgnored).length;

    setStat('task-stats-fill', percent(tasksDone, tasksActive));
    setLabel('task-stats-label', 'Tasks: ' + tasksDone + ' done (' + percent(tasksDone, tasksActive) + '%) - '
      + (tasksActive - tasksDone) + ' waiting (' + percent(tasksActive - tasksDone, tasksActive) + '%)'
      + (tasksIgnored ? ' - ' + tasksIgnored + ' ignored' : ''));

    setStat('idea-stats-fill', percent(ideasDone, ideas.length));
    setLabel('idea-stats-label', 'Ideas: ' + ideasDone + ' done (' + percent(ideasDone, ideas.length) + '%) - '
      + (ideas.length - ideasDone - ideasIgnored) + ' waiting (' + percent(ideas.length - ideasDone - ideasIgnored, ideas.length) + '%) - '
      + ideasIgnored + ' ignored');

    setStat('risk-stats-fill', percent(solvedRisks.length + acceptedRisks.length, risks.length));
    setLabel('risk-stats-label', 'Risks: ' + openRisks.length + ' open - ' + solvedRisks.length + ' solved - '
      + acceptedRisks.length + ' accepted (' + percent(solvedRisks.length + acceptedRisks.length, risks.length) + '% cleared)');

    setLabel('kpi-decisions', String(countDecisionRows()));
    setLabel('kpi-tasks', tasksDone + '/' + tasksActive);
    setLabel('kpi-tasks-pct', '(' + percent(tasksDone, tasksActive) + '%)');
    setLabel('kpi-ideas', ideasDone + '/' + ideas.length);
    setLabel('kpi-ideas-pct', '(' + percent(ideasDone, ideas.length) + '%)');
    setLabel('kpi-status', documentStatusText());

    var panelProgress = byId('task-panel-progress');
    if (panelProgress) { panelProgress.textContent = tasksDone + '/' + tasksActive; }
    var panelProgressFill = byId('task-panel-progress-fill');
    if (panelProgressFill) { panelProgressFill.style.width = percent(tasksDone, tasksActive) + '%'; }
    var riskCountElement = byId('task-panel-risk-count');
    if (riskCountElement) {
      riskCountElement.textContent = openRisks.length + ' open risk' + (openRisks.length === 1 ? '' : 's');
      riskCountElement.style.display = openRisks.length ? '' : 'none';
    }
    var sidebarProgress = byId('sidebar-progress');
    if (sidebarProgress) { sidebarProgress.textContent = tasksDone + '/' + tasksActive + ' tasks'; }
  }
  function setStat(id, widthPercent) {
    var element = byId(id);
    if (element) { element.style.width = widthPercent + '%'; }
  }
  function setLabel(id, text) {
    var element = byId(id);
    if (element) { element.textContent = text; }
  }
  function countDecisionRows() {
    return all('#view-document table tr td:first-child').filter(function (cell) {
      return /^D-[A-Z]+-\d+$/.test(cell.textContent.trim());
    }).length;
  }
  function documentStatusText() {
    var statusElement = document.querySelector('.doc-status');
    return statusElement ? statusElement.textContent.trim() : '-';
  }

  // ---------- task panel ----------
  var showAllGroupsMode = true;
  function groupHasOpenWork(group) {
    return group.tasks.some(function (task) { return !taskIsDone(task) && task.statusAttribute !== 'ignored'; });
  }
  function renderTaskPanel(groups) {
    var panelGroups = byId('task-panel-groups');
    if (!panelGroups) { return; }
    var html = '';
    groups.forEach(function (group) {
      if (!showAllGroupsMode && !groupHasOpenWork(group)) { return; }
      var doneCount = group.tasks.filter(taskIsDone).length;
      var openRisksForGroup = all('.risk-item').filter(function (riskElement) {
        return riskElement.dataset.group === group.key
          && riskElement.dataset.riskStatus !== 'accepted'
          && !riskElement.querySelector('.risk-solved-checkbox').checked;
      }).length;
      var ready = doneCount === group.tasks.length && group.tasks.length > 0 && openRisksForGroup === 0;
      var name = group.nameElement ? group.nameElement.textContent.trim() : group.key;
      html += '<div class="task-panel-group">';
      html += '<div class="task-panel-group-head">'
        + escapeHtml(name)
        + ' <span class="chip ' + (ready ? 'chip-ready' : 'chip-planned') + '">' + (ready ? 'push ready' : doneCount + '/' + group.tasks.length) + '</span>'
        + '</div>';
      group.tasks.forEach(function (task) {
        var done = taskIsDone(task);
        html += '<div class="task-panel-task' + (done ? ' done' : '') + '" data-jump-task="' + escapeHtml(task.id) + '">'
          + '<input type="checkbox" class="task-done-checkbox-panel" data-task-id="' + escapeHtml(task.id) + '"' + (done ? ' checked="checked"' : '') + ' />'
          + '<span class="task-panel-task-title">' + escapeHtml(task.id + ' - ' + task.title) + '</span>'
          + '</div>';
      });
      html += '</div>';
    });
    panelGroups.innerHTML = html;
    all('.task-done-checkbox-panel', panelGroups).forEach(function (checkbox) {
      checkbox.addEventListener('change', function () {
        var taskId = checkbox.dataset.taskId;
        var documentCheckbox = document.querySelector('.task-done-checkbox[data-task-id="' + taskId + '"]')
          || taskCheckboxById(taskId);
        if (documentCheckbox) { documentCheckbox.checked = checkbox.checked; }
        storageWrite(taskId, checkbox.checked ? 'done' : 'open');
        refreshEverything();
      });
    });
    all('[data-jump-task]', panelGroups).forEach(function (row) {
      row.addEventListener('click', function (event) {
        if (event.target.tagName === 'INPUT') { return; }
        jumpToTask(row.dataset.jumpTask);
      });
    });
    var showAllButton = byId('task-panel-show-all');
    if (showAllButton) {
      showAllButton.textContent = showAllGroupsMode ? 'Hide done groups' : 'Show all groups';
    }
  }
  function taskCheckboxById(taskId) {
    var item = document.querySelector('.task-item[data-task-id="' + taskId + '"]');
    return item ? item.querySelector('.task-done-checkbox') : null;
  }
  function jumpToTask(taskId) {
    var item = document.querySelector('.task-item[data-task-id="' + taskId + '"]');
    if (!item) { return; }
    var details = item.querySelector('details');
    if (details) { details.open = true; }
    item.scrollIntoView({ behavior: 'smooth', block: 'center' });
    item.style.outline = '2px solid var(--accent)';
    setTimeout(function () { item.style.outline = ''; }, 1600);
  }

  // ---------- task board view ----------
  function renderTaskBoard(groups) {
    var board = byId('task-board-view');
    if (!board) { return; }
    var html = '';
    groups.forEach(function (group) {
      var name = group.nameElement ? group.nameElement.textContent.trim() : group.key;
      var doneCount = group.tasks.filter(taskIsDone).length;
      html += '<section class="task-group" data-release-group="' + escapeHtml(group.key) + '">';
      html += '<header class="task-group-header"><span class="task-group-name">' + escapeHtml(name) + '</span>'
        + '<span class="task-group-progress">' + doneCount + '/' + group.tasks.length + '</span></header>';
      html += '<p class="task-group-note">' + escapeHtml(group.element.querySelector('.task-group-note')
        ? group.element.querySelector('.task-group-note').textContent : '') + '</p>';
      group.tasks.forEach(function (task) {
        var done = taskIsDone(task);
        var detailsHtml = '';
        var detailsElement = task.element.querySelector('.task-details');
        if (detailsElement) { detailsHtml = detailsElement.innerHTML; }
        html += '<div class="task-item" data-task-id="' + escapeHtml(task.id) + '">'
          + '<div style="display:flex;gap:8px;align-items:center;padding:6px 0;">'
          + '<span class="task-id">' + escapeHtml(task.id) + '</span>'
          + '<span class="task-title">' + escapeHtml(task.title) + '</span>'
          + '<span class="chip ' + (done ? 'chip-done' : 'chip-not-started') + '">' + (done ? 'Done' : 'Open') + '</span>'
          + (task.pushedVersion ? '<span class="chip chip-pushed">shipped in ' + escapeHtml(task.pushedVersion) + '</span>' : '')
          + '<input type="checkbox" class="task-done-checkbox-panel" data-task-id="' + escapeHtml(task.id) + '"'
          + (done ? ' checked="checked"' : '') + ' style="margin-left:auto;" />'
          + '</div>'
          + '<div class="task-details">' + detailsHtml + '</div>'
          + '</div>';
      });
      html += '</section>';
    });
    board.innerHTML = html;
    wirePanelCheckboxes();
  }
  function wirePanelCheckboxes() {
    all('.task-done-checkbox-panel').forEach(function (checkbox) {
      checkbox.addEventListener('change', function () {
        var documentCheckbox = taskCheckboxById(checkbox.dataset.taskId);
        if (documentCheckbox) { documentCheckbox.checked = checkbox.checked; }
        storageWrite(checkbox.dataset.taskId, checkbox.checked ? 'done' : 'open');
        refreshEverything();
      });
    });
  }

  // ---------- push gate view ----------
  function renderPushGateView(groups, risks) {
    var summary = byId('push-gate-summary');
    var cardsContainer = byId('push-group-cards');
    if (!cardsContainer) { return; }
    var openRisks = risks.filter(riskIsOpen);
    if (summary) {
      var levelCounts = {};
      openRisks.forEach(function (risk) {
        levelCounts[risk.level] = (levelCounts[risk.level] || 0) + 1;
      });
      var levelText = Object.keys(levelCounts).sort().map(function (level) {
        return level + ': ' + levelCounts[level];
      }).join(', ');
      summary.innerHTML = '<strong>Push gate.</strong> '
        + groups.length + ' release group(s), ' + openRisks.length + ' open risk(s)'
        + (levelText ? ' (' + levelText + ')' : '')
        + '. A group is PUSH READY when all tasks are done and it has no open risks.';
    }
    var html = '';
    groups.forEach(function (group) {
      var doneCount = group.tasks.filter(taskIsDone).length;
      var groupOpenRisks = openRisks.filter(function (risk) { return risk.groupKey === group.key; });
      var ready = doneCount === group.tasks.length && group.tasks.length > 0 && groupOpenRisks.length === 0;
      var name = group.nameElement ? group.nameElement.textContent.trim() : group.key;
      html += '<div class="push-group-card' + (ready ? ' ready' : '') + '">'
        + '<h3>' + escapeHtml(name) + '</h3>'
        + '<p><span class="chip ' + (ready ? 'chip-ready' : 'chip-planned') + '">' + (ready ? 'PUSH READY' : 'not ready') + '</span> '
        + '<span class="chip ' + (GROUP_CHIP_LABELS[group.status] || GROUP_CHIP_LABELS.planned)[1] + '">' + group.status + '</span></p>'
        + '<p>Tasks: ' + doneCount + '/' + group.tasks.length + ' done. Open risks: ' + groupOpenRisks.length + '.</p>'
        + (groupOpenRisks.length
          ? '<ul>' + groupOpenRisks.map(function (risk) {
            return '<li><strong>' + escapeHtml(risk.id) + '</strong> [' + risk.level + '] '
              + escapeHtml(risk.titleElement ? risk.titleElement.textContent.trim() : '') + '</li>';
          }).join('') + '</ul>'
          : '')
        + '</div>';
    });
    cardsContainer.innerHTML = html;
  }

  // ---------- risk dashboard view ----------
  function renderRiskDashboard(risks) {
    var dashboard = byId('risk-dashboard');
    if (!dashboard) { return; }
    if (risks.length === 0) {
      dashboard.innerHTML = '<p class="meta">No risks recorded in section 18 yet.</p>';
      return;
    }
    var html = '';
    ['critical', 'high', 'medium', 'low'].forEach(function (level) {
      var levelRisks = risks.filter(function (risk) { return risk.level === level; });
      if (!levelRisks.length) { return; }
      var levelInfo = RISK_LEVEL_LABELS[level];
      html += '<h3><span class="chip ' + levelInfo[1] + '">' + levelInfo[0] + '</span></h3>';
      levelRisks.forEach(function (risk) {
        var open = riskIsOpen(risk);
        var solved = risk.checkbox && risk.checkbox.checked;
        var title = risk.titleElement ? risk.titleElement.textContent.trim() : '';
        html += '<div class="risk-dashboard-row" data-jump-risk="' + escapeHtml(risk.id) + '">'
          + '<input type="checkbox" class="risk-solved-checkbox-panel" data-risk-id="' + escapeHtml(risk.id) + '"'
          + (solved ? ' checked="checked"' : '') + ' />'
          + '<strong>' + escapeHtml(risk.id) + '</strong>'
          + '<span>' + escapeHtml(title) + '</span>'
          + '<span class="chip ' + (open ? 'chip-open' : solved ? 'chip-solved' : 'chip-accepted') + '">'
          + (open ? 'open' : solved ? 'solved' : 'accepted') + '</span>'
          + '</div>';
      });
    });
    dashboard.innerHTML = html;
    all('.risk-solved-checkbox-panel', dashboard).forEach(function (checkbox) {
      checkbox.addEventListener('change', function () {
        var documentCheckbox = document.querySelector('.risk-item[data-risk-id="' + checkbox.dataset.riskId + '"] .risk-solved-checkbox');
        if (documentCheckbox) { documentCheckbox.checked = checkbox.checked; }
        storageWrite(checkbox.dataset.riskId, checkbox.checked ? 'solved' : 'open');
        refreshEverything();
      });
    });
    all('[data-jump-risk]', dashboard).forEach(function (row) {
      row.addEventListener('click', function (event) {
        if (event.target.tagName === 'INPUT') { return; }
        var riskItem = document.querySelector('.risk-item[data-risk-id="' + row.dataset.jumpRisk + '"]');
        if (riskItem) {
          var details = riskItem.querySelector('details');
          if (details) { details.open = true; }
          riskItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    });
  }

  // ---------- persistence + sync ----------
  function applyStoredCheckboxState(groups, risks, ideas) {
    groups.forEach(function (group) {
      group.tasks.forEach(function (task) {
        if (!task.checkbox) { return; }
        var stored = storageRead(task.id);
        if (stored === 'done') { task.checkbox.checked = true; }
        else if (stored === 'open') { task.checkbox.checked = false; }
        else if (task.statusAttribute === 'done') { task.checkbox.checked = true; }
      });
    });
    risks.forEach(function (risk) {
      if (!risk.checkbox) { return; }
      var stored = storageRead(risk.id);
      if (stored === 'solved') { risk.checkbox.checked = true; }
      else if (stored === 'open') { risk.checkbox.checked = false; }
    });
    ideas.forEach(function (idea) {
      if (!idea.checkbox) { return; }
      if (storageRead(idea.id) === 'done') { idea.checkbox.checked = true; }
    });
  }
  function wireCheckboxPersistence(groups, risks, ideas) {
    groups.forEach(function (group) {
      group.tasks.forEach(function (task) {
        if (!task.checkbox) { return; }
        task.checkbox.addEventListener('change', function () {
          storageWrite(task.id, task.checkbox.checked ? 'done' : 'open');
          refreshEverything();
        });
      });
    });
    risks.forEach(function (risk) {
      if (!risk.checkbox) { return; }
      risk.checkbox.addEventListener('change', function () {
        storageWrite(risk.id, risk.checkbox.checked ? 'solved' : 'open');
        refreshEverything();
      });
    });
    ideas.forEach(function (idea) {
      if (!idea.checkbox) { return; }
      idea.checkbox.addEventListener('change', function () {
        storageWrite(idea.id, idea.checkbox.checked ? 'done' : 'open');
        refreshEverything();
      });
    });
  }

  // ---------- group progress bars ----------
  function refreshGroupProgress(groups) {
    groups.forEach(function (group) {
      var doneCount = group.tasks.filter(taskIsDone).length;
      var total = group.tasks.length;
      if (group.progressElement) { group.progressElement.textContent = doneCount + '/' + total; }
      if (group.progressFillElement) {
        group.progressFillElement.style.width = (total ? Math.round((doneCount / total) * 100) : 0) + '%';
      }
    });
  }

  // ---------- master refresh ----------
  var masterGroups = [];
  var masterRisks = [];
  var masterIdeas = [];
  function refreshEverything() {
    refreshGroupProgress(masterGroups);
    refreshStatusChips(masterGroups, masterRisks, masterIdeas);
    renderTaskPanel(masterGroups);
    renderTaskBoard(masterGroups);
    renderPushGateView(masterGroups, masterRisks);
    renderRiskDashboard(masterRisks);
    refreshStatistics(masterGroups, masterRisks, masterIdeas);
  }

  // ---------- boot ----------
  function boot() {
    buildTableOfContents();
    wireSidebar();
    wireTabs();
    wireTaskPanelToggle();
    masterGroups = collectTaskGroups();
    masterRisks = collectRisks();
    masterIdeas = collectIdeas();
    applyStoredCheckboxState(masterGroups, masterRisks, masterIdeas);
    wireCheckboxPersistence(masterGroups, masterRisks, masterIdeas);
    var showAllButton = byId('task-panel-show-all');
    if (showAllButton) {
      showAllButton.addEventListener('click', function () {
        showAllGroupsMode = !showAllGroupsMode;
        renderTaskPanel(masterGroups);
      });
    }
    var riskCount = byId('task-panel-risk-count');
    if (riskCount) {
      riskCount.addEventListener('click', function () {
        var risksTab = document.querySelector('.tab-button[data-tab="risks"]');
        if (risksTab) { risksTab.click(); }
      });
    }
    refreshEverything();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
