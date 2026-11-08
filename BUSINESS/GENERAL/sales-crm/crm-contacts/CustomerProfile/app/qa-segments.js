/* Focused QA runner for app-defined profile segments. */
'use strict';
const fs = require('fs');
const path = require('path');

const PORT = 9222;
const SHOT_DIR = path.join(__dirname, 'qa-shots');
const BUILD = '2026-11-07-3';
fs.mkdirSync(SHOT_DIR, { recursive: true });

function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
function q(value) { return JSON.stringify(value); }

async function main() {
	const response = await fetch('http://127.0.0.1:' + PORT + '/json');
	const targets = await response.json();
	const page = targets.find(function (target) { return target.type === 'page' && target.url.indexOf('test-harness.html') > -1; }) || targets.find(function (target) { return target.type === 'page' && target.url.indexOf('http://127.0.0.1') === 0; });
	if (!page) throw new Error('No local page target found.');

	const socket = new WebSocket(page.webSocketDebuggerUrl);
	const pending = new Map();
	const logs = [];
	const exceptions = [];
	let nextId = 1;
	socket.onmessage = function (event) {
		const message = JSON.parse(event.data);
		if (message.id && pending.has(message.id)) {
			const handlers = pending.get(message.id);
			pending.delete(message.id);
			if (message.error) handlers.reject(new Error(message.error.message));
			else handlers.resolve(message.result);
			return;
		}
		if (message.method === 'Runtime.consoleAPICalled') {
			logs.push({ type: message.params.type, text: (message.params.args || []).map(function (arg) { return arg.value !== undefined ? String(arg.value) : (arg.description || arg.type || ''); }).join(' ') });
		}
		if (message.method === 'Runtime.exceptionThrown') {
			const details = message.params.exceptionDetails;
			exceptions.push((details.text || 'Exception') + ' ' + ((details.exception && details.exception.description) || ''));
		}
		if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') logs.push({ type: 'log-error', text: message.params.entry.text + ' ' + (message.params.entry.url || '') });
	};
	await new Promise(function (resolve, reject) { socket.onopen = resolve; socket.onerror = function (error) { reject(new Error('WebSocket error: ' + error.message)); }; });

	function send(method, params) {
		const id = nextId++;
		return new Promise(function (resolve, reject) {
			pending.set(id, { resolve: resolve, reject: reject });
			socket.send(JSON.stringify({ id: id, method: method, params: params || {} }));
		});
	}
	async function evaluate(expression) {
		const result = await send('Runtime.evaluate', { expression: expression, returnByValue: true, awaitPromise: true, userGesture: true });
		if (result.exceptionDetails) throw new Error((result.exceptionDetails.text || 'Evaluation failed') + ' ' + ((result.exceptionDetails.exception && result.exceptionDetails.exception.description) || ''));
		return result.result ? result.result.value : undefined;
	}
	async function waitFor(expression, label, timeout) {
		const limit = Date.now() + (timeout || 8000);
		while (Date.now() < limit) {
			try { if (await evaluate(expression)) return true; } catch (error) { }
			await sleep(150);
		}
		throw new Error('Timed out waiting for ' + label);
	}
	async function click(selector) {
		return evaluate('(() => { const el = document.querySelector(' + q(selector) + '); if (!el) throw new Error("Missing element: " + ' + q(selector) + '); el.click(); return true; })()');
	}
	async function setInput(selector, value) {
		return evaluate('(() => { const el = document.querySelector(' + q(selector) + '); if (!el) throw new Error("Missing input: " + ' + q(selector) + '); el.focus(); el.value = ' + q(value) + '; el.dispatchEvent(new Event("input", { bubbles: true })); return el.value; })()');
	}
	async function screenshot(name) {
		const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true });
		fs.writeFileSync(path.join(SHOT_DIR, name + '.png'), Buffer.from(result.data, 'base64'));
	}
	async function state() {
		return evaluate('(() => {' +
			'const get = (sel) => { const el = document.querySelector(sel); return el ? (el.textContent || "").trim() : ""; };' +
			'const value = window.tool && window.tool._getValue ? window.tool._getValue() : null;' +
			'const visible = (sel) => { const el = document.querySelector(sel); if (!el) return false; return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length); };' +
			'return {' +
				'build: get("#cp-build-badge"), appTitle: get(".cp-app-title"), menuName: get("#cp-menu-name"), menuSub: get("#cp-menu-sub"),' +
				'chipLabel: get(".cp-profile-chip-label"), chipValue: get("#cp-profile-chip-value"), chipSub: get("#cp-profile-chip-sub"),' +
				'segmentKeys: Array.prototype.slice.call(document.querySelectorAll("[data-segment]")).map(function (el) { return el.getAttribute("data-segment"); }),' +
				'segmentNames: Array.prototype.slice.call(document.querySelectorAll("[data-segment] .cp-segment-name")).map(function (el) { return (el.textContent || "").trim(); }),' +
				'segmentPressed: Array.prototype.slice.call(document.querySelectorAll("[data-segment][aria-pressed=\\"true\\"]")).map(function (el) { return el.getAttribute("data-segment"); }),' +
				'typeSwitch: !!document.querySelector(".cp-type-switch"), picker: visible(".cp-pack-picker"), focusGrid: visible("#cp-focus-grid"),' +
				'manageVisible: visible("#cp-manage-profiles"), menuManageHidden: (document.querySelector("#cp-menu-manage") || {}).hidden === true,' +
				'identityTitle: get(".cp-block-title"), identityHint: get(".cp-block-sub"),' +
				'hasJobTitle: !!document.querySelector("[data-field=\\"core_jobTitle\\"]"), hasLegalName: !!document.querySelector("[data-field=\\"core_legalName\\"]"), hasFirstName: !!document.querySelector("[data-field=\\"core_firstName\\"]"),' +
				'hasStatus: !!document.querySelector("[data-field=\\"core_status\\"]"), hasTags: !!document.querySelector("[data-field=\\"core_tags\\"]"),' +
				'hasStudentField: !!document.querySelector("[data-field=\\"tutorSubject\\"]"), hasGuardianField: !!document.querySelector("[data-field=\\"guardianRelation\\"]"), hasSchoolField: !!document.querySelector("[data-field=\\"schoolType\\"]"),' +
				'navLabels: Array.prototype.slice.call(document.querySelectorAll("#cp-nav .cp-nav-label")).map(function (el) { return (el.textContent || "").trim(); }),' +
				'value: value, overflow: { doc: document.documentElement.scrollWidth - document.documentElement.clientWidth, app: (document.querySelector("#app") || {}).scrollWidth - (document.querySelector("#app") || {}).clientWidth }' +
			'};' +
		'})()');
	}
	let passed = 0;
	let failed = 0;
	function check(label, condition, detail) {
		if (condition) { passed++; console.log('ok    ' + label); }
		else { failed++; console.log('FAIL  ' + label + ' :: ' + (detail === undefined ? '' : detail)); }
	}

	await send('Runtime.enable');
	await send('Page.enable');
	await send('Log.enable');
	await send('Network.enable');
	await send('Network.setCacheDisabled', { cacheDisabled: true });
	await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
	await evaluate('localStorage.clear(); true');
	await send('Page.navigate', { url: 'http://127.0.0.1:8765/test-harness.html?sample=person&segments=tutor&bare=1' });
	await waitFor('location.search.indexOf("segments=tutor") > -1 && !!document.querySelector("#cp-build-badge") && document.querySelectorAll("[data-segment]").length === 3 && !!window.tool && !!window.tool._getValue', 'tutor segment boot', 15000);
	await sleep(300);
	await setInput('[data-field="core_firstName"]', 'Maya');
	await sleep(700);

	let current = await state();
	check('Segment config boots with current build', current.build.indexOf(BUILD) > -1, current.build);
	check('Configured app title is used', current.appTitle === 'Tutor Profiles', current.appTitle);
	check('Three predefined customer types are shown', JSON.stringify(current.segmentKeys) === JSON.stringify(['student', 'guardian', 'school']), JSON.stringify(current.segmentKeys));
	check('Segment names are readable', JSON.stringify(current.segmentNames) === JSON.stringify(['Student', 'Guardian', 'School']), JSON.stringify(current.segmentNames));
	check('Student segment is selected by default', JSON.stringify(current.segmentPressed) === JSON.stringify(['student']), JSON.stringify(current.segmentPressed));
	check('Legacy Person/Company toggle is replaced', current.typeSwitch === false, current.typeSwitch);
	check('Fixed form hides the question-set picker', current.picker === false, current.picker);
	check('Fixed form hides focus chips', current.focusGrid === false, current.focusGrid);
	check('Fixed form hides library management', current.manageVisible === false && current.menuManageHidden === true, JSON.stringify({ button: current.manageVisible, menu: current.menuManageHidden }));
	check('Sidebar chip uses the configured profile-type label', current.chipLabel === 'Profile type' && current.chipValue === 'Student', current.chipLabel + ' / ' + current.chipValue);
	check('Sidebar chip uses the segment description', current.chipSub.indexOf('Learner intake') > -1, current.chipSub);
	check('Basic section is named for the student type', current.identityTitle === 'Student identity', current.identityTitle);
	check('Student identity fields are limited to the configured subset', current.hasFirstName === true && current.hasJobTitle === false && current.hasLegalName === false, JSON.stringify({ first: current.hasFirstName, job: current.hasJobTitle, legal: current.hasLegalName }));
	check('Student form hides unrelated admin fields and tags', current.hasStatus === false && current.hasTags === false, JSON.stringify({ status: current.hasStatus, tags: current.hasTags }));
	check('Student-specific section is visible', current.hasStudentField === true, current.hasStudentField);
	check('Student-specific section is in the sidebar', current.navLabels.indexOf('Learning goals') > -1, JSON.stringify(current.navLabels));
	check('Configured core sections can be hidden', current.navLabels.indexOf('People') === -1, JSON.stringify(current.navLabels));
	check('Saved value records the segment', current.value && current.value.segmentKey === 'student' && current.value.profileKeys.length === 1 && current.value.profileKeys[0] === 'student-intake', JSON.stringify(current.value && { segment: current.value.segmentKey, keys: current.value.profileKeys }));
	check('Student identity title appears once', current.navLabels.length >= 5, current.navLabels.length);
	await screenshot('segments-student-1280');

	await click('[data-nav="basic"]');
	await sleep(150);
	await setInput('[data-field="tutorSubject"]', 'Mathematics');
	await sleep(350);

	await click('[data-segment="guardian"]');
	await waitFor('window.tool._getValue().segmentKey === "guardian"', 'guardian segment switch');
	await sleep(250);
	current = await state();
	check('Switching segment updates the record type key', current.value.segmentKey === 'guardian' && current.value.customerType === 'person', JSON.stringify({ segment: current.value.segmentKey, type: current.value.customerType }));
	check('Guardian segment uses its own form', current.hasGuardianField === true && current.hasStudentField === false, JSON.stringify({ guardian: current.hasGuardianField, student: current.hasStudentField }));
	check('Guardian segment updates the chip', current.chipValue === 'Guardian' && current.chipSub.indexOf('Payer') > -1, current.chipValue + ' / ' + current.chipSub);
	check('Guardian identity heading is type-specific', current.identityTitle === 'Guardian identity', current.identityTitle);
	check('Guardian keeps previous answers in the record', current.value.values && current.value.values.tutorSubject === 'Mathematics', current.value.values && current.value.values.tutorSubject);
	await screenshot('segments-guardian-1280');

	await click('[data-segment="school"]');
	await waitFor('window.tool._getValue().segmentKey === "school"', 'school segment switch');
	await sleep(250);
	current = await state();
	check('School segment changes the base identity type', current.value.segmentKey === 'school' && current.value.customerType === 'company', JSON.stringify({ segment: current.value.segmentKey, type: current.value.customerType }));
	check('School form uses company identity fields', current.hasLegalName === true && current.hasFirstName === false, JSON.stringify({ legal: current.hasLegalName, first: current.hasFirstName }));
	check('School form can opt back into admin fields', current.hasStatus === true, current.hasStatus);
	check('School-specific section replaces the student section', current.hasSchoolField === true && current.hasStudentField === false, JSON.stringify({ school: current.hasSchoolField, student: current.hasStudentField }));
	check('School chip and heading follow the segment', current.chipValue === 'School' && current.identityTitle === 'School identity', current.chipValue + ' / ' + current.identityTitle);
	check('School keeps student answers in the record', current.value.values.tutorSubject === 'Mathematics', current.value.values.tutorSubject);
	check('No horizontal overflow at 1280px', current.overflow.doc <= 1 && current.overflow.app <= 1, JSON.stringify(current.overflow));
	await screenshot('segments-school-1280');

	await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
	await sleep(300);
	current = await state();
	check('No horizontal overflow at 390px', current.overflow.doc <= 1, JSON.stringify(current.overflow));
	await screenshot('segments-school-390');

	check('No uncaught exceptions in segment flow', exceptions.length === 0, exceptions.join(' | '));
	const errors = logs.filter(function (log) { return log.type === 'error' || log.type === 'log-error'; });
	check('No console errors in segment flow', errors.length === 0, errors.map(function (log) { return log.text; }).join(' | '));
	console.log('\n===== SEGMENT QA SUMMARY =====');
	console.log('Checks: ' + (passed + failed) + ' | Passed: ' + passed + ' | Failed: ' + failed);
	if (failed) process.exitCode = 1;
	socket.close();
}

main().catch(function (error) {
	console.error('QA RUNNER ERROR: ' + error.stack);
	process.exitCode = 1;
});
