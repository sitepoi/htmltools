/* Focused QA for the question-set picker and combinations. */
'use strict';

const fs = require('fs');
const path = require('path');
const PORT = 9222;
const BUILD = '2026-11-07-3';
const SHOT_DIR = path.join(__dirname, 'qa-shots');
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
			'return {' +
				'build: get("#cp-build-badge"),' +
				'chipLabel: get("#cp-profile-chip-value"),' +
				'chipSub: get("#cp-profile-chip-sub"),' +
				'chipTitle: get(".cp-profile-chip-label"),' +
				'packCount: document.querySelectorAll("[data-profile-toggle]").length,' +
				'checkedPacks: Array.prototype.slice.call(document.querySelectorAll("[data-profile-toggle]")).filter(function (el) { return el.checked; }).map(function (el) { return el.getAttribute("data-profile-toggle"); }),' +
				'packLabels: Array.prototype.slice.call(document.querySelectorAll(".cp-pack-name")).map(function (el) { return (el.textContent || "").trim(); }),' +
				'sections: Array.prototype.slice.call(document.querySelectorAll(".cp-section")).map(function (el) { return el.getAttribute("data-section-id"); }),' +
				'nav: Array.prototype.slice.call(document.querySelectorAll("#cp-nav [data-nav]")).map(function (el) { return el.getAttribute("data-nav"); }),' +
				'keys: value && Array.isArray(value.profileKeys) ? value.profileKeys : (value && value.profileKey ? [value.profileKey] : []),' +
				'legacyKey: value ? value.profileKey : "",' +
				'type: value ? value.customerType : "",' +
				'focus: value ? value.focus : [],' +
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
	await send('Page.navigate', { url: 'http://127.0.0.1:8765/test-harness.html?sample=company&bare=1' });
	await waitFor('!!document.querySelector("#cp-build-badge") && document.querySelector("#cp-build-badge").textContent.indexOf(' + q(BUILD) + ') > -1 && document.querySelectorAll("[data-profile-toggle]").length === 12', 'boot', 12000);
	await sleep(250);

	let s = await state();
	check('Build badge is current', s.build.indexOf(BUILD) > -1, s.build);
	check('Company sample starts with one selected set', s.keys.length === 1 && s.keys[0] === 'company-account', JSON.stringify(s.keys));
	check('Picker lists all 12 question sets', s.packCount === 12, s.packCount);
	check('Chip label says Question sets', s.chipTitle === 'Question sets', s.chipTitle);
	check('One set keeps the 10-section profile', s.sections.length === 10, s.sections.length);
	await screenshot('question-set-picker');

	await click('[data-profile-toggle="software-discovery"]');
	await sleep(250);
	s = await state();
	check('Second set adds its sections', s.keys.length === 2 && s.keys.indexOf('software-discovery') > -1, JSON.stringify(s.keys));
	check('Combination has 12 unique sections', s.sections.length === 12, s.sections.length);
	check('Combination chip says 2 question sets', s.chipLabel.indexOf('2 question sets') > -1, s.chipLabel);
	check('Technical infrastructure appears once', s.sections.filter(function (id) { return id.indexOf('technical-infrastructure') > -1; }).length === 1, JSON.stringify(s.sections));
	check('Software tools appears once', s.sections.filter(function (id) { return id.indexOf('software-tools') > -1; }).length === 1, JSON.stringify(s.sections));

	await click('[data-profile-toggle="support-sla"]');
	await sleep(250);
	s = await state();
	check('Third set adds support and SLA', s.keys.length === 3 && s.keys.indexOf('support-sla') > -1, JSON.stringify(s.keys));
	check('Three-set combination has 13 unique sections', s.sections.length === 13, s.sections.length);
	check('Chip reports the combination size', s.chipLabel.indexOf('3 question sets') > -1, s.chipLabel);
	check('Chip sub reports combined sections', s.chipSub.indexOf('13 sections') > -1, s.chipSub);
	check('No duplicate section ids', new Set(s.sections).size === s.sections.length, JSON.stringify(s.sections));
	check('Exactly three checkboxes are selected', s.checkedPacks.length === 3, JSON.stringify(s.checkedPacks));
	check('Legacy profileKey keeps the first set', s.legacyKey === 'company-account', s.legacyKey);
	await screenshot('question-set-combination');

	await click('[data-profile-toggle="support-sla"]');
	await sleep(250);
	s = await state();
	check('Removing a set drops its unique section', s.keys.length === 2 && s.sections.length === 12, s.keys.length + ' / ' + s.sections.length);
	await click('[data-profile-toggle="support-sla"]');
	await sleep(250);

	await click('[data-type="person"]');
	await sleep(300);
	s = await state();
	check('Type switch keeps all three sets', s.type === 'person' && s.keys.length === 3, s.type + ' / ' + JSON.stringify(s.keys));
	check('Type switch keeps all 13 sections', s.sections.length === 13, s.sections.length);
	check('All sets remain available after type switch', s.packCount === 12 && s.checkedPacks.length === 3, s.packCount + ' / ' + s.checkedPacks.length);
	check('Type switch does not change the combination chip', s.chipLabel.indexOf('3 question sets') > -1, s.chipLabel);

	await click('[data-pack-clear]');
	await sleep(250);
	s = await state();
	check('Clear removes every set', s.keys.length === 0 && s.legacyKey === '', JSON.stringify(s.keys));
	check('Clear leaves only basic sections', s.sections.length === 3, s.sections.length);
	check('Clear clears focus', Array.isArray(s.focus) && s.focus.length === 0, JSON.stringify(s.focus));
	check('Clear leaves all sets available', s.packCount === 12 && s.checkedPacks.length === 0, s.packCount);

	await click('[data-profile-toggle="company-account"]');
	await sleep(250);
	s = await state();
	check('Single set restores the 10-section profile', s.keys.length === 1 && s.sections.length === 10, s.keys.length + ' / ' + s.sections.length);

	await click('[data-profile-toggle="support-sla"]');
	await sleep(250);
	await click('#cp-manage-profiles');
	await waitFor('!!document.querySelector("#cp-modal-overlay.open")', 'library for use only');
	await sleep(150);
	await click('[data-profile-use="company-account"]');
	await waitFor('!document.querySelector("#cp-modal-overlay.open")', 'library close after use only');
	await sleep(250);
	s = await state();
	check('Use only collapses a combination', s.keys.length === 1 && s.keys[0] === 'company-account' && s.sections.length === 10, JSON.stringify(s.keys) + ' / ' + s.sections.length);

	await click('#cp-manage-profiles');
	await waitFor('!!document.querySelector("#cp-modal-overlay.open")', 'library');
	await sleep(150);
	const library = await evaluate('(() => ({ title: (document.querySelector("#cp-modal-title") || {}).textContent || "", rows: document.querySelectorAll(".cp-profile-row").length, first: (document.querySelector(".cp-profile-row .cp-profile-name") || {}).textContent || "", active: document.querySelectorAll(".cp-profile-row.is-active").length, oldTags: document.querySelectorAll(".cp-profile-tag.is-vertical").length, json: (document.querySelector("#cp-profiles-json") || {}).textContent || "" }))()');
	check('Library title says Question set library', library.title === 'Question set library', library.title);
	check('Library lists all 12 sets', library.rows === 12, library.rows);
	check('Selected set is listed first', library.first.indexOf('B2B sales account') > -1, library.first);
	check('Library shows the selected state', library.active === 1, library.active);
	check('Library has no type or vertical tags', library.oldTags === 0, library.oldTags);
	check('Library footer says Custom question sets', library.json.indexOf('Custom question sets') > -1, library.json);
	await screenshot('question-set-library');
	await click('#cp-profiles-close');

	await evaluate('window.tool._setReadOnly(true); true');
	await sleep(300);
	s = await state();
	const locked = await evaluate('(() => ({ checks: document.querySelectorAll("[data-profile-toggle]:disabled").length, addButtons: document.querySelectorAll("[data-add-row]").length, manageDisabled: document.querySelector("#cp-manage-profiles").disabled }))()');
	check('Read-only disables the picker', locked.checks === 12, locked.checks);
	check('Read-only still allows the library', locked.manageDisabled === false, locked.manageDisabled);

	await evaluate('window.tool._setReadOnly(false); true');
	await sleep(200);
	await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
	await sleep(250);
	const mobile = await state();
	check('No horizontal overflow at 390px', mobile.overflow <= 1, mobile.overflow);
	check('No uncaught runtime errors', errors.length === 0, errors.join(' | '));

	console.log('\n===== QUESTION SET QA =====');
	console.log('Checks: ' + results.length + ' | Passed: ' + results.filter(function (item) { return item.ok; }).length + ' | Failed: ' + results.filter(function (item) { return !item.ok; }).length);
	console.log('Screenshots: ' + SHOT_DIR);
	socket.close();
	if (results.some(function (item) { return !item.ok; })) process.exit(1);
}

main().catch(function (error) {
	console.error(error.stack || error.message || error);
	process.exit(1);
});
