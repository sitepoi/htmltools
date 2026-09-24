/* ============================================================
   Uniconhub CMS html-tool — single-stream record log
   JS field (paste WITHOUT a <script> tag). IIFE-wrapped.
   Entry point: tool.onReady. Driven by the CFG block below.
   ============================================================ */
(function () {
	"use strict";

	/* ===== CONFIG (build-injected) ===== */
	var CFG = {
		accent: "sup",
		weekly: false,
		roleLabel: "Supervisor",
		streamNoun: "Supervision",
		cadenceLabel: "Daily Supervision",
		recordNoun: "supervision record",
		reportTitleDefault: "Daily Supervision Record",
		pdfSectionTitle: "Daily Supervision Records",
		pdfColor: [22, 112, 125],
		excelSheet: "Supervision",
		fileTag: "csj_supervision",
		emptyTitle: "No supervision records yet",
		emptyBody: "Log a daily observation \u2014 tasks worked on, feedback, strengths and areas to grow.",
		dateField: { id: "date", label: "Date" },
		authorField: { id: "supervisor", label: "Supervisor" },
		hasRating: true,
		hasHours: true,
		fields: [
			{ id: "tasks", label: "Tasks & activities observed", ph: "What did the employee work on today?" },
			{ id: "feedback", label: "Feedback & comments", ph: "Specific, constructive feedback for the day." },
			{ id: "strengths", label: "Strengths observed", ph: "What went well?", half: true },
			{ id: "improvements", label: "Areas for improvement", ph: "What to focus on next?", half: true }
		]
	};

	/* ---- SDK handle + fallback shim ---- */
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

	var DEFAULT_SKILLS = ["Adaptability", "Collaboration", "Communication", "Creativity and Innovation", "Digital skills", "Problem solving", "Technical skills"];
	var RATINGS = [{ v: "Exceeds expectations", cls: "ok" }, { v: "Meets expectations", cls: "meets" }, { v: "Developing", cls: "dev" }, { v: "Needs support", cls: "warn" }];

	var DB = { profile: { employeeName: "", position: "", organization: "", startDate: "", endDate: "", author: "" }, records: [] };
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
	function preview(t) { t = (t || "").replace(/\s+/g, " ").trim(); return t.length > 90 ? t.slice(0, 90) + "…" : t; }
	function dShort(r) { return CFG.weekly ? "Week of " + fmtShort(r[CFG.dateField.id]) : fmtShort(r[CFG.dateField.id]); }
	function dLong(r) { return CFG.weekly ? "Week ending " + fmtDate(r[CFG.dateField.id]) : fmtDate(r[CFG.dateField.id]); }

	/* ---- Params ---- */
	function getSkills() { var s = tool.param("skills", DEFAULT_SKILLS); if (typeof s === "string") s = s.split(/[,\n;]+/).map(function (x) { return x.trim(); }).filter(Boolean); if (!Array.isArray(s) || !s.length) s = DEFAULT_SKILLS.slice(); return s; }
	function linkedNameField() { var v = tool.param("employeeNameField", ""); return (v || "").toString().trim(); }
	function reportTitle() { return tool.param("reportTitle", CFG.reportTitleDefault) || CFG.reportTitleDefault; }

	/* ---- Persistence ---- */
	function persist() { try { tool.setValue(DB); } catch (e) { } updateValidity(); stampSaved(); }
	function stampSaved() { var el = $("#savedAt"); if (el) el.textContent = "Saved " + new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }); }
	function updateValidity() { var ok = !!(DB.profile.employeeName && DB.profile.employeeName.trim()); try { tool.reportValid(ok, ok ? "" : "Enter the employee's name before saving."); } catch (e) { } }

	/* ============================================================ RENDER */
	function renderAll() { renderDossier(); renderOverview(); renderList(); applyReadonly(); updateMeta(); resize(); }
	function updateMeta() { var el = $("#recMeta"); if (el) el.textContent = DB.records.length + " " + (DB.records.length === 1 ? "entry" : "entries"); }

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
			'<div class="dossier-meta">' + mf(CFG.roleLabel, p.author) + mf("Start", p.startDate ? fmtShort(p.startDate) : "") + mf("End", p.endDate ? fmtShort(p.endDate) : "") + "</div>" + term;
		var ep = $("#editProfile"); if (ep) ep.onclick = openProfileModal;
		requestAnimationFrame(function () { var bar = $(".term-line .prog i"); if (bar) { var w = bar.style.width; bar.style.width = "0"; requestAnimationFrame(function () { bar.style.width = w; }); } });
	}

	function segHTML(l, t) { return t ? '<div class="seg"><div class="lbl">' + esc(l) + '</div><div class="txt">' + esc(t) + "</div></div>" : ""; }
	function skillTags(arr) { if (!arr || !arr.length) return ""; return '<div class="rec-skills">' + arr.map(function (s) { return '<span class="tag">' + esc(s) + "</span>"; }).join("") + "</div>"; }
	function buildDetail(r) {
		var html = "";
		for (var i = 0; i < CFG.fields.length; i++) {
			var f = CFG.fields[i], nx = CFG.fields[i + 1];
			if (f.half && nx && nx.half) { html += '<div class="seg-row">' + segHTML(f.label, r[f.id]) + segHTML(nx.label, r[nx.id]) + "</div>"; i++; }
			else html += segHTML(f.label, r[f.id]);
		}
		if (r.skills && r.skills.length) html += '<div class="seg"><div class="lbl">Skills developed</div>' + skillTags(r.skills) + "</div>";
		return html;
	}

	function renderList() {
		var q = ($("#searchRec").value || "").toLowerCase();
		var list = DB.records.slice().sort(function (a, b) { return (b[CFG.dateField.id] || "").localeCompare(a[CFG.dateField.id] || ""); }).filter(function (r) { return !q || JSON.stringify(r).toLowerCase().indexOf(q) > -1; });
		$("#ctRec").textContent = DB.records.length;
		var el = $("#stream");
		if (!DB.records.length) { el.innerHTML = emptyState(); var b = $(".empty .btn", el); if (b) b.onclick = function () { openRecordModal(); }; syncToggleBtn(); return; }
		if (!list.length) { el.innerHTML = '<div class="empty"><h3>No matches</h3><p>Nothing matches “' + esc(q) + '”.</p></div>'; syncToggleBtn(); return; }
		var chev = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 6l6 6-6 6"/></svg>';
		var ed = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z"/></svg>';
		var dl = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>';
		el.innerHTML = list.map(function (r, i) {
			var pv = preview(r[CFG.fields[0].id] || (CFG.fields[1] && r[CFG.fields[1].id]));
			var chips = "";
			if (CFG.hasRating && r.rating) chips += '<span class="chip ' + ratingCls(r.rating) + '">' + esc(r.rating) + "</span>";
			if (CFG.hasHours && r.hours) chips += '<span class="chip hours">' + esc(r.hours) + " h</span>";
			return '<article class="rec ' + CFG.accent + " " + (expanded[r.id] ? "open" : "") + '" data-id="' + r.id + '" style="animation-delay:' + (i * 22) + 'ms">' +
				'<div class="rec-summary">' + chev + '<div class="sum-main"><div class="sum-line"><span class="date">' + esc(dShort(r)) + '</span><span class="by">· <b>' + esc(r[CFG.authorField.id] || DB.profile.author || "—") + "</b></span></div>" +
				(pv ? '<div class="sum-preview">' + esc(pv) + "</div>" : "") + "</div>" +
				'<div class="rec-right">' + chips +
				'<button class="icon-btn hide-ro" data-edit="' + r.id + '" title="Edit">' + ed + "</button>" +
				'<button class="icon-btn del hide-ro" data-del="' + r.id + '" title="Delete">' + dl + "</button>" +
				"</div></div><div class=\"rec-detail\">" + buildDetail(r) + "</div></article>";
		}).join("");
		wireStream(el);
		syncToggleBtn();
	}

	function emptyState() {
		return '<div class="empty"><svg class="em-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></svg>' +
			"<h3>" + CFG.emptyTitle + "</h3><p>" + CFG.emptyBody + "</p>" +
			'<button class="btn ' + CFG.accent + ' hide-ro"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>Add first entry</button></div>';
	}
	function wireStream(el) {
		$$(".rec-summary", el).forEach(function (sm) { sm.onclick = function (e) { if (e.target && e.target.closest && e.target.closest(".icon-btn")) return; var art = sm.parentNode, id = art.getAttribute("data-id"); var o = !art.classList.contains("open"); art.classList.toggle("open", o); expanded[id] = o; resize(); }; });
		$$("[data-edit]", el).forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); openRecordModal(b.getAttribute("data-edit")); }; });
		$$("[data-del]", el).forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); var id = b.getAttribute("data-del"); askConfirm("Delete this record? This action cannot be undone.", function () { DB.records = DB.records.filter(function (r) { return r.id !== id; }); delete expanded[id]; persist(); renderAll(); notify("Record deleted", "info"); }); }; });
	}
	function toggleAll() { var recs = $$("#stream .rec"); if (!recs.length) return; var anyClosed = recs.filter(function (a) { return !a.classList.contains("open"); }).length > 0; recs.forEach(function (a) { a.classList.toggle("open", anyClosed); expanded[a.getAttribute("data-id")] = anyClosed; }); syncToggleBtn(); resize(); }
	function syncToggleBtn() { var btn = $("#toggleAll"); if (!btn) return; var recs = $$("#stream .rec"); var allOpen = recs.length > 0 && recs.filter(function (a) { return !a.classList.contains("open"); }).length === 0; btn.textContent = allOpen ? "Collapse all" : "Expand all"; btn.style.display = recs.length ? "" : "none"; }

	function renderOverview() {
		var rec = DB.records, p = DB.profile;
		var last = rec.slice().sort(function (a, b) { return (b[CFG.dateField.id] || "").localeCompare(a[CFG.dateField.id] || ""); })[0];
		var totalHours = rec.reduce(function (t, r) { return t + (parseFloat(r.hours) || 0); }, 0);
		var feed = rec.map(function (r) { return { d: r[CFG.dateField.id], t: CFG.streamNoun + " — <b>" + esc(r[CFG.authorField.id] || p.author || CFG.roleLabel.toLowerCase()) + "</b>", note: r.rating || preview(r[CFG.fields[0].id]) }; })
			.filter(function (x) { return x.d; }).sort(function (a, b) { return (b.d || "").localeCompare(a.d || ""); }).slice(0, 6);
		var counts = RATINGS.map(function (r) { return { v: r.v, cls: r.cls, n: rec.filter(function (x) { return x.rating === r.v; }).length }; });
		var maxN = Math.max.apply(null, [1].concat(counts.map(function (c) { return c.n; })));
		var rated = counts.reduce(function (t, c) { return t + c.n; }, 0);
		var colors = { ok: "var(--ok)", meets: "var(--sup)", dev: "var(--dev)", warn: "var(--warn)" };
		var skills = getSkills();
		var cov = skills.map(function (sk) { var n = 0; rec.forEach(function (r) { if (r.skills && r.skills.indexOf(sk) > -1) n++; }); return { sk: sk, n: n }; });
		var covMax = Math.max.apply(null, [1].concat(cov.map(function (c) { return c.n; })));
		var covered = cov.filter(function (c) { return c.n > 0; }).length;
		function stat(k, n, sub, tick) { return '<div class="stat"><span class="tick" style="background:' + tick + '"></span><div class="k">' + k + '</div><div class="n">' + n + '</div><div class="sub">' + sub + "</div></div>"; }
		var stats = stat("Entries", rec.length, last ? "Last: " + fmtShort(last[CFG.dateField.id]) : "None logged yet", "var(--" + CFG.accent + ")") +
			stat("Latest entry", last ? fmtShort(last[CFG.dateField.id]) : "—", last ? "Most recent record" : "Add an entry", "var(--ink-soft)");
		if (CFG.hasHours) stats += stat("Hours logged", totalHours || "0", totalHours ? "Sum of logged hours" : "Add hours per entry", "var(--men)");
		stats += stat("Skills covered", covered + "/" + skills.length, "Of committed CSJ skills", "var(--leaf)");
		var ovHtml = '<div class="stat-grid">' + stats + "</div>" +
			'<div class="ov-cols"><div class="panel"><div class="panel-head"><h3>Recent activity</h3></div><div class="panel-body">' +
			(feed.length ? '<ul class="feed">' + feed.map(function (f) { return '<li><span class="marker ' + CFG.accent + '"></span><div class="fc"><div class="ft">' + f.t + '</div><div class="fd">' + fmtShort(f.d) + (f.note ? " · " + esc(f.note) : "") + "</div></div></li>"; }).join("") + "</ul>" : '<p class="muted-note">No records logged yet. Add an entry to get started.</p>') +
			"</div></div>";
		if (CFG.hasRating) {
			ovHtml += '<div class="panel"><div class="panel-head"><h3>Assessment summary</h3></div><div class="panel-body">' +
				(rated ? '<div class="ratings">' + counts.map(function (c) { return '<div class="rrow"><span>' + c.v + '</span><div class="bar"><i style="width:' + (c.n / maxN * 100) + "%;background:" + colors[c.cls] + '"></i></div><span class="cnt">' + c.n + "</span></div>"; }).join("") + "</div>" : '<p class="muted-note">Ratings appear here once entries include an assessment.</p>') + "</div></div>";
		} else {
			ovHtml += '<div class="panel"><div class="panel-head"><h3>Term snapshot</h3></div><div class="panel-body"><div class="ratings">' +
				'<div class="rrow"><span>Weeks logged</span><div class="bar"><i style="width:100%;background:var(--men)"></i></div><span class="cnt">' + rec.length + "</span></div>" +
				'<div class="rrow"><span>Skills touched</span><div class="bar"><i style="width:' + (covered / Math.max(1, skills.length) * 100) + '%;background:var(--leaf)"></i></div><span class="cnt">' + covered + "</span></div>" +
				"</div></div></div>";
		}
		ovHtml += "</div>" +
			'<div class="panel" style="margin-top:18px"><div class="panel-head"><h3>CSJ skills coverage</h3><span class="eyebrow">' + covered + " of " + skills.length + ' developed</span></div><div class="panel-body"><div class="ratings">' +
			cov.map(function (c) { return '<div class="rrow cov"><span>' + (c.n ? '<svg class="ck" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>' : '<span class="ck off"></span>') + esc(c.sk) + '</span><div class="bar"><i style="width:' + (c.n / covMax * 100) + '%;background:' + (c.n ? "var(--leaf)" : "var(--line-strong)") + '"></i></div><span class="cnt">' + c.n + "</span></div>"; }).join("") +
			'</div><p class="muted-note" style="margin-top:12px">Tag each entry with the skills it touched. Aim to have every committed skill addressed across the term.</p></div></div>';
		$("#view-overview").innerHTML = ovHtml;
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
		var lab = '<label for="' + id + '">' + esc(label) + (o.req ? ' <span class="req">*</span>' : "") + "</label>";
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
			fieldHTML("f_author", CFG.roleLabel + " name", p.author, { ph: CFG.roleLabel + " for this employee" }) +
			'<div class="grp two">' + fieldHTML("f_start", "Start date", p.startDate, { type: "date" }) + fieldHTML("f_end", "End date", p.endDate, { type: "date" }) + "</div>";
		openModal({
			kind: CFG.accent, eyebrow: "Employee Profile", title: "Employee details", body: body, onSave: function () {
				var name = linked ? p.employeeName : $("#f_name").value.trim(); if (!name) { markInvalid("f_name"); return false; }
				DB.profile = { employeeName: name, position: $("#f_pos").value.trim(), organization: $("#f_org").value.trim(), author: $("#f_author").value.trim(), startDate: $("#f_start").value, endDate: $("#f_end").value };
				persist(); renderAll(); notify("Profile updated"); return true;
			}
		});
	}

	function openRecordModal(id) {
		if (readOnly) return;
		var r = id ? DB.records.filter(function (x) { return x.id === id; })[0] : {};
		var author = r[CFG.authorField.id] || DB.profile.author || (currentUser ? currentUser.name : "");
		var body = '<div class="grp two">' + fieldHTML("f_date", CFG.dateField.label, r[CFG.dateField.id] || today(), { type: "date", req: true }) + fieldHTML("f_auth", CFG.authorField.label, author, { ph: "Name" }) + "</div>";
		for (var i = 0; i < CFG.fields.length; i++) {
			var f = CFG.fields[i], nx = CFG.fields[i + 1];
			if (f.half && nx && nx.half) { body += '<div class="grp two">' + fieldHTML("fld_" + f.id, f.label, r[f.id], { ta: true, ph: f.ph }) + fieldHTML("fld_" + nx.id, nx.label, r[nx.id], { ta: true, ph: nx.ph }) + "</div>"; i++; }
			else body += fieldHTML("fld_" + f.id, f.label, r[f.id], { ta: true, ph: f.ph });
		}
		if (CFG.hasRating || CFG.hasHours) {
			body += '<div class="grp two">';
			body += CFG.hasRating ? fieldHTML("f_rate", "Overall assessment", r.rating || "Meets expectations", { opts: RATINGS.map(function (x) { return x.v; }) }) : "";
			body += CFG.hasHours ? fieldHTML("f_hrs", "Hours worked", r.hours, { type: "number", ph: "e.g. 7.5", extra: 'step="0.25" min="0"' }) : "";
			body += "</div>";
		}
		body += skillPickHTML(r.skills);
		openModal({
			kind: CFG.accent, eyebrow: (id ? "Edit · " : "New · ") + CFG.cadenceLabel, title: (id ? "Edit " : "") + CFG.recordNoun, body: body, onSave: function () {
				var dv = $("#f_date").value; if (!dv) { markInvalid("f_date"); return false; }
				var rec = { id: id || uid(), createdBy: r.createdBy || (currentUser ? currentUser.name : ""), createdAt: r.createdAt || new Date().toISOString() };
				rec[CFG.dateField.id] = dv; rec[CFG.authorField.id] = $("#f_auth").value.trim();
				CFG.fields.forEach(function (f) { rec[f.id] = ($("#fld_" + f.id).value || "").trim(); });
				if (CFG.hasRating) rec.rating = $("#f_rate").value;
				if (CFG.hasHours) rec.hours = $("#f_hrs").value.trim();
				rec.skills = readSkills();
				if (id) DB.records = DB.records.map(function (x) { return x.id === id ? rec : x; }); else DB.records.push(rec);
				persist(); renderAll(); notify(id ? "Record updated" : "Record added"); return true;
			}
		});
		wireSkillChips();
	}

	/* ============================================================ EXPORT */
	function openExportModal() {
		var body = '<div class="exp-block"><div class="exp-h">Document export</div><p class="muted-note">A formatted report of all ' + esc(CFG.streamNoun.toLowerCase()) + ' records for this employee.</p>' +
			'<div class="exp-opts"><button type="button" class="btn primary" id="expPdf"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg> Download PDF</button>' +
			'<button type="button" class="btn" id="expXls"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M3 9h18"/></svg> Download Excel</button></div></div>' +
			'<div class="exp-block"><div class="exp-h">Data backup (JSON)</div><p class="muted-note">Full structured copy of every record — use to back up or move data between forms.</p>' +
			'<div class="exp-opts"><button type="button" class="btn" id="expJson"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg> Download JSON</button></div></div>';
		openModal({ kind: CFG.accent, eyebrow: "Export", title: "Export records", body: body, hideSave: true, cancelLabel: "Close" });
		$("#expPdf").onclick = exportPdf; $("#expXls").onclick = exportXlsx; $("#expJson").onclick = exportJSON;
	}
	function fileBase() { return CFG.fileTag + "_" + (DB.profile.employeeName || "employee").replace(/[^a-z0-9]+/gi, "_").toLowerCase() + "_" + today(); }
	function download(blob, name) { var url = URL.createObjectURL(blob); var a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100); }
	function sorted() { return DB.records.slice().sort(function (a, b) { return (a[CFG.dateField.id] || "").localeCompare(b[CFG.dateField.id] || ""); }); }
	function columns() { var c = [CFG.dateField.label, CFG.authorField.label]; CFG.fields.forEach(function (f) { c.push(f.label); }); if (CFG.hasRating) c.push("Assessment"); if (CFG.hasHours) c.push("Hours"); c.push("Skills developed"); return c; }
	function rowOf(r) { var row = [r[CFG.dateField.id], r[CFG.authorField.id]]; CFG.fields.forEach(function (f) { row.push(r[f.id] || ""); }); if (CFG.hasRating) row.push(r.rating || ""); if (CFG.hasHours) row.push(r.hours || ""); row.push((r.skills || []).join(", ")); return row; }

	function exportPdf() {
		if (!window.jspdf || !window.jspdf.jsPDF) { notify("PDF library is still loading — please try again in a moment.", "warning"); return; }
		var jsPDF = window.jspdf.jsPDF, doc = new jsPDF({ unit: "pt", format: "a4" }), p = DB.profile, M = 40, W = doc.internal.pageSize.getWidth();
		doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(27, 30, 35); doc.text(reportTitle(), M, 52);
		doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(120, 125, 132); doc.text("Daily Supervision  ·  Generated " + today(), M, 68);
		doc.setDrawColor(200, 205, 212); doc.setLineWidth(1.2); doc.line(M, 78, W - M, 78);
		doc.autoTable({ startY: 90, body: [["Employee", p.employeeName || "—", "Position", p.position || "—"], ["Organization", p.organization || "—", "Term", (p.startDate ? fmtShort(p.startDate) : "—") + " – " + (p.endDate ? fmtShort(p.endDate) : "—")], [CFG.roleLabel, p.author || "—", "", ""]], theme: "plain", styles: { fontSize: 9, cellPadding: 3 }, columnStyles: { 0: { fontStyle: "bold", textColor: [120, 125, 132], cellWidth: 80 }, 2: { fontStyle: "bold", textColor: [120, 125, 132], cellWidth: 80 } }, margin: { left: M, right: M } });
		var y = doc.lastAutoTable.finalY + 16;
		function footer() { var ph = doc.internal.pageSize.getHeight(); doc.setFontSize(8); doc.setTextColor(150, 155, 162); doc.text(CFG.reportTitleDefault, M, ph - 20); doc.text("Page " + doc.internal.getNumberOfPages(), W - M, ph - 20, { align: "right" }); }
		var AC = CFG.pdfColor;
		doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(AC[0], AC[1], AC[2]); doc.text(CFG.pdfSectionTitle + " (" + DB.records.length + ")", M, y); y += 8;
		doc.setDrawColor(AC[0], AC[1], AC[2]); doc.setLineWidth(1.5); doc.line(M, y, W - M, y); y += 12;
		var list = sorted();
		if (!list.length) { doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(140, 145, 150); doc.text("No records.", M, y); }
		list.forEach(function (r) {
			var rows = CFG.fields.map(function (f) { return [f.label, r[f.id]]; });
			rows.push(["Skills developed", (r.skills || []).join(", ")]);
			rows = rows.filter(function (x) { return x[1]; });
			var head = dLong(r) + "  —  " + (r[CFG.authorField.id] || p.author || CFG.roleLabel) + (CFG.hasRating && r.rating ? "  ·  " + r.rating : "") + (CFG.hasHours && r.hours ? "  ·  " + r.hours + " h" : "");
			doc.autoTable({ startY: y, head: [[{ content: head, colSpan: 2, styles: { fillColor: AC, textColor: 255, halign: "left", fontStyle: "bold", fontSize: 9.5 } }]], body: rows.length ? rows : [["—", "No detail recorded."]], theme: "grid", styles: { fontSize: 9, cellPadding: 5, valign: "top", overflow: "linebreak", lineColor: [225, 228, 232], textColor: [55, 60, 66] }, columnStyles: { 0: { cellWidth: 130, fontStyle: "bold", textColor: [110, 115, 122], fillColor: [244, 246, 248] }, 1: { cellWidth: "auto" } }, margin: { left: M, right: M }, didDrawPage: footer });
			y = doc.lastAutoTable.finalY + 12;
		});
		footer(); doc.save(fileBase() + ".pdf"); notify("PDF downloaded"); closeModal();
	}

	function exportXlsx() {
		if (!window.XLSX) { exportCsvFallback(); return; }
		var X = window.XLSX, p = DB.profile, wb = X.utils.book_new();
		var prof = [["Field", "Value"], ["Employee", p.employeeName], ["Position", p.position], ["Organization", p.organization], ["Start date", p.startDate], ["End date", p.endDate], [CFG.roleLabel, p.author], ["Generated", today()]];
		var ws0 = X.utils.aoa_to_sheet(prof); ws0["!cols"] = [{ wch: 16 }, { wch: 48 }]; X.utils.book_append_sheet(wb, ws0, "Profile");
		var sh = [columns()]; sorted().forEach(function (r) { sh.push(rowOf(r)); });
		var ws1 = X.utils.aoa_to_sheet(sh); ws1["!cols"] = columns().map(function (c, i) { return { wch: i < 2 ? 16 : 30 }; }); X.utils.book_append_sheet(wb, ws1, CFG.excelSheet);
		var skills = getSkills(), cv = [["Skill", "Times referenced", "Covered"]]; skills.forEach(function (sk) { var n = 0; DB.records.forEach(function (r) { if (r.skills && r.skills.indexOf(sk) > -1) n++; }); cv.push([sk, n, n ? "Yes" : "No"]); });
		var ws2 = X.utils.aoa_to_sheet(cv); ws2["!cols"] = [{ wch: 28 }, { wch: 16 }, { wch: 10 }]; X.utils.book_append_sheet(wb, ws2, "Skills Coverage");
		X.writeFile(wb, fileBase() + ".xlsx"); notify("Excel workbook downloaded"); closeModal();
	}
	function csvCell(v) { v = v == null ? "" : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
	function exportCsvFallback() {
		var rows = [columns()]; sorted().forEach(function (r) { rows.push(rowOf(r)); });
		var csv = rows.map(function (r) { return r.map(csvCell).join(","); }).join("\n");
		download(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), fileBase() + ".csv"); notify("Excel library unavailable — exported CSV instead.", "info"); closeModal();
	}
	function exportJSON() { download(new Blob([JSON.stringify(DB, null, 2)], { type: "application/json" }), fileBase() + ".json"); notify("JSON backup downloaded"); closeModal(); }
	function importJSON(file) { var rd = new FileReader(); rd.onload = function () { try { var data = JSON.parse(rd.result); if (!data || typeof data !== "object") throw 0; DB = { profile: Object.assign({ employeeName: "", position: "", organization: "", startDate: "", endDate: "", author: "" }, data.profile || {}), records: Array.isArray(data.records) ? data.records : [] }; syncLinkedName(); persist(); renderAll(); notify("Records imported"); } catch (e) { notify("Could not read that file — choose a valid JSON backup.", "error"); } }; rd.readAsText(file); }

	/* ============================================================ READ-ONLY / TABS / THEME / LINK */
	function applyReadonly() { (ROOT || document.body).classList.toggle("readonly", readOnly); }
	function setTheme(name) { if (!ROOT) return; ROOT.classList.toggle("theme-dark", name === "dark"); $$("#themeToggle button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-theme") === name); }); }
	function lockUI(ro) { readOnly = (ro === undefined) ? tool.isReadOnly() : ro; applyReadonly(); if (readOnly && $("#overlay").classList.contains("open")) closeModal(); }
	function switchTab(name) { $$(".tab").forEach(function (t) { t.classList.toggle("active", t.getAttribute("data-tab") === name); }); $$(".view").forEach(function (v) { v.classList.toggle("active", v.id === "view-" + name); }); resize(); }
	function syncLinkedName(fields) { var f = linkedNameField(); if (!f) return; var all = fields || (tool.getFields ? tool.getFields() : {}); if (all && all[f] != null && all[f] !== "") { DB.profile.employeeName = String(all[f]); } }

	/* ============================================================ BIND + INIT */
	function bind() {
		$$(".tab").forEach(function (t) { t.onclick = function () { switchTab(t.getAttribute("data-tab")); }; });
		$("#addRec").onclick = function () { openRecordModal(); };
		$("#searchRec").oninput = renderList;
		$("#mClose").onclick = closeModal; $("#mCancel").onclick = closeModal;
		$("#mSave").onclick = function () { if (modalSave && modalSave() !== false) closeModal(); };
		$("#overlay").onclick = function (e) { if (e.target === $("#overlay")) closeModal(); };
		document.addEventListener("keydown", function (e) { if (e.key === "Escape" && $("#overlay").classList.contains("open")) closeModal(); });
		$("#exportBtn").onclick = openExportModal;
		$("#importBtn").onclick = function () { if (!readOnly) $("#importFile").click(); };
		$("#importFile").onchange = function (e) { if (e.target.files[0]) importJSON(e.target.files[0]); e.target.value = ""; };
		$$("#themeToggle button").forEach(function (b) { b.onclick = function () { setTheme(b.getAttribute("data-theme")); }; });
		var tg = $("#toggleAll"); if (tg) tg.onclick = toggleAll;
	}

	tool.onReady(function (val, fields) {
		ROOT = document.querySelector(".csj");
		bind(); setTheme("light");
		try {
			tool.declareOutput({ type: "object", properties: { profile: { type: "object" }, records: { type: "array", items: { type: "object" } } } });
			tool.declareParams([
				{ name: "skills", label: "Skills to develop (CSJ)", type: "text", default: DEFAULT_SKILLS.join(", "), hint: "Comma-separated list from the application's “skills” question." },
				{ name: "employeeNameField", label: "Employee-name field ID (optional)", type: "text", default: "", hint: "If set, the employee name is pulled from this sibling form field." },
				{ name: "reportTitle", label: "Report title", type: "text", default: CFG.reportTitleDefault, hint: "Heading used in PDF / Excel exports." }
			]);
		} catch (e) { }
		if (val && typeof val === "object") { DB.profile = Object.assign(DB.profile, val.profile || {}); DB.records = Array.isArray(val.records) ? val.records : []; }
		currentUser = (tool.getUser && tool.getUser()) || null;
		syncLinkedName(fields);
		readOnly = tool.isReadOnly();
		renderAll(); updateValidity();
		tool.onValueChange(function (v) { if (v && typeof v === "object") { DB.profile = Object.assign({ employeeName: "", position: "", organization: "", startDate: "", endDate: "", author: "" }, v.profile || {}); DB.records = Array.isArray(v.records) ? v.records : []; syncLinkedName(); renderAll(); updateValidity(); } });
		tool.onFieldsChange(function (f) { var before = DB.profile.employeeName; syncLinkedName(f); if (DB.profile.employeeName !== before) { renderDossier(); updateValidity(); } });
		tool.onReadonlyChange(function (ro) { lockUI(ro); });
		tool.onUserChange(function (u) { currentUser = u || null; });
		if (!DB.profile.employeeName && !linkedNameField() && !readOnly) setTimeout(openProfileModal, 350);
	});
})();