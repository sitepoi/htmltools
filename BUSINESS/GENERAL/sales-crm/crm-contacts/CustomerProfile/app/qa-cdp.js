/* CDP QA runner for CustomerProfile build 2026-11-07-3 */
'use strict';

const fs = require('fs');
const path = require('path');

const PORT = 9222;
const SHOT_DIR = path.join(__dirname, 'qa-shots');
	const BUILD = '2026-11-07-3';
const EXPECTED_COMPANY_NAV = [
	'basic',
	'contact',
	'profile-company-account-company-details',
	'profile-company-account-commercial',
	'profile-company-account-buying-process',
	'profile-company-account-contract',
	'addresses',
	'people',
	'interactions',
	'notes'
];

fs.mkdirSync(SHOT_DIR, { recursive: true });

function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
function q(value) { return JSON.stringify(value); }

async function main() {
	const targetsResponse = await fetch('http://127.0.0.1:' + PORT + '/json');
	const targets = await targetsResponse.json();
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
			const text = (message.params.args || []).map(function (arg) {
				if (arg.value !== undefined) return String(arg.value);
				return arg.description || arg.type || '';
			}).join(' ');
			logs.push({ type: message.params.type, text: text });
		}
		if (message.method === 'Runtime.exceptionThrown') {
			const details = message.params.exceptionDetails;
			exceptions.push((details.text || 'Exception') + ' ' + ((details.exception && details.exception.description) || ''));
		}
		if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
			logs.push({ type: 'log-error', text: message.params.entry.text + ' ' + (message.params.entry.url || '') });
		}
	};

	await new Promise(function (resolve, reject) {
		socket.onopen = resolve;
		socket.onerror = function (error) { reject(new Error('WebSocket error: ' + error.message)); };
	});

	function send(method, params) {
		const id = nextId++;
		return new Promise(function (resolve, reject) {
			pending.set(id, { resolve: resolve, reject: reject });
			socket.send(JSON.stringify({ id: id, method: method, params: params || {} }));
		});
	}

	async function evaluate(expression) {
		const result = await send('Runtime.evaluate', {
			expression: expression,
			returnByValue: true,
			awaitPromise: true,
			userGesture: true
		});
		if (result.exceptionDetails) {
			throw new Error((result.exceptionDetails.text || 'Evaluation failed') + ' ' + ((result.exceptionDetails.exception && result.exceptionDetails.exception.description) || ''));
		}
		return result.result ? result.result.value : undefined;
	}

	async function waitFor(expression, label, timeout) {
		const limit = Date.now() + (timeout || 8000);
		let lastError = null;
		while (Date.now() < limit) {
			try {
				if (await evaluate(expression)) return true;
			} catch (error) {
				lastError = error;
			}
			await sleep(150);
		}
		throw new Error('Timed out waiting for ' + label + (lastError ? (' (' + lastError.message + ')') : ''));
	}

	async function click(selector) {
		return evaluate('(() => { const el = document.querySelector(' + q(selector) + '); if (!el) throw new Error("Missing element: " + ' + q(selector) + '); el.click(); return true; })()');
	}

	async function clickLast(selector) {
		return evaluate('(() => { const els = document.querySelectorAll(' + q(selector) + '); if (!els.length) throw new Error("No elements: " + ' + q(selector) + '); els[els.length - 1].click(); return true; })()');
	}

	async function setInput(selector, value) {
		return evaluate('(() => { const el = document.querySelector(' + q(selector) + '); if (!el) throw new Error("Missing input: " + ' + q(selector) + '); el.focus(); el.value = ' + q(value) + '; el.dispatchEvent(new Event("input", { bubbles: true })); return el.value; })()');
	}

	async function setSelect(selector, value) {
		return evaluate('(() => { const el = document.querySelector(' + q(selector) + '); if (!el) throw new Error("Missing select: " + ' + q(selector) + '); el.value = ' + q(value) + '; el.dispatchEvent(new Event("change", { bubbles: true })); return el.value; })()');
	}

	async function chooseOnly(key) {
		await click('[data-nav="basic"]');
		await sleep(120);
		await click('[data-pack-clear]');
		await sleep(220);
		if (key) {
			await click('[data-profile-toggle="' + key + '"]');
			await sleep(320);
		}
	}


	async function pressEnterOnTag(selector, value) {
		return evaluate('(() => { const el = document.querySelector(' + q(selector) + '); if (!el) throw new Error("Missing tag input: " + ' + q(selector) + '); el.focus(); el.value = ' + q(value) + '; el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })); return true; })()');
	}

	async function screenshot(name) {
		const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true });
		const file = path.join(SHOT_DIR, name + '.png');
		fs.writeFileSync(file, Buffer.from(result.data, 'base64'));
		return file;
	}

	async function getState() {
		return evaluate('(() => {' +
			'const activeEl = document.querySelector(".cp-section.active");' +
			'const navItems = Array.prototype.slice.call(document.querySelectorAll("#cp-nav [data-nav]"));' +
			'const sectionEls = Array.prototype.slice.call(document.querySelectorAll(".cp-section"));' +
			'const get = (sel) => { const el = document.querySelector(sel); return el ? (el.textContent || "").trim() : ""; };' +
			'return {' +
				'build: get("#cp-build-badge"),' +
				'name: get("#cp-person-name-display"),' +
				'navIds: navItems.map(el => el.getAttribute("data-nav")),' +
				'navLabels: Array.prototype.slice.call(document.querySelectorAll("#cp-nav .cp-nav-label")).map(el => (el.textContent || "").trim()),' +
				'active: activeEl ? activeEl.getAttribute("data-section-id") : "",' +
				'sectionIds: sectionEls.map(el => el.getAttribute("data-section-id")),' +
				'sectionStates: sectionEls.map(el => { const state = el.querySelector(".cp-section-state"); return { id: el.getAttribute("data-section-id"), text: state ? (state.textContent || "").trim() : "", className: state ? state.className : "" }; }),' +
				'hiddenNote: get("#cp-hidden-note"),' +
				'profileChip: get("#cp-profile-chip-value"),' +
				'profileSub: get("#cp-profile-chip-sub"),' +
				'completion: get("#cp-completion-pct"),' +
				'saveText: get("#cp-save-text"),' +
				'value: window.tool._getValue(),' +
				'overflow: { doc: document.documentElement.scrollWidth - document.documentElement.clientWidth, app: document.querySelector("#app").scrollWidth - document.querySelector("#app").clientWidth },' +
				'addButtons: document.querySelectorAll("[data-add-row]").length,' +
				'readonly: document.querySelector("#app").classList.contains("cp-readonly"),' +
				'readonlyNoteHidden: document.querySelector("#cp-readonly-note").hidden,' +
				'manageDisabled: document.querySelector("#cp-manage-profiles").disabled,' +
				'scopeDisabled: document.querySelector("#cp-scope-toggle").disabled' +
			'};' +
		'})()');
	}

	const results = [];
	function check(name, ok, detail) {
		results.push({ name: name, ok: !!ok, detail: detail === undefined ? '' : String(detail) });
		if (!ok) console.log('FAIL  ' + name + (detail ? ' :: ' + detail : ''));
		else console.log('ok    ' + name);
	}

	await send('Runtime.enable');
	await send('Page.enable');
	await send('Log.enable');
	await send('Network.enable');
	await send('Network.setCacheDisabled', { cacheDisabled: true });
	await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

	await evaluate('localStorage.clear(); true');
	await send('Page.navigate', { url: 'http://127.0.0.1:8765/test-harness.html?sample=company&bare=1' });
	const companyReady = "location.search.indexOf('sample=company') > -1 && " +
		"!!document.querySelector('#cp-build-badge') && " +
		"document.querySelector('#cp-build-badge').textContent.indexOf(" + q(BUILD) + ") > -1 && " +
		"document.querySelectorAll('#cp-nav [data-nav]').length > 0 && " +
		"!!window.tool && !!window.tool._getValue && !!window.tool._getValue() && " +
		"window.tool._getValue().customerType === 'company'";
	await waitFor(companyReady, 'company sample boot', 12000);
	await sleep(250);

	let state = await getState();
	check('Company sample boots with build badge', state.build.indexOf(BUILD) > -1, state.build);
	check('Company sample uses company-account', state.value && state.value.customerType === 'company' && Array.isArray(state.value.profileKeys) && state.value.profileKeys.indexOf('company-account') > -1, JSON.stringify(state.value && state.value.profileKeys));
	check('Company sample has 10 visible sections', state.sectionIds.length === 10, JSON.stringify(state.sectionIds));
	check('Company nav order is expected', JSON.stringify(state.sectionIds) === JSON.stringify(EXPECTED_COMPANY_NAV), JSON.stringify(state.navLabels));
	check('Basic Information is the first active section', state.active === 'basic', state.active);
	const pressedFocus = await evaluate('Array.prototype.slice.call(document.querySelectorAll("#cp-focus-grid [data-focus]")).filter(function (el) { return el.getAttribute("aria-pressed") === "true"; }).map(function (el) { return el.getAttribute("data-focus"); })');
	check('Focus chips include common records', ['addresses', 'contacts', 'activity'].every(function (id) { return pressedFocus.indexOf(id) > -1; }), JSON.stringify(pressedFocus));
	check('Question sets chip identifies the selected set', state.profileChip.indexOf('B2B sales account') > -1, state.profileChip);
	check('Question sets chip reports 7 areas', state.profileSub.indexOf('7 areas') > -1, state.profileSub);
	check('Completion starts at 90 percent', state.completion === '90%', state.completion);
	check('Save indicator is settled', state.saveText === 'All changes saved', state.saveText);
	check('No horizontal overflow at 1280px', state.overflow.doc <= 1 && state.overflow.app <= 1, JSON.stringify(state.overflow));
	const basicState = state.sectionStates.find(function (item) { return item.id === 'basic'; });
	check('Basic section reports complete', basicState && basicState.className.indexOf('complete') > -1, basicState && basicState.text);

	await screenshot('company-1280');

	await click('[data-nav="people"]');
	await sleep(150);
	await click('[data-toggle-row="contacts"]');
	await sleep(200);
	const personFormReady = await evaluate('!!document.querySelector(".cp-array-item.is-editing [data-list-field=\\"name\\"]") && !!document.querySelector(".cp-array-item.is-editing .cp-array-item-row-2")');
	check('People form opens as a two-row form', personFormReady, '');
	await screenshot('people-form');
	await click('.cp-array-item.is-editing [data-toggle-row="contacts"]');
	await sleep(150);

	await click('[data-nav="interactions"]');
	await sleep(150);
	await click('[data-toggle-row="interactions"]');
	await sleep(200);
	const interactionField = await evaluate('(document.querySelector(".cp-array-item.is-editing [data-list-field=\\"summary\\"]") || {}).tagName || ""');
	const interactionValue = await evaluate('(document.querySelector(".cp-array-item.is-editing [data-list-field=\\"summary\\"]") || {}).value || ""');
	check('Interaction summary is a textarea', interactionField === 'TEXTAREA', interactionField);
	check('Interaction form loads the existing summary', interactionValue.length > 20, interactionValue.slice(0, 80));
	await screenshot('interaction-form');
	await click('.cp-array-item.is-editing [data-toggle-row="interactions"]');
	await sleep(150);

	await click('[data-nav="profile-company-account-company-details"]');
	await sleep(150);
	state = await getState();
	check('Section nav switches to Company details', state.active === 'profile-company-account-company-details', state.active);

	await setInput('[data-field="parentCompany"]', 'Brightline Group');
	await sleep(650);
	state = await getState();
	check('Field edit persists in values', state.value.values.parentCompany === 'Brightline Group', state.value.values.parentCompany);
	check('Saved value includes the focus preset', Array.isArray(state.value.focus) && ['addresses', 'contacts', 'activity'].every(function (id) { return state.value.focus.indexOf(id) > -1; }), JSON.stringify(state.value.focus));
	check('Completion reaches 100 percent', state.completion === '100%', state.completion);
	check('Save settles after field edit', state.saveText === 'All changes saved', state.saveText);

	await click('[data-nav="addresses"]');
	await sleep(150);
	await click('[data-add-row="addresses"]');
	await sleep(250);
	state = await getState();
	check('New address row opens for editing', (await evaluate('!!document.querySelector(".cp-array-item.is-editing")')), '');
	await setInput('.cp-array-item.is-editing [data-list-field="line1"]', '1 QA Street');
	await setInput('.cp-array-item.is-editing [data-list-field="city"]', 'Testville');
	await setInput('.cp-array-item.is-editing [data-list-field="country"]', 'Canada');
	await sleep(650);
	state = await getState();
	const addedAddress = state.value.lists.addresses[state.value.lists.addresses.length - 1];
	check('Address row persists', state.value.lists.addresses.length === 3 && addedAddress.line1 === '1 QA Street' && addedAddress.city === 'Testville', JSON.stringify(addedAddress));
	await click('.cp-array-item.is-editing [data-toggle-row="addresses"]');
	await sleep(200);
	check('Address row collapses after Done', !(await evaluate('!!document.querySelector(".cp-array-item.is-editing")')), '');
	await clickLast('[data-remove-row="addresses"]');
	await sleep(250);
	state = await getState();
	check('Address row removal persists', state.value.lists.addresses.length === 2, state.value.lists.addresses.length);

	await click('[data-nav="contact"]');
	await sleep(150);
	await click('[data-add-row="emails"]');
	await sleep(200);
	await setInput('.cp-array-item.is-editing [data-list-field="value"]', 'qa@acme.test');
	await sleep(650);
	state = await getState();
	const addedEmail = state.value.lists.emails[state.value.lists.emails.length - 1];
	check('Email row persists', state.value.lists.emails.length === 3 && addedEmail.value === 'qa@acme.test', JSON.stringify(addedEmail));

	await click('[data-nav="basic"]');
	await sleep(150);
	await pressEnterOnTag('[data-tag-input="core_tags"]', 'qa-tag');
	await sleep(650);
	state = await getState();
	check('Tag entry persists', state.value.values.core_tags.indexOf('qa-tag') > -1, JSON.stringify(state.value.values.core_tags));
	await click('[data-tag-remove="qa-tag"]');
	await sleep(650);
	state = await getState();
	check('Tag removal persists', state.value.values.core_tags.indexOf('qa-tag') === -1, JSON.stringify(state.value.values.core_tags));

	await click('[data-focus="contract"]');
	await sleep(250);
	state = await getState();
	check('Unticking contract hides its section', state.sectionIds.indexOf('profile-company-account-contract') === -1, JSON.stringify(state.navIds));
	check('Hidden note explains the hidden section', state.hiddenNote.indexOf('1 section hidden') > -1, state.hiddenNote);
	await click('#cp-scope-toggle');
	await sleep(250);
	state = await getState();
	check('Show all sections reveals the hidden section', state.sectionIds.indexOf('profile-company-account-contract') > -1, JSON.stringify(state.navIds));
	check('Show all note explains the override', state.hiddenNote.indexOf('showing all') > -1, state.hiddenNote);
	await click('#cp-scope-toggle');
	await sleep(250);

	await chooseOnly('company-basic');
	await sleep(300);
	state = await getState();
	check('Company basic question set changes the sections', state.value.profileKey === 'company-basic' && state.sectionIds.length === 8, state.value.profileKey + ' / ' + state.sectionIds.length);
	check('Company basic question set hides buying and contract', state.sectionIds.indexOf('profile-company-account-buying-process') === -1 && state.sectionIds.indexOf('profile-company-account-contract') === -1, JSON.stringify(state.navIds));

	await click('[data-pack-clear]');
	await sleep(300);
	state = await getState();
	check('Clearing question sets keeps only foundation and records', state.value.profileKey === '' && Array.isArray(state.value.profileKeys) && state.value.profileKeys.length === 0 && state.sectionIds.length === 3, state.sectionIds.length);
	check('Clearing question sets clears focus', Array.isArray(state.value.focus) && state.value.focus.length === 0, JSON.stringify(state.value.focus));
	check('Existing answers survive clearing question sets', state.value.values.parentCompany === 'Brightline Group' && state.value.lists.emails.some(function (row) { return row.value === 'qa@acme.test'; }), '');

	await click('#cp-scope-toggle');
	await sleep(250);
	state = await getState();
	const noProfileNote = await evaluate('(document.querySelector("#cp-profile-note") || {}).textContent || ""');
	check('Show all works without question sets', state.sectionIds.length === 6 && state.hiddenNote.indexOf('Showing all basic') > -1, state.hiddenNote);
	check('Question set setup note explains show all without a set', noProfileNote.indexOf('All basic and extra sections') > -1, noProfileNote);
	await click('#cp-scope-toggle');
	await sleep(250);
	state = await getState();
	check('Hiding extra sections without question sets returns to three', state.sectionIds.length === 3, state.sectionIds.length);

	await chooseOnly('company-account');
	await sleep(300);
	state = await getState();
	check('Reselecting company account restores 10 sections', state.sectionIds.length === 10, state.sectionIds.length);

	await chooseOnly('software-discovery');
	await sleep(300);
	state = await getState();
	check('Software discovery question set adds 10 sections', state.value.profileKey === 'software-discovery' && state.sectionIds.length === 10, state.sectionIds.length);
	check('Software question set includes infrastructure and software tools', state.sectionIds.indexOf('profile-software-discovery-technical-infrastructure') > -1 && state.sectionIds.indexOf('profile-software-discovery-software-tools') > -1, JSON.stringify(state.navIds));
	check('Question set picker lists every set', (await evaluate('document.querySelectorAll("[data-profile-toggle]").length')) === 12 && (await evaluate('document.querySelectorAll("#cp-profile-kind").length')) === 0, '');
	await click('[data-nav="profile-software-discovery-technical-infrastructure"]');
	await sleep(150);
	check('Infrastructure fields render', await evaluate('!!document.querySelector("[data-field=\\"cloudProvider\\"]") && !!document.querySelector("[data-field=\\"compliance\\"]")'), '');
	await screenshot('software-profile-technical');
	await click('[data-nav="profile-software-discovery-software-tools"]');
	await sleep(150);
	check('Software stack fields render', await evaluate('!!document.querySelector("[data-tags-for=\\"usedSoftware\\"]") && !!document.querySelector("[data-tags-for=\\"devopsTools\\"]")'), '');
	await screenshot('software-profile-tools');
	await chooseOnly('company-account');
	await sleep(300);

	await click('[data-type="person"]');
	await sleep(250);
	state = await getState();
	check('Type switch keeps the selected question set', state.value.customerType === 'person' && state.value.profileKey === 'company-account' && state.sectionIds.length === 10, state.value.customerType + ' / ' + state.value.profileKey);
	check('All question sets remain selectable for a person', (await evaluate('document.querySelectorAll("[data-profile-toggle]").length')) === 12, '');
	check('Type switch updates the display name', state.name === 'New customer', state.name);

	await chooseOnly('person-basic');
	await sleep(300);
	state = await getState();
	check('Person basic question set shows 8 sections', state.value.profileKey === 'person-basic' && state.sectionIds.length === 8, state.sectionIds.length);
	check('Person question set renders personal and preference sections', state.sectionIds.indexOf('profile-person-basic-personal') > -1 && state.sectionIds.indexOf('profile-person-basic-preferences') > -1, JSON.stringify(state.navIds));

	await click('[data-type="company"]');
	await sleep(200);
	await chooseOnly('company-account');
	await sleep(300);

	await click('#cp-manage-profiles');
	await waitFor('!!document.querySelector("#cp-modal-overlay.open")', 'profile library modal');
	await sleep(150);
	const profileRows = await evaluate('document.querySelectorAll(".cp-profile-row").length');

	const firstProfileName = await evaluate('(document.querySelector(".cp-profile-row .cp-profile-name") || {}).textContent || ""');
	check('Question set library shows all 12 sets', profileRows === 12, profileRows);
	check('Question set library has no type or vertical tags', (await evaluate('document.querySelectorAll(".cp-profile-tag.is-vertical").length')) === 0, '');
	check('Question set library puts the selected set first', firstProfileName.indexOf('B2B sales account') > -1, firstProfileName);
	await screenshot('profile-library');
	await click('[data-profile-duplicate="company-account"]');
	await sleep(300);
	state = await getState();
	check('Duplicate creates a record question set', state.value.customProfiles.length === 1 && state.value.customProfiles[0].key === 'company-account-copy', JSON.stringify(state.value.customProfiles.map(function (p) { return p.key; })));
	check('Duplicate reopens the library with 13 rows', (await evaluate('document.querySelectorAll(".cp-profile-row").length')) === 13, '');
	await click('[data-profile-edit="company-account-copy"]');
	await waitFor('!!document.querySelector("#cp-json-textarea")', 'custom profile JSON editor');
	let jsonText = await evaluate('document.querySelector("#cp-json-textarea").value');
	check('Custom question set editor loads the copy', jsonText.indexOf('B2B sales account (copy)') > -1, jsonText.slice(0, 80));
	check('Custom question-set JSON omits internal and typed fields', jsonText.indexOf('"builtIn"') === -1 && jsonText.indexOf('"custom"') === -1 && jsonText.indexOf('"appliesTo"') === -1 && jsonText.indexOf('"vertical"') === -1, '');
	await screenshot('json-editor');
	await click('#cp-json-cancel');
	await sleep(150);
	await click('#cp-manage-profiles');
	await waitFor('!!document.querySelector("#cp-modal-overlay.open")', 'profile library modal again');
	await click('[data-profile-delete="company-account-copy"]');
	await waitFor('!!document.querySelector("#cp-confirm-ok")', 'delete confirmation');
	await click('#cp-confirm-ok');
	await sleep(400);
	state = await getState();
	check('Delete removes the record question set', state.value.customProfiles.length === 0, state.value.customProfiles.length);
	await click('#cp-profiles-close');
	await sleep(150);

	check('Share is no longer a sidebar section', state.navIds.indexOf('share') === -1, JSON.stringify(state.navIds));
	await click('#cp-actions-toggle');
	await waitFor('!!document.querySelector("#cp-actions-menu") && !document.querySelector("#cp-actions-menu").hidden', 'action menu open');
	const menuName = await evaluate('(document.querySelector("#cp-menu-name") || {}).textContent || ""');
	const menuSub = await evaluate('(document.querySelector("#cp-menu-sub") || {}).textContent || ""');
	check('Action menu opens', (await evaluate('document.querySelector("#cp-actions-toggle").getAttribute("aria-expanded")')) === 'true', '');
	check('Action menu is personalised', menuName.indexOf('Brightline') > -1 && menuSub.indexOf('B2B sales account') > -1, menuName + ' / ' + menuSub);
	await click('[data-menu-action="share"]');
	await waitFor('!!document.querySelector("#cp-drawer.open")', 'share drawer open');
	check('Share drawer opens from the action menu', (await evaluate('document.querySelector("#cp-drawer").getAttribute("aria-hidden")')) === 'false', '');
	check('Action menu closes after opening the drawer', await evaluate('document.querySelector("#cp-actions-menu").hidden'), '');
	const preview = await evaluate('(document.querySelector("#cp-output-preview") || {}).textContent || ""');
	check('Share preview includes the customer and email', preview.indexOf('BRIGHTLINE STUDIO LTD.') > -1 && preview.indexOf('qa@acme.test') > -1, preview.slice(0, 100));
	check('Share preview does not repeat the customer type', preview.indexOf('Company - Company -') === -1, preview.slice(0, 100));
	await sleep(300);
	await evaluate('Array.prototype.slice.call(document.querySelectorAll(".th-toast")).forEach(function (el) { el.remove(); }); true');
	await screenshot('company-share-drawer');
	await click('#cp-drawer-body [data-action="export-pdf"]');
	await sleep(300);
	const pdfHtml = await evaluate('window.__lastPdfHtml || ""');
	check('Printable export receives a document', pdfHtml.indexOf('Brightline Studio Ltd.') > -1 && pdfHtml.indexOf(BUILD) > -1, pdfHtml.length);
	await click('#cp-drawer-close');
	await sleep(200);
	check('Share drawer closes', !(await evaluate('!!document.querySelector("#cp-drawer.open")')), '');

	await click('#cp-theme-toggle');
	await sleep(250);
	state = await getState();
	check('Dark theme applies', (await evaluate('document.querySelector("#app").classList.contains("cp-dark")')) && state.value.ui.theme === 'dark', state.value.ui.theme);
	await screenshot('company-dark');
	await click('#cp-theme-toggle');
	await sleep(250);

	await evaluate('window.tool._setReadOnly(true); true');
	await sleep(250);
	state = await getState();
	check('Read-only mode adds the lock state', state.readonly === true && state.readonlyNoteHidden === false, JSON.stringify({ readonly: state.readonly, note: state.readonlyNoteHidden }));
	check('Read-only mode removes add controls', state.addButtons === 0, state.addButtons);
	check('Read-only mode disables section scope controls', state.scopeDisabled === true, '');
	const manageLabel = await evaluate('(document.querySelector("#cp-manage-profiles") || {}).textContent || ""');
	const menuManageLabel = await evaluate('(document.querySelector("#cp-menu-manage-text") || {}).textContent || ""');
	check('Read-only mode offers the question set library as view-only', state.manageDisabled === false && manageLabel.indexOf('View question sets') > -1 && menuManageLabel.indexOf('View question sets') > -1, manageLabel + ' / ' + menuManageLabel);
	await click('#cp-actions-toggle');
	await waitFor('!document.querySelector("#cp-actions-menu").hidden', 'read-only action menu');
	await click('[data-menu-action="share"]');
	await waitFor('!!document.querySelector("#cp-drawer.open")', 'read-only share drawer');
	check('Read-only drawer keeps export actions', await evaluate('!!document.querySelector("#cp-drawer-body [data-action=\\"download-json\\"]")'), '');
	check('Read-only drawer offers view-only question sets', (await evaluate('(document.querySelector("#cp-drawer-body [data-action=\\"manage-profiles\\"]") || {}).textContent || ""')).indexOf('View question sets') > -1, '');
	await click('#cp-drawer-close');
	await sleep(150);
	await click('#cp-manage-profiles');
	await waitFor('!!document.querySelector("#cp-modal-overlay.open")', 'read-only profile library');
	check('Read-only question set library hides edit actions', (await evaluate('document.querySelectorAll("[data-profile-duplicate], [data-profile-edit], [data-profile-delete], [data-profile-use]").length')) === 0, '');
	await click('#cp-profiles-close');
	await sleep(150);
	check('Read-only mode disables fields', (await evaluate('document.querySelector("[data-field=\\"core_legalName\\"]").disabled')), '');
	await screenshot('company-readonly');
	await evaluate('window.tool._setReadOnly(false); true');
	await sleep(250);
	state = await getState();
	check('Read-only mode restores editing', state.readonly === false && state.readonlyNoteHidden === true && state.addButtons > 0, JSON.stringify({ readonly: state.readonly, add: state.addButtons }));

	await evaluate('window.tool._setRole("viewer"); true');
	await sleep(300);
	state = await getState();
	check('Viewer role is locked', state.readonly === true && state.readonlyNoteHidden === false, '');
	await evaluate('window.tool._setRole("admin"); true');
	await sleep(300);
	state = await getState();
	check('Admin role restores editing', state.readonly === false, '');

	await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
	await sleep(300);
	state = await getState();
	check('No horizontal overflow at 390px', state.overflow.doc <= 1 && state.overflow.app <= 1, JSON.stringify(state.overflow));
	await click('#cp-actions-toggle');
	await sleep(150);
	const mobileMenu = await evaluate('(() => { const menu = document.querySelector("#cp-actions-menu"); const rect = menu.getBoundingClientRect(); return { hidden: menu.hidden, left: rect.left, right: rect.right, width: rect.width }; })()');
	check('Mobile action menu fits the viewport', mobileMenu.hidden === false && mobileMenu.left >= 0 && mobileMenu.right <= 390, JSON.stringify(mobileMenu));
	await click('#cp-actions-toggle');
	await sleep(150);
	await screenshot('company-390');
	await send('Emulation.setDeviceMetricsOverride', { width: 489, height: 844, deviceScaleFactor: 1, mobile: true });
	await sleep(250);
	state = await getState();
	check('No horizontal overflow at 489px', state.overflow.doc <= 1 && state.overflow.app <= 1, JSON.stringify(state.overflow));
	await screenshot('company-489');
	await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
	await sleep(250);

	const bootLogs = logs.filter(function (entry) { return entry.text.indexOf('[TOOL:BOOT] build ' + BUILD) > -1; });
	check('Boot log shows the current build', bootLogs.length > 0, JSON.stringify(bootLogs));
	check('No uncaught exceptions during company flow', exceptions.length === 0, exceptions.join(' | '));
	const consoleErrors = logs.filter(function (entry) {
		return (entry.type === 'error' || entry.type === 'log-error') && entry.text.indexOf('favicon.ico') === -1;
	});
	check('No console errors during company flow', consoleErrors.length === 0, JSON.stringify(consoleErrors.slice(0, 3)));

	exceptions.length = 0;
	logs.length = 0;
	await evaluate('localStorage.clear(); true');
	await send('Page.navigate', { url: 'http://127.0.0.1:8765/test-harness.html?sample=person&bare=1&inlinejs=1' });
	const inlineReady = "location.search.indexOf('inlinejs=1') > -1 && " +
		"!!document.querySelector('#cp-build-badge') && " +
		"document.querySelector('#cp-build-badge').textContent.indexOf(" + q(BUILD) + ") > -1 && " +
		"document.querySelectorAll('#cp-nav [data-nav]').length > 0 && " +
		"!!window.tool && !!window.tool._getValue && !!window.tool._getValue() && " +
		"window.tool._getValue().profileKey === 'person-basic'";
	await waitFor(inlineReady, 'inline person sample boot', 12000);
	await sleep(400);
	state = await getState();
	const harnessStatus = await evaluate('(document.querySelector("#th-status") || {}).textContent || ""');
	check('Inline JS mode boots', harnessStatus.indexOf('inline') > -1, harnessStatus);
	check('Inline person sample shows person-basic', state.value && state.value.profileKey === 'person-basic' && state.sectionIds.length === 8, state.value && state.value.profileKey);
	check('Inline person sample renders personal sections', state.sectionIds.indexOf('profile-person-basic-personal') > -1 && state.sectionIds.indexOf('profile-person-basic-preferences') > -1, JSON.stringify(state.navIds));
	await click('#cp-actions-toggle');
	await waitFor('!document.querySelector("#cp-actions-menu").hidden', 'inline action menu');
	await click('[data-menu-action="share"]');
	await waitFor('!!document.querySelector("#cp-drawer.open")', 'inline share drawer');
	const inlinePreview = await evaluate('(document.querySelector("#cp-output-preview") || {}).textContent || ""');
	check('Inline summary includes checked preferences', inlinePreview.indexOf('Accepts email updates: Yes') > -1, inlinePreview.slice(0, 120));
	await click('#cp-drawer-close');
	await sleep(150);
	check('Inline mode has no uncaught exceptions', exceptions.length === 0, exceptions.join(' | '));
	const inlineBoot = logs.filter(function (entry) { return entry.text.indexOf('[TOOL:BOOT] build ' + BUILD) > -1; });
	check('Inline mode logs the current build', inlineBoot.length > 0, JSON.stringify(inlineBoot));
	await screenshot('person-inline-1280');

	const failures = results.filter(function (result) { return !result.ok; });
	console.log('\n===== QA SUMMARY =====');
	console.log('Checks: ' + results.length + ' | Passed: ' + (results.length - failures.length) + ' | Failed: ' + failures.length);
	if (failures.length) console.log('Failures: ' + failures.map(function (failure) { return failure.name; }).join('; '));
	console.log('Screenshots: ' + SHOT_DIR);

	socket.close();
	if (failures.length || exceptions.length) process.exitCode = 1;
}

main().catch(function (error) {
	console.error('QA RUNNER ERROR:', error && error.stack ? error.stack : error);
	process.exitCode = 1;
});
