/* Focused QA for the applicationType catalog shortcut and legacy profile-key migration. */
'use strict';

const fs = require('fs');
const path = require('path');
const PORT = 9222;
const BUILD = '2026-11-07-3';
const SHOT_DIR = path.join(__dirname, 'qa-shots');
const CATALOG = ['customer-basics', 'software-discovery', 'software-implementation', 'saas-subscription', 'support-sla', 'procurement-onboarding', 'renewal-expansion', 'stakeholders-relationship'];
fs.mkdirSync(SHOT_DIR, { recursive: true });

function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
function q(value) { return JSON.stringify(value); }

async function main() {
	const response = await fetch('http://127.0.0.1:' + PORT + '/json');
	const targets = await response.json();
	const page = targets.find(function (target) { return target.type === 'page' && target.url.indexOf('test-harness.html') > -1; }) || targets.find(function (target) { return target.type === 'page' && target.url.indexOf('http://127.0.0.1') === 0; });
	if (!page) throw new Error('No local page target.');
	const socket = new WebSocket(page.webSocketDebuggerUrl);
	const pending = new Map();
	const errors = [];
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
		if (message.method === 'Runtime.exceptionThrown') {
			errors.push((message.params.exceptionDetails.text || 'Exception') + ' ' + ((message.params.exceptionDetails.exception && message.params.exceptionDetails.exception.description) || ''));
		}
		if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry.text);
	};
	await new Promise(function (resolve, reject) { socket.onopen = resolve; socket.onerror = function () { reject(new Error('WebSocket error')); }; });
	function send(method, params) {
		const id = nextId++;
		return new Promise(function (resolve, reject) {
			pending.set(id, { resolve: resolve, reject: reject });
			socket.send(JSON.stringify({ id: id, method: method, params: params || {} }));
		});
	}
	async function evaluate(expression) {
		const result = await send('Runtime.evaluate', { expression: expression, returnByValue: true, awaitPromise: true, userGesture: true });
		if (result.exceptionDetails) throw new Error((result.exceptionDetails.text || 'Eval failed') + ' ' + ((result.exceptionDetails.exception && result.exceptionDetails.exception.description) || ''));
		return result.result ? result.result.value : undefined;
	}
	async function waitFor(expression, label, timeout) {
		const limit = Date.now() + (timeout || 8000);
		let last = null;
		while (Date.now() < limit) {
			try { if (await evaluate(expression)) return; } catch (error) { last = error; }
			await sleep(120);
		}
		throw new Error('Timed out waiting for ' + label + (last ? ' (' + last.message + ')' : ''));
	}
	async function click(selector) {
		await evaluate('(() => { const el = document.querySelector(' + q(selector) + '); if (!el) throw new Error("Missing " + ' + q(selector) + '); el.click(); return true; })()');
	}
	async function screenshot(name) {
		const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true });
		fs.writeFileSync(path.join(SHOT_DIR, name + '.png'), Buffer.from(result.data, 'base64'));
	}
	async function state() {
		return evaluate('(() => {' +
			'const get = (sel) => { const el = document.querySelector(sel); return el ? (el.textContent || "").trim() : ""; };' +
			'const value = window.tool._getValue();' +
			'const packs = Array.prototype.slice.call(document.querySelectorAll("[data-profile-toggle]"));' +
			'return {' +
				'build: get("#cp-build-badge"),' +
				'title: get(".cp-app-title"),' +
				'packLabel: get(".cp-pack-head .cp-label"),' +
				'packCountText: get("#cp-pack-count"),' +
				'libraryLabel: get("#cp-pack-library"),' +
				'packs: packs.map(function (el) { return el.getAttribute("data-profile-toggle"); }),' +
				'checkedPacks: packs.filter(function (el) { return el.checked; }).map(function (el) { return el.getAttribute("data-profile-toggle"); }),' +
				'keys: value && Array.isArray(value.profileKeys) ? value.profileKeys : (value && value.profileKey ? [value.profileKey] : []),' +
				'legacyKey: value ? value.profileKey : "",' +
				'legalName: value && value.values ? value.values.core_legalName : "",' +
				'legalNameInput: (document.querySelector("[data-field=\\"core_legalName\\"]") || {}).value || "",' +

				'sections: Array.prototype.slice.call(document.querySelectorAll(".cp-section")).map(function (el) { return el.getAttribute("data-section-id"); }),' +
				'overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth' +
			'};' +
		'})()');
	}
	const results = [];
	function check(name, ok, detail) {
		results.push({ name: name, ok: !!ok, detail: detail === undefined ? '' : String(detail) });
		console.log((ok ? 'ok    ' : 'FAIL  ') + name + (detail && !ok ? ' :: ' + detail : ''));
	}

	await send('Runtime.enable');
	await send('Page.enable');
	await send('Log.enable');
	await send('Network.enable');
	await send('Network.setCacheDisabled', { cacheDisabled: true });
	await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

	await evaluate('localStorage.clear(); true');
	await send('Page.navigate', { url: 'http://127.0.0.1:8765/test-harness.html?bare=1&applicationType=software-sales' });
	await waitFor('!!document.querySelector("#cp-build-badge") && document.querySelector("#cp-build-badge").textContent.indexOf(' + q(BUILD) + ') > -1 && document.querySelectorAll("[data-profile-toggle]").length === 8', 'software-sales boot', 12000);
	await sleep(300);
	let s = await state();
	check('ApplicationType uses the current build', s.build.indexOf(BUILD) > -1, s.build);
	check('ApplicationType changes the app title', s.title === 'Software Sales Profile', s.title);
	check('ApplicationType relabels the picker', s.packLabel.indexOf('Request profiles') > -1 && s.packLabel.indexOf('Software sales') > -1, s.packLabel);
	check('ApplicationType defaults to software discovery', s.checkedPacks.length === 1 && s.checkedPacks[0] === 'software-discovery', JSON.stringify(s.checkedPacks));
	check('ApplicationType shows exactly the catalog', JSON.stringify(s.packs) === JSON.stringify(CATALOG), JSON.stringify(s.packs));
	check('ApplicationType selects one catalog set', s.checkedPacks.length === 1 && s.checkedPacks[0] === 'software-discovery', JSON.stringify(s.checkedPacks));
	check('ApplicationType count reflects the catalog', s.packCountText === '1 of 8 selected', s.packCountText);
	check('Library link is discoverable', s.libraryLabel === 'All request profiles', s.libraryLabel);
	check('No horizontal overflow with application catalog', s.overflow <= 0, s.overflow);
	await screenshot('application-context-catalog');

	await click('#cp-pack-library');
	await waitFor('!!document.querySelector("#cp-modal-overlay.open")', 'question set library');
	await sleep(150);
	const library = await evaluate('(() => ({ rows: document.querySelectorAll(".cp-profile-row").length, active: document.querySelectorAll(".cp-profile-row.is-active").length, title: (document.querySelector("#cp-modal-title") || {}).textContent || "" }))()');
	check('Library still lists every question set', library.rows === 12, library.rows);
	check('Library marks the catalog default active', library.active === 1, library.active);
	await click('[data-profile-use="company-account"]');
	await waitFor('!document.querySelector("#cp-modal-overlay.open")', 'library close');
	await sleep(300);
	s = await state();
	check('Any question set can be selected from the library', s.keys.length === 1 && s.keys[0] === 'company-account', JSON.stringify(s.keys));
	check('Outside-catalog selection is reported', s.packCountText.indexOf('1 outside') > -1, s.packCountText);
	check('Outside-catalog selection renders its sections', s.sections.some(function (id) { return id.indexOf('buying-process') > -1; }), JSON.stringify(s.sections));
	await screenshot('application-context-outside-catalog');

	const stored = await evaluate('JSON.parse(localStorage.getItem("customerprofile_test_value") || "null")');
	if (!stored) throw new Error('No stored record found before legacy migration.');
	stored.profileKeys = ['company-software'];
	stored.profileKey = 'company-software';
	stored.customerType = 'company';
	stored.values = stored.values || {};
	stored.values.core_legalName = 'Legacy Software Co';
	await evaluate('window.tool.setValue(' + q(stored) + '); true');
	await waitFor('(() => { const el = document.querySelector("[data-profile-toggle=\\"software-discovery\\"]"); return !!el && el.checked; })()', 'legacy key migration', 8000);
	await sleep(300);
	s = await state();
	check('Legacy company-software key migrates', s.checkedPacks.length === 1 && s.checkedPacks[0] === 'software-discovery', JSON.stringify(s.checkedPacks));
	check('Migrated record keeps its values', s.legalName === 'Legacy Software Co', s.legalName);
	check('Migrated record renders the saved value', s.legalNameInput === 'Legacy Software Co', s.legalNameInput);
	check('Migrated record renders software sections', s.sections.some(function (id) { return id.indexOf('software-tools') > -1; }), JSON.stringify(s.sections));
	check('Legacy migration has no console errors', errors.length === 0, errors.join(' | '));
	await screenshot('application-context-legacy-migration');

	await evaluate('localStorage.clear(); true');
	await send('Page.navigate', { url: 'http://127.0.0.1:8765/test-harness.html?sample=person&bare=1&profilePreset=tutor-business&applicationType=software-sales' });
	await waitFor('!!document.querySelector(".cp-app-title") && document.querySelector(".cp-app-title").textContent.trim() === "Tutor Profiles"', 'profileConfig precedence', 12000);
	const precedence = await evaluate('(() => ({ title: (document.querySelector(".cp-app-title") || {}).textContent.trim(), segments: document.querySelectorAll("[data-segment]").length, picker: !!document.querySelector(".cp-pack-picker") }))()');
	check('profileConfig title wins over applicationType', precedence.title === 'Tutor Profiles', precedence.title);
	check('profileConfig segments win over applicationType', precedence.segments === 4, precedence.segments);
	check('Fixed profileConfig hides the application catalog picker', precedence.picker === false, precedence.picker);

	console.log('\n===== APPLICATION CONTEXT QA =====');
	const passed = results.filter(function (result) { return result.ok; }).length;
	console.log('Checks: ' + results.length + ' | Passed: ' + passed + ' | Failed: ' + (results.length - passed));
	console.log('Screenshots: ' + SHOT_DIR);
	socket.close();
	if (passed !== results.length) process.exit(1);
}

main().catch(function (error) {
	console.error(error && error.stack ? error.stack : error);
	process.exit(1);
});
