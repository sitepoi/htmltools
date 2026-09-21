/* ── Attendance Checker ──
   Comprehensive attendance tracking with calendar, series events,
   and detailed person-level reporting.
   Built for UniconHub CMS HTML-tool system.
────────────────────────────────────────── */
(function () {
	"use strict";

	/* ── SDK handle + fallback shim ── */
	var tool = (typeof window !== "undefined" && window.tool) ? window.tool : null;
	if (!tool) {
		var _v = null;
		tool = {
			onReady: function (cb) { cb(_v, {}); }, getValue: function () { return _v; }, setValue: function (v) { _v = v; },
			onValueChange: function () { }, getFields: function () { return {}; }, watchField: function () { }, setField: function () { }, setFields: function () { }, onFieldsChange: function () { },
			param: function (n, d) { return d; }, isReadOnly: function () { return false; }, onReadonlyChange: function () { }, getUser: function () { return null; }, onUserChange: function () { },
			reportValid: function () { }, notify: function (m) { try { console.log("notify:", m); } catch (e) { } }, resize: function () { }, declareOutput: function () { }, declareParams: function () { }
		};
	}

	/* ── Helpers ── */
	function $(s, r) { return (r || document).querySelector(s); }
	function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
	function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
	function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
	function parseDate(iso) { if (!iso) return null; var p = iso.split("-").map(Number); return new Date(p[0], (p[1] || 1) - 1, p[2] || 1); }
	function fmtDate(iso) { var d = parseDate(iso); if (!d || isNaN(d)) return "—"; return d.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" }); }
	function fmtDateShort(iso) { var d = parseDate(iso); if (!d || isNaN(d)) return "—"; return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
	function fmtTime(t) { if (!t) return ""; var p = t.split(":"); var h = parseInt(p[0], 10), m = p[1]; var ampm = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return h + ":" + m + " " + ampm; }
	function todayISO() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
	function initials(n) { var p = (n || "").trim().split(/\s+/).filter(Boolean); if (!p.length) return "?"; return ((p[0][0] || "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase(); }
	function notify(msg, sev) { try { tool.notify(msg, sev || "success"); } catch (e) { } }
	function resize() { try { tool.resize(); } catch (e) { } }

	/* ── State ── */
	var DB = {
		people: [],
		events: [],
		attendance: {},
		_theme: "light"
	};

	var currentPage = "people";
	var calendarDate = new Date();
	var calendarView = "month";
	var isReadOnly = false;
	var currentEventId = null; // for drawer
	var currentSeriesId = null;

	var EVENT_COLORS = [
		"#2563eb", "#16a34a", "#dc2626", "#d97706", "#7c3aed",
		"#0ea5e9", "#ea580c", "#0891b2", "#be185d", "#4f46e5"
	];

	/* ── Persistence ── */
	function persist() {
		try { tool.setValue(DB); } catch (e) { }
		updateNavBadges();
		tool.reportValid(true, "");
		resize();
	}

	function updateNavBadges() {
		var pc = $("#nav-people-count"); if (pc) pc.textContent = DB.people.length;
		var ec = $("#nav-events-count"); if (ec) ec.textContent = DB.events.length;
		var cc = $("#nav-calendar-count"); if (cc) cc.textContent = DB.events.filter(function (e) { return e.date === todayISO(); }).length;
	}

	/* ── Theme ── */
	function applyTheme(t) {
		DB._theme = t;
		document.documentElement.setAttribute("data-theme", t);
		var icon = $("#theme-icon"); if (icon) icon.textContent = t === "dark" ? "☀️" : "🌙";
	}
	function toggleTheme() {
		applyTheme(DB._theme === "dark" ? "light" : "dark");
		persist();
	}

	/* ── Navigation ── */
	function navigate(page) {
		currentPage = page;
		$$(".section").forEach(function (s) { s.classList.remove("active"); });
		$$(".nav-item").forEach(function (n) { n.classList.remove("active"); });
		var sec = $("#sec-" + page); if (sec) sec.classList.add("active");
		$$(".nav-item").forEach(function (n) { if (n.dataset.page === page) n.classList.add("active"); });
		renderCurrentPage();
		resize();
	}

	function renderCurrentPage() {
		if (currentPage === "people") renderPeople();
		else if (currentPage === "events") renderEvents();
		else if (currentPage === "calendar") renderCalendar();
		else if (currentPage === "reports") renderReports();
	}

	/* ═══════════════════════════════════════════
	   PEOPLE
	   ═══════════════════════════════════════════ */
	function renderPeople() {
		var q = ($("#people-search") ? $("#people-search").value : "").toLowerCase();
		var list = DB.people.slice();
		if (q) list = list.filter(function (p) { return p.name.toLowerCase().indexOf(q) > -1 || (p.email && p.email.toLowerCase().indexOf(q) > -1) || (p.group && p.group.toLowerCase().indexOf(q) > -1); });
		var grid = $("#people-grid");
		if (!DB.people.length) {
			grid.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><h3>No people added yet</h3><p>Add the individuals whose attendance you want to track across events and activities.</p><button class="btn btn-primary" id="btn-add-person-empty">+ Add First Person</button></div>';
			var b = $("#btn-add-person-empty"); if (b) b.onclick = openPersonModal;
			return;
		}
		if (!list.length) {
			grid.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><h3>No matches</h3><p>No people match "' + esc(q) + '".</p></div>';
			return;
		}
		grid.innerHTML = list.map(function (p) {
			return '<div class="person-card" data-id="' + p.id + '">' +
				'<div class="person-avatar">' + esc(initials(p.name)) + '</div>' +
				'<div class="person-info">' +
					'<div class="person-name">' + esc(p.name) + '</div>' +
					'<div class="person-meta">' + (p.email ? esc(p.email) + (p.group ? " · " : "") : "") + (p.group ? esc(p.group) : "") + '</div>' +
				'</div>' +
				'<div class="person-actions hide-ro">' +
					'<button class="btn btn-ghost btn-sm" data-action="edit" data-id="' + p.id + '" title="Edit">✎</button>' +
					'<button class="btn btn-ghost btn-sm" data-action="delete" data-id="' + p.id + '" title="Delete" style="color:var(--red)">🗑</button>' +
				'</div>' +
			'</div>';
		}).join("");
		wirePeopleGrid(grid);
	}

	function wirePeopleGrid(grid) {
		$$(".person-card", grid).forEach(function (card) {
			card.onclick = function (e) {
				if (e.target.closest("button")) return;
				// Could open detail
			};
			$$("button", card).forEach(function (btn) {
				btn.onclick = function (e) {
					e.stopPropagation();
					var id = btn.dataset.id;
					if (btn.dataset.action === "edit") openPersonModal(id);
					else if (btn.dataset.action === "delete") deletePerson(id);
				};
			});
		});
	}

	function openPersonModal(editId) {
		var person = editId ? DB.people.filter(function (p) { return p.id === editId; })[0] : null;
		var title = person ? "Edit Person" : "Add Person";
		var html = '<div class="form-row">' +
			'<div class="form-group"><label class="form-label">Full Name *</label><input type="text" class="form-input" id="pf-name" value="' + esc(person ? person.name : "") + '" placeholder="e.g. Jane Smith"></div>' +
			'<div class="form-group"><label class="form-label">Group / Department</label><input type="text" class="form-input" id="pf-group" value="' + esc(person ? person.group || "" : "") + '" placeholder="e.g. Engineering"></div>' +
			'</div>' +
			'<div class="form-row">' +
			'<div class="form-group"><label class="form-label">Email</label><input type="email" class="form-input" id="pf-email" value="' + esc(person ? person.email || "" : "") + '" placeholder="jane@example.com"></div>' +
			'<div class="form-group"><label class="form-label">Phone</label><input type="text" class="form-input" id="pf-phone" value="' + esc(person ? person.phone || "" : "") + '" placeholder="+1 555-0123"></div>' +
			'</div>';
		var footer = '<button class="btn btn-ghost" id="modal-cancel">Cancel</button>' +
			'<button class="btn btn-primary" id="modal-save">' + (person ? "Save Changes" : "Add Person") + '</button>';
		showModal(title, html, footer, function () {
			var name = ($("#pf-name").value || "").trim();
			if (!name) { notify("Name is required", "error"); return false; }
			var data = {
				name: name,
				group: ($("#pf-group").value || "").trim(),
				email: ($("#pf-email").value || "").trim(),
				phone: ($("#pf-phone").value || "").trim()
			};
			if (person) {
				Object.assign(person, data);
			} else {
				data.id = uid();
				DB.people.push(data);
			}
			persist();
			renderPeople();
			closeModal();
			notify(person ? "Person updated" : "Person added", "success");
			return true;
		});
	}

	function deletePerson(id) {
		var person = DB.people.filter(function (p) { return p.id === id; })[0];
		if (!person) return;
		if (!confirm('Delete "' + person.name + '"? This will also remove their attendance records.')) return;
		DB.people = DB.people.filter(function (p) { return p.id !== id; });
		// Clean attendance records for this person
		Object.keys(DB.attendance).forEach(function (k) {
			var parts = k.split("-");
			if (parts.length >= 2 && parts[parts.length - 1] === id) delete DB.attendance[k];
		});
		persist();
		renderPeople();
		notify("Person deleted", "info");
	}

	/* ═══════════════════════════════════════════
	   EVENTS
	   ═══════════════════════════════════════════ */
	function renderEvents() {
		var q = ($("#events-search") ? $("#events-search").value : "").toLowerCase();
		var list = DB.events.slice().sort(function (a, b) { return (a.date || "").localeCompare(b.date || ""); });
		if (q) list = list.filter(function (e) { return e.title.toLowerCase().indexOf(q) > -1 || (e.location && e.location.toLowerCase().indexOf(q) > -1); });

		var el = $("#events-list");
		if (!DB.events.length) {
			el.innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div><h3>No events created yet</h3><p>Create events to start tracking attendance. You can add single events or recurring series.</p><button class="btn btn-primary" id="btn-add-event-empty">+ Create First Event</button></div>';
			var b = $("#btn-add-event-empty"); if (b) b.onclick = function () { openEventModal(); };
			return;
		}
		if (!list.length) {
			el.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><h3>No matches</h3><p>No events match "' + esc(q) + '".</p></div>';
			return;
		}
		el.innerHTML = list.map(function (ev) {
			var seriesLabel = ev.seriesId ? '<span class="event-badge series">🔄 Series</span>' : "";
			var preview = getEventAttendancePreview(ev);
			return '<div class="event-card" data-id="' + ev.id + '">' +
				'<div class="event-color" style="background:' + (ev.color || EVENT_COLORS[0]) + '"></div>' +
				'<div class="event-info">' +
					'<div class="event-title">' + esc(ev.title) + ' ' + seriesLabel + '</div>' +
					'<div class="event-sub">' +
						'<span>' + fmtDate(ev.date) + '</span>' +
						(ev.time ? '<span>' + fmtTime(ev.time) + (ev.endTime ? " – " + fmtTime(ev.endTime) : "") + '</span>' : '') +
						(ev.location ? '<span>📍 ' + esc(ev.location) + '</span>' : '') +
					'</div>' +
				'</div>' +
				'<div class="event-attendance-preview">' + preview + '</div>' +
				'<div class="person-actions hide-ro" style="opacity:1">' +
					'<button class="btn btn-ghost btn-sm" data-action="attendance" data-id="' + ev.id + '" title="Take Attendance">✓</button>' +
					'<button class="btn btn-ghost btn-sm" data-action="edit" data-id="' + ev.id + '" title="Edit">✎</button>' +
					'<button class="btn btn-ghost btn-sm" data-action="delete" data-id="' + ev.id + '" title="Delete" style="color:var(--red)">🗑</button>' +
				'</div>' +
			'</div>';
		}).join("");
		wireEventsList(el);
	}

	function getEventAttendancePreview(ev) {
		var total = DB.people.length;
		if (!total) return '<span style="color:var(--text3)">No people added</span>';
		var present = 0, absent = 0, late = 0, excused = 0, unmarked = 0;
		DB.people.forEach(function (p) {
			var key = ev.id + "-" + p.id;
			var rec = DB.attendance[key];
			if (!rec) { unmarked++; return; }
			if (rec.status === "present") present++;
			else if (rec.status === "absent") absent++;
			else if (rec.status === "late") late++;
			else if (rec.status === "excused") excused++;
			else unmarked++;
		});
		var parts = [];
		if (present) parts.push('<span class="attendance-dot present"></span> ' + present);
		if (late) parts.push('<span class="attendance-dot late"></span> ' + late);
		if (absent) parts.push('<span class="attendance-dot absent"></span> ' + absent);
		if (unmarked) parts.push('<span class="attendance-dot unmarked"></span> ' + unmarked);
		return parts.join(" ") || '<span style="color:var(--text3)">—</span>';
	}

	function wireEventsList(el) {
		$$(".event-card", el).forEach(function (card) {
			card.onclick = function (e) {
				if (e.target.closest("button")) return;
				openAttendanceDrawer(card.dataset.id);
			};
			$$("button", card).forEach(function (btn) {
				btn.onclick = function (e) {
					e.stopPropagation();
					var id = btn.dataset.id;
					if (btn.dataset.action === "attendance") openAttendanceDrawer(id);
					else if (btn.dataset.action === "edit") openEventModal(id);
					else if (btn.dataset.action === "delete") deleteEvent(id);
				};
			});
		});
	}

	function openEventModal(editId) {
		var ev = editId ? DB.events.filter(function (e) { return e.id === editId; })[0] : null;
		var title = ev ? "Edit Event" : "Add Event";
		var html = '<div class="form-group"><label class="form-label">Event Title *</label><input type="text" class="form-input" id="ef-title" value="' + esc(ev ? ev.title : "") + '" placeholder="e.g. Morning Standup"></div>' +
			'<div class="form-row">' +
				'<div class="form-group"><label class="form-label">Date *</label><input type="date" class="form-input" id="ef-date" value="' + esc(ev ? ev.date : todayISO()) + '"></div>' +
				'<div class="form-group"><label class="form-label">Color</label><input type="color" class="form-input" id="ef-color" value="' + esc(ev ? ev.color || EVENT_COLORS[0] : EVENT_COLORS[0]) + '" style="height:38px;padding:4px;cursor:pointer"></div>' +
			'</div>' +
			'<div class="form-row">' +
				'<div class="form-group"><label class="form-label">Start Time</label><input type="time" class="form-input" id="ef-time" value="' + esc(ev ? ev.time || "" : "") + '"></div>' +
				'<div class="form-group"><label class="form-label">End Time</label><input type="time" class="form-input" id="ef-endtime" value="' + esc(ev ? ev.endTime || "" : "") + '"></div>' +
			'</div>' +
			'<div class="form-row">' +
				'<div class="form-group"><label class="form-label">Location</label><input type="text" class="form-input" id="ef-location" value="' + esc(ev ? ev.location || "" : "") + '" placeholder="Room / Venue"></div>' +
			'</div>' +
			'<div class="form-group"><label class="form-label">Description</label><textarea class="form-textarea" id="ef-desc" placeholder="Event details...">' + esc(ev ? ev.description || "" : "") + '</textarea></div>';
		var footer = '<button class="btn btn-ghost" id="modal-cancel">Cancel</button>' +
			'<button class="btn btn-primary" id="modal-save">' + (ev ? "Save Changes" : "Create Event") + '</button>';
		showModal(title, html, footer, function () {
			var eventTitle = ($("#ef-title").value || "").trim();
			var date = ($("#ef-date").value || "").trim();
			if (!eventTitle) { notify("Event title is required", "error"); return false; }
			if (!date) { notify("Date is required", "error"); return false; }
			var data = {
				title: eventTitle,
				date: date,
				time: ($("#ef-time").value || "").trim(),
				endTime: ($("#ef-endtime").value || "").trim(),
				location: ($("#ef-location").value || "").trim(),
				description: ($("#ef-desc").value || "").trim(),
				color: ($("#ef-color").value || "").trim() || EVENT_COLORS[0],
				seriesId: ev ? ev.seriesId || null : null
			};
			if (ev) {
				Object.assign(ev, data);
			} else {
				data.id = uid();
				DB.events.push(data);
			}
			persist();
			renderEvents();
			if (currentPage === "calendar") renderCalendar();
			closeModal();
			notify(ev ? "Event updated" : "Event created", "success");
			return true;
		});
	}

	function deleteEvent(id) {
		var ev = DB.events.filter(function (e) { return e.id === id; })[0];
		if (!ev) return;
		var msg = 'Delete "' + ev.title + '"';
		if (ev.seriesId) {
			var seriesEvents = DB.events.filter(function (e) { return e.seriesId === ev.seriesId; });
			if (seriesEvents.length > 1) msg += '? This is part of a series. Delete ALL ' + seriesEvents.length + ' events in the series?';
		}
		if (!confirm(msg + " This cannot be undone.")) return;
		if (ev.seriesId) {
			// Delete all events in series
			var ids = DB.events.filter(function (e) { return e.seriesId === ev.seriesId; }).map(function (e) { return e.id; });
			DB.events = DB.events.filter(function (e) { return e.seriesId !== ev.seriesId; });
			ids.forEach(function (eid) { cleanAttendanceForEvent(eid); });
			notify("Series deleted (" + ids.length + " events)", "info");
		} else {
			DB.events = DB.events.filter(function (e) { return e.id !== id; });
			cleanAttendanceForEvent(id);
			notify("Event deleted", "info");
		}
		persist();
		renderEvents();
		if (currentPage === "calendar") renderCalendar();
	}

	function cleanAttendanceForEvent(eventId) {
		Object.keys(DB.attendance).forEach(function (k) {
			if (k.indexOf(eventId + "-") === 0) delete DB.attendance[k];
		});
	}

	/* ═══════════════════════════════════════════
	   SERIES / RECURRING EVENTS
	   ═══════════════════════════════════════════ */
	function openSeriesModal() {
		var html = '<div class="form-group"><label class="form-label">Event Title *</label><input type="text" class="form-input" id="sf-title" placeholder="e.g. Team Standup"></div>' +
			'<div class="form-row">' +
				'<div class="form-group"><label class="form-label">Start Date *</label><input type="date" class="form-input" id="sf-start" value="' + todayISO() + '"></div>' +
				'<div class="form-group"><label class="form-label">End Date *</label><input type="date" class="form-input" id="sf-end" value="' + todayISO() + '"></div>' +
			'</div>' +
			'<div class="form-group"><label class="form-label">Recurrence Pattern *</label>' +
				'<select class="form-select" id="sf-pattern"><option value="daily">Every Day</option><option value="weekdays" selected>Weekdays (Mon–Fri)</option><option value="weekly">Weekly (Same Day of Week)</option><option value="biweekly">Every 2 Weeks</option><option value="monthly">Monthly (Same Date)</option></select>' +
			'</div>' +
			'<div class="form-row">' +
				'<div class="form-group"><label class="form-label">Start Time</label><input type="time" class="form-input" id="sf-time" value="09:00"></div>' +
				'<div class="form-group"><label class="form-label">End Time</label><input type="time" class="form-input" id="sf-endtime" value="10:00"></div>' +
			'</div>' +
			'<div class="form-row">' +
				'<div class="form-group"><label class="form-label">Location</label><input type="text" class="form-input" id="sf-location" placeholder="Room / Venue"></div>' +
				'<div class="form-group"><label class="form-label">Color</label><input type="color" class="form-input" id="sf-color" value="' + EVENT_COLORS[0] + '" style="height:38px;padding:4px;cursor:pointer"></div>' +
			'</div>' +
			'<div class="form-group"><label class="form-label">Description</label><textarea class="form-textarea" id="sf-desc" placeholder="Event details..."></textarea></div>' +
			'<div class="series-preview" id="series-preview"><h4>Preview</h4><div class="series-dates" id="series-dates">Select dates to preview</div></div>';

		var footer = '<button class="btn btn-ghost" id="modal-cancel">Cancel</button>' +
			'<button class="btn btn-outline" id="modal-preview-series">Preview Dates</button>' +
			'<button class="btn btn-primary" id="modal-save">Create Series</button>';

		showModal("Create Event Series", html, footer, function () {
			var eventTitle = ($("#sf-title").value || "").trim();
			if (!eventTitle) { notify("Event title is required", "error"); return false; }
			var dates = generateSeriesDates();
			if (!dates.length) { notify("No valid dates in range. Adjust start/end date.", "error"); return false; }
			var seriesId = uid();
			var color = ($("#sf-color").value || "").trim() || EVENT_COLORS[0];
			var time = ($("#sf-time").value || "").trim();
			var endTime = ($("#sf-endtime").value || "").trim();
			var location = ($("#sf-location").value || "").trim();
			var desc = ($("#sf-desc").value || "").trim();
			dates.forEach(function (d, i) {
				DB.events.push({
					id: uid(),
					title: eventTitle + (dates.length > 1 ? " (" + (i + 1) + "/" + dates.length + ")" : ""),
					date: d,
					time: time,
					endTime: endTime,
					location: location,
					description: desc,
					color: color,
					seriesId: seriesId
				});
			});
			persist();
			renderEvents();
			if (currentPage === "calendar") renderCalendar();
			closeModal();
			notify("Series created: " + dates.length + " events", "success");
			return true;
		});

		// Wire preview button
		var previewBtn = $("#modal-preview-series");
		if (previewBtn) {
			previewBtn.onclick = function () {
				var dates = generateSeriesDates();
				var previewEl = $("#series-dates");
				if (previewEl) {
					if (dates.length) {
						previewEl.innerHTML = dates.map(function (d) { return '<span class="series-date-chip">' + fmtDateShort(d) + '</span>'; }).join("");
					} else {
						previewEl.innerHTML = '<span style="color:var(--red);font-size:12px">No valid dates in this range. Adjust start/end date.</span>';
					}
				}
				if (dates.length) {
					notify(dates.length + " events will be created", "info");
				}
			};
		}

		// Auto-refresh preview on date/pattern change
		setTimeout(function () {
			["sf-start", "sf-end", "sf-pattern"].forEach(function (fid) {
				var el = $("#" + fid); if (el) el.addEventListener("change", function () { if (previewBtn) previewBtn.click(); });
			});
		}, 100);
	}

	function generateSeriesDates() {
		var startVal = ($("#sf-start") ? $("#sf-start").value : "").trim();
		var endVal = ($("#sf-end") ? $("#sf-end").value : "").trim();
		var pattern = $("#sf-pattern") ? $("#sf-pattern").value : "weekdays";
		if (!startVal || !endVal) return [];
		var start = parseDate(startVal);
		var end = parseDate(endVal);
		if (!start || !end || isNaN(start) || isNaN(end) || start > end) return [];
		var dates = [];
		var cur = new Date(start);
		while (cur <= end) {
			var iso = cur.getFullYear() + "-" + String(cur.getMonth() + 1).padStart(2, "0") + "-" + String(cur.getDate()).padStart(2, "0");
			var dow = cur.getDay(); // 0=Sun
			var include = false;
			if (pattern === "daily") include = true;
			else if (pattern === "weekdays") include = dow >= 1 && dow <= 5;
			else if (pattern === "weekly") include = dow === start.getDay();
			else if (pattern === "biweekly") {
				var diffDays = Math.floor((cur - start) / 86400000);
				include = (dow === start.getDay() && diffDays % 14 === 0);
			}
			else if (pattern === "monthly") include = cur.getDate() === start.getDate();
			if (include) dates.push(iso);
			cur.setDate(cur.getDate() + 1);
		}
		return dates;
	}

	/* ═══════════════════════════════════════════
	   CALENDAR
	   ═══════════════════════════════════════════ */
	function renderCalendar() {
		var container = $("#calendar-container");
		if (!container) return;
		if (calendarView === "month") renderMonthView(container);
		else if (calendarView === "week") renderWeekView(container);
		else if (calendarView === "day") renderDayView(container);
		updateCalendarTitle();
	}

	function updateCalendarTitle() {
		var el = $("#cal-title");
		if (!el) return;
		var opts = { year: "numeric", month: "long" };
		if (calendarView === "day") el.textContent = calendarDate.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
		else if (calendarView === "week") {
			var start = getWeekStart(calendarDate);
			var end = new Date(start); end.setDate(end.getDate() + 6);
			el.textContent = start.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " – " + end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
		}
		else el.textContent = calendarDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
	}

	function getWeekStart(d) {
		var day = d.getDay();
		var diff = d.getDate() - day + (day === 0 ? -6 : 1);
		var monday = new Date(d); monday.setDate(diff); monday.setHours(0, 0, 0, 0);
		return monday;
	}

	function getEventsForDate(iso) {
		return DB.events.filter(function (e) { return e.date === iso; });
	}

	function renderMonthView(container) {
		var year = calendarDate.getFullYear();
		var month = calendarDate.getMonth();
		var firstDay = new Date(year, month, 1);
		var lastDay = new Date(year, month + 1, 0);
		var startPad = firstDay.getDay(); if (startPad === 0) startPad = 7; startPad--;
		var daysInMonth = lastDay.getDate();
		var today = todayISO();

		var dayHeaders = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
		var html = '<div class="cal-month-grid">';
		dayHeaders.forEach(function (h) { html += '<div class="cal-day-header">' + h + '</div>'; });

		// Previous month padding
		var prevLast = new Date(year, month, 0).getDate();
		for (var i = startPad - 1; i >= 0; i--) {
			var d = prevLast - i;
			var iso = year + "-" + String(month === 0 ? 12 : month).padStart(2, "0") + "-" + String(d).padStart(2, "0");
			html += buildMonthDayCell(d, iso, true, today);
		}

		// Current month
		for (var d = 1; d <= daysInMonth; d++) {
			var iso = year + "-" + String(month + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
			html += buildMonthDayCell(d, iso, false, today);
		}

		// Next month padding
		var remaining = 42 - (startPad + daysInMonth);
		for (var d = 1; d <= remaining; d++) {
			var nm = month + 2; var ny = year; if (nm > 12) { nm = 1; ny++; }
			var iso = ny + "-" + String(nm).padStart(2, "0") + "-" + String(d).padStart(2, "0");
			html += buildMonthDayCell(d, iso, true, today);
		}

		html += '</div>';
		container.innerHTML = html;
		wireCalendarCells(container);
	}

	function buildMonthDayCell(dayNum, iso, otherMonth, today) {
		var events = getEventsForDate(iso);
		var cls = "cal-day";
		if (otherMonth) cls += " other-month";
		if (iso === today) cls += " today";
		var eventDots = events.slice(0, 3).map(function (ev) {
			return '<div class="cal-event-dot" data-event-id="' + ev.id + '" title="' + esc(ev.title) + '"><span class="dot" style="background:' + (ev.color || EVENT_COLORS[0]) + '"></span>' + esc(ev.title) + '</div>';
		}).join("");
		if (events.length > 3) eventDots += '<div class="cal-event-dot" style="font-size:9px;opacity:0.7">+' + (events.length - 3) + ' more</div>';
		return '<div class="' + cls + '" data-date="' + iso + '"><div class="cal-day-num">' + dayNum + '</div><div class="cal-day-events">' + eventDots + '</div></div>';
	}

	function wireCalendarCells(container) {
		$$(".cal-day", container).forEach(function (cell) {
			cell.onclick = function (e) {
				if (e.target.closest(".cal-event-dot")) {
					var eventId = e.target.closest(".cal-event-dot").dataset.eventId;
					if (eventId) { openAttendanceDrawer(eventId); return; }
				}
				// Select day and switch to day view
				calendarDate = parseDate(cell.dataset.date) || calendarDate;
				calendarView = "day";
				$$(".cal-view-btn").forEach(function (b) { b.classList.remove("active"); });
				var dayBtn = $('.cal-view-btn[data-view="day"]'); if (dayBtn) dayBtn.classList.add("active");
				renderCalendar();
			};
			$$(".cal-event-dot", cell).forEach(function (dot) {
				dot.onclick = function (e) {
					e.stopPropagation();
					openAttendanceDrawer(dot.dataset.eventId);
				};
			});
		});
	}

	function renderWeekView(container) {
		var start = getWeekStart(calendarDate);
		var today = todayISO();
		var dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
		var html = '<div class="cal-week-grid">';
		html += '<div class="cal-week-header"></div>';
		for (var i = 0; i < 7; i++) {
			var d = new Date(start); d.setDate(d.getDate() + i);
			var iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
			var isToday = iso === today;
			html += '<div class="cal-day-col-header' + (isToday ? ' today' : '') + '">' + dayNames[i] + ' <b>' + d.getDate() + '</b></div>';
		}
		// Build all-day row
		html += '<div class="cal-time-slot" style="font-weight:600">All Day</div>';
		for (var i = 0; i < 7; i++) {
			var cd = new Date(start); cd.setDate(cd.getDate() + i);
			var ciso = cd.getFullYear() + "-" + String(cd.getMonth() + 1).padStart(2, "0") + "-" + String(cd.getDate()).padStart(2, "0");
			var isToday = ciso === today;
			var allDayEvents = getEventsForDate(ciso).filter(function (ev) { return !ev.time; });
			var blocks = allDayEvents.map(function (ev) {
				return '<div class="cal-event-block" style="background:' + (ev.color || EVENT_COLORS[0]) + '" data-event-id="' + ev.id + '" title="' + esc(ev.title) + '">' + esc(ev.title) + '</div>';
			}).join("");
			html += '<div class="cal-day-col' + (isToday ? ' today' : '') + (blocks ? ' has-events' : '') + '" data-date="' + ciso + '">' + blocks + '</div>';
		}
		// Time slots 0 AM to 23 PM (compact rows, 24h)
		for (var h = 0; h <= 23; h++) {
			var hourLabel = (h % 12 || 12) + ":00 " + (h < 12 ? "AM" : "PM");
			html += '<div class="cal-time-slot">' + hourLabel + '</div>';
			// Pre-compute max events in this hour across all 7 days to keep rows aligned
			var maxEventsThisHour = 1;
			for (var i = 0; i < 7; i++) {
				var cd2 = new Date(start); cd2.setDate(cd2.getDate() + i);
				var ciso2 = cd2.getFullYear() + "-" + String(cd2.getMonth() + 1).padStart(2, "0") + "-" + String(cd2.getDate()).padStart(2, "0");
				var count = getEventsForDate(ciso2).filter(function (ev) {
					if (!ev.time) return false;
					return parseInt(ev.time.split(":")[0], 10) === h;
				}).length;
				if (count > maxEventsThisHour) maxEventsThisHour = count;
			}
			for (var i = 0; i < 7; i++) {
				var cd3 = new Date(start); cd3.setDate(cd3.getDate() + i);
				var ciso3 = cd3.getFullYear() + "-" + String(cd3.getMonth() + 1).padStart(2, "0") + "-" + String(cd3.getDate()).padStart(2, "0");
				var isToday2 = ciso3 === today;
				var hourEvents = getEventsForDate(ciso3).filter(function (ev) {
					if (!ev.time) return false;
					return parseInt(ev.time.split(":")[0], 10) === h;
				});
				var eventBlocks = hourEvents.map(function (ev) {
					var startMin = ev.time ? ev.time.slice(3, 5) : "00";
					var label = esc(ev.title) + (ev.time ? " " + fmtTime(ev.time) : "");
					return '<div class="cal-event-block" style="background:' + (ev.color || EVENT_COLORS[0]) + '" data-event-id="' + ev.id + '" title="' + esc(ev.title) + " " + fmtTime(ev.time) + '">' + label + '</div>';
				}).join("");
				var cls = 'cal-day-col' + (isToday2 ? ' today' : '') + (eventBlocks ? ' has-events' : '');
				// Pad empty cells to match max height for this row
				var padding = "";
				if (!eventBlocks && maxEventsThisHour > 1) {
					padding = '<div style="visibility:hidden;height:' + ((maxEventsThisHour - 1) * 20) + 'px"></div>';
				}
				html += '<div class="' + cls + '" data-date="' + ciso3 + '">' + eventBlocks + padding + '</div>';
			}
		}
		html += '</div>';
		container.innerHTML = html;
		wireWeekDayEvents(container);
	}

	function renderDayView(container) {
		var iso = calendarDate.getFullYear() + "-" + String(calendarDate.getMonth() + 1).padStart(2, "0") + "-" + String(calendarDate.getDate()).padStart(2, "0");
		var events = getEventsForDate(iso);
		var html = '<div class="cal-day-view">' +
			'<div class="cal-day-view-header">' + calendarDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }) + '</div>' +
			'<div class="cal-day-view-events">';
		if (!events.length) {
			html += '<div class="empty-state" style="border:none;padding:24px"><div class="empty-icon">📅</div><h3>No events on this day</h3><p>Click "+ Quick Event" to add one.</p></div>';
		} else {
			events.forEach(function (ev) {
				html += '<div class="cal-day-event-item" data-id="' + ev.id + '">' +
					'<div class="cal-day-event-color" style="background:' + (ev.color || EVENT_COLORS[0]) + '"></div>' +
					'<div class="cal-day-event-info">' +
						'<div class="cal-day-event-title">' + esc(ev.title) + '</div>' +
						'<div class="cal-day-event-time">' + (ev.time ? fmtTime(ev.time) + (ev.endTime ? " – " + fmtTime(ev.endTime) : "") : "All Day") + (ev.location ? " · " + esc(ev.location) : "") + '</div>' +
					'</div>' +
					getEventAttendancePreview(ev) +
				'</div>';
			});
		}
		html += '</div></div>';
		container.innerHTML = html;
		wireDayEvents(container);
	}

	function wireWeekDayEvents(container) {
		$$(".cal-event-block", container).forEach(function (block) {
			block.onclick = function () { openAttendanceDrawer(block.dataset.eventId); };
		});
		$$(".cal-day-col", container).forEach(function (col) {
			col.onclick = function (e) {
				if (e.target.closest(".cal-event-block")) return;
				calendarDate = parseDate(col.dataset.date) || calendarDate;
				calendarView = "day";
				$$(".cal-view-btn").forEach(function (b) { b.classList.remove("active"); });
				var dayBtn = $('.cal-view-btn[data-view="day"]'); if (dayBtn) dayBtn.classList.add("active");
				renderCalendar();
			};
		});
	}

	function wireDayEvents(container) {
		$$(".cal-day-event-item", container).forEach(function (item) {
			item.onclick = function () { openAttendanceDrawer(item.dataset.id); };
		});
	}

	/* ═══════════════════════════════════════════
	   ATTENDANCE DRAWER
	   ═══════════════════════════════════════════ */
	function openAttendanceDrawer(eventId) {
		var ev = DB.events.filter(function (e) { return e.id === eventId; })[0];
		if (!ev) { notify("Event not found", "error"); return; }
		currentEventId = eventId;

		$("#drawer-event-title").textContent = ev.title;
		$("#drawer-event-meta").innerHTML = fmtDate(ev.date) + (ev.time ? " · " + fmtTime(ev.time) + (ev.endTime ? " – " + fmtTime(ev.endTime) : "") : "") + (ev.location ? " · 📍 " + esc(ev.location) : "");

		var body = $("#drawer-body");
		if (!DB.people.length) {
			body.innerHTML = '<div class="empty-state" style="border:none;padding:24px"><p>No people added yet. Add people first to track attendance.</p></div>';
		} else {
			// Mark all row
			var html = '<div class="mark-all-row hide-ro"><label class="form-label">Mark All:</label>' +
				'<button class="btn btn-ghost btn-sm" data-markall="present">✓ All Present</button>' +
				'<button class="btn btn-ghost btn-sm" data-markall="absent">✗ All Absent</button>' +
				'<button class="btn btn-ghost btn-sm" data-markall="late">⏰ All Late</button>' +
				'<button class="btn btn-ghost btn-sm" data-markall="excused">📝 All Excused</button>' +
				'<button class="btn btn-ghost btn-sm" data-markall="clear">Clear All</button>' +
			'</div>';

			DB.people.forEach(function (p) {
				var key = eventId + "-" + p.id;
				var rec = DB.attendance[key] || { status: "", lateMinutes: 0, notes: "" };
				var selPresent = rec.status === "present" ? "selected" : "";
				var selAbsent = rec.status === "absent" ? "selected" : "";
				var selLate = rec.status === "late" ? "selected" : "";
				var selExcused = rec.status === "excused" ? "selected" : "";
				var showLate = rec.status === "late" ? "" : "style='display:none'";
				html += '<div class="attendance-row" data-person-id="' + p.id + '">' +
					'<div class="attendance-person">' +
						'<div class="attendance-person-avatar">' + esc(initials(p.name)) + '</div>' +
						'<div class="attendance-person-name">' + esc(p.name) + '</div>' +
					'</div>' +
					'<select class="attendance-status-select" data-person="' + p.id + '">' +
						'<option value="">— Unmarked —</option>' +
						'<option value="present" ' + selPresent + '>✓ Present</option>' +
						'<option value="late" ' + selLate + '>⏰ Late</option>' +
						'<option value="absent" ' + selAbsent + '>✗ Absent</option>' +
						'<option value="excused" ' + selExcused + '>📝 Excused</option>' +
					'</select>' +
					'<input type="number" class="attendance-late-input" data-person="' + p.id + '" value="' + (rec.lateMinutes || "") + '" placeholder="Min" min="0" max="480" ' + (rec.status === "late" ? "" : "style='display:none'") + ' title="Minutes late">' +
					'<input type="text" class="attendance-notes" data-person="' + p.id + '" value="' + esc(rec.notes || "") + '" placeholder="Note...">' +
				'</div>';
			});
			body.innerHTML = html;
			wireAttendanceRows(body, eventId);
		}

		updateDrawerStats();
		$("#drawer-overlay").classList.add("open");

		// Save button
		var saveBtn = $("#drawer-save");
		if (saveBtn) {
			saveBtn.onclick = function () {
				saveAttendanceDrawer();
				$("#drawer-overlay").classList.remove("open");
				currentEventId = null;
				renderEvents();
				if (currentPage === "calendar") renderCalendar();
				if (currentPage === "reports") renderReports();
				notify("Attendance saved", "success");
			};
		}
	}

	function wireAttendanceRows(body, eventId) {
		$$(".attendance-status-select", body).forEach(function (sel) {
			sel.onchange = function () {
				var personId = sel.dataset.person;
				var lateInput = $('.attendance-late-input[data-person="' + personId + '"]');
				if (sel.value === "late") {
					if (lateInput) lateInput.style.display = "";
				} else {
					if (lateInput) { lateInput.style.display = "none"; lateInput.value = ""; }
				}
				updateDrawerStats();
			};
		});

		$$(".attendance-late-input, .attendance-notes", body).forEach(function (inp) {
			inp.addEventListener("input", function () { updateDrawerStats(); });
		});

		$$("[data-markall]", body).forEach(function (btn) {
			btn.onclick = function () {
				var status = btn.dataset.markall;
				$$(".attendance-status-select", body).forEach(function (sel) {
					if (status === "clear") sel.value = "";
					else sel.value = status;
					sel.dispatchEvent(new Event("change"));
				});
				if (status === "clear") {
					$$(".attendance-late-input", body).forEach(function (inp) { inp.value = ""; inp.style.display = "none"; });
					$$(".attendance-notes", body).forEach(function (inp) { inp.value = ""; });
				}
				updateDrawerStats();
			};
		});
	}

	function saveAttendanceDrawer() {
		if (!currentEventId) return;
		var body = $("#drawer-body");
		$$(".attendance-row", body).forEach(function (row) {
			var personId = row.dataset.personId;
			var sel = $('.attendance-status-select[data-person="' + personId + '"]');
			var lateInp = $('.attendance-late-input[data-person="' + personId + '"]');
			var notesInp = $('.attendance-notes[data-person="' + personId + '"]');
			var status = sel ? sel.value : "";
			var lateMin = lateInp ? parseInt(lateInp.value, 10) || 0 : 0;
			var notes = notesInp ? (notesInp.value || "").trim() : "";
			var key = currentEventId + "-" + personId;
			if (status) {
				DB.attendance[key] = { status: status, lateMinutes: status === "late" ? lateMin : 0, notes: notes };
			} else {
				delete DB.attendance[key];
			}
		});
		persist();
		updateDrawerStats();
	}

	function updateDrawerStats() {
		var stats = $("#drawer-stats");
		if (!stats) return;
		var body = $("#drawer-body");
		var present = 0, absent = 0, late = 0, excused = 0, unmarked = 0, totalLateMin = 0;
		$$(".attendance-row", body).forEach(function (row) {
			var personId = row.dataset.personId;
			var sel = $('.attendance-status-select[data-person="' + personId + '"]');
			var lateInp = $('.attendance-late-input[data-person="' + personId + '"]');
			var status = sel ? sel.value : "";
			if (status === "present") present++;
			else if (status === "absent") absent++;
			else if (status === "late") { late++; totalLateMin += parseInt(lateInp ? lateInp.value : 0, 10) || 0; }
			else if (status === "excused") excused++;
			else unmarked++;
		});
		stats.innerHTML =
			'<span style="color:var(--green)">✓ ' + present + ' Present</span>' +
			'<span style="color:var(--amber)">⏰ ' + late + ' Late (' + totalLateMin + ' min)</span>' +
			'<span style="color:var(--red)">✗ ' + absent + ' Absent</span>' +
			'<span style="color:var(--blue)">📝 ' + excused + ' Excused</span>' +
			(unmarked ? '<span style="color:var(--text3)">' + unmarked + ' Unmarked</span>' : '');
	}

	/* ═══════════════════════════════════════════
	   REPORTS
	   ═══════════════════════════════════════════ */
	function renderReports() {
		var activeTab = ($(".report-tab.active") ? $(".report-tab.active").dataset.tab : "summary");
		renderReportContent(activeTab);
	}

	function renderReportContent(tab) {
		var content = $("#report-content");
		if (!content) return;
		if (tab === "summary") renderSummaryReport(content);
		else if (tab === "latency") renderLatencyReport(content);
		else if (tab === "absence") renderAbsenceReport(content);
		else if (tab === "cards") renderPersonCards(content);
	}

	function getAttendanceStats() {
		var stats = {};
		DB.people.forEach(function (p) {
			stats[p.id] = { person: p, present: 0, absent: 0, late: 0, excused: 0, totalLateMin: 0, totalEvents: 0 };
		});
		DB.events.forEach(function (ev) {
			DB.people.forEach(function (p) {
				var key = ev.id + "-" + p.id;
				var rec = DB.attendance[key];
				stats[p.id].totalEvents++;
				if (rec) {
					if (rec.status === "present") stats[p.id].present++;
					else if (rec.status === "absent") stats[p.id].absent++;
					else if (rec.status === "late") { stats[p.id].late++; stats[p.id].totalLateMin += rec.lateMinutes || 0; }
					else if (rec.status === "excused") stats[p.id].excused++;
				}
			});
		});
		return stats;
	}

	function renderSummaryReport(content) {
		var stats = getAttendanceStats();
		var totalPeople = DB.people.length;
		var totalEvents = DB.events.length;
		var totalRecords = Object.keys(DB.attendance).length;
		var totalPresent = 0, totalAbsent = 0, totalLate = 0, totalExcused = 0;
		Object.values(stats).forEach(function (s) { totalPresent += s.present; totalAbsent += s.absent; totalLate += s.late; totalExcused += s.excused; });

		var html = '<div class="summary-stats">' +
			'<div class="stat-card"><div class="stat-value">' + totalPeople + '</div><div class="stat-label">People Tracked</div></div>' +
			'<div class="stat-card"><div class="stat-value">' + totalEvents + '</div><div class="stat-label">Total Events</div></div>' +
			'<div class="stat-card"><div class="stat-value green">' + totalPresent + '</div><div class="stat-label">Total Present</div></div>' +
			'<div class="stat-card"><div class="stat-value amber">' + totalLate + '</div><div class="stat-label">Total Late</div></div>' +
			'<div class="stat-card"><div class="stat-value red">' + totalAbsent + '</div><div class="stat-label">Total Absent</div></div>' +
		'</div>';

		if (!DB.events.length) {
			html += '<div class="empty-state"><p>Create events to see attendance summaries.</p></div>';
		} else {
			html += '<table class="report-table"><thead><tr><th>Event</th><th>Date</th><th>Present</th><th>Late</th><th>Absent</th><th>Excused</th><th>Coverage</th></tr></thead><tbody>';
			DB.events.slice().sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); }).forEach(function (ev) {
				var present = 0, absent = 0, late = 0, excused = 0;
				DB.people.forEach(function (p) {
					var rec = DB.attendance[ev.id + "-" + p.id];
					if (rec) {
						if (rec.status === "present") present++;
						else if (rec.status === "absent") absent++;
						else if (rec.status === "late") late++;
						else if (rec.status === "excused") excused++;
					}
				});
				var total = DB.people.length;
				var marked = present + absent + late + excused;
				var pct = total ? Math.round(marked / total * 100) : 0;
				html += '<tr>' +
					'<td><b>' + esc(ev.title) + '</b></td>' +
					'<td>' + fmtDateShort(ev.date) + '</td>' +
					'<td><span class="status-badge present">' + present + '</span></td>' +
					'<td><span class="status-badge late">' + late + '</span></td>' +
					'<td><span class="status-badge absent">' + absent + '</span></td>' +
					'<td><span class="status-badge excused">' + excused + '</span></td>' +
					'<td><div style="display:flex;align-items:center;gap:8px"><div style="flex:1;height:6px;background:var(--bg3);border-radius:3px;overflow:hidden"><div style="height:100%;width:' + pct + '%;background:' + (pct === 100 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)') + ';border-radius:3px"></div></div><span style="font-size:11px;color:var(--text2)">' + pct + '%</span></div></td>' +
				'</tr>';
			});
			html += '</tbody></table>';
		}
		content.innerHTML = html;
	}

	function renderLatencyReport(content) {
		var stats = getAttendanceStats();
		var peopleWithLate = Object.values(stats).filter(function (s) { return s.late > 0; }).sort(function (a, b) { return b.totalLateMin - a.totalLateMin; });

		var totalLateMinutes = 0, totalLateInstances = 0;
		peopleWithLate.forEach(function (s) { totalLateMinutes += s.totalLateMin; totalLateInstances += s.late; });

		var html = '<div class="summary-stats">' +
			'<div class="stat-card"><div class="stat-value amber">' + totalLateInstances + '</div><div class="stat-label">Late Instances</div></div>' +
			'<div class="stat-card"><div class="stat-value amber">' + totalLateMinutes + '</div><div class="stat-label">Total Minutes Late</div></div>' +
			'<div class="stat-card"><div class="stat-value">' + (totalLateInstances ? Math.round(totalLateMinutes / totalLateInstances) : 0) + '</div><div class="stat-label">Avg Min Per Lateness</div></div>' +
		'</div>';

		if (!peopleWithLate.length) {
			html += '<div class="empty-state" style="margin-top:16px"><div class="empty-icon">✅</div><h3>No lateness recorded</h3><p>Everyone has been on time. Great job!</p></div>';
		} else {
			html += '<table class="report-table"><thead><tr><th>Person</th><th>Late Count</th><th>Total Minutes</th><th>Avg Minutes</th><th>Events Attended</th><th>Late Rate</th></tr></thead><tbody>';
			peopleWithLate.forEach(function (s) {
				var avgMin = s.late ? Math.round(s.totalLateMin / s.late) : 0;
				var attended = s.present + s.late;
				var lateRate = attended ? Math.round(s.late / attended * 100) : 0;
				html += '<tr>' +
					'<td><b>' + esc(s.person.name) + '</b>' + (s.person.group ? ' <span style="color:var(--text3);font-size:11px">' + esc(s.person.group) + '</span>' : '') + '</td>' +
					'<td><span class="status-badge late">' + s.late + '</span></td>' +
					'<td>' + s.totalLateMin + ' min</td>' +
					'<td>' + avgMin + ' min</td>' +
					'<td>' + attended + '</td>' +
					'<td><div style="display:flex;align-items:center;gap:6px"><div style="flex:1;height:6px;background:var(--bg3);border-radius:3px;overflow:hidden"><div style="height:100%;width:' + Math.min(100, lateRate * 2) + '%;background:var(--amber);border-radius:3px"></div></div><span style="font-size:11px">' + lateRate + '%</span></div></td>' +
				'</tr>';
			});
			html += '</tbody></table>';
		}
		content.innerHTML = html;
	}

	function renderAbsenceReport(content) {
		var stats = getAttendanceStats();
		var peopleWithAbsence = Object.values(stats).filter(function (s) { return s.absent > 0; }).sort(function (a, b) { return b.absent - a.absent; });

		var totalAbsences = 0;
		peopleWithAbsence.forEach(function (s) { totalAbsences += s.absent; });

		var html = '<div class="summary-stats">' +
			'<div class="stat-card"><div class="stat-value red">' + totalAbsences + '</div><div class="stat-label">Total Absences</div></div>' +
			'<div class="stat-card"><div class="stat-value">' + peopleWithAbsence.length + '</div><div class="stat-label">People with Absences</div></div>' +
		'</div>';

		if (!peopleWithAbsence.length) {
			html += '<div class="empty-state" style="margin-top:16px"><div class="empty-icon">✅</div><h3>No absences recorded</h3><p>Perfect attendance across all events.</p></div>';
		} else {
			html += '<table class="report-table"><thead><tr><th>Person</th><th>Absences</th><th>Events Attended</th><th>Absence Rate</th><th>Status</th></tr></thead><tbody>';
			peopleWithAbsence.forEach(function (s) {
				var attended = s.present + s.late + s.absent;
				var absenceRate = attended ? Math.round(s.absent / attended * 100) : 0;
				var level = absenceRate >= 50 ? '<span class="status-badge absent">Critical</span>' : absenceRate >= 25 ? '<span class="status-badge late">Warning</span>' : '<span class="status-badge excused">Monitor</span>';
				html += '<tr>' +
					'<td><b>' + esc(s.person.name) + '</b>' + (s.person.group ? ' <span style="color:var(--text3);font-size:11px">' + esc(s.person.group) + '</span>' : '') + '</td>' +
					'<td><span class="status-badge absent">' + s.absent + '</span></td>' +
					'<td>' + attended + '</td>' +
					'<td><b style="color:' + (absenceRate >= 50 ? 'var(--red)' : absenceRate >= 25 ? 'var(--amber)' : 'var(--text)') + '">' + absenceRate + '%</b></td>' +
					'<td>' + level + '</td>' +
				'</tr>';
			});
			html += '</tbody></table>';
		}
		content.innerHTML = html;
	}

	function renderPersonCards(content) {
		var stats = getAttendanceStats();
		var peopleStats = Object.values(stats);

		if (!peopleStats.length) {
			content.innerHTML = '<div class="empty-state"><p>Add people to see their attendance cards.</p></div>';
			return;
		}

		var html = '<div class="person-cards-grid">';
		peopleStats.forEach(function (s) {
			var totalMarked = s.present + s.absent + s.late + s.excused;
			var attendanceRate = s.totalEvents ? Math.round((s.present + s.excused) / s.totalEvents * 100) : 0;
			var rateColor = attendanceRate >= 90 ? "var(--green)" : attendanceRate >= 70 ? "var(--amber)" : "var(--red)";
			var avgLate = s.late ? Math.round(s.totalLateMin / s.late) : 0;
			html += '<div class="person-report-card">' +
				'<div class="person-header">' +
					'<div class="person-avatar-lg">' + esc(initials(s.person.name)) + '</div>' +
					'<div>' +
						'<div style="font-weight:700;font-size:15px">' + esc(s.person.name) + '</div>' +
						(s.person.group ? '<div style="font-size:12px;color:var(--text2)">' + esc(s.person.group) + '</div>' : '') +
						(s.person.email ? '<div style="font-size:11px;color:var(--text3)">' + esc(s.person.email) + '</div>' : '') +
					'</div>' +
				'</div>' +
				'<div class="person-report-stats">' +
					'<div class="person-stat"><div class="val" style="color:var(--green)">' + s.present + '</div><div class="lbl">Present</div></div>' +
					'<div class="person-stat"><div class="val" style="color:var(--amber)">' + s.late + '</div><div class="lbl">Late</div></div>' +
					'<div class="person-stat"><div class="val" style="color:var(--red)">' + s.absent + '</div><div class="lbl">Absent</div></div>' +
				'</div>' +
				'<div style="margin-top:12px;display:flex;align-items:center;gap:8px;font-size:12px">' +
					'<div style="flex:1;height:8px;background:var(--bg3);border-radius:4px;overflow:hidden">' +
						'<div style="height:100%;width:' + attendanceRate + '%;background:' + rateColor + ';border-radius:4px"></div>' +
					'</div>' +
					'<span style="font-weight:600;color:' + rateColor + '">' + attendanceRate + '%</span>' +
				'</div>' +
				'<div style="margin-top:8px;font-size:11px;color:var(--text2)">' +
					(s.late ? '⏰ ' + s.totalLateMin + ' min total late' + (avgLate ? ' (avg ' + avgLate + ' min)' : '') + ' · ' : '') +
					'📝 ' + s.excused + ' excused · ' + s.totalEvents + ' total events' +
				'</div>' +
			'</div>';
		});
		html += '</div>';
		content.innerHTML = html;
	}

	/* ═══════════════════════════════════════════
	   MODAL SYSTEM
	   ═══════════════════════════════════════════ */
	var modalSaveCb = null;

	function showModal(title, bodyHtml, footerHtml, saveCb) {
		$("#modal-title").textContent = title;
		$("#modal-body").innerHTML = bodyHtml;
		$("#modal-footer").innerHTML = footerHtml;
		modalSaveCb = saveCb;
		$("#modal-overlay").classList.add("open");

		var cancelBtn = $("#modal-cancel");
		if (cancelBtn) cancelBtn.onclick = closeModal;

		var saveBtn = $("#modal-save");
		if (saveBtn) saveBtn.onclick = function () {
			if (modalSaveCb) modalSaveCb();
		};

		// Close on overlay click
		$("#modal-overlay").onclick = function (e) {
			if (e.target === $("#modal-overlay")) closeModal();
		};

		// Close on Escape
		document.addEventListener("keydown", modalEscHandler);

		resize();
	}

	function modalEscHandler(e) {
		if (e.key === "Escape") { closeModal(); }
	}

	function closeModal() {
		$("#modal-overlay").classList.remove("open");
		modalSaveCb = null;
		document.removeEventListener("keydown", modalEscHandler);
		resize();
	}

	/* ═══════════════════════════════════════════
	   INITIALIZATION
	   ═══════════════════════════════════════════ */
	function render(val) {
		if (val && typeof val === "object" && !Array.isArray(val)) {
			DB = Object.assign({
				people: [],
				events: [],
				attendance: {},
				_theme: "light"
			}, val);
			if (!Array.isArray(DB.people)) DB.people = [];
			if (!Array.isArray(DB.events)) DB.events = [];
			if (!DB.attendance || typeof DB.attendance !== "object") DB.attendance = {};
		}
		if (DB._theme) applyTheme(DB._theme);
		updateNavBadges();
		renderCurrentPage();
		updateReadonlyUI();
		resize();
	}

	function syncFields(fields) {
		// React to sibling field changes if needed
	}

	function lockUI(ro) {
		isReadOnly = ro === true;
		updateReadonlyUI();
	}

	function updateReadonlyUI() {
		document.body.classList.toggle("readonly", isReadOnly);
	}

	/* ── Wire UI ── */
	function wireUI() {
		// Navigation
		$$(".nav-item").forEach(function (item) {
			item.onclick = function () { navigate(item.dataset.page); };
		});

		// Theme toggle
		var themeBtn = $("#theme-toggle");
		if (themeBtn) themeBtn.onclick = toggleTheme;

		// People
		var addPersonBtn = $("#btn-add-person"); if (addPersonBtn) addPersonBtn.onclick = function () { openPersonModal(); };
		var importBtn = $("#btn-import-people"); if (importBtn) importBtn.onclick = importPeople;
		var peopleSearch = $("#people-search"); if (peopleSearch) peopleSearch.addEventListener("input", function () { renderPeople(); });

		// Events
		var addEventBtn = $("#btn-add-event"); if (addEventBtn) addEventBtn.onclick = function () { openEventModal(); };
		var addSeriesBtn = $("#btn-add-series"); if (addSeriesBtn) addSeriesBtn.onclick = openSeriesModal;
		var eventsSearch = $("#events-search"); if (eventsSearch) eventsSearch.addEventListener("input", function () { renderEvents(); });
		var quickEventBtn = $("#btn-quick-event"); if (quickEventBtn) quickEventBtn.onclick = function () { openEventModal(); };

		// Calendar
		var calPrev = $("#cal-prev"); if (calPrev) calPrev.onclick = calNavigate.bind(null, -1);
		var calNext = $("#cal-next"); if (calNext) calNext.onclick = calNavigate.bind(null, 1);
		var calToday = $("#cal-today"); if (calToday) calToday.onclick = function () { calendarDate = new Date(); renderCalendar(); };

		$$(".cal-view-btn").forEach(function (btn) {
			btn.onclick = function () {
				calendarView = btn.dataset.view;
				$$(".cal-view-btn").forEach(function (b) { b.classList.remove("active"); });
				btn.classList.add("active");
				renderCalendar();
			};
		});

		// Drawer
		var drawerClose = $("#drawer-close"); if (drawerClose) drawerClose.onclick = closeDrawer;
		$("#drawer-overlay").onclick = function (e) {
			if (e.target === $("#drawer-overlay")) closeDrawer();
		};

		// Reports tabs
		$$(".report-tab").forEach(function (tab) {
			tab.onclick = function () {
				$$(".report-tab").forEach(function (t) { t.classList.remove("active"); });
				tab.classList.add("active");
				renderReportContent(tab.dataset.tab);
			};
		});

		// Export button
		var exportBtn = $("#btn-export-report"); if (exportBtn) exportBtn.onclick = exportReport;

		// Keyboard shortcut for drawer close
		document.addEventListener("keydown", function (e) {
			if (e.key === "Escape" && $("#drawer-overlay").classList.contains("open")) {
				closeDrawer();
			}
		});
	}

	function calNavigate(dir) {
		if (calendarView === "month") calendarDate.setMonth(calendarDate.getMonth() + dir);
		else if (calendarView === "week") calendarDate.setDate(calendarDate.getDate() + dir * 7);
		else if (calendarView === "day") calendarDate.setDate(calendarDate.getDate() + dir);
		renderCalendar();
	}

	function closeDrawer() {
		$("#drawer-overlay").classList.remove("open");
		currentEventId = null;
	}

	function importPeople() {
		var input = document.createElement("input");
		input.type = "file";
		input.accept = ".csv,.txt";
		input.onchange = function () {
			var file = input.files[0];
			if (!file) return;
			var reader = new FileReader();
			reader.onload = function () {
				var text = reader.result;
				var lines = text.split(/\r?\n/).filter(Boolean);
				var count = 0;
				lines.forEach(function (line) {
					var parts = line.split(/[,;\t]/).map(function (s) { return s.trim(); }).filter(Boolean);
					if (parts.length < 1) return;
					var name = parts[0];
					if (!name) return;
					// Avoid duplicates by name
					if (DB.people.some(function (p) { return p.name.toLowerCase() === name.toLowerCase(); })) return;
					DB.people.push({
						id: uid(),
						name: name,
						email: parts[1] || "",
						phone: parts[2] || "",
						group: parts[3] || ""
					});
					count++;
				});
				persist();
				renderPeople();
				notify("Imported " + count + " people", "success");
			};
			reader.readAsText(file);
		};
		input.click();
	}

	function exportReport() {
		var stats = getAttendanceStats();
		var csv = "Person,Group,Present,Late,Absent,Excused,Total Late Minutes,Total Events\n";
		Object.values(stats).forEach(function (s) {
			csv += [s.person.name, s.person.group || "", s.present, s.late, s.absent, s.excused, s.totalLateMin, s.totalEvents].map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(",") + "\n";
		});
		var blob = new Blob([csv], { type: "text/csv" });
		var url = URL.createObjectURL(blob);
		var a = document.createElement("a");
		a.href = url; a.download = "attendance-report-" + todayISO() + ".csv";
		document.body.appendChild(a); a.click(); document.body.removeChild(a);
		URL.revokeObjectURL(url);
		notify("Report exported as CSV", "success");
	}

	/* ── TOOL ENTRY POINT ── */
	tool.onReady(function (val, fields) {
		render(val);
		wireUI();
		if (tool.isReadOnly()) lockUI(true);

		tool.onValueChange(function (v) { render(v); });
		tool.onFieldsChange(function (f) { syncFields(f); });
		tool.onReadonlyChange(function (ro) { lockUI(ro); });

		tool.declareOutput({
			type: "object",
			properties: {
				people: { type: "array", items: { type: "object" } },
				events: { type: "array", items: { type: "object" } },
				attendance: { type: "object" },
				_theme: { type: "string", enum: ["light", "dark"] }
			}
		});

		tool.declareParams([
			{ name: "defaultView", label: "Default Calendar View", type: "select", default: "month", hint: "Which calendar view to show first", options: ["day", "week", "month"] }
		]);
	});

})();
