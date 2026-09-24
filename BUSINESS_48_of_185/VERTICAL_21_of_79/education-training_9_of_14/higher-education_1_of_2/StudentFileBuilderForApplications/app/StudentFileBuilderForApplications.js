/* ── StudentFile Builder for Applications ──
   One-student application preparation file with a mentor.
   Collects achievements, grades, references and supporting
   documents across university, college, IB and other tracks.
   Built for the UniconHub CMS html-tool system.
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
			reportValid: function () { }, notify: function (m) { try { console.log("notify:", m); } catch (e) { } }, resize: function () { }, declareOutput: function () { }, declareParams: function () { },
			reportMissingParams: function () { }, openUrl: function (u) { try { window.open(u, "_blank"); } catch (e) { } }
		};
	}

	/* ── Helpers ── */
	function $(s, r) { return (r || document).querySelector(s); }
	function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
	function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
	function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
	function todayISO() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
	function parseDate(iso) { if (!iso) return null; var p = iso.split("-").map(Number); return new Date(p[0], (p[1] || 1) - 1, p[2] || 1); }
	function fmtDate(iso) { var d = parseDate(iso); if (!d || isNaN(d)) return "—"; return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }
	function daysUntil(iso) { var d = parseDate(iso); if (!d || isNaN(d)) return null; var t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((d - t) / 86400000); }
	function fmtSize(b) { if (!b && b !== 0) return ""; if (b < 1024) return b + " B"; if (b < 1048576) return (b / 1024).toFixed(1) + " KB"; return (b / 1048576).toFixed(1) + " MB"; }
	function fileIcon(t) { t = (t || "").toLowerCase(); if (t.indexOf("pdf") > -1) return "📕"; if (t.indexOf("image") > -1) return "🖼️"; if (t.indexOf("word") > -1 || t.indexOf("document") > -1) return "📘"; if (t.indexOf("sheet") > -1 || t.indexOf("excel") > -1) return "📗"; if (t.indexOf("presentation") > -1 || t.indexOf("powerpoint") > -1) return "📙"; return "📄"; }
	function selOpt(v, cur) { return v === cur ? " selected" : ""; }
	function notify(msg, sev) { try { tool.notify(msg, sev || "success"); } catch (e) { } }
	function resize() { try { tool.resize(); } catch (e) { } }
	function safeOpenUrl(u) { try { tool.openUrl(u); } catch (e) { try { window.open(u, "_blank"); } catch (e2) { } } }

	/* ── Constants ── */
	var APP_TYPES = {
		university: { label: "University", icon: "🎓" },
		college: { label: "College", icon: "🏫" },
		trades: { label: "Trades / Vocational", icon: "🔧" },
		highSchool: { label: "High School", icon: "🎒" },
		ib: { label: "IB Diploma", icon: "📘" },
		other: { label: "Other", icon: "📌" }
	};

	var APP_STATUS_META = {
		planning: { label: "Planning", cls: "bg-gray" },
		preparing: { label: "Preparing", cls: "bg-amber" },
		submitted: { label: "Submitted", cls: "bg-blue" },
		accepted: { label: "Accepted", cls: "bg-green" },
		waitlisted: { label: "Waitlisted", cls: "bg-purple" },
		rejected: { label: "Rejected", cls: "bg-red" }
	};

	var REQ_STATUS_META = {
		"not-started": { label: "Not Started", cls: "bg-gray" },
		"in-progress": { label: "In Progress", cls: "bg-amber" },
		done: { label: "Done", cls: "bg-green" },
		"not-needed": { label: "Not Needed", cls: "bg-purple" }
	};

	var REQ_CATEGORIES = {
		academic: { label: "Academic", icon: "📚" },
		tests: { label: "Tests & Scores", icon: "📝" },
		essays: { label: "Essays & Statements", icon: "✍️" },
		references: { label: "References & Letters", icon: "💌" },
		documents: { label: "Documents & Forms", icon: "📄" },
		portfolio: { label: "Portfolio & Work", icon: "🎨" },
		financial: { label: "Financial & Scholarships", icon: "💰" },
		interview: { label: "Interviews", icon: "🎤" },
		other: { label: "Other", icon: "📌" }
	};

	var REQ_TEMPLATES = {
		university: [
			{ cat: "academic", title: "Academic Transcript / Grade Report", desc: "Official transcript or latest grade report" },
			{ cat: "academic", title: "Predicted Grades", desc: "Predicted final grades from school (if required)" },
			{ cat: "tests", title: "Standardized Test Scores", desc: "SAT / ACT score reports" },
			{ cat: "tests", title: "English Proficiency", desc: "TOEFL / IELTS (if required)" },
			{ cat: "essays", title: "Personal Statement / Main Essay", desc: "The primary application essay" },
			{ cat: "essays", title: "Supplemental Essays", desc: "School-specific short essays" },
			{ cat: "references", title: "Letters of Recommendation", desc: "Typically 2–3 letters from teachers / counselor" },
			{ cat: "documents", title: "CV / Resume", desc: "Summary of activities and achievements" },
			{ cat: "portfolio", title: "Portfolio", desc: "For arts / design / performance programs" },
			{ cat: "financial", title: "Financial Aid / Scholarship Forms", desc: "FAFSA / CSS or school financial forms" },
			{ cat: "documents", title: "Application Fee / Fee Waiver", desc: "Pay the fee or request a waiver" },
			{ cat: "interview", title: "Interview Preparation", desc: "Admissions or alumni interview" }
		],
		college: [
			{ cat: "academic", title: "High School Transcript", desc: "Official or latest transcript" },
			{ cat: "academic", title: "Diploma / Graduation Certificate", desc: "Proof of secondary completion (if applicable)" },
			{ cat: "documents", title: "Application Form", desc: "Completed institutional application" },
			{ cat: "tests", title: "Placement Test", desc: "Math / English placement (if required)" },
			{ cat: "references", title: "Letters of Recommendation", desc: "Typically 1–2 letters" },
			{ cat: "essays", title: "Personal Statement", desc: "Often optional but recommended" },
			{ cat: "portfolio", title: "Portfolio", desc: "For arts / applied programs" },
			{ cat: "financial", title: "Financial Aid Forms", desc: "Scholarships, grants, payment plans" }
		],
		ib: [
			{ cat: "academic", title: "IB Predicted Grades", desc: "Predicted 1–7 scores from subject teachers" },
			{ cat: "academic", title: "Subject Choices Confirmation", desc: "HL / SL subject selection confirmed" },
			{ cat: "essays", title: "Extended Essay (EE)", desc: "4,000-word independent research essay" },
			{ cat: "essays", title: "Theory of Knowledge (TOK) Essay", desc: "TOK prescribed-title essay" },
			{ cat: "portfolio", title: "CAS Portfolio", desc: "Creativity, Activity, Service evidence" },
			{ cat: "documents", title: "Internal Assessment Records", desc: "IA work across subjects" },
			{ cat: "references", title: "School Reference", desc: "Coordinator / teacher reference" },
			{ cat: "tests", title: "Language Proficiency", desc: "If applying in a second language" }
		],
		trades: [
			{ cat: "academic", title: "Transcript / Grade Report", desc: "Latest academic record" },
			{ cat: "academic", title: "High School Diploma / GED", desc: "Proof of secondary completion (if applicable)" },
			{ cat: "documents", title: "Application / Enrolment Form", desc: "Trade school or apprenticeship application" },
			{ cat: "tests", title: "Entrance Assessment / Aptitude Test", desc: "If required by the program" },
			{ cat: "references", title: "References / Employer Reference", desc: "Teacher, employer or supervisor letters" },
			{ cat: "documents", title: "Resume / CV", desc: "Work experience and skills summary" },
			{ cat: "portfolio", title: "Portfolio of Trade Work", desc: "Photos or descriptions of projects, repairs and builds" },
			{ cat: "documents", title: "Safety Certifications", desc: "e.g. first aid, WHMIS / OSHA, equipment tickets" },
			{ cat: "interview", title: "Interview / Site Visit", desc: "Employer or program interview" },
			{ cat: "financial", title: "Financial Aid / Sponsorship", desc: "Apprenticeship grants, scholarships, payment plans" },
			{ cat: "documents", title: "ID / Driver's License", desc: "If required for site access or tools" }
		],
		highSchool: [
			{ cat: "academic", title: "Transcript / Report Cards", desc: "Current and previous report cards" },
			{ cat: "academic", title: "Teacher Recommendations", desc: "Letters from current teachers" },
			{ cat: "tests", title: "Entrance Exam", desc: "e.g. SSAT, HSPT or school-specific test" },
			{ cat: "essays", title: "Student Statement / Essay", desc: "Why this school" },
			{ cat: "essays", title: "Parent Statement", desc: "Family / parent questionnaire (if required)" },
			{ cat: "portfolio", title: "Portfolio / Work Samples", desc: "Art, projects and awards for specialist programs" },
			{ cat: "documents", title: "Application Form", desc: "Completed school application" },
			{ cat: "documents", title: "Birth Certificate / ID", desc: "Proof of age and identity" },
			{ cat: "interview", title: "Interview / Open Day", desc: "Admissions interview or school visit" },
			{ cat: "financial", title: "Financial Aid / Scholarship", desc: "Bursaries or scholarships" }
		],
		other: [
			{ cat: "academic", title: "Transcript / Grades", desc: "Latest academic record" },
			{ cat: "essays", title: "Personal Statement", desc: "Statement of purpose or motivation" },
			{ cat: "references", title: "Letters of Recommendation", desc: "References from relevant people" },
			{ cat: "documents", title: "Resume / CV", desc: "Summary of experience" },
			{ cat: "portfolio", title: "Portfolio / Work Samples", desc: "Evidence of relevant work" },
			{ cat: "tests", title: "Test Scores", desc: "Any required test results" }
		]
	};

	var ACH_CATEGORIES = {
		academic: { label: "Academic", icon: "📚" },
		competition: { label: "Competition", icon: "🥇" },
		leadership: { label: "Leadership", icon: "🧑‍💼" },
		community: { label: "Community Service", icon: "🤝" },
		sports: { label: "Sports", icon: "⚽" },
		technical: { label: "Technical / Trade", icon: "🔧" },
		arts: { label: "Arts & Creative", icon: "🎨" },
		other: { label: "Other", icon: "⭐" }
	};

	var GRADE_TYPES = {
		subject: { label: "Course Grade", icon: "📖" },
		predicted: { label: "Predicted Score", icon: "🎯" },
		test: { label: "Standardized Test", icon: "📝" },
		other: { label: "Other", icon: "📌" }
	};

	var REF_STATUS_META = {
		requested: { label: "Requested", cls: "bg-amber" },
		"in-progress": { label: "In Progress", cls: "bg-blue" },
		received: { label: "Received", cls: "bg-green" },
		declined: { label: "Declined", cls: "bg-red" }
	};

	var PORTFOLIO_CATEGORIES = {
		academic: { label: "Academic Work", icon: "📖" },
		research: { label: "Research Project", icon: "🔬" },
		creative: { label: "Creative Work", icon: "🎨" },
		project: { label: "Personal Project", icon: "🛠️" },
		technical: { label: "Technical / Trade Work", icon: "🔧" },
		certification: { label: "Certification", icon: "📜" },
		community: { label: "Community Project", icon: "🤝" },
		leadership: { label: "Leadership", icon: "🧑‍💼" },
		other: { label: "Other", icon: "📌" }
	};

	var PORTFOLIO_STATUS_META = {
		draft: { label: "Draft", cls: "bg-gray" },
		"in-progress": { label: "In Progress", cls: "bg-amber" },
		complete: { label: "Complete", cls: "bg-green" }
	};

	var REQUEST_STATUS_META = {
		open: { label: "Open", cls: "bg-amber" },
		"in-progress": { label: "In Progress", cls: "bg-blue" },
		resolved: { label: "Resolved", cls: "bg-green" }
	};

	var REQUEST_SECTIONS = {
		general: { label: "General", icon: "📌" },
		applications: { label: "Applications", icon: "🎯" },
		portfolio: { label: "Portfolio", icon: "🎨" },
		achievements: { label: "Achievements", icon: "🏆" },
		grades: { label: "Grades & Scores", icon: "📚" },
		references: { label: "References", icon: "💌" },
		documents: { label: "Documents", icon: "📄" }
	};

	var LINK_TYPES = [
		{ key: "achievements", label: "Achievements", icon: "🏆" },
		{ key: "portfolio", label: "Portfolio", icon: "🎨" },
		{ key: "references", label: "References", icon: "💌" },
		{ key: "documents", label: "Documents", icon: "📄" }
	];

	var PAGE_META = {
		dashboard: ["Dashboard", "One student, every application, fully prepared."],
		profile: ["Student Profile", "Personal details, school, mentor and interests."],
		applications: ["Application Files", "University, college, IB and other pathways."],
		portfolio: ["Portfolio", "Projects, essays and creative work with evidence."],
		achievements: ["Achievements & Activities", "Awards, competitions and supporting activities."],
		grades: ["Grades & Scores", "Subject grades and standardized test results."],
		references: ["References", "Recommendation letters and referees."],
		documents: ["Supporting Documents", "Files that support the application."],
		requests: ["Data Requests", "Mentor requests for data and evidence."],
		mentor: ["Mentor", "Guidance notes and the AI mentor assistant."]
	};

	/* ── State ── */
	function defaultDB() {
		return {
			_theme: "light",
			_view: "student",
			student: {
				firstName: "", lastName: "", school: "", gradeLevel: "", dob: "",
				email: "", phone: "", address: "", mentorName: "", mentorEmail: "",
				targetPrograms: "", interests: "", notes: ""
			},
			applications: [],
			portfolio: [],
			achievements: [],
			grades: [],
			references: [],
			documents: [],
			requests: [],
			mentorNotes: []
		};
	}

	var DB = defaultDB();
	var currentPage = "dashboard";
	var currentAppId = null;
	var achFilter = "all";
	var portfolioFilter = "all";
	var drawerKind = null;
	var isReadOnly = false;
	var aiMentorEnabled = true;

	function mergeDefaults(val) {
		var d = defaultDB();
		if (!val || typeof val !== "object") return d;
		if (val._theme) d._theme = val._theme;
		if (val._view === "student" || val._view === "mentor") d._view = val._view;
		if (val.student && typeof val.student === "object") {
			for (var k in d.student) { if (val.student[k] != null) d.student[k] = val.student[k]; }
		}
		["applications", "portfolio", "achievements", "grades", "references", "documents", "requests", "mentorNotes"].forEach(function (key) {
			if (Array.isArray(val[key])) d[key] = val[key];
		});
		(d.applications || []).forEach(function (a) {
			if (!a.targets) a.targets = [];
			if (!a.links || typeof a.links !== "object") a.links = {};
			if (!a.comments) a.comments = [];
		});
		return d;
	}

	function loadDB(val) { DB = mergeDefaults(val); }

	function persist() {
		try { tool.setValue(DB); } catch (e) { }
		updateNavBadges();
		try { tool.reportValid(true, ""); } catch (e) { }
		resize();
	}

	/* ── Lookups ── */
	function appById(id) { return DB.applications.filter(function (a) { return a.id === id; })[0] || null; }
	function reqById(app, id) { return app.requirements.filter(function (r) { return r.id === id; })[0] || null; }
	function achById(id) { return DB.achievements.filter(function (a) { return a.id === id; })[0] || null; }
	function gradeById(id) { return DB.grades.filter(function (g) { return g.id === id; })[0] || null; }
	function refById(id) { return DB.references.filter(function (r) { return r.id === id; })[0] || null; }
	function docById(id) { return DB.documents.filter(function (d) { return d.id === id; })[0] || null; }
	function noteById(id) { return DB.mentorNotes.filter(function (n) { return n.id === id; })[0] || null; }
	function portfolioById(id) { return DB.portfolio.filter(function (p) { return p.id === id; })[0] || null; }
	function requestById(id) { return DB.requests.filter(function (r) { return r.id === id; })[0] || null; }

	function currentView() { return DB._view === "mentor" ? "mentor" : "student"; }
	function isMentorView() { return currentView() === "mentor"; }
	function canEditCollections() { return !isReadOnly && !isMentorView(); }
	function getAuthor() {
		var u = null; try { u = tool.getUser(); } catch (e) { }
		var name = (u && u.name) ? u.name : (isMentorView() ? "Mentor" : "Student");
		return { name: name, role: currentView() };
	}
	function fmtDateTime(iso) {
		if (!iso) return "";
		var d = new Date(iso);
		if (isNaN(d)) return "";
		return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ", " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
	}
	function commentHTML(comments) {
		if (!comments || !comments.length) return '<div style="font-size:12px;color:var(--text3)">No feedback yet.</div>';
		return '<div class="comments">' + comments.map(function (c) {
			return '<div class="comment"><div class="comment-head"><span class="comment-author">' + esc(c.author || "—") + ' <span class="badge ' + (c.role === "mentor" ? "bg-blue" : "bg-primary") + '">' + (c.role === "mentor" ? "Mentor" : "Student") + '</span></span><span class="comment-time">' + esc(fmtDateTime(c.time)) + '</span></div><div class="comment-text">' + esc(c.text || "") + '</div></div>';
		}).join("") + '</div>';
	}

	function appDefaultName(type) {
		return ((APP_TYPES[type] || APP_TYPES.other).label) + " Application File";
	}

	function emptyAddBtn(action, label) {
		return canEditCollections() ? '<button class="btn btn-primary" data-action="' + action + '">' + label + '</button>' : "";
	}

	/* ── Readiness ── */
	function readiness() {
		var done = 0, total = 0;
		DB.applications.forEach(function (a) {
			(a.requirements || []).forEach(function (r) {
				if (r.status === "not-needed") return;
				total++;
				if (r.status === "done") done++;
			});
		});
		return { done: done, total: total, pct: total ? Math.round(done / total * 100) : 0 };
	}

	function appProgress(app) {
		var done = 0, total = 0;
		(app.requirements || []).forEach(function (r) {
			if (r.status === "not-needed") return;
			total++;
			if (r.status === "done") done++;
		});
		return { done: done, total: total, pct: total ? Math.round(done / total * 100) : 0 };
	}

	/* ── Nav badges ── */
	function updateNavBadges() {
		var set = function (id, n) { var el = document.getElementById(id); if (el) el.textContent = n; };
		set("nav-apps-count", DB.applications.length);
		set("nav-portfolio-count", DB.portfolio.length);
		set("nav-ach-count", DB.achievements.length);
		set("nav-grades-count", DB.grades.length);
		set("nav-refs-count", DB.references.length);
		set("nav-docs-count", DB.documents.length);
		set("nav-requests-count", DB.requests.filter(function (r) { return r.status !== "resolved"; }).length);
		var r = readiness();
		var sb = document.getElementById("sidebar-readiness"); if (sb) sb.textContent = r.pct + "%";
		var bar = document.getElementById("sidebar-readiness-bar"); if (bar) bar.style.width = r.pct + "%";
	}

	/* ── Theme ── */
	function applyTheme(t) {
		DB._theme = t;
		document.documentElement.setAttribute("data-theme", t);
		var icon = document.getElementById("theme-icon"); if (icon) icon.textContent = t === "dark" ? "☀️" : "🌙";
	}
	function toggleTheme() { applyTheme(DB._theme === "dark" ? "light" : "dark"); persist(); }

	/* ── Navigation ── */
	function navigate(page) {
		currentPage = page;
		$$(".section").forEach(function (s) { s.classList.remove("active"); });
		$$(".nav-item").forEach(function (n) { n.classList.toggle("active", n.getAttribute("data-page") === page); });
		var sec = document.getElementById("sec-" + page); if (sec) sec.classList.add("active");
		var meta = PAGE_META[page] || ["", ""];
		var pt = document.getElementById("page-title"); if (pt) pt.textContent = meta[0];
		var ps = document.getElementById("page-sub"); if (ps) ps.textContent = meta[1];
		renderCurrentPage();
		resize();
	}

	function renderCurrentPage() {
		if (currentPage === "dashboard") renderDashboard();
		else if (currentPage === "profile") renderProfile();
		else if (currentPage === "applications") renderApplications();
		else if (currentPage === "portfolio") renderPortfolio();
		else if (currentPage === "achievements") renderAchievements();
		else if (currentPage === "grades") renderGrades();
		else if (currentPage === "references") renderReferences();
		else if (currentPage === "documents") renderDocuments();
		else if (currentPage === "requests") renderRequests();
		else if (currentPage === "mentor") renderMentor();
	}

	/* ═══════════════════════════════════════════
	   DASHBOARD
	   ═══════════════════════════════════════════ */
	function renderDashboard() {
		var r = readiness();
		var openRequests = DB.requests.filter(function (x) { return x.status !== "resolved"; }).length;

		var stats = [
			{ icon: "🎯", value: DB.applications.length, label: "Applications" },
			{ icon: "✅", value: r.done + "/" + r.total, label: "Requirements done" },
			{ icon: "🎨", value: DB.portfolio.length, label: "Portfolio items" },
			{ icon: "🏆", value: DB.achievements.length, label: "Achievements" },
			{ icon: "📥", value: openRequests, label: "Open requests" },
			{ icon: "📄", value: DB.documents.length, label: "Documents" }
		];

		var el = document.getElementById("dash-stats");
		el.innerHTML = stats.map(function (s) {
			return '<div class="stat-card"><div class="stat-top"><span class="stat-icon">' + s.icon + '</span></div>' +
				'<div class="stat-value">' + esc(s.value) + '</div><div class="stat-label">' + esc(s.label) + '</div></div>';
		}).join("");

		renderDashApps();
		renderDashDeadlines();
		renderDashRequests();
		renderDashNotes();
	}

	function renderDashApps() {
		var el = document.getElementById("dash-apps");
		if (!DB.applications.length) {
			el.innerHTML = '<div class="empty-state"><div class="empty-icon">🎯</div><h3>No applications yet</h3><p>Add university, college or IB applications to start building the checklist.</p></div>';
			return;
		}
		el.innerHTML = DB.applications.map(function (a) {
			var p = appProgress(a);
			var t = APP_TYPES[a.type] || APP_TYPES.other;
			var targets = (a.targets || []).length;
			return '<div class="app-row" data-action="open-app" data-id="' + a.id + '">' +
				'<div class="stat-icon">' + t.icon + '</div>' +
				'<div class="app-row-main">' +
					'<div class="app-row-name">' + esc(a.name || appDefaultName(a.type)) + '</div>' +
					'<div class="app-row-sub">' + t.label + (a.faculty ? " · " + esc(a.faculty) : "") + " · " + targets + " target" + (targets === 1 ? "" : "s") + (a.targetYear ? " · " + esc(a.targetYear) : "") + '</div>' +
					'<div class="progress" style="margin-top:6px"><div class="progress-fill" style="width:' + p.pct + '%"></div></div>' +
				'</div>' +
				'<div class="deadline-days">' + p.pct + '%</div>' +
			'</div>';
		}).join("");
	}

	function renderDashDeadlines() {
		var el = document.getElementById("dash-deadlines");
		var list = collectDeadlines();
		if (!list.length) {
			el.innerHTML = '<div class="empty-state"><div class="empty-icon">🗓</div><h3>No upcoming deadlines</h3><p>Deadlines within the next 45 days appear here.</p></div>';
			return;
		}
		el.innerHTML = list.slice(0, 8).map(function (d) {
			var cls = d.done ? "bg-green" : (d.days < 0 ? "bg-red" : (d.days <= 7 ? "bg-amber" : "bg-gray"));
			var label = d.days < 0 ? Math.abs(d.days) + "d overdue" : (d.days === 0 ? "Today" : d.days + "d left");
			return '<div class="deadline-item">' +
				'<div class="deadline-date">' + esc(fmtDate(d.date).split(",")[0] || fmtDate(d.date)) + '</div>' +
				'<div class="deadline-main"><div class="deadline-name">' + esc(d.name) + '</div><div class="deadline-sub">' + esc(d.sub) + '</div></div>' +
				'<div class="badge ' + cls + '">' + label + '</div>' +
			'</div>';
		}).join("");
	}

	function collectDeadlines() {
		var list = [];
		DB.applications.forEach(function (a) {
			(a.targets || []).forEach(function (t) {
				if (t.deadline) list.push({ date: t.deadline, name: t.institution || t.program || "Target", sub: (a.name || appDefaultName(a.type)) + " — target", days: daysUntil(t.deadline), done: t.status === "accepted" || t.status === "submitted" });
			});
			(a.requirements || []).forEach(function (r) {
				if (r.due) list.push({ date: r.due, name: r.title, sub: a.name || appDefaultName(a.type), days: daysUntil(r.due), done: r.status === "done" || r.status === "not-needed" });
			});
		});
		DB.requests.forEach(function (rq) {
			if (rq.due && rq.status !== "resolved") list.push({ date: rq.due, name: rq.title, sub: "Data request", days: daysUntil(rq.due), done: false });
		});
		return list.filter(function (d) { return d.days != null && d.days <= 45; }).sort(function (x, y) { return x.date < y.date ? -1 : x.date > y.date ? 1 : 0; });
	}

	function renderDashNotes() {
		var el = document.getElementById("dash-notes");
		if (!DB.mentorNotes.length) {
			el.innerHTML = '<div class="empty-state"><div class="empty-icon">🧭</div><h3>No mentor notes yet</h3><p>Capture guidance, milestones and next steps in the Mentor tab.</p></div>';
			return;
		}
		el.innerHTML = '<div class="notes-list">' + DB.mentorNotes.slice().reverse().slice(0, 3).map(function (n) {
			return '<div class="note-item"><div class="note-head"><span class="note-title">' + esc(n.title || "Note") + '</span><span class="note-date">' + esc(fmtDate(n.date)) + '</span></div>' +
				'<div class="note-text">' + esc(n.text || "") + '</div></div>';
		}).join("") + '</div>';
	}

	function renderDashRequests() {
		var el = document.getElementById("dash-requests");
		var open = DB.requests.filter(function (r) { return r.status !== "resolved"; });
		if (!open.length) {
			el.innerHTML = '<div class="empty-state"><div class="empty-icon">📥</div><h3>No open requests</h3><p>Requests for missing data and evidence appear here.</p></div>';
			return;
		}
		el.innerHTML = '<div class="notes-list">' + open.slice(0, 4).map(function (rq) {
			var s = REQUEST_STATUS_META[rq.status] || REQUEST_STATUS_META.open;
			var sec = REQUEST_SECTIONS[rq.section] || REQUEST_SECTIONS.general;
			return '<div class="note-item" data-action="open-request" data-id="' + rq.id + '" style="border-left-color:var(--amber);cursor:pointer">' +
				'<div class="note-head"><span class="note-title">' + esc(rq.title || "Request") + '</span><span class="badge ' + s.cls + '">' + s.label + '</span></div>' +
				'<div class="note-text">' + esc(rq.description || "") + '</div>' +
				'<div class="note-tags"><span class="badge bg-gray">' + sec.icon + ' ' + sec.label + '</span>' + (rq.due ? '<span class="badge bg-gray">📅 ' + fmtDate(rq.due) + '</span>' : '') + '</div>' +
			'</div>';
		}).join("") + '</div>';
	}

	/* ═══════════════════════════════════════════
	   PROFILE
	   ═══════════════════════════════════════════ */
	var PROFILE_FIELDS = [
		["pf-first", "firstName"], ["pf-last", "lastName"], ["pf-school", "school"], ["pf-grade", "gradeLevel"],
		["pf-dob", "dob"], ["pf-email", "email"], ["pf-phone", "phone"], ["pf-address", "address"],
		["pf-mentor-name", "mentorName"], ["pf-mentor-email", "mentorEmail"],
		["pf-programs", "targetPrograms"], ["pf-interests", "interests"], ["pf-notes", "notes"]
	];

	function renderProfile() {
		PROFILE_FIELDS.forEach(function (pair) {
			var el = document.getElementById(pair[0]);
			if (el) { el.value = DB.student[pair[1]] || ""; el.disabled = isReadOnly; }
		});
	}

	function bindProfileEvents() {
		PROFILE_FIELDS.forEach(function (pair) {
			var el = document.getElementById(pair[0]);
			if (!el) return;
			el.addEventListener("input", function () {
				DB.student[pair[1]] = el.value;
				persist();
			});
		});
	}

	/* ═══════════════════════════════════════════
	   APPLICATIONS
	   ═══════════════════════════════════════════ */
	function renderApplications() {
		var el = document.getElementById("apps-grid");
		if (!DB.applications.length) {
			el.innerHTML = '<div class="empty-state"><div class="empty-icon">🎯</div><h3>No application files yet</h3><p>Add a general university, college or IB application file. It comes with a ready-made requirements checklist, and you can add target schools and link your achievements, portfolio and references.</p>' + emptyAddBtn("add-app", "+ Add Application") + '</div>';
			return;
		}
		el.innerHTML = DB.applications.map(function (a) {
			var p = appProgress(a);
			var t = APP_TYPES[a.type] || APP_TYPES.other;
			var s = APP_STATUS_META[a.status] || APP_STATUS_META.planning;
			var targets = (a.targets || []).length;
			var links = countLinks(a);
			var actions = canEditCollections() ?
				'<button class="btn btn-icon" data-action="edit-app" data-id="' + a.id + '" title="Edit">✏️</button>' +
				'<button class="btn btn-icon" data-action="del-app" data-id="' + a.id + '" title="Delete">🗑️</button>' : "";
			return '<div class="card" data-action="open-app" data-id="' + a.id + '">' +
				'<div class="card-head"><span class="stat-icon">' + t.icon + '</span><div class="card-actions">' + actions + '</div></div>' +
				'<div class="card-title">' + esc(a.name || appDefaultName(a.type)) + '</div>' +
				'<div class="card-sub">' + esc(t.label) + (a.faculty ? " · " + esc(a.faculty) : "") + " · " + targets + " target" + (targets === 1 ? "" : "s") + " · " + links + " linked" + '</div>' +
				'<div><span class="badge ' + s.cls + '">' + s.label + '</span></div>' +
				'<div class="progress"><div class="progress-fill" style="width:' + p.pct + '%"></div></div>' +
				'<div class="card-sub">' + p.done + ' of ' + p.total + ' done · Score ' + appScore(a).score + '/100' + (a.targetYear ? " · " + esc(a.targetYear) : "") + '</div>' +
			'</div>';
		}).join("");
	}

	function countLinks(a) {
		var n = 0;
		if (!a.links || typeof a.links !== "object") return 0;
		LINK_TYPES.forEach(function (lt) { n += (a.links[lt.key] || []).length; });
		return n;
	}

	function appScore(app) {
		var total = 0, points = 0, missing = [];
		(app.requirements || []).forEach(function (r) {
			if (r.status === "not-needed") return;
			total++;
			if (r.status === "done") points += 1;
			else if (r.status === "in-progress") points += 0.5;
			else missing.push(r.title);
		});
		var base = total ? Math.round((points / total) * 100) : 0;
		var boost = 0;
		LINK_TYPES.forEach(function (lt) { if ((app.links && app.links[lt.key] || []).length) boost += 4; });
		return { score: total ? Math.min(100, base + boost) : 0, base: base, missing: missing, total: total };
	}
	function scoreLabel(s) { return s >= 85 ? "Excellent" : s >= 70 ? "Strong" : s >= 50 ? "Developing" : "Early stage"; }
	function scoreCls(s) { return s >= 70 ? "bg-green" : s >= 50 ? "bg-amber" : "bg-red"; }

	function buildAIAppContext(app) {
		var sc = appScore(app);
		var parts = [];
		parts.push("Student: " + studentName());
		parts.push("Application: " + (app.name || appDefaultName(app.type)) + " (" + (APP_TYPES[app.type] || {}).label + ")");
		if (app.faculty) parts.push("Faculty/Program: " + app.faculty);
		if (app.intake) parts.push("Intake/Term: " + app.intake);
		if (app.targetYear) parts.push("Target year: " + app.targetYear);
		parts.push("Requirement completion: " + sc.base + "% (readiness score " + sc.score + "/100)");
		(app.targets || []).forEach(function (t) { parts.push("Target: " + (t.institution || "") + (t.program ? " — " + t.program : "") + " [" + (APP_STATUS_META[t.status] || {}).label + "]" + (t.deadline ? " deadline " + t.deadline : "")); });
		(app.requirements || []).forEach(function (r) { parts.push("- [" + (REQ_STATUS_META[r.status] || {}).label + "] " + r.title + (r.targetYear ? " (target " + r.targetYear + ")" : "")); });
		var links = [];
		LINK_TYPES.forEach(function (lt) {
			var ids = (app.links && app.links[lt.key]) || [];
			ids.forEach(function (id) {
				var n = id;
				if (lt.key === "achievements") { var a = achById(id); n = a ? a.title : id; }
				else if (lt.key === "portfolio") { var p = portfolioById(id); n = p ? p.title : id; }
				else if (lt.key === "references") { var r = refById(id); n = r ? r.refereeName : id; }
				else { var d = docById(id); n = d ? d.name : id; }
				links.push(lt.label + ": " + n);
			});
		});
		parts.push("Linked evidence: " + (links.join("; ") || "none"));
		parts.push("Grades: " + (DB.grades.map(function (g) { return g.subject + "=" + g.score; }).join("; ") || "none"));
		parts.push("Achievements: " + (DB.achievements.map(function (a) { return a.title; }).join("; ") || "none"));
		return parts.join("\n");
	}

	function runAIEvaluation(app) {
		if (!app) return;
		var box = document.getElementById("ai-eval-box");
		if (!tool.requestAI) {
			if (box) box.innerHTML = '<p style="font-size:12px;color:var(--text3)">AI evaluation requires the AI relay (allowAi) to be enabled in the CMS field settings.</p>';
			return;
		}
		if (box) box.innerHTML = '<div class="ai-msg ai-msg-bot">Evaluating readiness…</div>';
		var prompt = "You are an experienced admissions mentor. Evaluate this student's application readiness for the application described below. Respond with: (1) VERDICT: UNLIKELY, POSSIBLE or LIKELY to be accepted, (2) an estimated readiness score out of 100, (3) the top 3 gaps that must be fixed, and (4) 2-3 concrete next actions. Be direct and practical.";
		tool.requestAI(prompt, buildAIAppContext(app), function (err, resp) {
			if (!box) return;
			if (resp) {
				app.aiEvaluation = { text: resp, at: new Date().toISOString() };
				box.innerHTML = '<div class="comment"><div class="comment-text" style="white-space:pre-wrap">' + esc(resp) + '</div><div class="comment-time" style="margin-top:6px">Evaluated ' + esc(fmtDateTime(app.aiEvaluation.at)) + '</div></div>';
				persist();
			} else {
				box.innerHTML = '<p style="font-size:12px;color:var(--red-text)">Could not evaluate: ' + esc(err || "unknown error") + '</p>';
			}
		});
	}

	/* ── Application drawer ── */
	function openDrawer(app) {
		if (!app) return;
		currentAppId = app.id;
		drawerKind = "app";
		var t = APP_TYPES[app.type] || APP_TYPES.other;
		document.getElementById("drawer-title").textContent = app.name || appDefaultName(app.type);
		document.getElementById("drawer-sub").textContent = t.icon + " " + t.label + (app.faculty ? " · " + app.faculty : "") + (app.intake ? " · " + app.intake : "") + (app.targetYear ? " · " + app.targetYear : "");
		renderDrawerBody(app);
		document.getElementById("drawer-overlay").classList.add("open");
		resize();
	}
	function closeDrawer() { document.getElementById("drawer-overlay").classList.remove("open"); currentAppId = null; drawerKind = null; }

	function renderDrawerBody(app) {
		var body = document.getElementById("drawer-body");
		var s = APP_STATUS_META[app.status] || APP_STATUS_META.planning;
		var p = appProgress(app);
		var sc = appScore(app);

		var top = '<div class="panel"><div class="panel-head"><h3>Overview</h3>' +
			(canEditCollections() ? '<button class="btn btn-sm btn-ghost" data-action="edit-app" data-id="' + app.id + '">✏️ Edit</button>' : '') +
			'</div>' +
			'<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">' +
			'<span class="badge ' + s.cls + '">' + s.label + '</span>' +
			'<span class="badge bg-primary">' + p.pct + '% complete</span>' +
			'<span class="badge ' + scoreCls(sc.score) + '">Readiness ' + sc.score + '/100 · ' + scoreLabel(sc.score) + '</span>' +
			'</div>' +
			((app.faculty || app.intake || app.targetYear) ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">' + (app.faculty ? '<span class="badge bg-gray">🎯 ' + esc(app.faculty) + '</span>' : '') + (app.intake ? '<span class="badge bg-gray">📅 ' + esc(app.intake) + '</span>' : '') + (app.targetYear ? '<span class="badge bg-gray">⏳ ' + esc(app.targetYear) + '</span>' : '') + '</div>' : '') +
			(app.notes ? '<p style="font-size:13px;color:var(--text2);margin-top:8px;white-space:pre-wrap">' + esc(app.notes) + '</p>' : '') +
			'</div>';

		// Targets
		var targetsHead = '<div class="panel-head" style="margin-top:4px"><h3>Target Schools & Programs (' + (app.targets || []).length + ')</h3>' +
			(canEditCollections() ? '<button class="btn btn-sm btn-primary" data-action="add-target" data-app="' + app.id + '">+ Add Target</button>' : '') +
			'</div>';
		var targetsBody = "";
		if (!(app.targets || []).length) {
			targetsBody = '<div class="empty-state"><div class="empty-icon">🏫</div><h3>No targets yet</h3><p>Add specific schools or programs under this application file.</p></div>';
		} else {
			targetsBody = '<div>' + app.targets.map(function (t) {
				var ts = APP_STATUS_META[t.status] || APP_STATUS_META.planning;
				var actions = canEditCollections() ?
					'<button class="btn btn-icon" data-action="edit-target" data-app="' + app.id + '" data-id="' + t.id + '" title="Edit">✏️</button>' +
					'<button class="btn btn-icon" data-action="del-target" data-app="' + app.id + '" data-id="' + t.id + '" title="Delete">🗑️</button>' : "";
				return '<div class="target-item">' +
					'<div class="target-main"><div class="target-name">' + esc(t.institution || "Institution") + (t.program ? ' — ' + esc(t.program) : '') + '</div>' +
					'<div class="target-sub">' + (t.deadline ? '📅 ' + fmtDate(t.deadline) : 'No deadline') + (t.notes ? ' · ' + esc(t.notes) : '') + '</div></div>' +
					'<span class="badge ' + ts.cls + '">' + ts.label + '</span>' +
					'<div class="card-actions">' + actions + '</div>' +
				'</div>';
			}).join("") + '</div>';
		}

		// Requirements
		var reqHead = '<div class="panel-head" style="margin-top:4px"><h3>Requirements (' + p.done + '/' + p.total + ')</h3>' +
			(canEditCollections() ? '<button class="btn btn-sm btn-primary" data-action="add-req" data-app="' + app.id + '">+ Add Requirement</button>' : '') +
			'</div>';

		var reqs = "";
		if (!app.requirements || !app.requirements.length) {
			reqs = '<div class="empty-state"><div class="empty-icon">📋</div><h3>No requirements yet</h3><p>Add the things this application needs.</p></div>';
		} else {
			reqs = '<div class="req-list">' + app.requirements.map(function (r) {
				var rm = REQ_STATUS_META[r.status] || REQ_STATUS_META["not-started"];
				var c = REQ_CATEGORIES[r.cat] || REQ_CATEGORIES.other;
				var isDone = r.status === "done";
				var actions = canEditCollections() ?
					'<button class="btn btn-icon" data-action="edit-req" data-app="' + app.id + '" data-id="' + r.id + '" title="Edit">✏️</button>' +
					'<button class="btn btn-icon" data-action="del-req" data-app="' + app.id + '" data-id="' + r.id + '" title="Delete">🗑️</button>' : "";
				return '<div class="req-item">' +
					'<div class="req-check ' + (isDone ? "done" : "") + '" data-action="toggle-req" data-app="' + app.id + '" data-id="' + r.id + '" title="Toggle done">' + (isDone ? "✓" : "") + '</div>' +
					'<div class="req-main">' +
						'<div class="req-title ' + (isDone ? "done" : "") + '">' + esc(r.title || "Requirement") + '</div>' +
						(r.desc ? '<div class="req-desc">' + esc(r.desc) + '</div>' : '') +
						'<div class="req-meta">' +
							'<span class="badge bg-gray">' + c.icon + ' ' + c.label + '</span>' +
							'<span class="badge ' + rm.cls + '">' + rm.label + '</span>' +
							(r.due ? '<span class="badge bg-gray">📅 ' + fmtDate(r.due) + '</span>' : '') +
							(r.targetYear ? '<span class="badge bg-gray">🎯 ' + esc(r.targetYear) + '</span>' : '') +
						'</div>' +
						(r.notes ? '<div class="req-desc">📝 ' + esc(r.notes) + '</div>' : '') +
					'</div>' +
					'<div class="card-actions">' + actions + '</div>' +
				'</div>';
			}).join("") + '</div>';
		}

		// Links
		var linksHead = '<div class="panel-head" style="margin-top:4px"><h3>Linked Items (' + countLinks(app) + ')</h3>' +
			(canEditCollections() ? '<button class="btn btn-sm btn-ghost" data-action="manage-links" data-id="' + app.id + '">🔗 Manage</button>' : '') +
			'</div>';

		// Comments
		var commentsBody = '<div class="drawer-section-title">Mentor Feedback</div>' + commentHTML(app.comments) +
			(isReadOnly ? "" : '<div class="comment-form"><textarea id="drawer-comment-input" rows="2" placeholder="Leave feedback or guidance..."></textarea><button class="btn btn-primary" data-action="add-comment" data-id="' + app.id + '">Send</button></div>');

		var aiEvalPanel = '<div class="panel"><div class="panel-head"><h3>AI Readiness Evaluation</h3>' +
			(isReadOnly ? "" : '<button class="btn btn-sm btn-outline" data-action="ai-eval" data-id="' + app.id + '">🤖 Evaluate</button>') +
			'</div><div id="ai-eval-box">' +
			(app.aiEvaluation ? '<div class="comment"><div class="comment-text" style="white-space:pre-wrap">' + esc(app.aiEvaluation.text) + '</div><div class="comment-time" style="margin-top:6px">Evaluated ' + esc(fmtDateTime(app.aiEvaluation.at)) + '</div></div>' : '<p style="font-size:12px;color:var(--text3)">Run the AI evaluation for an acceptance verdict, a readiness score, and the gaps to close.</p>') +
			'</div></div>';

		body.innerHTML = top +
			'<div class="panel">' + targetsHead + targetsBody + '</div>' +
			'<div class="panel">' + reqHead + reqs + '</div>' +
			'<div class="panel">' + linksHead + renderLinksSummary(app) + '</div>' +
			aiEvalPanel +
			'<div class="panel">' + commentsBody + '</div>';
	}

	function renderLinksSummary(app) {
		var parts = [];
		LINK_TYPES.forEach(function (lt) {
			var ids = (app.links && app.links[lt.key]) || [];
			if (!ids.length) return;
			var items = ids.map(function (id) {
				var name = "";
				if (lt.key === "achievements") { var a = achById(id); name = a ? a.title : id; }
				else if (lt.key === "portfolio") { var p = portfolioById(id); name = p ? p.title : id; }
				else if (lt.key === "references") { var r = refById(id); name = r ? r.refereeName : id; }
				else if (lt.key === "documents") { var d = docById(id); name = d ? d.name : id; }
				return '<span class="badge bg-gray">' + esc(name) + '</span>';
			});
			parts.push('<div class="drawer-section-title">' + lt.icon + ' ' + lt.label + '</div><div style="display:flex;flex-wrap:wrap;gap:6px">' + items.join("") + '</div>');
		});
		if (!parts.length) return '<div style="font-size:12px;color:var(--text3)">Nothing linked yet. Use “Manage” to relate achievements, portfolio, references and documents to this application.</div>';
		return parts.join("");
	}

	function toggleReq(appId, reqId) {
		if (!canEditCollections()) return;
		var app = appById(appId); if (!app) return;
		var r = reqById(app, reqId); if (!r) return;
		r.status = r.status === "done" ? "not-started" : "done";
		renderDrawerBody(app);
		persist();
	}

	function openTargetModal(app, target) {
		if (!app) return;
		var editing = !!target;
		var body =
			'<div class="field field-full"><label>Institution / School *</label><input id="m-tgt-inst" placeholder="e.g. Stanford University" value="' + esc(target ? target.institution : "") + '"></div>' +
			'<div class="field field-full"><label>Program / Major</label><input id="m-tgt-program" placeholder="e.g. Computer Science" value="' + esc(target ? target.program : "") + '"></div>' +
			'<div class="field"><label>Application Deadline</label><input type="date" id="m-tgt-deadline" value="' + esc(target ? target.deadline : "") + '"></div>' +
			'<div class="field"><label>Status</label><select id="m-tgt-status">' + selectOptions(APP_STATUS_META, target ? target.status : "planning") + '</select></div>' +
			'<div class="field field-full"><label>Notes</label><textarea id="m-tgt-notes" rows="2">' + esc(target ? target.notes : "") + '</textarea></div>';

		openModal(editing ? "Edit Target" : "Add Target School", body,
			'<button class="btn btn-ghost" id="m-cancel">Cancel</button><button class="btn btn-primary" id="m-save">Save</button>');

		document.getElementById("m-cancel").onclick = closeModal;
		document.getElementById("m-save").onclick = function () {
			var inst = document.getElementById("m-tgt-inst").value.trim();
			if (!inst) { notify("Please enter an institution.", "warning"); return; }
			var data = {
				institution: inst,
				program: document.getElementById("m-tgt-program").value.trim(),
				deadline: document.getElementById("m-tgt-deadline").value,
				status: document.getElementById("m-tgt-status").value,
				notes: document.getElementById("m-tgt-notes").value
			};
			app.targets = app.targets || [];
			if (editing) { for (var k in data) target[k] = data[k]; }
			else { app.targets.push(Object.assign({ id: uid() }, data)); }
			closeModal();
			renderDrawerBody(app);
			renderApplications();
			renderDashboard();
			persist();
			notify(editing ? "Target updated." : "Target added.", "success");
		};
	}

	function openLinkManager(app) {
		if (!app) return;
		var body = LINK_TYPES.map(function (lt) {
			var items = { achievements: DB.achievements, portfolio: DB.portfolio, references: DB.references, documents: DB.documents }[lt.key] || [];
			var sel = (app.links && app.links[lt.key]) || [];
			var opts = "";
			if (!items.length) {
				opts = '<div style="font-size:12px;color:var(--text3)">No ' + lt.label.toLowerCase() + ' yet.</div>';
			} else {
				opts = items.map(function (it) {
					var label = lt.key === "achievements" ? it.title : (lt.key === "portfolio" ? it.title : (lt.key === "references" ? it.refereeName : it.name));
					var checked = sel.indexOf(it.id) > -1 ? " checked" : "";
					return '<label class="link-option"><input type="checkbox" data-linkkey="' + lt.key + '" value="' + it.id + '"' + checked + '><span>' + esc(label) + '</span></label>';
				}).join("");
			}
			return '<div class="link-group"><div class="link-group-title">' + lt.icon + ' ' + lt.label + '</div>' + opts + '</div>';
		}).join("");

		openModal("Link Items — " + (app.name || appDefaultName(app.type)),
			'<p style="font-size:12px;color:var(--text3)">Tick the achievements, portfolio items, references and documents that support this application file.</p>' + body,
			'<button class="btn btn-ghost" id="m-cancel">Cancel</button><button class="btn btn-primary" id="m-save">Save Links</button>');

		document.getElementById("m-cancel").onclick = closeModal;
		document.getElementById("m-save").onclick = function () {
			var newLinks = { achievements: [], portfolio: [], references: [], documents: [] };
			LINK_TYPES.forEach(function (lt) {
				var boxes = $$('input[data-linkkey="' + lt.key + '"]', document.getElementById("modal-body"));
				boxes.forEach(function (b) { if (b.checked) newLinks[lt.key].push(b.value); });
			});
			app.links = newLinks;
			closeModal();
			renderDrawerBody(app);
			renderApplications();
			persist();
			notify("Linked items updated.", "success");
		};
	}

	/* ═══════════════════════════════════════════
	   PORTFOLIO
	   ═══════════════════════════════════════════ */
	function renderPortfolio() {
		var filterEl = document.getElementById("portfolio-filter");
		var cats = [{ id: "all", label: "All" }].concat(Object.keys(PORTFOLIO_CATEGORIES).map(function (k) { return { id: k, label: PORTFOLIO_CATEGORIES[k].icon + " " + PORTFOLIO_CATEGORIES[k].label }; }));
		filterEl.innerHTML = cats.map(function (c) {
			return '<span class="chip ' + (portfolioFilter === c.id ? "active" : "") + '" data-action="filter-portfolio" data-id="' + c.id + '">' + esc(c.label) + '</span>';
		}).join("");

		var list = DB.portfolio.slice();
		if (portfolioFilter !== "all") list = list.filter(function (p) { return p.category === portfolioFilter; });

		var el = document.getElementById("portfolio-grid");
		if (!DB.portfolio.length) {
			el.innerHTML = '<div class="empty-state"><div class="empty-icon">🎨</div><h3>No portfolio items yet</h3><p>Add projects, essays, research and creative work with their content and evidence files.</p>' + emptyAddBtn("add-portfolio", "+ Add Portfolio Item") + '</div>';
			return;
		}
		if (!list.length) {
			el.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><h3>No matches</h3><p>No portfolio items in this category yet.</p></div>';
			return;
		}
		el.innerHTML = list.map(function (p) {
			var c = PORTFOLIO_CATEGORIES[p.category] || PORTFOLIO_CATEGORIES.other;
			var s = PORTFOLIO_STATUS_META[p.status] || PORTFOLIO_STATUS_META.draft;
			var actions = canEditCollections() ?
				'<button class="btn btn-icon" data-action="edit-portfolio" data-id="' + p.id + '" title="Edit">✏️</button>' +
				'<button class="btn btn-icon" data-action="del-portfolio" data-id="' + p.id + '" title="Delete">🗑️</button>' : "";
			var files = (p.files || []).length;
			var preview = p.description ? (p.description.length > 140 ? p.description.slice(0, 140) + "…" : p.description) : "";
			return '<div class="card" data-action="open-portfolio" data-id="' + p.id + '">' +
				'<div class="card-head"><span class="badge bg-primary">' + c.icon + ' ' + c.label + '</span><div class="card-actions">' + actions + '</div></div>' +
				'<div class="card-title">' + esc(p.title || "Portfolio item") + '</div>' +
				(preview ? '<div class="card-sub" style="white-space:pre-wrap">' + esc(preview) + '</div>' : '') +
				'<div><span class="badge ' + s.cls + '">' + s.label + '</span> <span class="badge bg-gray">📎 ' + files + ' file' + (files === 1 ? "" : "s") + '</span></div>' +
			'</div>';
		}).join("");
	}

	function openPortfolioModal(p) {
		var editing = !!p;
		var appChecks = DB.applications.map(function (a) {
			var checked = editing && (p.appIds || []).indexOf(a.id) > -1 ? " checked" : "";
			return '<label class="link-option"><input type="checkbox" data-applink value="' + a.id + '"' + checked + '><span>' + esc(a.name || appDefaultName(a.type)) + '</span></label>';
		}).join("");
		var body =
			'<div class="field field-full"><label>Title *</label><input id="m-pf-title" placeholder="e.g. Robotics research paper" value="' + esc(p ? p.title : "") + '"></div>' +
			'<div class="field"><label>Category</label><select id="m-pf-cat">' + selectOptions(PORTFOLIO_CATEGORIES, p ? p.category : "project") + '</select></div>' +
			'<div class="field"><label>Status</label><select id="m-pf-status">' + selectOptions(PORTFOLIO_STATUS_META, p ? p.status : "draft") + '</select></div>' +
			'<div class="field field-full"><label>Content / Description</label><textarea id="m-pf-desc" rows="4" placeholder="What this piece is, how it was made, and why it matters.">' + esc(p ? p.description : "") + '</textarea></div>' +
			'<div class="field field-full"><label>Tags (comma-separated)</label><input id="m-pf-tags" value="' + esc(p && p.tags ? p.tags.join(", ") : "") + '"></div>' +
			'<div class="field field-full"><label>Related Applications</label>' + (appChecks || '<div style="font-size:12px;color:var(--text3)">No applications yet.</div>') + '</div>';

		openModal(editing ? "Edit Portfolio Item" : "Add Portfolio Item", body,
			'<button class="btn btn-ghost" id="m-cancel">Cancel</button><button class="btn btn-primary" id="m-save">Save</button>');

		document.getElementById("m-cancel").onclick = closeModal;
		document.getElementById("m-save").onclick = function () {
			var title = document.getElementById("m-pf-title").value.trim();
			if (!title) { notify("Please enter a title.", "warning"); return; }
			var appIds = $$('input[data-applink]', document.getElementById("modal-body")).filter(function (b) { return b.checked; }).map(function (b) { return b.value; });
			var data = {
				title: title,
				category: document.getElementById("m-pf-cat").value,
				status: document.getElementById("m-pf-status").value,
				description: document.getElementById("m-pf-desc").value,
				tags: document.getElementById("m-pf-tags").value.split(",").map(function (t) { return t.trim(); }).filter(Boolean),
				appIds: appIds
			};
			if (editing) { for (var k in data) p[k] = data[k]; }
			else { data.files = []; data.comments = []; DB.portfolio.push(Object.assign({ id: uid() }, data)); }
			closeModal();
			renderPortfolio();
			renderDashboard();
			persist();
			notify(editing ? "Portfolio item updated." : "Portfolio item added.", "success");
		};
	}

	function openPortfolioDrawer(p) {
		if (!p) return;
		drawerKind = "portfolio";
		currentAppId = p.id;
		var c = PORTFOLIO_CATEGORIES[p.category] || PORTFOLIO_CATEGORIES.other;
		var s = PORTFOLIO_STATUS_META[p.status] || PORTFOLIO_STATUS_META.draft;
		document.getElementById("drawer-title").textContent = p.title || "Portfolio item";
		document.getElementById("drawer-sub").textContent = c.icon + " " + c.label + " · " + s.label;
		renderPortfolioDrawerBody(p);
		document.getElementById("drawer-overlay").classList.add("open");
		resize();
	}

	function renderPortfolioDrawerBody(p) {
		var body = document.getElementById("drawer-body");
		var c = PORTFOLIO_CATEGORIES[p.category] || PORTFOLIO_CATEGORIES.other;
		var s = PORTFOLIO_STATUS_META[p.status] || PORTFOLIO_STATUS_META.draft;
		var files = (p.files || []);

		var filesHTML = files.length ? files.map(function (f) {
			var del = canEditCollections() ? '<button class="btn btn-icon" data-action="del-pf-file" data-id="' + p.id + '" data-url="' + esc(f.url) + '" title="Remove">🗑️</button>' : "";
			return '<div class="file-item"><span class="stat-icon">' + fileIcon(f.type) + '</span><div class="file-main"><div class="file-name">' + esc(f.name || "File") + '</div><div class="file-meta">' + esc(fmtSize(f.size)) + '</div></div><button class="btn btn-sm btn-outline" data-action="open-doc" data-url="' + esc(f.url) + '">↗ Open</button>' + del + '</div>';
		}).join("") : '<div style="font-size:12px;color:var(--text3)">No evidence files yet.</div>';

		var top = '<div class="panel">' +
			'<div class="panel-head"><h3>Content</h3>' + (canEditCollections() ? '<button class="btn btn-sm btn-ghost" data-action="edit-portfolio" data-id="' + p.id + '">✏️ Edit</button>' : '') + '</div>' +
			'<div style="display:flex;flex-wrap:wrap;gap:6px"><span class="badge bg-primary">' + c.icon + ' ' + c.label + '</span><span class="badge ' + s.cls + '">' + s.label + '</span>' +
			(p.tags || []).filter(Boolean).map(function (t) { return '<span class="badge bg-gray">' + esc(t) + '</span>'; }).join("") + '</div>' +
			'<p style="font-size:13px;color:var(--text2);margin-top:8px;white-space:pre-wrap">' + esc(p.description || "No description yet.") + '</p>' +
			'</div>';

		var filesPanel = '<div class="panel"><div class="panel-head"><h3>Evidence Files (' + files.length + ')</h3>' +
			(canEditCollections() ? '<button class="btn btn-sm btn-primary" data-action="upload-pf-file" data-id="' + p.id + '">📎 Upload</button>' : '') +
			'</div>' + filesHTML + '</div>';

		var commentsPanel = '<div class="panel"><div class="drawer-section-title">Mentor Feedback</div>' + commentHTML(p.comments) +
			(isReadOnly ? "" : '<div class="comment-form"><textarea id="drawer-comment-input" rows="2" placeholder="Leave feedback..."></textarea><button class="btn btn-primary" data-action="add-pf-comment" data-id="' + p.id + '">Send</button></div>') +
			'</div>';

		body.innerHTML = top + filesPanel + commentsPanel;
	}

	function uploadPortfolioFile(p) {
		if (!canEditCollections()) return;
		if (!tool.requestUpload) { notify("File upload is not available in this environment.", "warning"); return; }
		tool.requestUpload(".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt", function (err, file) {
			if (err) { notify("Upload failed: " + err, "error"); return; }
			p.files = p.files || [];
			p.files.push({ name: file.name, url: file.url, size: file.size, type: file.type });
			renderPortfolioDrawerBody(p);
			renderPortfolio();
			persist();
			notify("Uploaded: " + file.name, "success");
		});
	}

	/* ═══════════════════════════════════════════
	   ACHIEVEMENTS
	   ═══════════════════════════════════════════ */
	function renderAchievements() {
		var filterEl = document.getElementById("ach-filter");
		var cats = [{ id: "all", label: "All" }].concat(Object.keys(ACH_CATEGORIES).map(function (k) { return { id: k, label: ACH_CATEGORIES[k].icon + " " + ACH_CATEGORIES[k].label }; }));
		filterEl.innerHTML = cats.map(function (c) {
			return '<span class="chip ' + (achFilter === c.id ? "active" : "") + '" data-action="filter-ach" data-id="' + c.id + '">' + esc(c.label) + '</span>';
		}).join("");

		var list = DB.achievements.slice();
		if (achFilter !== "all") list = list.filter(function (a) { return a.category === achFilter; });

		var el = document.getElementById("ach-grid");
		if (!DB.achievements.length) {
			el.innerHTML = '<div class="empty-state"><div class="empty-icon">🏆</div><h3>No achievements yet</h3><p>Record awards, competitions, leadership and activities that strengthen the application.</p>' + emptyAddBtn("add-ach", "+ Add Achievement") + '</div>';
			return;
		}
		if (!list.length) {
			el.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><h3>No matches</h3><p>No achievements in this category yet.</p></div>';
			return;
		}
		el.innerHTML = list.map(function (a) {
			var c = ACH_CATEGORIES[a.category] || ACH_CATEGORIES.other;
			var actions = canEditCollections() ?
				'<button class="btn btn-icon" data-action="edit-ach" data-id="' + a.id + '" title="Edit">✏️</button>' +
				'<button class="btn btn-icon" data-action="del-ach" data-id="' + a.id + '" title="Delete">🗑️</button>' : "";
			return '<div class="card">' +
				'<div class="card-head"><span class="badge bg-primary">' + c.icon + ' ' + c.label + '</span><div class="card-actions">' + actions + '</div></div>' +
				'<div class="card-title">' + esc(a.title || "Achievement") + '</div>' +
				(a.organization ? '<div class="card-sub">' + esc(a.organization) + (a.date ? " · " + esc(a.date) : "") + '</div>' : (a.date ? '<div class="card-sub">' + esc(a.date) + '</div>' : '')) +
				(a.description ? '<div class="card-sub" style="white-space:pre-wrap">' + esc(a.description) + '</div>' : '') +
				(a.evidenceUrl ? '<div><button class="btn btn-sm btn-outline" data-action="open-doc" data-url="' + esc(a.evidenceUrl) + '">🔗 Evidence</button></div>' : '') +
			'</div>';
		}).join("");
	}

	/* ═══════════════════════════════════════════
	   GRADES
	   ═══════════════════════════════════════════ */
	function renderGrades() {
		var body = document.getElementById("grades-body");
		if (!DB.grades.length) {
			body.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">📚</div><h3>No grades yet</h3><p>Add course grades, predicted scores and test results.</p>' + emptyAddBtn("add-grade", "+ Add Grade") + '</div></td></tr>';
			return;
		}
		body.innerHTML = DB.grades.map(function (g) {
			var t = GRADE_TYPES[g.type] || GRADE_TYPES.other;
			var actions = canEditCollections() ?
				'<button class="btn btn-icon" data-action="edit-grade" data-id="' + g.id + '" title="Edit">✏️</button>' +
				'<button class="btn btn-icon" data-action="del-grade" data-id="' + g.id + '" title="Delete">🗑️</button>' : "";
			var term = [g.term, g.year].filter(Boolean).join(" ");
			return '<tr>' +
				'<td><strong>' + esc(g.subject || "—") + '</strong></td>' +
				'<td><span class="badge bg-gray">' + t.icon + ' ' + t.label + '</span></td>' +
				'<td>' + esc(g.score || "—") + '</td>' +
				'<td>' + esc(term || "—") + '</td>' +
				'<td>' + esc(g.notes || "") + '</td>' +
				'<td class="td-actions">' + actions + '</td>' +
			'</tr>';
		}).join("");
	}

	/* ═══════════════════════════════════════════
	   REFERENCES
	   ═══════════════════════════════════════════ */
	function renderReferences() {
		var el = document.getElementById("refs-grid");
		if (!DB.references.length) {
			el.innerHTML = '<div class="empty-state"><div class="empty-icon">💌</div><h3>No references yet</h3><p>Track referees and recommendation letters needed for applications.</p>' + emptyAddBtn("add-ref", "+ Add Referee") + '</div>';
			return;
		}
		el.innerHTML = DB.references.map(function (r) {
			var s = REF_STATUS_META[r.status] || REF_STATUS_META.requested;
			var actions = canEditCollections() ?
				'<button class="btn btn-icon" data-action="edit-ref" data-id="' + r.id + '" title="Edit">✏️</button>' +
				'<button class="btn btn-icon" data-action="del-ref" data-id="' + r.id + '" title="Delete">🗑️</button>' : "";
			return '<div class="card">' +
				'<div class="card-head"><span class="badge ' + s.cls + '">' + s.label + '</span><div class="card-actions">' + actions + '</div></div>' +
				'<div class="card-title">' + esc(r.refereeName || "Referee") + '</div>' +
				'<div class="card-sub">' + esc([r.role, r.organization].filter(Boolean).join(" · ")) + '</div>' +
				(r.email ? '<div class="card-sub">✉️ ' + esc(r.email) + '</div>' : '') +
				(r.phone ? '<div class="card-sub">📞 ' + esc(r.phone) + '</div>' : '') +
				(r.letterUrl ? '<div><button class="btn btn-sm btn-outline" data-action="open-doc" data-url="' + esc(r.letterUrl) + '">🔗 View Letter</button></div>' : '') +
			'</div>';
		}).join("");
	}

	/* ═══════════════════════════════════════════
	   DOCUMENTS
	   ═══════════════════════════════════════════ */
	function renderDocuments() {
		var el = document.getElementById("docs-grid");
		if (!DB.documents.length) {
			el.innerHTML = '<div class="empty-state"><div class="empty-icon">📄</div><h3>No documents yet</h3><p>Upload transcripts, certificates, portfolios and essays.</p>' + emptyAddBtn("upload-doc", "📎 Upload File") + '</div>';
			return;
		}
		el.innerHTML = DB.documents.map(function (d) {
			var actions = canEditCollections() ?
				'<button class="btn btn-icon" data-action="del-doc" data-id="' + d.id + '" title="Delete">🗑️</button>' : "";
			return '<div class="card">' +
				'<div class="card-head"><span class="stat-icon">' + fileIcon(d.type) + '</span><div class="card-actions">' + actions + '</div></div>' +
				'<div class="card-title" style="word-break:break-all">' + esc(d.name || "File") + '</div>' +
				'<div class="card-sub">' + esc(fmtSize(d.size) + (d.type ? " · " + d.type : "")) + '</div>' +
				'<div><button class="btn btn-sm btn-outline" data-action="open-doc" data-url="' + esc(d.url) + '">↗ Open</button></div>' +
			'</div>';
		}).join("");
	}

	function uploadDocument() {
		if (!canEditCollections()) return;
		if (!tool.requestUpload) { notify("File upload is not available in this environment.", "warning"); return; }
		tool.requestUpload(".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt", function (err, file) {
			if (err) { notify("Upload failed: " + err, "error"); return; }
			DB.documents.push({ id: uid(), name: file.name, url: file.url, size: file.size, type: file.type, uploadedAt: new Date().toISOString() });
			renderDocuments();
			persist();
			notify("Uploaded: " + file.name, "success");
		});
	}

	/* ═══════════════════════════════════════════
	   REQUESTS
	   ═══════════════════════════════════════════ */
	function renderRequests() {
		var el = document.getElementById("requests-list");
		if (!DB.requests.length) {
			el.innerHTML = '<div class="empty-state"><div class="empty-icon">📥</div><h3>No requests yet</h3><p>Request missing data and evidence, then track the conversation until it is resolved.</p>' + (isReadOnly ? "" : '<button class="btn btn-primary" data-action="add-request">+ New Request</button>') + '</div>';
			return;
		}
		el.innerHTML = DB.requests.map(function (rq) {
			var s = REQUEST_STATUS_META[rq.status] || REQUEST_STATUS_META.open;
			var sec = REQUEST_SECTIONS[rq.section] || REQUEST_SECTIONS.general;
			var replies = (rq.replies || []).length;
			var actions = isReadOnly ? "" :
				'<button class="btn btn-icon" data-action="edit-request" data-id="' + rq.id + '" title="Edit">✏️</button>' +
				'<button class="btn btn-icon" data-action="del-request" data-id="' + rq.id + '" title="Delete">🗑️</button>';
			return '<div class="card request-card" data-action="open-request" data-id="' + rq.id + '">' +
				'<div class="card-head"><span class="badge ' + s.cls + '">' + s.label + '</span><div class="card-actions">' + actions + '</div></div>' +
				'<div class="card-title">' + esc(rq.title || "Request") + '</div>' +
				(rq.description ? '<div class="card-sub" style="white-space:pre-wrap">' + esc(rq.description) + '</div>' : '') +
				'<div><span class="badge bg-gray">' + sec.icon + ' ' + sec.label + '</span>' + (rq.due ? '<span class="badge bg-gray" style="margin-left:4px">📅 ' + fmtDate(rq.due) + '</span>' : '') + '</div>' +
				'<div class="req-replies-preview">💬 ' + replies + ' reply' + (replies === 1 ? "" : "ies") + '</div>' +
			'</div>';
		}).join("");
	}

	function openRequestModal(rq) {
		var editing = !!rq;
		var body =
			'<div class="field field-full"><label>Title *</label><input id="m-rq-title" placeholder="e.g. Please upload your latest transcript" value="' + esc(rq ? rq.title : "") + '"></div>' +
			'<div class="field"><label>Related Section</label><select id="m-rq-section">' + selectOptions(REQUEST_SECTIONS, rq ? rq.section : "general") + '</select></div>' +
			'<div class="field"><label>Due Date</label><input type="date" id="m-rq-due" value="' + esc(rq ? rq.due : "") + '"></div>' +
			'<div class="field"><label>Status</label><select id="m-rq-status">' + selectOptions(REQUEST_STATUS_META, rq ? rq.status : "open") + '</select></div>' +
			'<div class="field field-full"><label>Description</label><textarea id="m-rq-desc" rows="3" placeholder="What data or evidence is needed, and why.">' + esc(rq ? rq.description : "") + '</textarea></div>' +
			(editing ? '<div class="drawer-section-title">Conversation</div>' + commentHTML(rq.replies) +
				(isReadOnly ? "" : '<div class="comment-form"><textarea id="m-rq-reply" rows="2" placeholder="Reply..."></textarea><button class="btn btn-primary" id="m-rq-reply-btn">Reply</button></div>') : '');

		openModal(editing ? "Data Request" : "New Data Request", body,
			'<button class="btn btn-ghost" id="m-cancel">Close</button><button class="btn btn-primary" id="m-save">' + (editing ? "Update" : "Create") + '</button>');

		document.getElementById("m-cancel").onclick = closeModal;
		document.getElementById("m-save").onclick = function () {
			var title = document.getElementById("m-rq-title").value.trim();
			if (!title) { notify("Please enter a title.", "warning"); return; }
			var data = {
				title: title,
				section: document.getElementById("m-rq-section").value,
				due: document.getElementById("m-rq-due").value,
				status: document.getElementById("m-rq-status").value,
				description: document.getElementById("m-rq-desc").value
			};
			if (editing) { for (var k in data) rq[k] = data[k]; }
			else { data.replies = []; data.createdAt = new Date().toISOString(); DB.requests.push(Object.assign({ id: uid() }, data)); }
			closeModal();
			renderRequests();
			renderDashboard();
			persist();
			notify(editing ? "Request updated." : "Request created.", "success");
		};

		if (editing) {
			var replyBtn = document.getElementById("m-rq-reply-btn");
			if (replyBtn) replyBtn.onclick = function () {
				var txt = document.getElementById("m-rq-reply").value.trim();
				if (!txt) return;
				addReply(rq, txt);
				openRequestModal(rq);
			};
		}
	}

	function addReply(rq, text) {
		var a = getAuthor();
		rq.replies = rq.replies || [];
		rq.replies.push({ id: uid(), author: a.name, role: a.role, text: text, time: new Date().toISOString() });
		renderRequests();
		renderDashboard();
		persist();
	}

	/* ═══════════════════════════════════════════
	   MENTOR
	   ═══════════════════════════════════════════ */
	function renderMentor() {
		var el = document.getElementById("notes-list");
		if (!DB.mentorNotes.length) {
			el.innerHTML = '<div class="empty-state"><div class="empty-icon">🧭</div><h3>No mentor notes yet</h3><p>Add guidance, milestones and next steps for this student.</p></div>';
		} else {
			el.innerHTML = '<div class="notes-list">' + DB.mentorNotes.slice().reverse().map(function (n) {
				var actions = isReadOnly ? "" :
					'<button class="btn btn-icon" data-action="edit-note" data-id="' + n.id + '" title="Edit">✏️</button>' +
					'<button class="btn btn-icon" data-action="del-note" data-id="' + n.id + '" title="Delete">🗑️</button>';
				var tags = (n.tags || []).filter(Boolean).map(function (t) { return '<span class="badge bg-gray">' + esc(t) + '</span>'; }).join(" ");
				return '<div class="note-item"><div class="note-head"><span class="note-title">' + esc(n.title || "Note") + '</span><span class="note-date">' + esc(fmtDate(n.date)) + '<span style="margin-left:8px">' + actions + '</span></span></div>' +
					'<div class="note-text">' + esc(n.text || "") + '</div>' +
					(tags ? '<div class="note-tags">' + tags + '</div>' : '') +
				'</div>';
			}).join("") + '</div>';
		}

		// AI panel visibility
		var aiBox = document.getElementById("ai-box");
		if (aiBox) {
			var panel = aiBox.closest(".panel");
			if (panel) panel.style.display = aiMentorEnabled ? "" : "none";
		}
	}

	/* ═══════════════════════════════════════════
	   MODALS
	   ═══════════════════════════════════════════ */
	function openModal(title, bodyHTML, footerHTML) {
		document.getElementById("modal-title").textContent = title;
		document.getElementById("modal-body").innerHTML = bodyHTML;
		document.getElementById("modal-footer").innerHTML = footerHTML || "";
		document.getElementById("modal-overlay").classList.add("open");
	}
	function closeModal() { document.getElementById("modal-overlay").classList.remove("open"); }

	function selectOptions(map, cur, placeholder) {
		var opts = (placeholder ? '<option value="">' + esc(placeholder) + '</option>' : "");
		Object.keys(map).forEach(function (k) {
			opts += '<option value="' + k + '"' + selOpt(k, cur) + '>' + esc(map[k].label) + '</option>';
		});
		return opts;
	}

	/* ── Application modal ── */
	function openAppModal(app) {
		var editing = !!app;
		var type = app ? app.type : "university";
		var body =
			'<div class="field"><label>Application Type</label><select id="m-app-type">' + selectOptions(APP_TYPES, type) + '</select></div>' +
			'<div class="field field-full"><label>File Name</label><input id="m-app-name" placeholder="e.g. ' + esc(appDefaultName(type)) + '" value="' + esc(app ? app.name : "") + '"></div>' +
			'<div class="field"><label>Faculty / Program (optional)</label><input id="m-app-faculty" placeholder="e.g. Medicine, Computer Science" value="' + esc(app ? app.faculty : "") + '"></div>' +
			'<div class="field"><label>Intake / Term (optional)</label><input id="m-app-intake" placeholder="e.g. Fall 2027" value="' + esc(app ? app.intake : "") + '"></div>' +
			'<div class="field"><label>Target Year (optional)</label><input id="m-app-year" placeholder="e.g. Grade 12 · 2029" value="' + esc(app ? app.targetYear : "") + '"></div>' +
			'<div class="field"><label>Status</label><select id="m-app-status">' + selectOptions(APP_STATUS_META, app ? app.status : "planning") + '</select></div>' +
			'<div class="field field-full"><label>Notes</label><textarea id="m-app-notes" rows="2" placeholder="Strategy, priorities...">' + esc(app ? app.notes : "") + '</textarea></div>' +
			(editing ? "" : '<p style="font-size:12px;color:var(--text3)">Leave the name general (e.g. “University Application File”) or make it specific to a faculty or program. A ready-made requirements checklist will be generated.</p>');

		openModal(editing ? "Edit Application" : "New Application File", body,
			'<button class="btn btn-ghost" id="m-cancel">Cancel</button><button class="btn btn-primary" id="m-save">Save</button>');

		document.getElementById("m-cancel").onclick = closeModal;
		document.getElementById("m-save").onclick = function () {
			var newType = document.getElementById("m-app-type").value;
			var name = document.getElementById("m-app-name").value.trim();
			if (!name) name = appDefaultName(newType);
			var data = {
				type: newType,
				name: name,
				faculty: document.getElementById("m-app-faculty").value.trim(),
				intake: document.getElementById("m-app-intake").value.trim(),
				targetYear: document.getElementById("m-app-year").value.trim(),
				status: document.getElementById("m-app-status").value,
				notes: document.getElementById("m-app-notes").value
			};
			if (editing) {
				for (var k in data) app[k] = data[k];
			} else {
				var na = { id: uid(), requirements: [], targets: [], links: { achievements: [], portfolio: [], references: [], documents: [] }, comments: [] };
				for (var k in data) na[k] = data[k];
				(REQ_TEMPLATES[newType] || []).forEach(function (t) {
					na.requirements.push({ id: uid(), cat: t.cat, title: t.title, desc: t.desc || "", status: "not-started", due: "", notes: "" });
				});
				DB.applications.push(na);
			}
			closeModal();
			renderApplications();
			renderDashboard();
			persist();
			notify(editing ? "Application updated." : "Application file added with a starter checklist.", "success");
		};
	}

	/* ── Requirement modal ── */
	function openReqModal(app, req) {
		if (!app) return;
		var editing = !!req;
		var body =
			'<div class="field"><label>Category</label><select id="m-req-cat">' + selectOptions(REQ_CATEGORIES, req ? req.cat : "academic") + '</select></div>' +
			'<div class="field field-full"><label>Title *</label><input id="m-req-title" placeholder="e.g. Personal Statement" value="' + esc(req ? req.title : "") + '"></div>' +
			'<div class="field field-full"><label>Description</label><textarea id="m-req-desc" rows="2" placeholder="What is needed?">' + esc(req ? req.desc : "") + '</textarea></div>' +
			'<div class="field"><label>Due Date</label><input type="date" id="m-req-due" value="' + esc(req ? req.due : "") + '"></div>' +
			'<div class="field"><label>Target Year / Grade</label><input id="m-req-year" placeholder="e.g. Grade 10 · 2028" value="' + esc(req ? req.targetYear : "") + '"></div>' +
			'<div class="field"><label>Status</label><select id="m-req-status">' + selectOptions(REQ_STATUS_META, req ? req.status : "not-started") + '</select></div>' +
			'<div class="field field-full"><label>Notes</label><textarea id="m-req-notes" rows="2">' + esc(req ? req.notes : "") + '</textarea></div>';

		openModal(editing ? "Edit Requirement" : "Add Requirement", body,
			'<button class="btn btn-ghost" id="m-cancel">Cancel</button><button class="btn btn-primary" id="m-save">Save</button>');

		document.getElementById("m-cancel").onclick = closeModal;
		document.getElementById("m-save").onclick = function () {
			var title = document.getElementById("m-req-title").value.trim();
			if (!title) { notify("Please enter a title.", "warning"); return; }
			var data = {
				cat: document.getElementById("m-req-cat").value,
				title: title,
				desc: document.getElementById("m-req-desc").value,
				due: document.getElementById("m-req-due").value,
				targetYear: document.getElementById("m-req-year").value.trim(),
				status: document.getElementById("m-req-status").value,
				notes: document.getElementById("m-req-notes").value
			};
			if (editing) { for (var k in data) req[k] = data[k]; }
			else { app.requirements = app.requirements || []; app.requirements.push(Object.assign({ id: uid() }, data)); }
			closeModal();
			renderDrawerBody(app);
			renderDashboard();
			persist();
			notify(editing ? "Requirement updated." : "Requirement added.", "success");
		};
	}

	/* ── Achievement modal ── */
	function openAchModal(ach) {
		var editing = !!ach;
		var body =
			'<div class="field field-full"><label>Title *</label><input id="m-ach-title" placeholder="e.g. National Math Olympiad — Silver Medal" value="' + esc(ach ? ach.title : "") + '"></div>' +
			'<div class="field"><label>Category</label><select id="m-ach-cat">' + selectOptions(ACH_CATEGORIES, ach ? ach.category : "competition") + '</select></div>' +
			'<div class="field"><label>Date / Year</label><input id="m-ach-date" placeholder="e.g. 2025 or June 2025" value="' + esc(ach ? ach.date : "") + '"></div>' +
			'<div class="field"><label>Organization</label><input id="m-ach-org" placeholder="e.g. School Science Club" value="' + esc(ach ? ach.organization : "") + '"></div>' +
			'<div class="field field-full"><label>Description</label><textarea id="m-ach-desc" rows="3" placeholder="What was accomplished and why it matters.">' + esc(ach ? ach.description : "") + '</textarea></div>' +
			'<div class="field field-full"><label>Evidence URL (optional)</label><input id="m-ach-url" placeholder="https://..." value="' + esc(ach ? ach.evidenceUrl : "") + '"></div>';

		openModal(editing ? "Edit Achievement" : "Add Achievement", body,
			'<button class="btn btn-ghost" id="m-cancel">Cancel</button><button class="btn btn-primary" id="m-save">Save</button>');

		document.getElementById("m-cancel").onclick = closeModal;
		document.getElementById("m-save").onclick = function () {
			var title = document.getElementById("m-ach-title").value.trim();
			if (!title) { notify("Please enter a title.", "warning"); return; }
			var data = {
				title: title,
				category: document.getElementById("m-ach-cat").value,
				date: document.getElementById("m-ach-date").value.trim(),
				organization: document.getElementById("m-ach-org").value.trim(),
				description: document.getElementById("m-ach-desc").value,
				evidenceUrl: document.getElementById("m-ach-url").value.trim()
			};
			if (editing) { for (var k in data) ach[k] = data[k]; }
			else { DB.achievements.push(Object.assign({ id: uid() }, data)); }
			closeModal();
			renderAchievements();
			renderDashboard();
			persist();
			notify(editing ? "Achievement updated." : "Achievement added.", "success");
		};
	}

	/* ── Grade modal ── */
	function openGradeModal(g) {
		var editing = !!g;
		var body =
			'<div class="field"><label>Subject / Test *</label><input id="m-grade-subject" placeholder="e.g. Mathematics HL" value="' + esc(g ? g.subject : "") + '"></div>' +
			'<div class="field"><label>Type</label><select id="m-grade-type">' + selectOptions(GRADE_TYPES, g ? g.type : "subject") + '</select></div>' +
			'<div class="field"><label>Score / Grade</label><input id="m-grade-score" placeholder="e.g. A, 7, 1450" value="' + esc(g ? g.score : "") + '"></div>' +
			'<div class="field"><label>Term</label><input id="m-grade-term" placeholder="e.g. Semester 1" value="' + esc(g ? g.term : "") + '"></div>' +
			'<div class="field"><label>Year</label><input id="m-grade-year" placeholder="e.g. 2026" value="' + esc(g ? g.year : "") + '"></div>' +
			'<div class="field"><label>Notes</label><input id="m-grade-notes" value="' + esc(g ? g.notes : "") + '"></div>';

		openModal(editing ? "Edit Grade" : "Add Grade", body,
			'<button class="btn btn-ghost" id="m-cancel">Cancel</button><button class="btn btn-primary" id="m-save">Save</button>');

		document.getElementById("m-cancel").onclick = closeModal;
		document.getElementById("m-save").onclick = function () {
			var subject = document.getElementById("m-grade-subject").value.trim();
			if (!subject) { notify("Please enter a subject or test name.", "warning"); return; }
			var data = {
				subject: subject,
				type: document.getElementById("m-grade-type").value,
				score: document.getElementById("m-grade-score").value.trim(),
				term: document.getElementById("m-grade-term").value.trim(),
				year: document.getElementById("m-grade-year").value.trim(),
				notes: document.getElementById("m-grade-notes").value
			};
			if (editing) { for (var k in data) g[k] = data[k]; }
			else { DB.grades.push(Object.assign({ id: uid() }, data)); }
			closeModal();
			renderGrades();
			renderDashboard();
			persist();
			notify(editing ? "Grade updated." : "Grade added.", "success");
		};
	}

	/* ── Reference modal ── */
	function openRefModal(r) {
		var editing = !!r;
		var body =
			'<div class="field"><label>Referee Name *</label><input id="m-ref-name" placeholder="e.g. Ms. Curie" value="' + esc(r ? r.refereeName : "") + '"></div>' +
			'<div class="field"><label>Role</label><input id="m-ref-role" placeholder="e.g. Math Teacher" value="' + esc(r ? r.role : "") + '"></div>' +
			'<div class="field"><label>Organization</label><input id="m-ref-org" placeholder="e.g. High School" value="' + esc(r ? r.organization : "") + '"></div>' +
			'<div class="field"><label>Status</label><select id="m-ref-status">' + selectOptions(REF_STATUS_META, r ? r.status : "requested") + '</select></div>' +
			'<div class="field"><label>Email</label><input type="email" id="m-ref-email" value="' + esc(r ? r.email : "") + '"></div>' +
			'<div class="field"><label>Phone</label><input id="m-ref-phone" value="' + esc(r ? r.phone : "") + '"></div>' +
			'<div class="field"><label>Request Date</label><input type="date" id="m-ref-reqdate" value="' + esc(r ? r.requestDate : "") + '"></div>' +
			'<div class="field"><label>Received Date</label><input type="date" id="m-ref-recvdate" value="' + esc(r ? r.receivedDate : "") + '"></div>' +
			'<div class="field field-full"><label>Letter URL (optional)</label><input id="m-ref-url" placeholder="https://..." value="' + esc(r ? r.letterUrl : "") + '"></div>' +
			'<div class="field field-full"><label>Notes</label><textarea id="m-ref-notes" rows="2">' + esc(r ? r.notes : "") + '</textarea></div>';

		openModal(editing ? "Edit Referee" : "Add Referee", body,
			'<button class="btn btn-ghost" id="m-cancel">Cancel</button><button class="btn btn-primary" id="m-save">Save</button>');

		document.getElementById("m-cancel").onclick = closeModal;
		document.getElementById("m-save").onclick = function () {
			var name = document.getElementById("m-ref-name").value.trim();
			if (!name) { notify("Please enter a referee name.", "warning"); return; }
			var data = {
				refereeName: name,
				role: document.getElementById("m-ref-role").value.trim(),
				organization: document.getElementById("m-ref-org").value.trim(),
				status: document.getElementById("m-ref-status").value,
				email: document.getElementById("m-ref-email").value.trim(),
				phone: document.getElementById("m-ref-phone").value.trim(),
				requestDate: document.getElementById("m-ref-reqdate").value,
				receivedDate: document.getElementById("m-ref-recvdate").value,
				letterUrl: document.getElementById("m-ref-url").value.trim(),
				notes: document.getElementById("m-ref-notes").value
			};
			if (editing) { for (var k in data) r[k] = data[k]; }
			else { DB.references.push(Object.assign({ id: uid() }, data)); }
			closeModal();
			renderReferences();
			renderDashboard();
			persist();
			notify(editing ? "Referee updated." : "Referee added.", "success");
		};
	}

	/* ── Note modal ── */
	function openNoteModal(n) {
		var editing = !!n;
		var body =
			'<div class="field"><label>Title</label><input id="m-note-title" placeholder="e.g. Essay first draft review" value="' + esc(n ? n.title : "") + '"></div>' +
			'<div class="field field-full"><label>Note *</label><textarea id="m-note-text" rows="4" placeholder="Guidance, milestones, next steps...">' + esc(n ? n.text : "") + '</textarea></div>' +
			'<div class="field field-full"><label>Tags (comma-separated)</label><input id="m-note-tags" placeholder="e.g. essay, deadline, priority" value="' + esc(n && n.tags ? n.tags.join(", ") : "") + '"></div>';

		openModal(editing ? "Edit Note" : "Add Note", body,
			'<button class="btn btn-ghost" id="m-cancel">Cancel</button><button class="btn btn-primary" id="m-save">Save</button>');

		document.getElementById("m-cancel").onclick = closeModal;
		document.getElementById("m-save").onclick = function () {
			var text = document.getElementById("m-note-text").value.trim();
			if (!text) { notify("Please enter a note.", "warning"); return; }
			var data = {
				title: document.getElementById("m-note-title").value.trim(),
				text: text,
				tags: document.getElementById("m-note-tags").value.split(",").map(function (t) { return t.trim(); }).filter(Boolean),
				date: editing && n.date ? n.date : todayISO()
			};
			if (editing) { for (var k in data) n[k] = data[k]; }
			else { DB.mentorNotes.push(Object.assign({ id: uid() }, data)); }
			closeModal();
			renderMentor();
			renderDashboard();
			persist();
			notify(editing ? "Note updated." : "Note added.", "success");
		};
	}

	/* ── Confirm delete ── */
	function confirmDelete(type, id) {
		var labels = {
			application: "application", achievement: "achievement", grade: "grade",
			reference: "reference", document: "document", note: "note",
			portfolio: "portfolio item", request: "request"
		};
		var label = labels[type] || "item";
		openModal("Delete " + label[0].toUpperCase() + label.slice(1),
			'<p>Are you sure you want to delete this ' + label + '? This cannot be undone.</p>',
			'<button class="btn btn-ghost" id="m-cancel">Cancel</button><button class="btn btn-danger" id="m-confirm">Delete</button>');
		document.getElementById("m-cancel").onclick = closeModal;
		document.getElementById("m-confirm").onclick = function () {
			performDelete(type, id);
			closeModal();
		};
	}

	function performDelete(type, id) {
		var arr = null, reRender = null;
		if (type === "application") { arr = DB.applications; reRender = function () { renderApplications(); }; }
		else if (type === "portfolio") { arr = DB.portfolio; reRender = renderPortfolio; }
		else if (type === "achievement") { arr = DB.achievements; reRender = renderAchievements; }
		else if (type === "grade") { arr = DB.grades; reRender = renderGrades; }
		else if (type === "reference") { arr = DB.references; reRender = renderReferences; }
		else if (type === "document") { arr = DB.documents; reRender = renderDocuments; }
		else if (type === "request") { arr = DB.requests; reRender = renderRequests; }
		else if (type === "note") { arr = DB.mentorNotes; reRender = renderMentor; }
		if (!arr) return;
		var idx = -1;
		arr.forEach(function (x, i) { if (x.id === id) idx = i; });
		if (idx > -1) arr.splice(idx, 1);
		if ((type === "application" || type === "portfolio") && currentAppId === id) closeDrawer();
		if (reRender) reRender();
		renderDashboard();
		persist();
		notify("Deleted.", "info");
	}

	/* ═══════════════════════════════════════════
	   EXPORT
	   ═══════════════════════════════════════════ */
	function studentName() {
		var s = DB.student;
		var n = [s.firstName, s.lastName].filter(Boolean).join(" ");
		return n || "Unnamed Student";
	}

	function buildSummaryText() {
		var lines = [];
		var s = DB.student;
		lines.push("APPLICATION FILE — " + studentName());
		lines.push("School: " + (s.school || "—"));
		lines.push("Grade: " + (s.gradeLevel || "—"));
		lines.push("Mentor: " + (s.mentorName || "—"));
		lines.push("Targets: " + (s.targetPrograms || "—"));
		lines.push("");
		DB.applications.forEach(function (a) {
			var p = appProgress(a);
			lines.push("▸ " + (a.name || appDefaultName(a.type)) + " (" + (APP_TYPES[a.type] || {}).label + ") — " + (APP_STATUS_META[a.status] || {}).label + " · " + p.done + "/" + p.total + " done");
			(a.targets || []).forEach(function (t) {
				lines.push("    → " + (t.institution || "") + (t.program ? " — " + t.program : "") + " [" + (APP_STATUS_META[t.status] || {}).label + "]" + (t.deadline ? " (deadline " + t.deadline + ")" : ""));
			});
			(a.requirements || []).forEach(function (r) {
				lines.push("    [" + (REQ_STATUS_META[r.status] || {}).label + "] " + r.title + (r.due ? " (due " + r.due + ")" : ""));
			});
			lines.push("");
		});
		lines.push("PORTFOLIO");
		DB.portfolio.forEach(function (p) { lines.push("• " + p.title + " (" + (PORTFOLIO_STATUS_META[p.status] || {}).label + ")" + (p.files && p.files.length ? " — " + p.files.length + " file(s)" : "")); });
		lines.push("");
		lines.push("ACHIEVEMENTS");
		DB.achievements.forEach(function (a) { lines.push("• " + a.title + (a.organization ? " — " + a.organization : "") + (a.date ? " (" + a.date + ")" : "")); });
		lines.push("");
		lines.push("GRADES & SCORES");
		DB.grades.forEach(function (g) { lines.push("• " + g.subject + ": " + g.score + (g.year ? " (" + g.year + ")" : "")); });
		lines.push("");
		lines.push("REFERENCES");
		DB.references.forEach(function (r) { lines.push("• " + r.refereeName + " (" + (REF_STATUS_META[r.status] || {}).label + ")"); });
		lines.push("");
		lines.push("DATA REQUESTS");
		DB.requests.forEach(function (rq) { lines.push("• [" + (REQUEST_STATUS_META[rq.status] || {}).label + "] " + rq.title + (rq.due ? " (due " + rq.due + ")" : "")); });
		return lines.join("\n");
	}

	function buildSummaryHTML() {
		var s = DB.student;
		var r = readiness();
		var h = '<html><head><meta charset="utf-8"><style>body{font-family:Segoe UI,system-ui,sans-serif;color:#1a1d23;padding:40px;max-width:820px;margin:auto}h1{font-size:24px;margin-bottom:4px}h2{font-size:16px;margin-top:26px;border-bottom:2px solid #2563eb;padding-bottom:6px}h3{font-size:14px;margin:14px 0 4px}table{width:100%;border-collapse:collapse;font-size:13px}td,th{padding:6px 10px;border:1px solid #e1e4e8;text-align:left}th{background:#f0f2f5}.chip{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;background:#eff6ff;color:#2563eb;margin:2px}.muted{color:#5f6368}ul{margin:6px 0 0 18px}li{margin:2px 0}</style></head><body>';
		h += '<h1>Application File — ' + esc(studentName()) + '</h1>';
		h += '<p class="muted">Prepared by StudentFile Builder · ' + esc(new Date().toLocaleDateString()) + '</p>';
		h += '<p><strong>School:</strong> ' + esc(s.school || "—") + ' &nbsp; <strong>Grade:</strong> ' + esc(s.gradeLevel || "—") + '<br><strong>Mentor:</strong> ' + esc(s.mentorName || "—") + ' &nbsp; <strong>Targets:</strong> ' + esc(s.targetPrograms || "—") + '</p>';
		h += '<p><strong>Overall readiness:</strong> ' + r.done + ' of ' + r.total + ' requirements done (' + r.pct + '%)</p>';

		h += '<h2>Applications</h2>';
		DB.applications.forEach(function (a) {
			var p = appProgress(a);
			h += '<h3>' + esc(a.name || appDefaultName(a.type)) + ' <span class="chip">' + esc((APP_TYPES[a.type] || {}).label || "") + '</span> <span class="chip">' + esc((APP_STATUS_META[a.status] || {}).label || "") + '</span></h3>';
			h += '<p class="muted">' + p.done + '/' + p.total + ' done</p>';
			if ((a.targets || []).length) {
				h += '<table><tr><th>Target</th><th>Program</th><th>Deadline</th><th>Status</th></tr>';
				a.targets.forEach(function (t) { h += '<tr><td>' + esc(t.institution || "") + '</td><td>' + esc(t.program || "—") + '</td><td>' + esc(t.deadline || "—") + '</td><td>' + esc((APP_STATUS_META[t.status] || {}).label || "") + '</td></tr>'; });
				h += '</table>';
			}
			h += '<table><tr><th>Status</th><th>Requirement</th><th>Due</th></tr>';
			(a.requirements || []).forEach(function (x) { h += '<tr><td>' + esc((REQ_STATUS_META[x.status] || {}).label || "") + '</td><td>' + esc(x.title || "") + '</td><td>' + esc(x.due || "—") + '</td></tr>'; });
			h += '</table>';
		});

		h += '<h2>Portfolio</h2><ul>';
		DB.portfolio.forEach(function (p) { h += '<li><strong>' + esc(p.title) + '</strong> (' + esc((PORTFOLIO_STATUS_META[p.status] || {}).label || "") + ')' + (p.description ? ' — ' + esc(p.description.slice(0, 120)) : '') + '</li>'; });
		h += '</ul>';

		h += '<h2>Achievements</h2><ul>';
		DB.achievements.forEach(function (a) { h += '<li><strong>' + esc(a.title) + '</strong>' + (a.organization ? ' — ' + esc(a.organization) : '') + (a.date ? ' (' + esc(a.date) + ')' : '') + '</li>'; });
		h += '</ul>';

		h += '<h2>Grades &amp; Scores</h2><table><tr><th>Subject</th><th>Type</th><th>Score</th><th>Term</th></tr>';
		DB.grades.forEach(function (g) { h += '<tr><td>' + esc(g.subject || "") + '</td><td>' + esc((GRADE_TYPES[g.type] || {}).label || "") + '</td><td>' + esc(g.score || "") + '</td><td>' + esc([g.term, g.year].filter(Boolean).join(" ")) + '</td></tr>'; });
		h += '</table>';

		h += '<h2>References</h2><table><tr><th>Referee</th><th>Role</th><th>Status</th></tr>';
		DB.references.forEach(function (x) { h += '<tr><td>' + esc(x.refereeName || "") + '</td><td>' + esc(x.role || "") + '</td><td>' + esc((REF_STATUS_META[x.status] || {}).label || "") + '</td></tr>'; });
		h += '</table>';

		h += '<h2>Data Requests</h2><table><tr><th>Status</th><th>Request</th><th>Due</th></tr>';
		DB.requests.forEach(function (rq) { h += '<tr><td>' + esc((REQUEST_STATUS_META[rq.status] || {}).label || "") + '</td><td>' + esc(rq.title || "") + '</td><td>' + esc(rq.due || "—") + '</td></tr>'; });
		h += '</table>';

		h += '</body></html>';
		return h;
	}

	function exportSummary() {
		var html = buildSummaryHTML();
		if (tool.requestExportPdf) {
			tool.requestExportPdf({ html: html, filename: "student-application-file" }, function (err, file) {
				if (err) { notify("Export failed: " + err, "error"); showCopyFallback(); return; }
				notify("Summary exported.", "success");
				safeOpenUrl(file.url);
			});
		} else {
			showCopyFallback();
		}
	}

	function showCopyFallback() {
		var text = buildSummaryText();
		openModal("Export Summary (copy)",
			'<p style="font-size:13px;color:var(--text2)">PDF export is not enabled for this field. Copy the summary below instead.</p>' +
			'<textarea id="m-copy-text" rows="12" style="width:100%;font-family:monospace;font-size:12px">' + esc(text) + '</textarea>',
			'<button class="btn btn-ghost" id="m-cancel">Close</button><button class="btn btn-primary" id="m-copy">Copy</button>');
		document.getElementById("m-cancel").onclick = closeModal;
		document.getElementById("m-copy").onclick = function () {
			var ta = document.getElementById("m-copy-text");
			ta.select();
			var ok = false;
			try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
			notify(ok ? "Copied to clipboard." : "Could not copy automatically — select the text manually.", ok ? "success" : "warning");
		};
	}

	/* ═══════════════════════════════════════════
	   AI MENTOR
	   ═══════════════════════════════════════════ */
	function buildAIContext() {
		var s = DB.student;
		var parts = [];
		parts.push("Student: " + studentName());
		parts.push("School: " + (s.school || "—") + ", Grade: " + (s.gradeLevel || "—"));
		parts.push("Target programs/interests: " + (s.targetPrograms || "—"));
		parts.push("Interests/strengths: " + (s.interests || "—"));
		parts.push("");
		parts.push("Applications (" + DB.applications.length + "):");
		DB.applications.forEach(function (a) {
			var p = appProgress(a);
			parts.push("- " + (a.name || appDefaultName(a.type)) + " [" + (APP_TYPES[a.type] || {}).label + "] " + (APP_STATUS_META[a.status] || {}).label + ", " + p.done + "/" + p.total + " requirements done");
			(a.targets || []).forEach(function (t) { parts.push("    • target: " + (t.institution || "") + (t.program ? " — " + t.program : "") + (t.deadline ? " (deadline " + t.deadline + ")" : "")); });
			(a.requirements || []).forEach(function (r) {
				if (r.status !== "done" && r.status !== "not-needed") parts.push("    • pending: " + r.title + (r.due ? " (due " + r.due + ")" : ""));
			});
		});
		parts.push("");
		parts.push("Portfolio: " + (DB.portfolio.map(function (p) { return p.title; }).join("; ") || "none"));
		parts.push("Achievements: " + (DB.achievements.map(function (a) { return a.title; }).join("; ") || "none"));
		parts.push("Grades: " + (DB.grades.map(function (g) { return g.subject + "=" + g.score; }).join("; ") || "none"));
		parts.push("References: " + (DB.references.map(function (r) { return r.refereeName + " (" + (REF_STATUS_META[r.status] || {}).label + ")"; }).join("; ") || "none"));
		parts.push("Documents: " + (DB.documents.map(function (d) { return d.name; }).join("; ") || "none"));
		parts.push("Open requests: " + (DB.requests.filter(function (rq) { return rq.status !== "resolved"; }).map(function (rq) { return rq.title; }).join("; ") || "none"));
		return parts.join("\n");
	}

	function appendAiMsg(role, text) {
		var box = document.getElementById("ai-messages");
		if (!box) return null;
		var div = document.createElement("div");
		div.className = "ai-msg " + (role === "user" ? "ai-msg-user" : "ai-msg-bot");
		div.textContent = text;
		box.appendChild(div);
		box.scrollTop = box.scrollHeight;
		return div;
	}

	function askAI() {
		var input = document.getElementById("ai-input");
		var q = input.value.trim();
		if (!q) return;
		appendAiMsg("user", q);
		input.value = "";
		if (!tool.requestAI) { appendAiMsg("bot", "The AI mentor assistant is not available in this environment. Ask your mentor directly, or enable the AI relay (allowAi) in the CMS field settings."); return; }
		var thinking = appendAiMsg("bot", "Thinking…");
		var prompt = "You are an experienced university / college / IB admissions mentor guiding one student and their mentor. Using the context below, answer the mentor's question with specific, practical advice. Be concise and encouraging.\n\nQuestion: " + q;
		tool.requestAI(prompt, buildAIContext(), function (err, resp) {
			if (thinking && thinking.parentNode) thinking.parentNode.removeChild(thinking);
			if (resp) { appendAiMsg("bot", resp); resize(); }
			else { appendAiMsg("bot", "Sorry, I could not get an answer." + (err ? " (" + err + ")" : "")); }
		});
	}

	/* ═══════════════════════════════════════════
	   ACTIONS (event delegation)
	   ═══════════════════════════════════════════ */
	function handleAction(e) {
		var el = e.target.closest ? e.target.closest("[data-action]") : null;
		if (!el) return;
		var action = el.getAttribute("data-action");
		var id = el.getAttribute("data-id");
		var appId = el.getAttribute("data-app");
		var url = el.getAttribute("data-url");

		switch (action) {
			case "add-app": openAppModal(null); break;
			case "edit-app": openAppModal(appById(id)); break;
			case "del-app": confirmDelete("application", id); break;
			case "open-app": openDrawer(appById(id)); break;
			case "add-target": openTargetModal(appById(appId), null); break;
			case "edit-target": { var a0 = appById(appId); if (a0) { var t0 = (a0.targets || []).filter(function (t) { return t.id === id; })[0]; if (t0) openTargetModal(a0, t0); } break; }
			case "del-target": { var a1 = appById(appId); if (a1) { a1.targets = (a1.targets || []).filter(function (t) { return t.id !== id; }); renderDrawerBody(a1); renderApplications(); renderDashboard(); persist(); } break; }
			case "manage-links": openLinkManager(appById(id)); break;
			case "ai-eval": runAIEvaluation(appById(id)); break;
			case "add-comment": { var a2 = appById(id); if (a2) { var inp = document.getElementById("drawer-comment-input"); if (inp && inp.value.trim()) { var au = getAuthor(); a2.comments = a2.comments || []; a2.comments.push({ id: uid(), author: au.name, role: au.role, text: inp.value.trim(), time: new Date().toISOString() }); renderDrawerBody(a2); persist(); } } break; }
			case "add-req": openReqModal(appById(appId), null); break;
			case "edit-req": { var a3 = appById(appId); if (a3) openReqModal(a3, reqById(a3, id)); break; }
			case "del-req": { var a4 = appById(appId); if (a4 && reqById(a4, id)) confirmDeleteReq(appId, id); break; }
			case "toggle-req": toggleReq(appId, id); break;
			case "filter-ach": achFilter = id; renderAchievements(); break;
			case "filter-portfolio": portfolioFilter = id; renderPortfolio(); break;
			case "add-portfolio": openPortfolioModal(null); break;
			case "edit-portfolio": openPortfolioModal(portfolioById(id)); break;
			case "del-portfolio": confirmDelete("portfolio", id); break;
			case "open-portfolio": openPortfolioDrawer(portfolioById(id)); break;
			case "upload-pf-file": { var p = portfolioById(id); if (p) uploadPortfolioFile(p); break; }
			case "del-pf-file": { var p2 = portfolioById(id); if (p2) { p2.files = (p2.files || []).filter(function (f) { return f.url !== url; }); renderPortfolioDrawerBody(p2); renderPortfolio(); persist(); } break; }
			case "add-pf-comment": { var p3 = portfolioById(id); if (p3) { var inp2 = document.getElementById("drawer-comment-input"); if (inp2 && inp2.value.trim()) { var au2 = getAuthor(); p3.comments = p3.comments || []; p3.comments.push({ id: uid(), author: au2.name, role: au2.role, text: inp2.value.trim(), time: new Date().toISOString() }); renderPortfolioDrawerBody(p3); persist(); } } break; }
			case "add-ach": openAchModal(null); break;
			case "edit-ach": openAchModal(achById(id)); break;
			case "del-ach": confirmDelete("achievement", id); break;
			case "add-grade": openGradeModal(null); break;
			case "edit-grade": openGradeModal(gradeById(id)); break;
			case "del-grade": confirmDelete("grade", id); break;
			case "add-ref": openRefModal(null); break;
			case "edit-ref": openRefModal(refById(id)); break;
			case "del-ref": confirmDelete("reference", id); break;
			case "upload-doc": uploadDocument(); break;
			case "del-doc": confirmDelete("document", id); break;
			case "open-doc": if (url) safeOpenUrl(url); break;
			case "add-request": openRequestModal(null); break;
			case "edit-request": openRequestModal(requestById(id)); break;
			case "del-request": confirmDelete("request", id); break;
			case "open-request": openRequestModal(requestById(id)); break;
			case "add-note": openNoteModal(null); break;
			case "edit-note": openNoteModal(noteById(id)); break;
			case "del-note": confirmDelete("note", id); break;
			case "goto-notes": navigate("mentor"); break;
			case "goto-requests": navigate("requests"); break;
		}
	}

	function confirmDeleteReq(appId, reqId) {
		var app = appById(appId); if (!app) return;
		var r = reqById(app, reqId); if (!r) return;
		openModal("Delete Requirement",
			'<p>Delete "<strong>' + esc(r.title) + '</strong>"?</p>',
			'<button class="btn btn-ghost" id="m-cancel">Cancel</button><button class="btn btn-danger" id="m-confirm">Delete</button>');
		document.getElementById("m-cancel").onclick = closeModal;
		document.getElementById("m-confirm").onclick = function () {
			app.requirements = app.requirements.filter(function (x) { return x.id !== reqId; });
			closeModal();
			renderDrawerBody(app);
			renderDashboard();
			persist();
			notify("Requirement deleted.", "info");
		};
	}

	/* ── View switching ── */
	function setView(v) {
		if (v !== "student" && v !== "mentor") return;
		DB._view = v;
		updateViewToggle();
		updateViewBanner();
		setReadonlyUI();
		renderCurrentPage();
		persist();
	}
	function updateViewToggle() {
		$$("#view-toggle .view-btn").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-view") === currentView()); });
	}
	function updateViewBanner() {
		var vb = document.getElementById("view-banner");
		if (vb) vb.style.display = isMentorView() ? "block" : "none";
	}

	/* ── Read-only UI ── */
	function setReadonlyUI() {
		["dash-add-app", "btn-add-app", "btn-add-portfolio", "btn-add-ach", "btn-add-grade", "btn-add-ref", "btn-upload-doc"].forEach(function (id) {
			var el = document.getElementById(id); if (el) el.disabled = !canEditCollections();
		});
		["btn-add-note", "btn-add-request"].forEach(function (id) {
			var el = document.getElementById(id); if (el) el.disabled = isReadOnly;
		});
		var aiInput = document.getElementById("ai-input"); if (aiInput) aiInput.disabled = isReadOnly;
		var aiSend = document.getElementById("ai-send"); if (aiSend) aiSend.disabled = isReadOnly;
		PROFILE_FIELDS.forEach(function (pair) {
			var el = document.getElementById(pair[0]); if (el) el.disabled = !canEditCollections();
		});
		var banner = document.getElementById("ro-banner"); if (banner) banner.style.display = isReadOnly ? "block" : "none";
		updateViewBanner();
	}

	/* ── Bind static events ── */
	function bindStaticEvents() {
		$$(".nav-item").forEach(function (n) {
			n.addEventListener("click", function () { navigate(n.getAttribute("data-page")); });
		});
		document.body.addEventListener("click", handleAction);

		var themeBtn = document.getElementById("theme-toggle");
		if (themeBtn) themeBtn.addEventListener("click", toggleTheme);

		var exportBtn = document.getElementById("btn-export");
		if (exportBtn) exportBtn.addEventListener("click", exportSummary);

		var gotoNotes = document.getElementById("dash-goto-notes");
		if (gotoNotes) gotoNotes.addEventListener("click", function () { navigate("mentor"); });

		$$("#view-toggle .view-btn").forEach(function (b) {
			b.addEventListener("click", function () { setView(b.getAttribute("data-view")); });
		});

		var gotoRequests = document.getElementById("dash-goto-requests");
		if (gotoRequests) gotoRequests.addEventListener("click", function () { navigate("requests"); });

		var aiSend = document.getElementById("ai-send");
		if (aiSend) aiSend.addEventListener("click", askAI);
		var aiInput = document.getElementById("ai-input");
		if (aiInput) aiInput.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askAI(); } });

		var modalClose = document.getElementById("modal-close");
		if (modalClose) modalClose.addEventListener("click", closeModal);
		var overlay = document.getElementById("modal-overlay");
		if (overlay) overlay.addEventListener("click", function (e) { if (e.target === overlay) closeModal(); });

		var drawerClose = document.getElementById("drawer-close");
		if (drawerClose) drawerClose.addEventListener("click", closeDrawer);
		var doverlay = document.getElementById("drawer-overlay");
		if (doverlay) doverlay.addEventListener("click", function (e) { if (e.target === doverlay) closeDrawer(); });

		document.addEventListener("keydown", function (e) {
			if (e.key === "Escape") { closeModal(); closeDrawer(); }
		});
	}

	/* ═══════════════════════════════════════════
	   INIT
	   ═══════════════════════════════════════════ */
	tool.declareParams([
		{
			name: "aiMentorEnabled",
			label: "Enable AI Mentor Assistant",
			type: "toggle",
			default: "yes",
			severity: "optional",
			hint: "Set to 'no' to hide the AI mentor assistant panel in the Mentor tab."
		}
	]);

	tool.onReady(function (val) {
		loadDB(val);
		aiMentorEnabled = tool.param("aiMentorEnabled", "yes") !== "no";
		isReadOnly = typeof tool.isReadOnly === "function" ? tool.isReadOnly() : false;

		// Best-effort auto-detect of the current side (student vs mentor)
		var hadView = val && (val._view === "student" || val._view === "mentor");
		var u = null; try { u = tool.getUser(); } catch (e) { }
		if (!hadView && u && u.email) {
			var ue = (u.email || "").toLowerCase();
			if (DB.student.mentorEmail && DB.student.mentorEmail.toLowerCase() === ue) DB._view = "mentor";
			else if (DB.student.email && DB.student.email.toLowerCase() === ue) DB._view = "student";
		}

		bindStaticEvents();
		bindProfileEvents();
		applyTheme(DB._theme);
		updateViewToggle();
		setReadonlyUI();
		updateNavBadges();
		navigate("dashboard");

		try { tool.reportValid(true, ""); } catch (e) { }

		tool.onValueChange(function (v) {
			loadDB(v);
			updateNavBadges();
			renderCurrentPage();
		});

		tool.onReadonlyChange(function (ro) {
			isReadOnly = !!ro;
			setReadonlyUI();
			renderCurrentPage();
		});
	});
})();
