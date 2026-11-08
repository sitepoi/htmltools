/* Load real preset files through the tool parameter and verify they boot. */
'use strict';
const fs = require('fs');
const path = require('path');

const PORT = 9222;
const BUILD = '2026-11-07-3';
const PRESETS = path.join(__dirname, '..', 'profiles');

function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
function q(value) { return JSON.stringify(value); }

async function main() {
	const targets = await (await fetch('http://127.0.0.1:' + PORT + '/json')).json();
	const page = targets.find(function (target) { return target.type === 'page' && target.url.indexOf('test-harness.html') > -1; }) || targets.find(function (target) { return target.type === 'page' && target.url.indexOf('http://127.0.0.1') === 0; });
	if (!page) throw new Error('No local page target found.');
	const socket = new WebSocket(page.webSocketDebuggerUrl);
	const pending = new Map();
	let nextId = 1;
	let exceptions = [];
	let errors = [];
	socket.onmessage = function (event) {
		const message = JSON.parse(event.data);
		if (message.id && pending.has(message.id)) {
			const handlers = pending.get(message.id); pending.delete(message.id);
			if (message.error) handlers.reject(new Error(message.error.message)); else handlers.resolve(message.result);
			return;
		}
		if (message.method === 'Runtime.exceptionThrown') {
			const details = message.params.exceptionDetails;
			exceptions.push((details.text || 'Exception') + ' ' + ((details.exception && details.exception.description) || ''));
		}
		if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push((message.params.args || []).map(function (arg) { return arg.value !== undefined ? String(arg.value) : (arg.description || ''); }).join(' '));
		if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry.text + ' ' + (message.params.entry.url || ''));
	};
	await new Promise(function (resolve, reject) { socket.onopen = resolve; socket.onerror = reject; });
	function send(method, params) {
		const id = nextId++;
		return new Promise(function (resolve, reject) { pending.set(id, { resolve: resolve, reject: reject }); socket.send(JSON.stringify({ id: id, method: method, params: params || {} })); });
	}
	async function evaluate(expression) {
		const result = await send('Runtime.evaluate', { expression: expression, returnByValue: true, awaitPromise: true, userGesture: true });
		if (result.exceptionDetails) throw new Error((result.exceptionDetails.text || 'Evaluation failed') + ' ' + ((result.exceptionDetails.exception && result.exceptionDetails.exception.description) || ''));
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
	async function click(selector) { return evaluate('(() => { const el = document.querySelector(' + q(selector) + '); if (!el) throw new Error("Missing: " + ' + q(selector) + '); el.click(); return true; })()'); }
	async function setInput(selector, value) { return evaluate('(() => { const el = document.querySelector(' + q(selector) + '); if (!el) throw new Error("Missing: " + ' + q(selector) + '); el.focus(); el.value = ' + q(value) + '; el.dispatchEvent(new Event("input", { bubbles: true })); return true; })()'); }
	async function inspect() {
		return evaluate('(() => ({ appTitle: ((document.querySelector(".cp-app-title") || {}).textContent || "").trim(), segments: document.querySelectorAll("[data-segment]").length, segmentPressed: Array.prototype.slice.call(document.querySelectorAll("[data-segment][aria-pressed=\\"true\\"]")).map(function (el) { return el.getAttribute("data-segment"); }), picker: !!document.querySelector(".cp-pack-picker"), manage: !!document.querySelector("#cp-manage-profiles") && !document.querySelector("#cp-manage-profiles").hidden, value: window.tool && window.tool._getValue ? window.tool._getValue() : null, fields: Array.prototype.slice.call(document.querySelectorAll("[data-field]")).map(function (el) { return el.getAttribute("data-field"); }), nav: document.querySelectorAll("#cp-nav [data-nav]").length }))()');
	}
	let passed = 0;
	let failed = 0;
	function check(label, condition, detail) {
		if (condition) { passed++; console.log('ok    ' + label); }
		else { failed++; console.log('FAIL  ' + label + ' :: ' + (detail === undefined ? '' : detail)); }
	}

	await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable'); await send('Network.enable');
	await send('Network.setCacheDisabled', { cacheDisabled: true });
	await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

	const cases = [
		{ file: 'tutor-business.json', title: 'Tutor Profiles', defaultSegment: 'student', fixed: true, field: 'tutorSubject', segmentCount: 4 },
		{ file: 'law-firm.json', title: 'Legal Client Profiles', defaultSegment: 'individual-client', fixed: true, field: 'legalMatterType', segmentCount: 3 },
		{ file: 'therapy-practice.json', title: 'Therapy Practice Profiles', defaultSegment: 'client', fixed: true, field: 'therapyPreferredLanguage', segmentCount: 3 },
		{ file: 'light-crm.json', title: 'Light CRM Profiles', defaultSegment: 'person', fixed: false, field: 'core_firstName', segmentCount: 3 },
		{ file: 'template-custom-vertical.json', title: 'My Vertical Profiles', defaultSegment: 'primary', fixed: true, field: 'primaryCategory', segmentCount: 0 }
	];

	for (const testCase of cases) {
		exceptions = [];
		errors = [];
		const raw = fs.readFileSync(path.join(PRESETS, testCase.file), 'utf8');
		const config = JSON.parse(raw);
		const url = 'http://127.0.0.1:8765/test-harness.html?sample=person&bare=1&profileConfig=' + encodeURIComponent(raw);
		await evaluate('localStorage.clear(); true');
		await send('Page.navigate', { url: url });
		await waitFor('location.search.indexOf("profileConfig") > -1 && !!document.querySelector("#cp-build-badge") && document.querySelector("#cp-build-badge").textContent.indexOf(' + q(BUILD) + ') > -1 && !!document.querySelector(".cp-app-title")', testCase.file + ' boot');
		await sleep(250);
		await setInput('[data-field="core_firstName"]', 'Maya');
		await sleep(700);
		const state = await inspect();
		check(testCase.file + ' title', state.appTitle === testCase.title, state.appTitle);
		check(testCase.file + ' segment count', state.segments === testCase.segmentCount, state.segments);
		if (testCase.segmentCount > 1) check(testCase.file + ' default segment', state.segmentPressed.indexOf(testCase.defaultSegment) > -1, JSON.stringify(state.segmentPressed));
		check(testCase.file + ' record key', state.value && state.value.segmentKey === testCase.defaultSegment, state.value && state.value.segmentKey);
		check(testCase.file + ' form field rendered', state.fields.indexOf(testCase.field) > -1, JSON.stringify(state.fields.slice(0, 12)));
		if (testCase.fixed) check(testCase.file + ' library hidden', state.picker === false && state.manage === false, JSON.stringify({ picker: state.picker, manage: state.manage }));
		else check(testCase.file + ' picker available', state.picker === true, state.picker);
		check(testCase.file + ' no exceptions', exceptions.length === 0, exceptions.join(' | '));
		check(testCase.file + ' no console errors', errors.length === 0, errors.join(' | '));
	}
	console.log('\n===== PRESET QA SUMMARY =====');
	console.log('Checks: ' + (passed + failed) + ' | Passed: ' + passed + ' | Failed: ' + failed);
	if (failed) process.exitCode = 1;
	socket.close();
}
main().catch(function (error) { console.error('QA RUNNER ERROR: ' + error.stack); process.exitCode = 1; });
