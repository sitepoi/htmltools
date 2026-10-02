/* ── Weekend School Manager ──
   One tool for all student records of a weekend school:
   registration, attendance, payments, progress, Quran tracking,
   parent communication and weekly and monthly reports.
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
			reportValid: function () { }, notify: function (m) { try { console.log("notify:", m); } catch (e) { } }, resize: function () { }, declareOutput: function () { }, declareParams: function () { }
		};
	}

	/* ── Helpers ── */
	function $(s, r) { return (r || document).querySelector(s); }
	function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
	function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
	function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
	function pad2(n) { n = Number(n); return (n < 10 ? "0" : "") + n; }
	function notify(msg, sev) { try { tool.notify(msg, sev || "success"); } catch (e) { } }
	function resize() { try { tool.resize(); } catch (e) { } }

	/* ── Date helpers ── */
	function isoOfDate(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
	function parseIso(iso) { if (!iso) return null; var p = String(iso).split("-").map(Number); return new Date(p[0], (p[1] || 1) - 1, p[2] || 1); }
	function todayISO() { return isoOfDate(new Date()); }
	function addDaysIso(iso, n) { var d = parseIso(iso); if (!d) return iso; d.setDate(d.getDate() + n); return isoOfDate(d); }
	function sundayOfDate(d) { var copy = new Date(d.getFullYear(), d.getMonth(), d.getDate()); var day = copy.getDay(); if (day !== 0) copy.setDate(copy.getDate() - day); return copy; }
	function currentSundayISO() { return isoOfDate(sundayOfDate(new Date())); }
	function monthKeyOf(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1); }
	function currentMonthKey() { return monthKeyOf(new Date()); }
	function addMonthsToKey(ym, n) { var p = String(ym).split("-"); var d = new Date(Number(p[0]), Number(p[1]) - 1 + n, 1); return monthKeyOf(d); }
	function monthLabelOf(ym) { var p = String(ym).split("-"); var d = new Date(Number(p[0]), Number(p[1]) - 1, 1); return d.toLocaleDateString("en-US", { month: "long", year: "numeric" }); }
	function fmtDateLong(iso) { var d = parseIso(iso); if (!d || isNaN(d)) return "-"; return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric" }); }
	function fmtDateShort(iso) { var d = parseIso(iso); if (!d || isNaN(d)) return "-"; return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }); }
	function fmtDateTime(isoDateTime) { if (!isoDateTime) return "-"; var d = new Date(isoDateTime); if (isNaN(d)) return "-"; var opts = { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }; return d.toLocaleDateString("en-US", opts); }
	function sundaysInMonth(ym) {
		var p = String(ym).split("-");
		var year = Number(p[0]), month = Number(p[1]) - 1;
		var d = new Date(year, month, 1);
		var out = [];
		while (d.getMonth() === month) {
			if (d.getDay() === 0) out.push(isoOfDate(d));
			d.setDate(d.getDate() + 1);
		}
		return out;
	}
	function sundaysBetween(fromIso, count) {
		var out = []; var cur = fromIso;
		for (var i = 0; i < count; i++) { out.push(cur); cur = addDaysIso(cur, 7); }
		return out;
	}
	function initialsOf(name) {
		var p = (name || "").trim().split(/\s+/).filter(Boolean);
		if (!p.length) return "?";
		return ((p[0][0] || "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
	}

	/* ── State ── */
	var DB = defaultDatabase();
	var ui = {
		activePage: "students",
		studentFilterGroup: "all",
		studentSearch: "",
		attendanceWeekSunday: currentSundayISO(),
		paymentMonth: currentMonthKey(),
		progressStudentId: null,
		commTab: "group",
		commOnOneStudentId: null,
		reportKind: "monthly",
		reportMonth: currentMonthKey(),
		reportWeekSunday: currentSundayISO(),
		drawerStudentId: null,
		drawerTab: "overview"
	};

	var _readOnly = false;
	var _user = null;
	var _noIdentity = false;
	var _saveTimer = null;
	var _saveRetryTimer = null;
	var _warnedAutosave = false;
	var _dirty = false;

	var ATT_MARK_ORDER = ["", "P", "A", "L", "E"];
	var ATT_MARK_LABEL = { "P": "Present", "A": "Absent", "L": "Late", "E": "Excused", "": "Not marked" };
	var PAYMENT_STATUSES = ["unpaid", "paid", "partial", "late", "exempt"];
	var PAYMENT_LABEL = { "unpaid": "Unpaid", "paid": "Paid", "partial": "Partial", "late": "Late", "exempt": "Exempt" };
	var NOTE_FLAGS = ["none", "attention", "droppingInterest"];
	var NOTE_FLAG_LABEL = { "none": "", "attention": "Needs attention", "droppingInterest": "Dropping interest" };
	var HIFZ_STATUSES = ["target", "inProgress", "memorized", "revision"];
	var HIFZ_LABEL = { "target": "Next target", "inProgress": "In progress", "memorized": "Memorized", "revision": "Revision" };
	var SUGGESTION_STATUSES = ["open", "inProgress", "resolved"];
	var SUGGESTION_LABEL = { "open": "Open", "inProgress": "In progress", "resolved": "Resolved" };
	var LANGUAGE_LABEL = { "en": "English", "tr": "Turkish" };

	/* ── Defaults + normalization ── */
	function newStudent(firstName, lastName) {
		return {
			id: uid(), firstName: firstName || "", lastName: lastName || "",
			gender: "", dateOfBirth: "", classGroup: "", startDate: todayISO(), status: "active", paymentBracketId: "",
			parentName: "", parentPhone: "", parentEmail: "", parentRelation: "",
			secondParentName: "", secondParentPhone: "",
			address: "",
			emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelation: "",
			allergies: "", healthNotes: "",
			pickupAuthorizedNames: "", pickupNotes: "",
			photoConsent: "notAsked",
			paymentEntries: [], documents: [], progressNotes: [], teacherContactLog: [],
			quranReading: { currentLevel: "", levelHistory: [] },
			quranMemorization: { surahs: [], nextTarget: "" },
			parentCommunication: { oneOnOne: [], absenceCalls: [] },
			attendanceByDate: {}
		};
	}

	function defaultDatabase() {
		return {
			version: 1,
			school: {
				name: "Weekend School",
				classGroups: ["Quran Level 1"],
				lessons: ["Quran Reading", "Islamic Studies", "Prayer Practice", "Quran Memorization"],
				paymentBrackets: [{ id: uid(), name: "Full", monthlyFee: 40 }],
				currency: "CAD",
				paymentDueDay: 1,
				requiredAttendanceChecksPerDay: 4,
				seeded: false
			},
			students: [],
			attendanceWeeks: {},
			schoolLogs: { groupMessages: [], suggestionsComplaints: [] },
			ui: { activePage: "students" }
		};
	}

	function normalizeStudent(raw) {
		var s = raw || {};
		var base = newStudent("", "");
		for (var key in base) {
			if (Object.prototype.hasOwnProperty.call(base, key) && Object.prototype.hasOwnProperty.call(s, key)) base[key] = s[key];
		}
		base.id = String(s.id || uid());
		base.firstName = String(s.firstName || "");
		base.lastName = String(s.lastName || "");
		if (["active", "paused", "left"].indexOf(s.status) === -1) base.status = "active";
		base.classGroup = String(s.classGroup || "");
		base.paymentEntries = Array.isArray(s.paymentEntries) ? s.paymentEntries.map(normalizePaymentEntry) : [];
		if (!base.paymentEntries.length && s.paymentsByMonth && typeof s.paymentsByMonth === "object" && !Array.isArray(s.paymentsByMonth)) {
			base.paymentEntries = Object.keys(s.paymentsByMonth).map(function (monthKey) {
				var rec = s.paymentsByMonth[monthKey];
				return {
					id: uid(), month: monthKey,
					amount: typeof rec.amount === "number" ? rec.amount : 0,
					dueDate: monthKey + "-01",
					status: rec.status || "unpaid",
					paidDate: rec.status === "paid" && rec.recordedAt ? rec.recordedAt.slice(0, 10) : "",
					note: rec.note || "",
					recordedBy: rec.recordedBy || ""
				};
			});
		}
		base.documents = Array.isArray(s.documents) ? s.documents.map(function (doc) {
			return {
				id: String(doc.id || uid()), name: String(doc.name || "Document"), url: String(doc.url || ""),
				kind: ["photoConsent", "emergencyInfo", "other"].indexOf(doc.kind) > -1 ? doc.kind : "other",
				uploadedAt: String(doc.uploadedAt || ""), uploadedBy: String(doc.uploadedBy || "")
			};
		}) : [];
		base.progressNotes = Array.isArray(s.progressNotes) ? s.progressNotes : [];
		base.teacherContactLog = Array.isArray(s.teacherContactLog) ? s.teacherContactLog : [];
		base.quranReading = (s.quranReading && typeof s.quranReading === "object") ? s.quranReading : { currentLevel: "", levelHistory: [] };
		if (!Array.isArray(base.quranReading.levelHistory)) base.quranReading.levelHistory = [];
		base.quranMemorization = (s.quranMemorization && typeof s.quranMemorization === "object") ? s.quranMemorization : { surahs: [], nextTarget: "" };
		if (!Array.isArray(base.quranMemorization.surahs)) base.quranMemorization.surahs = [];
		base.parentCommunication = (s.parentCommunication && typeof s.parentCommunication === "object") ? s.parentCommunication : { oneOnOne: [], absenceCalls: [] };
		if (!Array.isArray(base.parentCommunication.oneOnOne)) base.parentCommunication.oneOnOne = [];
		if (!Array.isArray(base.parentCommunication.absenceCalls)) base.parentCommunication.absenceCalls = [];
		base.attendanceByDate = {};
		if (s.attendanceByDate && typeof s.attendanceByDate === "object" && !Array.isArray(s.attendanceByDate)) {
			Object.keys(s.attendanceByDate).forEach(function (sundayKey) {
				var rec = s.attendanceByDate[sundayKey] || {};
				var lessons = {};
				if (rec.lessons && typeof rec.lessons === "object") {
					Object.keys(rec.lessons).forEach(function (lessonName) {
						var val = rec.lessons[lessonName];
						if (typeof val === "string") lessons[lessonName] = { mark: val, teacherName: "", teacherAt: "" };
						else lessons[lessonName] = { mark: (val && val.mark) || "", teacherName: (val && val.teacherName) || "", teacherAt: (val && val.teacherAt) || "" };
					});
				}
				base.attendanceByDate[sundayKey] = { lessons: lessons, note: rec.note || "" };
			});
		}
		return base;
	}

	function normalizeDatabase(raw) {
		var d = defaultDatabase();
		if (!raw || typeof raw !== "object") return d;
		var school = raw.school || {};
		d.school.name = String(school.name || d.school.name);
		if (Array.isArray(school.classGroups) && school.classGroups.length) d.school.classGroups = school.classGroups.map(String);
		if (Array.isArray(school.lessons) && school.lessons.length) d.school.lessons = school.lessons.map(String);
		if (Array.isArray(school.paymentBrackets) && school.paymentBrackets.length) {
			d.school.paymentBrackets = school.paymentBrackets.map(function (b) {
				return { id: String(b.id || uid()), name: String(b.name || "Bracket"), monthlyFee: Number(b.monthlyFee) || 0 };
			});
		}
		d.school.currency = String(school.currency || d.school.currency);
		d.school.paymentDueDay = Number(school.paymentDueDay) || 1;
		d.school.requiredAttendanceChecksPerDay = Number(school.requiredAttendanceChecksPerDay) > 0 ? Number(school.requiredAttendanceChecksPerDay) : d.school.lessons.length || 1;
		d.school.seeded = !!school.seeded;
		if (Array.isArray(raw.students)) d.students = raw.students.map(normalizeStudent);
		d.attendanceWeeks = (raw.attendanceWeeks && typeof raw.attendanceWeeks === "object" && !Array.isArray(raw.attendanceWeeks)) ? raw.attendanceWeeks : {};
		var logs = raw.schoolLogs || {};
		d.schoolLogs.groupMessages = Array.isArray(logs.groupMessages) ? logs.groupMessages : [];
		d.schoolLogs.suggestionsComplaints = Array.isArray(logs.suggestionsComplaints) ? logs.suggestionsComplaints : [];
		if (raw.ui && raw.ui.activePage) d.ui.activePage = String(raw.ui.activePage);
		return d;
	}

	/* ── Identity + permissions ── */
	function hasUserApi() { return typeof tool.getUser === "function"; }
	function getUserSafe() { try { return hasUserApi() ? tool.getUser() : null; } catch (e) { return null; } }
	function userName() {
		if (_user) return _user.name || _user.email || "CMS user";
		return "CMS user";
	}
	function rolesOf(u) {
		u = u || _user;
		var roles = (u && Array.isArray(u.roles)) ? u.roles : [];
		var ea = (u && u.effectiveAccess) || {};
		if (ea.isManager && roles.indexOf("admin") === -1) roles = roles.concat(["admin"]);
		if (ea.isEditor && roles.indexOf("editor") === -1) roles = roles.concat(["editor"]);
		if (ea.isViewer && roles.indexOf("viewer") === -1) roles = roles.concat(["viewer"]);
		return roles;
	}
	function canWrite() {
		if (_readOnly) return false;
		if (_noIdentity) return true;
		if (!_user) return false;
		var roles = rolesOf();
		if (roles.indexOf("admin") > -1 || roles.indexOf("editor") > -1 || roles.indexOf("developer") > -1 || roles.indexOf("owner") > -1 || roles.indexOf("user-manager") > -1) return true;
		return false;
	}
	function canAdmin() {
		if (_readOnly) return false;
		if (_noIdentity) return true;
		if (!_user) return false;
		var roles = rolesOf();
		if (roles.indexOf("admin") > -1 || roles.indexOf("developer") > -1 || roles.indexOf("owner") > -1 || roles.indexOf("user-manager") > -1) return true;
		var ea = _user.effectiveAccess || {};
		return !!ea.isManager;
	}
	function refreshUser() {
		if (!hasUserApi()) { _noIdentity = true; applyLockState(); return; }
		var attempts = 0;
		var delays = [400, 1200, 2600, 5000];
		var poll = function () {
			var u = getUserSafe();
			if (u) { _user = u; _noIdentity = false; applyLockState(); return; }
			if (attempts < delays.length) setTimeout(poll, delays[attempts++]);
			else { _noIdentity = true; applyLockState(); }
		};
		poll();
	}
	function applyLockState() {
		var app = $("#wsm-app");
		if (app) {
			if (!canWrite()) app.classList.add("wsm-app-readonly");
			else app.classList.remove("wsm-app-readonly");
		}
		renderAll();
	}

	/* ── Persistence ── */
	function snapshotText() { return JSON.stringify(DB); }
	function snapshotBytes() {
		var s = snapshotText();
		try { return new Blob([s]).size; } catch (e) { return s.length; }
	}
	function updateSizeMeter() {
		var el = $("#wsm-size-meter");
		if (!el) return;
		var bytes = snapshotBytes();
		var label = bytes >= 1048576 ? (bytes / 1048576).toFixed(2) + " MB" : Math.round(bytes / 1024) + " KB";
		el.textContent = "Size: " + label;
		el.classList.remove("warn", "danger");
		if (bytes > 950000) el.classList.add("danger");
		else if (bytes > 800000) el.classList.add("warn");
		var avg = DB.students.length ? Math.round(bytes / DB.students.length / 1024) : 0;
		el.title = "Stored data: " + label + " of the 1 MB Firestore document limit. Average " + avg + " KB per student. At that average, roughly " + remainingStudentCount() + " more students fit before the 90% safety line.";
	}
	function remainingStudentCount() {
		var bytes = snapshotBytes();
		var avg = DB.students.length ? bytes / DB.students.length : 0;
		if (!avg) return "--";
		return Math.max(0, Math.floor((0.9 * 1048576 - bytes) / avg));
	}
	function persistNow() { try { tool.setValue(DB); } catch (e) { } updateSizeMeter(); }
	function persistSoon() {
		_dirty = true;
		clearTimeout(_saveTimer);
		_saveTimer = setTimeout(flushPendingSave, 300);
	}
	function flushPendingSave() {
		clearTimeout(_saveTimer);
		if (!_dirty || _readOnly) return;
		_dirty = false;
		persistNow();
		requestParentSave();
		if (snapshotBytes() > 800000) {
			notify("Stored data is approaching the 1 MB document limit (" + Math.round(snapshotBytes() / 1024) + " KB). Reduce old history or move some students to a separate school record to keep saving safely.", "warning");
		}
	}
	function requestParentSave() {
		if (_readOnly) return;
		try {
			if (typeof tool.requestSave !== "function") return;
			tool.requestSave(function (error, ok) {
				if (error || !ok) {
					if (!_warnedAutosave) {
						_warnedAutosave = true;
						notify("Automatic save was rejected. Set the CMS field setting allowRequestSave to 'yes', or save the form manually.", "warning");
					}
					clearTimeout(_saveRetryTimer);
					_saveRetryTimer = setTimeout(function () { _warnedAutosave = false; flushPendingSave(); }, 10000);
				}
			});
		} catch (ignored) { }
	}

	/* ── Student lookups ── */
	function findStudent(studentId) {
		for (var i = 0; i < DB.students.length; i++) if (DB.students[i].id === studentId) return DB.students[i];
		return null;
	}
	function activeStudents() { return DB.students.filter(function (s) { return s.status === "active"; }); }
	function studentFullName(s) { return (s.firstName + " " + s.lastName).trim(); }
	function sortedStudents() {
		return DB.students.slice().sort(function (a, b) {
			var byGroup = (a.classGroup || "").localeCompare(b.classGroup || "");
			if (byGroup) return byGroup;
			return (a.firstName + " " + a.lastName).localeCompare(b.firstName + " " + b.lastName);
		});
	}
	function bracketOf(student) {
		for (var i = 0; i < DB.school.paymentBrackets.length; i++) if (DB.school.paymentBrackets[i].id === student.paymentBracketId) return DB.school.paymentBrackets[i];
		return null;
	}
	function bracketNameOf(student) {
		var b = bracketOf(student);
		return b ? b.name : "-";
	}
	function bracketFeeOf(student) {
		var b = bracketOf(student);
		return b ? b.monthlyFee : 0;
	}

	/* ── Payment helpers (entries act as a debt list) ── */
	function normalizePaymentEntry(raw) {
		var e = raw || {};
		return {
			id: String(e.id || uid()),
			month: String(e.month || ""),
			amount: Number(e.amount) || 0,
			dueDate: String(e.dueDate || ""),
			status: PAYMENT_STATUSES.indexOf(e.status) > -1 ? e.status : "unpaid",
			paidDate: String(e.paidDate || ""),
			note: String(e.note || ""),
			recordedBy: String(e.recordedBy || "")
		};
	}
	function newPaymentEntry(month, amount) {
		return normalizePaymentEntry({ month: month, amount: amount, dueDate: month ? month + "-" + pad2(DB.school.paymentDueDay || 1) : "" });
	}
	function entryForMonth(student, ym) {
		var entries = (student.paymentEntries || []).filter(function (e) { return e.month === ym; });
		return entries.length ? entries[entries.length - 1] : null;
	}
	function paymentStatusOf(student, ym) {
		var e = entryForMonth(student, ym);
		return e ? e.status : "unpaid";
	}
	function paymentExpectedOf(student, ym) {
		var e = entryForMonth(student, ym);
		if (e && e.amount > 0) return e.amount;
		return bracketFeeOf(student);
	}
	function setPaymentStatus(studentId, ym, status) {
		var s = findStudent(studentId);
		if (!s) return;
		var e = entryForMonth(s, ym);
		if (!e) { e = newPaymentEntry(ym, bracketFeeOf(s)); s.paymentEntries.push(e); }
		e.status = status;
		e.recordedBy = userName();
		if (status === "paid") { if (!e.paidDate) e.paidDate = todayISO(); }
		else e.paidDate = "";
		persistSoon();
	}
	function setPaymentAmount(studentId, ym, amount) {
		var s = findStudent(studentId);
		if (!s) return;
		var e = entryForMonth(s, ym);
		if (!e) { e = newPaymentEntry(ym, amount); s.paymentEntries.push(e); }
		e.amount = amount;
		e.recordedBy = userName();
		persistSoon();
	}
	function setPaymentNote(studentId, ym, note) {
		var s = findStudent(studentId);
		if (!s) return;
		var e = entryForMonth(s, ym);
		if (!e) { e = newPaymentEntry(ym, bracketFeeOf(s)); s.paymentEntries.push(e); }
		e.note = note;
		persistSoon();
	}
	function waitingPaymentList() {
		var rows = [];
		DB.students.forEach(function (s) {
			(s.paymentEntries || []).forEach(function (e) {
				if (e.status === "unpaid" || e.status === "late" || e.status === "partial") rows.push({ student: s, entry: e });
			});
		});
		rows.sort(function (a, b) {
			var byDue = (a.entry.dueDate || a.entry.month).localeCompare(b.entry.dueDate || b.entry.month);
			if (byDue) return byDue;
			return studentFullName(a.student).localeCompare(studentFullName(b.student));
		});
		return rows;
	}
	function findPaymentEntryOwner(entryId) {
		for (var i = 0; i < DB.students.length; i++) {
			var s = DB.students[i];
			for (var j = 0; j < (s.paymentEntries || []).length; j++) {
				if (s.paymentEntries[j].id === entryId) return { student: s, entry: s.paymentEntries[j] };
			}
		}
		return null;
	}

	/* ── Attendance helpers ── */
	function nextMark(mark) {
		var i = ATT_MARK_ORDER.indexOf(mark || "");
		return ATT_MARK_ORDER[(i + 1) % ATT_MARK_ORDER.length];
	}
	function attendanceRecordFor(student, sundayIso) {
		return student.attendanceByDate[sundayIso] || null;
	}
	function markForLesson(student, sundayIso, lessonName) {
		var rec = attendanceRecordFor(student, sundayIso);
		var cell = rec && rec.lessons ? rec.lessons[lessonName] : null;
		return cell && cell.mark ? cell.mark : "";
	}
	function teacherForLesson(student, sundayIso, lessonName) {
		var rec = attendanceRecordFor(student, sundayIso);
		var cell = rec && rec.lessons ? rec.lessons[lessonName] : null;
		return cell && cell.teacherName ? cell.teacherName : "";
	}
	function setLessonMark(studentId, sundayIso, lessonName, mark) {
		var s = findStudent(studentId);
		if (!s) return;
		var rec = s.attendanceByDate[sundayIso] || (s.attendanceByDate[sundayIso] = { lessons: {}, note: "" });
		rec.lessons[lessonName] = { mark: mark, teacherName: userName(), teacherAt: new Date().toISOString() };
		persistSoon();
	}
	function requiredChecksPerDay() {
		var required = Number(DB.school.requiredAttendanceChecksPerDay);
		return (required > 0 ? required : DB.school.lessons.length) || 1;
	}
	function marksSummaryForSunday(student, sundayIso) {
		var present = 0, marked = 0;
		DB.school.lessons.forEach(function (lessonName) {
			var m = markForLesson(student, sundayIso, lessonName);
			if (m) { marked++; if (m === "P" || m === "L") present++; }
		});
		return { marked: marked, present: present, total: requiredChecksPerDay() };
	}
	function weekCompletionOf(sundayIso) { return DB.attendanceWeeks[sundayIso] || null; }
	function collectAttendanceWeekKeys() {
		var keys = {};
		DB.students.forEach(function (s) { for (var k in s.attendanceByDate) if (Object.prototype.hasOwnProperty.call(s.attendanceByDate, k)) keys[k] = true; });
		for (var k2 in DB.attendanceWeeks) if (Object.prototype.hasOwnProperty.call(DB.attendanceWeeks, k2)) keys[k2] = true;
		return Object.keys(keys).sort().reverse();
	}

	/* ── Navigation ── */
	function switchPage(page) {
		ui.activePage = page;
		DB.ui.activePage = page;
		$$("#wsm-nav .wsm-nav-item").forEach(function (n) { n.classList.toggle("active", n.getAttribute("data-page") === page); });
		$$(".wsm-page").forEach(function (p) { p.classList.remove("active"); });
		var sec = $("#wsm-page-" + page);
		if (sec) sec.classList.add("active");
		renderPage(page);
		persistSoon();
		resize();
	}
	function renderPage(page) {
		if (page === "students") renderStudentsPage();
		else if (page === "attendance") renderAttendancePage();
		else if (page === "payments") renderPaymentsPage();
		else if (page === "progress") renderProgressPage();
		else if (page === "communication") renderCommunicationPage();
		else if (page === "reports") renderReportsPage();
		else if (page === "settings") renderSettingsPage();
	}
	function renderAll() {
		updateSchoolName();
		renderNavBadges();
		updateSizeMeter();
		renderPage(ui.activePage);
		if (ui.drawerStudentId) renderDrawer();
	}
	function updateSchoolName() {
		var el = $("#wsm-school-name");
		if (el) el.textContent = DB.school.name;
	}
	function renderNavBadges() {
		var sc = $("#wsm-nav-students");
		if (sc) sc.textContent = activeStudents().length;
		var pc = $("#wsm-nav-payments");
		if (pc) pc.textContent = waitingPaymentList().length;
		var fc = $("#wsm-nav-flags");
		if (fc) fc.textContent = flaggedStudents().length;
	}
	function flaggedStudents() {
		return DB.students.filter(function (s) {
			var latest = null;
			for (var i = s.progressNotes.length - 1; i >= 0; i--) {
				if (s.progressNotes[i].flag && s.progressNotes[i].flag !== "none") { latest = s.progressNotes[i]; break; }
			}
			return !!latest;
		});
	}

	/* ═══════════════════════════════════════════
	   STUDENTS PAGE
	   ═══════════════════════════════════════════ */
	function renderStudentsPage() {
		renderGroupChips();
		renderStudentList();
	}
	function renderGroupChips() {
		var holder = $("#wsm-student-group-chips");
		if (!holder) return;
		var groups = ["all"].concat(DB.school.classGroups);
		holder.innerHTML = groups.map(function (g) {
			var count = g === "all" ? DB.students.length : DB.students.filter(function (s) { return s.classGroup === g; }).length;
			return '<button class="wsm-chip' + (ui.studentFilterGroup === g ? " active" : "") + '" data-act="student-group-filter" data-group="' + esc(g) + '">' + esc(g) + " · " + count + "</button>";
		}).join("");
	}
	function renderStudentList() {
		var holder = $("#wsm-student-list");
		if (!holder) return;
		if (!DB.students.length) {
			holder.innerHTML = '<div class="wsm-empty"><h3>No students yet</h3><p>Add the first student to start keeping their records.</p><button class="wsm-btn wsm-btn-primary" data-act="add-student">+ Add First Student</button></div>';
			return;
		}
		var q = ui.studentSearch.toLowerCase();
		var list = sortedStudents().filter(function (s) {
			if (ui.studentFilterGroup !== "all" && s.classGroup !== ui.studentFilterGroup) return false;
			if (!q) return true;
			var hay = (s.firstName + " " + s.lastName + " " + s.parentName + " " + s.parentPhone + " " + s.classGroup).toLowerCase();
			return hay.indexOf(q) > -1;
		});
		if (!list.length) {
			holder.innerHTML = '<div class="wsm-empty"><h3>No matches</h3><p>No students match "' + esc(q) + '".</p></div>';
			return;
		}
		var ym = currentMonthKey();
		var sunday = ui.attendanceWeekSunday;
		holder.innerHTML = list.map(function (s) {
			var payStatus = paymentStatusOf(s, ym);
			var payPillClass = { "paid": "wsm-pill-green", "partial": "wsm-pill-blue", "late": "wsm-pill-amber", "exempt": "wsm-pill-purple", "unpaid": "wsm-pill-gray" }[payStatus] || "wsm-pill-gray";
			var att = marksSummaryForSunday(s, sunday);
			var attText = att.total ? (att.marked === att.total ? (att.present + "/" + att.total + " present") : (att.marked + "/" + att.total + " marked")) : "No marks";
			var attPillClass = att.total && att.marked === att.total ? (att.present === att.total ? "wsm-pill-green" : att.present === 0 ? "wsm-pill-red" : "wsm-pill-amber") : "wsm-pill-gray";
			var latestFlag = null;
			for (var i = s.progressNotes.length - 1; i >= 0; i--) {
				if (s.progressNotes[i].flag && s.progressNotes[i].flag !== "none") { latestFlag = s.progressNotes[i]; break; }
			}
			return '<div class="wsm-student-row" data-act="open-student" data-id="' + s.id + '">' +
				'<div class="wsm-student-avatar">' + esc(initialsOf(studentFullName(s))) + '</div>' +
				'<div class="wsm-student-main">' +
					'<div class="wsm-student-name">' + esc(studentFullName(s)) + (s.status !== "active" ? ' <span class="wsm-pill wsm-pill-gray">' + esc(s.status) + '</span>' : "") + '</div>' +
					'<div class="wsm-student-meta">' + esc(s.classGroup || "No class group") + " · Parent: " + esc(s.parentName || "-") + (s.parentPhone ? " · " + esc(s.parentPhone) : "") + '</div>' +
				'</div>' +
				'<div class="wsm-student-side">' +
					(latestFlag ? '<span class="wsm-pill ' + (latestFlag.flag === "droppingInterest" ? "wsm-pill-red" : "wsm-pill-amber") + '">' + esc(NOTE_FLAG_LABEL[latestFlag.flag]) + "</span>" : "") +
					'<span class="wsm-pill ' + attPillClass + '" title="Last Sunday attendance">' + esc(attText) + "</span>" +
					'<span class="wsm-pill ' + payPillClass + '" title="This month payment">' + esc(PAYMENT_LABEL[payStatus]) + "</span>" +
					'<button class="wsm-btn wsm-btn-ghost wsm-btn-sm" data-act="edit-student" data-id="' + s.id + '">✏️ Edit</button>' +
					(canAdmin() ? '<button class="wsm-btn wsm-btn-danger wsm-btn-sm" data-act="delete-student" data-id="' + s.id + '">🗑</button>' : "") +
				'</div>' +
			'</div>';
		}).join("");
	}

	/* ── Student modal ── */
	function openStudentModal(studentId) {
		var s = studentId ? findStudent(studentId) : null;
		var isEdit = !!s;
		var groupOptions = DB.school.classGroups.map(function (g) {
			return '<option value="' + esc(g) + '"' + (s && s.classGroup === g ? " selected" : "") + ">" + esc(g) + "</option>";
		}).join("");
		var bracketOptions = DB.school.paymentBrackets.map(function (b) {
			return '<option value="' + b.id + '"' + (s && s.paymentBracketId === b.id ? " selected" : "") + ">" + esc(b.name) + " (" + esc(DB.school.currency) + " " + b.monthlyFee + ")</option>";
		}).join("");
		var statusOptions = ["active", "paused", "left"].map(function (st) {
			return '<option value="' + st + '"' + (s && s.status === st ? " selected" : "") + ">" + st.charAt(0).toUpperCase() + st.slice(1) + "</option>";
		}).join("");
		var consentOptions = ["notAsked", "yes", "no"].map(function (c) {
			var label = c === "notAsked" ? "Not asked" : (c === "yes" ? "Yes" : "No");
			return '<option value="' + c + '"' + (s && s.photoConsent === c ? " selected" : "") + ">" + label + "</option>";
		}).join("");
		var v = function (field, def) { return s ? esc(s[field] || def || "") : def || ""; };

		var body =
			'<div class="wsm-field-row">' +
				'<div class="wsm-field"><label class="wsm-label">First name *</label><input class="wsm-input" id="wsmf-firstName" value="' + v("firstName") + '"></div>' +
				'<div class="wsm-field"><label class="wsm-label">Last name</label><input class="wsm-input" id="wsmf-lastName" value="' + v("lastName") + '"></div>' +
			'</div>' +
			'<div class="wsm-field-row">' +
				'<div class="wsm-field"><label class="wsm-label">Gender</label><select class="wsm-input" id="wsmf-gender"><option value="">-</option><option value="female"' + (s && s.gender === "female" ? " selected" : "") + ">Female</option><option value=\"male\"" + (s && s.gender === "male" ? " selected" : "") + ">Male</option></select></div>" +
				'<div class="wsm-field"><label class="wsm-label">Date of birth</label><input class="wsm-input" type="date" id="wsmf-dateOfBirth" value="' + v("dateOfBirth") + '"></div>' +
			'</div>' +
			'<div class="wsm-field-row">' +
				'<div class="wsm-field"><label class="wsm-label">Class group</label><select class="wsm-input" id="wsmf-classGroup"><option value="">-</option>' + groupOptions + "</select></div>" +
				'<div class="wsm-field"><label class="wsm-label">Status</label><select class="wsm-input" id="wsmf-status">' + statusOptions + "</select></div>" +
			'</div>' +
			'<div class="wsm-field-row">' +
				'<div class="wsm-field"><label class="wsm-label">Payment bracket</label><select class="wsm-input" id="wsmf-bracket"><option value="">-</option>' + bracketOptions + "</select></div>" +
				'<div class="wsm-field"><label class="wsm-label">Start date</label><input class="wsm-input" type="date" id="wsmf-startDate" value="' + v("startDate", todayISO()) + '"></div>' +
			'</div>' +
			'<div class="wsm-card-title" style="margin-top:16px">Parent information</div>' +
			'<div class="wsm-field-row">' +
				'<div class="wsm-field"><label class="wsm-label">Primary parent name</label><input class="wsm-input" id="wsmf-parentName" value="' + v("parentName") + '"></div>' +
				'<div class="wsm-field"><label class="wsm-label">Relation</label><input class="wsm-input" id="wsmf-parentRelation" value="' + v("parentRelation") + '"></div>' +
			'</div>' +
			'<div class="wsm-field-row">' +
				'<div class="wsm-field"><label class="wsm-label">Phone</label><input class="wsm-input" id="wsmf-parentPhone" value="' + v("parentPhone") + '"></div>' +
				'<div class="wsm-field"><label class="wsm-label">Email</label><input class="wsm-input" id="wsmf-parentEmail" value="' + v("parentEmail") + '"></div>' +
			'</div>' +
			'<div class="wsm-field-row">' +
				'<div class="wsm-field"><label class="wsm-label">Second parent name</label><input class="wsm-input" id="wsmf-secondParentName" value="' + v("secondParentName") + '"></div>' +
				'<div class="wsm-field"><label class="wsm-label">Second parent phone</label><input class="wsm-input" id="wsmf-secondParentPhone" value="' + v("secondParentPhone") + '"></div>' +
			'</div>' +
			'<div class="wsm-field"><label class="wsm-label">Home address</label><input class="wsm-input" id="wsmf-address" value="' + v("address") + '"></div>' +
			'<div class="wsm-card-title" style="margin-top:16px">Emergency, health and pick-up</div>' +
			'<div class="wsm-field-row">' +
				'<div class="wsm-field"><label class="wsm-label">Emergency contact name</label><input class="wsm-input" id="wsmf-emergencyContactName" value="' + v("emergencyContactName") + '"></div>' +
				'<div class="wsm-field"><label class="wsm-label">Phone</label><input class="wsm-input" id="wsmf-emergencyContactPhone" value="' + v("emergencyContactPhone") + '"></div>' +
			'</div>' +
			'<div class="wsm-field"><label class="wsm-label">Emergency contact relation</label><input class="wsm-input" id="wsmf-emergencyContactRelation" value="' + v("emergencyContactRelation") + '"></div>' +
			'<div class="wsm-field"><label class="wsm-label">Allergies</label><input class="wsm-input" id="wsmf-allergies" value="' + v("allergies") + '"></div>' +
			'<div class="wsm-field"><label class="wsm-label">Health notes</label><textarea class="wsm-input" id="wsmf-healthNotes">' + v("healthNotes") + "</textarea></div>" +
			'<div class="wsm-field-row">' +
				'<div class="wsm-field"><label class="wsm-label">Authorized pick-up names</label><input class="wsm-input" id="wsmf-pickupAuthorizedNames" value="' + v("pickupAuthorizedNames") + '"></div>' +
				'<div class="wsm-field"><label class="wsm-label">Pick-up notes</label><input class="wsm-input" id="wsmf-pickupNotes" value="' + v("pickupNotes") + '"></div>' +
			'</div>' +
			'<div class="wsm-field" style="max-width:220px"><label class="wsm-label">Photo consent</label><select class="wsm-input" id="wsmf-photoConsent">' + consentOptions + "</select></div>";

		openModal(isEdit ? "Edit Student" : "Add Student", body,
			'<button class="wsm-btn wsm-btn-ghost" data-act="modal-close">Cancel</button><button class="wsm-btn wsm-btn-primary" data-act="student-save" data-id="' + (s ? s.id : "") + '">Save Student</button>');
	}
	function saveStudentFromModal(studentId) {
		var firstName = ($("#wsmf-firstName") ? $("#wsmf-firstName").value : "").trim();
		if (!firstName) { notify("First name is required.", "warning"); return; }
		var s = studentId ? findStudent(studentId) : null;
		if (!s) { s = newStudent(firstName, ""); DB.students.push(s); }
		var read = function (id) { var el = $("#" + id); return el ? el.value.trim() : ""; };
		s.firstName = firstName;
		s.lastName = read("wsmf-lastName");
		s.gender = read("wsmf-gender");
		s.dateOfBirth = read("wsmf-dateOfBirth");
		s.classGroup = read("wsmf-classGroup");
		s.status = read("wsmf-status") || "active";
		s.paymentBracketId = read("wsmf-bracket");
		s.startDate = read("wsmf-startDate") || todayISO();
		s.parentName = read("wsmf-parentName");
		s.parentRelation = read("wsmf-parentRelation");
		s.parentPhone = read("wsmf-parentPhone");
		s.parentEmail = read("wsmf-parentEmail");
		s.secondParentName = read("wsmf-secondParentName");
		s.secondParentPhone = read("wsmf-secondParentPhone");
		s.address = read("wsmf-address");
		s.emergencyContactName = read("wsmf-emergencyContactName");
		s.emergencyContactPhone = read("wsmf-emergencyContactPhone");
		s.emergencyContactRelation = read("wsmf-emergencyContactRelation");
		s.allergies = read("wsmf-allergies");
		var hn = $("#wsmf-healthNotes"); s.healthNotes = hn ? hn.value.trim() : "";
		s.pickupAuthorizedNames = read("wsmf-pickupAuthorizedNames");
		s.pickupNotes = read("wsmf-pickupNotes");
		s.photoConsent = read("wsmf-photoConsent") || "notAsked";
		closeModal();
		persistSoon();
		renderAll();
		notify("Student saved.");
	}
	function deleteStudentConfirm(studentId) {
		var s = findStudent(studentId);
		if (!s) return;
		openModal("Delete Student",
			'<p>Delete <strong>' + esc(studentFullName(s)) + '</strong> and all of their records (attendance, payments, notes, communication)? This cannot be undone.</p>',
			'<button class="wsm-btn wsm-btn-ghost" data-act="modal-close">Cancel</button><button class="wsm-btn wsm-btn-danger" data-act="delete-student-confirm" data-id="' + s.id + '">Delete Student</button>');
	}
	function deleteStudentNow(studentId) {
		DB.students = DB.students.filter(function (s) { return s.id !== studentId; });
		if (ui.drawerStudentId === studentId) closeDrawer();
		closeModal();
		persistSoon();
		renderAll();
		notify("Student deleted.");
	}

	/* ═══════════════════════════════════════════
	   ATTENDANCE PAGE
	   ═══════════════════════════════════════════ */
	function renderAttendancePage() {
		var label = $("#wsm-att-week-label");
		if (label) label.textContent = fmtDateLong(ui.attendanceWeekSunday) + " (Sunday)";
		renderAttendanceStatus();
		renderAttendanceTable();
		renderAttendanceLegend();
		renderAttendanceOpenWeeks();
	}
	function renderAttendanceStatus() {
		var holder = $("#wsm-att-status");
		if (!holder) return;
		var sunday = ui.attendanceWeekSunday;
		var required = requiredChecksPerDay();
		var enteredChecks = 0, expectedChecks = required * activeStudents().length;
		activeStudents().forEach(function (s) {
			DB.school.lessons.forEach(function (l) { if (markForLesson(s, sunday, l)) enteredChecks++; });
		});
		var progressPill = '<span class="wsm-pill ' + (enteredChecks >= expectedChecks ? "wsm-pill-green" : "wsm-pill-teal") + '">' + enteredChecks + " of " + expectedChecks + " checks entered (" + required + " per student)</span>";
		var completion = weekCompletionOf(sunday);
		if (!completion) {
			holder.innerHTML = '<span class="wsm-att-status-dot" style="background:#f59e0b"></span><span>Not completed yet</span> ' + progressPill;
			return;
		}
		var late = completion.completedAt && completion.completedAt.slice(0, 10) > addDaysIso(sunday, 1);
		holder.innerHTML = '<span class="wsm-att-status-dot" style="background:#16a34a"></span><span>Completed by ' + esc(completion.completedByName || "someone") + " · " + esc(fmtDateTime(completion.completedAt)) + "</span> " + progressPill +
			(late ? '<span class="wsm-pill wsm-pill-amber">Entered late (more than 24 hours after Sunday)</span>' : '<span class="wsm-pill wsm-pill-green">Within 24 hours</span>');
	}
	function renderAttendanceLegend() {
		var holder = $("#wsm-att-legend");
		if (!holder) return;
		holder.innerHTML = '<span class="wsm-legend-item"><span class="wsm-att-cell p">P</span><span>Present</span></span>' +
			'<span class="wsm-legend-item"><span class="wsm-att-cell a">A</span><span>Absent</span></span>' +
			'<span class="wsm-legend-item"><span class="wsm-att-cell l">L</span><span>Late</span></span>' +
			'<span class="wsm-legend-item"><span class="wsm-att-cell e">E</span><span>Excused</span></span>' +
			'<span class="wsm-legend-hint">Click a cell to cycle the mark</span>';
	}
	function renderAttendanceTable() {
		var table = $("#wsm-att-table");
		if (!table) return;
		var students = sortedStudents();
		var sunday = ui.attendanceWeekSunday;
		if (!DB.school.lessons.length) {
			table.innerHTML = '<tbody><tr><td colspan="4">No lessons configured. Add lessons in Settings first.</td></tr></tbody>';
			return;
		}
		if (!students.length) {
			table.innerHTML = '<tbody><tr><td colspan="' + (DB.school.lessons.length + 3) + '">No students yet. Add students first.</td></tr></tbody>';
			return;
		}
		var head = "<thead><tr><th>Student</th><th>Class group</th>";
		DB.school.lessons.forEach(function (l) {
			var teacherName = null;
			students.forEach(function (s) { var t = teacherForLesson(s, sunday, l); if (t) teacherName = t; });
			head += '<th>' + esc(l) + '<div class="wsm-lesson-teacher">' + (teacherName ? "by " + esc(teacherName) : "not entered") + "</div></th>";
		});
		head += '<th>Marks<br><span class="wsm-th-sub">of ' + requiredChecksPerDay() + "</span></th></tr></thead>";
		var body = "<tbody>" + students.map(function (s) {
			var summary = marksSummaryForSunday(s, sunday);
			var cells = DB.school.lessons.map(function (l) {
				var m = markForLesson(s, sunday, l);
				var teacherName = teacherForLesson(s, sunday, l);
				return '<td><button class="wsm-att-cell ' + m.toLowerCase() + '" data-act="att-cell" data-student="' + s.id + '" data-lesson="' + esc(l) + '" title="' + esc(studentFullName(s)) + " · " + esc(l) + " · " + esc(ATT_MARK_LABEL[m]) + " · entered by " + esc(teacherName || "nobody yet") + ' (click to change)">' + (m || "·") + "</button></td>";
			}).join("");
			return '<tr class="' + (s.status !== "active" ? "wsm-row-muted" : "") + '"><td><strong>' + esc(studentFullName(s)) + '</strong>' + (s.status !== "active" ? ' <span class="wsm-pill wsm-pill-gray">' + esc(s.status) + "</span>" : "") + '</td><td>' + esc(s.classGroup || "-") + '</td>' + cells + '<td>' + summary.marked + "/" + summary.total + "</td></tr>";
		}).join("") + "</tbody>";
		table.innerHTML = head + body;
	}
	function renderAttendanceOpenWeeks() {
		var holder = $("#wsm-att-open-weeks");
		if (!holder) return;
		var keys = collectAttendanceWeekKeys();
		var open = keys.filter(function (k) { return !weekCompletionOf(k); }).slice(0, 8);
		if (!open.length) {
			holder.innerHTML = "";
			return;
		}
		var rows = open.map(function (k) {
			var missing = 0;
			var required = requiredChecksPerDay();
			activeStudents().forEach(function (s) {
				var marked = 0;
				DB.school.lessons.forEach(function (l) { if (markForLesson(s, k, l)) marked++; });
				if (marked < required) missing++;
			});
			var missingText = missing > 0 ? missing + " student(s) with missing marks" : "all marks entered - just mark the week complete";
			return '<div class="wsm-att-open-row"><span class="wsm-pill wsm-pill-amber">Open</span><strong>' + esc(fmtDateLong(k)) + '</strong><span class="wsm-nav-hint">' + missingText + '</span><button class="wsm-btn wsm-btn-ghost wsm-btn-sm" data-act="att-open-week" data-week="' + k + '">Jump to this week</button></div>';
		}).join("");
		holder.innerHTML = '<div class="wsm-card-title" style="margin-bottom:8px">⚠ Missing entry reminders</div>' + rows;
	}
	function markWeekComplete() {
		var sunday = ui.attendanceWeekSunday;
		var required = requiredChecksPerDay();
		var incomplete = 0;
		activeStudents().forEach(function (s) {
			var marked = 0;
			DB.school.lessons.forEach(function (l) { if (markForLesson(s, sunday, l)) marked++; });
			if (marked < required) incomplete++;
		});
		var now = new Date().toISOString();
		var late = now.slice(0, 10) > addDaysIso(sunday, 1);
		DB.attendanceWeeks[sunday] = { completedAt: now, completedBy: _user ? _user.id : "", completedByName: userName() };
		persistSoon();
		renderAttendanceStatus();
		renderAttendanceOpenWeeks();
		if (incomplete > 0) notify("Week completed, but " + incomplete + " student(s) still have fewer than " + required + " checks entered.", "warning");
		if (late) notify("Week completed, but it was entered more than 24 hours after Sunday.", "warning");
		else notify("Attendance week completed.", "success");
	}

	/* ═══════════════════════════════════════════
	   PAYMENTS PAGE
	   ═══════════════════════════════════════════ */
	function renderPaymentsPage() {
		var label = $("#wsm-pay-month-label");
		if (label) label.textContent = monthLabelOf(ui.paymentMonth);
		renderPaySummary();
		renderPayTable();
		renderWaitingPayments();
	}
	function renderPaySummary() {
		var holder = $("#wsm-pay-summary");
		if (!holder) return;
		var ym = ui.paymentMonth;
		var students = activeStudents();
		var collected = 0, expected = 0;
		var counts = { paid: 0, partial: 0, late: 0, unpaid: 0, exempt: 0 };
		students.forEach(function (s) {
			var status = paymentStatusOf(s, ym);
			counts[status] = (counts[status] || 0) + 1;
			var amount = paymentExpectedOf(s, ym);
			if (status !== "exempt") expected += amount;
			if (status === "paid") collected += amount;
			else if (status === "partial") { var entry = entryForMonth(s, ym); collected += Math.min(amount, entry ? entry.amount : 0); }
		});
		var currency = DB.school.currency;
		var outstanding = Math.max(0, expected - collected);
		var bracketRows = DB.school.paymentBrackets.map(function (b) {
			var assigned = students.filter(function (s) { return s.paymentBracketId === b.id; });
			var paidCount = assigned.filter(function (s) { return paymentStatusOf(s, ym) === "paid"; }).length;
			return '<div class="wsm-kv-row"><span class="wsm-kv-key">' + esc(b.name) + " (" + esc(currency) + " " + b.monthlyFee + ")</span><span class=\"wsm-kv-val\">" + paidCount + " of " + assigned.length + " students paid · " + assigned.length + " unique student(s)</span></div>";
		}).join("");
		holder.innerHTML =
			'<div class="wsm-stat"><div class="wsm-stat-value">' + students.length + '</div><div class="wsm-stat-label">Students due</div></div>' +
			'<div class="wsm-stat"><div class="wsm-stat-value ok">' + counts.paid + '</div><div class="wsm-stat-label">Paid</div></div>' +
			'<div class="wsm-stat"><div class="wsm-stat-value">' + counts.partial + '</div><div class="wsm-stat-label">Partial</div></div>' +
			'<div class="wsm-stat"><div class="wsm-stat-value">' + counts.late + '</div><div class="wsm-stat-label">Late</div></div>' +
			'<div class="wsm-stat"><div class="wsm-stat-value warn">' + counts.unpaid + '</div><div class="wsm-stat-label">Unpaid</div></div>' +
			'<div class="wsm-stat"><div class="wsm-stat-value ok">' + esc(currency) + " " + collected.toFixed(2) + '</div><div class="wsm-stat-label">Collected</div></div>' +
			'<div class="wsm-stat"><div class="wsm-stat-value warn">' + esc(currency) + " " + outstanding.toFixed(2) + '</div><div class="wsm-stat-label">Outstanding</div></div>' +
			'<div class="wsm-stat"><div class="wsm-stat-value">' + DB.school.paymentBrackets.length + '</div><div class="wsm-stat-label">Pay brackets</div></div>' +
			'<div class="wsm-card" style="grid-column: 1 / -1"><div class="wsm-card-title">Pay brackets this month</div>' + (bracketRows || "<span class='wsm-nav-hint'>No brackets configured.</span>") + "</div>";
	}
	function renderPayTable() {
		var table = $("#wsm-pay-table");
		if (!table) return;
		var ym = ui.paymentMonth;
		var students = sortedStudents().filter(function (s) { return s.status !== "left"; });
		if (!students.length) {
			table.innerHTML = "<tbody><tr><td>No students yet.</td></tr></tbody>";
			return;
		}
		var statusOptions = PAYMENT_STATUSES.map(function (st) {
			return '<option value="' + st + '">' + PAYMENT_LABEL[st] + "</option>";
		}).join("");
		var body = students.map(function (s) {
			var entry = entryForMonth(s, ym);
			var status = paymentStatusOf(s, ym);
			return "<tr><td><strong>" + esc(studentFullName(s)) + '</strong></td><td>' + esc(s.classGroup || "-") + "</td><td>" + esc(bracketNameOf(s)) + "</td>" +
				'<td><select class="wsm-pay-select ' + status + '" data-act="pay-status" data-id="' + s.id + '">' + statusOptions.replace('value="' + status + '"', 'value="' + status + '" selected') + "</select></td>" +
				'<td><input class="wsm-input wsm-pay-amount" type="number" min="0" step="0.01" data-act="pay-amount" data-id="' + s.id + '" value="' + (entry && entry.amount ? entry.amount : "") + '" placeholder="' + esc(bracketFeeOf(s)) + '"></td>' +
				'<td><input class="wsm-input wsm-pay-note" data-act="pay-note" data-id="' + s.id + '" value="' + esc(entry && entry.note ? entry.note : "") + '" placeholder="Note"></td></tr>';
		}).join("");
		table.innerHTML = "<thead><tr><th>Student</th><th>Class group</th><th>Bracket</th><th>Status</th><th>Amount (" + esc(DB.school.currency) + ")</th><th>Note</th></tr></thead><tbody>" + body + "</tbody>";
	}
	function afterPaymentsChanged() {
		renderPaySummary();
		renderWaitingPayments();
		renderNavBadges();
		if (ui.drawerStudentId && ui.drawerTab === "payments") renderDrawer();
	}
	function renderWaitingPayments() {
		var holder = $("#wsm-pay-waiting");
		if (!holder) return;
		var rows = waitingPaymentList();
		var body = rows.map(function (row) {
			var s = row.student, e = row.entry;
			var overdue = e.dueDate && e.dueDate < todayISO();
			var statusClass = { "unpaid": "wsm-pill-red", "partial": "wsm-pill-blue", "late": "wsm-pill-amber" }[e.status] || "wsm-pill-gray";
			return '<div class="wsm-debt-row">' +
				'<div class="wsm-debt-main"><strong>' + esc(studentFullName(s)) + '</strong><span class="wsm-debt-meta">' + esc(monthLabelOf(e.month) || "-") + (overdue ? ' · due ' + esc(fmtDateShort(e.dueDate)) + ' (overdue)' : (e.dueDate ? ' · due ' + esc(fmtDateShort(e.dueDate)) : '')) + (e.note ? ' · ' + esc(e.note) : '') + '</span></div>' +
				'<span class="wsm-pill ' + statusClass + '">' + esc(PAYMENT_LABEL[e.status]) + '</span>' +
				'<input class="wsm-input wsm-pay-amount" type="number" min="0" step="0.01" data-act="debt-amount" data-id="' + e.id + '" value="' + (e.amount || "") + '" title="Amount" placeholder="Amount">' +
				'<input class="wsm-input wsm-debt-due" type="date" data-act="debt-due" data-id="' + e.id + '" value="' + esc(e.dueDate || "") + '" title="Payment due date">' +
				'<button class="wsm-btn wsm-btn-ghost wsm-btn-sm" data-act="debt-paid" data-id="' + e.id + '">✓ Mark Paid</button>' +
				'<button class="wsm-btn wsm-btn-danger wsm-btn-sm" data-act="debt-delete" data-id="' + e.id + '">🗑</button>' +
			'</div>';
		}).join("");
		holder.innerHTML = '<div class="wsm-card"><div class="wsm-card-title">⏳ Waiting payments (debts)<span class="wsm-card-actions"><button class="wsm-btn wsm-btn-ghost wsm-btn-sm" data-act="pay-add-debt">+ Add Payment / Debt</button></span></div>' +
			'<p class="wsm-nav-hint" style="margin-bottom:10px">Every waiting payment is a debt. Set the amount and payment due date, then mark it paid when money arrives.</p>' +
			(body || '<p class="wsm-nav-hint">No waiting payments - everything is paid up.</p>') +
		'</div>';
	}
	function openAddDebtModal() {
		var students = DB.students.filter(function (s) { return s.status !== "left"; });
		var options = students.map(function (s) { return '<option value="' + s.id + '">' + esc(studentFullName(s)) + '</option>'; }).join("");
		openModal("Add Payment / Debt",
			'<div class="wsm-field"><label class="wsm-label">Student</label><select class="wsm-input" id="wsmf-debt-student">' + options + '</select></div>' +
			'<div class="wsm-field-row">' +
				'<div class="wsm-field"><label class="wsm-label">Month</label><input class="wsm-input" type="month" id="wsmf-debt-month" value="' + ui.paymentMonth + '"></div>' +
				'<div class="wsm-field"><label class="wsm-label">Payment amount</label><input class="wsm-input" type="number" min="0" step="0.01" id="wsmf-debt-amount" placeholder="0.00"></div>' +
			'</div>' +
			'<div class="wsm-field"><label class="wsm-label">Payment due date</label><input class="wsm-input" type="date" id="wsmf-debt-due"></div>' +
			'<div class="wsm-field"><label class="wsm-label">Note (optional)</label><input class="wsm-input" id="wsmf-debt-note" placeholder="e.g. Registration fee"></div>',
			'<button class="wsm-btn wsm-btn-ghost" data-act="modal-close">Cancel</button><button class="wsm-btn wsm-btn-primary" data-act="debt-save">Add Payment</button>');
	}
	function saveDebtFromModal() {
		var s = findStudent($("#wsmf-debt-student") ? $("#wsmf-debt-student").value : "");
		if (!s) return;
		var month = $("#wsmf-debt-month") ? $("#wsmf-debt-month").value : ui.paymentMonth;
		var amount = Number(($("#wsmf-debt-amount") ? $("#wsmf-debt-amount").value : "") || 0);
		var dueDate = $("#wsmf-debt-due") ? $("#wsmf-debt-due").value : "";
		var note = $("#wsmf-debt-note") ? $("#wsmf-debt-note").value.trim() : "";
		var entry = newPaymentEntry(month, amount);
		entry.dueDate = dueDate;
		entry.note = note;
		entry.recordedBy = userName();
		s.paymentEntries.push(entry);
		closeModal();
		persistSoon();
		renderPaymentsPage();
		renderNavBadges();
		notify("Payment added to the waiting list.");
	}
	function markDebtPaid(entryId) {
		var owner = findPaymentEntryOwner(entryId);
		if (!owner) return;
		owner.entry.status = "paid";
		owner.entry.paidDate = todayISO();
		owner.entry.recordedBy = userName();
		persistSoon();
		renderPaymentsPage();
		renderNavBadges();
		if (ui.drawerStudentId && ui.drawerTab === "payments") renderDrawer();
		notify("Payment marked as paid.");
	}
	function deleteDebtEntry(entryId) {
		var owner = findPaymentEntryOwner(entryId);
		if (!owner) return;
		owner.student.paymentEntries = owner.student.paymentEntries.filter(function (e) { return e.id !== entryId; });
		persistSoon();
		renderPaymentsPage();
		renderNavBadges();
		if (ui.drawerStudentId && ui.drawerTab === "payments") renderDrawer();
		notify("Payment entry removed.");
	}
	function openReminderModal() {
		var ym = ui.paymentMonth;
		var students = activeStudents().filter(function (s) { return ["late", "unpaid", "partial"].indexOf(paymentStatusOf(s, ym)) > -1; });
		openModal("Build Late Reminder",
			'<div class="wsm-field" style="max-width:200px"><label class="wsm-label">Language</label><select class="wsm-input" id="wsmf-rem-lang"><option value="en">English</option><option value="tr">Turkish</option></select></div>' +
			'<div class="wsm-field"><label class="wsm-label">Reminder text (' + students.length + ' recipient(s))</label><textarea class="wsm-input" id="wsmf-rem-text" style="min-height:160px"></textarea></div>' +
			'<p class="wsm-nav-hint" id="wsmf-rem-hint"></p>',
			'<button class="wsm-btn wsm-btn-ghost" data-act="modal-close">Close</button><button class="wsm-btn wsm-btn-primary" data-act="reminder-copy">📋 Copy Text</button>');
		updateReminderText();
		var langSel = $("#wsmf-rem-lang");
		if (langSel) langSel.onchange = updateReminderText;
	}
	function updateReminderText() {
		var lang = ($("#wsmf-rem-lang") ? $("#wsmf-rem-lang").value : "en") || "en";
		var ym = ui.paymentMonth;
		var monthName = monthLabelOf(ym);
		var students = activeStudents().filter(function (s) { return ["late", "unpaid", "partial"].indexOf(paymentStatusOf(s, ym)) > -1; });
		var lines = students.map(function (s) {
			var amount = paymentExpectedOf(s, ym);
			if (lang === "tr") {
				return "Sayın " + (s.parentName || "Veli") + ", " + s.firstName + " adına " + monthName + " ayı okul ücreti (" + amount + " " + DB.school.currency + ") henüz alınmadı. Gönderdiyseniz bu mesajı dikkate almayınız. Teşekkür ederiz.";
			}
			return "Dear " + (s.parentName || "Parent") + ", a gentle reminder that " + s.firstName + "'s " + monthName + " school fee (" + DB.school.currency + " " + amount + ") is still pending. If you have already sent it, please ignore this message. Thank you!";
		});
		var text = students.length ? lines.join("\n\n") : (lang === "tr" ? "Bu ay için hatırlatma gerektiren öğrenci yok." : "No students need a reminder this month.");
		var ta = $("#wsmf-rem-text");
		if (ta) ta.value = text;
		var hint = $("#wsmf-rem-hint");
		if (hint) hint.textContent = "Polite reminder per family, one message per line group. Copy and send individually from your phone.";
	}

	/* ═══════════════════════════════════════════
	   PROGRESS PAGE
	   ═══════════════════════════════════════════ */
	function renderProgressPage() {
		var sel = $("#wsm-progress-student");
		if (sel) {
			var students = sortedStudents();
			if (!ui.progressStudentId && students.length) ui.progressStudentId = students[0].id;
			if (ui.progressStudentId && !findStudent(ui.progressStudentId) && students.length) ui.progressStudentId = students[0].id;
			sel.innerHTML = students.map(function (s) {
				return '<option value="' + s.id + '"' + (s.id === ui.progressStudentId ? " selected" : "") + ">" + esc(studentFullName(s)) + (s.classGroup ? " · " + esc(s.classGroup) : "") + "</option>";
			}).join("");
		}
		renderFlagStrip();
		renderProgressGrid();
	}
	function renderFlagStrip() {
		var holder = $("#wsm-flag-strip");
		if (!holder) return;
		var flags = flaggedStudents();
		if (!flags.length) { holder.innerHTML = ""; return; }
		holder.innerHTML = flags.map(function (s) {
			var latest = null;
			for (var i = s.progressNotes.length - 1; i >= 0; i--) {
				if (s.progressNotes[i].flag && s.progressNotes[i].flag !== "none") { latest = s.progressNotes[i]; break; }
			}
			var dropping = latest.flag === "droppingInterest";
			return '<div class="wsm-flag-row' + (dropping ? " red" : "") + '"><strong>' + esc(studentFullName(s)) + "</strong> · " + esc(NOTE_FLAG_LABEL[latest.flag]) + ' · "' + esc(latest.note) + '" · ' + esc(fmtDateShort(latest.date)) + '<button class="wsm-btn wsm-btn-ghost wsm-btn-sm" data-act="open-student" data-id="' + s.id + '">Open</button></div>';
		}).join("");
	}
	function renderProgressGrid() {
		var holder = $("#wsm-progress-grid");
		if (!holder) return;
		var s = findStudent(ui.progressStudentId);
		if (!s) {
			holder.innerHTML = '<div class="wsm-empty" style="grid-column:1/-1"><h3>No students yet</h3><p>Add students to track their progress.</p></div>';
			return;
		}
		var notes = s.progressNotes.slice().reverse().map(function (n) {
			var pill = n.flag && n.flag !== "none" ? '<span class="wsm-pill ' + (n.flag === "droppingInterest" ? "wsm-pill-red" : "wsm-pill-amber") + '">' + esc(NOTE_FLAG_LABEL[n.flag]) + "</span>" : "";
			return '<div class="wsm-note-row' + (n.flag === "attention" ? " head" : n.flag === "droppingInterest" ? " drop" : "") + '">' + pill + '<div class="wsm-note-text">' + esc(n.note) + '</div><div class="wsm-note-meta">' + esc(fmtDateShort(n.date)) + " · " + esc(n.recordedBy || "") + "</div></div>";
		}).join("");
		var contacts = s.teacherContactLog.slice().reverse().map(function (c) {
			return '<div class="wsm-note-row"><div class="wsm-note-text">' + esc(c.summary) + '</div><div class="wsm-note-meta">' + esc(fmtDateShort(c.date)) + " · " + esc(c.method || "contact") + " · " + esc(c.recordedBy || "") + "</div></div>";
		}).join("");
		var levelHistory = s.quranReading.levelHistory.slice().reverse().map(function (h) {
			return '<div class="wsm-surah-row"><span class="wsm-surah-name">' + esc(h.level) + '</span><span class="wsm-note-meta">since ' + esc(fmtDateShort(h.date)) + "</span></div>";
		}).join("");
		var surahs = s.quranMemorization.surahs.map(function (su) {
			var opts = HIFZ_STATUSES.map(function (st) {
				return '<option value="' + st + '"' + (su.status === st ? " selected" : "") + ">" + HIFZ_LABEL[st] + "</option>";
			}).join("");
			return '<div class="wsm-surah-row"><span class="wsm-surah-name">' + esc(su.name) + '</span>' +
				'<select class="wsm-pay-select" data-act="prog-surah-status" data-id="' + s.id + '" data-name="' + esc(su.name) + '">' + opts + "</select>" +
				'<input class="wsm-input wsm-pay-note" data-act="prog-surah-portions" data-id="' + s.id + '" data-name="' + esc(su.name) + '" value="' + esc(su.portions || "") + '" placeholder="Portions">' +
				'<button class="wsm-btn wsm-btn-ghost wsm-btn-sm" data-act="prog-surah-delete" data-id="' + s.id + '" data-name="' + esc(su.name) + '">✕</button></div>';
		}).join("");
		holder.innerHTML =
			'<div class="wsm-card"><div class="wsm-card-title">📝 General progress notes<span class="wsm-card-actions"><button class="wsm-btn wsm-btn-ghost wsm-btn-sm" data-act="prog-add-note" data-id="' + s.id + '">+ Add Note</button></span></div><div class="wsm-note-list">' + (notes || '<p class="wsm-nav-hint">No notes yet.</p>') + "</div></div>" +
			'<div class="wsm-card"><div class="wsm-card-title">📞 Weekly teacher contact log<span class="wsm-card-actions"><button class="wsm-btn wsm-btn-ghost wsm-btn-sm" data-act="prog-add-contact" data-id="' + s.id + '">+ Add Contact</button></span></div><div class="wsm-note-list">' + (contacts || '<p class="wsm-nav-hint">No teacher contacts logged yet.</p>') + "</div></div>" +
			'<div class="wsm-card"><div class="wsm-card-title">📖 Quran reading level<span class="wsm-card-actions"><button class="wsm-btn wsm-btn-outline wsm-btn-sm" data-act="quran-message" data-id="' + s.id + '">💬 Message</button></span></div><div class="wsm-field" style="margin-top:10px"><label class="wsm-label">Current level</label><input class="wsm-input" data-act="prog-quran-level" data-id="' + s.id + '" value="' + esc(s.quranReading.currentLevel) + '" placeholder="e.g. Elifba 2, Quran Level 3"></div></div><div class="wsm-card-title">Level history</div>' + (levelHistory || '<p class="wsm-nav-hint">No level changes recorded. Edit the current level to start the history.</p>') + "</div>" +
			'<div class="wsm-card"><div class="wsm-card-title">📗 Quran memorization (Hifz)<span class="wsm-card-actions"><button class="wsm-btn wsm-btn-outline wsm-btn-sm" data-act="quran-message" data-id="' + s.id + '">💬 Message</button><button class="wsm-btn wsm-btn-ghost wsm-btn-sm" data-act="prog-add-surah" data-id="' + s.id + '">+ Add Surah</button></span></div>' + (surahs || '<p class="wsm-nav-hint">No surahs tracked yet.</p>') +
			'<div class="wsm-field" style="margin-top:12px"><label class="wsm-label">Next memorization target</label><input class="wsm-input" data-act="prog-hifz-target" data-id="' + s.id + '" value="' + esc(s.quranMemorization.nextTarget) + '" placeholder="e.g. Surah Al-Fil, Juz 30"></div></div>';
	}
	function openProgressNoteModal(studentId) {
		var flagOptions = NOTE_FLAGS.map(function (f) {
			return '<option value="' + f + '">' + (NOTE_FLAG_LABEL[f] || "No flag") + "</option>";
		}).join("");
		openModal("Add Progress Note",
			'<div class="wsm-field"><label class="wsm-label">Date</label><input class="wsm-input" type="date" id="wsmf-note-date" value="' + todayISO() + '"></div>' +
			'<div class="wsm-field"><label class="wsm-label">Note</label><textarea class="wsm-input" id="wsmf-note-text"></textarea></div>' +
			'<div class="wsm-field"><label class="wsm-label">Flag</label><select class="wsm-input" id="wsmf-note-flag">' + flagOptions + '</select><p class="wsm-nav-hint" style="margin-top:4px">Use a flag when a student is dropping attendance or interest so it shows on the Students list.</p></div>',
			'<button class="wsm-btn wsm-btn-ghost" data-act="modal-close">Cancel</button><button class="wsm-btn wsm-btn-primary" data-act="note-save" data-id="' + studentId + '">Save Note</button>');
	}
	function saveProgressNote(studentId) {
		var s = findStudent(studentId);
		if (!s) return;
		var text = ($("#wsmf-note-text") ? $("#wsmf-note-text").value : "").trim();
		if (!text) { notify("Note text is required.", "warning"); return; }
		s.progressNotes.push({ date: $("#wsmf-note-date") ? $("#wsmf-note-date").value : todayISO(), note: text, flag: $("#wsmf-note-flag") ? $("#wsmf-note-flag").value : "none", recordedBy: userName() });
		closeModal();
		persistSoon();
		renderAll();
		notify("Note added.");
	}
	function openContactModal(studentId) {
		openModal("Add Teacher Contact",
			'<div class="wsm-field"><label class="wsm-label">Date</label><input class="wsm-input" type="date" id="wsmf-contact-date" value="' + todayISO() + '"></div>' +
			'<div class="wsm-field"><label class="wsm-label">Method</label><select class="wsm-input" id="wsmf-contact-method"><option>In person</option><option>Phone call</option><option>WhatsApp</option><option>Email</option></select></div>' +
			'<div class="wsm-field"><label class="wsm-label">Summary</label><textarea class="wsm-input" id="wsmf-contact-summary"></textarea></div>',
			'<button class="wsm-btn wsm-btn-ghost" data-act="modal-close">Cancel</button><button class="wsm-btn wsm-btn-primary" data-act="contact-save" data-id="' + studentId + '">Save Contact</button>');
	}
	function saveTeacherContact(studentId) {
		var s = findStudent(studentId);
		if (!s) return;
		var summary = ($("#wsmf-contact-summary") ? $("#wsmf-contact-summary").value : "").trim();
		if (!summary) { notify("Summary is required.", "warning"); return; }
		s.teacherContactLog.push({ date: $("#wsmf-contact-date") ? $("#wsmf-contact-date").value : todayISO(), method: $("#wsmf-contact-method") ? $("#wsmf-contact-method").value : "In person", summary: summary, recordedBy: userName() });
		closeModal();
		persistSoon();
		renderAll();
		notify("Teacher contact saved.");
	}
	function openSurahModal(studentId) {
		openModal("Add Surah",
			'<div class="wsm-field"><label class="wsm-label">Surah name</label><input class="wsm-input" id="wsmf-surah-name" placeholder="e.g. Surah Al-Fatiha"></div>' +
			'<div class="wsm-field"><label class="wsm-label">Status</label><select class="wsm-input" id="wsmf-surah-status">' + HIFZ_STATUSES.map(function (st) { return '<option value="' + st + '">' + HIFZ_LABEL[st] + "</option>"; }).join("") + '</select></div>' +
			'<div class="wsm-field"><label class="wsm-label">Portions (optional)</label><input class="wsm-input" id="wsmf-surah-portions" placeholder="e.g. 1/2, Ayah 1-5"></div>',
			'<button class="wsm-btn wsm-btn-ghost" data-act="modal-close">Cancel</button><button class="wsm-btn wsm-btn-primary" data-act="surah-save" data-id="' + studentId + '">Add Surah</button>');
	}
	function saveSurah(studentId) {
		var s = findStudent(studentId);
		if (!s) return;
		var name = ($("#wsmf-surah-name") ? $("#wsmf-surah-name").value : "").trim();
		if (!name) { notify("Surah name is required.", "warning"); return; }
		var existing = null;
		s.quranMemorization.surahs.forEach(function (su) { if (su.name === name) existing = su; });
		if (existing) { existing.status = $("#wsmf-surah-status") ? $("#wsmf-surah-status").value : "target"; existing.portions = $("#wsmf-surah-portions") ? $("#wsmf-surah-portions").value.trim() : ""; }
		else s.quranMemorization.surahs.push({ name: name, status: $("#wsmf-surah-status") ? $("#wsmf-surah-status").value : "target", portions: $("#wsmf-surah-portions") ? $("#wsmf-surah-portions").value.trim() : "" });
		closeModal();
		persistSoon();
		renderAll();
		notify("Surah saved.");
	}

	/* ═══════════════════════════════════════════
	   COMMUNICATION PAGE
	   ═══════════════════════════════════════════ */
	function renderCommunicationPage() {
		$$("#wsm-comm-tabs .wsm-comm-tab").forEach(function (t) { t.classList.toggle("active", t.getAttribute("data-comm-tab") === ui.commTab); });
		var holder = $("#wsm-comm-content");
		if (!holder) return;
		if (ui.commTab === "group") renderGroupMessages(holder);
		else if (ui.commTab === "onetoone") renderOneOnOne(holder);
		else if (ui.commTab === "absence") renderAbsenceCalls(holder);
		else if (ui.commTab === "suggestions") renderSuggestions(holder);
	}
	function renderGroupMessages(holder) {
		var msgs = DB.schoolLogs.groupMessages.slice().reverse();
		if (!msgs.length) {
			holder.innerHTML = '<div class="wsm-empty"><h3>No group messages yet</h3><p>Archive the weekly parent messages you send, in English and Turkish.</p><button class="wsm-btn wsm-btn-primary" data-act="comm-add-group">+ New Group Message</button></div>';
			return;
		}
		holder.innerHTML = msgs.map(function (m) {
			return '<div class="wsm-msg-card">' +
				'<div class="wsm-msg-head"><span class="wsm-pill wsm-pill-teal">' + esc(LANGUAGE_LABEL[m.language] || m.language) + '</span><strong>' + esc(m.title || "Group message") + '</strong><span>' + esc(fmtDateShort(m.date)) + "</span></div>" +
				'<div class="wsm-msg-text">' + esc(m.text) + '</div>' +
				'<div class="wsm-msg-actions"><button class="wsm-btn wsm-btn-outline wsm-btn-sm" data-act="comm-group-copy" data-id="' + m.id + '">📋 Copy</button>' +
				(canAdmin() ? '<button class="wsm-btn wsm-btn-danger wsm-btn-sm" data-act="comm-group-delete" data-id="' + m.id + '">🗑 Delete</button>' : "") +
				"</div></div>";
		}).join("");
	}
	function openGroupMessageModal() {
		openModal("New Group Message",
			'<div class="wsm-field-row">' +
				'<div class="wsm-field"><label class="wsm-label">Date</label><input class="wsm-input" type="date" id="wsmf-group-date" value="' + todayISO() + '"></div>' +
				'<div class="wsm-field"><label class="wsm-label">Language</label><select class="wsm-input" id="wsmf-group-lang"><option value="en">English</option><option value="tr">Turkish</option></select></div>' +
			'</div>' +
			'<div class="wsm-field"><label class="wsm-label">Title</label><input class="wsm-input" id="wsmf-group-title" placeholder="e.g. Week 4 summary"></div>' +
			'<div class="wsm-field"><label class="wsm-label">Message text</label><textarea class="wsm-input" id="wsmf-group-text" style="min-height:140px"></textarea></div>',
			'<button class="wsm-btn wsm-btn-ghost" data-act="modal-close">Cancel</button><button class="wsm-btn wsm-btn-primary" data-act="group-save">Save Message</button>');
	}
	function saveGroupMessage() {
		var text = ($("#wsmf-group-text") ? $("#wsmf-group-text").value : "").trim();
		if (!text) { notify("Message text is required.", "warning"); return; }
		DB.schoolLogs.groupMessages.push({
			id: uid(), date: $("#wsmf-group-date") ? $("#wsmf-group-date").value : todayISO(),
			language: $("#wsmf-group-lang") ? $("#wsmf-group-lang").value : "en",
			title: $("#wsmf-group-title") ? $("#wsmf-group-title").value.trim() : "",
			text: text
		});
		closeModal();
		persistSoon();
		renderCommunicationPage();
		notify("Group message archived.");
	}
	function renderOneOnOne(holder) {
		var students = sortedStudents();
		if (!students.length) { holder.innerHTML = '<div class="wsm-empty"><h3>No students yet</h3></div>'; return; }
		if (!ui.commOnOneStudentId || !findStudent(ui.commOnOneStudentId)) ui.commOnOneStudentId = students[0].id;
		var s = findStudent(ui.commOnOneStudentId);
		var entries = s.parentCommunication.oneOnOne.slice().reverse().map(function (e) {
			return '<div class="wsm-note-row"><div class="wsm-note-text">' + esc(e.summary) + '</div><div class="wsm-note-meta">' + esc(fmtDateShort(e.date)) + " · " + esc(e.channel || "one-on-one") + "</div></div>";
		}).join("");
		holder.innerHTML =
			'<div class="wsm-field" style="max-width:340px;margin-bottom:14px"><label class="wsm-label">Student</label><select class="wsm-input" data-act="comm-on-one-student">' +
			students.map(function (st) { return '<option value="' + st.id + '"' + (st.id === ui.commOnOneStudentId ? " selected" : "") + ">" + esc(studentFullName(st)) + "</option>"; }).join("") +
			'</select></div>' +
			'<div class="wsm-card"><div class="wsm-card-title">One-on-one feedback for ' + esc(studentFullName(s)) + '<span class="wsm-card-actions"><button class="wsm-btn wsm-btn-ghost wsm-btn-sm" data-act="comm-add-on-one" data-id="' + s.id + '">+ Add Feedback</button></span></div><div class="wsm-note-list">' + (entries || '<p class="wsm-nav-hint">No one-on-one feedback logged yet.</p>') + "</div></div>";
	}
	function openOneOnOneModal(studentId) {
		openModal("Add One-on-One Feedback",
			'<div class="wsm-field"><label class="wsm-label">Date</label><input class="wsm-input" type="date" id="wsmf-onone-date" value="' + todayISO() + '"></div>' +
			'<div class="wsm-field"><label class="wsm-label">Channel</label><select class="wsm-input" id="wsmf-onone-channel"><option>WhatsApp</option><option>Phone call</option><option>In person</option><option>Email</option></select></div>' +
			'<div class="wsm-field"><label class="wsm-label">Summary</label><textarea class="wsm-input" id="wsmf-onone-summary"></textarea></div>',
			'<button class="wsm-btn wsm-btn-ghost" data-act="modal-close">Cancel</button><button class="wsm-btn wsm-btn-primary" data-act="onone-save" data-id="' + studentId + '">Save Feedback</button>');
	}
	function saveOneOnOne(studentId) {
		var s = findStudent(studentId);
		if (!s) return;
		var summary = ($("#wsmf-onone-summary") ? $("#wsmf-onone-summary").value : "").trim();
		if (!summary) { notify("Summary is required.", "warning"); return; }
		s.parentCommunication.oneOnOne.push({ date: $("#wsmf-onone-date") ? $("#wsmf-onone-date").value : todayISO(), channel: $("#wsmf-onone-channel") ? $("#wsmf-onone-channel").value : "WhatsApp", summary: summary });
		closeModal();
		persistSoon();
		renderCommunicationPage();
		if (ui.drawerStudentId) renderDrawer();
		notify("Feedback saved.");
	}
	function renderAbsenceCalls(holder) {
		var sunday = ui.attendanceWeekSunday;
		var absentees = DB.students.filter(function (s) {
			if (s.status === "left") return false;
			var found = false;
			DB.school.lessons.forEach(function (l) {
				var m = markForLesson(s, sunday, l);
				if (m === "A" || m === "L") found = true;
			});
			return found;
		});
		var rows = absentees.map(function (s) {
			var calls = s.parentCommunication.absenceCalls;
			var latestCall = calls.length ? calls[calls.length - 1] : null;
			return '<div class="wsm-att-open-row"><strong>' + esc(studentFullName(s)) + '</strong><span class="wsm-pill wsm-pill-gray">' + esc(s.classGroup || "-") + "</span>" +
				'<span>' + esc(fmtDateShort(sunday)) + ': ' + (function () { var marks = []; DB.school.lessons.forEach(function (l) { var m = markForLesson(s, sunday, l); if (m === "A" || m === "L") marks.push(l + " (" + m + ")"); }); return marks.join(", "); })() + "</span>" +
				'<span class="wsm-nav-hint">' + (latestCall ? "Last call: " + esc(fmtDateShort(latestCall.date)) + " · " + esc(latestCall.outcome) : "No call logged yet") + "</span>" +
				'<button class="wsm-btn wsm-btn-ghost wsm-btn-sm" data-act="comm-log-call" data-id="' + s.id + '">📞 Log Call</button></div>';
		}).join("");
		holder.innerHTML =
			'<div class="wsm-week-nav" style="margin-bottom:14px">' +
				'<button class="wsm-btn wsm-btn-icon" data-act="comm-absence-prev">◀</button>' +
				'<button class="wsm-btn wsm-btn-ghost" data-act="comm-absence-today">This Sunday</button>' +
				'<button class="wsm-btn wsm-btn-icon" data-act="comm-absence-next">▶</button>' +
				'<h3 class="wsm-week-title">' + esc(fmtDateLong(sunday)) + " (Sunday)</h3>" +
			"</div>" +
			'<p class="wsm-nav-hint" style="margin-bottom:10px">Same-day call log for absent or late students. Call the family the same day and log the outcome.</p>' +
			(rows || '<div class="wsm-empty"><h3>No absent or late students</h3><p>Nothing to call for this Sunday.</p></div>');
	}
	function openAbsenceCallModal(studentId) {
		var s = findStudent(studentId);
		openModal("Log Absence Call - " + esc(s ? studentFullName(s) : ""),
			'<div class="wsm-field"><label class="wsm-label">Date</label><input class="wsm-input" type="date" id="wsmf-call-date" value="' + todayISO() + '"></div>' +
			'<div class="wsm-field"><label class="wsm-label">Reason for absence</label><input class="wsm-input" id="wsmf-call-reason" placeholder="e.g. Sick, family trip, no answer"></div>' +
			'<div class="wsm-field"><label class="wsm-label">Call outcome</label><textarea class="wsm-input" id="wsmf-call-outcome" placeholder="e.g. Spoke to mother, student was sick. Will return next week."></textarea></div>',
			'<button class="wsm-btn wsm-btn-ghost" data-act="modal-close">Cancel</button><button class="wsm-btn wsm-btn-primary" data-act="call-save" data-id="' + studentId + '">Save Call Log</button>');
	}
	function saveAbsenceCall(studentId) {
		var s = findStudent(studentId);
		if (!s) return;
		s.parentCommunication.absenceCalls.push({
			date: $("#wsmf-call-date") ? $("#wsmf-call-date").value : todayISO(),
			reason: $("#wsmf-call-reason") ? $("#wsmf-call-reason").value.trim() : "",
			outcome: $("#wsmf-call-outcome") ? $("#wsmf-call-outcome").value.trim() : ""
		});
		closeModal();
		persistSoon();
		renderCommunicationPage();
		if (ui.drawerStudentId) renderDrawer();
		notify("Absence call logged.");
	}
	function renderSuggestions(holder) {
		var list = DB.schoolLogs.suggestionsComplaints.slice().reverse();
		if (!list.length) {
			holder.innerHTML = '<div class="wsm-empty"><h3>No suggestions yet</h3><p>Record parent suggestions and complaints and follow them up.</p><button class="wsm-btn wsm-btn-primary" data-act="comm-add-suggestion">+ New Suggestion</button></div>';
			return;
		}
		holder.innerHTML = '<div style="margin-bottom:12px"><button class="wsm-btn wsm-btn-primary" data-act="comm-add-suggestion">+ New Suggestion</button></div>' + list.map(function (r) {
			var opts = SUGGESTION_STATUSES.map(function (st) {
				return '<option value="' + st + '"' + (r.status === st ? " selected" : "") + ">" + SUGGESTION_LABEL[st] + "</option>";
			}).join("");
			return '<div class="wsm-msg-card"><div class="wsm-msg-head"><span class="wsm-pill wsm-pill-teal">' + esc(fmtDateShort(r.date)) + "</span><strong>" + esc(r.from || "Parent") + "</strong></div>" +
				'<div class="wsm-msg-text">' + esc(r.text) + '</div>' +
				'<div class="wsm-sugg-row" style="margin-top:10px"><select class="wsm-pay-select" data-act="comm-sugg-status" data-id="' + r.id + '">' + opts + "</select>" +
				'<input class="wsm-input wsm-sugg-followup" data-act="comm-sugg-followup" data-id="' + r.id + '" value="' + esc(r.followUp || "") + '" placeholder="Follow-up note">' +
				(canAdmin() ? '<button class="wsm-btn wsm-btn-danger wsm-btn-sm" data-act="comm-sugg-delete" data-id="' + r.id + '">🗑</button>' : "") +
				"</div></div>";
		}).join("");
	}
	function openSuggestionModal() {
		openModal("New Suggestion / Complaint",
			'<div class="wsm-field"><label class="wsm-label">Date</label><input class="wsm-input" type="date" id="wsmf-sugg-date" value="' + todayISO() + '"></div>' +
			'<div class="wsm-field"><label class="wsm-label">From</label><input class="wsm-input" id="wsmf-sugg-from" placeholder="Parent name (optional)"></div>' +
			'<div class="wsm-field"><label class="wsm-label">Suggestion or complaint</label><textarea class="wsm-input" id="wsmf-sugg-text"></textarea></div>',
			'<button class="wsm-btn wsm-btn-ghost" data-act="modal-close">Cancel</button><button class="wsm-btn wsm-btn-primary" data-act="sugg-save">Save Suggestion</button>');
	}
	function saveSuggestion() {
		var text = ($("#wsmf-sugg-text") ? $("#wsmf-sugg-text").value : "").trim();
		if (!text) { notify("Text is required.", "warning"); return; }
		DB.schoolLogs.suggestionsComplaints.push({
			id: uid(), date: $("#wsmf-sugg-date") ? $("#wsmf-sugg-date").value : todayISO(),
			from: $("#wsmf-sugg-from") ? $("#wsmf-sugg-from").value.trim() : "",
			text: text, status: "open", followUp: ""
		});
		closeModal();
		persistSoon();
		renderCommunicationPage();
		notify("Suggestion recorded.");
	}

	/* ═══════════════════════════════════════════
	   REPORTS PAGE
	   ═══════════════════════════════════════════ */
	function renderReportsPage() {
		$$("#wsm-report-kinds .wsm-comm-tab").forEach(function (t) { t.classList.toggle("active", t.getAttribute("data-report-kind") === ui.reportKind); });
		var label = $("#wsm-report-period-label");
		if (label) label.textContent = ui.reportKind === "monthly" ? monthLabelOf(ui.reportMonth) : fmtDateLong(ui.reportWeekSunday) + " (Sunday)";
		renderReportContent();
	}
	function renderReportContent() {
		var holder = $("#wsm-report-content");
		if (!holder) return;
		var text = ui.reportKind === "monthly" ? buildMonthlyReportText() : buildWeeklyReportText();
		var table = ui.reportKind === "monthly" ? buildMonthlyReportTable() : "";
		holder.innerHTML = (table ? '<div class="wsm-report-sec">' + table + "</div>" : "") + '<div class="wsm-report-sec"><h4>Report text (WhatsApp and meeting ready)</h4><pre>' + esc(text) + "</pre></div>";
	}
	function buildWeeklyReportText() {
		var sunday = ui.reportWeekSunday;
		var students = DB.students.filter(function (s) { return s.status !== "left"; });
		var perLesson = {};
		DB.school.lessons.forEach(function (l) { perLesson[l] = { P: 0, A: 0, L: 0, E: 0, unmarked: 0 }; });
		var absentNames = [], lateNames = [];
		var presentTotal = 0, markedTotal = 0;
		students.forEach(function (s) {
			var anyAbsent = false, anyLate = false;
			DB.school.lessons.forEach(function (l) {
				var m = markForLesson(s, sunday, l);
				if (!m) perLesson[l].unmarked++;
				else { perLesson[l][m] = (perLesson[l][m] || 0) + 1; markedTotal++; if (m === "P") presentTotal++; }
				if (m === "A") anyAbsent = true;
				if (m === "L") anyLate = true;
			});
			if (anyAbsent) absentNames.push(studentFullName(s));
			if (anyLate) lateNames.push(studentFullName(s));
		});
		var lessonLines = DB.school.lessons.map(function (l) {
			var c = perLesson[l];
			return "- " + l + ": " + c.P + " present, " + c.A + " absent, " + c.L + " late, " + c.E + " excused, " + c.unmarked + " unmarked";
		});
		var lines = [];
		lines.push("Weekend School attendance - " + fmtDateLong(sunday));
		lines.push("");
		lines.push("Students: " + students.length);
		lines.push("Lesson marks: " + markedTotal + " of " + (students.length * DB.school.lessons.length));
		lines.push("");
		lines.push("By lesson:");
		lines = lines.concat(lessonLines);
		lines.push("");
		lines.push("Absent: " + (absentNames.length ? absentNames.join(", ") : "None"));
		lines.push("Late: " + (lateNames.length ? lateNames.join(", ") : "None"));
		lines.push("");
		lines.push("Same-day calls: please call each absent family today and log the call in Communication > Absence Calls.");
		return lines.join("\n");
	}
	function buildMonthlyReportText() {
		var ym = ui.reportMonth;
		var sundays = sundaysInMonth(ym);
		var students = DB.students.filter(function (s) { return s.status !== "left"; });
		var attendancePerStudent = {};
		var totalMarks = 0, totalPresent = 0;
		students.forEach(function (s) {
			var marked = 0, present = 0;
			sundays.forEach(function (sunday) {
				DB.school.lessons.forEach(function (l) {
					var m = markForLesson(s, sunday, l);
					if (m) { marked++; totalMarks++; if (m === "P" || m === "L") { present++; totalPresent++; } }
				});
			});
			attendancePerStudent[s.id] = { marked: marked, present: present, total: sundays.length * DB.school.lessons.length };
		});
		var collected = 0, expected = 0;
		var outstandingNames = [];
		students.forEach(function (s) {
			var status = paymentStatusOf(s, ym);
			var amount = paymentExpectedOf(s, ym);
			if (status !== "exempt") expected += amount;
			if (status === "paid") collected += amount;
			else if (status !== "exempt") outstandingNames.push(studentFullName(s) + " (" + PAYMENT_LABEL[status] + ", " + DB.school.currency + " " + amount + ")");
		});
		var highlightLines = [];
		var issueLines = [];
		students.forEach(function (s) {
			var latestNote = null;
			for (var i = s.progressNotes.length - 1; i >= 0; i--) { if (!s.progressNotes[i].flag || s.progressNotes[i].flag === "none") { latestNote = s.progressNotes[i]; break; } }
			var latestFlag = null;
			for (var j = s.progressNotes.length - 1; j >= 0; j--) { if (s.progressNotes[j].flag && s.progressNotes[j].flag !== "none") { latestFlag = s.progressNotes[j]; break; } }
			var att = attendancePerStudent[s.id];
			if (latestNote) highlightLines.push("- " + studentFullName(s) + ": " + latestNote.note.slice(0, 140));
			if (latestFlag) issueLines.push("- " + studentFullName(s) + ": " + NOTE_FLAG_LABEL[latestFlag.flag] + " (" + fmtDateShort(latestFlag.date) + ")");
			if (att && att.total && att.marked > 0 && att.present / att.marked < 0.6) issueLines.push("- " + studentFullName(s) + ": low attendance (" + att.present + " present of " + att.marked + " marked)");
		});
		var attRate = totalMarks ? Math.round((totalPresent / totalMarks) * 100) : 0;
		var lines = [];
		lines.push(DB.school.name + " - " + monthLabelOf(ym) + " Monthly Report");
		lines.push("Prepared for the monthly parent meeting");
		lines.push("");
		lines.push("1. Attendance");
		lines.push("- Sundays in month: " + sundays.length + " (" + (sundays.length ? sundays.map(fmtDateShort).join(", ") : "none") + ")");
		lines.push("- Overall attendance: " + attRate + "% (" + totalPresent + " present of " + totalMarks + " marks)");
		lines.push("");
		lines.push("2. Payments (" + DB.school.currency + ")");
		lines.push("- Collected: " + DB.school.currency + " " + collected.toFixed(2));
		lines.push("- Expected: " + DB.school.currency + " " + expected.toFixed(2));
		lines.push("- Outstanding: " + DB.school.currency + " " + Math.max(0, expected - collected).toFixed(2) + (outstandingNames.length ? " - " + outstandingNames.join("; ") : ""));
		lines.push("");
		lines.push("3. Progress highlights");
		lines = lines.concat(highlightLines.length ? highlightLines : ["- No notes this month."]);
		lines.push("");
		lines.push("4. Issues to discuss");
		lines = lines.concat(issueLines.length ? issueLines : ["- None."]);
		return lines.join("\n");
	}
	function buildMonthlyReportTable() {
		var ym = ui.reportMonth;
		var sundays = sundaysInMonth(ym);
		var students = sortedStudents().filter(function (s) { return s.status !== "left"; });
		if (!students.length) return "";
		var rows = students.map(function (s) {
			var marked = 0, present = 0;
			sundays.forEach(function (sunday) { DB.school.lessons.forEach(function (l) { var m = markForLesson(s, sunday, l); if (m) { marked++; if (m === "P" || m === "L") present++; } }); });
			var rate = marked ? Math.round((present / marked) * 100) + "%" : "-";
			var status = paymentStatusOf(s, ym);
			var latestNote = "";
			for (var i = s.progressNotes.length - 1; i >= 0; i--) { if (!s.progressNotes[i].flag || s.progressNotes[i].flag === "none") { latestNote = s.progressNotes[i].note.slice(0, 80); break; } }
			var latestFlag = "";
			for (var j = s.progressNotes.length - 1; j >= 0; j--) { if (s.progressNotes[j].flag && s.progressNotes[j].flag !== "none") { latestFlag = NOTE_FLAG_LABEL[s.progressNotes[j].flag]; break; } }
			var payClass = { "paid": "wsm-pill-green", "partial": "wsm-pill-blue", "late": "wsm-pill-amber", "exempt": "wsm-pill-purple", "unpaid": "wsm-pill-red" }[status] || "wsm-pill-gray";
			return "<tr><td><strong>" + esc(studentFullName(s)) + '</strong></td><td>' + esc(s.classGroup || "-") + '</td><td>' + esc(rate) + '</td><td><span class="wsm-pill ' + payClass + '">' + esc(PAYMENT_LABEL[status]) + '</span></td><td>' + esc(latestNote) + '</td><td>' + (latestFlag ? '<span class="wsm-pill wsm-pill-amber">' + esc(latestFlag) + "</span>" : "") + "</td></tr>";
		}).join("");
		return '<h4>Per-student summary</h4><div class="wsm-table-wrap"><table class="wsm-table"><thead><tr><th>Student</th><th>Class group</th><th>Attendance</th><th>Payment</th><th>Latest note</th><th>Flag</th></tr></thead><tbody>' + rows + "</tbody></table></div>";
	}
	function currentReportText() {
		return ui.reportKind === "monthly" ? buildMonthlyReportText() : buildWeeklyReportText();
	}
	function downloadReportText() {
		var text = currentReportText();
		var blob = new Blob([text], { type: "text/plain" });
		var url = URL.createObjectURL(blob);
		var a = document.createElement("a");
		a.href = url;
		a.download = "weekend-school-report-" + (ui.reportKind === "monthly" ? ui.reportMonth : ui.reportWeekSunday) + ".txt";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		notify("Report downloaded.");
	}
	function printReportPdf() {
		var text = currentReportText();
		var html = "<div style='font-family:Segoe UI,Arial,sans-serif;font-size:13px;line-height:1.6;padding:24px'>" +
			"<h2 style='margin:0 0 12px'>" + esc(DB.school.name) + " - " + esc(ui.reportKind === "monthly" ? monthLabelOf(ui.reportMonth) + " Monthly Report" : "Weekly Attendance " + fmtDateLong(ui.reportWeekSunday)) + "</h2>" +
			"<pre style='white-space:pre-wrap;font-family:inherit;font-size:13px'>" + esc(text) + "</pre></div>";
		try {
			if (typeof tool.requestExportPdf === "function") {
				tool.requestExportPdf({ html: html, filename: "weekend-school-report-" + (ui.reportKind === "monthly" ? ui.reportMonth : ui.reportWeekSunday) + ".pdf" }, function (error, url) {
					if (error) { notify("PDF export failed: " + error, "error"); }
					else if (url) { try { tool.openUrl(url); } catch (e) { } }
				});
				return;
			}
		} catch (e) { }
		notify("PDF export is not available here. Use Download .txt instead.", "warning");
	}

	/* ═══════════════════════════════════════════
	   SETTINGS PAGE
	   ═══════════════════════════════════════════ */
	function renderSettingsPage() {
		var holder = $("#wsm-settings-grid");
		if (!holder) return;
		var bracketEditorRows = DB.school.paymentBrackets.map(function (b) {
			var studentCount = DB.students.filter(function (s) { return s.paymentBracketId === b.id; }).length;
			return '<div class="wsm-bracket-row">' +
				'<input class="wsm-input wsm-bracket-name" data-act="bracket-name" data-id="' + b.id + '" value="' + esc(b.name) + '" placeholder="Bracket name">' +
				'<input class="wsm-input wsm-bracket-fee" type="number" min="0" step="0.01" data-act="bracket-fee" data-id="' + b.id + '" value="' + b.monthlyFee + '">' +
				'<span class="wsm-bracket-currency">' + esc(DB.school.currency) + ' / month</span>' +
				'<span class="wsm-pill wsm-pill-gray">' + studentCount + ' student(s)</span>' +
				'<button class="wsm-btn wsm-btn-danger wsm-btn-sm" data-act="bracket-delete" data-id="' + b.id + '">🗑</button>' +
			'</div>';
		}).join("");
		var bytes = snapshotBytes();
		var avg = DB.students.length ? Math.round(bytes / DB.students.length / 1024) : 0;
		var totalNotes = DB.students.reduce(function (sum, s) { return sum + s.progressNotes.length + s.teacherContactLog.length; }, 0);
		var totalWeeks = Object.keys(DB.attendanceWeeks).length;
		holder.innerHTML =
			'<div class="wsm-card"><div class="wsm-card-title">🏫 School</div>' +
				'<div class="wsm-field"><label class="wsm-label">School name</label><input class="wsm-input" data-bind="school.name" value="' + esc(DB.school.name) + '"></div>' +
				'<div class="wsm-field-row">' +
					'<div class="wsm-field"><label class="wsm-label">Currency</label><input class="wsm-input" data-bind="school.currency" value="' + esc(DB.school.currency) + '" placeholder="CAD"></div>' +
					'<div class="wsm-field"><label class="wsm-label">Payment due day</label><input class="wsm-input" type="number" min="1" max="31" data-bind="school.paymentDueDay" value="' + DB.school.paymentDueDay + '"></div>' +
				'</div>' +
				'<div class="wsm-field" style="max-width:260px"><label class="wsm-label">Attendance checks per day</label><input class="wsm-input" type="number" min="1" max="12" data-bind="school.requiredAttendanceChecksPerDay" value="' + DB.school.requiredAttendanceChecksPerDay + '"><p class="wsm-nav-hint" style="margin-top:4px">How many times attendance must be checked for each student on a school day (usually the number of lessons).</p></div>' +
				"</div></div>" +
			'<div class="wsm-card"><div class="wsm-card-title">🎒 Class groups<span class="wsm-card-actions"><button class="wsm-btn wsm-btn-ghost wsm-btn-sm" data-act="set-groups">Edit</button></span></div>' +
				(DB.school.classGroups.length ? DB.school.classGroups.map(function (g) { return '<span class="wsm-pill wsm-pill-teal" style="margin:2px 4px 2px 0">' + esc(g) + "</span>"; }).join("") : '<p class="wsm-nav-hint">No class groups.</p>') + "</div>" +
			'<div class="wsm-card"><div class="wsm-card-title">📚 Lessons<span class="wsm-card-actions"><button class="wsm-btn wsm-btn-ghost wsm-btn-sm" data-act="set-lessons">Edit</button></span></div>' +
				(DB.school.lessons.length ? DB.school.lessons.map(function (l) { return '<span class="wsm-pill wsm-pill-blue" style="margin:2px 4px 2px 0">' + esc(l) + "</span>"; }).join("") : '<p class="wsm-nav-hint">No lessons configured.</p>') + "</div>" +
			'<div class="wsm-card"><div class="wsm-card-title">💳 Payment brackets<span class="wsm-card-actions"><button class="wsm-btn wsm-btn-ghost wsm-btn-sm" data-act="bracket-add">+ Add bracket</button></span></div>' +
				'<div class="wsm-bracket-head"><span>Name</span><span>Monthly fee</span><span></span><span></span><span></span></div>' +
				(bracketEditorRows || '<p class="wsm-nav-hint">No brackets configured - add at least one.</p>') +
				'<p class="wsm-nav-hint" style="margin-top:8px">Changes save automatically. Students assigned to a deleted bracket keep their records.</p>' +
				"</div>" +
			'<div class="wsm-card"><div class="wsm-card-title">📦 Data</div>' +
				'<div class="wsm-kv">' +
					'<div class="wsm-kv-row"><span class="wsm-kv-key">Stored size</span><span class="wsm-kv-val">' + (bytes >= 1048576 ? (bytes / 1048576).toFixed(2) + " MB" : Math.round(bytes / 1024) + " KB") + ' of 1 MB</span></div>' +
					'<div class="wsm-kv-row"><span class="wsm-kv-key">Students</span><span class="wsm-kv-val">' + DB.students.length + " (" + activeStudents().length + " active)</span></div>" +
					'<div class="wsm-kv-row"><span class="wsm-kv-key">Average per student</span><span class="wsm-kv-val">' + avg + " KB</span></div>" +
					'<div class="wsm-kv-row"><span class="wsm-kv-key">Capacity</span><span class="wsm-kv-val">About ' + remainingStudentCount() + " more student(s) fit before the 90% safety line</span></div>" +
					'<div class="wsm-kv-row"><span class="wsm-kv-key">Notes and contacts</span><span class="wsm-kv-val">' + totalNotes + "</span></div>" +
					'<div class="wsm-kv-row"><span class="wsm-kv-key">Completed weeks</span><span class="wsm-kv-val">' + totalWeeks + "</span></div>" +
					'<div class="wsm-kv-row"><span class="wsm-kv-key">Group messages</span><span class="wsm-kv-val">' + DB.schoolLogs.groupMessages.length + "</span></div>" +
				'<div class="wsm-kv-row"><span class="wsm-kv-key">Waiting payments</span><span class="wsm-kv-val">' + waitingPaymentList().length + "</span></div>" +
				"</div>" +
				'<div style="margin-top:14px"><button class="wsm-btn wsm-btn-outline" data-act="export-data">⬇ Export All Data (JSON)</button></div>' +
				"</div>";
	}
	function openListEditorModal(kind) {
		var title = kind === "groups" ? "Class Groups" : "Lessons";
		var items = kind === "groups" ? DB.school.classGroups : DB.school.lessons;
		openModal(title,
			'<p class="wsm-nav-hint" style="margin-bottom:8px">One per line.</p><textarea class="wsm-input" id="wsmf-list-editor" style="min-height:160px">' + esc(items.join("\n")) + "</textarea>",
			'<button class="wsm-btn wsm-btn-ghost" data-act="modal-close">Cancel</button><button class="wsm-btn wsm-btn-primary" data-act="list-save" data-kind="' + kind + '">Save</button>');
	}
	function saveListEditor(kind) {
		var el = $("#wsmf-list-editor");
		var lines = el ? el.value.split("\n").map(function (l) { return l.trim(); }).filter(Boolean) : [];
		if (kind === "groups") DB.school.classGroups = lines;
		else if (kind === "lessons") DB.school.lessons = lines;
		closeModal();
		persistSoon();
		renderSettingsPage();
		notify("Saved.");
	}
	function addPaymentBracket() {
		DB.school.paymentBrackets.push({ id: uid(), name: "New bracket", monthlyFee: 0 });
		persistSoon();
		renderSettingsPage();
		notify("Bracket added.");
	}
	function deletePaymentBracket(bracketId) {
		DB.school.paymentBrackets = DB.school.paymentBrackets.filter(function (b) { return b.id !== bracketId; });
		persistSoon();
		renderSettingsPage();
		notify("Bracket removed.");
	}
	function exportAllData() {
		var blob = new Blob([JSON.stringify(DB, null, 2)], { type: "application/json" });
		var url = URL.createObjectURL(blob);
		var a = document.createElement("a");
		a.href = url;
		a.download = "weekend-school-data-" + todayISO() + ".json";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		notify("Data exported as JSON.");
	}

	/* ═══════════════════════════════════════════
	   MODAL
	   ═══════════════════════════════════════════ */
	function openModal(title, bodyHtml, footerHtml) {
		$("#wsm-modal-title").textContent = title;
		$("#wsm-modal-body").innerHTML = bodyHtml;
		$("#wsm-modal-foot").innerHTML = footerHtml || "";
		$("#wsm-modal-overlay").classList.add("open");
		resize();
	}
	function closeModal() {
		$("#wsm-modal-overlay").classList.remove("open");
		resize();
	}

	/* ── Clipboard ── */
	function copyText(text, successMessage) {
		function fallbackModal() {
			openModal("Copy Text", '<p class="wsm-nav-hint" style="margin-bottom:8px">Copy this text manually:</p><textarea class="wsm-input" style="min-height:160px" readonly>' + esc(text) + "</textarea>", '<button class="wsm-btn wsm-btn-ghost" data-act="modal-close">Close</button>');
		}
		try {
			if (navigator.clipboard && navigator.clipboard.writeText) {
				navigator.clipboard.writeText(text).then(function () { notify(successMessage || "Copied to clipboard."); }, fallbackModal);
				return;
			}
		} catch (e) { }
		try {
			var ta = document.createElement("textarea");
			ta.value = text;
			ta.style.position = "fixed";
			ta.style.opacity = "0";
			document.body.appendChild(ta);
			ta.select();
			var ok = document.execCommand("copy");
			document.body.removeChild(ta);
			if (ok) notify(successMessage || "Copied to clipboard.");
			else fallbackModal();
		} catch (e2) { fallbackModal(); }
	}

	/* ═══════════════════════════════════════════
	   STUDENT DRAWER
	   ═══════════════════════════════════════════ */
	function openDrawer(studentId) {
		ui.drawerStudentId = studentId;
		ui.drawerTab = "overview";
		var overlay = $("#wsm-drawer-overlay");
		if (overlay) overlay.classList.add("open", "drawer-mode");
		renderDrawer();
		resize();
	}
	function closeDrawer() {
		ui.drawerStudentId = null;
		var overlay = $("#wsm-drawer-overlay");
		if (overlay) overlay.classList.remove("open", "drawer-mode");
		resize();
	}
	function drawerStudent() { return findStudent(ui.drawerStudentId); }
	function renderDrawer() {
		var s = drawerStudent();
		if (!s) { closeDrawer(); return; }
		$("#wsm-drawer-avatar").textContent = initialsOf(studentFullName(s));
		$("#wsm-drawer-name").textContent = studentFullName(s);
		$("#wsm-drawer-meta").textContent = (s.classGroup || "No class group") + (s.status !== "active" ? " · " + s.status : "");
		var tabs = [["overview", "Overview"], ["attendance", "Attendance"], ["payments", "Payments"], ["progress", "Progress"], ["quran", "Quran"], ["communication", "Communication"]];
		$("#wsm-drawer-tabs").innerHTML = tabs.map(function (t) {
			return '<button class="wsm-drawer-tab' + (ui.drawerTab === t[0] ? " active" : "") + '" data-act="drawer-tab" data-tab="' + t[0] + '">' + t[1] + "</button>";
		}).join("");
		var body = $("#wsm-drawer-body");
		if (ui.drawerTab === "overview") body.innerHTML = renderDrawerOverview(s);
		else if (ui.drawerTab === "attendance") body.innerHTML = renderDrawerAttendance(s);
		else if (ui.drawerTab === "payments") body.innerHTML = renderDrawerPayments(s);
		else if (ui.drawerTab === "progress") body.innerHTML = renderDrawerProgress(s);
		else if (ui.drawerTab === "quran") body.innerHTML = renderDrawerQuran(s);
		else if (ui.drawerTab === "communication") body.innerHTML = renderDrawerCommunication(s);
	}
	function renderDrawerOverview(s) {
		var row = function (label, value) { return '<div class="wsm-kv-row"><span class="wsm-kv-key">' + label + '</span><span class="wsm-kv-val">' + esc(value || "-") + "</span></div>"; };
		var consentLabel = { "notAsked": "Not asked", "yes": "Yes", "no": "No" }[s.photoConsent] || "Not asked";
		return '<div class="wsm-card">' +
			'<div class="wsm-card-title">Registration<span class="wsm-card-actions"><button class="wsm-btn wsm-btn-ghost wsm-btn-sm" data-act="edit-student" data-id="' + s.id + '">✏️ Edit Info</button></span></div>' +
			'<div class="wsm-kv">' +
				row("First name", s.firstName) + row("Last name", s.lastName) + row("Gender", s.gender || "-") +
				row("Date of birth", s.dateOfBirth ? fmtDateShort(s.dateOfBirth) : "-") + row("Class group", s.classGroup) +
				row("Status", s.status) + row("Start date", s.startDate ? fmtDateShort(s.startDate) : "-") + row("Payment bracket", bracketNameOf(s)) +
			"</div></div>" +
			'<div class="wsm-card"><div class="wsm-card-title">Parents</div><div class="wsm-kv">' +
				row("Primary parent", (s.parentName || "-") + (s.parentRelation ? " (" + s.parentRelation + ")" : "")) +
				row("Phone", s.parentPhone) + row("Email", s.parentEmail) +
				row("Second parent", (s.secondParentName || "-") + (s.secondParentPhone ? " · " + s.secondParentPhone : "")) +
				row("Address", s.address) +
			"</div></div>" +
			'<div class="wsm-card"><div class="wsm-card-title">Emergency and health</div><div class="wsm-kv">' +
				row("Emergency contact", (s.emergencyContactName || "-") + (s.emergencyContactRelation ? " (" + s.emergencyContactRelation + ")" : "") + (s.emergencyContactPhone ? " · " + s.emergencyContactPhone : "")) +
				row("Allergies", s.allergies) + row("Health notes", s.healthNotes) +
			"</div></div>" +
			'<div class="wsm-card"><div class="wsm-card-title">Pick-up and consent</div><div class="wsm-kv">' +
				row("Authorized pick-up", s.pickupAuthorizedNames) + row("Pick-up notes", s.pickupNotes) + row("Photo consent", consentLabel) +
			"</div></div>" +
			'<div class="wsm-card"><div class="wsm-card-title">📁 Documents</div>' +
				'<p class="wsm-nav-hint" style="margin-bottom:10px">Upload signed forms to this student file.</p>' +
				'<div class="wsm-doc-upload-row">' +
					'<button class="wsm-btn wsm-btn-outline wsm-btn-sm" data-act="doc-upload" data-id="' + s.id + '" data-kind="photoConsent">📷 Upload photo consent form</button>' +
					'<button class="wsm-btn wsm-btn-outline wsm-btn-sm" data-act="doc-upload" data-id="' + s.id + '" data-kind="emergencyInfo">🚨 Upload emergency info form</button>' +
					'<button class="wsm-btn wsm-btn-outline wsm-btn-sm" data-act="doc-upload" data-id="' + s.id + '" data-kind="other">📄 Upload other document</button>' +
				"</div>" +
				'<div class="wsm-doc-list">' + (s.documents.map(function (doc) {
					var kindLabel = { photoConsent: "Photo consent", emergencyInfo: "Emergency info", other: "Other" }[doc.kind] || "Other";
					return '<div class="wsm-doc-row"><span class="wsm-pill wsm-pill-teal">' + esc(kindLabel) + '</span><span class="wsm-doc-name">' + esc(doc.name) + '</span><span class="wsm-note-meta">' + esc(fmtDateShort(doc.uploadedAt ? doc.uploadedAt.slice(0, 10) : "")) + " · " + esc(doc.uploadedBy || "") + '</span>' +
						'<button class="wsm-btn wsm-btn-ghost wsm-btn-sm" data-act="doc-open" data-id="' + s.id + '" data-doc="' + doc.id + '">Open</button>' +
						'<button class="wsm-btn wsm-btn-danger wsm-btn-sm" data-act="doc-remove" data-id="' + s.id + '" data-doc="' + doc.id + '">✕</button></div>';
				}).join("") || '<p class="wsm-nav-hint">No documents uploaded yet.</p>') + "</div></div>";
	}
	function uploadStudentDocument(studentId, kind) {
		if (typeof tool.requestUpload !== "function") { notify("Upload is not available. Set allowUpload: 'yes' on the tool field settings.", "warning"); return; }
		var s = findStudent(studentId);
		if (!s) return;
		try {
			tool.requestUpload(".pdf,.jpg,.jpeg,.png,.doc,.docx", function (error, file) {
				if (error) { notify("Upload failed: " + error, "error"); return; }
				if (!file || !file.url) { notify("Upload returned no file.", "error"); return; }
				var student = findStudent(studentId);
				if (!student) return;
				student.documents.push({ id: uid(), name: file.name, url: file.url, kind: kind, uploadedAt: new Date().toISOString(), uploadedBy: userName() });
				persistSoon();
				renderAll();
				notify("Document uploaded: " + file.name);
			});
		} catch (e) { notify("Upload is not available here.", "warning"); }
	}
	function removeStudentDocument(studentId, docId) {
		var s = findStudent(studentId);
		if (!s) return;
		s.documents = s.documents.filter(function (d) { return d.id !== docId; });
		persistSoon();
		renderAll();
		notify("Document removed from the student file.");
	}
	function openStudentDocument(studentId, docId) {
		var s = findStudent(studentId);
		if (!s) return;
		var doc = null;
		s.documents.forEach(function (d) { if (d.id === docId) doc = d; });
		if (!doc || !doc.url) return;
		try { tool.openUrl(doc.url); } catch (e) { notify("Cannot open the document in this environment.", "warning"); }
	}
	function renderDrawerAttendance(s) {
		var weeks = collectAttendanceWeekKeys().slice(0, 8);
		if (!weeks.length) return '<div class="wsm-empty"><h3>No attendance data</h3><p>Mark attendance on the Attendance page.</p></div>';
		var head = "<tr><th>Sunday</th>" + DB.school.lessons.map(function (l) { return "<th>" + esc(l) + "</th>"; }).join("") + "</tr>";
		var rows = weeks.map(function (sunday) {
			var cells = DB.school.lessons.map(function (l) {
				var m = markForLesson(s, sunday, l);
				return '<td><span class="wsm-att-cell ' + m.toLowerCase() + '" style="cursor:default">' + (m || "·") + "</span></td>";
			}).join("");
			return "<tr><td>" + esc(fmtDateShort(sunday)) + "</td>" + cells + "</tr>";
		}).join("");
		return '<div class="wsm-card"><div class="wsm-card-title">Last ' + weeks.length + " Sundays</div><div class=\"wsm-table-wrap\"><table class=\"wsm-table\"><thead>" + head + "</thead><tbody>" + rows + "</tbody></table></div></div>";
	}
	function renderDrawerPayments(s) {
		var entries = (s.paymentEntries || []).slice().sort(function (a, b) { return (b.month || "").localeCompare(a.month || ""); });
		var unpaid = entries.filter(function (e) { return e.status !== "paid" && e.status !== "exempt"; });
		var totalDue = unpaid.reduce(function (sum, e) { return sum + (e.amount || 0); }, 0);
		var collected = entries.filter(function (e) { return e.status === "paid"; }).reduce(function (sum, e) { return sum + (e.amount || 0); }, 0);
		var rows = entries.map(function (e) {
			var overdue = e.status !== "paid" && e.status !== "exempt" && e.dueDate && e.dueDate < todayISO();
			var statusOptions = PAYMENT_STATUSES.map(function (st) {
				return '<option value="' + st + '"' + (e.status === st ? " selected" : "") + ">" + PAYMENT_LABEL[st] + "</option>";
			}).join("");
			return '<div class="wsm-drawer-pay-row' + (e.status === "paid" ? " paid" : "") + '">' +
				'<input type="checkbox" class="wsm-drawer-pay-check" data-act="drawer-pay-check" data-id="' + e.id + '"' + (e.status === "paid" ? " checked" : "") + ' title="Mark paid">' +
				'<div class="wsm-drawer-pay-main">' +
					'<div class="wsm-drawer-pay-month">' + esc(monthLabelOf(e.month) || "Payment") + '</div>' +
					'<div class="wsm-drawer-pay-due">due ' + esc(e.dueDate ? fmtDateShort(e.dueDate) : "-") + (overdue ? ' <span class="wsm-pill wsm-pill-red">Overdue</span>' : "") + '</div>' +
				'</div>' +
				'<input class="wsm-input wsm-drawer-pay-amount" type="number" min="0" step="0.01" data-act="drawer-pay-amount" data-id="' + e.id + '" value="' + (e.amount || "") + '" placeholder="0">' +
				'<span class="wsm-drawer-pay-currency">' + esc(DB.school.currency) + "</span>" +
				'<select class="wsm-pay-select ' + e.status + '" data-act="drawer-pay-status" data-id="' + e.id + '">' + statusOptions + "</select>" +
				'<button class="wsm-btn wsm-btn-outline wsm-btn-sm" data-act="drawer-pay-message" data-id="' + e.id + '" title="Copy or send a message about this payment">💬</button>' +
				'<button class="wsm-btn wsm-btn-danger wsm-btn-sm" data-act="drawer-pay-delete" data-id="' + e.id + '" title="Remove this payment">🗑</button>' +
			'</div>';
		}).join("");
		return '<div class="wsm-card"><div class="wsm-card-title">Payments<span class="wsm-card-actions"><button class="wsm-btn wsm-btn-ghost wsm-btn-sm" data-act="drawer-pay-add">+ Add payment</button></span></div>' +
			'<div class="wsm-drawer-pay-add">' +
				'<input type="month" class="wsm-input wsm-drawer-add-month" value="' + ui.paymentMonth + '" title="Payment month">' +
				'<input class="wsm-input wsm-drawer-add-amount" type="number" min="0" step="0.01" placeholder="Amount">' +
				'<button class="wsm-btn wsm-btn-primary wsm-btn-sm" data-act="drawer-pay-add">Add</button>' +
			'</div>' +
			'<div class="wsm-drawer-pay-stats">' +
				'<span class="wsm-pill ' + (unpaid.length ? "wsm-pill-amber" : "wsm-pill-green") + '">' + unpaid.length + " waiting</span>" +
				'<span class="wsm-pill wsm-pill-green">' + esc(DB.school.currency) + " " + collected.toFixed(2) + " collected</span>" +
				'<span class="wsm-pill ' + (totalDue > 0 ? "wsm-pill-red" : "wsm-pill-gray") + '">' + esc(DB.school.currency) + " " + totalDue.toFixed(2) + " due</span>" +
			'</div>' +
			'<p class="wsm-nav-hint" style="margin:10px 0 8px">Check the box to mark a payment as paid. Change the amount or due date right in the list. Use 💬 to copy or send a message about a payment.</p>' +
			(rows || '<p class="wsm-nav-hint">No payments recorded. Pick a month above and press Add.</p>') +
			"</div>";
	}
	function addDrawerPayment() {
		var s = drawerStudent();
		if (!s) return;
		var body = $("#wsm-drawer-body");
		var monthEl = body ? body.querySelector(".wsm-drawer-add-month") : null;
		var amountEl = body ? body.querySelector(".wsm-drawer-add-amount") : null;
		var month = monthEl ? monthEl.value : "";
		var amount = Number(amountEl ? amountEl.value : 0) || 0;
		if (!month) { notify("Pick the month first.", "warning"); return; }
		var entry = newPaymentEntry(month, amount);
		entry.recordedBy = userName();
		s.paymentEntries.push(entry);
		persistSoon();
		renderDrawer();
		renderNavBadges();
		notify("Payment added for " + monthLabelOf(month) + ".");
	}
	function removeStudentPaymentEntry(entryId) {
		var owner = findPaymentEntryOwner(entryId);
		if (!owner) return;
		owner.student.paymentEntries = owner.student.paymentEntries.filter(function (e) { return e.id !== entryId; });
		persistSoon();
		renderDrawer();
		renderNavBadges();
		notify("Payment removed.");
	}

	/* ── Messaging (payments + Quran progress) ── */
	var _activeMessageEmailBuilder = null;
	function buildPaymentMessageText(student, entry, lang) {
		var monthName = monthLabelOf(entry.month);
		if (lang === "tr") {
			return "Sayın " + (student.parentName || "Veli") + ", " + student.firstName + " adına " + monthName + " ayı okul ücreti (" + DB.school.currency + " " + entry.amount + ")" + (entry.dueDate ? " son ödeme " + fmtDateShort(entry.dueDate) : "") + ". Gönderdiyseniz bu mesajı dikkate almayınız. Teşekkür ederiz.";
		}
		return "Dear " + (student.parentName || "Parent") + ", a friendly reminder about " + student.firstName + "'s " + monthName + " school fee (" + DB.school.currency + " " + entry.amount + ")" + (entry.dueDate ? ", due " + fmtDateShort(entry.dueDate) : "") + ". If you have already sent it, please ignore this message. Thank you!";
	}
	function buildPaymentEmail(student, entry, lang) {
		return {
			to: student.parentEmail || "",
			subject: "Weekend school fee - " + monthLabelOf(entry.month) + " - " + student.firstName + " " + student.lastName,
			htmlBody: "<p>" + esc(buildPaymentMessageText(student, entry, lang)).replace(/\n/g, "<br>") + "</p>"
		};
	}
	function buildQuranProgressMessageText(student, lang) {
		var lines = [];
		if (lang === "tr") {
			lines.push("Sayın " + (student.parentName || "Veli") + ", " + student.firstName + " adına Kur'an ilerleme bilgisi:");
			lines.push("- Okuma seviyesi: " + (student.quranReading.currentLevel || "-"));
			lines.push("- Ezber:");
			(student.quranMemorization.surahs || []).forEach(function (su) {
				lines.push("  * " + su.name + (su.portions ? " (" + su.portions + ")" : "") + ": " + HIFZ_LABEL[su.status]);
			});
			if (!(student.quranMemorization.surahs || []).length) lines.push("  -");
			lines.push("- Sonraki hedef: " + (student.quranMemorization.nextTarget || "-"));
		} else {
			lines.push("Dear " + (student.parentName || "Parent") + ", here is " + student.firstName + "'s Quran progress update:");
			lines.push("- Reading level: " + (student.quranReading.currentLevel || "-"));
			lines.push("- Memorization:");
			(student.quranMemorization.surahs || []).forEach(function (su) {
				lines.push("  * " + su.name + (su.portions ? " (" + su.portions + ")" : "") + ": " + HIFZ_LABEL[su.status]);
			});
			if (!(student.quranMemorization.surahs || []).length) lines.push("  -");
			lines.push("- Next target: " + (student.quranMemorization.nextTarget || "-"));
		}
		return lines.join("\n");
	}
	function buildQuranProgressEmail(student, lang) {
		return {
			to: student.parentEmail || "",
			subject: "Quran progress - " + student.firstName + " " + student.lastName,
			htmlBody: "<p>" + esc(buildQuranProgressMessageText(student, lang)).replace(/\n/g, "<br>") + "</p>"
		};
	}
	function openPaymentMessageModal(studentId, entryId) {
		var s = findStudent(studentId);
		if (!s) return;
		var entry = null;
		(s.paymentEntries || []).forEach(function (e) { if (e.id === entryId) entry = e; });
		if (!entry) return;
		openMessageModal("Payment Message - " + monthLabelOf(entry.month), s,
			function (lang) { return buildPaymentMessageText(s, entry, lang); },
			function (lang) { return buildPaymentEmail(s, entry, lang); });
	}
	function openQuranMessageModal(studentId) {
		var s = findStudent(studentId);
		if (!s) return;
		openMessageModal("Quran Progress Message", s,
			function (lang) { return buildQuranProgressMessageText(s, lang); },
			function (lang) { return buildQuranProgressEmail(s, lang); });
	}
	function openMessageModal(title, student, textBuilder, emailBuilder) {
		_activeMessageEmailBuilder = emailBuilder;
		openModal(title,
			'<div class="wsm-field" style="max-width:200px"><label class="wsm-label">Language</label><select class="wsm-input" id="wsmf-msg-lang"><option value="en">English</option><option value="tr">Turkish</option></select></div>' +
			'<div class="wsm-field"><label class="wsm-label">Message (read-only, ready to copy)</label><textarea class="wsm-input" id="wsmf-msg-text" style="min-height:130px" readonly></textarea></div>' +
			'<div class="wsm-msg-actions">' +
				'<button class="wsm-btn wsm-btn-primary" data-act="msg-copy">📋 Copy Text</button>' +
				'<button class="wsm-btn wsm-btn-primary" data-act="msg-image">🖼 Copy as Image</button>' +
				'<button class="wsm-btn wsm-btn-outline" data-act="msg-email" data-student="' + student.id + '">📧 Send Email</button>' +
			'</div>' +
			'<div id="wsmf-msg-email-preview"></div>',
			'<button class="wsm-btn wsm-btn-ghost" data-act="modal-close">Close</button>');
		var refresh = function () {
			var lang = ($("#wsmf-msg-lang") ? $("#wsmf-msg-lang").value : "en") || "en";
			var ta = $("#wsmf-msg-text");
			if (ta) ta.value = textBuilder(lang);
			var preview = $("#wsmf-msg-email-preview");
			if (preview) {
				var email = emailBuilder(lang);
				preview.innerHTML = email.to
					? '<div class="wsm-card-title" style="margin-top:14px">📧 Email preview</div>' +
						'<div class="wsm-kv-row"><span class="wsm-kv-key">To</span><span class="wsm-kv-val">' + esc(email.to) + '</span></div>' +
						'<div class="wsm-kv-row"><span class="wsm-kv-key">Subject</span><span class="wsm-kv-val">' + esc(email.subject) + '</span></div>' +
						'<div class="wsm-kv-row"><span class="wsm-kv-key">Body</span><span class="wsm-kv-val">' + esc(email.htmlBody.replace(/<br>/g, "\n").replace(/<[^>]+>/g, "")) + '</span></div>'
					: '<p class="wsm-nav-hint" style="margin-top:12px">No parent email on file. Add an email in Edit Info to enable sending.</p>';
			}
		};
		refresh();
		var langSel = $("#wsmf-msg-lang");
		if (langSel) langSel.onchange = refresh;
	}
	function sendActiveMessageEmail() {
		if (!_activeMessageEmailBuilder) return;
		var lang = ($("#wsmf-msg-lang") ? $("#wsmf-msg-lang").value : "en") || "en";
		var email = _activeMessageEmailBuilder(lang);
		if (!email.to) { notify("No parent email on file for this student.", "warning"); return; }
		if (typeof tool.requestSendEmail !== "function") { notify("Email sending is not available. Set allowSendEmail: 'yes' on the tool field settings.", "warning"); return; }
		try {
			tool.requestSendEmail({ to: email.to, subject: email.subject, htmlBody: email.htmlBody, title: email.subject }, function (error, result) {
				if (error) notify("Email failed: " + error, "error");
				else notify("Email sent to " + email.to, "success");
			});
		} catch (e) { notify("Email sending is not available here.", "warning"); }
	}
	function wrapMessageLines(text, maxLineChars) {
		var lines = [];
		text.split("\n").forEach(function (paragraph) {
			if (!paragraph) { lines.push(""); return; }
			var words = paragraph.split(" ");
			var line = "";
			words.forEach(function (word) {
				var candidate = line ? line + " " + word : word;
				if (candidate.length > maxLineChars && line) { lines.push(line); line = word; }
				else line = candidate;
			});
			lines.push(line);
		});
		return lines;
	}
	function buildMessageImageBlob(text, callback) {
		try {
			var canvas = document.createElement("canvas");
			var ctx = canvas.getContext("2d");
			ctx.font = "16px 'Segoe UI', Arial, sans-serif";
			var lines = wrapMessageLines(text, 34);
			var lineHeight = 26;
			var padding = 22;
			canvas.width = 620;
			canvas.height = padding * 2 + lines.length * lineHeight;
			ctx.fillStyle = "#ffffff";
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.strokeStyle = "#0f766e";
			ctx.lineWidth = 6;
			ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
			ctx.fillStyle = "#0f172a";
			lines.forEach(function (line, index) { ctx.fillText(line, padding, padding + 14 + index * lineHeight); });
			canvas.toBlob(function (blob) { callback(blob); }, "image/png");
		} catch (e) { callback(null); }
	}
	function copyMessageAsImage() {
		var ta = $("#wsmf-msg-text");
		var text = ta ? ta.value : "";
		if (!text) return;
		buildMessageImageBlob(text, function (blob) {
			if (!blob) { notify("Image generation failed in this browser.", "error"); return; }
			try {
				if (navigator.clipboard && window.ClipboardItem) {
					navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]).then(
						function () { notify("Image copied - paste it into WhatsApp."); },
						function () { downloadMessageImage(blob); }
					);
					return;
				}
			} catch (e) { }
			downloadMessageImage(blob);
		});
	}
	function downloadMessageImage(blob) {
		try {
			var url = URL.createObjectURL(blob);
			var a = document.createElement("a");
			a.href = url;
			a.download = "message-" + todayISO() + ".png";
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			notify("Image downloaded - send it over WhatsApp.");
		} catch (e) { notify("Could not download the image.", "error"); }
	}
	function renderDrawerProgress(s) {
		var notes = s.progressNotes.slice().reverse().map(function (n) {
			var pill = n.flag && n.flag !== "none" ? '<span class="wsm-pill ' + (n.flag === "droppingInterest" ? "wsm-pill-red" : "wsm-pill-amber") + '">' + esc(NOTE_FLAG_LABEL[n.flag]) + "</span>" : "";
			return '<div class="wsm-note-row"><div class="wsm-note-text">' + pill + " " + esc(n.note) + '</div><div class="wsm-note-meta">' + esc(fmtDateShort(n.date)) + " · " + esc(n.recordedBy || "") + "</div></div>";
		}).join("");
		var contacts = s.teacherContactLog.slice().reverse().map(function (c) {
			return '<div class="wsm-note-row"><div class="wsm-note-text">' + esc(c.summary) + '</div><div class="wsm-note-meta">' + esc(fmtDateShort(c.date)) + " · " + esc(c.method || "") + " · " + esc(c.recordedBy || "") + "</div></div>";
		}).join("");
		return '<div class="wsm-card"><div class="wsm-card-title">Progress notes<span class="wsm-card-actions"><button class="wsm-btn wsm-btn-ghost wsm-btn-sm" data-act="prog-add-note" data-id="' + s.id + '">+ Add Note</button></span></div><div class="wsm-note-list">' + (notes || '<p class="wsm-nav-hint">No notes yet.</p>') + "</div></div>" +
			'<div class="wsm-card"><div class="wsm-card-title">Teacher contact log<span class="wsm-card-actions"><button class="wsm-btn wsm-btn-ghost wsm-btn-sm" data-act="prog-add-contact" data-id="' + s.id + '">+ Add Contact</button></span></div><div class="wsm-note-list">' + (contacts || '<p class="wsm-nav-hint">No contacts logged yet.</p>') + "</div></div>";
	}
	function renderDrawerQuran(s) {
		var history = s.quranReading.levelHistory.slice().reverse().map(function (h) {
			return '<div class="wsm-surah-row"><span class="wsm-surah-name">' + esc(h.level) + '</span><span class="wsm-note-meta">since ' + esc(fmtDateShort(h.date)) + "</span></div>";
		}).join("");
		var surahs = s.quranMemorization.surahs.map(function (su) {
			var opts = HIFZ_STATUSES.map(function (st) {
				return '<option value="' + st + '"' + (su.status === st ? " selected" : "") + ">" + HIFZ_LABEL[st] + "</option>";
			}).join("");
			return '<div class="wsm-surah-row"><span class="wsm-surah-name">' + esc(su.name) + '</span>' +
				'<select class="wsm-pay-select" data-act="prog-surah-status" data-id="' + s.id + '" data-name="' + esc(su.name) + '">' + opts + "</select>" +
				'<input class="wsm-input wsm-pay-note" data-act="prog-surah-portions" data-id="' + s.id + '" data-name="' + esc(su.name) + '" value="' + esc(su.portions || "") + '" placeholder="Portions">' +
				'<button class="wsm-btn wsm-btn-ghost wsm-btn-sm" data-act="prog-surah-delete" data-id="' + s.id + '" data-name="' + esc(su.name) + '">✕</button></div>';
		}).join("");
		return '<div class="wsm-card"><div class="wsm-card-title">Quran reading level<span class="wsm-card-actions"><button class="wsm-btn wsm-btn-outline wsm-btn-sm" data-act="quran-message" data-id="' + s.id + '">💬 Message</button></span></div>' +
			'<div class="wsm-field"><input class="wsm-input" data-act="prog-quran-level" data-id="' + s.id + '" value="' + esc(s.quranReading.currentLevel) + '" placeholder="e.g. Elifba 2"></div>' +
			'<div class="wsm-card-title" style="margin-top:10px">History</div>' + (history || '<p class="wsm-nav-hint">No level changes recorded.</p>') + "</div>" +
			'<div class="wsm-card"><div class="wsm-card-title">Hifz (memorization)<span class="wsm-card-actions"><button class="wsm-btn wsm-btn-outline wsm-btn-sm" data-act="quran-message" data-id="' + s.id + '">💬 Message</button><button class="wsm-btn wsm-btn-ghost wsm-btn-sm" data-act="prog-add-surah" data-id="' + s.id + '">+ Add Surah</button></span></div>' +
			(surahs || '<p class="wsm-nav-hint">No surahs tracked yet.</p>') +
			'<div class="wsm-field" style="margin-top:10px"><label class="wsm-label">Next target</label><input class="wsm-input" data-act="prog-hifz-target" data-id="' + s.id + '" value="' + esc(s.quranMemorization.nextTarget) + '"></div></div>';
	}
	function renderDrawerCommunication(s) {
		var oneOnOne = s.parentCommunication.oneOnOne.slice().reverse().map(function (e) {
			return '<div class="wsm-note-row"><div class="wsm-note-text">' + esc(e.summary) + '</div><div class="wsm-note-meta">' + esc(fmtDateShort(e.date)) + " · " + esc(e.channel || "") + "</div></div>";
		}).join("");
		var calls = s.parentCommunication.absenceCalls.slice().reverse().map(function (c) {
			return '<div class="wsm-note-row"><div class="wsm-note-text">' + esc(c.reason || "Absence") + " → " + esc(c.outcome || "-") + '</div><div class="wsm-note-meta">' + esc(fmtDateShort(c.date)) + "</div></div>";
		}).join("");
		return '<div class="wsm-card"><div class="wsm-card-title">One-on-one feedback<span class="wsm-card-actions"><button class="wsm-btn wsm-btn-ghost wsm-btn-sm" data-act="comm-add-on-one" data-id="' + s.id + '">+ Add Feedback</button></span></div><div class="wsm-note-list">' + (oneOnOne || '<p class="wsm-nav-hint">No feedback logged yet.</p>') + "</div></div>" +
			'<div class="wsm-card"><div class="wsm-card-title">Absence calls<span class="wsm-card-actions"><button class="wsm-btn wsm-btn-ghost wsm-btn-sm" data-act="comm-log-call" data-id="' + s.id + '">📞 Log Call</button></span></div><div class="wsm-note-list">' + (calls || '<p class="wsm-nav-hint">No absence calls logged yet.</p>') + "</div></div>";
	}

	/* ═══════════════════════════════════════════
	   EVENT DELEGATION
	   ═══════════════════════════════════════════ */
	function targetStudentForAction(dataId) {
		if (dataId && findStudent(dataId)) return dataId;
		if (ui.drawerStudentId) return ui.drawerStudentId;
		if (ui.activePage === "progress") return ui.progressStudentId;
		if (ui.activePage === "communication" && ui.commTab === "onetoone") return ui.commOnOneStudentId;
		return null;
	}

	document.addEventListener("click", function (e) {
		var overlay = e.target;
		if (overlay === $("#wsm-modal-overlay")) { closeModal(); return; }
		if (overlay === $("#wsm-drawer-overlay")) { closeDrawer(); return; }

		var nav = e.target.closest("[data-page]");
		if (nav) { switchPage(nav.getAttribute("data-page")); return; }
		var reportKind = e.target.closest("[data-report-kind]");
		if (reportKind) { ui.reportKind = reportKind.getAttribute("data-report-kind"); renderReportsPage(); return; }
		var commTab = e.target.closest("[data-comm-tab]");
		if (commTab) { ui.commTab = commTab.getAttribute("data-comm-tab"); renderCommunicationPage(); return; }

		var el = e.target.closest("[data-act]");
		if (!el) return;
		var act = el.getAttribute("data-act");
		var id = el.getAttribute("data-id");

		switch (act) {
			case "add-student": openStudentModal(null); break;
			case "edit-student": openStudentModal(id); break;
			case "delete-student": deleteStudentConfirm(id); break;
			case "delete-student-confirm": deleteStudentNow(id); break;
			case "open-student": openDrawer(id); break;
			case "student-group-filter": ui.studentFilterGroup = el.getAttribute("data-group"); renderGroupChips(); renderStudentList(); break;
			case "student-save": saveStudentFromModal(id); break;
			case "modal-close": closeModal(); break;

			case "att-prev": ui.attendanceWeekSunday = addDaysIso(ui.attendanceWeekSunday, -7); renderAttendancePage(); break;
			case "att-next": ui.attendanceWeekSunday = addDaysIso(ui.attendanceWeekSunday, 7); renderAttendancePage(); break;
			case "att-today": ui.attendanceWeekSunday = currentSundayISO(); renderAttendancePage(); break;
			case "att-cell":
				setLessonMark(el.getAttribute("data-student"), ui.attendanceWeekSunday, el.getAttribute("data-lesson"), nextMark(markForLesson(findStudent(el.getAttribute("data-student")), ui.attendanceWeekSunday, el.getAttribute("data-lesson"))));
				renderAttendanceTable();
				break;
			case "att-mark-all-present":
				activeStudents().forEach(function (s) { DB.school.lessons.forEach(function (l) { setLessonMark(s.id, ui.attendanceWeekSunday, l, "P"); }); });
				renderAttendanceTable();
				break;
			case "att-mark-all-absent":
				activeStudents().forEach(function (s) { DB.school.lessons.forEach(function (l) { setLessonMark(s.id, ui.attendanceWeekSunday, l, "A"); }); });
				renderAttendanceTable();
				break;
			case "att-complete": markWeekComplete(); break;
			case "att-open-week": ui.attendanceWeekSunday = el.getAttribute("data-week"); renderAttendancePage(); break;

			case "pay-prev": ui.paymentMonth = addMonthsToKey(ui.paymentMonth, -1); renderPaymentsPage(); break;
			case "pay-next": ui.paymentMonth = addMonthsToKey(ui.paymentMonth, 1); renderPaymentsPage(); break;
			case "pay-today": ui.paymentMonth = currentMonthKey(); renderPaymentsPage(); break;
			case "pay-reminder": openReminderModal(); break;
			case "reminder-copy": copyText($("#wsmf-rem-text") ? $("#wsmf-rem-text").value : "", "Reminder text copied."); break;

			case "prog-add-note": openProgressNoteModal(targetStudentForAction(id)); break;
			case "note-save": saveProgressNote(id); break;
			case "prog-add-contact": openContactModal(targetStudentForAction(id)); break;
			case "contact-save": saveTeacherContact(id); break;
			case "prog-add-surah": openSurahModal(targetStudentForAction(id)); break;
			case "surah-save": saveSurah(id); break;
			case "prog-surah-delete": (function () {
				var s = findStudent(id);
				if (!s) return;
				var name = el.getAttribute("data-name");
				s.quranMemorization.surahs = s.quranMemorization.surahs.filter(function (su) { return su.name !== name; });
				persistSoon();
				renderAll();
			})(); break;

			case "comm-add-group": openGroupMessageModal(); break;
			case "group-save": saveGroupMessage(); break;
			case "comm-group-copy": (function () {
				var m = null;
				DB.schoolLogs.groupMessages.forEach(function (g) { if (g.id === id) m = g; });
				if (m) copyText(m.text, "Group message copied.");
			})(); break;
			case "comm-group-delete": DB.schoolLogs.groupMessages = DB.schoolLogs.groupMessages.filter(function (g) { return g.id !== id; }); persistSoon(); renderCommunicationPage(); break;
			case "comm-add-on-one": openOneOnOneModal(targetStudentForAction(id)); break;
			case "onone-save": saveOneOnOne(id); break;
			case "comm-log-call": openAbsenceCallModal(targetStudentForAction(id)); break;
			case "call-save": saveAbsenceCall(id); break;
			case "comm-add-suggestion": openSuggestionModal(); break;
			case "sugg-save": saveSuggestion(); break;
			case "comm-sugg-delete": DB.schoolLogs.suggestionsComplaints = DB.schoolLogs.suggestionsComplaints.filter(function (r) { return r.id !== id; }); persistSoon(); renderCommunicationPage(); break;
			case "comm-absence-prev": ui.attendanceWeekSunday = addDaysIso(ui.attendanceWeekSunday, -7); renderCommunicationPage(); break;
			case "comm-absence-next": ui.attendanceWeekSunday = addDaysIso(ui.attendanceWeekSunday, 7); renderCommunicationPage(); break;
			case "comm-absence-today": ui.attendanceWeekSunday = currentSundayISO(); renderCommunicationPage(); break;

			case "rep-prev":
				if (ui.reportKind === "monthly") ui.reportMonth = addMonthsToKey(ui.reportMonth, -1);
				else ui.reportWeekSunday = addDaysIso(ui.reportWeekSunday, -7);
				renderReportsPage();
				break;
			case "rep-next":
				if (ui.reportKind === "monthly") ui.reportMonth = addMonthsToKey(ui.reportMonth, 1);
				else ui.reportWeekSunday = addDaysIso(ui.reportWeekSunday, 7);
				renderReportsPage();
				break;
			case "rep-today":
				if (ui.reportKind === "monthly") ui.reportMonth = currentMonthKey();
				else ui.reportWeekSunday = currentSundayISO();
				renderReportsPage();
				break;
			case "rep-copy": copyText(currentReportText(), "Report text copied."); break;
			case "rep-download": downloadReportText(); break;
			case "rep-pdf": printReportPdf(); break;

			case "set-groups": openListEditorModal("groups"); break;
			case "set-lessons": openListEditorModal("lessons"); break;
			case "list-save": saveListEditor(el.getAttribute("data-kind")); break;
			case "bracket-add": addPaymentBracket(); break;
			case "bracket-delete": deletePaymentBracket(id); break;
			case "pay-add-debt": openAddDebtModal(); break;
			case "debt-save": saveDebtFromModal(); break;
			case "debt-paid": markDebtPaid(id); break;
			case "debt-delete": deleteDebtEntry(id); break;
			case "doc-upload": uploadStudentDocument(id, el.getAttribute("data-kind") || "other"); break;
			case "doc-open": openStudentDocument(id, el.getAttribute("data-doc")); break;
			case "doc-remove": removeStudentDocument(id, el.getAttribute("data-doc")); break;
			case "export-data": exportAllData(); break;

			case "drawer-close": closeDrawer(); break;
			case "drawer-tab": ui.drawerTab = el.getAttribute("data-tab"); renderDrawer(); break;
			case "drawer-pay-add": addDrawerPayment(); break;
			case "drawer-pay-delete": removeStudentPaymentEntry(id); break;
			case "drawer-pay-message": openPaymentMessageModal(ui.drawerStudentId, id); break;
			case "quran-message": openQuranMessageModal(id); break;
			case "msg-copy": copyText($("#wsmf-msg-text") ? $("#wsmf-msg-text").value : "", "Message copied."); break;
			case "msg-image": copyMessageAsImage(); break;
			case "msg-email": sendActiveMessageEmail(); break;
		}
	});

	document.addEventListener("change", function (e) {
		var el = e.target.closest("[data-act]");
		if (!el) return;
		var act = el.getAttribute("data-act");
		var id = el.getAttribute("data-id");
		switch (act) {
			case "prog-student": ui.progressStudentId = el.value; renderProgressGrid(); renderFlagStrip(); break;
			case "comm-on-one-student": ui.commOnOneStudentId = el.value; renderCommunicationPage(); break;
			case "pay-status": setPaymentStatus(id, ui.paymentMonth, el.value); afterPaymentsChanged(); break;
			case "drawer-pay-check": (function () {
				var owner = findPaymentEntryOwner(id);
				if (!owner) return;
				if (el.checked) { owner.entry.status = "paid"; owner.entry.paidDate = owner.entry.paidDate || todayISO(); }
				else { owner.entry.status = "unpaid"; owner.entry.paidDate = ""; }
				persistSoon();
				renderDrawer();
				renderNavBadges();
			})(); break;
			case "drawer-pay-status": (function () {
				var owner = findPaymentEntryOwner(id);
				if (!owner) return;
				owner.entry.status = el.value;
				if (el.value === "paid") { if (!owner.entry.paidDate) owner.entry.paidDate = todayISO(); }
				else owner.entry.paidDate = "";
				persistSoon();
				renderDrawer();
				renderNavBadges();
			})(); break;
			case "prog-surah-status": (function () {
				var s = findStudent(id);
				if (!s) return;
				var name = el.getAttribute("data-name");
				s.quranMemorization.surahs.forEach(function (su) { if (su.name === name) su.status = el.value; });
				persistSoon();
			})(); break;
			case "comm-sugg-status": (function () {
				DB.schoolLogs.suggestionsComplaints.forEach(function (r) { if (r.id === id) r.status = el.value; });
				persistSoon();
			})(); break;
		}
	});

	document.addEventListener("input", function (e) {
		var el = e.target;
		if (el.matches("#wsm-student-search")) { ui.studentSearch = el.value; renderStudentList(); return; }

		if (el.hasAttribute("data-bind")) {
			var path = el.getAttribute("data-bind");
			var value = el.value.trim();
			if (path === "school.name") { DB.school.name = value || "Weekend School"; updateSchoolName(); }
			else if (path === "school.currency") DB.school.currency = value || "CAD";
			else if (path === "school.paymentDueDay") DB.school.paymentDueDay = Number(value) || 1;
			else if (path === "school.requiredAttendanceChecksPerDay") DB.school.requiredAttendanceChecksPerDay = Number(value) || 1;
			persistSoon();
			return;
		}

		if (!el.hasAttribute("data-act")) return;
		var act = el.getAttribute("data-act");
		var id = el.getAttribute("data-id");
		switch (act) {
			case "pay-amount": setPaymentAmount(id, ui.paymentMonth, Number(el.value)); afterPaymentsChanged(); break;
			case "pay-note": setPaymentNote(id, ui.paymentMonth, el.value); break;
			case "drawer-pay-amount": (function () {
				var owner = findPaymentEntryOwner(id);
				if (!owner) return;
				owner.entry.amount = Number(el.value) || 0;
				persistSoon();
			})(); break;
			case "pay-duedate": (function () {
				var s = findStudent(id);
				if (!s) return;
				var entry = entryForMonth(s, ui.paymentMonth);
				if (!entry) { entry = newPaymentEntry(ui.paymentMonth, bracketFeeOf(s)); s.paymentEntries.push(entry); }
				entry.dueDate = el.value;
				persistSoon();
			})(); break;
			case "bracket-name": (function () {
				DB.school.paymentBrackets.forEach(function (b) { if (b.id === id) b.name = el.value; });
				persistSoon();
			})(); break;
			case "bracket-fee": (function () {
				DB.school.paymentBrackets.forEach(function (b) { if (b.id === id) b.monthlyFee = Number(el.value) || 0; });
				persistSoon();
			})(); break;
			case "debt-amount": (function () {
				var owner = findPaymentEntryOwner(id);
				if (!owner) return;
				owner.entry.amount = Number(el.value) || 0;
				persistSoon();
			})(); break;
			case "debt-due": (function () {
				var owner = findPaymentEntryOwner(id);
				if (!owner) return;
				owner.entry.dueDate = el.value;
				persistSoon();
			})(); break;
			case "prog-quran-level": (function () {
				var s = findStudent(id);
				if (!s) return;
				if (s.quranReading.currentLevel !== el.value) {
					if (s.quranReading.currentLevel) s.quranReading.levelHistory.push({ date: todayISO(), level: s.quranReading.currentLevel });
					s.quranReading.currentLevel = el.value;
				}
				persistSoon();
			})(); break;
			case "prog-surah-portions": (function () {
				var s = findStudent(id);
				if (!s) return;
				var name = el.getAttribute("data-name");
				s.quranMemorization.surahs.forEach(function (su) { if (su.name === name) su.portions = el.value; });
				persistSoon();
			})(); break;
			case "prog-hifz-target": (function () {
				var s = findStudent(id);
				if (!s) return;
				s.quranMemorization.nextTarget = el.value;
				persistSoon();
			})(); break;
			case "comm-sugg-followup": (function () {
				DB.schoolLogs.suggestionsComplaints.forEach(function (r) { if (r.id === id) r.followUp = el.value; });
				persistSoon();
			})(); break;
		}
	});

	/* ═══════════════════════════════════════════
	   ENTRY POINT
	   ═══════════════════════════════════════════ */
	function seedFromParams() {
		if (DB.school.seeded || DB.students.length) return;
		var name = tool.param("schoolName", "");
		if (name) DB.school.name = name;
		var currency = tool.param("currency", "");
		if (currency) DB.school.currency = currency;
		DB.school.seeded = true;
	}

	tool.onReady(function (value, fields) {
		DB = normalizeDatabase(value);
		if (DB.ui && DB.ui.activePage) ui.activePage = DB.ui.activePage;
		seedFromParams();

		_user = getUserSafe();
		refreshUser();

		switchPage(ui.activePage);
		applyLockState();

		tool.onValueChange(function (v) {
			if (_dirty) return;
			DB = normalizeDatabase(v);
			if (DB.ui && DB.ui.activePage) ui.activePage = DB.ui.activePage;
			renderAll();
		});
		tool.onReadonlyChange(function (ro) { _readOnly = !!ro; applyLockState(); });
		tool.onUserChange(function (u) {
			if (u) { _user = u; _noIdentity = false; }
			else if (!hasUserApi()) { _noIdentity = true; }
			applyLockState();
		});

		window.addEventListener("pagehide", flushPendingSave);
		window.addEventListener("beforeunload", flushPendingSave);
		document.addEventListener("visibilitychange", function () {
			if (document.visibilityState === "hidden") flushPendingSave();
		});

		tool.declareOutput({
			type: "object",
			properties: {
				version: { type: "number" },
				school: { type: "object" },
				students: { type: "array", items: { type: "object" } },
				attendanceWeeks: { type: "object" },
				schoolLogs: { type: "object" },
				ui: { type: "object" }
			}
		});

		tool.declareParams([
			{ name: "schoolName", label: "School Name", type: "text", default: "Weekend School", severity: "optional", hint: "The name shown in the sidebar and reports." },
			{ name: "currency", label: "Currency", type: "text", default: "CAD", severity: "optional", hint: "Currency code shown next to payment amounts." },
			{ name: "paymentDueDay", label: "Payment Due Day", type: "number", default: "1", severity: "optional", hint: "Day of the month when school fees are due." },
			{ name: "defaultLanguage", label: "Default Language", type: "select", default: "en", severity: "optional", hint: "Default language for group messages and reminders.", options: ["en", "tr"] },
			{ name: "allowUpload", label: "Allow Upload", type: "toggle", default: "yes", severity: "goodToHave", hint: "Must be 'yes' in the field settings so teachers can upload photo consent and emergency info forms to student files." },
			{ name: "allowFileContent", label: "Allow File Content", type: "toggle", default: "yes", severity: "goodToHave", hint: "Used by the CMS when extracting text from uploaded documents. Set to 'yes'." },
			{ name: "allowSendEmail", label: "Allow Send Email", type: "toggle", default: "yes", severity: "goodToHave", hint: "Must be 'yes' in the field settings so teachers can email payment reminders and Quran progress updates to parents." }
		]);

		persistNow();
	});

})();
