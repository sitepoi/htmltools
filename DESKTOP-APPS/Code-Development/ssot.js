/* ────────────────────────────────────────────────────────────────────────────
   ssot.js - shared behavior for all SSOT working documents
   (_docs/deny/_ssot-of-features/)

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
		// closing the TOC drawer after jumping to a section
		document.querySelectorAll('#sidebar-toc a').forEach((tocLink) => {
			tocLink.addEventListener('click', () => setTocOpen(false))
		})
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

	function toggleTaskCheckbox(taskCheckbox) {
		taskCheckbox.checked = !taskCheckbox.checked
		const taskItem = taskCheckbox.closest('.task-item')
		if (taskItem) {
			taskItem.dataset.taskStatus = taskCheckbox.checked
				? 'done'
				: (taskItem.dataset.taskManualStatus || 'not-started')
		}
		updateTaskItemAppearance(taskCheckbox)
		persistDoneTasks()
		updateAllProgress()
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
		updateGroupPushReadiness()
	}

	function wireTaskTracking() {
		taskStorageKey = 'ssot-tasks:' + getDocumentFileName()
		const doneTaskIds = new Set(loadStoredIds(taskStorageKey))

		document.querySelectorAll('.task-item').forEach((taskItem) => {
			taskItem.dataset.taskManualStatus = taskItem.dataset.taskStatus || 'not-started'
			const taskCheckbox = taskItem.querySelector('.task-done-checkbox')
			if (!taskCheckbox) return
			const taskId = taskItem.dataset.taskId || ''
			if (taskId && doneTaskIds.has(taskId)) {
				taskCheckbox.checked = true
				taskItem.dataset.taskStatus = 'done'
			}
			updateTaskItemAppearance(taskCheckbox)

			taskCheckbox.addEventListener('click', (clickEvent) => {
				// preventDefault stops the <summary> from toggling the details
				// open state when the user only wanted to tick the task.
				clickEvent.preventDefault()
				toggleTaskCheckbox(taskCheckbox)
			})
		})

		updateAllProgress()
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

	function toggleIdeaCheckbox(ideaCheckbox) {
		ideaCheckbox.checked = !ideaCheckbox.checked
		const ideaItem = ideaCheckbox.closest('.idea-item')
		if (ideaItem) {
			ideaItem.dataset.ideaStatus = ideaCheckbox.checked
				? 'done'
				: (ideaItem.dataset.ideaManualStatus || 'new')
			ideaItem.classList.toggle('idea-done', ideaCheckbox.checked)
		}
		persistDoneIdeas()
		renderIdeaStatusChips()
		updateIdeaStats()
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
			ideaItem.dataset.ideaManualStatus = ideaItem.dataset.ideaStatus || 'new'
			const ideaCheckbox = ideaItem.querySelector('.idea-done-checkbox')
			if (!ideaCheckbox) return
			const ideaId = ideaItem.dataset.ideaId || ''
			if (ideaId && doneIdeaIds.has(ideaId)) {
				ideaCheckbox.checked = true
				ideaItem.dataset.ideaStatus = 'done'
			}
			ideaItem.classList.toggle('idea-done', ideaCheckbox.checked)

			ideaCheckbox.addEventListener('click', (clickEvent) => {
				// preventDefault stops the <summary> from toggling the details
				// open state when the user only wanted to tick the idea.
				clickEvent.preventDefault()
				toggleIdeaCheckbox(ideaCheckbox)
			})
		})

		renderIdeaStatusChips()
		updateIdeaStats()
	}

	// ── Risk and side-effect register (section 17 - the push gate) ──
	const riskSeverityInfo = {
		high: { label: 'High', className: 'risk-severity-high' },
		medium: { label: 'Medium', className: 'risk-severity-medium' },
		low: { label: 'Low', className: 'risk-severity-low' },
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
				const severity = riskItem.dataset.riskSeverity || 'medium'
				const severityInfo = riskSeverityInfo[severity] || riskSeverityInfo.medium
				severityChip.textContent = severityInfo.label
				severityChip.className = 'risk-severity-chip ' + severityInfo.className
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

	function toggleRiskCheckbox(riskCheckbox) {
		riskCheckbox.checked = !riskCheckbox.checked
		const riskItem = riskCheckbox.closest('.risk-item')
		if (riskItem) {
			riskItem.dataset.riskStatus = riskCheckbox.checked
				? 'solved'
				: (riskItem.dataset.riskManualStatus || 'open')
			riskItem.classList.toggle('risk-solved', riskCheckbox.checked)
		}
		persistSolvedRisks()
		renderRiskChips()
		updateRiskStats()
		updateRiskPanel()
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
			riskItem.dataset.riskManualStatus = riskItem.dataset.riskStatus || 'open'
			const riskCheckbox = riskItem.querySelector('.risk-solved-checkbox')
			if (!riskCheckbox) return
			const riskId = riskItem.dataset.riskId || ''
			if (riskId && solvedRiskIds.has(riskId)) {
				riskCheckbox.checked = true
				riskItem.dataset.riskStatus = 'solved'
			}
			riskItem.classList.toggle('risk-solved', riskCheckbox.checked)

			riskCheckbox.addEventListener('click', (clickEvent) => {
				// preventDefault stops the <summary> from toggling the details
				// open state when the user only wanted to tick the risk.
				clickEvent.preventDefault()
				toggleRiskCheckbox(riskCheckbox)
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

	// ── Init ──
	buildTableOfContents()
	highlightCurrentTocLink()
	document.querySelectorAll('h2[id], h3[id]').forEach(buildHeadingAnchor)
	wireDrawers()
	buildTaskPanel()
	buildSummaryStaticKpis()
	wireTaskTracking()
	wireIdeas()
	wireRisks()
})()
