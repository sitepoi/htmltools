/* QA for the CustomerProfile Profiles documentation page and docs menu.
   Requires a workspace-root HTTP server (default 8766; override DOCS_QA_PORT)
   because the docs pages need the shared _docs/assets folder. */
'use strict';
const fs = require('fs');
const path = require('path');
const PORT = 9222;
const DOCS_PORT = Number(process.env.DOCS_QA_PORT || 8766);
const SHOT_DIR = path.join(__dirname, 'qa-shots');
fs.mkdirSync(SHOT_DIR, { recursive: true });
function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
function q(value) { return JSON.stringify(value); }

async function main() {
	const targets = await (await fetch('http://127.0.0.1:' + PORT + '/json')).json();
	const page = targets.find(function (target) { return target.type === 'page' && target.url.indexOf('http://127.0.0.1') === 0; });
	if (!page) throw new Error('No local page target found.');
	const socket = new WebSocket(page.webSocketDebuggerUrl);
	const pending = new Map();
	const logs = [];
	const exceptions = [];
	let nextId = 1;
	socket.onmessage = function (event) {
		const message = JSON.parse(event.data);
		if (message.id && pending.has(message.id)) {
			const handlers = pending.get(message.id); pending.delete(message.id);
			if (message.error) handlers.reject(new Error(message.error.message)); else handlers.resolve(message.result);
			return;
		}
		if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text || 'Exception');
		if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') logs.push((message.params.args || []).map(function (arg) { return arg.value || arg.description || ''; }).join(' '));
		if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') logs.push(message.params.entry.text);
	};
	await new Promise(function (resolve, reject) { socket.onopen = resolve; socket.onerror = reject; });
	function send(method, params) {
		const id = nextId++;
		return new Promise(function (resolve, reject) { pending.set(id, { resolve: resolve, reject: reject }); socket.send(JSON.stringify({ id: id, method: method, params: params || {} })); });
	}
	async function evaluate(expression) {
		const result = await send('Runtime.evaluate', { expression: expression, returnByValue: true, awaitPromise: true, userGesture: true });
		if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ' ' + ((result.exceptionDetails.exception && result.exceptionDetails.exception.description) || ''));
		return result.result ? result.result.value : undefined;
	}
	async function waitFor(expression, label, timeout) {
		const limit = Date.now() + (timeout || 12000);
		while (Date.now() < limit) {
			try { if (await evaluate(expression)) return true; } catch (error) { }
			await sleep(150);
		}
		throw new Error('Timed out waiting for ' + label);
	}
	let passed = 0, failed = 0;
	function check(label, condition, detail) {
		if (condition) { passed++; console.log('ok    ' + label); }
		else { failed++; console.log('FAIL  ' + label + ' :: ' + (detail === undefined ? '' : detail)); }
	}
	await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable'); await send('Network.enable');
	await send('Network.setCacheDisabled', { cacheDisabled: true });
	await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
	const base = 'http://127.0.0.1:' + DOCS_PORT + '/BUSINESS/GENERAL/sales-crm/crm-contacts/CustomerProfile/docs/';
	await send('Page.navigate', { url: base + 'profiles.html' });
	await waitFor('document.querySelectorAll(".profiles-card").length === 9', 'nine profile cards');
	await sleep(250);
	let state = await evaluate('(() => ({ title: document.title, cards: document.querySelectorAll(".profiles-card").length, copy: document.querySelectorAll("[data-profile-copy]").length, usage: document.querySelectorAll("[data-profile-usage]").length, total: (document.getElementById("profiles-total") || {}).textContent, count: (document.getElementById("profiles-count") || {}).textContent, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }))()');
	check('Profiles page title', state.title.indexOf('Profiles') > -1, state.title);
	check('All nine presets render', state.cards === 9, state.cards);
	check('Every preset has copy and usage controls', state.copy === 9 && state.usage === 9, JSON.stringify(state));
	check('Profiles summary counts presets', state.total === '9', state.total);
	check('Profiles page has no horizontal overflow', state.overflow <= 1, state.overflow);
	await evaluate('document.querySelector("[data-profile-usage=\\"tutor-business\\"]").value = "in-use"; document.querySelector("[data-profile-usage=\\"tutor-business\\"]").dispatchEvent(new Event("change", { bubbles: true })); true');
	await sleep(100);
	state = await evaluate('(() => ({ used: (document.getElementById("profiles-used") || {}).textContent }))()');
	check('Usage reminder updates the summary', state.used === '1', state.used);
	await evaluate('document.getElementById("profiles-mode-filter").value = "selectable"; document.getElementById("profiles-mode-filter").dispatchEvent(new Event("change", { bubbles: true })); true');
	await sleep(100);
	state = await evaluate('(() => ({ cards: document.querySelectorAll(".profiles-card").length, count: (document.getElementById("profiles-count") || {}).textContent }))()');
	check('Mode filter shows only selectable presets', state.cards === 2, state.cards);
	await evaluate('document.getElementById("profiles-mode-filter").value = ""; document.getElementById("profiles-mode-filter").dispatchEvent(new Event("change", { bubbles: true })); document.getElementById("profiles-search").value = "tutor"; document.getElementById("profiles-search").dispatchEvent(new Event("input", { bubbles: true })); true');
	await sleep(100);
	state = await evaluate('(() => ({ cards: document.querySelectorAll(".profiles-card").length, name: (document.querySelector(".profiles-card h2") || {}).textContent }))()');
	check('Search narrows to the tutor preset', state.cards === 1 && state.name.indexOf('Tutor') > -1, JSON.stringify(state));
	const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true });
	fs.writeFileSync(path.join(SHOT_DIR, 'profiles-docs-1280.png'), Buffer.from(shot.data, 'base64'));

	await send('Page.navigate', { url: base + 'index.html?doc=profiles' });
	await waitFor('!!document.querySelector("[data-doc=\\"profiles\\"]")', 'profiles menu item');
	await sleep(700);
	state = await evaluate('(() => ({ menu: !!document.querySelector("[data-doc=\\"profiles\\"]"), active: (document.querySelector("[data-doc=\\"profiles\\"]") || {}).classList ? document.querySelector("[data-doc=\\"profiles\\"]").classList.contains("active") : false, frame: (document.getElementById("docs-frame") || {}).src }))()');
	check('Docs index exposes Profiles menu', state.menu === true, state.menu);
	check('Docs index opens the Profiles document', state.active === true && state.frame.indexOf('profiles.html') > -1, JSON.stringify(state));

	await send('Page.navigate', { url: base + 'ssot.html' });
	await waitFor('!!document.getElementById("sec-profile-usage") && document.querySelectorAll("[data-task-type=\\"profile-usage\\"]").length === 5', 'profile usage SSOT section');
	await sleep(400);
	state = await evaluate('(() => ({ usageRows: (document.querySelectorAll("#sec-profile-usage ~ table")[0] || { querySelectorAll: function () { return []; } }).querySelectorAll("tr").length, tasks: document.querySelectorAll("[data-task-type=\\"profile-usage\\"]").length, decisions: (document.querySelectorAll("#sec-decisions ~ table")[0] || { querySelectorAll: function () { return []; } }).querySelectorAll("tr").length }))()');
	check('SSOT has the profile usage register', state.usageRows >= 10, state.usageRows);
	check('SSOT has profile-usage tasks', state.tasks === 5, state.tasks);
	check('SSOT has profile decisions', state.decisions >= 8, state.decisions);
	check('No uncaught exceptions on docs pages', exceptions.length === 0, exceptions.join(' | '));
	const relevantLogs = logs.filter(function (text) { return text.indexOf('favicon.ico') === -1; });
	check('No console errors on docs pages', relevantLogs.length === 0, relevantLogs.join(' | '));
	console.log('\n===== PROFILES DOCS QA SUMMARY =====');
	console.log('Checks: ' + (passed + failed) + ' | Passed: ' + passed + ' | Failed: ' + failed);
	if (failed) process.exitCode = 1;
	socket.close();
}
main().catch(function (error) { console.error('QA RUNNER ERROR: ' + error.stack); process.exitCode = 1; });
