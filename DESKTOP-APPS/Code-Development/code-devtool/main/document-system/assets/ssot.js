/* ────────────────────────────────────────────────────────────────────────────
   ssot.js - shared behavior for all SSOT working documents
   (_docs/deny/_feature-development-management/)

   Every feature document links this ONE file. Do NOT write per-document
   scripts - shared behavior lives here so all documents behave the same.

   Provides:
   - auto-generated table of contents in the left drawer (#sidebar-toc)
   - current-section highlight while scrolling
   - heading anchor ("#") on every h2/h3 with an id; click copies the link
   - drawer toggles (table of contents + task panel on narrow screens)
   - the ALWAYS-VISIBLE right task panel: built from section 14, with
     priority dots, group badges, progress counts, click-to-jump, and done
     checkboxes remembered per document in localStorage
   - at-a-glance summary cards (decisions, tasks, ideas, document status)
   - task statuses (not-started / in-progress / done / ignored) with a
     percentage statistics bar (section 14)
   - ideas backlog (section 15) with done checkboxes and done / waiting /
     ignored percentage statistics, remembered per document
   - risk and side-effect register (section 17): open / accepted / solved per
     release group, push-gate counters and PUSH READY badges in the task
     panel, remembered per document
   ──────────────────────────────────────────────────────────────────────────── */
(function () {
	'use strict'

	let taskStorageKey = 'ssot-tasks:'
	let ideaStorageKey = 'ssot-ideas:'
	let riskStorageKey = 'ssot-risks:'
	let activeTab = 'document'

	// ── Generic localStorage helpers ──
	function getDocumentFileName() {
		const pathParts = window.location.pathname.split('/')
		return pathParts[pathParts.length - 1] || 'document'
	}

	function loadStoredIds(storageKey) {
		try {
			const storedValue = localStorage.getItem(storageKey)
			return storedValue ? JSON.parse(storedValue) : []
		} catch (_e) {
			return []
		}
	}

	function saveStoredIds(storageKey, storedIds) {
		try {
			localStorage.setItem(storageKey, JSON.stringify(storedIds))
		} catch (_e) { /* storage unavailable - tracking works for this session only */ }
	}

	// ── Table of contents (auto-generated from h2/h3 with ids) ──
	function buildTableOfContents() {
		const tocContainer = document.getElementById('sidebar-toc')
		if (!tocContainer) return
		const headings = Array.from(document.querySelectorAll('h2[id], h3[id]'))
		if (headings.length === 0) return

		const topList = document.createElement('ol')
		let currentSectionItem = null
		let currentSectionList = null

		headings.forEach((heading) => {
			const listItem = document.createElement('li')
			const tocLink = document.createElement('a')
			tocLink.href = '#' + heading.id
			tocLink.textContent = heading.textContent.replace(/\s*#\s*$/, '').trim()
			listItem.appendChild(tocLink)

			if (heading.tagName === 'H2') {
				topList.appendChild(listItem)
				currentSectionItem = listItem
				currentSectionList = null
			} else if (heading.tagName === 'H3' && currentSectionItem) {
				if (!currentSectionList) {
					currentSectionList = document.createElement('ol')
					currentSectionItem.appendChild(currentSectionList)
				}
				currentSectionList.appendChild(listItem)
			}
		})

		tocContainer.appendChild(topList)
	}

	function highlightCurrentTocLink() {
		const tocLinks = document.querySelectorAll('#sidebar-toc a')
		const sectionHeadings = Array.from(document.querySelectorAll('h2[id], h3[id]'))
		if (tocLinks.length === 0 || sectionHeadings.length === 0) return

		const intersectionObserver = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				if (!entry.isIntersecting) return
				tocLinks.forEach((tocLink) => tocLink.classList.remove('active'))
				const matchingLink = document.querySelector('#sidebar-toc a[href="#' + entry.target.id + '"]')
				if (matchingLink) matchingLink.classList.add('active')
			})
		}, { rootMargin: '0px 0px -70% 0px' })

		sectionHeadings.forEach((heading) => intersectionObserver.observe(heading))
	}

	// ── Heading anchors ──
	function buildHeadingAnchor(headingElement) {
		const headingId = headingElement.id
		if (!headingId) return

		const anchorLink = document.createElement('a')
		anchorLink.className = 'heading-anchor'
		anchorLink.href = '#' + headingId
		anchorLink.textContent = '#'
		anchorLink.title = 'Copy link to this section'

		anchorLink.addEventListener('click', (clickEvent) => {
			clickEvent.preventDefault()
			const pageUrlWithoutHash = window.location.href.split('#')[0]
			const absoluteSectionLink = pageUrlWithoutHash + '#' + headingId
			navigator.clipboard.writeText(absoluteSectionLink).catch(() => {
				/* clipboard unavailable - the link still jumps to the section */
			})
			anchorLink.classList.add('copied')
			setTimeout(() => anchorLink.classList.remove('copied'), 900)
		})

		headingElement.appendChild(anchorLink)
	}

	// ── Drawers ──
	function saveTocOpenState() {
		try {
			localStorage.setItem('ssot-toc-open:' + getDocumentFileName(), document.body.classList.contains('toc-open') ? '1' : '0')
		} catch (_e) { /* storage unavailable */ }
	}

	function setTocOpen(isOpen) {
		document.body.classList.toggle('toc-open', isOpen)
		saveTocOpenState()
	}

	function wireDrawers() {
		const tocToggleButton = document.getElementById('sidebar-toggle')
		if (tocToggleButton) {
			tocToggleButton.addEventListener('click', () => setTocOpen(!document.body.classList.contains('toc-open')))
		}
		const tocCloseButton = document.getElementById('sidebar-close')
		if (tocCloseButton) {
			tocCloseButton.addEventListener('click', () => setTocOpen(false))
		}
		const taskToggleButton = document.getElementById('task-panel-toggle')
		if (taskToggleButton) {
			taskToggleButton.addEventListener('click', () => document.body.classList.toggle('tasks-open'))
		}

		const sidebarOverlay = document.getElementById('sidebar-overlay')
		if (sidebarOverlay) {
			sidebarOverlay.addEventListener('click', () => {
				document.body.classList.remove('tasks-open')
				setTocOpen(false)
			})
		}
		// The TOC stays open when a link is clicked - it is a docked panel.
		// Close it with the ✕ button or the Escape key.
		// Escape closes any open drawer
		document.addEventListener('keydown', (keyEvent) => {
			if (keyEvent.key === 'Escape') {
				document.body.classList.remove('tasks-open')
				setTocOpen(false)
			}
		})

		// restore the remembered open/closed state (per document)
		try {
			const storedTocOpen = localStorage.getItem('ssot-toc-open:' + getDocumentFileName())
			if (storedTocOpen === '1') document.body.classList.add('toc-open')
		} catch (_e) { /* storage unavailable */ }
	}

	// ── Task tracking (section 14 is the single source) ──
	const taskStatusInfo = {
		'not-started': { label: 'Not started', className: 'task-status-not-started' },
		'in-progress': { label: 'In progress', className: 'task-status-in-progress' },
		done: { label: 'Done', className: 'task-status-done' },
		ignored: { label: 'Ignored', className: 'task-status-ignored' },
	}

	const groupStatusInfo = {
		planned: { label: 'Planned', className: 'group-status-planned' },
		'in-progress': { label: 'In progress', className: 'group-status-in-progress' },
		testing: { label: 'Testing', className: 'group-status-testing' },
		pushed: { label: 'Pushed', className: 'group-status-pushed' },
	}

	function renderGroupStatusChips() {
		document.querySelectorAll('.task-group').forEach((groupElement) => {
			const statusChip = groupElement.querySelector('[data-group-status-chip]')
			if (!statusChip) return
			const status = groupElement.dataset.groupStatus || 'planned'
			const statusInfo = groupStatusInfo[status] || groupStatusInfo.planned
			statusChip.textContent = statusInfo.label
			statusChip.className = 'group-status-chip ' + statusInfo.className
		})
	}

	function getTaskEffectiveStatus(taskItem) {
		const taskCheckbox = taskItem.querySelector('.task-done-checkbox')
		if (taskCheckbox && taskCheckbox.checked) return 'done'
		return taskItem.dataset.taskStatus || 'not-started'
	}

	function renderTaskStatusChips() {
		document.querySelectorAll('.task-item').forEach((taskItem) => {
			const statusChip = taskItem.querySelector('[data-task-status-chip]')
			if (!statusChip) return
			const status = getTaskEffectiveStatus(taskItem)
			const statusInfo = taskStatusInfo[status] || taskStatusInfo['not-started']
			statusChip.textContent = statusInfo.label
			statusChip.className = 'task-status-chip ' + statusInfo.className
		})
	}

	function persistDoneTasks() {
		const currentDoneIds = Array.from(document.querySelectorAll('.task-done-checkbox'))
			.filter((checkbox) => checkbox.checked)
			.map((checkbox) => {
				const checkboxTaskItem = checkbox.closest('.task-item')
				return checkboxTaskItem ? checkboxTaskItem.dataset.taskId : ''
			})
			.filter(Boolean)
		saveStoredIds(taskStorageKey, currentDoneIds)
	}

	function updateTaskItemAppearance(taskCheckbox) {
		const taskItem = taskCheckbox.closest('.task-item')
		if (taskItem) taskItem.classList.toggle('task-done', taskCheckbox.checked)
	}

	function syncTaskFromCheckbox(taskCheckbox) {
		const taskItem = taskCheckbox.closest('.task-item')
		if (!taskItem) return
		taskItem.dataset.taskStatus = taskCheckbox.checked
			? 'done'
			: (taskItem.dataset.taskManualStatus || 'not-started')
		updateTaskItemAppearance(taskCheckbox)
		persistDoneTasks()
		updateAllProgress()
	}

	function toggleTaskCheckbox(taskCheckbox) {
		taskCheckbox.checked = !taskCheckbox.checked
		syncTaskFromCheckbox(taskCheckbox)
	}

	function updatePanelCheckboxes() {
		document.querySelectorAll('.panel-task').forEach((taskRow) => {
			const taskId = taskRow.dataset.panelTaskId
			const boardTask = document.querySelector('.task-item[data-task-id="' + taskId + '"]')
			const boardCheckbox = boardTask ? boardTask.querySelector('.task-done-checkbox') : null
			const panelCheckbox = taskRow.querySelector('.panel-task-checkbox')
			if (!panelCheckbox) return
			panelCheckbox.checked = boardCheckbox ? boardCheckbox.checked : false
			taskRow.classList.toggle('panel-task-done', panelCheckbox.checked)
		})
	}

	function updateGroupProgress() {
		document.querySelectorAll('.task-group').forEach((groupElement) => {
			const groupKey = groupElement.dataset.releaseGroup || ''
			const groupCheckboxes = Array.from(groupElement.querySelectorAll('.task-done-checkbox'))
			const doneCount = groupCheckboxes.filter((checkbox) => checkbox.checked).length

			const boardLabel = groupElement.querySelector('[data-group-progress]')
			const boardFill = groupElement.querySelector('[data-group-progress-fill]')
			if (boardLabel) boardLabel.textContent = doneCount + '/' + groupCheckboxes.length
			if (boardFill) {
				boardFill.style.width = groupCheckboxes.length > 0
					? Math.round((doneCount / groupCheckboxes.length) * 100) + '%'
					: '0%'
			}

			const panelLabel = document.querySelector('[data-panel-group-progress="' + groupKey + '"]')
			if (panelLabel) panelLabel.textContent = doneCount + '/' + groupCheckboxes.length
		})
	}

	function updateTaskStats() {
		const taskItems = Array.from(document.querySelectorAll('.task-item'))
		const totalCount = taskItems.length
		const doneCount = taskItems.filter((taskItem) => getTaskEffectiveStatus(taskItem) === 'done').length
		const ignoredCount = taskItems.filter((taskItem) => getTaskEffectiveStatus(taskItem) === 'ignored').length
		const activeCount = totalCount - ignoredCount
		const waitingCount = activeCount - doneCount
		const donePercent = activeCount > 0 ? Math.round((doneCount / activeCount) * 100) : 0
		const waitingPercent = activeCount > 0 ? Math.round((waitingCount / activeCount) * 100) : 0

		const statsLabel = document.getElementById('task-stats-label')
		if (statsLabel) {
			let labelText = 'Tasks: ' + doneCount + ' done (' + donePercent + '%) · ' + waitingCount + ' waiting (' + waitingPercent + '%)'
			if (ignoredCount > 0) labelText += ' · ' + ignoredCount + ' ignored'
			statsLabel.textContent = labelText
		}
		const statsFill = document.getElementById('task-stats-fill')
		if (statsFill) statsFill.style.width = donePercent + '%'

		const sidebarLabel = document.getElementById('sidebar-progress')
		if (sidebarLabel) {
			sidebarLabel.textContent = totalCount > 0
				? 'Tasks ' + doneCount + '/' + activeCount + ' (' + donePercent + '%)'
				: ''
		}

		const panelLabel = document.getElementById('task-panel-progress')
		const panelFill = document.getElementById('task-panel-progress-fill')
		if (panelLabel) panelLabel.textContent = doneCount + '/' + activeCount + ' · ' + donePercent + '%'
		if (panelFill) panelFill.style.width = donePercent + '%'

		const kpiTasks = document.getElementById('kpi-tasks')
		const kpiTasksPct = document.getElementById('kpi-tasks-pct')
		if (kpiTasks) kpiTasks.textContent = doneCount + '/' + activeCount
		if (kpiTasksPct) kpiTasksPct.textContent = '(' + donePercent + '% done)'
	}

	function updateAllProgress() {
		updateGroupProgress()
		updateTaskStats()
		updatePanelCheckboxes()
		renderTaskStatusChips()
		renderTaskPushChips()
		updateGroupPushReadiness()
		refreshDashboardViews()
	}

	function isTaskPermanentlyDone(taskItem, taskCheckbox) {
		// done written INTO the html file (checked attribute or
		// data-task-status="done") is permanent - it survives every browser
		// and is what npm run rel writes for pushed groups.
		return taskCheckbox.hasAttribute('checked') || taskItem.dataset.taskStatus === 'done'
	}

	function wireTaskTracking() {
		taskStorageKey = 'ssot-tasks:' + getDocumentFileName()
		const doneTaskIds = new Set(loadStoredIds(taskStorageKey))

		document.querySelectorAll('.task-item').forEach((taskItem) => {
			const taskCheckbox = taskItem.querySelector('.task-done-checkbox')
			if (!taskCheckbox) return
			const permanentlyDone = isTaskPermanentlyDone(taskItem, taskCheckbox)
			// when the file marks the task done, unticking in the browser
			// returns it to not-started (the file keeps its done state).
			taskItem.dataset.taskManualStatus = permanentlyDone ? 'not-started' : (taskItem.dataset.taskStatus || 'not-started')
			const taskId = taskItem.dataset.taskId || ''
			if (taskId && doneTaskIds.has(taskId)) {
				taskCheckbox.checked = true
				taskItem.dataset.taskStatus = 'done'
			}
			if (permanentlyDone) {
				taskCheckbox.checked = true
				taskItem.dataset.taskStatus = 'done'
			}
			updateTaskItemAppearance(taskCheckbox)

			// stopPropagation keeps the <summary> from toggling the details
			// open state when the user only wanted to tick the task; the
			// native checkbox toggle still runs and 'change' syncs the state.
			taskCheckbox.addEventListener('click', (clickEvent) => {
				clickEvent.stopPropagation()
			})
			taskCheckbox.addEventListener('change', () => {
				syncTaskFromCheckbox(taskCheckbox)
			})
		})

		updateAllProgress()
	}

	// ── Focus mode (collapse all but one group) ──
	function focusPanelGroup(panelGroup, groupElement) {
		document.querySelectorAll('.panel-group').forEach((otherPanelGroup) => {
			if (otherPanelGroup === panelGroup) otherPanelGroup.classList.remove('collapsed')
			else otherPanelGroup.classList.add('collapsed')
		})
		const showAllButton = document.getElementById('task-panel-show-all')
		if (showAllButton) showAllButton.style.display = ''
		groupElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
		groupElement.classList.remove('group-flash')
		void groupElement.offsetWidth /* restart the CSS animation */
		groupElement.classList.add('group-flash')
	}

	function wireShowAllGroupsButton() {
		const showAllButton = document.getElementById('task-panel-show-all')
		if (!showAllButton) return
		showAllButton.addEventListener('click', () => {
			document.querySelectorAll('.panel-group').forEach((panelGroup) => panelGroup.classList.remove('collapsed'))
			showAllButton.style.display = 'none'
		})
	}

	// ── Right task panel (built from section 14 - never write tasks twice) ──
	function flashTaskItem(taskItem) {
		taskItem.classList.remove('task-flash')
		void taskItem.offsetWidth /* restart the CSS animation */
		taskItem.classList.add('task-flash')
	}

	function buildTaskPanel() {
		const panelGroupsContainer = document.getElementById('task-panel-groups')
		if (!panelGroupsContainer) return

		document.querySelectorAll('.task-group').forEach((groupElement) => {
			const taskItems = Array.from(groupElement.querySelectorAll('.task-item'))
			if (taskItems.length === 0) return

			const groupKey = groupElement.dataset.releaseGroup || ''
			const groupNameElement = groupElement.querySelector('.task-group-name')
			const badgeElement = groupElement.querySelector('.task-group-badge')
			const groupName = groupNameElement ? groupNameElement.textContent.trim() : 'Group'

			const panelGroup = document.createElement('section')
			panelGroup.className = 'panel-group'
			panelGroup.dataset.panelGroup = groupKey

			const headerButton = document.createElement('button')
			headerButton.type = 'button'
			headerButton.className = 'panel-group-header'
			headerButton.title = 'Collapse / expand this group'

			const nameSpan = document.createElement('span')
			nameSpan.className = 'panel-group-name'
			nameSpan.textContent = groupName
			headerButton.appendChild(nameSpan)

			if (badgeElement && badgeElement.textContent.trim()) {
				const badgeSpan = document.createElement('span')
				badgeSpan.className = 'panel-group-badge'
				badgeSpan.textContent = badgeElement.textContent.trim()
				headerButton.appendChild(badgeSpan)
			}

			const progressSpan = document.createElement('span')
			progressSpan.className = 'panel-group-progress'
			progressSpan.dataset.panelGroupProgress = groupKey
			headerButton.appendChild(progressSpan)

			const riskBadge = document.createElement('span')
			riskBadge.className = 'panel-group-risk'
			riskBadge.dataset.riskGroupBadge = groupKey
			riskBadge.style.display = 'none'
			riskBadge.addEventListener('click', (clickEvent) => {
				clickEvent.stopPropagation()
				const riskSection = document.getElementById('sec-risks')
				if (riskSection) riskSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
			})
			headerButton.appendChild(riskBadge)

			const readyBadge = document.createElement('span')
			readyBadge.className = 'panel-group-ready'
			readyBadge.dataset.readyBadge = groupKey
			readyBadge.style.display = 'none'
			headerButton.appendChild(readyBadge)

			const focusButton = document.createElement('button')
			focusButton.type = 'button'
			focusButton.className = 'panel-group-focus'
			focusButton.textContent = 'Focus'
			focusButton.title = 'Focus this group - collapse the other groups'
			focusButton.addEventListener('click', (clickEvent) => {
				clickEvent.stopPropagation()
				focusPanelGroup(panelGroup, groupElement)
			})
			headerButton.appendChild(focusButton)

			headerButton.addEventListener('click', () => panelGroup.classList.toggle('collapsed'))
			panelGroup.appendChild(headerButton)

			const tasksContainer = document.createElement('div')
			tasksContainer.className = 'panel-group-tasks'

			taskItems.forEach((taskItem) => {
				const taskId = taskItem.dataset.taskId || ''
				const titleElement = taskItem.querySelector('.task-title')
				const priorityElement = taskItem.querySelector('.task-priority')
				const boardCheckbox = taskItem.querySelector('.task-done-checkbox')
				const taskTitle = titleElement ? titleElement.textContent.trim() : taskId
				const priorityClass = priorityElement
					? (priorityElement.className.match(/status-\w+/) || [''])[0]
					: ''

				const taskRow = document.createElement('button')
				taskRow.type = 'button'
				taskRow.className = 'panel-task'
				taskRow.dataset.panelTaskId = taskId
				taskRow.title = taskId + ': ' + taskTitle

				const panelCheckbox = document.createElement('input')
				panelCheckbox.type = 'checkbox'
				panelCheckbox.className = 'panel-task-checkbox'
				panelCheckbox.checked = boardCheckbox ? boardCheckbox.checked : false
				panelCheckbox.setAttribute('aria-label', 'Mark ' + taskId + ' as done')
				panelCheckbox.addEventListener('click', (clickEvent) => {
					clickEvent.stopPropagation()
					if (boardCheckbox) toggleTaskCheckbox(boardCheckbox)
				})
				taskRow.appendChild(panelCheckbox)

				const idSpan = document.createElement('span')
				idSpan.className = 'panel-task-id'
				idSpan.textContent = taskId
				taskRow.appendChild(idSpan)

				const titleSpan = document.createElement('span')
				titleSpan.className = 'panel-task-title'
				titleSpan.textContent = taskTitle
				taskRow.appendChild(titleSpan)

				const dotSpan = document.createElement('span')
				dotSpan.className = 'panel-task-dot ' + priorityClass
				taskRow.appendChild(dotSpan)

				taskRow.addEventListener('click', () => {
					const detailsElement = taskItem.querySelector('details')
					if (detailsElement) detailsElement.open = true
					taskItem.scrollIntoView({ behavior: 'smooth', block: 'center' })
					flashTaskItem(taskItem)
				})

				tasksContainer.appendChild(taskRow)
			})

			panelGroup.appendChild(tasksContainer)
			panelGroupsContainer.appendChild(panelGroup)
		})
	}

	// ── Ideas backlog (section 15) ──
	const ideaStatusInfo = {
		new: { label: 'New', className: 'idea-status-new' },
		discussing: { label: 'Discussing', className: 'idea-status-discussing' },
		done: { label: 'Done', className: 'idea-status-done' },
		ignored: { label: 'Ignored', className: 'idea-status-ignored' },
	}

	function getIdeaEffectiveStatus(ideaItem) {
		const ideaCheckbox = ideaItem.querySelector('.idea-done-checkbox')
		if (ideaCheckbox && ideaCheckbox.checked) return 'done'
		return ideaItem.dataset.ideaStatus || 'new'
	}

	function renderIdeaStatusChips() {
		document.querySelectorAll('.idea-item').forEach((ideaItem) => {
			const statusChip = ideaItem.querySelector('[data-idea-status-chip]')
			if (!statusChip) return
			const status = getIdeaEffectiveStatus(ideaItem)
			const statusInfo = ideaStatusInfo[status] || ideaStatusInfo.new
			statusChip.textContent = statusInfo.label
			statusChip.className = 'idea-status-chip ' + statusInfo.className
		})
	}

	function persistDoneIdeas() {
		const currentDoneIds = Array.from(document.querySelectorAll('.idea-done-checkbox'))
			.filter((checkbox) => checkbox.checked)
			.map((checkbox) => {
				const checkboxIdeaItem = checkbox.closest('.idea-item')
				return checkboxIdeaItem ? checkboxIdeaItem.dataset.ideaId : ''
			})
			.filter(Boolean)
		saveStoredIds(ideaStorageKey, currentDoneIds)
	}

	function syncIdeaFromCheckbox(ideaCheckbox) {
		const ideaItem = ideaCheckbox.closest('.idea-item')
		if (!ideaItem) return
		ideaItem.dataset.ideaStatus = ideaCheckbox.checked
			? 'done'
			: (ideaItem.dataset.ideaManualStatus || 'new')
		ideaItem.classList.toggle('idea-done', ideaCheckbox.checked)
		persistDoneIdeas()
		renderIdeaStatusChips()
		updateIdeaStats()
	}

	function toggleIdeaCheckbox(ideaCheckbox) {
		ideaCheckbox.checked = !ideaCheckbox.checked
		syncIdeaFromCheckbox(ideaCheckbox)
	}

	function updateIdeaStats() {
		const ideaItems = Array.from(document.querySelectorAll('.idea-item'))
		const totalCount = ideaItems.length
		const doneCount = ideaItems.filter((ideaItem) => getIdeaEffectiveStatus(ideaItem) === 'done').length
		const ignoredCount = ideaItems.filter((ideaItem) => getIdeaEffectiveStatus(ideaItem) === 'ignored').length
		const activeCount = totalCount - ignoredCount
		const waitingCount = activeCount - doneCount
		const donePercent = activeCount > 0 ? Math.round((doneCount / activeCount) * 100) : 0
		const waitingPercent = activeCount > 0 ? Math.round((waitingCount / activeCount) * 100) : 0

		const statsLabel = document.getElementById('idea-stats-label')
		if (statsLabel) {
			let labelText = 'Ideas: ' + doneCount + ' done (' + donePercent + '%) · ' + waitingCount + ' waiting (' + waitingPercent + '%)'
			if (ignoredCount > 0) labelText += ' · ' + ignoredCount + ' ignored'
			statsLabel.textContent = labelText
		}
		const statsFill = document.getElementById('idea-stats-fill')
		if (statsFill) statsFill.style.width = donePercent + '%'

		const kpiIdeas = document.getElementById('kpi-ideas')
		const kpiIdeasPct = document.getElementById('kpi-ideas-pct')
		if (kpiIdeas) kpiIdeas.textContent = doneCount + '/' + activeCount
		if (kpiIdeasPct) kpiIdeasPct.textContent = '(' + donePercent + '% done)'
	}

	function wireIdeas() {
		ideaStorageKey = 'ssot-ideas:' + getDocumentFileName()
		const doneIdeaIds = new Set(loadStoredIds(ideaStorageKey))

		document.querySelectorAll('.idea-item').forEach((ideaItem) => {
			const ideaCheckbox = ideaItem.querySelector('.idea-done-checkbox')
			if (!ideaCheckbox) return
			const permanentlyDone = ideaCheckbox.hasAttribute('checked') || ideaItem.dataset.ideaStatus === 'done'
			ideaItem.dataset.ideaManualStatus = permanentlyDone ? 'new' : (ideaItem.dataset.ideaStatus || 'new')
			const ideaId = ideaItem.dataset.ideaId || ''
			if (ideaId && doneIdeaIds.has(ideaId)) {
				ideaCheckbox.checked = true
				ideaItem.dataset.ideaStatus = 'done'
			}
			if (permanentlyDone) {
				ideaCheckbox.checked = true
				ideaItem.dataset.ideaStatus = 'done'
			}
			ideaItem.classList.toggle('idea-done', ideaCheckbox.checked)

			// stopPropagation keeps the <summary> from toggling the details
			// open state when the user only wanted to tick the idea; the
			// native checkbox toggle still runs and 'change' syncs the state.
			ideaCheckbox.addEventListener('click', (clickEvent) => {
				clickEvent.stopPropagation()
			})
			ideaCheckbox.addEventListener('change', () => {
				syncIdeaFromCheckbox(ideaCheckbox)
			})
		})

		renderIdeaStatusChips()
		updateIdeaStats()
	}

	// ── Risk and side-effect register (section 17 - the push gate) ──
	const riskLevelInfo = {
		critical: { label: 'Critical', className: 'risk-severity-critical' },
		high: { label: 'High', className: 'risk-severity-high' },
		medium: { label: 'Medium', className: 'risk-severity-medium' },
		low: { label: 'Low', className: 'risk-severity-low' },
	}

	function getRiskLevel(riskItem) {
		return riskItem.dataset.riskLevel || riskItem.dataset.riskSeverity || 'medium'
	}

	const riskStatusInfo = {
		open: { label: 'Open', className: 'risk-status-open' },
		accepted: { label: 'Accepted', className: 'risk-status-accepted' },
		solved: { label: 'Solved', className: 'risk-status-solved' },
	}

	function getRiskEffectiveStatus(riskItem) {
		const riskCheckbox = riskItem.querySelector('.risk-solved-checkbox')
		if (riskCheckbox && riskCheckbox.checked) return 'solved'
		return riskItem.dataset.riskStatus || 'open'
	}

	function renderRiskChips() {
		document.querySelectorAll('.risk-item').forEach((riskItem) => {
			const statusChip = riskItem.querySelector('[data-risk-status-chip]')
			if (statusChip) {
				const status = getRiskEffectiveStatus(riskItem)
				const statusInfo = riskStatusInfo[status] || riskStatusInfo.open
				statusChip.textContent = statusInfo.label
				statusChip.className = 'risk-status-chip ' + statusInfo.className
			}
			const severityChip = riskItem.querySelector('[data-risk-severity-chip]')
			if (severityChip) {
				const level = getRiskLevel(riskItem)
				const levelInfo = riskLevelInfo[level] || riskLevelInfo.medium
				severityChip.textContent = levelInfo.label
				severityChip.className = 'risk-severity-chip ' + levelInfo.className
			}
		})
	}

	function persistSolvedRisks() {
		const currentSolvedIds = Array.from(document.querySelectorAll('.risk-solved-checkbox'))
			.filter((checkbox) => checkbox.checked)
			.map((checkbox) => {
				const checkboxRiskItem = checkbox.closest('.risk-item')
				return checkboxRiskItem ? checkboxRiskItem.dataset.riskId : ''
			})
			.filter(Boolean)
		saveStoredIds(riskStorageKey, currentSolvedIds)
	}

	function syncRiskFromCheckbox(riskCheckbox) {
		const riskItem = riskCheckbox.closest('.risk-item')
		if (!riskItem) return
		riskItem.dataset.riskStatus = riskCheckbox.checked
			? 'solved'
			: (riskItem.dataset.riskManualStatus || 'open')
		riskItem.classList.toggle('risk-solved', riskCheckbox.checked)
		persistSolvedRisks()
		renderRiskChips()
		updateRiskStats()
		updateRiskPanel()
	}

	function toggleRiskCheckbox(riskCheckbox) {
		riskCheckbox.checked = !riskCheckbox.checked
		syncRiskFromCheckbox(riskCheckbox)
	}

	function updateRiskStats() {
		const riskItems = Array.from(document.querySelectorAll('.risk-item'))
		const totalCount = riskItems.length
		const openCount = riskItems.filter((riskItem) => getRiskEffectiveStatus(riskItem) === 'open').length
		const solvedCount = riskItems.filter((riskItem) => getRiskEffectiveStatus(riskItem) === 'solved').length
		const acceptedCount = riskItems.filter((riskItem) => getRiskEffectiveStatus(riskItem) === 'accepted').length
		const solvedPercent = totalCount > 0 ? Math.round((solvedCount / totalCount) * 100) : 0

		const statsLabel = document.getElementById('risk-stats-label')
		if (statsLabel) {
			statsLabel.textContent = 'Risks: ' + openCount + ' open · ' + solvedCount + ' solved · ' + acceptedCount + ' accepted (' + solvedPercent + '% solved)'
		}
		const statsFill = document.getElementById('risk-stats-fill')
		if (statsFill) statsFill.style.width = solvedPercent + '%'

		refreshDashboardViews()
	}

	function getOpenRiskCountForGroup(groupKey) {
		return Array.from(document.querySelectorAll('.risk-item[data-group="' + groupKey + '"]'))
			.filter((riskItem) => getRiskEffectiveStatus(riskItem) === 'open').length
	}

	function updateGroupPushReadiness() {
		document.querySelectorAll('.task-group').forEach((groupElement) => {
			const groupKey = groupElement.dataset.releaseGroup || ''
			const groupCheckboxes = Array.from(groupElement.querySelectorAll('.task-done-checkbox'))
			const doneCount = groupCheckboxes.filter((checkbox) => checkbox.checked).length
			const openRiskCount = getOpenRiskCountForGroup(groupKey)
			const isPushReady = groupCheckboxes.length > 0
				&& doneCount === groupCheckboxes.length
				&& openRiskCount === 0

			const readyBadge = document.querySelector('[data-ready-badge="' + groupKey + '"]')
			if (readyBadge) {
				if (isPushReady) {
					readyBadge.textContent = 'PUSH READY'
					readyBadge.style.display = ''
				} else {
					readyBadge.textContent = ''
					readyBadge.style.display = 'none'
				}
			}
		})
	}

	function updateRiskPanel() {
		let totalOpenRisks = 0
		document.querySelectorAll('.task-group').forEach((groupElement) => {
			const groupKey = groupElement.dataset.releaseGroup || ''
			const openGroupRisks = getOpenRiskCountForGroup(groupKey)
			totalOpenRisks += openGroupRisks

			const groupBadge = document.querySelector('[data-risk-group-badge="' + groupKey + '"]')
			if (groupBadge) {
				if (openGroupRisks > 0) {
					groupBadge.textContent = openGroupRisks + ' open risk' + (openGroupRisks === 1 ? '' : 's')
					groupBadge.style.display = ''
				} else {
					groupBadge.textContent = ''
					groupBadge.style.display = 'none'
				}
			}
		})

		// cross-cutting risks (no data-group) count toward the total too
		const crossCuttingOpen = Array.from(document.querySelectorAll('.risk-item:not([data-group])'))
			.filter((riskItem) => getRiskEffectiveStatus(riskItem) === 'open').length
		totalOpenRisks += crossCuttingOpen

		const panelRiskCount = document.getElementById('task-panel-risk-count')
		if (panelRiskCount) {
			if (totalOpenRisks > 0) {
				panelRiskCount.textContent = totalOpenRisks + ' open risk' + (totalOpenRisks === 1 ? '' : 's')
				panelRiskCount.style.display = ''
			} else {
				panelRiskCount.textContent = ''
				panelRiskCount.style.display = 'none'
			}
		}

		updateGroupPushReadiness()
	}

	function wireRisks() {
		riskStorageKey = 'ssot-risks:' + getDocumentFileName()
		const solvedRiskIds = new Set(loadStoredIds(riskStorageKey))

		document.querySelectorAll('.risk-item').forEach((riskItem) => {
			const riskCheckbox = riskItem.querySelector('.risk-solved-checkbox')
			if (!riskCheckbox) return
			const permanentlySolved = riskCheckbox.hasAttribute('checked') || riskItem.dataset.riskStatus === 'solved'
			riskItem.dataset.riskManualStatus = permanentlySolved ? 'open' : (riskItem.dataset.riskStatus || 'open')
			const riskId = riskItem.dataset.riskId || ''
			if (riskId && solvedRiskIds.has(riskId)) {
				riskCheckbox.checked = true
				riskItem.dataset.riskStatus = 'solved'
			}
			if (permanentlySolved) {
				riskCheckbox.checked = true
				riskItem.dataset.riskStatus = 'solved'
			}
			riskItem.classList.toggle('risk-solved', riskCheckbox.checked)

			// stopPropagation keeps the <summary> from toggling the details
			// open state when the user only wanted to tick the risk; the
			// native checkbox toggle still runs and 'change' syncs the state.
			riskCheckbox.addEventListener('click', (clickEvent) => {
				clickEvent.stopPropagation()
			})
			riskCheckbox.addEventListener('change', () => {
				syncRiskFromCheckbox(riskCheckbox)
			})
		})

		const panelRiskCount = document.getElementById('task-panel-risk-count')
		if (panelRiskCount) {
			panelRiskCount.addEventListener('click', () => {
				const riskSection = document.getElementById('sec-risks')
				if (riskSection) riskSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
			})
		}

		renderRiskChips()
		updateRiskStats()
		updateRiskPanel()
	}

	// ── At-a-glance summary cards ──
	function buildSummaryStaticKpis() {
		const decisionCells = document.querySelectorAll('#sec-decisions table td:first-child')
		const decisionCount = Array.from(decisionCells).filter((cell) => /^[A-Z]+-\d+$/.test(cell.textContent.trim())).length
		const decisionsKpi = document.getElementById('kpi-decisions')
		if (decisionsKpi) decisionsKpi.textContent = String(decisionCount)

		const statusBadge = document.querySelector('.doc-status')
		const statusKpi = document.getElementById('kpi-status')
		if (statusKpi && statusBadge) statusKpi.textContent = statusBadge.textContent.trim()
	}

	// ── Tabs and dashboards (Push / Risks views) ──
	function countOpenRisksByLevel() {
		const counts = { critical: 0, high: 0, medium: 0, low: 0, total: 0 }
		document.querySelectorAll('.risk-item').forEach((riskItem) => {
			if (getRiskEffectiveStatus(riskItem) !== 'open') return
			const level = getRiskLevel(riskItem)
			if (counts[level] !== undefined) counts[level]++
			counts.total++
		})
		return counts
	}

	function buildPushView() {
		const gateSummary = document.getElementById('push-gate-summary')
		const groupCards = document.getElementById('push-group-cards')
		if (!gateSummary || !groupCards) return
		gateSummary.innerHTML = ''
		groupCards.innerHTML = ''

		const openByLevel = countOpenRisksByLevel()
		const summaryBox = document.createElement('div')
		summaryBox.className = 'push-gate-summary-box'
		const summaryTitle = document.createElement('strong')
		summaryTitle.textContent = 'Gate report - open risks by level:'
		summaryBox.appendChild(summaryTitle)
		;['critical', 'high', 'medium', 'low'].forEach((level) => {
			const chip = document.createElement('span')
			chip.className = 'risk-level-chip risk-severity-' + level
			chip.textContent = level + ': ' + openByLevel[level]
			summaryBox.appendChild(chip)
		})
		const blocked = openByLevel.critical > 0 || openByLevel.high > 0
		const caution = !blocked && openByLevel.medium > 0
		const verdict = document.createElement('span')
		verdict.className = 'push-verdict ' + (blocked ? 'push-verdict-blocked' : (caution ? 'push-verdict-caution' : 'push-verdict-clear'))
		verdict.textContent = blocked ? 'BLOCKED - solve or accept critical/high risks' : (caution ? 'CAUTION - medium risks remain' : 'CLEAR - no blocking risks')
		summaryBox.appendChild(verdict)
		gateSummary.appendChild(summaryBox)

		document.querySelectorAll('.task-group').forEach((groupElement) => {
			const groupKey = groupElement.dataset.releaseGroup || ''
			const groupName = (groupElement.querySelector('.task-group-name')?.textContent || 'Group').trim()
			const groupStatus = groupElement.dataset.groupStatus || 'planned'
			const taskCheckboxes = Array.from(groupElement.querySelectorAll('.task-done-checkbox'))
			const doneTasks = taskCheckboxes.filter((checkbox) => checkbox.checked).length
			const groupOpen = { critical: 0, high: 0, medium: 0, low: 0 }
			document.querySelectorAll('.risk-item[data-group="' + groupKey + '"]').forEach((riskItem) => {
				if (getRiskEffectiveStatus(riskItem) !== 'open') return
				const level = getRiskLevel(riskItem)
				if (groupOpen[level] !== undefined) groupOpen[level]++
			})
			const openTotal = groupOpen.critical + groupOpen.high + groupOpen.medium + groupOpen.low
			const isPushReady = taskCheckboxes.length > 0 && doneTasks === taskCheckboxes.length && openTotal === 0

			const card = document.createElement('div')
			card.className = 'push-group-card'
			const header = document.createElement('div')
			header.className = 'push-group-card-header'
			const nameSpan = document.createElement('strong')
			nameSpan.textContent = groupName
			header.appendChild(nameSpan)
			const statusSpan = document.createElement('span')
			statusSpan.className = 'group-status-chip group-status-' + groupStatus
			statusSpan.textContent = groupStatus
			header.appendChild(statusSpan)
			const readySpan = document.createElement('span')
			readySpan.className = isPushReady ? 'push-verdict-clear' : (openTotal > 0 ? 'push-verdict-blocked' : 'push-verdict-caution')
			readySpan.textContent = isPushReady ? 'PUSH READY' : (openTotal > 0 ? 'BLOCKED' : 'TASKS PENDING')
			header.appendChild(readySpan)
			card.appendChild(header)
			const detail = document.createElement('div')
			detail.className = 'push-group-card-detail'
			detail.textContent = 'Tasks ' + doneTasks + '/' + taskCheckboxes.length + ' · Open risks: critical ' + groupOpen.critical + ', high ' + groupOpen.high + ', medium ' + groupOpen.medium + ', low ' + groupOpen.low
			card.appendChild(detail)
			groupCards.appendChild(card)
		})
	}

	function buildRiskView() {
		const dashboard = document.getElementById('risk-dashboard')
		if (!dashboard) return
		dashboard.innerHTML = ''

		const openItems = []
		const acceptedItems = []
		const solvedItems = []
		document.querySelectorAll('.risk-item').forEach((riskItem) => {
			const status = getRiskEffectiveStatus(riskItem)
			if (status === 'open') openItems.push(riskItem)
			else if (status === 'accepted') acceptedItems.push(riskItem)
			else solvedItems.push(riskItem)
		})

		const summaryBox = document.createElement('div')
		summaryBox.className = 'risk-dashboard-summary'
		const openByLevel = countOpenRisksByLevel()
		;['critical', 'high', 'medium', 'low'].forEach((level) => {
			const chip = document.createElement('span')
			chip.className = 'risk-level-chip risk-severity-' + level
			chip.textContent = level + ': ' + openByLevel[level]
			summaryBox.appendChild(chip)
		})
		const totals = document.createElement('span')
		totals.className = 'risk-dashboard-totals'
		totals.textContent = 'Open ' + openItems.length + ' · Accepted ' + acceptedItems.length + ' · Solved ' + solvedItems.length
		summaryBox.appendChild(totals)
		dashboard.appendChild(summaryBox)

		const openHeading = document.createElement('h3')
		openHeading.textContent = 'Open risks'
		dashboard.appendChild(openHeading)
		if (openItems.length === 0) {
			const emptyNote = document.createElement('p')
			emptyNote.textContent = 'No open risks - the gate is clear.'
			dashboard.appendChild(emptyNote)
		}
		openItems.forEach((riskItem) => {
			const row = document.createElement('div')
			row.className = 'risk-dashboard-row'
			const level = getRiskLevel(riskItem)
			const levelChip = document.createElement('span')
			levelChip.className = 'risk-severity-chip risk-severity-' + level
			levelChip.textContent = level
			row.appendChild(levelChip)
			const idSpan = document.createElement('span')
			idSpan.className = 'risk-dashboard-id'
			idSpan.textContent = riskItem.dataset.riskId || ''
			row.appendChild(idSpan)
			const titleSpan = document.createElement('span')
			titleSpan.className = 'risk-dashboard-title'
			titleSpan.textContent = (riskItem.querySelector('.risk-title')?.textContent || '').trim()
			row.appendChild(titleSpan)
			const groupSpan = document.createElement('span')
			groupSpan.className = 'risk-dashboard-group'
			groupSpan.textContent = riskItem.dataset.group || 'cross-cutting'
			row.appendChild(groupSpan)
			const solveCheckbox = document.createElement('input')
			solveCheckbox.type = 'checkbox'
			solveCheckbox.className = 'risk-solved-checkbox'
			solveCheckbox.checked = false
			solveCheckbox.setAttribute('aria-label', 'Mark ' + (riskItem.dataset.riskId || '') + ' as solved')
			solveCheckbox.addEventListener('click', (clickEvent) => {
				clickEvent.stopPropagation()
				const boardCheckbox = riskItem.querySelector('.risk-solved-checkbox')
				if (boardCheckbox) toggleRiskCheckbox(boardCheckbox)
			})
			row.appendChild(solveCheckbox)
			dashboard.appendChild(row)
		})
	}

	function renderTaskPushChips() {
		document.querySelectorAll('.task-item').forEach((taskItem) => {
			const summary = taskItem.querySelector('summary')
			if (!summary) return
			let pushChip = taskItem.querySelector('.task-push-chip')
			const pushedVersion = taskItem.dataset.pushedVersion
			if (!pushedVersion) {
				if (pushChip) pushChip.remove()
				return
			}
			if (!pushChip) {
				pushChip = document.createElement('span')
				pushChip.className = 'task-push-chip'
				const priorityChip = taskItem.querySelector('.task-priority')
				if (priorityChip) summary.insertBefore(pushChip, priorityChip)
				else summary.appendChild(pushChip)
			}
			pushChip.textContent = 'v' + pushedVersion
			pushChip.title = 'Pushed in v' + pushedVersion
				+ (taskItem.dataset.pushedCommit ? ' (commit ' + taskItem.dataset.pushedCommit + ')' : '')
				+ (taskItem.dataset.pushedAt ? ' at ' + taskItem.dataset.pushedAt : '')
		})
	}

	function buildTasksView() {
		const container = document.getElementById('task-board-view')
		if (!container) return
		container.innerHTML = ''

		const controls = document.createElement('div')
		controls.className = 'task-view-controls'
		const expandAllButton = document.createElement('button')
		expandAllButton.type = 'button'
		expandAllButton.className = 'task-view-control'
		expandAllButton.textContent = 'Expand all'
		expandAllButton.addEventListener('click', () => {
			container.querySelectorAll('.task-view-item').forEach((detailsElement) => { detailsElement.open = true })
		})
		const collapseAllButton = document.createElement('button')
		collapseAllButton.type = 'button'
		collapseAllButton.className = 'task-view-control'
		collapseAllButton.textContent = 'Collapse all'
		collapseAllButton.addEventListener('click', () => {
			container.querySelectorAll('.task-view-item').forEach((detailsElement) => { detailsElement.open = false })
		})
		controls.appendChild(expandAllButton)
		controls.appendChild(collapseAllButton)
		container.appendChild(controls)

		document.querySelectorAll('.task-group').forEach((groupElement) => {
			const groupName = (groupElement.querySelector('.task-group-name')?.textContent || 'Group').trim()
			const badgeText = (groupElement.querySelector('.task-group-badge')?.textContent || '').trim()
			const groupNote = (groupElement.querySelector('.task-group-note')?.textContent || '').trim()
			const groupStatus = groupElement.dataset.groupStatus || 'planned'
			const taskItems = Array.from(groupElement.querySelectorAll('.task-item'))
			const doneCount = taskItems.filter((taskItem) => getTaskEffectiveStatus(taskItem) === 'done').length

			const groupCard = document.createElement('section')
			groupCard.className = 'task-group-view'

			const header = document.createElement('header')
			header.className = 'task-view-group-header'
			const nameSpan = document.createElement('span')
			nameSpan.className = 'task-view-group-name'
			nameSpan.textContent = groupName
			header.appendChild(nameSpan)
			const statusSpan = document.createElement('span')
			statusSpan.className = 'group-status-chip group-status-' + groupStatus
			statusSpan.textContent = groupStatus
			header.appendChild(statusSpan)
			if (badgeText) {
				const badgeSpan = document.createElement('span')
				badgeSpan.className = 'task-view-group-badge'
				badgeSpan.textContent = badgeText
				header.appendChild(badgeSpan)
			}
			const progressSpan = document.createElement('span')
			progressSpan.className = 'task-view-group-progress'
			progressSpan.textContent = doneCount + '/' + taskItems.length
			header.appendChild(progressSpan)
			groupCard.appendChild(header)

			if (groupNote) {
				const noteParagraph = document.createElement('p')
				noteParagraph.className = 'task-view-group-note'
				noteParagraph.textContent = groupNote
				groupCard.appendChild(noteParagraph)
			}

			taskItems.forEach((taskItem) => {
				const taskId = taskItem.dataset.taskId || ''
				const taskTitle = (taskItem.querySelector('.task-title')?.textContent || '').trim()
				const boardCheckbox = taskItem.querySelector('.task-done-checkbox')
				const boardDetails = taskItem.querySelector('.task-details')
				const priorityChip = taskItem.querySelector('.task-priority')
				const priorityClass = priorityChip ? (priorityChip.className.match(/status-\w+/) || [''])[0] : ''
				const priorityLabel = priorityChip ? priorityChip.textContent.trim() : ''
				const status = getTaskEffectiveStatus(taskItem)
				const statusInfo = taskStatusInfo[status] || taskStatusInfo['not-started']

				const detailsElement = document.createElement('details')
				detailsElement.className = 'task-view-item'
				const summary = document.createElement('summary')
				const idSpan = document.createElement('span')
				idSpan.className = 'task-id'
				idSpan.textContent = taskId
				summary.appendChild(idSpan)
				const titleSpan = document.createElement('span')
				titleSpan.className = 'task-view-title'
				titleSpan.textContent = taskTitle
				summary.appendChild(titleSpan)
				const statusChipSpan = document.createElement('span')
				statusChipSpan.className = 'task-status-chip ' + statusInfo.className
				statusChipSpan.textContent = statusInfo.label
				summary.appendChild(statusChipSpan)
				if (taskItem.dataset.pushedVersion) {
					const pushChip = document.createElement('span')
					pushChip.className = 'task-push-chip'
					pushChip.textContent = 'v' + taskItem.dataset.pushedVersion
					pushChip.title = 'Pushed in v' + taskItem.dataset.pushedVersion
					summary.appendChild(pushChip)
				}
				if (priorityLabel) {
					const prioritySpan = document.createElement('span')
					prioritySpan.className = 'task-priority ' + priorityClass
					prioritySpan.textContent = priorityLabel
					summary.appendChild(prioritySpan)
				}
				const viewCheckbox = document.createElement('input')
				viewCheckbox.type = 'checkbox'
				viewCheckbox.className = 'task-view-checkbox'
				viewCheckbox.checked = boardCheckbox ? boardCheckbox.checked : false
				viewCheckbox.setAttribute('aria-label', 'Mark ' + taskId + ' as done')
				viewCheckbox.addEventListener('click', (clickEvent) => {
					clickEvent.stopPropagation()
				})
				viewCheckbox.addEventListener('change', () => {
					if (boardCheckbox) toggleTaskCheckbox(boardCheckbox)
				})
				summary.appendChild(viewCheckbox)
				detailsElement.appendChild(summary)

				const detailsBody = document.createElement('div')
				detailsBody.className = 'task-view-details'
				if (boardDetails) detailsBody.innerHTML = boardDetails.innerHTML
				detailsElement.appendChild(detailsBody)
				groupCard.appendChild(detailsElement)
			})

			container.appendChild(groupCard)
		})
	}

	function refreshDashboardViews() {
		if (activeTab === 'tasks') buildTasksView()
		if (activeTab === 'push') buildPushView()
		if (activeTab === 'risks') buildRiskView()
	}

	function wireTabs() {
		const tabButtons = document.querySelectorAll('.tab-button')
		const views = {
			document: document.getElementById('view-document'),
			tasks: document.getElementById('view-tasks'),
			push: document.getElementById('view-push'),
			risks: document.getElementById('view-risks'),
		}
		if (tabButtons.length === 0) return

		try {
			const savedTab = localStorage.getItem('ssot-tab:' + getDocumentFileName())
			if (savedTab && views[savedTab]) activeTab = savedTab
		} catch (_e) { /* storage unavailable */ }

		const showTab = (tabName) => {
			activeTab = tabName
			Object.keys(views).forEach((viewName) => {
				if (views[viewName]) views[viewName].style.display = viewName === tabName ? '' : 'none'
			})
			tabButtons.forEach((tabButton) => {
				tabButton.classList.toggle('active', tabButton.dataset.tab === tabName)
			})
			try { localStorage.setItem('ssot-tab:' + getDocumentFileName(), tabName) } catch (_e) { /* storage unavailable */ }
			refreshDashboardViews()
		}

		tabButtons.forEach((tabButton) => {
			tabButton.addEventListener('click', () => showTab(tabButton.dataset.tab))
		})
		showTab(activeTab)
	}

	// ── Workflow diagram (only documents that include it) ──
	function wireWorkflowDiagram() {
		const infoBox = document.getElementById('workflow-info')
		const workflowNodes = document.querySelectorAll('.workflow-node')
		if (workflowNodes.length === 0) return
		const workflowArrows = document.querySelectorAll('.workflow-arrow')

		const setNodeHighlight = (workflowNode, isHighlighted) => {
			workflowNode.classList.toggle('active', isHighlighted)
			const nodeId = workflowNode.id || ''
			workflowArrows.forEach((workflowArrow) => {
				const arrowBelongsToNode = workflowArrow.dataset.wfFrom === nodeId || workflowArrow.dataset.wfTo === nodeId
				if (!arrowBelongsToNode) return
				workflowArrow.classList.toggle('active', isHighlighted)
				workflowArrow.setAttribute('marker-end', isHighlighted
					? 'url(#workflow-arrowhead-active)'
					: 'url(#workflow-arrowhead)')
			})
			if (infoBox && isHighlighted) infoBox.textContent = workflowNode.dataset.wfInfo || ''
		}

		workflowNodes.forEach((workflowNode) => {
			workflowNode.addEventListener('mouseenter', () => setNodeHighlight(workflowNode, true))
			workflowNode.addEventListener('mouseleave', () => setNodeHighlight(workflowNode, false))
			workflowNode.addEventListener('focus', () => setNodeHighlight(workflowNode, true))
			workflowNode.addEventListener('blur', () => setNodeHighlight(workflowNode, false))
		})
	}

	// ── Init ──
	buildTableOfContents()
	highlightCurrentTocLink()
	document.querySelectorAll('h2[id], h3[id]').forEach(buildHeadingAnchor)
	wireDrawers()
	wireTabs()
	buildTaskPanel()
	buildSummaryStaticKpis()
	renderGroupStatusChips()
	wireWorkflowDiagram()
	wireShowAllGroupsButton()
	wireTaskTracking()
	wireIdeas()
	wireRisks()
})()
