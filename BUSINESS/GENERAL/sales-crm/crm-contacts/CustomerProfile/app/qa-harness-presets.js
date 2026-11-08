/* QA for the test-harness profile-preset selector. */
'use strict';
const PORT = 9222;
function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
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

	const base = 'http://127.0.0.1:8765/test-harness.html?sample=person&bare=1&profilePreset=';
	await send('Page.navigate', { url: base + 'tutor-business' });
	await waitFor('document.querySelector(".cp-app-title") && document.querySelector(".cp-app-title").textContent.trim() === "Tutor Profiles"', 'tutor preset boot');
	await sleep(250);
	let state = await evaluate('(() => ({ title: (document.querySelector(".cp-app-title") || {}).textContent, selected: (document.getElementById("th-profile-preset") || {}).value, options: document.querySelectorAll("#th-profile-preset option").length, segments: document.querySelectorAll("[data-segment]").length, picker: !!document.querySelector(".cp-pack-picker"), manage: !!document.querySelector("#cp-manage-profiles") && !document.querySelector("#cp-manage-profiles").hidden }))()');
	check('Harness loads tutor preset as profileConfig', state.title === 'Tutor Profiles', state.title);
	check('Harness selector reflects the URL preset', state.selected === 'tutor-business', state.selected);
	check('Harness lists all preset choices', state.options === 10, state.options);
	check('Tutor preset has four segments', state.segments === 4, state.segments);
	check('Tutor preset is a fixed form', state.picker === false && state.manage === false, JSON.stringify({ picker: state.picker, manage: state.manage }));
	await evaluate('localStorage.clear(); true');
	await send('Page.navigate', { url: base + 'light-crm' });
	await waitFor('document.querySelector(".cp-app-title") && document.querySelector(".cp-app-title").textContent.trim() === "Light CRM Profiles"', 'light CRM preset boot');
	await sleep(250);
	state = await evaluate('(() => ({ title: (document.querySelector(".cp-app-title") || {}).textContent, selected: (document.getElementById("th-profile-preset") || {}).value, segments: document.querySelectorAll("[data-segment]").length, picker: !!document.querySelector(".cp-pack-picker") }))()');
	check('Harness switches to another preset', state.title === 'Light CRM Profiles' && state.selected === 'light-crm', JSON.stringify(state));
	check('Selectable preset keeps the picker', state.picker === true, state.picker);
	check('Selectable preset exposes three segments', state.segments === 3, state.segments);
	check('No uncaught exceptions in harness preset flow', exceptions.length === 0, exceptions.join(' | '));
	const errors = logs.filter(function (text) { return text.indexOf('favicon.ico') === -1; });
	check('No console errors in harness preset flow', errors.length === 0, errors.join(' | '));
	console.log('\n===== HARNESS PRESET QA SUMMARY =====');
	console.log('Checks: ' + (passed + failed) + ' | Passed: ' + passed + ' | Failed: ' + failed);
	if (failed) process.exitCode = 1;
	socket.close();
}
main().catch(function (error) { console.error('QA RUNNER ERROR: ' + error.stack); process.exitCode = 1; });
