/* build 2026-10-05-3 */
/* ── SharedCal ─ Shared Calendar ──
   One shared calendar for every department: one-time + recurring
   events, location planning, and always-visible conflict flags.
   Built for the UniconHub CMS html-tool system. */
(function () {
	"use strict";

	var TOOL_BUILD = '2026-10-05-3';

	/* ── SDK handle + fallback shim ── */
	var tool = (typeof window !== "undefined" && window.tool) ? window.tool : null;
	if (!tool) {
		var _v = null;
		tool = {
			onReady: function (cb) { cb(_v, {}); }, getValue: function () { return _v; }, setValue: function (v) { _v = v; },
			onValueChange: function () { }, getFields: function () { return {}; }, watchField: function () { }, setField: function () { }, setFields: function () { }, onFieldsChange: function () { },
			param: function (n, d) { return d; }, isReadOnly: function () { return false; }, onReadonlyChange: function () { }, getUser: function () { return null; }, onUserChange: function () { },
			reportValid: function () { }, notify: function (m) { try { console.log("notify:", m); } catch (e) { } }, resize: function () { }, declareOutput: function () { }, declareParams: function () { },
			reportMissingParams: function () { }
		};
	}

	/* ── Helpers ── */
	function $(s, r) { return (r || document).querySelector(s); }
	function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
	function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
	function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
	function pad(n) { return String(n).padStart(2, "0"); }
	function notify(msg, sev) { try { tool.notify(msg, sev || "success"); } catch (e) { } }
	function resize() { try { tool.resize(); } catch (e) { } }

	/* ── Date helpers ── */
	function toISO(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
	function parseISO(s) { if (!s) return null; var p = String(s).split("-").map(Number); return new Date(p[0], (p[1] || 1) - 1, p[2] || 1); }
	function todayISO() { return toISO(new Date()); }
	function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
	function startOfWeek(d) { var x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
	function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
	function daysInMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }
	function addMonths(d, n) { var x = new Date(d.getFullYear(), d.getMonth() + n, 1); x.setDate(Math.min(d.getDate(), daysInMonth(x))); return x; }
	function addYears(d, n) { var x = new Date(d.getFullYear() + n, d.getMonth(), 1); x.setDate(Math.min(d.getDate(), daysInMonth(x))); return x; }
	function fmtDate(iso) { var d = parseISO(iso); if (!d || isNaN(d)) return "—"; return d.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" }); }
	function fmtDateShort(iso) { var d = parseISO(iso); if (!d || isNaN(d)) return "—"; return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
	function fmtTime(t) { if (!t) return ""; var p = t.split(":"); var h = parseInt(p[0], 10), m = p[1]; var ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return h + ":" + m + " " + ap; }
	function fmtRange(ev) {
		if (ev.allDay) return "All day";
		var s = fmtTime(ev.startTime) || "00:00 AM";
		var e = fmtTime(ev.endTime);
		return e ? s + " – " + e : s;
	}
	function normDate(x, fallback) {
		if (x instanceof Date) return isNaN(x) ? fallback : x;
		if (typeof x === "string" && x) { var d = parseISO(x); return (d && !isNaN(d)) ? d : fallback; }
		return fallback;
	}

	/* ── Constants ── */
	var CATEGORIES = ["Meeting", "Class", "Exam", "Deadline", "Holiday", "Workshop", "Event", "Maintenance", "Other"];
	var REPEATS = [
		{ v: "none", label: "Does not repeat" },
		{ v: "daily", label: "Daily" },
		{ v: "weekly", label: "Weekly" },
		{ v: "monthly", label: "Monthly" },
		{ v: "yearly", label: "Yearly" }
	];
	var DEPT_COLORS = ["#5b4bd6", "#0ea5e9", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#be185d", "#4f46e5", "#059669", "#e11d48", "#ca8a04"];
	var LOC_TYPES = ["Room", "Hall", "Lab", "Auditorium", "Outdoor", "Online", "Other"];

	/* ── State ── */
	var DB = {
		departments: [],
		locations: [],
		events: [],
		_theme: "light",
		_view: "month"
	};
	var currentPage = "calendar";
	var calDate = new Date();
	var calView = "month";
	var currentUser = null;
	var isReadOnly = false;
	var conflictKeySet = {};   // keys of occurrences currently in conflict (calendar range)
	var filteredOccs = [];     // occurrences currently shown in calendar

	/* ── Lookups ── */
	function deptById(id) { for (var i = 0; i < DB.departments.length; i++) if (DB.departments[i].id === id) return DB.departments[i]; return null; }
	function locById(id) { for (var i = 0; i < DB.locations.length; i++) if (DB.locations[i].id === id) return DB.locations[i]; return null; }
	function deptName(id) { var d = deptById(id); return d ? d.name : "No department"; }
	function deptColor(id) { var d = deptById(id); return d ? d.color : "#64748b"; }
	function locName(id) { var l = locById(id); return l ? l.name : "No location"; }

	/* ── Persistence ── */
	function persist() {
		try { tool.setValue(DB); } catch (e) { }
		updateNavBadges();
		try { tool.reportValid(true, ""); } catch (e) { }
		resize();
	}

	function updateNavBadges() {
		var cal = $("#nav-cal-count"); if (cal) cal.textContent = DB.events.length;
		var ev = $("#nav-events-count"); if (ev) ev.textContent = DB.events.length;
		var dp = $("#nav-dept-count"); if (dp) dp.textContent = DB.departments.length;
		var lc = $("#nav-loc-count"); if (lc) lc.textContent = DB.locations.length;
		var cf = $("#nav-conflict-count"); if (cf) {
			var c = computeConflicts(DB.events, todayISO(), toISO(addDays(new Date(), 365)));
			cf.textContent = c.length;
		}
	}

	/* ── Theme ── */
	function applyTheme(t) {
		DB._theme = t;
		document.documentElement.setAttribute("data-theme", t);
		var btn = $("#theme-toggle"); if (btn) btn.textContent = t === "dark" ? "☀️" : "🌙";
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
		var titles = { calendar: "Calendar", events: "Events", departments: "Departments", locations: "Locations", conflicts: "Conflicts" };
		var t = $("#page-title"); if (t) t.textContent = titles[page] || "Calendar";
		renderCurrentPage();
		resize();
	}

	function renderCurrentPage() {
		if (currentPage === "calendar") renderCalendar();
		else if (currentPage === "events") renderEvents();
		else if (currentPage === "departments") renderDepartments();
		else if (currentPage === "locations") renderLocations();
		else if (currentPage === "conflicts") renderConflicts();
	}

	/* ══════════════════════════════════════════════
	   RECURRENCE EXPANSION
	   ══════════════════════════════════════════════ */
	function expandEvent(ev, from, to) {
		from = normDate(from, new Date(2000, 0, 1));
		to = normDate(to, new Date(2100, 0, 1));
		var out = [];
		var start = parseISO(ev.date);
		if (!start || isNaN(start)) return out;
		var until = (ev.repeat !== "none" && ev.repeatUntil) ? parseISO(ev.repeatUntil) : null;
		var every = Math.max(1, parseInt(ev.repeatEvery, 10) || 1);
		var cur = new Date(start);
		var guard = 0;
		while (guard < 2000) {
			guard++;
			if (cur > to) break;
			if (ev.repeat !== "none" && until && cur > until) break;
			if (cur >= from) out.push({ event: ev, date: toISO(cur) });
			var nxt;
			if (ev.repeat === "daily") nxt = addDays(cur, every);
			else if (ev.repeat === "weekly") nxt = addDays(cur, every * 7);
			else if (ev.repeat === "monthly") nxt = addMonths(cur, every);
			else if (ev.repeat === "yearly") nxt = addYears(cur, every);
			else break;
			cur = nxt;
		}
		return out;
	}

	function occurrencesInRange(from, to, events) {
		var all = [];
		(events || DB.events).forEach(function (ev) {
			if (ev.status === "cancelled") return;
			all = all.concat(expandEvent(ev, from, to));
		});
		return all;
	}

	function occKey(o) { return o.event.id + "|" + o.date; }

	function timesOverlap(a, b) {
		if (a.event.allDay || b.event.allDay) return true;
		var as = a.event.startTime || "00:00", ae = a.event.endTime || "23:59";
		var bs = b.event.startTime || "00:00", be = b.event.endTime || "23:59";
		return as < be && bs < ae;
	}

	function computeConflicts(events, from, to) {
		var occs = occurrencesInRange(from, to, events);
		var byDate = {};
		occs.forEach(function (o) { (byDate[o.date] = byDate[o.date] || []).push(o); });
		var conflicts = [];
		var seen = {};
		Object.keys(byDate).sort().forEach(function (date) {
			var list = byDate[date];
			for (var i = 0; i < list.length; i++) {
				for (var j = i + 1; j < list.length; j++) {
					var a = list[i], b = list[j];
					if (!timesOverlap(a, b)) continue;
					var k = a.event.id + "|" + a.date + "|" + b.event.id + "|" + b.date;
					var rk = b.event.id + "|" + b.date + "|" + a.event.id + "|" + a.date;
					if (seen[k] || seen[rk]) continue;
					seen[k] = 1;
					var sameLoc = a.event.locationId && b.event.locationId && a.event.locationId === b.event.locationId;
					conflicts.push({ date: date, a: a, b: b, sameLoc: sameLoc });
				}
			}
		});
		return conflicts;
	}

	function applyCalendarFilters(occs) {
		var dept = $("#filter-dept") ? $("#filter-dept").value : "";
		var loc = $("#filter-location") ? $("#filter-location").value : "";
		var q = ($("#cal-search") ? $("#cal-search").value : "").toLowerCase();
		return occs.filter(function (o) {
			var ev = o.event;
			if (dept && ev.deptId !== dept) return false;
			if (loc && ev.locationId !== loc) return false;
			if (q) {
				var hay = (ev.title + " " + (ev.description || "") + " " + locName(ev.locationId) + " " + deptName(ev.deptId)).toLowerCase();
				if (hay.indexOf(q) === -1) return false;
			}
			return true;
		});
	}

	/* ══════════════════════════════════════════════
	   CALENDAR RENDERING
	   ══════════════════════════════════════════════ */
	function calRange() {
		var from, to;
		if (calView === "month") {
			from = startOfWeek(startOfMonth(calDate));
			to = addDays(from, 41);
		} else if (calView === "week") {
			from = startOfWeek(calDate);
			to = addDays(from, 6);
		} else {
			from = new Date(calDate);
			to = new Date(calDate);
		}
		return { from: from, to: to };
	}

	function renderCalendar() {
		renderCalendarLegend();
		renderFilterSelects();
		var title = $("#cal-title");
		if (calView === "month") title.textContent = calDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
		else if (calView === "week") {
			var r = calRange();
			title.textContent = r.from.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " – " + r.to.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
		} else title.textContent = calDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

		var range = calRange();
		var all = occurrencesInRange(range.from, range.to, DB.events);
		filteredOccs = applyCalendarFilters(all);
		var conflicts = computeConflicts(DB.events, range.from, range.to);
		conflictKeySet = {};
		conflicts.forEach(function (c) { conflictKeySet[occKey(c.a)] = 1; conflictKeySet[occKey(c.b)] = 1; });

		var container = $("#calendar-container");
		if (calView === "month") container.innerHTML = monthMarkup(range);
		else if (calView === "week") container.innerHTML = weekMarkup(range);
		else container.innerHTML = dayMarkup();
		wireCalendarEvents(container);
		resize();
	}

	function renderCalendarLegend() {
		var legend = $("#cal-legend");
		var chips = DB.departments.map(function (d) {
			return '<span class="legend-chip"><span class="legend-dot" style="background:' + esc(d.color) + '"></span>' + esc(d.name) + '</span>';
		}).join("");
		chips += '<span class="legend-note">⚠ outlined = conflicting</span>';
		legend.innerHTML = chips || '<span class="legend-note">Add departments to color-code the calendar</span>';
	}

	function renderFilterSelects() {
		var deptSel = $("#filter-dept");
		var cur = deptSel.value;
		deptSel.innerHTML = '<option value="">All departments</option>' + DB.departments.map(function (d) {
			return '<option value="' + esc(d.id) + '">' + esc(d.name) + '</option>';
		}).join("");
		if (cur && deptById(cur)) deptSel.value = cur;

		var locSel = $("#filter-location");
		var curL = locSel.value;
		locSel.innerHTML = '<option value="">All locations</option>' + DB.locations.map(function (l) {
			return '<option value="' + esc(l.id) + '">' + esc(l.name) + '</option>';
		}).join("");
		if (curL && locById(curL)) locSel.value = curL;

		// events page filter selects
		["events-dept", "events-category"].forEach(function (id) {
			var el = $("#" + id); if (!el) return;
			var c = el.value;
			if (id === "events-dept") {
				el.innerHTML = '<option value="">All departments</option>' + DB.departments.map(function (d) { return '<option value="' + esc(d.id) + '">' + esc(d.name) + '</option>'; }).join("");
				if (c && deptById(c)) el.value = c;
			} else {
				el.innerHTML = '<option value="">All categories</option>' + CATEGORIES.map(function (x) { return '<option value="' + esc(x) + '">' + esc(x) + '</option>'; }).join("");
				if (c && CATEGORIES.indexOf(c) > -1) el.value = c;
			}
		});
		var elL = $("#events-location"); if (elL) {
			var cL = elL.value;
			elL.innerHTML = '<option value="">All locations</option>' + DB.locations.map(function (l) { return '<option value="' + esc(l.id) + '">' + esc(l.name) + '</option>'; }).join("");
			if (cL && locById(cL)) elL.value = cL;
		}
	}

	function occsForDate(dateISO) {
		return filteredOccs.filter(function (o) { return o.date === dateISO; });
	}

	function chipHtml(o) {
		var ev = o.event;
		var conflicted = conflictKeySet[occKey(o)] ? true : false;
		var label = ev.allDay ? ev.title : (fmtTime(ev.startTime) ? fmtTime(ev.startTime) + " " : "") + ev.title;
		return '<div class="chip' + (conflicted ? ' chip-conflict' : '') + '" data-occ="' + esc(occKey(o)) + '" style="--c:' + esc(deptColor(ev.deptId)) + '" title="' + esc(ev.title + (ev.allDay ? "" : " · " + fmtRange(ev))) + '">' + (conflicted ? "⚠ " : "") + esc(label) + '</div>';
	}

	function monthMarkup(range) {
		var dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
		var html = '<div class="cal-grid">';
		dow.forEach(function (d) { html += '<div class="cal-dow">' + d + '</div>'; });
		var today = todayISO();
		for (var i = 0; i < 42; i++) {
			var d = addDays(range.from, i);
			var iso = toISO(d);
			var cls = "cal-cell";
			if (d.getMonth() !== calDate.getMonth()) cls += " other-month";
			if (iso === today) cls += " today";
			html += '<div class="' + cls + '" data-day="' + iso + '">';
			html += '<span class="cal-date">' + d.getDate() + '</span>';
			var occs = occsForDate(iso);
			occs.sort(function (a, b) {
				if (a.event.allDay && !b.event.allDay) return -1;
				if (!a.event.allDay && b.event.allDay) return 1;
				return (a.event.startTime || "00:00").localeCompare(b.event.startTime || "00:00");
			});
			html += '<div class="cal-chips">';
			for (var j = 0; j < Math.min(occs.length, 3); j++) html += chipHtml(occs[j]);
			if (occs.length > 3) html += '<div class="chip-more" data-day="' + iso + '">+' + (occs.length - 3) + ' more</div>';
			html += '</div></div>';
		}
		html += '</div>';
		return html;
	}

	function weekMarkup(range) {
		var dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
		var today = todayISO();
		var html = '<div class="cal-grid" style="grid-template-columns:repeat(7,1fr)">';
		for (var i = 0; i < 7; i++) {
			var d = addDays(range.from, i);
			var iso = toISO(d);
			var cls = "day-col" + (iso === today ? " today" : "");
			html += '<div class="' + cls + '" data-day="' + iso + '">';
			html += '<div class="day-head"><span class="day-dow">' + dow[i] + '</span>';
			html += '<span class="day-num' + (iso === today ? ' today-num' : '') + '">' + d.getDate() + '</span></div>';
			var occs = occsForDate(iso);
			occs.sort(function (a, b) {
				if (a.event.allDay && !b.event.allDay) return -1;
				if (!a.event.allDay && b.event.allDay) return 1;
				return (a.event.startTime || "00:00").localeCompare(b.event.startTime || "00:00");
			});
			occs.forEach(function (o) { html += evCardHtml(o); });
			if (!occs.length) html += '<div style="font-size:11px;color:var(--text3);text-align:center;padding:10px 0">—</div>';
			html += '</div>';
		}
		html += '</div>';
		return html;
	}

	function evCardHtml(o) {
		var ev = o.event;
		var conflicted = conflictKeySet[occKey(o)] ? true : false;
		var meta = [];
		if (!ev.allDay) meta.push(fmtRange(ev));
		if (ev.locationId) meta.push("📍 " + locName(ev.locationId));
		meta.push(deptName(ev.deptId));
		return '<div class="ev-card' + (conflicted ? ' conflict' : '') + '" data-occ="' + esc(occKey(o)) + '" style="--c:' + esc(deptColor(ev.deptId)) + '">' +
			'<div class="ec-title">' + (conflicted ? "⚠ " : "") + esc(ev.title) + '</div>' +
			'<div class="ec-meta">' + esc(meta.filter(Boolean).join(" · ")) + '</div>' +
			'</div>';
	}

	function dayMarkup() {
		var iso = toISO(calDate);
		var occs = occsForDate(iso);
		occs.sort(function (a, b) {
			if (a.event.allDay && !b.event.allDay) return -1;
			if (!a.event.allDay && b.event.allDay) return 1;
			return (a.event.startTime || "00:00").localeCompare(b.event.startTime || "00:00");
		});
		var html = '<div style="padding:14px">';
		html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">' + occs.map(function (o) { return evCardHtml(o); }).join("") + '</div>';
		if (!occs.length) html += '<div class="empty-state"><div class="empty-icon">📭</div><h3>Nothing scheduled</h3><p>No events on this day' + (locked() ? '.' : ' — add one with “New Event”.') + '</p></div>';
		html += '</div>';
		return html;
	}

	function wireCalendarEvents(container) {
		$$("[data-occ]", container).forEach(function (el) {
			el.onclick = function (e) {
				e.stopPropagation();
				var parts = el.dataset.occ.split("|");
				openEventDetail(parts[0], parts[1]);
			};
		});
		$$("[data-day]", container).forEach(function (cell) {
			cell.onclick = function () {
				var d = parseISO(cell.dataset.day);
				if (d) { calDate = d; calView = "day"; setViewButtons(); renderCalendar(); }
			};
		});
	}

	function setViewButtons() {
		$$(".cal-view-btn").forEach(function (b) { b.classList.toggle("active", b.dataset.view === calView); });
	}

	/* ══════════════════════════════════════════════
	   EVENTS LIST
	   ══════════════════════════════════════════════ */
	function renderEvents() {
		renderFilterSelects();
		var q = ($("#events-search") ? $("#events-search").value : "").toLowerCase();
		var dept = $("#events-dept") ? $("#events-dept").value : "";
		var loc = $("#events-location") ? $("#events-location").value : "";
		var cat = $("#events-category") ? $("#events-category").value : "";
		var kind = $("#events-kind") ? $("#events-kind").value : "all";

		var conflicts = computeConflicts(DB.events, todayISO(), toISO(addDays(new Date(), 365)));
		var conflictEventIds = {};
		conflicts.forEach(function (c) { conflictEventIds[c.a.event.id] = 1; conflictEventIds[c.b.event.id] = 1; });

		var list = DB.events.slice().filter(function (ev) {
			if (dept && ev.deptId !== dept) return false;
			if (loc && ev.locationId !== loc) return false;
			if (cat && ev.category !== cat) return false;
			if (kind === "once" && ev.repeat !== "none") return false;
			if (kind === "recur" && ev.repeat === "none") return false;
			if (q) {
				var hay = (ev.title + " " + (ev.description || "") + " " + locName(ev.locationId) + " " + deptName(ev.deptId) + " " + (ev.category || "")).toLowerCase();
				if (hay.indexOf(q) === -1) return false;
			}
			return true;
		});
		list.sort(function (a, b) { return (a.date || "").localeCompare(b.date || ""); });

		var box = $("#events-list");
		if (!DB.events.length) {
			box.innerHTML = '<div class="empty-state"><div class="empty-icon">🗓</div><h3>No events yet</h3><p>Start by adding a one-time or recurring entry to the shared calendar.</p>' + (locked() ? '' : '<button class="btn btn-primary" id="btn-add-event-empty">+ New Event</button>') + '</div>';
			var b = $("#btn-add-event-empty"); if (b) b.onclick = function () { openEventModal(null, todayISO()); };
			return;
		}
		if (!list.length) {
			box.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><h3>No matches</h3><p>Nothing matches the current filters.</p></div>';
			return;
		}
		box.innerHTML = list.map(function (ev) {
			var conflicted = conflictEventIds[ev.id] ? true : false;
			var d = parseISO(ev.date);
			return '<div class="event-row' + (conflicted ? ' conflict' : '') + '" data-id="' + ev.id + '">' +
				'<div class="event-color" style="--c:' + esc(deptColor(ev.deptId)) + '"></div>' +
				'<div class="event-datebox"><div class="eb-d">' + (d ? d.getDate() : "—") + '</div><div class="eb-m">' + (d ? d.toLocaleDateString("en-US", { month: "short" }) : "") + '</div></div>' +
				'<div class="event-main">' +
				'<div class="event-title">' + (conflicted ? "⚠ " : "") + esc(ev.title) + '</div>' +
				'<div class="event-sub">' +
				'<span class="badge badge-dept" style="--c:' + esc(deptColor(ev.deptId)) + '">' + esc(deptName(ev.deptId)) + '</span>' +
				(ev.repeat !== "none" ? '<span class="badge badge-recur">🔁 ' + esc(repeatLabel(ev)) + '</span>' : '') +
				(conflicted ? '<span class="badge badge-conflict">Conflict</span>' : '') +
				(ev.status === "cancelled" ? '<span class="badge badge-cancelled">Cancelled</span>' : '') +
				'<span>' + esc(fmtDateShort(ev.date)) + (ev.allDay ? " · All day" : (ev.startTime ? " · " + fmtRange(ev) : "")) + '</span>' +
				(ev.locationId ? '<span>📍 ' + esc(locName(ev.locationId)) + '</span>' : '') +
				'</div>' +
				'</div>' +
				'<div class="event-actions">' +
				(canEditEvent(ev) ? '<button class="btn btn-outline btn-sm ev-edit" data-id="' + ev.id + '">✏️</button>' : '') +
				(canEditEvent(ev) ? '<button class="btn btn-danger-soft btn-sm ev-del" data-id="' + ev.id + '">🗑</button>' : '') +
				'<button class="btn btn-ghost btn-sm ev-view" data-id="' + ev.id + '">👁</button>' +
				'</div>' +
				'</div>';
		}).join("");
		wireEventRows(box);
	}

	function repeatLabel(ev) {
		var map = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" };
		var every = parseInt(ev.repeatEvery, 10) || 1;
		return (every > 1 ? "Every " + every + " " : "") + (map[ev.repeat] || "Repeats").toLowerCase() + (ev.repeatUntil ? " until " + fmtDateShort(ev.repeatUntil) : "");
	}

	function wireEventRows(box) {
		$$(".ev-edit", box).forEach(function (b) { b.onclick = function () { openEventModal(b.dataset.id, null); }; });
		$$(".ev-del", box).forEach(function (b) { b.onclick = function () { deleteEvent(b.dataset.id); }; });
		$$(".ev-view", box).forEach(function (b) { b.onclick = function () { openEventDetail(b.dataset.id, null); }; });
	}

	/* ══════════════════════════════════════════════
	   DEPARTMENTS
	   ══════════════════════════════════════════════ */
	function renderDepartments() {
		var box = $("#departments-grid");
		if (!DB.departments.length) {
			box.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🏢</div><h3>No departments yet</h3><p>Add the departments that share this calendar.</p>' + (locked() ? '' : '<button class="btn btn-primary" id="btn-add-dept-empty">+ Add Department</button>') + '</div>';
			var b = $("#btn-add-dept-empty"); if (b) b.onclick = function () { openDepartmentModal(null); };
			return;
		}
		box.innerHTML = DB.departments.map(function (d) {
			var count = DB.events.filter(function (e) { return e.deptId === d.id; }).length;
			return '<div class="card" data-id="' + d.id + '">' +
				'<div class="card-swatch" style="--c:' + esc(d.color) + '"></div>' +
				'<div class="card-title">' + esc(d.name) + '</div>' +
				'<div class="card-meta">' + (d.head ? "Head: " + esc(d.head) + '<br>' : "") + (d.notes ? esc(d.notes) : "") + '</div>' +
				'<div class="card-stats"><span><b>' + count + '</b> events</span></div>' +
				(canWrite() ? '<div class="card-actions"><button class="btn btn-outline btn-sm dep-edit" data-id="' + d.id + '">✏️ Edit</button>' + (canDeleteShared() ? '<button class="btn btn-danger-soft btn-sm dep-del" data-id="' + d.id + '">🗑</button>' : '') + '</div>' : '') +
				'</div>';
		}).join("");
		$$(".dep-edit", box).forEach(function (b) { b.onclick = function () { openDepartmentModal(b.dataset.id); }; });
		$$(".dep-del", box).forEach(function (b) { b.onclick = function () { deleteDepartment(b.dataset.id); }; });
	}

	/* ══════════════════════════════════════════════
	   LOCATIONS
	   ══════════════════════════════════════════════ */
	function renderLocations() {
		var box = $("#locations-grid");
		if (!DB.locations.length) {
			box.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📍</div><h3>No locations yet</h3><p>Add rooms, halls and spaces for location planning.</p>' + (locked() ? '' : '<button class="btn btn-primary" id="btn-add-loc-empty">+ Add Location</button>') + '</div>';
			var b = $("#btn-add-loc-empty"); if (b) b.onclick = function () { openLocationModal(null); };
			return;
		}
		var upcoming = DB.events.filter(function (e) { return e.date >= todayISO() && e.status !== "cancelled"; }).length;
		box.innerHTML = DB.locations.map(function (l) {
			var count = DB.events.filter(function (e) { return e.locationId === l.id; }).length;
			return '<div class="card" data-id="' + l.id + '">' +
				'<div class="card-swatch" style="--c:var(--primary)"></div>' +
				'<div class="card-title">📍 ' + esc(l.name) + '</div>' +
				'<div class="card-meta">' + (l.type ? '<span class="badge" style="background:var(--primary-light);color:var(--primary)">' + esc(l.type) + '</span><br>' : "") + (l.capacity ? "Capacity: " + esc(l.capacity) + '<br>' : "") + (l.building ? "Building: " + esc(l.building) + '<br>' : "") + (l.notes ? esc(l.notes) : "") + '</div>' +
				'<div class="card-stats"><span><b>' + count + '</b> bookings</span></div>' +
				(canWrite() ? '<div class="card-actions"><button class="btn btn-outline btn-sm loc-edit" data-id="' + l.id + '">✏️ Edit</button>' + (canDeleteShared() ? '<button class="btn btn-danger-soft btn-sm loc-del" data-id="' + l.id + '">🗑</button>' : '') + '</div>' : '') +
				'</div>';
		}).join("");
		$$(".loc-edit", box).forEach(function (b) { b.onclick = function () { openLocationModal(b.dataset.id); }; });
		$$(".loc-del", box).forEach(function (b) { b.onclick = function () { deleteLocation(b.dataset.id); }; });
	}

	/* ══════════════════════════════════════════════
	   CONFLICTS REPORT
	   ══════════════════════════════════════════════ */
	function renderConflicts() {
		var box = $("#conflicts-list");
		var from = todayISO();
		var to = toISO(addDays(new Date(), 365));
		var conflicts = computeConflicts(DB.events, from, to);
		if (!conflicts.length) {
			box.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><h3>No conflicts</h3><p>No overlapping entries found in the next 12 months.</p></div>';
			return;
		}
		var groups = {};
		conflicts.forEach(function (c) { (groups[c.date] = groups[c.date] || []).push(c); });
		var html = "";
		Object.keys(groups).sort().forEach(function (date) {
			html += '<div class="conflict-group"><div class="conflict-date">' + esc(fmtDate(date)) + '</div>';
			groups[date].forEach(function (c) {
				html += '<div class="conflict-pair">' +
					'<span class="conflict-kind ' + (c.sameLoc ? 'loc' : 'time') + '">' + (c.sameLoc ? "📍 Double-booked" : "🕐 Time clash") + '</span>' +
					'<div class="conflict-ev"><div class="ce-title">' + esc(c.a.event.title) + '</div><div class="ce-meta">' + esc(deptName(c.a.event.deptId) + " · " + fmtRange(c.a.event) + (c.a.event.locationId ? " · " + locName(c.a.event.locationId) : "")) + '</div></div>' +
					'<span class="conflict-vs">VS</span>' +
					'<div class="conflict-ev"><div class="ce-title">' + esc(c.b.event.title) + '</div><div class="ce-meta">' + esc(deptName(c.b.event.deptId) + " · " + fmtRange(c.b.event) + (c.b.event.locationId ? " · " + locName(c.b.event.locationId) : "")) + '</div></div>' +
					'<button class="btn btn-ghost btn-sm cf-view" data-id="' + esc(c.a.event.id) + '" data-date="' + esc(c.a.date) + '">👁</button>' +
					'</div>';
			});
			html += '</div>';
		});
		box.innerHTML = html;
		$$(".cf-view", box).forEach(function (b) { b.onclick = function () { openEventDetail(b.dataset.id, b.dataset.date); }; });
	}

	/* ══════════════════════════════════════════════
	   MODAL PRIMITIVES
	   ══════════════════════════════════════════════ */
	function openModal(title, bodyHtml, footerHtml) {
		$("#modal-title").textContent = title;
		$("#modal-body").innerHTML = bodyHtml;
		$("#modal-footer").innerHTML = footerHtml || "";
		$("#modal-overlay").classList.add("open");
	}
	function closeModal() { $("#modal-overlay").classList.remove("open"); }
	function confirmFooter(confirmId, confirmLabel, cancelLabel, danger) {
		return '<button class="btn btn-ghost" id="modal-cancel">' + (cancelLabel || "Cancel") + '</button>' +
			'<button class="btn ' + (danger ? "btn-danger" : "btn-primary") + '" id="' + confirmId + '">' + confirmLabel + '</button>';
	}

	/* ══════════════════════════════════════════════
	   EVENT MODAL
	   ══════════════════════════════════════════════ */
	function eventById(id) { for (var i = 0; i < DB.events.length; i++) if (DB.events[i].id === id) return DB.events[i]; return null; }

	function openEventModal(id, presetDate, prefill) {
		var existing = id ? eventById(id) : null;
		var ev = prefill || existing;
		if (existing && !canEditEvent(existing)) { notify("You can only edit your own entries.", "warning"); return; }
		if (!existing && locked()) { notify("You do not have permission to add events.", "warning"); return; }

		var title = ev ? esc(ev.title) : "";
		var deptId = ev ? ev.deptId : (DB.departments[0] ? DB.departments[0].id : "");
		var locationId = ev ? (ev.locationId || "") : "";
		var category = ev ? (ev.category || "Meeting") : "Meeting";
		var date = ev ? ev.date : (presetDate || todayISO());
		var allDay = ev ? !!ev.allDay : false;
		var startTime = ev ? (ev.startTime || "09:00") : "09:00";
		var endTime = ev ? (ev.endTime || "10:00") : "10:00";
		var repeat = ev ? (ev.repeat || "none") : "none";
		var repeatEvery = ev ? (ev.repeatEvery || 1) : 1;
		var repeatUntil = ev ? (ev.repeatUntil || "") : "";
		var description = ev ? esc(ev.description || "") : "";
		var status = ev ? (ev.status || "active") : "active";

		var deptOptions = DB.departments.map(function (d) { return '<option value="' + esc(d.id) + '"' + (d.id === deptId ? " selected" : "") + '>' + esc(d.name) + '</option>'; }).join("");
		var locOptions = '<option value="">No location</option>' + DB.locations.map(function (l) { return '<option value="' + esc(l.id) + '"' + (l.id === locationId ? " selected" : "") + '>' + esc(l.name) + '</option>'; }).join("");
		var catOptions = CATEGORIES.map(function (c) { return '<option value="' + esc(c) + '"' + (c === category ? " selected" : "") + '>' + esc(c) + '</option>'; }).join("");
		var repOptions = REPEATS.map(function (r) { return '<option value="' + r.v + '"' + (r.v === repeat ? " selected" : "") + '>' + r.label + '</option>'; }).join("");

		var body =
			'<div class="form-grid">' +
			'<div class="form-field full"><label class="form-label">Title <span class="req">*</span></label><input type="text" class="text-input" id="f-title" value="' + title + '" placeholder="e.g. Midterm Exam — Biology 101"></div>' +
			'<div class="form-field"><label class="form-label">Department <span class="req">*</span></label><select class="select-input" id="f-dept">' + deptOptions + '</select></div>' +
			'<div class="form-field"><label class="form-label">Category</label><select class="select-input" id="f-category">' + catOptions + '</select></div>' +
			'<div class="form-field"><label class="form-label">Date <span class="req">*</span></label><input type="date" class="text-input" id="f-date" value="' + date + '"></div>' +
			'<div class="form-field"><label class="form-label">Location</label><select class="select-input" id="f-location">' + locOptions + '</select></div>' +
			'<div class="form-field full"><label class="check-row"><input type="checkbox" id="f-allday"' + (allDay ? " checked" : "") + '> All-day event</label></div>' +
			'<div class="form-field"><label class="form-label">Start time</label><input type="time" class="text-input" id="f-start" value="' + startTime + '"></div>' +
			'<div class="form-field"><label class="form-label">End time</label><input type="time" class="text-input" id="f-end" value="' + endTime + '"></div>' +
			'<div class="form-field"><label class="form-label">Repeats</label><select class="select-input" id="f-repeat">' + repOptions + '</select></div>' +
			'<div class="form-field"><label class="form-label">Repeat every (n)</label><input type="number" class="text-input" id="f-every" min="1" value="' + repeatEvery + '"></div>' +
			'<div class="form-field"><label class="form-label">Repeat until</label><input type="date" class="text-input" id="f-until" value="' + repeatUntil + '"></div>' +
			'<div class="form-field"><label class="form-label">Status</label><select class="select-input" id="f-status"><option value="active"' + (status === "active" ? " selected" : "") + '>Active</option><option value="cancelled"' + (status === "cancelled" ? " selected" : "") + '>Cancelled</option></select></div>' +
			'<div class="form-field full"><label class="form-label">Description / content</label><textarea class="textarea-input" id="f-desc" rows="3" placeholder="Agenda, notes, links…">' + description + '</textarea></div>' +
			'</div>' +
			(ev ? '<div class="owner-note">Created by ' + esc(ev.createdByName || "unknown") + (ev.updatedByName ? " · last edited by " + esc(ev.updatedByName) : "") + '</div>' : "");

		var footer = confirmFooter("f-save", existing ? "Save Changes" : "Add to Calendar", "Cancel", false);
		openModal(existing ? "Edit Event" : "New Event", body, footer);

		$("#f-save").onclick = function () { submitEventForm(existing); };
		$("#modal-cancel").onclick = closeModal;

		// toggle time fields with all-day
		var allDayCb = $("#f-allday");
		function syncTimeFields() {
			var off = allDayCb.checked;
			$("#f-start").disabled = off;
			$("#f-end").disabled = off;
			$("#f-start").closest(".form-field").style.opacity = off ? ".5" : "1";
			$("#f-end").closest(".form-field").style.opacity = off ? ".5" : "1";
		}
		allDayCb.onchange = syncTimeFields;
		syncTimeFields();
	}

	function submitEventForm(existing) {
		var title = ($("#f-title").value || "").trim();
		var deptId = $("#f-dept").value;
		var category = $("#f-category").value;
		var date = $("#f-date").value;
		var locationId = $("#f-location").value;
		var allDay = $("#f-allday").checked;
		var startTime = $("#f-start").value;
		var endTime = $("#f-end").value;
		var repeat = $("#f-repeat").value;
		var repeatEvery = parseInt($("#f-every").value, 10) || 1;
		var repeatUntil = $("#f-until").value;
		var description = $("#f-desc").value.trim();
		var status = $("#f-status").value;

		if (!title) { notify("Please enter a title.", "warning"); return; }
		if (!deptId) { notify("Please choose a department.", "warning"); return; }
		if (!date) { notify("Please choose a date.", "warning"); return; }
		if (!allDay && endTime && startTime && endTime <= startTime) { notify("End time must be after start time.", "warning"); return; }
		if (repeat !== "none" && repeatUntil && repeatUntil < date) { notify("Repeat-until must be after the start date.", "warning"); return; }

		var now = new Date();
		var stamp = { id: currentUser ? currentUser.id : "local", name: currentUser ? currentUser.name : "Local User" };

		var ev = {
			id: existing ? existing.id : uid(),
			title: title,
			deptId: deptId,
			locationId: locationId || null,
			category: category,
			date: date,
			allDay: allDay,
			startTime: allDay ? "" : (startTime || "09:00"),
			endTime: allDay ? "" : (endTime || "10:00"),
			repeat: repeat,
			repeatEvery: repeatEvery,
			repeatUntil: repeat !== "none" ? (repeatUntil || "") : "",
			description: description,
			status: status,
			createdBy: existing ? existing.createdBy : stamp.id,
			createdByName: existing ? existing.createdByName : stamp.name,
			updatedBy: stamp.id,
			updatedByName: stamp.name,
			updatedAt: now.toISOString()
		};

		// conflict check for the new/edited event
		var others = DB.events.filter(function (e) { return e.id !== ev.id && e.status !== "cancelled"; });
		var from = date < todayISO() ? date : todayISO();
		var to = toISO(addDays(parseISO(date), 420));
		var all = others.concat([ev]);
		var conflicts = computeConflicts(all, from, to).filter(function (c) {
			return c.a.event.id === ev.id || c.b.event.id === ev.id;
		});

		if (conflicts.length) {
			showConflictConfirm(ev, existing, conflicts);
		} else {
			saveEvent(ev, existing);
		}
	}

	function showConflictConfirm(ev, existing, conflicts) {
		var rows = conflicts.slice(0, 8).map(function (c) {
			var other = c.a.event.id === ev.id ? c.b : c.a;
			return '<div class="conflict-pair" style="border-top:1px dashed var(--border)">' +
				'<span class="conflict-kind ' + (c.sameLoc ? 'loc' : 'time') + '">' + (c.sameLoc ? "📍 Location clash" : "🕐 Time clash") + '</span>' +
				'<div class="conflict-ev"><div class="ce-title">' + esc(ev.title) + ' <span style="color:var(--text3)">(this event)</span></div><div class="ce-meta">' + esc(fmtDateShort(c.date) + " · " + fmtRange(ev) + (ev.locationId ? " · " + locName(ev.locationId) : "")) + '</div></div>' +
				'<span class="conflict-vs">VS</span>' +
				'<div class="conflict-ev"><div class="ce-title">' + esc(other.event.title) + '</div><div class="ce-meta">' + esc(fmtDateShort(other.date) + " · " + deptName(other.event.deptId) + " · " + fmtRange(other.event) + (other.event.locationId ? " · " + locName(other.event.locationId) : "")) + '</div></div>' +
				'</div>';
		}).join("");

		var body = '<div class="confirm-conflicts"><div class="cc-title">⚠ This event overlaps ' + conflicts.length + ' existing entr' + (conflicts.length === 1 ? "y" : "ies") + '.</div>' +
			'<div style="font-size:12px;color:var(--text2);margin-bottom:6px">Overlaps are allowed — if this is intentional, keep the event. It will stay visibly flagged for everyone.</div></div>' +
			'<div>' + rows + (conflicts.length > 8 ? '<div style="font-size:12px;color:var(--text3);margin-top:8px">…and ' + (conflicts.length - 8) + ' more</div>' : '') + '</div>';

		var footer = '<button class="btn btn-ghost" id="cc-back">Go Back &amp; Adjust</button>' +
			'<button class="btn btn-primary" id="cc-keep">Keep Event — It\'s Intentional</button>';

		openModal("Confirm Conflict", body, footer);
		$("#cc-back").onclick = function () { openEventModal(existing ? existing.id : null, ev.date, ev); };
		$("#cc-keep").onclick = function () { saveEvent(ev, existing); };
	}

	function saveEvent(ev, existing) {
		if (existing) {
			for (var i = 0; i < DB.events.length; i++) {
				if (DB.events[i].id === existing.id) { DB.events[i] = ev; break; }
			}
		} else {
			DB.events.push(ev);
		}
		persist();
		closeModal();
		renderCurrentPage();
		notify(existing ? "Event updated ✓" : "Event added ✓", "success");
	}

	function deleteEvent(id) {
		var ev = eventById(id);
		if (!ev) return;
		if (!canEditEvent(ev)) { notify("You can only delete your own entries.", "warning"); return; }
		openModal("Delete Event?",
			'<p style="font-size:14px">Delete <b>' + esc(ev.title) + '</b>? This cannot be undone.</p>',
			'<button class="btn btn-ghost" id="del-cancel">Cancel</button><button class="btn btn-danger" id="del-confirm">Delete</button>');
		$("#del-cancel").onclick = closeModal;
		$("#del-confirm").onclick = function () {
			DB.events = DB.events.filter(function (e) { return e.id !== id; });
			persist(); closeModal(); renderCurrentPage(); notify("Event deleted", "success");
		};
	}

	function openEventDetail(id, date) {
		var ev = eventById(id);
		if (!ev) return;
		var dept = deptById(ev.deptId);
		var body =
			'<div style="display:flex;gap:10px;align-items:center;margin-bottom:12px"><div style="width:10px;height:10px;border-radius:50%;background:' + esc(deptColor(ev.deptId)) + '"></div><b>' + esc(ev.title) + '</b></div>' +
			'<div style="display:grid;grid-template-columns:110px 1fr;gap:8px;font-size:13px">' +
			'<span style="color:var(--text3);font-weight:700">Department</span><span>' + esc(deptName(ev.deptId)) + '</span>' +
			'<span style="color:var(--text3);font-weight:700">Date</span><span>' + esc(fmtDate(ev.date)) + (ev.repeat !== "none" ? " · 🔁 " + esc(repeatLabel(ev)) : "") + '</span>' +
			'<span style="color:var(--text3);font-weight:700">Time</span><span>' + esc(fmtRange(ev)) + '</span>' +
			'<span style="color:var(--text3);font-weight:700">Location</span><span>' + (ev.locationId ? "📍 " + esc(locName(ev.locationId)) : "—") + '</span>' +
			'<span style="color:var(--text3);font-weight:700">Category</span><span>' + esc(ev.category || "—") + '</span>' +
			'<span style="color:var(--text3);font-weight:700">Status</span><span>' + (ev.status === "cancelled" ? "Cancelled" : "Active") + '</span>' +
			'<span style="color:var(--text3);font-weight:700">Created by</span><span>' + esc(ev.createdByName || "unknown") + '</span>' +
			(ev.description ? '<span style="color:var(--text3);font-weight:700">Details</span><span style="white-space:pre-wrap">' + esc(ev.description) + '</span>' : '') +
			'</div>';
		var footer = canEditEvent(ev)
			? '<button class="btn btn-outline" id="dt-edit">✏️ Edit</button><button class="btn btn-ghost" id="dt-close">Close</button>'
			: '<button class="btn btn-ghost" id="dt-close">Close</button>';
		openModal("Event Details", body, footer);
		$("#dt-close").onclick = closeModal;
		var ed = $("#dt-edit"); if (ed) ed.onclick = function () { openEventModal(ev.id, null); };
	}

	/* ══════════════════════════════════════════════
	   DEPARTMENT MODAL
	   ══════════════════════════════════════════════ */
	function openDepartmentModal(id) {
		var d = id ? deptById(id) : null;
		if (!canWrite()) { notify("You do not have permission to manage departments.", "warning"); return; }
		var name = d ? esc(d.name) : "";
		var color = d ? d.color : DEPT_COLORS[DB.departments.length % DEPT_COLORS.length];
		var head = d ? esc(d.head || "") : "";
		var notes = d ? esc(d.notes || "") : "";
		var swatches = DEPT_COLORS.map(function (c) {
			return '<span class="color-swatch' + (c === color ? " sel" : "") + '" data-color="' + c + '" style="background:' + c + '"></span>';
		}).join("");
		var body =
			'<div class="form-grid">' +
			'<div class="form-field full"><label class="form-label">Department name <span class="req">*</span></label><input type="text" class="text-input" id="d-name" value="' + name + '" placeholder="e.g. Fine Arts"></div>' +
			'<div class="form-field full"><label class="form-label">Color</label><div class="color-options" id="d-colors">' + swatches + '</div></div>' +
			'<div class="form-field"><label class="form-label">Department head</label><input type="text" class="text-input" id="d-head" value="' + head + '"></div>' +
			'<div class="form-field"><label class="form-label">Notes</label><input type="text" class="text-input" id="d-notes" value="' + notes + '"></div>' +
			'</div>';
		openModal(d ? "Edit Department" : "Add Department", body, confirmFooter("d-save", d ? "Save" : "Add", "Cancel", false));
		var selColor = color;
		$$("#d-colors .color-swatch").forEach(function (sw) {
			sw.onclick = function () {
				selColor = sw.dataset.color;
				$$("#d-colors .color-swatch").forEach(function (x) { x.classList.toggle("sel", x === sw); });
			};
		});
		$("#d-save").onclick = function () {
			var n = ($("#d-name").value || "").trim();
			if (!n) { notify("Please enter a name.", "warning"); return; }
			if (d) { d.name = n; d.color = selColor; d.head = $("#d-head").value.trim(); d.notes = $("#d-notes").value.trim(); }
			else DB.departments.push({ id: uid(), name: n, color: selColor, head: $("#d-head").value.trim(), notes: $("#d-notes").value.trim() });
			persist(); closeModal(); renderCurrentPage(); notify("Department saved ✓", "success");
		};
		$("#modal-cancel").onclick = closeModal;
	}

	function deleteDepartment(id) {
		var d = deptById(id);
		if (!d) return;
		if (!canDeleteShared()) { notify("Only admins can delete departments.", "warning"); return; }
		var count = DB.events.filter(function (e) { return e.deptId === id; }).length;
		openModal("Delete Department?",
			'<p style="font-size:14px">Delete <b>' + esc(d.name) + '</b>? ' + (count ? '<b>' + count + '</b> events belong to it and will keep this department name.' : "It has no events.") + '</p>',
			'<button class="btn btn-ghost" id="dd-cancel">Cancel</button><button class="btn btn-danger" id="dd-confirm">Delete</button>');
		$("#dd-cancel").onclick = closeModal;
		$("#dd-confirm").onclick = function () {
			DB.departments = DB.departments.filter(function (x) { return x.id !== id; });
			persist(); closeModal(); renderCurrentPage(); notify("Department deleted", "success");
		};
	}

	/* ══════════════════════════════════════════════
	   LOCATION MODAL
	   ══════════════════════════════════════════════ */
	function openLocationModal(id) {
		var l = id ? locById(id) : null;
		if (!canWrite()) { notify("You do not have permission to manage locations.", "warning"); return; }
		var name = l ? esc(l.name) : "";
		var type = l ? (l.type || "Room") : "Room";
		var capacity = l ? esc(l.capacity || "") : "";
		var building = l ? esc(l.building || "") : "";
		var notes = l ? esc(l.notes || "") : "";
		var typeOptions = LOC_TYPES.map(function (t) { return '<option value="' + t + '"' + (t === type ? " selected" : "") + '>' + t + '</option>'; }).join("");
		var body =
			'<div class="form-grid">' +
			'<div class="form-field full"><label class="form-label">Location name <span class="req">*</span></label><input type="text" class="text-input" id="l-name" value="' + name + '" placeholder="e.g. Main Hall"></div>' +
			'<div class="form-field"><label class="form-label">Type</label><select class="select-input" id="l-type">' + typeOptions + '</select></div>' +
			'<div class="form-field"><label class="form-label">Capacity</label><input type="number" class="text-input" id="l-cap" min="0" value="' + capacity + '" placeholder="e.g. 120"></div>' +
			'<div class="form-field"><label class="form-label">Building</label><input type="text" class="text-input" id="l-building" value="' + building + '"></div>' +
			'<div class="form-field"><label class="form-label">Notes</label><input type="text" class="text-input" id="l-notes" value="' + notes + '"></div>' +
			'</div>';
		openModal(l ? "Edit Location" : "Add Location", body, confirmFooter("l-save", l ? "Save" : "Add", "Cancel", false));
		$("#l-save").onclick = function () {
			var n = ($("#l-name").value || "").trim();
			if (!n) { notify("Please enter a name.", "warning"); return; }
			if (l) { l.name = n; l.type = $("#l-type").value; l.capacity = $("#l-cap").value; l.building = $("#l-building").value.trim(); l.notes = $("#l-notes").value.trim(); }
			else DB.locations.push({ id: uid(), name: n, type: $("#l-type").value, capacity: $("#l-cap").value, building: $("#l-building").value.trim(), notes: $("#l-notes").value.trim() });
			persist(); closeModal(); renderCurrentPage(); notify("Location saved ✓", "success");
		};
		$("#modal-cancel").onclick = closeModal;
	}

	function deleteLocation(id) {
		var l = locById(id);
		if (!l) return;
		if (!canDeleteShared()) { notify("Only admins can delete locations.", "warning"); return; }
		var count = DB.events.filter(function (e) { return e.locationId === id; }).length;
		openModal("Delete Location?",
			'<p style="font-size:14px">Delete <b>' + esc(l.name) + '</b>? ' + (count ? '<b>' + count + '</b> events reference it.' : "No events reference it.") + '</p>',
			'<button class="btn btn-ghost" id="ld-cancel">Cancel</button><button class="btn btn-danger" id="ld-confirm">Delete</button>');
		$("#ld-cancel").onclick = closeModal;
		$("#ld-confirm").onclick = function () {
			DB.locations = DB.locations.filter(function (x) { return x.id !== id; });
			DB.events.forEach(function (e) { if (e.locationId === id) e.locationId = null; });
			persist(); closeModal(); renderCurrentPage(); notify("Location deleted", "success");
		};
	}

	/* ══════════════════════════════════════════════
	   PERMISSIONS
	   ══════════════════════════════════════════════ */
	function roles() { return (currentUser && currentUser.roles) ? currentUser.roles : []; }
	function isAdmin() {
		var r = roles();
		return r.indexOf("admin") > -1 || r.indexOf("owner") > -1 || r.indexOf("developer") > -1 || r.indexOf("user-manager") > -1;
	}
	function canWrite() { return isAdmin() || roles().indexOf("editor") > -1; }
	function locked() { return isReadOnly || !canWrite(); }
	function canEditEvent(ev) {
		if (!canWrite()) return false;
		if (isAdmin()) return true;
		var uid2 = currentUser ? currentUser.id : null;
		return !ev.createdBy || ev.createdBy === uid2;
	}
	function canDeleteShared() { return isAdmin(); }

	function renderUserBadge() {
		var el = $("#sidebar-user");
		if (!el) return;
		var u = currentUser;
		if (!u) {
			el.innerHTML = '<div class="su-name">Not signed in</div><div class="su-role">viewer</div>';
			return;
		}
		var roleLabel = isAdmin() ? "Administrator" : (canWrite() ? "Editor" : "Viewer");
		var lock = isReadOnly ? '<span class="su-lock">🔒 Read-only</span>' : "";
		el.innerHTML = '<div class="su-name">' + esc(u.name || u.email || "User") + '</div><div class="su-role">' + roleLabel + '</div>' + lock;
	}

	function refreshPermissionUI() {
		renderUserBadge();
		// hide write-only chrome for locked users
		["#btn-add-event-top", "#btn-quick-event", "#btn-add-event", "#btn-add-department", "#btn-add-location"].forEach(function (sel) {
			var b = $(sel); if (b) b.style.display = locked() ? "none" : "";
		});
		renderCurrentPage();
	}

	/* ══════════════════════════════════════════════
	   EXPORT / PRINT
	   ══════════════════════════════════════════════ */
	function exportCSV() {
		if (!DB.events.length) { notify("Nothing to export yet.", "warning"); return; }
		var rows = [["Title", "Department", "Category", "Location", "Date", "Start", "End", "All day", "Repeats", "Repeat until", "Status", "Created by", "Description"]];
		DB.events.slice().sort(function (a, b) { return (a.date || "").localeCompare(b.date || ""); }).forEach(function (ev) {
			rows.push([
				ev.title, deptName(ev.deptId), ev.category || "", locName(ev.locationId),
				ev.date, ev.allDay ? "" : (ev.startTime || ""), ev.allDay ? "" : (ev.endTime || ""),
				ev.allDay ? "Yes" : "No", ev.repeat === "none" ? "" : repeatLabel(ev), ev.repeatUntil || "", ev.status || "active",
				ev.createdByName || "", ev.description || ""
			]);
		});
		var csv = rows.map(function (r) {
			return r.map(function (c) { return '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"'; }).join(",");
		}).join("\r\n");
		try {
			var blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
			var url = URL.createObjectURL(blob);
			var a = document.createElement("a");
			a.href = url; a.download = "academic-calendar-events.csv";
			document.body.appendChild(a); a.click();
			setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
			notify("CSV exported ✓", "success");
		} catch (e) { notify("Export failed in this browser.", "error"); }
	}

	function printView() {
		try { window.print(); } catch (e) { notify("Printing is not available here.", "warning"); }
	}

	/* ══════════════════════════════════════════════
	   WIRE-UP
	   ══════════════════════════════════════════════ */
	function wireStatic() {
		$$(".nav-item").forEach(function (n) { n.onclick = function () { navigate(n.dataset.page); }; });
		$("#btn-quick-event").onclick = function () { openEventModal(null, todayISO()); };
		$("#btn-add-event-top").onclick = function () { openEventModal(null, todayISO()); };
		$("#btn-add-event").onclick = function () { openEventModal(null, todayISO()); };
		$("#btn-add-department").onclick = function () { openDepartmentModal(null); };
		$("#btn-add-location").onclick = function () { openLocationModal(null); };
		$("#btn-refresh-conflicts").onclick = function () { renderConflicts(); notify("Conflicts refreshed", "info"); };
		$("#theme-toggle").onclick = toggleTheme;
		$("#btn-export").onclick = exportCSV;
		$("#btn-print").onclick = printView;
		$("#modal-close").onclick = closeModal;
		$("#modal-overlay").addEventListener("click", function (e) { if (e.target === this) closeModal(); });

		$("#cal-prev").onclick = function () { shiftCal(-1); };
		$("#cal-next").onclick = function () { shiftCal(1); };
		$("#cal-today").onclick = function () { calDate = new Date(); renderCalendar(); };
		$$(".cal-view-btn").forEach(function (b) { b.onclick = function () { calView = b.dataset.view; setViewButtons(); renderCalendar(); }; });

		// filters
		$("#filter-dept").onchange = renderCalendar;
		$("#filter-location").onchange = renderCalendar;
		var cs = $("#cal-search"); if (cs) cs.oninput = renderCalendar;
		$("#events-search").oninput = renderEvents;
		$("#events-dept").onchange = renderEvents;
		$("#events-location").onchange = renderEvents;
		$("#events-category").onchange = renderEvents;
		$("#events-kind").onchange = renderEvents;

		document.addEventListener("keydown", function (e) {
			if (!$("#modal-overlay").classList.contains("open")) return;
			if (e.key === "Escape") closeModal();
		});
	}

	function shiftCal(dir) {
		if (calView === "month") calDate = addMonths(calDate, dir);
		else if (calView === "week") calDate = addDays(calDate, dir * 7);
		else calDate = addDays(calDate, dir);
		renderCalendar();
	}

	/* ── Boot ── */
	tool.onReady(function (value) {
		console.log('[TOOL:BOOT] build ' + TOOL_BUILD + ' SharedCal starting...');
		if (value && typeof value === "object" && !Array.isArray(value)) {
			if (Array.isArray(value.departments)) DB.departments = value.departments;
			if (Array.isArray(value.locations)) DB.locations = value.locations;
			if (Array.isArray(value.events)) DB.events = value.events;
			if (value._theme === "dark" || value._theme === "light") DB._theme = value._theme;
			if (value._view === "month" || value._view === "week" || value._view === "day") { DB._view = value._view; calView = value._view; }
		}
		applyTheme(DB._theme);
		try { tool.declareParams([]); } catch (e) { }
		$("#build-badge").textContent = "tool build " + TOOL_BUILD;
		wireStatic();
		renderUserBadge();
		setViewButtons();
		navigate("calendar");
		persist();

		tool.onReadonlyChange(function (ro) { isReadOnly = !!ro; refreshPermissionUI(); });
		tool.onUserChange(function (u) { currentUser = u; refreshPermissionUI(); });
		tool.onValueChange(function (v) {
			if (v && typeof v === "object") {
				if (Array.isArray(v.departments)) DB.departments = v.departments;
				if (Array.isArray(v.locations)) DB.locations = v.locations;
				if (Array.isArray(v.events)) DB.events = v.events;
			}
			renderCurrentPage();
		});

		currentUser = tool.getUser();
		isReadOnly = tool.isReadOnly();
		refreshPermissionUI();
	});
})();
