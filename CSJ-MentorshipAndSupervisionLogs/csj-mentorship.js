/* ============================================================
   Uniconhub CMS html-tool — Supervision & Mentorship Records
   JS field (paste WITHOUT a <script> tag).
   Wrapped in an IIFE so nothing collides with the host globals.
   Entry point: tool.onReady.
   ============================================================ */
(function () {
	"use strict";

	/* ---- SDK handle (fallback shim lets it still render if loaded
			outside the CMS; the real window.tool wins when present) ---- */
	var tool = (typeof window !== "undefined" && window.tool) ? window.tool : null;
	if (!tool) {
		var _v = null;
		tool = {
			onReady: function (cb) { cb(_v, {}); },
			getValue: function () { return _v; }, setValue: function (v) { _v = v; },
			onValueChange: function () { }, getFields: function () { return {}; },
			watchField: function () { }, setField: function () { }, setFields: function () { },
			onFieldsChange: function () { }, param: function (n, d) { return d; },
			isReadOnly: function () { return false; }, onReadonlyChange: function () { },
			getUser: function () { return null; }, onUserChange: function () { },
			reportValid: function () { }, notify: function (m) { try { console.log("notify:", m); } catch (e) { } },
			resize: function () { }, declareOutput: function () { }, declareParams: function () { }
		};
	}

	/* ---- Constants ---- */
	var DEFAULT_SKILLS = ["Adaptability", "Collaboration", "Communication",
		"Creativity and Innovation", "Digital skills", "Problem solving", "Technical skills"];
	var RATINGS = [
		{ v: "Exceeds expectations", cls: "ok" }, { v: "Meets expectations", cls: "meets" },
		{ v: "Developing", cls: "dev" }, { v: "Needs support", cls: "warn" }
	];

	/* ---- State ---- */
	var DB = { profile: { employeeName: "", position: "", organization: "", startDate: "", endDate: "", mentorName: "", supervisorName: "" }, supervision: [], mentorship: [] };
	var currentUser = null, readOnly = false, ROOT = null, expanded = {};

	/* ---- Helpers ---- */
	function $(s, r) { return (r || document).querySelector(s); }
	function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
	function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
	function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
	function parseD(iso) { if (!iso) return null; var p = iso.split("-").map(Number); return new Date(p[0], (p[1] || 1) - 1, p[2] || 1); }
	function fmtDate(iso) { var d = parseD(iso); if (!d || isNaN(d)) return "—"; return d.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" }); }
	function fmtShort(iso) { var d = parseD(iso); if (!d || isNaN(d)) return "—"; return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
	function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
	function initials(n) { var p = (n || "").trim().split(/\s+/).filter(Boolean); if (!p.length) return "CSJ"; return ((p[0][0] || "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase(); }
	function ratingCls(v) { var r = RATINGS.filter(function (x) { return x.v === v; })[0]; return r ? r.cls : "meets"; }
	function notify(msg, sev) { try { tool.notify(msg, sev || "success"); } catch (e) { } }
	function resize() { try { tool.resize(); } catch (e) { } }

	/* ---- Params ---- */
	function getSkills() { var s = tool.param("skills", DEFAULT_SKILLS); if (typeof s === "string") s = s.split(/[,\n;]+/).map(function (x) { return x.trim(); }).filter(Boolean); if (!Array.isArray(s) || !s.length) s = DEFAULT_SKILLS.slice(); return s; }
	function linkedNameField() { var v = tool.param("employeeNameField", ""); return (v || "").toString().trim(); }
	function reportTitle() { return tool.param("reportTitle", "Supervision & Mentorship Record") || "Supervision & Mentorship Record"; }

	/* ---- Persistence via CMS value ---- */
	function persist() { try { tool.setValue(DB); } catch (e) { } updateValidity(); stampSaved(); }
	function stampSaved() { var el = $("#savedAt"); if (el) el.textContent = "Saved " + new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }); }
	function updateValidity() { var ok = !!(DB.profile.employeeName && DB.profile.employeeName.trim()); try { tool.reportValid(ok, ok ? "" : "Enter the employee's name before saving."); } catch (e) { } }

	/* ============================================================ RENDER */
	function renderAll() { renderDossier(); renderOverview(); renderSup(); renderMen(); applyReadonly(); updateMeta(); resize(); }
	function updateMeta() { var el = $("#recMeta"); if (el) el.textContent = DB.supervision.length + " supervision · " + DB.mentorship.length + " mentorship"; }

	function renderDossier() {
		var p = DB.profile;
		function mf(k, v) { return '<div class="mfield"><span class="k">' + k + '</span><span class="v ' + (v ? "" : "empty") + '">' + (v ? esc(v) : "Not set") + "</span></div>"; }
		var term = "";
		if (p.startDate || p.endDate) {
			var pct = 0, label = "";
			if (p.startDate && p.endDate) {
				var s = parseD(p.startDate), e = parseD(p.endDate), n = new Date();
				var total = e - s, done = Math.min(Math.max(n - s, 0), total);
				pct = total > 0 ? Math.round(done / total * 100) : 0;
				var wk = Math.max(0, Math.ceil(done / 6048e5)), tw = Math.max(1, Math.ceil(total / 6048e5));
				label = "Week " + Math.min(wk, tw) + " of " + tw + " · " + pct + "% of term";
			} else { label = "Term dates incomplete"; }
			term = '<div class="term-line"><span>TERM</span><div class="prog"><i style="width:' + pct + '%"></i></div><span>' + esc(label) + "</span></div>";
		}
		$("#dossier").innerHTML =
			'<div class="dossier-head"><div class="who"><div class="avatar">' + esc(initials(p.employeeName)) + '</div><div class="who-txt">' +
			'<div class="name">' + (p.employeeName ? esc(p.employeeName) : "Unnamed Employee") + "</div>" +
			'<div class="role">' + (p.position ? "<b>" + esc(p.position) + "</b>" : "Position not set") + (p.organization ? " · " + esc(p.organization) : "") + "</div></div></div>" +
			'<button class="btn sm hide-ro" id="editProfile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z"/></svg> Edit</button></div>' +
			'<div class="dossier-meta">' + mf("Supervisor", p.supervisorName) + mf("Mentor", p.mentorName) + mf("Start", p.startDate ? fmtShort(p.startDate) : "") + mf("End", p.endDate ? fmtShort(p.endDate) : "") + "</div>" + term;
		var ep = $("#editProfile"); if (ep) ep.onclick = openProfileModal;
		requestAnimationFrame(function () { var bar = $(".term-line .prog i"); if (bar) { var w = bar.style.width; bar.style.width = "0"; requestAnimationFrame(function () { bar.style.width = w; }); } });
	}

	function segHTML(l, t) { return t ? '<div class="seg"><div class="lbl">' + l + '</div><div class="txt">' + esc(t) + "</div></div>" : ""; }
	function skillTags(arr) { if (!arr || !arr.length) return ""; return '<div class="rec-skills">' + arr.map(function (s) { return '<span class="tag">' + esc(s) + "</span>"; }).join("") + "</div>"; }

	function renderSup() {
		var q = ($("#searchSup").value || "").toLowerCase();
		var list = DB.supervision.slice().sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); }).filter(function (r) { return !q || JSON.stringify(r).toLowerCase().indexOf(q) > -1; });
		$("#ctSup").textContent = DB.supervision.length;
		var el = $("#streamSup");
		if (!DB.supervision.length) { el.innerHTML = emptyState("No supervision records yet", "The supervisor logs a daily observation — tasks worked on, feedback, strengths and areas to grow.", "Add first entry", "sup"); var b = $(".empty .btn", el); if (b) b.onclick = function () { openSupModal(); }; syncToggleBtn("#streamSup", "supToggleAll"); return; }
		if (!list.length) { el.innerHTML = '<div class="empty"><h3>No matches</h3><p>Nothing matches “' + esc(q) + '”.</p></div>'; syncToggleBtn("#streamSup", "supToggleAll"); return; }
		var chev = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 6l6 6-6 6"/></svg>';
		el.innerHTML = list.map(function (r, i) {
			var cls = ratingCls(r.rating), pv = preview(r.tasks || r.feedback || r.strengths || r.improvements);
			return '<article class="rec sup ' + (expanded[r.id] ? "open" : "") + '" data-id="' + r.id + '" style="animation-delay:' + (i * 22) + 'ms">' +
				'<div class="rec-summary">' + chev + '<div class="sum-main"><div class="sum-line"><span class="date">' + fmtShort(r.date) + '</span><span class="by">· <b>' + esc(r.supervisor || DB.profile.supervisorName || "—") + "</b></span></div>" +
				(pv ? '<div class="sum-preview">' + esc(pv) + "</div>" : "") + "</div>" +
				'<div class="rec-right">' + (r.rating ? '<span class="chip ' + cls + '">' + esc(r.rating) + "</span>" : "") + (r.hours ? '<span class="chip hours">' + esc(r.hours) + " h</span>" : "") +
				'<button class="icon-btn hide-ro" data-edit="' + r.id + '" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z"/></svg></button>' +
				'<button class="icon-btn del hide-ro" data-del="' + r.id + '" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg></button>' +
				"</div></div>" +
				'<div class="rec-detail">' + segHTML("Tasks &amp; activities", r.tasks) + segHTML("Feedback &amp; comments", r.feedback) +
				'<div class="seg-row">' + segHTML("Strengths observed", r.strengths) + segHTML("Areas for improvement", r.improvements) + "</div>" +
				(r.skills && r.skills.length ? '<div class="seg"><div class="lbl">Skills developed</div>' + skillTags(r.skills) + "</div>" : "") + "</div></article>";
		}).join("");
		wireStream(el, openSupModal, "supervision");
		syncToggleBtn("#streamSup", "supToggleAll");
	}

	function renderMen() {
		var q = ($("#searchMen").value || "").toLowerCase();
		var list = DB.mentorship.slice().sort(function (a, b) { return (b.weekEnding || "").localeCompare(a.weekEnding || ""); }).filter(function (r) { return !q || JSON.stringify(r).toLowerCase().indexOf(q) > -1; });
		$("#ctMen").textContent = DB.mentorship.length;
		var el = $("#streamMen");
		if (!DB.mentorship.length) { el.innerHTML = emptyState("No mentorship records yet", "The mentor adds a weekly reflection — skills covered, progress, challenges and goals for the week ahead.", "Add first entry", "men"); var b = $(".empty .btn", el); if (b) b.onclick = function () { openMenModal(); }; syncToggleBtn("#streamMen", "menToggleAll"); return; }
		if (!list.length) { el.innerHTML = '<div class="empty"><h3>No matches</h3><p>Nothing matches “' + esc(q) + '”.</p></div>'; syncToggleBtn("#streamMen", "menToggleAll"); return; }
		var chev = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 6l6 6-6 6"/></svg>';
		el.innerHTML = list.map(function (r, i) {
			var pv = preview(r.topics || r.progress || r.goals || r.guidance);
			return '<article class="rec men ' + (expanded[r.id] ? "open" : "") + '" data-id="' + r.id + '" style="animation-delay:' + (i * 22) + 'ms">' +
				'<div class="rec-summary">' + chev + '<div class="sum-main"><div class="sum-line"><span class="date">Week of ' + fmtShort(r.weekEnding) + '</span><span class="by">· <b>' + esc(r.mentor || DB.profile.mentorName || "—") + "</b></span></div>" +
				(pv ? '<div class="sum-preview">' + esc(pv) + "</div>" : "") + "</div>" +
				'<div class="rec-right">' +
				'<button class="icon-btn hide-ro" data-edit="' + r.id + '" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z"/></svg></button>' +
				'<button class="icon-btn del hide-ro" data-del="' + r.id + '" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg></button>' +
				"</div></div>" +
				'<div class="rec-detail">' + segHTML("Topics &amp; skills covered", r.topics) +
				'<div class="seg-row">' + segHTML("Progress &amp; accomplishments", r.progress) + segHTML("Challenges", r.challenges) + "</div>" +
				segHTML("Guidance &amp; feedback", r.guidance) + segHTML("Goals for next week", r.goals) +
				(r.skills && r.skills.length ? '<div class="seg"><div class="lbl">Skills developed</div>' + skillTags(r.skills) + "</div>" : "") + "</div></article>";
		}).join("");
		wireStream(el, openMenModal, "mentorship");
		syncToggleBtn("#streamMen", "menToggleAll");
	}

	function emptyState(h, p, btn, kind) {
		return '<div class="empty"><svg class="em-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></svg><h3>' + h + "</h3><p>" + p + "</p>" +
			'<button class="btn ' + kind + ' hide-ro"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>' + btn + "</button></div>";
	}
	function preview(t) { t = (t || "").replace(/\s+/g, " ").trim(); return t.length > 90 ? t.slice(0, 90) + "…" : t; }
	function wireStream(el, opener, coll) {
		$$(".rec-summary", el).forEach(function (sm) {
			sm.onclick = function (e) {
				if (e.target && e.target.closest && e.target.closest(".icon-btn")) return;
				var art = sm.parentNode, id = art.getAttribute("data-id");
				var willOpen = !art.classList.contains("open");
				art.classList.toggle("open", willOpen); expanded[id] = willOpen; resize();
			};
		});
		$$("[data-edit]", el).forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); opener(b.getAttribute("data-edit")); }; });
		$$("[data-del]", el).forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); var id = b.getAttribute("data-del"); askConfirm("Delete this record? This action cannot be undone.", function () { DB[coll] = DB[coll].filter(function (r) { return r.id !== id; }); delete expanded[id]; persist(); renderAll(); notify("Record deleted", "info"); }); }; });
	}
	function toggleAll(streamSel, btnId) {
		var recs = $$(streamSel + " .rec"); if (!recs.length) return;
		var anyClosed = recs.filter(function (a) { return !a.classList.contains("open"); }).length > 0;
		recs.forEach(function (a) { a.classList.toggle("open", anyClosed); expanded[a.getAttribute("data-id")] = anyClosed; });
		syncToggleBtn(streamSel, btnId); resize();
	}
	function syncToggleBtn(streamSel, btnId) {
		var btn = $("#" + btnId); if (!btn) return;
		var recs = $$(streamSel + " .rec");
		var allOpen = recs.length > 0 && recs.filter(function (a) { return !a.classList.contains("open"); }).length === 0;
		btn.textContent = allOpen ? "Collapse all" : "Expand all";
		btn.style.display = recs.length ? "" : "none";
	}

	function renderOverview() {
		var s = DB.supervision, m = DB.mentorship, p = DB.profile;
		var lastSup = s.slice().sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); })[0];
		var lastMen = m.slice().sort(function (a, b) { return (b.weekEnding || "").localeCompare(a.weekEnding || ""); })[0];
		var totalHours = s.reduce(function (t, r) { return t + (parseFloat(r.hours) || 0); }, 0);
		var feed = [].concat(s.map(function (r) { return { k: "sup", d: r.date, t: "Supervision — <b>" + esc(r.supervisor || p.supervisorName || "supervisor") + "</b>", note: r.rating || (r.feedback || "").slice(0, 60) }; }))
			.concat(m.map(function (r) { return { k: "men", d: r.weekEnding, t: "Mentorship — week of <b>" + esc(p.employeeName || "employee") + "</b>", note: (r.topics || r.goals || "").slice(0, 60) }; }))
			.filter(function (x) { return x.d; }).sort(function (a, b) { return (b.d || "").localeCompare(a.d || ""); }).slice(0, 6);
		var counts = RATINGS.map(function (r) { return { v: r.v, cls: r.cls, n: s.filter(function (x) { return x.rating === r.v; }).length }; });
		var maxN = Math.max.apply(null, [1].concat(counts.map(function (c) { return c.n; })));
		var rated = counts.reduce(function (t, c) { return t + c.n; }, 0);
		var colors = { ok: "var(--ok)", meets: "var(--sup)", dev: "var(--dev)", warn: "var(--warn)" };
		var skills = getSkills();
		var cov = skills.map(function (sk) { var n = 0; s.concat(m).forEach(function (r) { if (r.skills && r.skills.indexOf(sk) > -1) n++; }); return { sk: sk, n: n }; });
		var covMax = Math.max.apply(null, [1].concat(cov.map(function (c) { return c.n; })));
		var covered = cov.filter(function (c) { return c.n > 0; }).length;
		function stat(k, n, sub, tick) { return '<div class="stat"><span class="tick" style="background:' + tick + '"></span><div class="k">' + k + '</div><div class="n">' + n + '</div><div class="sub">' + sub + "</div></div>"; }
		$("#view-overview").innerHTML =
			'<div class="stat-grid">' + stat("Supervision entries", s.length, lastSup ? "Last: " + fmtShort(lastSup.date) : "None logged yet", "var(--sup)") +
			stat("Mentorship entries", m.length, lastMen ? "Last week: " + fmtShort(lastMen.weekEnding) : "None logged yet", "var(--men)") +
			stat("Hours supervised", totalHours || "0", totalHours ? "Sum of logged hours" : "Add hours per entry", "var(--ink-soft)") +
			stat("Skills covered", covered + "/" + skills.length, "Of committed CSJ skills", "var(--leaf)") + "</div>" +
			'<div class="ov-cols"><div class="panel"><div class="panel-head"><h3>Recent activity</h3></div><div class="panel-body">' +
			(feed.length ? '<ul class="feed">' + feed.map(function (f) { return '<li><span class="marker ' + f.k + '"></span><div class="fc"><div class="ft">' + f.t + '</div><div class="fd">' + fmtShort(f.d) + (f.note ? " · " + esc(f.note) : "") + "</div></div></li>"; }).join("") + "</ul>" : '<p class="muted-note">No records logged yet. Add a supervision or mentorship entry to get started.</p>') +
			"</div></div><div class=\"panel\"><div class=\"panel-head\"><h3>Supervision ratings</h3></div><div class=\"panel-body\">" +
			(rated ? '<div class="ratings">' + counts.map(function (c) { return '<div class="rrow"><span>' + c.v + '</span><div class="bar"><i style="width:' + (c.n / maxN * 100) + "%;background:" + colors[c.cls] + '"></i></div><span class="cnt">' + c.n + "</span></div>"; }).join("") + "</div>" : '<p class="muted-note">Ratings appear here once supervision entries include an assessment.</p>') +
			"</div></div></div>" +
			'<div class="panel" style="margin-top:18px"><div class="panel-head"><h3>CSJ skills coverage</h3><span class="eyebrow">' + covered + " of " + skills.length + " developed</span></div><div class=\"panel-body\"><div class=\"ratings\">" +
			cov.map(function (c) { return '<div class="rrow cov"><span>' + (c.n ? '<svg class="ck" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>' : '<span class="ck off"></span>') + esc(c.sk) + '</span><div class="bar"><i style="width:' + (c.n / covMax * 100) + '%;background:' + (c.n ? "var(--leaf)" : "var(--line-strong)") + '"></i></div><span class="cnt">' + c.n + "</span></div>"; }).join("") +
			'</div><p class="muted-note" style="margin-top:12px">Tag each entry with the skills it touched. Aim to have every committed skill addressed across the term.</p></div></div>';
	}

	/* ============================================================ MODAL */
	var modalSave = null;
	function openModal(opts) {
		var mo = $("#modal"); mo.classList.toggle("men", opts.kind === "men");
		$("#mEyebrow").textContent = opts.eyebrow || ""; $("#mTitle").textContent = opts.title || ""; $("#mBody").innerHTML = opts.body || "";
		modalSave = opts.onSave || null;
		var save = $("#mSave"), cancel = $("#mCancel");
		save.style.display = opts.hideSave ? "none" : ""; save.textContent = opts.saveLabel || "Save record"; save.classList.toggle("danger-btn", !!opts.danger);
		cancel.textContent = opts.cancelLabel || "Cancel";
		$("#overlay").classList.add("open"); resize();
		var first = $("#mBody input,#mBody select,#mBody textarea,#mBody .skill-chip"); if (first) setTimeout(function () { try { first.focus(); } catch (e) { } }, 60);
	}
	function closeModal() { $("#overlay").classList.remove("open"); modalSave = null; resize(); }
	function fieldHTML(id, label, val, o) {
		o = o || {};
		var lab = '<label for="' + id + '">' + label + (o.req ? ' <span class="req">*</span>' : "") + "</label>";
		var ctrl;
		if (o.opts) ctrl = '<select id="' + id + '">' + o.opts.map(function (op) { return '<option ' + (op === val ? "selected" : "") + ">" + esc(op) + "</option>"; }).join("") + "</select>";
		else if (o.ta) ctrl = '<textarea id="' + id + '" placeholder="' + esc(o.ph || "") + '">' + esc(val || "") + "</textarea>";
		else ctrl = '<input id="' + id + '" type="' + (o.type || "text") + '" value="' + esc(val || "") + '" placeholder="' + esc(o.ph || "") + '" ' + (o.extra || "") + (o.disabled ? " disabled" : "") + ">";
		return '<div class="grp" id="grp-' + id + '">' + lab + ctrl + (o.note ? '<span class="hint">' + esc(o.note) + "</span>" : "") + '<span class="err">This field is required.</span></div>';
	}
	function skillPickHTML(selected) { selected = selected || []; return '<div class="grp"><label>Skills developed</label><div class="skills-pick" id="skillPick">' + getSkills().map(function (s) { return '<button type="button" class="skill-chip ' + (selected.indexOf(s) > -1 ? "on" : "") + '" data-skill="' + esc(s) + '">' + esc(s) + "</button>"; }).join("") + "</div></div>"; }
	function wireSkillChips() { $$("#skillPick .skill-chip").forEach(function (b) { b.onclick = function () { b.classList.toggle("on"); }; }); }
	function readSkills() { return $$("#skillPick .skill-chip.on").map(function (b) { return b.getAttribute("data-skill"); }); }
	function markInvalid(id) { var g = $("#grp-" + id); g.classList.add("invalid"); var inp = $("#" + id); try { inp.focus(); } catch (e) { } inp.oninput = function () { g.classList.remove("invalid"); }; }

	function askConfirm(message, onYes) { openModal({ kind: "neutral", eyebrow: "Please confirm", title: "Are you sure?", body: '<p class="confirm-msg">' + esc(message) + "</p>", saveLabel: "Delete", danger: true, cancelLabel: "Keep", onSave: function () { onYes(); return true; } }); }

	function openProfileModal() {
		if (readOnly) return;
		var p = DB.profile, linked = linkedNameField();
		var body = fieldHTML("f_name", "Employee name", p.employeeName, { req: true, ph: "e.g. Jordan Lee", disabled: !!linked, note: linked ? "Synced from form field “" + linked + "”." : "" }) +
			'<div class="grp two">' + fieldHTML("f_pos", "Position / title", p.position, { ph: "e.g. Communications Assistant" }) + fieldHTML("f_org", "Organization", p.organization, { ph: "e.g. Riverside Community Centre" }) + "</div>" +
			'<div class="grp two">' + fieldHTML("f_sup", "Supervisor name", p.supervisorName, { ph: "Daily supervisor" }) + fieldHTML("f_men", "Mentor name", p.mentorName, { ph: "Weekly mentor" }) + "</div>" +
			'<div class="grp two">' + fieldHTML("f_start", "Start date", p.startDate, { type: "date" }) + fieldHTML("f_end", "End date", p.endDate, { type: "date" }) + "</div>";
		openModal({
			kind: "sup", eyebrow: "Employee Profile", title: "Employee details", body: body, onSave: function () {
				var name = linked ? p.employeeName : $("#f_name").value.trim(); if (!name) { markInvalid("f_name"); return false; }
				DB.profile = { employeeName: name, position: $("#f_pos").value.trim(), organization: $("#f_org").value.trim(), supervisorName: $("#f_sup").value.trim(), mentorName: $("#f_men").value.trim(), startDate: $("#f_start").value, endDate: $("#f_end").value };
				persist(); renderAll(); notify("Profile updated"); return true;
			}
		});
	}

	function openSupModal(id) {
		if (readOnly) return;
		var r = id ? DB.supervision.filter(function (x) { return x.id === id; })[0] : {};
		var author = r.supervisor || DB.profile.supervisorName || (currentUser ? currentUser.name : "");
		var body = '<div class="grp two">' + fieldHTML("s_date", "Date", r.date || today(), { type: "date", req: true }) + fieldHTML("s_sup", "Supervisor", author, { ph: "Name" }) + "</div>" +
			fieldHTML("s_tasks", "Tasks &amp; activities observed", r.tasks, { ta: true, ph: "What did the employee work on today?" }) +
			fieldHTML("s_fb", "Feedback &amp; comments", r.feedback, { ta: true, ph: "Specific, constructive feedback for the day." }) +
			'<div class="grp two">' + fieldHTML("s_str", "Strengths observed", r.strengths, { ta: true, ph: "What went well?" }) + fieldHTML("s_imp", "Areas for improvement", r.improvements, { ta: true, ph: "What to focus on next?" }) + "</div>" +
			'<div class="grp two">' + fieldHTML("s_rate", "Overall assessment", r.rating || "Meets expectations", { opts: RATINGS.map(function (x) { return x.v; }) }) + fieldHTML("s_hrs", "Hours worked", r.hours, { type: "number", ph: "e.g. 7.5", extra: 'step="0.25" min="0"' }) + "</div>" + skillPickHTML(r.skills);
		openModal({
			kind: "sup", eyebrow: id ? "Edit · Daily Supervision" : "New · Daily Supervision", title: id ? "Edit supervision record" : "Daily supervision record", body: body, onSave: function () {
				var date = $("#s_date").value; if (!date) { markInvalid("s_date"); return false; }
				var rec = { id: id || uid(), date: date, supervisor: $("#s_sup").value.trim(), tasks: $("#s_tasks").value.trim(), feedback: $("#s_fb").value.trim(), strengths: $("#s_str").value.trim(), improvements: $("#s_imp").value.trim(), rating: $("#s_rate").value, hours: $("#s_hrs").value.trim(), skills: readSkills(), createdBy: r.createdBy || (currentUser ? currentUser.name : ""), createdAt: r.createdAt || new Date().toISOString() };
				if (id) DB.supervision = DB.supervision.map(function (x) { return x.id === id ? rec : x; }); else DB.supervision.push(rec);
				persist(); renderAll(); notify(id ? "Supervision record updated" : "Supervision record added"); return true;
			}
		});
		wireSkillChips();
	}

	function openMenModal(id) {
		if (readOnly) return;
		var r = id ? DB.mentorship.filter(function (x) { return x.id === id; })[0] : {};
		var author = r.mentor || DB.profile.mentorName || (currentUser ? currentUser.name : "");
		var body = '<div class="grp two">' + fieldHTML("m_we", "Week ending", r.weekEnding || today(), { type: "date", req: true }) + fieldHTML("m_men", "Mentor", author, { ph: "Name" }) + "</div>" +
			fieldHTML("m_top", "Topics &amp; skills covered", r.topics, { ta: true, ph: "What was discussed or developed this week?" }) +
			'<div class="grp two">' + fieldHTML("m_prog", "Progress &amp; accomplishments", r.progress, { ta: true, ph: "Wins and growth this week." }) + fieldHTML("m_chal", "Challenges", r.challenges, { ta: true, ph: "Obstacles or struggles." }) + "</div>" +
			fieldHTML("m_guid", "Guidance &amp; feedback", r.guidance, { ta: true, ph: "Advice and direction provided." }) +
			fieldHTML("m_goals", "Goals for next week", r.goals, { ta: true, ph: "What to aim for in the coming week." }) + skillPickHTML(r.skills);
		openModal({
			kind: "men", eyebrow: id ? "Edit · Weekly Mentorship" : "New · Weekly Mentorship", title: id ? "Edit mentorship record" : "Weekly mentorship record", body: body, onSave: function () {
				var we = $("#m_we").value; if (!we) { markInvalid("m_we"); return false; }
				var rec = { id: id || uid(), weekEnding: we, mentor: $("#m_men").value.trim(), topics: $("#m_top").value.trim(), progress: $("#m_prog").value.trim(), challenges: $("#m_chal").value.trim(), guidance: $("#m_guid").value.trim(), goals: $("#m_goals").value.trim(), skills: readSkills(), createdBy: r.createdBy || (currentUser ? currentUser.name : ""), createdAt: r.createdAt || new Date().toISOString() };
				if (id) DB.mentorship = DB.mentorship.map(function (x) { return x.id === id ? rec : x; }); else DB.mentorship.push(rec);
				persist(); renderAll(); notify(id ? "Mentorship record updated" : "Mentorship record added"); return true;
			}
		});
		wireSkillChips();
	}

	/* ============================================================ EXPORT */
	function openExportModal() {
		var body = '<div class="exp-block"><div class="exp-h">Document export</div><div class="grp"><label>Records to include</label><div class="seg-toggle" id="expScope">' +
			'<button type="button" class="seg-btn on" data-scope="both">Both</button><button type="button" class="seg-btn" data-scope="sup">Supervision</button><button type="button" class="seg-btn" data-scope="men">Mentorship</button></div></div>' +
			'<div class="exp-opts"><button type="button" class="btn primary" id="expPdf"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg> Download PDF</button>' +
			'<button type="button" class="btn" id="expXls"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M3 9h18"/></svg> Download Excel</button></div></div>' +
			'<div class="exp-block"><div class="exp-h">Data backup (JSON)</div><p class="muted-note">Full structured copy of every record — use to back up or move data between forms.</p>' +
			'<div class="exp-opts"><button type="button" class="btn" id="expJson"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg> Download JSON</button></div></div>';
		openModal({ kind: "neutral", eyebrow: "Export", title: "Export records", body: body, hideSave: true, cancelLabel: "Close" });
		var scope = "both";
		$$("#expScope .seg-btn").forEach(function (b) { b.onclick = function () { $$("#expScope .seg-btn").forEach(function (x) { x.classList.remove("on"); }); b.classList.add("on"); scope = b.getAttribute("data-scope"); }; });
		$("#expPdf").onclick = function () { exportPdf(scope); };
		$("#expXls").onclick = function () { exportXlsx(scope); };
		$("#expJson").onclick = function () { exportJSON(); };
	}
	function fileBase() { return "csj_" + (DB.profile.employeeName || "employee").replace(/[^a-z0-9]+/gi, "_").toLowerCase() + "_" + today(); }
	function download(blob, name) { var url = URL.createObjectURL(blob); var a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100); }
	function supSorted() { return DB.supervision.slice().sort(function (a, b) { return (a.date || "").localeCompare(b.date || ""); }); }
	function menSorted() { return DB.mentorship.slice().sort(function (a, b) { return (a.weekEnding || "").localeCompare(b.weekEnding || ""); }); }

	function exportPdf(scope) {
		if (!window.jspdf || !window.jspdf.jsPDF) { notify("PDF library is still loading — please try again in a moment.", "warning"); return; }
		var jsPDF = window.jspdf.jsPDF, doc = new jsPDF({ unit: "pt", format: "a4" }), p = DB.profile, M = 40, W = doc.internal.pageSize.getWidth();
		doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(33, 29, 22); doc.text(reportTitle(), M, 52);
		doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(120, 110, 95); doc.text("CANADA SUMMER JOBS  ·  Generated " + today(), M, 68);
		doc.setDrawColor(204, 191, 164); doc.setLineWidth(1.2); doc.line(M, 78, W - M, 78);
		doc.autoTable({ startY: 90, body: [["Employee", p.employeeName || "—", "Position", p.position || "—"], ["Organization", p.organization || "—", "Term", (p.startDate ? fmtShort(p.startDate) : "—") + " – " + (p.endDate ? fmtShort(p.endDate) : "—")], ["Supervisor", p.supervisorName || "—", "Mentor", p.mentorName || "—"]], theme: "plain", styles: { fontSize: 9, cellPadding: 3 }, columnStyles: { 0: { fontStyle: "bold", textColor: [120, 110, 95], cellWidth: 80 }, 2: { fontStyle: "bold", textColor: [120, 110, 95], cellWidth: 80 } }, margin: { left: M, right: M } });
		var y = doc.lastAutoTable.finalY + 16;
		function footer() { var ph = doc.internal.pageSize.getHeight(); doc.setFontSize(8); doc.setTextColor(150, 140, 125); doc.text("Canada Summer Jobs — Supervision & Mentorship Record", M, ph - 20); doc.text("Page " + doc.internal.getNumberOfPages(), W - M, ph - 20, { align: "right" }); }
		function sectionTitle(t, color) { if (y > doc.internal.pageSize.getHeight() - 110) { doc.addPage(); y = 56; } doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(color[0], color[1], color[2]); doc.text(t, M, y); y += 8; doc.setDrawColor(color[0], color[1], color[2]); doc.setLineWidth(1.5); doc.line(M, y, W - M, y); y += 12; }
		function recBlock(title, rows, color) { rows = rows.filter(function (r) { return r[1]; }); doc.autoTable({ startY: y, head: [[{ content: title, colSpan: 2, styles: { fillColor: color, textColor: 255, halign: "left", fontStyle: "bold", fontSize: 9.5 } }]], body: rows.length ? rows : [["—", "No detail recorded."]], theme: "grid", styles: { fontSize: 9, cellPadding: 5, valign: "top", overflow: "linebreak", lineColor: [225, 216, 198], textColor: [60, 54, 46] }, columnStyles: { 0: { cellWidth: 130, fontStyle: "bold", textColor: [110, 100, 88], fillColor: [248, 243, 233] }, 1: { cellWidth: "auto" } }, margin: { left: M, right: M }, didDrawPage: footer }); y = doc.lastAutoTable.finalY + 12; }
		var SUP = [27, 93, 104], MEN = [168, 93, 40];
		if (scope !== "men") { sectionTitle("Daily Supervision Records (" + DB.supervision.length + ")", SUP); var sl = supSorted(); if (!sl.length) { doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(140, 130, 115); doc.text("No supervision records.", M, y); y += 20; } sl.forEach(function (r) { recBlock(fmtDate(r.date) + "  —  " + (r.supervisor || p.supervisorName || "Supervisor") + (r.rating ? "  ·  " + r.rating : "") + (r.hours ? "  ·  " + r.hours + " h" : ""), [["Tasks & activities", r.tasks], ["Feedback & comments", r.feedback], ["Strengths observed", r.strengths], ["Areas for improvement", r.improvements], ["Skills developed", (r.skills || []).join(", ")]], SUP); }); }
		if (scope !== "sup") { if (scope === "both") y += 6; sectionTitle("Weekly Mentorship Records (" + DB.mentorship.length + ")", MEN); var ml = menSorted(); if (!ml.length) { doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(140, 130, 115); doc.text("No mentorship records.", M, y); y += 20; } ml.forEach(function (r) { recBlock("Week ending " + fmtDate(r.weekEnding) + "  —  " + (r.mentor || p.mentorName || "Mentor"), [["Topics & skills covered", r.topics], ["Progress & accomplishments", r.progress], ["Challenges", r.challenges], ["Guidance & feedback", r.guidance], ["Goals for next week", r.goals], ["Skills developed", (r.skills || []).join(", ")]], MEN); }); }
		footer(); doc.save(fileBase() + ".pdf"); notify("PDF downloaded"); closeModal();
	}

	function exportXlsx(scope) {
		if (!window.XLSX) { exportCsvFallback(scope); return; }
		var X = window.XLSX, p = DB.profile, wb = X.utils.book_new();
		var prof = [["Field", "Value"], ["Employee", p.employeeName], ["Position", p.position], ["Organization", p.organization], ["Start date", p.startDate], ["End date", p.endDate], ["Supervisor", p.supervisorName], ["Mentor", p.mentorName], ["Generated", today()]];
		var ws0 = X.utils.aoa_to_sheet(prof); ws0["!cols"] = [{ wch: 16 }, { wch: 48 }]; X.utils.book_append_sheet(wb, ws0, "Profile");
		if (scope !== "men") { var sh = [["Date", "Supervisor", "Tasks & activities", "Feedback & comments", "Strengths", "Areas for improvement", "Assessment", "Hours", "Skills developed"]]; supSorted().forEach(function (r) { sh.push([r.date, r.supervisor, r.tasks, r.feedback, r.strengths, r.improvements, r.rating, r.hours, (r.skills || []).join(", ")]); }); var ws1 = X.utils.aoa_to_sheet(sh); ws1["!cols"] = [{ wch: 12 }, { wch: 18 }, { wch: 34 }, { wch: 38 }, { wch: 28 }, { wch: 28 }, { wch: 18 }, { wch: 7 }, { wch: 30 }]; X.utils.book_append_sheet(wb, ws1, "Supervision"); }
		if (scope !== "sup") { var mh = [["Week ending", "Mentor", "Topics & skills", "Progress & accomplishments", "Challenges", "Guidance & feedback", "Goals for next week", "Skills developed"]]; menSorted().forEach(function (r) { mh.push([r.weekEnding, r.mentor, r.topics, r.progress, r.challenges, r.guidance, r.goals, (r.skills || []).join(", ")]); }); var ws2 = X.utils.aoa_to_sheet(mh); ws2["!cols"] = [{ wch: 12 }, { wch: 18 }, { wch: 34 }, { wch: 34 }, { wch: 28 }, { wch: 34 }, { wch: 32 }, { wch: 30 }]; X.utils.book_append_sheet(wb, ws2, "Mentorship"); }
		var skills = getSkills(), cv = [["Skill", "Times referenced", "Covered"]]; skills.forEach(function (sk) { var n = 0; DB.supervision.concat(DB.mentorship).forEach(function (r) { if (r.skills && r.skills.indexOf(sk) > -1) n++; }); cv.push([sk, n, n ? "Yes" : "No"]); }); var ws3 = X.utils.aoa_to_sheet(cv); ws3["!cols"] = [{ wch: 28 }, { wch: 16 }, { wch: 10 }]; X.utils.book_append_sheet(wb, ws3, "Skills Coverage");
		X.writeFile(wb, fileBase() + ".xlsx"); notify("Excel workbook downloaded"); closeModal();
	}
	function csvCell(v) { v = v == null ? "" : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
	function exportCsvFallback(scope) {
		var rows = [];
		if (scope !== "men") { rows.push(["DAILY SUPERVISION"]); rows.push(["Date", "Supervisor", "Tasks", "Feedback", "Strengths", "Areas for improvement", "Assessment", "Hours", "Skills"]); supSorted().forEach(function (r) { rows.push([r.date, r.supervisor, r.tasks, r.feedback, r.strengths, r.improvements, r.rating, r.hours, (r.skills || []).join("; ")]); }); rows.push([]); }
		if (scope !== "sup") { rows.push(["WEEKLY MENTORSHIP"]); rows.push(["Week ending", "Mentor", "Topics", "Progress", "Challenges", "Guidance", "Goals", "Skills"]); menSorted().forEach(function (r) { rows.push([r.weekEnding, r.mentor, r.topics, r.progress, r.challenges, r.guidance, r.goals, (r.skills || []).join("; ")]); }); }
		var csv = rows.map(function (r) { return r.map(csvCell).join(","); }).join("\n");
		download(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), fileBase() + ".csv"); notify("Excel library unavailable — exported CSV instead.", "info"); closeModal();
	}
	function exportJSON() { download(new Blob([JSON.stringify(DB, null, 2)], { type: "application/json" }), fileBase() + ".json"); notify("JSON backup downloaded"); closeModal(); }
	function importJSON(file) { var rd = new FileReader(); rd.onload = function () { try { var data = JSON.parse(rd.result); if (!data || typeof data !== "object") throw 0; DB = { profile: Object.assign({ employeeName: "", position: "", organization: "", startDate: "", endDate: "", mentorName: "", supervisorName: "" }, data.profile || {}), supervision: Array.isArray(data.supervision) ? data.supervision : [], mentorship: Array.isArray(data.mentorship) ? data.mentorship : [] }; syncLinkedName(); persist(); renderAll(); notify("Records imported"); } catch (e) { notify("Could not read that file — choose a valid CSJ JSON backup.", "error"); } }; rd.readAsText(file); }

	/* ============================================================ READ-ONLY / TABS / LINK */
	function applyReadonly() { (ROOT || document.body).classList.toggle("readonly", readOnly); }
	function setTheme(name) { if (!ROOT) return; ROOT.classList.toggle("theme-dark", name === "dark"); $$("#themeToggle button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-theme") === name); }); }
	function lockUI(ro) { readOnly = (ro === undefined) ? tool.isReadOnly() : ro; applyReadonly(); if (readOnly && $("#overlay").classList.contains("open")) closeModal(); }
	function switchTab(name) { $$(".tab").forEach(function (t) { t.classList.toggle("active", t.getAttribute("data-tab") === name); }); $$(".view").forEach(function (v) { v.classList.toggle("active", v.id === "view-" + name); }); resize(); }
	function syncLinkedName(fields) { var f = linkedNameField(); if (!f) return; var all = fields || (tool.getFields ? tool.getFields() : {}); if (all && all[f] != null && all[f] !== "") { DB.profile.employeeName = String(all[f]); } }

	/* ============================================================ BIND + INIT */
	function bind() {
		$$(".tab").forEach(function (t) { t.onclick = function () { switchTab(t.getAttribute("data-tab")); }; });
		$("#addSup").onclick = function () { openSupModal(); };
		$("#addMen").onclick = function () { openMenModal(); };
		$("#searchSup").oninput = renderSup; $("#searchMen").oninput = renderMen;
		$("#mClose").onclick = closeModal; $("#mCancel").onclick = closeModal;
		$("#mSave").onclick = function () { if (modalSave && modalSave() !== false) closeModal(); };
		$("#overlay").onclick = function (e) { if (e.target === $("#overlay")) closeModal(); };
		document.addEventListener("keydown", function (e) { if (e.key === "Escape" && $("#overlay").classList.contains("open")) closeModal(); });
		$("#exportBtn").onclick = openExportModal;
		$("#importBtn").onclick = function () { if (!readOnly) $("#importFile").click(); };
		$("#importFile").onchange = function (e) { if (e.target.files[0]) importJSON(e.target.files[0]); e.target.value = ""; };
		$$("#themeToggle button").forEach(function (b) { b.onclick = function () { setTheme(b.getAttribute("data-theme")); }; });
		var st = $("#supToggleAll"); if (st) st.onclick = function () { toggleAll("#streamSup", "supToggleAll"); };
		var mt = $("#menToggleAll"); if (mt) mt.onclick = function () { toggleAll("#streamMen", "menToggleAll"); };
	}

	tool.onReady(function (val, fields) {
		ROOT = document.querySelector(".csj");
		bind();
		setTheme("light");
		try {
			tool.declareOutput({ type: "object", properties: { profile: { type: "object" }, supervision: { type: "array", items: { type: "object" } }, mentorship: { type: "array", items: { type: "object" } } } });
			tool.declareParams([
				{ name: "skills", label: "Skills to develop (CSJ)", type: "text", default: DEFAULT_SKILLS.join(", "), hint: "Comma-separated list from the application's “skills” question." },
				{ name: "employeeNameField", label: "Employee-name field ID (optional)", type: "text", default: "", hint: "If set, the employee name is pulled from this sibling form field." },
				{ name: "reportTitle", label: "Report title", type: "text", default: "Supervision & Mentorship Record", hint: "Heading used in PDF / Excel exports." }
			]);
		} catch (e) { }
		if (val && typeof val === "object") { DB.profile = Object.assign(DB.profile, val.profile || {}); DB.supervision = Array.isArray(val.supervision) ? val.supervision : []; DB.mentorship = Array.isArray(val.mentorship) ? val.mentorship : []; }
		currentUser = (tool.getUser && tool.getUser()) || null;
		syncLinkedName(fields);
		readOnly = tool.isReadOnly();
		renderAll(); updateValidity();
		tool.onValueChange(function (v) { if (v && typeof v === "object") { DB.profile = Object.assign({ employeeName: "", position: "", organization: "", startDate: "", endDate: "", mentorName: "", supervisorName: "" }, v.profile || {}); DB.supervision = Array.isArray(v.supervision) ? v.supervision : []; DB.mentorship = Array.isArray(v.mentorship) ? v.mentorship : []; syncLinkedName(); renderAll(); updateValidity(); } });
		tool.onFieldsChange(function (f) { var before = DB.profile.employeeName; syncLinkedName(f); if (DB.profile.employeeName !== before) { renderDossier(); updateValidity(); } });
		tool.onReadonlyChange(function (ro) { lockUI(ro); });
		tool.onUserChange(function (u) { currentUser = u || null; });
		if (!DB.profile.employeeName && !linkedNameField() && !readOnly) setTimeout(openProfileModal, 350);
	});
})();