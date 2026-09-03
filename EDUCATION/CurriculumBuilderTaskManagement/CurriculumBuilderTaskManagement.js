/* ── CurriculumBuilderTaskManagement ─────────────────
   Curriculum building task manager for the UniconHub CMS.
   Hierarchical task tree (sections / sub-sections / lessons / tasks),
   statuses, assignees, priorities, due dates, effort estimates,
   weighted completion percentage and team reporting.
   Everything persists through tool.setValue() — zero admin config.
────────────────────────────────────────────────────── */
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
			getPermittedUsers: function () { return []; }, onPermittedUsersChange: function () { },
			reportValid: function () { }, reportMissingParams: function () { }, notify: function (m) { try { console.log("notify:", m); } catch (e) { } }, resize: function () { },
			declareOutput: function () { }, declareParams: function () { }, requestSave: function (cb) { cb(null, false); },
			requestExportPdf: function (o, cb) { cb("not available", null); }, openUrl: function () { }
		};
	}

	/* ── Constants ── */
	var STATUSES = [
		{ id: "todo", label: "To do", icon: "⬜", color: "#94a3b8" },
		{ id: "progress", label: "In progress", icon: "🚧", color: "#f59e0b" },
		{ id: "review", label: "In review", icon: "🔍", color: "#8b5cf6" },
		{ id: "done", label: "Done", icon: "✅", color: "#10b981" },
		{ id: "blocked", label: "Blocked", icon: "🚫", color: "#ef4444" }
	];
	var AVATAR_COLORS = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#0891b2", "#d946ef", "#84cc16", "#f97316"];
	var STD_ICONS = [
		{ re: /lesson\s*plan|plan/i, icon: "📝" },
		{ re: /worksheet|sheet|handout|exercise/i, icon: "📄" },
		{ re: /quiz|test|exam|assessment/i, icon: "❓" },
		{ re: /answer|key|solution/i, icon: "🔑" },
		{ re: /presentation|slides/i, icon: "📽️" },
		{ re: /video|recording/i, icon: "🎬" },
		{ re: /activity|lab|experiment/i, icon: "🧪" },
		{ re: /homework|assignment/i, icon: "🏠" },
		{ re: /notes|summary/i, icon: "🗒️" },
		{ re: /review|feedback/i, icon: "🔍" }
	];
	function stdTaskIcon(t) {
		for (var i = 0; i < STD_ICONS.length; i++) if (STD_ICONS[i].re.test(String(t))) return STD_ICONS[i].icon;
		return "☑️";
	}

	/* ── Helpers ── */
	function $(s, r) { return (r || document).querySelector(s); }
	function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
	function el(id) { return document.getElementById(id); }
	function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
	function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
	function notify(msg, sev) { try { tool.notify(msg, sev || "success"); } catch (e) { } }
	function resize() { try { tool.resize(); } catch (e) { } }
	function clamp(n, a, b) { n = Number(n); if (isNaN(n)) return a; return Math.max(a, Math.min(b, n)); }
	function todayISO() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
	function parseISO(iso) { if (!iso) return null; var p = String(iso).split("-").map(Number); return new Date(p[0], (p[1] || 1) - 1, p[2] || 1); }
	function fmtShort(iso) { var d = parseISO(iso); if (!d || isNaN(d)) return "—"; return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
	function fmtLong(iso) { var d = parseISO(iso); if (!d || isNaN(d)) return "—"; return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }); }
	function daysUntil(iso) { var a = parseISO(todayISO()), b = parseISO(iso); if (!a || !b) return 0; return Math.round((b - a) / 86400000); }
	function initials(name) { var p = (name || "").trim().split(/\s+/).filter(Boolean); if (!p.length) return "?"; return ((p[0][0] || "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase(); }
	function statusById(id) { for (var i = 0; i < STATUSES.length; i++) if (STATUSES[i].id === id) return STATUSES[i]; return STATUSES[0]; }
	function validStatus(s) { for (var i = 0; i < STATUSES.length; i++) if (STATUSES[i].id === s) return s; return "todo"; }
	function statusCls(s) { return "st-" + (statusById(s).id); }
	function avatarColor(id) { var h = 0, s = String(id || "x"); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997; return AVATAR_COLORS[h % AVATAR_COLORS.length]; }
	function slugify(s) {
		try { s = String(s || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, ""); } catch (e) { }
		s = s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
		return s || "curriculum";
	}
	function downloadBlob(name, text, mime) {
		try {
			var blob = new Blob([text], { type: mime || "text/plain" });
			var url = URL.createObjectURL(blob);
			var a = document.createElement("a");
			a.href = url; a.download = name;
			document.body.appendChild(a); a.click();
			setTimeout(function () { URL.revokeObjectURL(url); if (a.parentNode) a.parentNode.removeChild(a); }, 800);
		} catch (e) { notify("Download failed: " + e.message, "error"); }
	}

	/* ── Params ── */
	var _inProgPct = 50, _reviewPct = 75;
	function loadParams() {
		_inProgPct = clamp(parseInt(tool.param("inProgressPercent", "50"), 10) || 50, 0, 100);
		_reviewPct = clamp(parseInt(tool.param("reviewPercent", "75"), 10) || 75, 0, 100);
	}
	function statusPercent(s) {
		if (s === "done") return 100;
		if (s === "review") return _reviewPct;
		if (s === "progress") return _inProgPct;
		return 0;
	}

	/* ── Data model ── */
	function normalizeNode(n) {
		n = n || {};
		return {
			id: String(n.id || uid()),
			title: String(n.title || "Untitled task"),
			status: validStatus(n.status),
			due: n.due ? String(n.due).slice(0, 10) : "",
			memberId: String(n.memberId || ""),
			notes: String(n.notes || ""),
			doneAt: n.doneAt || null,
			createdAt: n.createdAt || new Date().toISOString(),
			children: Array.isArray(n.children) ? n.children.map(normalizeNode) : []
		};
	}
	function normalizeDB(v) {
		var d = {
			version: 1,
			title: "My Curriculum",
			nodes: [],
			members: [],
			settings: { standardTasks: ["Lesson plan", "Worksheet", "Quiz"] },
			ui: { tab: "tasks", collapsed: [], gridCollapsed: [] }
		};
		if (v && typeof v === "object") {
			d.title = String(v.title || "") || (String(tool.param("defaultTitle", "") || "") || "My Curriculum");
			d.nodes = Array.isArray(v.nodes) ? v.nodes.map(normalizeNode) : [];
			d.members = Array.isArray(v.members) ? v.members.filter(function (m) { return m && m.id && m.source === "cms"; }).map(function (m) {
				return { id: String(m.id), name: String(m.name || m.id), email: String(m.email || ""), source: "cms" };
			}) : [];
			if (v.settings && Array.isArray(v.settings.standardTasks)) {
				d.settings.standardTasks = v.settings.standardTasks.map(function (s) { return String(s).trim(); }).filter(Boolean);
				if (!d.settings.standardTasks.length) d.settings.standardTasks = ["Lesson plan", "Worksheet", "Quiz"];
			}
			if (v.ui && typeof v.ui === "object") {
				d.ui.tab = (v.ui.tab === "grid" || v.ui.tab === "reports") ? v.ui.tab : "tasks";
				d.ui.collapsed = Array.isArray(v.ui.collapsed) ? v.ui.collapsed.map(String) : [];
				d.ui.gridCollapsed = Array.isArray(v.ui.gridCollapsed) ? v.ui.gridCollapsed.map(String) : [];
			}
		}
		// prune collapsed ids that no longer exist
		var valid = {};
		(function go(nodes) { nodes.forEach(function (n) { valid[n.id] = true; go(n.children || []); }); })(d.nodes);
		d.ui.collapsed = d.ui.collapsed.filter(function (id) { return valid[id]; });
		d.ui.gridCollapsed = d.ui.gridCollapsed.filter(function (id) { return valid[id]; });
		return d;
	}

	/* ── State ── */
	var DB = normalizeDB(null);
	var _readOnly = false;
	var _user = null;
	var _noIdentity = false;
	var _tab = "tasks";
	var _filters = { status: "", member: "" };
	var _lastStagedJson = null;
	var _saveTimer = null;
	var _nodeIndex = {};
	var _parentIndex = {};
	var _nodeStats = {};
	var _derivedStatus = {};
	var _stats = null;
	var _delTimers = {};
	var _dragId = null;
	var _inlineParent = "";
	var _inlineDraft = "";
	var _inlineStd = true;
	var _focusInline = false;
	var _editId = null;
	var _efDelArmed = false;
	var _gridPress = null;
	var _cellCycleAt = {};

	/* ── Identity / permissions ── */
	function hasUserApi() { return typeof tool.getUser === "function"; }
	function getUserSafe() { try { return hasUserApi() ? tool.getUser() : null; } catch (e) { return null; } }
	function canWrite() {
		if (_readOnly) return false;
		if (_noIdentity) return true;
		var u = _user;
		if (!u) return false;
		var roles = u.roles || [];
		for (var i = 0; i < roles.length; i++) {
			var r = roles[i];
			if (r === "editor" || r === "admin" || r === "owner" || r === "developer" || r === "user-manager") return true;
		}
		var ea = u.effectiveAccess;
		if (ea && (ea.isEditor || ea.isManager)) return true;
		return false;
	}
	function canAdmin() {
		if (_readOnly) return false;
		if (_noIdentity) return true;
		var u = _user;
		if (!u) return false;
		var roles = u.roles || [];
		for (var i = 0; i < roles.length; i++) {
			var r = roles[i];
			if (r === "admin" || r === "owner" || r === "developer" || r === "user-manager") return true;
		}
		var ea = u.effectiveAccess;
		if (ea && ea.isManager) return true;
		return false;
	}
	function refreshUser(tries) {
		var u = getUserSafe();
		if (u && u.id) { _user = u; renderAll(); return; }
		if (!hasUserApi()) { _noIdentity = true; renderAll(); return; }
		if (tries <= 0) { _noIdentity = true; renderAll(); return; }
		var delays = [0, 400, 800, 1600, 3200, 6000];
		setTimeout(function () { refreshUser(tries - 1); }, delays[6 - tries] || 6000);
	}

	/* ── Persistence ── */
	var _warnedAutosave = false;
	function persist() {
		var json = JSON.stringify(DB);
		if (json === _lastStagedJson) return;
		_lastStagedJson = json;
		try { tool.setValue(DB); } catch (e) { }
		try { tool.reportValid(true, ""); } catch (e) { }
		autoRequestSave();
	}
	function autoRequestSave() {
		if (typeof tool.requestSave !== "function") return;
		try {
			tool.requestSave(function (err, ok) {
				if ((err || !ok) && !_warnedAutosave) {
					_warnedAutosave = true;
					notify("Changes are stored in this record ✓ — automatic CMS save needs the allowRequestSave field setting", "info");
				}
			});
		} catch (e) { }
	}
	function scheduleSave() {
		if (_saveTimer) clearTimeout(_saveTimer);
		_saveTimer = setTimeout(persist, 500);
	}

	/* ── Undo ── */
	var _undoStack = [];
	var _suppressUndo = false;
	function pushUndo(label) {
		if (_suppressUndo) return;
		_undoStack.push({ json: JSON.stringify(DB), label: label });
		if (_undoStack.length > 12) _undoStack.shift();
		updateUndoBtn();
	}
	function undo() {
		var item = _undoStack.pop();
		if (!item) { notify("Nothing to undo", "info"); return; }
		DB = normalizeDB(JSON.parse(item.json));
		_lastStagedJson = null;
		persist();
		renderAll();
		notify("Undid: " + item.label, "info");
		updateUndoBtn();
	}
	function updateUndoBtn() {
		var b = el("btn-undo");
		if (!b) return;
		b.disabled = !canWrite() || !_undoStack.length;
		b.title = _undoStack.length ? ("Undo: " + _undoStack[_undoStack.length - 1].label) : "Nothing to undo";
	}

	/* ── Stats ── */
	function memberName(id) {
		if (!id) return "Unassigned";
		for (var i = 0; i < DB.members.length; i++) if (DB.members[i].id === id) return DB.members[i].name;
		return "Unknown";
	}
	function computeStats() {
		_nodeIndex = {}; _parentIndex = {}; _nodeStats = {};
		var totals = { nodes: 0, leaves: 0, done: 0, progress: 0, review: 0, blocked: 0, todo: 0, overdue: 0, dueToday: 0, wDone: 0, wTotal: 0 };
		var members = {};
		_derivedStatus = {};
		var roots = [];
		var overdue = [], upcoming = [];
		var today = todayISO();

		function mstat(mid) {
			if (!members[mid]) members[mid] = { mid: mid, name: memberName(mid), tasks: 0, done: 0, progress: 0, review: 0, blocked: 0, todo: 0, wDone: 0, wTotal: 0, pct: 0 };
			return members[mid];
		}

		function walk(n, parentRef) {
			_parentIndex[n.id] = parentRef;
			_nodeIndex[n.id] = n;
			totals.nodes++;
			var children = n.children || [];
			var st = { leaves: 0, done: 0, sDone: 0, sProgress: 0, sReview: 0, sBlocked: 0, sTodo: 0, wDone: 0, wTotal: 0, members: {} };
			if (!children.length) {
				totals.leaves++;
				var p = statusPercent(n.status);
				var w = 1;
				st.leaves = 1;
				if (n.status === "done") { totals.done++; st.done = 1; st.sDone = 1; }
				else if (n.status === "progress") { totals.progress++; st.sProgress = 1; }
				else if (n.status === "review") { totals.review++; st.sReview = 1; }
				else if (n.status === "blocked") { totals.blocked++; st.sBlocked = 1; }
				else { totals.todo++; st.sTodo = 1; }
				st.wDone = p / 100 * w; st.wTotal = w;
				totals.wDone += st.wDone; totals.wTotal += st.wTotal;
				var mid = n.memberId || "__none";
				var ms = mstat(mid);
				ms.tasks++;
				if (n.status === "done") ms.done++;
				else if (n.status === "progress") ms.progress++;
				else if (n.status === "review") ms.review++;
				else if (n.status === "blocked") ms.blocked++;
				else ms.todo++;
				ms.wDone += st.wDone; ms.wTotal += st.wTotal;
				st.members[mid] = true;
				if (n.due) {
					if (n.due === today && n.status !== "done") totals.dueToday++;
					if (n.due < today && n.status !== "done") { totals.overdue++; overdue.push({ node: n, path: pathOf(n.id) }); }
					else if (n.due >= today && n.status !== "done") upcoming.push({ node: n, path: pathOf(n.id) });
				}
			} else {
				children.forEach(function (c) {
					var cst = walk(c, n);
					st.leaves += cst.leaves; st.done += cst.done;
					st.sDone += cst.sDone; st.sProgress += cst.sProgress; st.sReview += cst.sReview; st.sBlocked += cst.sBlocked; st.sTodo += cst.sTodo;
					st.wDone += cst.wDone; st.wTotal += cst.wTotal;
					for (var k in cst.members) st.members[k] = true;
				});
				var dr;
				if (st.sDone === st.leaves) dr = "done";
				else if (st.sReview > 0 && st.sProgress === 0 && st.sTodo === 0 && st.sBlocked === 0) dr = "review";
				else if (st.sDone + st.sProgress + st.sReview > 0) dr = "progress";
				else if (st.sBlocked > 0) dr = "blocked";
				else dr = "todo";
				_derivedStatus[n.id] = dr;
			}
			var pct = st.wTotal > 0 ? Math.round(st.wDone / st.wTotal * 100) : 0;
			_nodeStats[n.id] = { leaves: st.leaves, done: st.done, pct: pct, members: st.members };
			return st;
		}

		(DB.nodes || []).forEach(function (n) { roots.push({ node: n, st: walk(n, "root") }); });

		var memberList = [];
		for (var k in members) { var m = members[k]; m.pct = m.wTotal > 0 ? Math.round(m.wDone / m.wTotal * 100) : 0; memberList.push(m); }
		memberList.sort(function (a, b) { return b.pct - a.pct || (a.name || "").localeCompare(b.name || ""); });

		overdue.sort(function (a, b) { return a.node.due < b.node.due ? -1 : 1; });
		upcoming.sort(function (a, b) { return a.node.due < b.node.due ? -1 : 1; });

		var pct = totals.wTotal > 0 ? Math.round(totals.wDone / totals.wTotal * 100) : 0;
		_stats = { totals: totals, members: memberList, roots: roots, overdue: overdue, upcoming: upcoming, pct: pct };
		return _stats;
	}
	function effStatus(n) {
		if (!n || !(n.children || []).length) return n ? n.status : "todo";
		return _derivedStatus[n.id] || "todo";
	}
	function isOverdueLeaf(n) {
		if ((n.children || []).length) return false;
		return !!n.due && n.due < todayISO() && n.status !== "done";
	}
	function pathOf(id) {
		var parts = [];
		var cur = _nodeIndex[id];
		var up = _parentIndex[id];
		while (up && up !== "root") { parts.unshift(up.title); var nid = up.id; up = _parentIndex[nid]; }
		var s = parts.join(" / ");
		if (s.length > 70) s = "…" + s.slice(s.length - 67);
		return s;
	}
	function isDescendant(anc, node) {
		if (!anc || !node) return false;
		var cur = node;
		for (var i = 0; i < 200; i++) {
			var p = _parentIndex[cur.id];
			if (!p || p === "root") return false;
			if (p === anc || p.id === anc.id) return true;
			cur = p;
		}
		return false;
	}
	function flatList() {
		var out = [];
		(function go(nodes) { nodes.forEach(function (n) { out.push(n); go(n.children || []); }); })(DB.nodes);
		return out;
	}
	function subtreeCount(n) {
		var c = 1;
		(n.children || []).forEach(function (k) { c += subtreeCount(k); });
		return c;
	}

	/* ── Mutations ── */
	function makeNode(title) {
		return { id: uid(), title: title, status: "todo", due: "", memberId: "", notes: "", doneAt: null, createdAt: new Date().toISOString(), children: [] };
	}
	function standardTasks() {
		return (DB.settings.standardTasks && DB.settings.standardTasks.length) ? DB.settings.standardTasks : [];
	}
	function addTasks(parentId, raw, withStd) {
		var titles = String(raw || "").split(/[;\n]+/).map(function (t) { return t.trim(); }).filter(Boolean);
		if (!titles.length) return 0;
		computeStats();
		var list = null;
		if (parentId) {
			var p = _nodeIndex[parentId];
			if (p && isStdTaskLeaf(p)) { notify("Tasks are the smallest unit — they can't contain sub-items", "warning"); return 0; }
			if (p) { if (!p.children) p.children = []; list = p.children; }
		}
		else list = DB.nodes;
		if (!list) return 0;
		var std = withStd ? standardTasks() : [];
		pushUndo(titles.length > 1 ? "Add " + titles.length + " tasks" : "Add task");
		titles.forEach(function (t) {
			var parts = t.split(/\s*>\s*/).map(function (s) { return s.trim(); }).filter(Boolean);
			if (!parts.length) return;
			var top = makeNode(parts[0]);
			var cur = top;
			for (var i = 1; i < parts.length; i++) { var child = makeNode(parts[i]); cur.children.push(child); cur = child; }
			if (std.length) top.children = top.children.concat(std.map(makeNode));
			list.push(top);
		});
		renderAll(); scheduleSave();
		return titles.length;
	}
	function addSection() {
		pushUndo("Add section");
		DB.nodes.push(makeNode("New section"));
		renderAll(); scheduleSave();
		openEditModal(DB.nodes[DB.nodes.length - 1].id);
	}
	function appendStdTasks(id) {
		var n = _nodeIndex[id];
		if (!n) return;
		if (isStdTaskLeaf(n)) return;
		if (!standardTasks().length) { openStdTasksModal(); return; }
		pushUndo("Add standard tasks");
		if (!n.children) n.children = [];
		standardTasks().forEach(function (t) { n.children.push(makeNode(t)); });
		renderAll(); scheduleSave();
		notify("Standard tasks added under " + n.title, "success");
	}
	function assignAllTo(id, mid) {
		var n = _nodeIndex[id];
		if (!n) return;
		pushUndo("Assign branch");
		(function go(x) {
			if (!(x.children || []).length) x.memberId = mid === "__none" ? "" : mid;
			(x.children || []).forEach(go);
		})(n);
		renderAll(); scheduleSave();
	}
	function openAssignAllModal(id) {
		computeStats();
		var n = _nodeIndex[id];
		if (!n) return;
		var html = '<div class="cbt-field"><label>Assign every task under “' + esc(n.title) + '” to</label><select id="aa-member">';
		html += '<option value="__none">Unassigned</option>';
		DB.members.forEach(function (m) { html += '<option value="' + m.id + '">' + esc(m.name) + "</option>"; });
		if (!DB.members.length) html += '<option value="" disabled>No team members — grant CMS access to this record</option>';
		html += '</select></div>';
		html += '<div class="cbt-modal-foot"><button class="cbt-btn cbt-btn-ghost" id="btn-aa-cancel">Cancel</button><button class="cbt-btn cbt-btn-primary" id="btn-aa-apply">👤 Assign all</button></div>';
		openModal("👤 Assign whole branch", html, function () {
			var c = el("btn-aa-cancel");
			if (c) c.onclick = closeModal;
			var a = el("btn-aa-apply");
			if (a) a.onclick = function () {
				var m = el("aa-member");
				if (!m) return;
				closeModal();
				assignAllTo(id, m.value);
				notify("All tasks under this branch reassigned", "success");
			};
		});
	}
	function cloneNode(x) {
		var c = { id: uid(), title: x.title, status: x.status, due: x.due, memberId: x.memberId, notes: x.notes, doneAt: x.doneAt, createdAt: new Date().toISOString(), children: (x.children || []).map(cloneNode) };
		return c;
	}
	function duplicateNode(id) {
		var n = _nodeIndex[id];
		if (!n) return;
		pushUndo("Duplicate task");
		var clone = cloneNode(n);
		var p = _parentIndex[id];
		var list = (!p || p === "root") ? DB.nodes : (p.children || []);
		var i = list.indexOf(n);
		list.splice(i + 1, 0, clone);
		renderAll(); scheduleSave();
		notify("Duplicated: " + n.title, "success");
	}
	function deleteNode(id) {
		var n = _nodeIndex[id];
		if (!n) return;
		pushUndo("Delete task");
		var list = null;
		var p = _parentIndex[id];
		if (!p || p === "root") list = DB.nodes; else list = p.children || [];
		var idx = list.indexOf(n);
		if (idx > -1) list.splice(idx, 1);
		if (DB.ui.collapsed.indexOf(id) > -1) DB.ui.collapsed.splice(DB.ui.collapsed.indexOf(id), 1);
		if (_editId === id) closeModal();
		renderAll(); scheduleSave();
		notify("Task deleted", "info");
	}
	function applyStatus(id, st) {
		var n = _nodeIndex[id];
		if (!n || !statusById(st)) return;
		if ((n.children || []).length) return; // parents derive their status from their tasks
		pushUndo("Status change");
		n.status = st;
		n.doneAt = st === "done" ? (n.doneAt || new Date().toISOString()) : null;
		renderAll(); scheduleSave();
	}
	function setAssignee(id, mid) {
		var n = _nodeIndex[id];
		if (!n) return;
		pushUndo("Assignment change");
		n.memberId = mid === "__none" ? "" : mid;
		renderAll(); scheduleSave();
	}
	function cyclePriority(id) {
		/* priorities removed */
	}
	function moveNodeUpDown(id, dir) {
		var n = _nodeIndex[id];
		if (!n) return;
		var p = _parentIndex[id];
		var list = (!p || p === "root") ? DB.nodes : (p.children || []);
		var i = list.indexOf(n);
		var j = i + dir;
		if (i < 0 || j < 0 || j >= list.length) return;
		pushUndo("Reorder");
		list.splice(i, 1); list.splice(j, 0, n);
		renderAll(); scheduleSave();
	}
	function insertRelative(dragId, targetId, before) {
		var dn = _nodeIndex[dragId], tn = _nodeIndex[targetId];
		if (!dn || !tn || dn === tn) return;
		if (isDescendant(dn, tn)) return;
		pushUndo("Reorder");
		var dp = _parentIndex[dragId];
		var dlist = (!dp || dp === "root") ? DB.nodes : (dp.children || []);
		dlist.splice(dlist.indexOf(dn), 1);
		var tp = _parentIndex[targetId];
		var list = (!tp || tp === "root") ? DB.nodes : (tp.children || []);
		var ti = list.indexOf(tn);
		if (ti < 0) { list.push(dn); return; }
		list.splice(before ? ti : ti + 1, 0, dn);
	}
	function moveToParent(id, newParentId) {
		computeStats();
		var n = _nodeIndex[id];
		if (!n) return false;
		if (newParentId === id) return false;
		var p = _parentIndex[id];
		var curId = (!p || p === "root") ? "" : p.id;
		if (newParentId === curId) return false; // same parent — keep position untouched
		if (newParentId) {
			var np = _nodeIndex[newParentId];
			if (!np) return false;
			if (isStdTaskLeaf(np)) return false;
			if (isDescendant(n, np)) return false;
		}
		pushUndo("Move task");
		var oldList = (!p || p === "root") ? DB.nodes : (p.children || []);
		var i = oldList.indexOf(n);
		if (i > -1) oldList.splice(i, 1);
		if (newParentId) {
			np = _nodeIndex[newParentId];
			if (!np.children) np.children = [];
			np.children.push(n);
		} else {
			DB.nodes.push(n);
		}
		return true;
	}
	function toggleCollapsed(id) {
		var i = DB.ui.collapsed.indexOf(id);
		if (i > -1) DB.ui.collapsed.splice(i, 1); else DB.ui.collapsed.push(id);
		scheduleSave();
		renderTree();
	}
	function expandAll(collapse) {
		if (collapse) {
			var all = flatList();
			DB.ui.collapsed = all.filter(function (n) { return (n.children || []).length; }).map(function (n) { return n.id; });
		} else {
			DB.ui.collapsed = [];
		}
		scheduleSave();
		renderTree();
	}

	/* ── Team ── */
	function syncPermittedUsers() {
		var list = [];
		try { if (typeof tool.getPermittedUsers === "function") list = tool.getPermittedUsers() || []; } catch (e) { }
		var changed = false;
		list.forEach(function (u) {
			if (!u || !u.id) return;
			var found = null;
			DB.members.forEach(function (m) { if (m.id === u.id) found = m; });
			var name = u.name || u.email || u.id;
			if (!found) { DB.members.push({ id: String(u.id), name: name, email: u.email || "", source: "cms" }); changed = true; }
			else {
				if (!found.name && name) { found.name = name; changed = true; }
				if (!found.email && u.email) { found.email = u.email; changed = true; }
				if (!found.source) { found.source = "cms"; changed = true; }
			}
		});
		if (changed) { renderAll(); scheduleSave(); }
	}

	/* ═══════════════════════════════════════════════
	   RENDERING
	   ═══════════════════════════════════════════════ */
	function renderAll() {
		computeStats();
		renderStats();
		renderToolbar();
		updateTabUI();
		if (_tab === "grid") renderGrid();
		else if (_tab === "reports") renderReports();
		else renderTree();
		ensureRoBanner();
		resize();
	}

	function renderStats() {
		var box = el("cbt-stats");
		if (!box) return;
		var t = _stats ? _stats.totals : { leaves: 0, done: 0, progress: 0, review: 0, blocked: 0, overdue: 0, dueToday: 0 };
		var pct = _stats ? _stats.pct : 0;
		function chip(dot, label, val) {
			return '<div class="cbt-stat"><span class="cbt-stat-label"><span class="cbt-dot" style="background:' + dot + '"></span>' + label + "</span><b>" + val + "</b></div>";
		}
		box.innerHTML =
			'<div class="cbt-stat cbt-stat-ring"><div class="cbt-ring" style="--p:' + pct + ';--rc:' + (pct === 100 ? "#10b981" : "#4f46e5") + '"><span>' + pct + '%</span></div><div class="cbt-stat-label">Complete</div></div>' +
			chip("#4f46e5", "Tasks", t.leaves) +
			chip("#10b981", "Done", t.done) +
			chip("#f59e0b", "In progress", t.progress) +
			chip("#8b5cf6", "In review", t.review);
	}

	function indentHtml(depth) { return new Array(depth * 2 + 1).join("&nbsp;"); }
	function memberFilterOptionsHtml(sel) {
		var out = '<option value="">👥 Everyone</option>';
		if (_user && _user.id) out += '<option value="me"' + (sel === "me" ? ' selected' : '') + '>🙋 My tasks</option>';
		out += '<option value="none"' + (sel === "none" ? ' selected' : '') + '>🕳 Unassigned</option>';
		DB.members.forEach(function (m) { out += '<option value="' + m.id + '"' + (sel === m.id ? ' selected' : '') + '>' + esc(m.name) + '</option>'; });
		return out;
	}
	function renderToolbar() {
		var fm = el("cbt-filter-member");
		if (fm) fm.innerHTML = memberFilterOptionsHtml(_filters.member);
		var fs = el("cbt-filter-status");
		if (fs) fs.value = _filters.status;
		var ob = el("btn-only-overdue");
		if (ob) ob.classList.toggle("cbt-on", !!_filters.overdue);
		updateUndoBtn();
	}

	function updateTabUI() {
		$$(".cbt-tab").forEach(function (t) { t.classList.toggle("active", t.getAttribute("data-tab") === _tab); });
		["tasks", "grid", "reports"].forEach(function (p) {
			var pane = el("pane-" + p);
			if (pane) pane.classList.toggle("active", p === _tab);
		});
	}
	function switchTab(tab) {
		_tab = tab;
		DB.ui.tab = tab;
		updateTabUI();
		if (tab === "grid") renderGrid();
		else if (tab === "reports") renderReports();
		else renderTree();
		scheduleSave();
		resize();
	}

	/* ── Tree ── */
	function matchSelf(n, f) {
		if (f.q) { var t = (n.title + " " + (n.notes || "")).toLowerCase(); if (t.indexOf(f.q) === -1) return false; }
		if (f.status && effStatus(n) !== f.status) return false;
		if (f.overdue && !isOverdueLeaf(n)) return false;
		if (f.member) {
			var want = f.member === "me" ? (_user ? _user.id : "__nobody__") : (f.member === "none" ? "" : f.member);
			if (n.memberId !== want) return false;
		}
		return true;
	}
	function statusSelectHtml(n, canW) {
		var out = '<select class="cbt-status-sel ' + statusCls(n.status) + '" data-act="status"' + (canW ? "" : " disabled") + ' title="Status">';
		STATUSES.forEach(function (s) { out += '<option value="' + s.id + '"' + (n.status === s.id ? " selected" : "") + '>' + s.icon + " " + s.label + "</option>"; });
		return out + "</select>";
	}
	function assignSelectHtml(n, canW) {
		var out = '<select class="cbt-asgn" data-act="assign"' + (canW ? "" : " disabled") + ' title="Assignee">';
		out += '<option value="__none"' + (!n.memberId ? " selected" : "") + ">Unassigned</option>";
		DB.members.forEach(function (m) {
			var label = m.name.length > 18 ? m.name.slice(0, 17) + "…" : m.name;
			out += '<option value="' + m.id + '"' + (n.memberId === m.id ? " selected" : "") + ">" + esc(label) + "</option>";
		});
		if (!DB.members.length) out += '<option value="" disabled>No team members — grant CMS access to this record</option>';
		return out + "</select>";
	}
	function dueChipHtml(n) {
		if (!n.due) return "";
		var d = daysUntil(n.due);
		var cls = "cbt-due";
		var title = "Due: " + fmtLong(n.due);
		if (n.status === "done") { /* no urgency */ }
		else if (d < 0) { cls += " cbt-overdue"; title += " — overdue by " + (-d) + " day" + (d === -1 ? "" : "s") + "!"; }
		else if (d === 0) { cls += " cbt-today"; title += " — due today"; }
		else if (d <= 3) { cls += " cbt-soon"; title += " — due in " + d + " days"; }
		var label = (d < 0 && n.status !== "done" ? "⚠ " : "📅 ") + fmtShort(n.due);
		return '<span class="cbt-chip ' + cls + '" data-act="edit" title="' + esc(title) + '">' + label + "</span>";
	}
	function derivedPillHtml(n) {
		var s = statusById(effStatus(n));
		return '<span class="cbt-derived st-' + s.id + '" data-act="edit" title="Derived from its tasks — click for details">' + s.icon + " " + s.label + "</span>";
	}
	function nodeKind(n, depth) {
		var kids = n.children || [];
		if (!kids.length) return "task";
		if (kids.every(function (c) { return !(c.children || []).length; })) return "lesson";
		return depth === 0 ? "section" : "subsection";
	}
	function isStdTaskLeaf(n) {
		if (!n || (n.children || []).length) return false;
		var p = _parentIndex[n.id];
		if (!p || p === "root") return false;
		var kids = p.children || [];
		return kids.length > 0 && kids.every(function (c) { return !(c.children || []).length; });
	}
	function rowHtml(n, depth, hasKids, collapsed, st) {
		var canW = canWrite();
		var pct = st.pct || 0;
		var eff = effStatus(n);
		var doneCls = !hasKids && eff === "done";
		var kind = nodeKind(n, depth);
		var ico = kind === "section" ? "📁" : kind === "subsection" ? "📂" : kind === "lesson" ? "📖" : (eff === "done" ? "✅" : "▫");
		var rowCls = "cbt-row" + (depth === 0 ? " cbt-row-root" : "") + (isOverdueLeaf(n) ? " cbt-row-overdue" : "");
		var stdLeaf = isStdTaskLeaf(n);
		var html = '<div class="' + rowCls + '" data-id="' + n.id + '" draggable="' + (canW ? "true" : "false") + '">';
		if (canW && !stdLeaf) html += '<span class="cbt-grip" title="Drag to reorder">⠿</span>';
		html += hasKids
			? '<button class="cbt-toggle' + (collapsed ? "" : " open") + '" data-act="toggle" title="Expand / collapse">▶</button>'
			: '<span class="cbt-toggle-spacer"></span>';
		html += '<span class="cbt-row-ico" title="' + (kind === "section" ? "Section" : kind === "subsection" ? "Sub-section" : kind === "lesson" ? "Lesson" : "Task") + '">' + ico + "</span>";
		if (hasKids) html += derivedPillHtml(n);
		else html += statusSelectHtml(n, canW);
		html += '<span class="cbt-row-title' + (doneCls ? " cbt-done" : "") + '" data-act="' + (hasKids ? "toggle" : "rename") + '" title="' + (hasKids ? "Click to expand / collapse — double-click to rename" : "Click or double-click to rename") + '">' + esc(n.title);
		if (hasKids) {
			html += '<span class="cbt-row-badge">' + (st.done || 0) + "/" + (st.leaves || 0) + '</span><span class="cbt-mini-bar"><i style="width:' + pct + '%"></i></span><span class="cbt-row-pct">' + pct + '%</span>';
		}
		html += "</span>";
		html += assignSelectHtml(n, canW);
		html += dueChipHtml(n);
		if (n.notes) html += '<span class="cbt-note-ic" data-act="edit" title="Has notes">📝</span>';
		html += '<span class="cbt-rowbtns cbt-edit-only">';
		if (!stdLeaf) {
			html += '<button class="cbt-ib" data-act="child" title="Add a child here">＋</button>';
			if (standardTasks().length) html += '<button class="cbt-ib" data-act="std" title="Add standard tasks under this item">📋</button>';
			html += '<button class="cbt-ib" data-act="dup" title="Duplicate (with subtasks)">⧉</button>';
			if (hasKids) {
				html += '<button class="cbt-ib" data-act="assignall" title="Assign every task in this branch to one person">👤</button>';
			}
			html += '<button class="cbt-ib" data-act="up" title="Move up">↑</button>';
			html += '<button class="cbt-ib" data-act="down" title="Move down">↓</button>';
		}
		html += '<button class="cbt-ib" data-act="edit" title="Edit details">✎</button>';
		html += '<button class="cbt-ib cbt-del" data-act="del" title="Delete">🗑</button>';
		html += "</span></div>";
		return html;
	}
	function startInlineEdit(row) {
		var id = row.getAttribute("data-id");
		var n = _nodeIndex[id];
		if (!n || !canWrite()) return;
		var titleEl = row.querySelector(".cbt-row-title");
		if (!titleEl) return;
		pushUndo("Rename task");
		var inp = document.createElement("input");
		inp.type = "text";
		inp.className = "cbt-inline-input";
		inp.value = n.title;
		inp.maxLength = 200;
		var finished = false;
		function commit() {
			if (finished) return;
			finished = true;
			n.title = inp.value.trim() || "Untitled task";
			renderTree(); scheduleSave();
		}
		inp.addEventListener("keydown", function (e) {
			if (e.key === "Enter") { e.preventDefault(); commit(); }
			else if (e.key === "Escape") { finished = true; renderTree(); }
		});
		inp.addEventListener("blur", commit);
		titleEl.parentNode.replaceChild(inp, titleEl);
		inp.focus();
		try { inp.select(); } catch (e) { }
	}
	function nodeHtml(n, depth, f, active, visMap) {
		var vis = visMap[n.id];
		if (active && !vis.any) return "";
		var hasKids = (n.children || []).length > 0;
		var st = _nodeStats[n.id] || { pct: 0 };
		var collapsed = !active && DB.ui.collapsed.indexOf(n.id) > -1 && n.id !== _inlineParent;
		var cls = "cbt-node" + (active && !vis.self ? " cbt-ctx" : "") + (collapsed ? " cbt-collapsed" : "");
		var html = '<div class="' + cls + '" data-id="' + n.id + '">';
		html += rowHtml(n, depth, hasKids, collapsed, st);
		var kidsHtml = (n.children || []).map(function (c) { return nodeHtml(c, depth + 1, f, active, visMap); }).join("");
		if (n.id === _inlineParent) kidsHtml = inlineAddHtml(n) + kidsHtml;
		if (hasKids || kidsHtml) {
			html += '<div class="cbt-children">' + kidsHtml + "</div>";
		}
		return html + "</div>";
	}
	function openInline(id) {
		computeStats();
		if (!_nodeIndex[id] || isStdTaskLeaf(_nodeIndex[id])) return;
		_inlineParent = id;
		_inlineDraft = "";
		_inlineStd = true;
		_focusInline = true;
		var ci = DB.ui.collapsed.indexOf(id);
		if (ci > -1) DB.ui.collapsed.splice(ci, 1);
		renderTree();
		focusInlineInput();
	}
	function inlineAddHtml(parent) {
		var std = standardTasks();
		var html = '<div class="cbt-inline-row" data-id="' + parent.id + '">';
		html += '<span class="cbt-inline-ico">↳</span>';
		html += '<input class="cbt-inline-add-input" type="text" maxlength="200" placeholder="New item under “' + esc(parent.title) + '” — Enter adds, Esc closes" value="' + esc(_inlineDraft) + '">';
		if (std.length) html += '<button class="cbt-chip cbt-std-chip' + (_inlineStd ? " on" : "") + '" data-act="stdtoggle" title="When ON, each new item also gets the standard tasks as its children">📋 std ' + (_inlineStd ? "ON" : "OFF") + "</button>";
		html += '<button class="cbt-ib" data-act="stdclose" title="Close">✕</button>';
		return html + "</div>";
	}
	function commitInline() {
		var raw = (_inlineDraft || "").trim();
		var pid = _inlineParent;
		if (!raw) { closeInline(); return; }
		addTasks(pid, raw, _inlineStd && standardTasks().length > 0);
		_inlineDraft = "";
		_focusInline = true;
		renderTree();
		focusInlineInput();
	}
	function closeInline() {
		_inlineParent = "";
		_inlineDraft = "";
		_focusInline = false;
		renderTree();
	}
	function focusInlineInput() {
		if (!_focusInline) return;
		_focusInline = false;
		var inp = $(".cbt-inline-add-input");
		if (inp) { try { inp.focus(); } catch (e) { } }
	}
	function emptyTreeHtml(active) {
		if (active) return '<div class="cbt-empty"><div class="cbt-empty-ic">🔍</div><h3>No matching tasks</h3><p>Nothing matches the current search or filters.</p></div>';
		return '<div class="cbt-empty"><div class="cbt-empty-ic">🎓</div><h3>Start building your curriculum</h3><p>Add sections, then sub-sections and lessons under them. Use the ＋ button on any folder to add the next level — with 📋 std ON the new item becomes a lesson with its standard tasks.</p><button class="cbt-btn cbt-btn-primary" data-act="add-section">＋ Add first section</button></div>';
	}
	function renderTree() {
		var tree = el("cbt-tree");
		if (!tree) return;
		computeStats();
		var q = el("cbt-search") ? el("cbt-search").value : "";
		var f = { q: q.trim().toLowerCase(), status: _filters.status, member: _filters.member, overdue: !!_filters.overdue };
		var active = !!(f.q || f.status || f.member || f.overdue);
		if (!DB.nodes.length) { tree.innerHTML = emptyTreeHtml(false); tree.classList.remove("filtering"); return; }
		var visMap = {};
		var build = function (n) {
			var self = matchSelf(n, f);
			var any = self;
			(n.children || []).forEach(function (c) { if (build(c)) any = true; });
			visMap[n.id] = { self: self, any: any };
			return any;
		};
		DB.nodes.forEach(build);
		var html = DB.nodes.map(function (n) { return nodeHtml(n, 0, f, active, visMap); }).join("");
		var anyVisible = html.indexOf("cbt-node") > -1;
		tree.innerHTML = anyVisible ? html : emptyTreeHtml(true);
		tree.classList.toggle("filtering", active);
	}

	/* ── Progress grid (lessons × standard tasks) ── */
	function gridUnitsIn(n) {
		var out = [];
		(function go(x) {
			var kids = x.children || [];
			if (kids.length && kids.every(function (c) { return !(c.children || []).length; })) out.push(x);
			kids.forEach(go);
		})(n);
		return out;
	}
	function gridUnits() {
		var out = [];
		DB.nodes.forEach(function (r) { out = out.concat(gridUnitsIn(r)); });
		return out;
	}
	function findStdChild(n, taskType) {
		var kids = n.children || [];
		for (var i = 0; i < kids.length; i++) {
			if (String(kids[i].title).trim().toLowerCase() === String(taskType).trim().toLowerCase()) return kids[i];
		}
		return null;
	}
	function worstOf(others) {
		var rank = { blocked: 0, todo: 1, progress: 2, review: 3, done: 4 };
		var worst = "done", wr = 4;
		others.forEach(function (c) {
			var r = rank[c.status] === undefined ? 1 : rank[c.status];
			if (r < wr) { wr = r; worst = c.status; }
		});
		return worst;
	}
	function nextCycleStatus(s) {
		if (s === "todo") return "progress";
		if (s === "progress") return "review";
		if (s === "review") return "done";
		return "todo";
	}
	function gridCols(stdLen) {
		return "minmax(150px, 1fr) 58px " + new Array(stdLen + 2).join("36px ") + "36px";
	}
	function unitHasOverdue(unit) {
		return (unit.children || []).some(function (c) { return !(c.children || []).length && isOverdueLeaf(c); });
	}
	function gridIndent(depth) { return depth * 12; }
	function unitRowHtml(unit, depth, cols, rowIdx) {
		var st = _nodeStats[unit.id] || {};
		var std = standardTasks();
		var alt = (rowIdx.n++ % 2 === 1) ? " cbt-grid-alt" : "";
		var html = '<div class="cbt-grid-row' + alt + '" style="grid-template-columns:' + cols + '">';
		var warn = unitHasOverdue(unit) ? '<span class="cbt-grid-warn" title="Has overdue tasks">⚠</span>' : "";
		html += '<div class="cbt-grid-namecell" style="padding-left:' + gridIndent(depth) + 'px">';
		var glyph = depth > 0 ? '<span class="cbt-grid-branch">└</span>' : "";
		html += '<span class="cbt-grid-name" title="' + esc(pathOf(unit.id) || "Top level") + '">' + glyph + esc(unit.title) + "</span>" + warn;
		html += '<span class="cbt-grid-go" data-act="reveal" data-id="' + unit.id + '" title="Open in outline">↗</span>';
		html += "</div>";
		html += '<div class="cbt-grid-sp"><span class="cbt-grid-pct">' + (st.pct || 0) + '%</span><div class="cbt-mini" style="width:36px"><i style="width:' + (st.pct || 0) + '%"></i></div></div>';
		std.forEach(function (taskType) {
			var child = findStdChild(unit, taskType);
			if (child) {
				var s = statusById(child.status);
				html += '<div class="cbt-grid-cell st-' + child.status + '" data-act="cell" data-tid="' + child.id + '" title="' + esc(taskType) + " — " + s.label + (child.memberId ? " · " + esc(memberName(child.memberId)) : "") + ' (click to change)">' + s.icon + "</div>";
			} else {
				html += '<div class="cbt-grid-cell empty" title="' + esc(taskType) + ' — not added yet">·</div>';
			}
		});
		var others = (unit.children || []).filter(function (c) {
			return !std.some(function (t) { return String(c.title).trim().toLowerCase() === String(t).trim().toLowerCase(); });
		});
		if (others.length) {
			var w = worstOf(others);
			html += '<div class="cbt-grid-cell st-' + w + ' cbt-grid-other" title="' + others.length + " other task(s): " + esc(others.map(function (c) { return c.title; }).join(", ")) + '">+' + others.length + "</div>";
		} else {
			html += '<div class="cbt-grid-cell empty cbt-grid-other">·</div>';
		}
		return html + "</div>";
	}
	function gridSecHeadHtml(node, depth) {
		var rst = _nodeStats[node.id] || {};
		var ds = statusById(effStatus(node));
		var collapsed = DB.ui.gridCollapsed.indexOf(node.id) > -1;
		var ico = depth === 0 ? "📁" : "📂";
		var html = '<div class="cbt-grid-sec-head' + (depth > 0 ? " cbt-grid-sec-sub" : "") + '" style="padding-left:' + (gridIndent(depth) + 2) + 'px">';
		html += '<button class="cbt-grid-toggle' + (collapsed ? "" : " open") + '" data-act="gridtoggle" data-id="' + node.id + '" title="Collapse / expand this section">▶</button>';
		html += '<span class="cbt-sec-name cbt-grid-sec-name">' + ico + " " + esc(node.title) + '</span><span class="cbt-grid-go" data-act="reveal" data-id="' + node.id + '" title="Open in outline">↗</span><span class="cbt-derived st-' + ds.id + '">' + ds.icon + " " + ds.label + '</span><span class="cbt-sec-count">' + (rst.done || 0) + "/" + (rst.leaves || 0) + " tasks · " + (rst.pct || 0) + "%</span></div>";
		return html;
	}
	function gridBlockHtml(nodes, depth, cols, out, rowIdx) {
		nodes.forEach(function (n) {
			var kids = n.children || [];
			var isUnit = kids.length && kids.every(function (c) { return !(c.children || []).length; });
			if (isUnit) {
				out.push(unitRowHtml(n, depth, cols, rowIdx));
				return;
			}
			out.push('<div class="cbt-grid-section">');
			out.push(gridSecHeadHtml(n, depth));
			if (DB.ui.gridCollapsed.indexOf(n.id) === -1) {
				if (kids.length) gridBlockHtml(kids, depth + 1, cols, out, rowIdx);
				else out.push('<div class="cbt-grid-note" style="margin:6px 0 2px">No lessons under this section yet.</div>');
			}
			out.push("</div>");
		});
	}
	function renderGrid() {
		var box = el("cbt-grid");
		if (!box) return;
		computeStats();
		var std = standardTasks();
		var units = gridUnits();
		var sum = el("cbt-grid-summary");
		if (sum) sum.textContent = units.length + " lesson" + (units.length === 1 ? "" : "s") + " in " + DB.nodes.length + " section" + (DB.nodes.length === 1 ? "" : "s");
		if (!DB.nodes.length) { box.innerHTML = emptyTreeHtml(false); return; }
		var html = "";
		if (!std.length) html += '<div class="cbt-grid-note">Define <b>standard tasks</b> with ⚙ Std tasks — then every lesson gets one column per task here.</div>';
		if (!units.length) {
			html += '<div class="cbt-empty"><div class="cbt-empty-ic">📖</div><h3>No lessons yet</h3><p>Lessons are items that directly contain tasks. Use the ＋ button on a section or sub-section with 📋 std ON to create them.</p></div>';
		} else {
			var cols = gridCols(std.length);
			html += '<div class="cbt-grid-head" style="grid-template-columns:' + cols + '"><span class="cbt-grid-hname">Lesson</span><span class="cbt-grid-sp">Progress</span>';
			std.forEach(function (t) { html += '<span class="cbt-grid-hcell" title="' + esc(t) + '"><span class="cbt-grid-hico">' + stdTaskIcon(t) + '</span><span class="cbt-grid-htxt">' + esc(t) + "</span></span>"; });
			html += '<span class="cbt-grid-hcell" title="Other tasks"><span class="cbt-grid-hico">＋</span><span class="cbt-grid-htxt">Other</span></span></div>';
			var body = [];
			gridBlockHtml(DB.nodes, 0, cols, body, { n: 0 });
			html += body.join("");
		}
		box.innerHTML = html;
	}
	function gridClick(e) {
		var actEl = e.target.closest ? e.target.closest("[data-act]") : null;
		if (!actEl) return;
		var a = actEl.getAttribute("data-act");
		if (a === "gridtoggle") {
			var gid = actEl.getAttribute("data-id");
			if (!gid) return;
			var gi = DB.ui.gridCollapsed.indexOf(gid);
			if (gi > -1) DB.ui.gridCollapsed.splice(gi, 1); else DB.ui.gridCollapsed.push(gid);
			scheduleSave();
			renderGrid();
			return;
		}
		if (a === "reveal") {
			var id = actEl.getAttribute("data-id");
			if (id) revealNode(id);
			return;
		}
		if (a === "cell") {
			if (!canWrite()) return;
			if (e.button !== 0 || !e.detail) return;
			var tid = actEl.getAttribute("data-tid");
			if (_gridPress !== tid) return;
			var now = Date.now();
			if (_cellCycleAt[tid] && now - _cellCycleAt[tid] < 300) return;
			_cellCycleAt[tid] = now;
			var n = _nodeIndex[tid];
			if (n) applyStatus(tid, nextCycleStatus(n.status));
		}
	}
	function collapseAllGrid(collapse) {
		if (collapse) {
			var all = flatList();
			DB.ui.gridCollapsed = all.filter(function (n) {
				var kids = n.children || [];
				return kids.length && !kids.every(function (c) { return !(c.children || []).length; });
			}).map(function (n) { return n.id; });
		} else {
			DB.ui.gridCollapsed = [];
		}
		scheduleSave();
		renderGrid();
	}
	function revealNode(id) {
		switchTab("tasks");
		var up = _parentIndex[id];
		while (up && up !== "root") {
			var ci = DB.ui.collapsed.indexOf(up.id);
			if (ci > -1) DB.ui.collapsed.splice(ci, 1);
			up = _parentIndex[up.id];
		}
		renderTree();
		scheduleSave();
		setTimeout(function () {
			var row = $('.cbt-row[data-id="' + id + '"]');
			if (row) {
				try { row.scrollIntoView({ block: "center" }); } catch (e) { }
				row.classList.add("cbt-flash");
				setTimeout(function () { try { row.classList.remove("cbt-flash"); } catch (e) { } }, 1800);
			}
		}, 80);
	}

	/* ── Reports ── */
	function rcard(label, val, sub, color) {
		return '<div class="cbt-rcard"><div class="cbt-rcard-label">' + label + '</div><div class="cbt-rcard-val" style="color:' + (color || "#1e293b") + '">' + val + '</div><div class="cbt-rcard-sub">' + (sub || "") + "</div></div>";
	}
	function rbar(segs) {
		var html = '<div class="cbt-rbar">';
		segs.forEach(function (s) { if (s.w > 0) html += '<i style="width:' + s.w + '%;background:' + s.c + '"></i>'; });
		return html + "</div>";
	}
	function renderReports() {
		var box = el("cbt-reports");
		if (!box) return;
		var S = computeStats();
		var t = S.totals;
		if (!DB.nodes.length) { box.innerHTML = emptyTreeHtml(false); return; }
		var html = "";
		/* overview cards */
		html += '<div class="cbt-rcards">';
		html += rcard("Total tasks", t.leaves, t.nodes - t.leaves + " groups", "#4f46e5");
		html += rcard("Done", t.done, (t.leaves ? Math.round(t.done / t.leaves * 100) : 0) + "% of tasks", "#10b981");
		html += rcard("In progress", t.progress, "", "#f59e0b");
		html += rcard("In review", t.review, "", "#8b5cf6");
		html += rcard("Blocked", t.blocked, "", "#ef4444");
		html += rcard("Overdue", t.overdue, "", "#dc2626");
		html += "</div>";

		/* standard task summary */
		if (standardTasks().length) {
			var leaves = flatList().filter(function (n) { return !(n.children || []).length; });
			html += '<div class="cbt-rpanel"><h3>📋 Standard task progress</h3>';
			standardTasks().forEach(function (stt) {
				var matched = leaves.filter(function (l) { return String(l.title).trim().toLowerCase() === String(stt).trim().toLowerCase(); });
				var sdone = matched.filter(function (l) { return l.status === "done"; }).length;
				var spct = matched.length ? Math.round(sdone / matched.length * 100) : 0;
				html += '<div class="cbt-std-row"><span class="cbt-std-name">' + esc(stt) + '</span><div class="cbt-mini" style="flex:1;max-width:240px"><i style="width:' + spct + '%;background:' + (spct === 100 ? "#10b981" : "#4f46e5") + '"></i></div><span class="cbt-std-cnt">' + sdone + "/" + matched.length + "</span></div>";
			});
			html += "</div>";
		}

		/* overall progress + distribution */
		html += '<div class="cbt-rpanel"><h3>Overall completion — ' + S.pct + "%</h3>";
		var segs = [
			{ w: t.leaves ? t.done / t.leaves * 100 : 0, c: "#10b981" },
			{ w: t.leaves ? t.review / t.leaves * 100 : 0, c: "#8b5cf6" },
			{ w: t.leaves ? t.progress / t.leaves * 100 : 0, c: "#f59e0b" },
			{ w: t.leaves ? t.blocked / t.leaves * 100 : 0, c: "#ef4444" },
			{ w: t.leaves ? t.todo / t.leaves * 100 : 0, c: "#cbd5e1" }
		];
		html += rbar(segs);
		html += '<div class="cbt-rdist">';
		STATUSES.forEach(function (s) { html += '<span class="cbt-rlegend"><span class="cbt-dot" style="background:' + s.color + '"></span>' + s.label + "</span>"; });
		html += "</div></div>";

		/* sections + team */
		html += '<div class="cbt-rep-grid"' + (canAdmin() ? "" : ' style="grid-template-columns:1fr"') + '>';
		html += '<div class="cbt-rpanel"><h3>📚 Section progress</h3>';
		S.roots.forEach(function (r) {
			var st = _nodeStats[r.node.id] || {};
			var ds = statusById(effStatus(r.node));
			var avatars = "";
			var keys = [];
			for (var k in st.members) keys.push(k);
			keys.slice(0, 4).forEach(function (mid) {
				var cls = mid === "__none" ? "#94a3b8" : avatarColor(mid);
				var label = mid === "__none" ? "?" : initials(memberName(mid));
				avatars += '<span class="cbt-avatar" style="background:' + cls + '">' + esc(label) + "</span>";
			});
			var extra = keys.length - 4;
			html += '<div class="cbt-sec-item">';
			html += '<div class="cbt-sec-head"><span class="cbt-sec-name" data-act="reveal" data-id="' + r.node.id + '" title="Open in outline">' + esc(r.node.title) + '</span><span class="cbt-derived st-' + ds.id + '" title="Derived from subtasks">' + ds.icon + " " + ds.label + '</span><span class="cbt-avatars">' + avatars + (extra > 0 ? '<span class="cbt-avatar" style="background:#64748b">+' + extra + "</span>" : "") + '</span><span class="cbt-sec-count">' + (st.done || 0) + "/" + (st.leaves || 0) + " tasks · " + (st.pct || 0) + "%</span></div>";
			html += '<div class="cbt-sec-bar"><i style="width:' + (st.pct || 0) + '%;' + ((st.pct || 0) === 100 ? "background:#10b981" : "") + '"></i></div>';
			html += '<div class="cbt-sec-foot"><span>👥 ' + keys.length + " assignee" + (keys.length === 1 ? "" : "s") + "</span></div>";
			html += "</div>";
		});
		html += "</div>";
		if (canAdmin()) {
			html += '<div class="cbt-rpanel"><h3>👥 Team performance</h3>' + teamTableHtml(S) + "</div>";
		}
		html += "</div>";

		/* due lists */
		html += '<div class="cbt-due-grid">';
		html += '<div class="cbt-rpanel"><h3 style="color:#b91c1c">⚠ Overdue</h3>' + dueListHtml(S.overdue, true) + "</div>";
		html += '<div class="cbt-rpanel"><h3>📅 Upcoming</h3>' + dueListHtml(S.upcoming, false) + "</div>";
		html += "</div>";

		box.innerHTML = html;
	}
	function teamTableHtml(S) {
		var rows = S.members.filter(function (m) { return m.tasks > 0; });
		var unassigned = null;
		rows = rows.filter(function (m) { if (m.mid === "__none") { unassigned = m; return false; } return true; });
		if (unassigned) rows.push(unassigned);
		if (!rows.length) return '<div style="color:#94a3b8;font-size:12.5px;padding:8px 0">No tasks assigned yet. Assign tasks to team members to see their stats here.</div>';
		var html = '<table class="cbt-table"><tr><th>Member</th><th>Tasks</th><th>✅</th><th>🚧</th><th>🔍</th><th>🚫</th><th>⬜</th><th>%</th></tr>';
		rows.forEach(function (m) {
			var color = m.mid === "__none" ? "#94a3b8" : avatarColor(m.mid);
			html += "<tr>";
			html += '<td><span class="cbt-avatar" style="background:' + color + ';margin-right:6px">' + esc(initials(m.name)) + "</span>" + esc(m.name) + "</td>";
			html += "<td><b>" + m.tasks + "</b></td>";
			html += "<td>" + m.done + "</td><td>" + m.progress + "</td><td>" + m.review + "</td><td>" + m.blocked + "</td><td>" + m.todo + "</td>";
			html += '<td class="cbt-tbar"><div class="cbt-mini"><i style="width:' + m.pct + '%;background:' + (m.pct === 100 ? "#10b981" : "#4f46e5") + '"></i></div> ' + m.pct + "%</td>";
			html += "</tr>";
		});
		return html + "</table>";
	}
	function dueListHtml(list, isOver) {
		if (!list.length) return '<div style="color:#94a3b8;font-size:12.5px;padding:8px 0">' + (isOver ? "No overdue tasks 🎉" : "Nothing scheduled yet.") + "</div>";
		var html = "";
		list.slice(0, 12).forEach(function (o) {
			var d = daysUntil(o.node.due);
			html += '<div class="cbt-due-item">';
			html += '<span class="cbt-due-date ' + (isOver ? "over" : "soon") + '">' + esc(fmtLong(o.node.due)) + "</span>";
			html += '<span class="cbt-due-title">' + esc(o.node.title) + (o.path ? ' <span style="color:#94a3b8">· ' + esc(o.path) + "</span>" : "") + "</span>";
			html += '<span class="cbt-due-meta">' + (isOver ? -d + "d late" : (d === 0 ? "today" : "in " + d + "d")) + " · " + esc(memberName(o.node.memberId)) + "</span>";
			html += "</div>";
		});
		if (list.length > 12) html += '<div class="cbt-more-note">…and ' + (list.length - 12) + " more</div>";
		return html;
	}

	/* ── Exports ── */
	function csvCell(v) {
		var s = String(v == null ? "" : v);
		if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
		return s;
	}
	function exportCsv() {
		var S = computeStats();
		var rows = [["Path", "Task", "Status", "Due date", "Assignee", "Progress %", "Notes"]];
		(function go(n, pathArr) {
			var path = pathArr.concat([n.title]);
			var st = _nodeStats[n.id] || {};
			rows.push([
				path.join(" / "), n.title, statusById(n.status).label,
				n.due || "",
				memberName(n.memberId), String(st.pct || 0), (n.notes || "").replace(/\r?\n/g, " ")
			]);
			(n.children || []).forEach(function (c) { go(c, path); });
		});
		DB.nodes.forEach(function (n) { go(n, []); });
		var csv = rows.map(function (r) { return r.map(csvCell).join(","); }).join("\r\n");
		downloadBlob(slugify(DB.title) + "-tasks.csv", "\uFEFF" + csv, "text/csv;charset=utf-8");
		notify("CSV downloaded", "success");
	}
	function buildReportHtml() {
		var S = computeStats();
		var t = S.totals;
		function td(v) { return '<td style="padding:7px 8px;border:1px solid #e2e8f0;font-size:13px">' + v + "</td>"; }
		function th(v) { return '<th style="padding:7px 8px;border:1px solid #e2e8f0;font-size:12px;text-align:left;background:#f1f5f9">' + v + "</th>"; }
		function bar(pct, color) { return '<div style="background:#eef0f6;height:10px;border-radius:6px;overflow:hidden"><div style="height:100%;width:' + pct + '%;background:' + (color || "#4f46e5") + ';border-radius:6px"></div></div>'; }
		var h = "";
		h += '<div style="font-family:Arial,Helvetica,sans-serif;color:#1e293b;max-width:920px;margin:0 auto;padding:28px 20px">';
		h += '<div style="border-bottom:3px solid #4f46e5;padding-bottom:14px;margin-bottom:18px">';
		h += '<h1 style="margin:0;font-size:24px">' + esc(DB.title) + "</h1>";
		h += '<p style="margin:6px 0 0;color:#64748b;font-size:13px">Curriculum progress report — generated ' + esc(new Date().toLocaleString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })) + "</p>";
		h += "</div>";
		h += '<table style="width:100%;border-collapse:collapse;margin-bottom:22px">';
		h += "<tr>" + th("Total tasks") + th("Done") + th("In progress") + th("In review") + th("Blocked") + th("To do") + "</tr>";
		h += "<tr>" + td(t.leaves) + td(t.done) + td(t.progress) + td(t.review) + td(t.blocked) + td(t.todo) + "</tr>";
		h += "<tr>" + th("Overall progress") + th("Overdue") + th("Due today") + td("") + td("") + td("") + "</tr>";
		h += "<tr>" + td(S.pct + "%") + td(t.overdue) + td(t.dueToday) + td("") + td("") + td("") + "</tr>";
		h += "</table>";
		h += '<h2 style="font-size:16px;margin:0 0 10px">Section progress</h2>';
		if (!S.roots.length) h += '<p style="color:#64748b;font-size:13px">No sections yet.</p>';
		S.roots.forEach(function (r) {
			var st = _nodeStats[r.node.id] || {};
			h += '<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700"><span>' + esc(r.node.title) + '</span><span style="color:#64748b;font-weight:400">' + (st.done || 0) + "/" + (st.leaves || 0) + " tasks · " + (st.pct || 0) + "%</span></div>";
			h += '<div style="margin-top:4px">' + bar(st.pct || 0, (st.pct || 0) === 100 ? "#10b981" : "#4f46e5") + "</div></div>";
		});
		if (canAdmin()) {
			h += '<h2 style="font-size:16px;margin:18px 0 10px">Team performance</h2>';
			var rows = S.members.filter(function (m) { return m.tasks > 0; });
			if (!rows.length) h += '<p style="color:#64748b;font-size:13px">No tasks assigned yet.</p>';
			else {
				h += '<table style="width:100%;border-collapse:collapse;font-size:12.5px">';
				h += "<tr>" + th("Member") + th("Tasks") + th("Done") + th("In progress") + th("In review") + th("Blocked") + th("To do") + th("Progress") + "</tr>";
				rows.forEach(function (m) {
					h += '<tr style="border-bottom:1px solid #e2e8f0">' + td(esc(m.name)) + td(m.tasks) + td(m.done) + td(m.progress) + td(m.review) + td(m.blocked) + td(m.todo) + td(m.pct + "%") + "</tr>";
				});
				h += "</table>";
			}
		}
		if (S.overdue.length) {
			h += '<h2 style="font-size:16px;margin:18px 0 10px;color:#b91c1c">Overdue tasks</h2><ul style="font-size:12.5px;color:#334155">';
			S.overdue.slice(0, 15).forEach(function (o) {
				h += "<li><b>" + esc(fmtLong(o.node.due)) + "</b> — " + esc(o.node.title) + ' <span style="color:#94a3b8">(' + esc(o.path || "") + ")</span></li>";
			});
			if (S.overdue.length > 15) h += "<li>…and " + (S.overdue.length - 15) + " more</li>";
			h += "</ul>";
		}
		h += "</div>";
		return h;
	}
	function exportPdf() {
		var html = buildReportHtml();
		var fname = slugify(DB.title) + "-progress-report";
		function fallback() {
			downloadBlob(fname + ".html", "<!doctype html><html><head><meta charset=\"utf-8\"><title>Progress Report</title></head><body>" + html + "</body></html>", "text/html");
			notify("Report downloaded — open it and print to PDF", "info");
		}
		if (typeof tool.requestExportPdf === "function") {
			try {
				tool.requestExportPdf({ html: html, filename: fname, landscape: false }, function (err, file) {
					if (err || !file || !file.url) { fallback(); return; }
					notify("Report exported ✓", "success");
					try { tool.openUrl(file.url); } catch (e) { }
				});
			} catch (e) { fallback(); }
		} else fallback();
	}

	/* ── Modal ── */
	function openModal(title, bodyHtml, wireFn) {
		var ov = el("cbt-modal");
		if (!ov) return;
		el("cbt-modal-title").textContent = title;
		el("cbt-modal-body").innerHTML = bodyHtml;
		ov.hidden = false;
		if (wireFn) wireFn();
	}
	function closeModal() {
		var ov = el("cbt-modal");
		if (ov) { ov.hidden = true; el("cbt-modal-body").innerHTML = ""; }
		_editId = null;
		_efDelArmed = false;
	}
	function parentOptionsHtml(excludeId, selVal) {
		var excluded = {};
		(function collect(n) { excluded[n.id] = true; (n.children || []).forEach(collect); })(_nodeIndex[excludeId]);
		var out = '<option value="">📁 Root level</option>';
		(function go(nodes, depth) {
			nodes.forEach(function (n) {
				if (excluded[n.id] || isStdTaskLeaf(n)) return;
				out += '<option value="' + n.id + '"' + (n.id === selVal ? " selected" : "") + ">" + indentHtml(depth) + esc(n.title) + "</option>";
				go(n.children || [], depth + 1);
			});
		})(DB.nodes, 1);
		return out;
	}
	function openEditModal(id) {
		computeStats();
		var n = _nodeIndex[id];
		if (!n) return;
		_editId = id;
		_efDelArmed = false;
		var parentVal = _parentIndex[id] && _parentIndex[id] !== "root" ? _parentIndex[id].id : "";
		var hasKids = (n.children || []).length > 0;
		var showSt = hasKids ? effStatus(n) : n.status;
		var html = '<div class="cbt-form-grid">';
		html += '<div class="cbt-field cbt-full"><label>Title</label><input type="text" id="ef-title" maxlength="200" value="' + esc(n.title) + '"></div>';
		html += '<div class="cbt-field"><label>Parent location</label><select id="ef-parent">' + parentOptionsHtml(id, parentVal) + "</select></div>";
		if (hasKids) {
			var ds = statusById(showSt);
			html += '<div class="cbt-field"><label>Status</label><span class="cbt-derived st-' + ds.id + '">' + ds.icon + " " + ds.label + '</span><div class="cbt-field-hint">A section\'s status is always derived from its tasks — update each task individually.</div></div>';
		} else {
			html += '<div class="cbt-field"><label>Status</label><select id="ef-status">';
			STATUSES.forEach(function (s) { html += '<option value="' + s.id + '"' + (showSt === s.id ? " selected" : "") + ">" + s.icon + " " + s.label + "</option>"; });
			html += "</select></div>";
		}
		html += '<div class="cbt-field"><label>Assignee</label><select id="ef-member">';
		html += '<option value="__none"' + (!n.memberId ? " selected" : "") + ">Unassigned</option>";
		DB.members.forEach(function (m) { html += '<option value="' + m.id + '"' + (n.memberId === m.id ? " selected" : "") + ">" + esc(m.name) + "</option>"; });
		if (!DB.members.length) html += '<option value="" disabled>No team members — grant CMS access to this record</option>';
		html += '</select></div>';
		html += '<div class="cbt-field"><label>Due date</label><input type="date" id="ef-due" value="' + esc(n.due || "") + '"></div>';
		html += '<div class="cbt-field cbt-full"><label>Notes</label><textarea id="ef-notes" placeholder="What needs to be done? Links, references, comments…">' + esc(n.notes) + "</textarea></div>";
		html += "</div>";
		html += '<div class="cbt-modal-foot">';
		html += '<button class="cbt-btn cbt-btn-danger" id="btn-ef-delete">🗑 Delete</button><span style="flex:1"></span>';
		html += '<button class="cbt-btn cbt-btn-ghost" id="btn-ef-cancel">Cancel</button>';
		html += '<button class="cbt-btn cbt-btn-primary" id="btn-ef-save">💾 Save changes</button>';
		html += "</div>";
		openModal("Edit task", html, function () {
			var t = el("ef-title");
			if (t) { t.focus(); try { t.select(); } catch (e) { } }
			var save = el("btn-ef-save");
			if (save) save.onclick = function () { saveEdit(id); };
			var cancel = el("btn-ef-cancel");
			if (cancel) cancel.onclick = closeModal;
			var del = el("btn-ef-delete");
			if (del) del.onclick = function () {
				if (!_efDelArmed) { _efDelArmed = true; del.textContent = "⚠ Sure? Click again"; return; }
				closeModal();
				deleteNode(id);
			};
		});
	}
	function saveEdit(id) {
		var n = _nodeIndex[id];
		if (!n) return;
		pushUndo("Edit task");
		_suppressUndo = true;
		var title = el("ef-title");
		if (title) n.title = title.value.trim() || "Untitled task";
		if (!(n.children || []).length) {
			var st = el("ef-status");
			if (st && st.value !== n.status) {
				n.status = st.value;
				n.doneAt = st.value === "done" ? (n.doneAt || new Date().toISOString()) : null;
			}
		}
		var m = el("ef-member");
		if (m) n.memberId = m.value === "__none" ? "" : m.value;
		var d = el("ef-due");
		if (d) n.due = d.value || "";
		var nt = el("ef-notes");
		if (nt) n.notes = nt.value;
		var par = el("ef-parent");
		if (par) {
			var curP = _parentIndex[id];
			var curId = (!curP || curP === "root") ? "" : curP.id;
			if (par.value !== curId) moveToParent(id, par.value);
		}
		_suppressUndo = false;
		closeModal();
		renderAll();
		scheduleSave();
		notify("Task updated", "success");
	}
	function openStdTasksModal() {
		var html = '<div class="cbt-field"><label>One task per line — added under every new lesson</label>';
		html += '<textarea id="st-tasks" style="min-height:150px">' + esc(standardTasks().join("\n")) + "</textarea></div>";
		html += '<div class="cbt-field-hint" style="margin-top:8px">These tasks are added when you create a lesson with the 📋 std option ON, and via the 📋 button on any item. Sections and sub-sections never get them automatically.</div>';
		html += '<div class="cbt-modal-foot"><button class="cbt-btn cbt-btn-ghost" id="btn-st-cancel">Cancel</button><button class="cbt-btn cbt-btn-primary" id="btn-st-save">💾 Save</button></div>';
		openModal("📋 Standard lesson tasks", html, function () {
			var c = el("btn-st-cancel");
			if (c) c.onclick = closeModal;
			var s = el("btn-st-save");
			if (s) s.onclick = function () {
				var ta = el("st-tasks");
				if (ta) {
					DB.settings.standardTasks = ta.value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
					if (!DB.settings.standardTasks.length) DB.settings.standardTasks = ["Lesson plan", "Worksheet", "Quiz"];
				}
				closeModal();
				renderAll();
				scheduleSave();
				notify("Standard tasks saved", "success");
			};
		});
	}

	/* ── Read-only ── */
	function ensureRoBanner() {
		var app = el("cbt-app");
		if (!app) return;
		var banner = el("cbt-ro-banner");
		if (_readOnly && !banner) {
			banner = document.createElement("div");
			banner.id = "cbt-ro-banner";
			banner.className = "cbt-ro-banner";
			banner.textContent = "🔒 View only — you can explore this curriculum but not edit it.";
			app.insertBefore(banner, app.firstChild);
		} else if (!_readOnly && banner && banner.parentNode) {
			banner.parentNode.removeChild(banner);
		}
	}
	function lockUI(ro) {
		_readOnly = !!ro;
		var app = el("cbt-app");
		if (app) app.classList.toggle("cbt-ro", _readOnly);
		ensureRoBanner();
		renderAll();
	}

	/* ── Tree event delegation ── */
	function confirmDeleteRow(id, btn) {
		if (btn.classList.contains("cbt-confirm")) { deleteNode(id); return; }
		btn.classList.add("cbt-confirm");
		btn.textContent = "Sure?";
		if (_delTimers[id]) clearTimeout(_delTimers[id]);
		_delTimers[id] = setTimeout(function () {
			try { btn.classList.remove("cbt-confirm"); btn.textContent = "🗑"; } catch (e) { }
		}, 2200);
	}
	function treeClick(e) {
		var actEl = e.target.closest ? e.target.closest("[data-act]") : null;
		if (!actEl) return;
		var a = actEl.getAttribute("data-act");
		if (a === "add-section") { if (canWrite()) addSection(); return; }
		if (a === "stdtoggle") { _inlineStd = !_inlineStd; renderTree(); return; }
		if (a === "stdclose") { closeInline(); return; }
		var row = actEl.closest(".cbt-row");
		if (!row) return;
		var id = row.getAttribute("data-id");
		if (!id) return;
		if (a === "toggle") toggleCollapsed(id);
		else if (a === "edit") openEditModal(id);
		else if (a === "rename") { if (canWrite()) startInlineEdit(row); }
		else if (a === "dup") { if (canWrite()) duplicateNode(id); }
		else if (a === "std") { if (canWrite()) appendStdTasks(id); }
		else if (a === "assignall") { if (canWrite()) openAssignAllModal(id); }
		else if (a === "prio") { /* priorities removed */ }
		else if (a === "child") { if (canWrite()) openInline(id); }
		else if (a === "up") { if (canWrite()) moveNodeUpDown(id, -1); }
		else if (a === "down") { if (canWrite()) moveNodeUpDown(id, 1); }
		else if (a === "del") { if (canWrite()) confirmDeleteRow(id, actEl); }
	}
	function treeChange(e) {
		var t = e.target;
		if (!t || !t.getAttribute) return;
		var a = t.getAttribute("data-act");
		if (!a) return;
		var row = t.closest ? t.closest(".cbt-row") : null;
		if (!row) return;
		var id = row.getAttribute("data-id");
		if (a === "status") { if (canWrite() && statusById(t.value)) applyStatus(id, t.value); }
		else if (a === "assign") {
			if (!canWrite()) return;
			setAssignee(id, t.value);
		}
	}
	function clearDropMarks() {
		$$(".cbt-dragging, .cbt-drop-before, .cbt-drop-after").forEach(function (n) {
			n.classList.remove("cbt-dragging", "cbt-drop-before", "cbt-drop-after");
		});
	}

	/* ── Static wiring ── */
	function wireUI() {
		var bas = el("btn-add-section");
		if (bas) bas.onclick = function () { if (canWrite()) addSection(); };
		var bst = el("btn-std-tasks");
		if (bst) bst.onclick = function () { if (canWrite()) openStdTasksModal(); };
		var s = el("cbt-search");
		if (s) s.addEventListener("input", function () { renderTree(); });
		var fs = el("cbt-filter-status");
		if (fs) fs.addEventListener("change", function () { _filters.status = fs.value; renderTree(); });
		var fm = el("cbt-filter-member");
		if (fm) fm.addEventListener("change", function () { _filters.member = fm.value; renderTree(); });
		var oo = el("btn-only-overdue");
		if (oo) oo.onclick = function () {
			_filters.overdue = !_filters.overdue;
			oo.classList.toggle("cbt-on", !!_filters.overdue);
			renderTree();
		};
		var un = el("btn-undo");
		if (un) un.onclick = undo;
		var be = el("btn-expand-all");
		if (be) be.onclick = function () { expandAll(false); };
		var bc = el("btn-collapse-all");
		if (bc) bc.onclick = function () { expandAll(true); };
		var tabs = el("cbt-tabs");
		if (tabs) tabs.addEventListener("click", function (e) {
			var t = e.target.closest ? e.target.closest(".cbt-tab") : null;
			if (t) switchTab(t.getAttribute("data-tab"));
		});
		var csv = el("btn-export-csv");
		if (csv) csv.onclick = exportCsv;
		var pdf = el("btn-export-pdf");
		if (pdf) pdf.onclick = exportPdf;
		var mx = el("cbt-modal-close");
		if (mx) mx.onclick = closeModal;
		var ov = el("cbt-modal");
		if (ov) ov.addEventListener("click", function (e) { if (e.target === ov) closeModal(); });
		document.addEventListener("keydown", function (e) {
			if (e.key === "Escape") { closeModal(); return; }
			if ((e.ctrlKey || e.metaKey) && !e.shiftKey && String(e.key).toLowerCase() === "z") {
				var t = e.target;
				if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
				e.preventDefault();
				undo();
			}
		});

		var rep = el("cbt-reports");
		if (rep) rep.addEventListener("click", function (e) {
			var t = e.target.closest ? e.target.closest("[data-act]") : null;
			if (!t) return;
			var a = t.getAttribute("data-act");
			if (a === "add-section" && canWrite()) addSection();
			else if (a === "reveal") revealNode(t.getAttribute("data-id"));
		});

		var tree = el("cbt-tree");
		if (tree) {
			tree.addEventListener("click", treeClick);
			tree.addEventListener("change", treeChange);
			tree.addEventListener("keydown", function (e) {
				if (e.target && e.target.classList && e.target.classList.contains("cbt-inline-add-input")) {
					if (e.key === "Enter") { e.preventDefault(); commitInline(); }
					else if (e.key === "Escape") { closeInline(); }
				}
			});
			tree.addEventListener("input", function (e) {
				if (e.target && e.target.classList && e.target.classList.contains("cbt-inline-add-input")) {
					_inlineDraft = e.target.value;
				}
			});
			tree.addEventListener("dblclick", function (e) {
				var t = e.target.closest ? e.target.closest(".cbt-row-title") : null;
				if (!t) return;
				var row = t.closest(".cbt-row");
				if (row && canWrite()) startInlineEdit(row);
			});
			tree.addEventListener("dragstart", function (e) {
				if (!canWrite()) { e.preventDefault(); return; }
				var grip = e.target.closest ? e.target.closest(".cbt-grip") : null;
				if (!grip) { e.preventDefault(); return; }
				var row = grip.closest(".cbt-row");
				if (!row) return;
				_dragId = row.getAttribute("data-id");
				try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", _dragId); } catch (err) { }
				row.classList.add("cbt-dragging");
			});
			tree.addEventListener("dragover", function (e) {
				if (!_dragId) return;
				var row = e.target.closest ? e.target.closest(".cbt-row") : null;
				if (!row) return;
				var tid = row.getAttribute("data-id");
				if (tid === _dragId) return;
				if (isDescendant(_nodeIndex[_dragId], _nodeIndex[tid])) return;
				if (isStdTaskLeaf(_nodeIndex[tid]) && (_nodeIndex[_dragId].children || []).length) return;
				e.preventDefault();
				try { e.dataTransfer.dropEffect = "move"; } catch (err) { }
				var r = row.getBoundingClientRect();
				var before = (e.clientY - r.top) < (r.height / 2);
				row.classList.remove("cbt-drop-before", "cbt-drop-after");
				row.classList.add(before ? "cbt-drop-before" : "cbt-drop-after");
			});
			tree.addEventListener("drop", function (e) {
				if (!_dragId) return;
				e.preventDefault();
				var row = e.target.closest ? e.target.closest(".cbt-row") : null;
				if (row) {
					var tid = row.getAttribute("data-id");
					if (tid && tid !== _dragId && !isDescendant(_nodeIndex[_dragId], _nodeIndex[tid]) && !(isStdTaskLeaf(_nodeIndex[tid]) && (_nodeIndex[_dragId].children || []).length)) {
						var r = row.getBoundingClientRect();
						insertRelative(_dragId, tid, (e.clientY - r.top) < (r.height / 2));
						renderAll(); scheduleSave();
					}
				}
				_dragId = null;
				clearDropMarks();
			});
			tree.addEventListener("dragend", function () { _dragId = null; clearDropMarks(); });
		}

		var grid = el("cbt-grid");
		if (grid) {
			grid.addEventListener("click", gridClick);
			grid.addEventListener("mousedown", function (e) {
				var cell = e.target && e.target.closest ? e.target.closest("[data-act='cell']") : null;
				_gridPress = cell ? cell.getAttribute("data-tid") : null;
			});
			grid.addEventListener("mouseleave", function () { _gridPress = null; });
		}
		var gca = el("btn-grid-collapse-all");
		if (gca) gca.onclick = function () { collapseAllGrid(true); };
		var gea = el("btn-grid-expand-all");
		if (gea) gea.onclick = function () { collapseAllGrid(false); };
	}

	/* ── TOOL ENTRY POINT ── */
	tool.onReady(function (val, fields) {
		loadParams();
		DB = normalizeDB(val);
		_tab = DB.ui.tab;
		wireUI();
		_readOnly = false;
		try { _readOnly = !!tool.isReadOnly(); } catch (e) { }
		renderAll();
		ensureRoBanner();
		syncPermittedUsers();

		refreshUser(5);

		tool.onValueChange(function (v) {
			if (v == null) return;
			var json = JSON.stringify(v);
			if (json === _lastStagedJson) return;
			DB = normalizeDB(v);
			_lastStagedJson = json;
			_tab = DB.ui.tab;
			renderAll();
			notify("Updated with the latest saved version", "info");
		});
		tool.onFieldsChange(function () { });
		tool.onReadonlyChange(function (ro) { lockUI(!!ro); });
		try { tool.onPermittedUsersChange(function () { syncPermittedUsers(); }); } catch (e) { }
		try { tool.onUserChange(function (u) { _user = u || getUserSafe(); if (!_user) _noIdentity = false; renderAll(); }); } catch (e) { }

		tool.declareOutput({
			type: "object",
			properties: {
				version: { type: "number" },
				title: { type: "string" },
				nodes: { type: "array", description: "Hierarchical task tree: sections, sub-sections, lessons and tasks" },
				members: { type: "array", description: "Team members (CMS permitted users)" },
				settings: { type: "object" },
				ui: { type: "object" }
			}
		});
		tool.declareParams([
			{ name: "defaultTitle", label: "Default Curriculum Title", type: "text", default: "My Curriculum", hint: "Shown when this record has no saved title yet.", severity: "optional" },
			{ name: "inProgressPercent", label: "In-Progress %", type: "number", default: "50", hint: "Completion percentage credited to tasks marked In progress (0-100).", severity: "optional" },
			{ name: "reviewPercent", label: "In-Review %", type: "number", default: "75", hint: "Completion percentage credited to tasks marked In review (0-100).", severity: "optional" }
		]);
	});

})();
