'use strict';
// Runtime smoke test for the Tools tab of ApplicationStoreItem.
// The repo has no dependencies, so this file builds the smallest DOM the tool
// actually touches, boots the REAL ApplicationStoreItem.js in a vm, then drives
// the catalog: load from cache, filter, select, reorder, status, remove.
// Run: node check-catalog.cjs
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dir = __dirname;
const html = fs.readFileSync(path.join(dir, 'ApplicationStoreItem.html'), 'utf8');
const js = fs.readFileSync(path.join(dir, 'ApplicationStoreItem.js'), 'utf8');
const bundlePath = path.join(dir, '..', 'tools-catalog', 'tool-catalog-bundle.json');
const bundleText = fs.readFileSync(bundlePath, 'utf8');
const bundle = JSON.parse(bundleText);
const CACHE_KEY = 'uniconhub_app_tool_catalog_v1';

let failures = 0;
function check(name, ok, detail) {
  if (ok) return;
  failures++;
  console.log('FAIL ' + name + (detail ? ' -> ' + String(detail).slice(0, 400) : ''));
}

/* ---------- minimal DOM ---------- */
function makeClassList() {
  const set = new Set();
  return {
    add: (...names) => names.forEach((n) => set.add(n)),
    remove: (...names) => names.forEach((n) => set.delete(n)),
    toggle: (name, on) => { if (on === undefined) { set.has(name) ? set.delete(name) : set.add(name); } else if (on) set.add(name); else set.delete(name); },
    contains: (name) => set.has(name)
  };
}
function makeElement(id) {
  const listeners = {};
  const element = {
    id: id || '',
    tagName: 'DIV',
    innerHTML: '',
    textContent: '',
    value: '',
    checked: false,
    disabled: false,
    type: 'text',
    files: null,
    style: {},
    dataset: {},
    attributes: {},
    scrollTop: 0,
    scrollHeight: 0,
    children: [],
    classList: makeClassList(),
    addEventListener(name, handler) { (listeners[name] = listeners[name] || []).push(handler); },
    removeEventListener() {},
    dispatch(name, event) { (listeners[name] || []).forEach((handler) => handler(event)); },
    setAttribute(name, value) { element.attributes[name] = String(value); },
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(element.attributes, name) ? element.attributes[name] : null; },
    removeAttribute(name) { delete element.attributes[name]; },
    hasAttribute(name) { return Object.prototype.hasOwnProperty.call(element.attributes, name); },
    appendChild(child) { element.children.push(child); return child; },
    removeChild(child) { element.children = element.children.filter((c) => c !== child); return child; },
    insertBefore(child) { element.children.push(child); return child; },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    closest() { return null; },
    focus() {},
    blur() {},
    click() { element.dispatch('click', { target: element, preventDefault() {} }); },
    setSelectionRange() {},
    remove() {},
    getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0 }; }
  };
  return element;
}

const ids = [];
const idPattern = /\bid="([^"]+)"/g;
let idMatch;
while ((idMatch = idPattern.exec(html)) !== null) ids.push(idMatch[1]);
const elements = new Map();
ids.forEach((id) => elements.set(id, makeElement(id)));

// The tab buttons are found by querySelectorAll('.asi-tab') in wireEvents.
const tabButtons = [];
const tabPattern = /data-tab="([a-z]+)"/g;
let tabMatch;
while ((tabMatch = tabPattern.exec(html)) !== null) {
  const tabButton = makeElement('');
  tabButton.setAttribute('data-tab', tabMatch[1]);
  tabButtons.push(tabButton);
}

const documentStub = {
  activeElement: null,
  visibilityState: 'visible',
  getElementById: (id) => (elements.has(id) ? elements.get(id) : null),
  querySelectorAll: (selector) => (selector === '.asi-tab' ? tabButtons : []),
  querySelector: () => null,
  createElement: (tagName) => { const created = makeElement(''); created.tagName = String(tagName).toUpperCase(); return created; },
  addEventListener() {},
  execCommand: () => true,
  body: makeElement('body')
};
const storage = new Map();
const localStorageStub = {
  getItem: (key) => (storage.has(key) ? storage.get(key) : null),
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key)
};

let stagedValue = null;
let readyCallback = null;
const toolStub = {
  onReady(callback) { readyCallback = callback; },
  onFieldsChange() {},
  onValueChange() {},
  onReadonlyChange() {},
  onUserChange() {},
  getFields() { return {}; },
  param(name, defaultValue) { return defaultValue; },
  isReadOnly() { return false; },
  getUser() { return { name: 'Smoke', roles: ['admin'], effectiveAccess: { isEditor: true, isManager: true } }; },
  setValue(value) { stagedValue = value; },
  declareOutput() {},
  declareParams() {},
  resize() {},
  notify() {},
  reportValid() {},
  openUrl() {},
  requestObjects(action, params, callback) { if (callback) callback('no objects in the smoke test', null); },
  requestUpload(accept, callback) { if (callback) callback('no upload in the smoke test', null); },
  requestFetch(url, options, callback) { if (callback) callback('no relay in the smoke test', null); }
};

const sandbox = {
  console: { log() {}, warn() {}, error() {} },
  document: documentStub,
  localStorage: localStorageStub,
  navigator: { clipboard: { writeText: () => Promise.resolve() } },
  location: { search: '', href: 'http://localhost/' },
  setTimeout: () => 0,
  clearTimeout: () => {},
  setInterval: () => 0,
  clearInterval: () => {},
  JSON, Math, Date, Object, Array, String, Number, Boolean, RegExp, Error, isNaN, parseInt, parseFloat,
  Promise,
  FileReader: function FileReader() {},
  fetch: () => Promise.reject(new Error('no fetch in the smoke test')),
  tool: toolStub
};
sandbox.window = sandbox;
sandbox.window.addEventListener = () => {};
sandbox.globalThis = sandbox;

/* ---------- boot ---------- */
try {
  vm.runInNewContext(js, sandbox, { filename: 'ApplicationStoreItem.js' });
} catch (error) {
  console.log('FAIL the tool script threw at load: ' + error.message);
  process.exit(1);
}
check('the tool registers tool.onReady', typeof readyCallback === 'function');
if (typeof readyCallback !== 'function') process.exit(1);

try {
  readyCallback({}, { name: 'Smoke app', typeId: 'folder-1' });
} catch (error) {
  console.log('FAIL boot threw: ' + error.message + '\n' + (error.stack || '').split('\n').slice(0, 4).join('\n'));
  process.exit(1);
}
check('boot builds a stored value or waits for the first change', stagedValue === null || typeof stagedValue === 'object');
// A previous successful relay load is in the local cache - that is what a CMS
// session with a brief relay outage also sees.
storage.set(CACHE_KEY, bundleText);
const toolsTab = tabButtons.filter((button) => button.getAttribute('data-tab') === 'tools')[0];
check('the Tools tab button exists and is wired', !!toolsTab);
if (toolsTab) toolsTab.dispatch('click', { target: toolsTab });
check('the Tools tab opens the tools pane', elements.get('asi-pane-tools').style.display === '', elements.get('asi-pane-tools').style.display);
check('opening the tab loads the catalog through the fallback chain',
  /cached copy/.test(elements.get('asi-catalog-source').textContent),
  elements.get('asi-catalog-source').textContent + ' | ' + elements.get('asi-catalog-stats').innerHTML.slice(0, 120));
check('the Tools tab count is 0', elements.get('asi-tab-tool-count').textContent === '0', elements.get('asi-tab-tool-count').textContent);

/* ---------- catalog contract ---------- */
check('the bundle declares the schema', bundle.schema === 'uniconhub-tool-catalog-bundle', bundle.schema);
check('the bundle lists 8 publish subjects', Array.isArray(bundle.subjects) && bundle.subjects.length === 8);
const ideaTotal = bundle.groups.reduce((sum, group) => sum + group.categories.reduce((inner, category) => inner + category.ideas.length, 0), 0);
check('the bundle carries every idea', ideaTotal > 200, ideaTotal);
const builtIds = Object.keys(bundle.built);
const groupIds = new Set();
bundle.groups.forEach((group) => group.categories.forEach((category) => category.ideas.forEach((idea) => groupIds.add(idea.id))));
const orphanBuilt = builtIds.filter((id) => !groupIds.has(id));
check('every built entry maps to a catalog idea id', orphanBuilt.length === 0, orphanBuilt.slice(0, 5).join(','));
const badFolders = builtIds.filter((id) => !bundle.built[id] || !bundle.built[id].folder);
check('every built entry names its tool folder', badFolders.length === 0, badFolders.slice(0, 5).join(','));
const publishFolders = Object.keys(bundle.publish.tools);
check('publish state is keyed by tool folder', publishFolders.every((folder) => folder !== '' && !folder.includes(' > ')), publishFolders.slice(0, 3).join(','));
check('the bundle fits the relay cap', bundleText.length < 500 * 1024, bundleText.length + ' bytes');
check('the default catalog URL resolves to the bundle', fs.existsSync(path.resolve(dir, '../tools-catalog/tool-catalog-bundle.json')));

/* ---------- reload ---------- */
elements.get('asi-catalog-reload').dispatch('click', { target: elements.get('asi-catalog-reload'), preventDefault() {} });
check('the source badge names the cache', /cached copy/.test(elements.get('asi-catalog-source').textContent), elements.get('asi-catalog-source').textContent);
check('the cache load persists the catalog provenance',
  !!stagedValue && stagedValue.toolsMeta && stagedValue.toolsMeta.catalogCount === ideaTotal && Array.isArray(stagedValue.tools),
  stagedValue ? JSON.stringify(stagedValue.toolsMeta) : 'nothing stored');
const statsHtml = elements.get('asi-catalog-stats').innerHTML;
check('the stats show the idea count', statsHtml.indexOf(String(ideaTotal)) !== -1, statsHtml.slice(0, 200));
check('the stats show the built count', statsHtml.indexOf('>' + builtIds.length + '<') !== -1, statsHtml.slice(0, 200));
const listHtml = elements.get('asi-catalog-list').innerHTML;
check('the catalog list renders rows', (listHtml.match(/asi-cat-row/g) || []).length >= 10, (listHtml.match(/asi-cat-row/g) || []).length);
check('the list shows idea names', listHtml.indexOf('Document Q') !== -1, listHtml.slice(0, 200));
check('the group filter has options', /<option value="B-bg"/.test(elements.get('asi-catalog-group').innerHTML));
check('the licensing filter has options', /<option value="subscription-monthly"/.test(elements.get('asi-catalog-licensing').innerHTML));

/* ---------- filters ---------- */
elements.get('asi-catalog-state').dispatch('change', { target: { value: 'new' } });
const newOnly = elements.get('asi-catalog-list').innerHTML;
const builtName = bundle.built[builtIds[0]] ? groupIdeaName(builtIds[0]) : '';
check('the not-built filter drops built ideas', builtName ? newOnly.indexOf(builtName) === -1 : true, builtName);
elements.get('asi-catalog-state').dispatch('change', { target: { value: 'published' } });
check('the published filter is empty when nothing is published', /No idea matches/.test(elements.get('asi-catalog-list').innerHTML), elements.get('asi-catalog-list').innerHTML.slice(0, 120));
elements.get('asi-catalog-state').dispatch('change', { target: { value: 'all' } });
elements.get('asi-catalog-search').dispatch('input', { target: { value: 'presentation builder' } });
const searched = elements.get('asi-catalog-list').innerHTML;
check('search narrows the list', (searched.match(/asi-cat-row/g) || []).length > 0 && searched.toLowerCase().indexOf('presentation') !== -1, searched.slice(0, 160));
elements.get('asi-catalog-search').dispatch('input', { target: { value: '' } });

function escapeHtml(text) {
  return String(text == null ? '' : text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function groupIdeaName(ideaId) {
  let found = '';
  bundle.groups.forEach((group) => group.categories.forEach((category) => category.ideas.forEach((idea) => {
    if (idea.id === ideaId) found = idea.name;
  })));
  return found;
}

/* ---------- select, manage, remove ---------- */
const firstIdea = bundle.groups[0].categories[0].ideas[0];
elements.get('asi-catalog-list').dispatch('change', { target: { getAttribute: (name) => (name === 'data-catalog-id' ? firstIdea.id : null), checked: true } });
check('ticking an idea adds it to the queue', Array.isArray(stagedValue.tools) && stagedValue.tools.length === 1, JSON.stringify(stagedValue.tools));
check('the queue row shows the tool name', elements.get('asi-selected-list').innerHTML.indexOf(escapeHtml(firstIdea.name)) !== -1, elements.get('asi-selected-list').innerHTML.slice(0, 160));
check('the tab count follows the queue', elements.get('asi-tab-tool-count').textContent === '1', elements.get('asi-tab-tool-count').textContent);
check('a new entry starts queued', stagedValue.tools[0] && stagedValue.tools[0].status === 'queued', JSON.stringify(stagedValue.tools[0]));

const secondIdea = bundle.groups[0].categories[0].ideas[1];
elements.get('asi-catalog-list').dispatch('change', { target: { getAttribute: (name) => (name === 'data-catalog-id' ? secondIdea.id : null), checked: true } });
check('a second idea appends in order', stagedValue.tools.length === 2 && stagedValue.tools[1].key === secondIdea.id, JSON.stringify(stagedValue.tools.map((t) => t.key)));
const duplicate = elements.get('asi-catalog-list');
duplicate.dispatch('change', { target: { getAttribute: (name) => (name === 'data-catalog-id' ? secondIdea.id : null), checked: true, setAttribute() {} } });
check('the same idea cannot be added twice', stagedValue.tools.length === 2, JSON.stringify(stagedValue.tools.map((t) => t.key)));

const firstKey = stagedValue.tools[0].key;
elements.get('asi-selected-list').dispatch('change', { target: { getAttribute: () => 'status', value: 'developing', closest: () => ({ getAttribute: () => firstKey }) } });
check('the status change is stored', stagedValue.tools[0].status === 'developing', stagedValue.tools[0].status);
elements.get('asi-selected-list').dispatch('change', { target: { getAttribute: () => 'priority', value: 'high', closest: () => ({ getAttribute: () => firstKey }) } });
check('the priority change is stored', stagedValue.tools[0].priority === 'high', stagedValue.tools[0].priority);
elements.get('asi-selected-list').dispatch('input', { target: { getAttribute: () => 'notes', value: 'first in the batch', closest: () => ({ getAttribute: () => firstKey }) } });
check('notes are stored', stagedValue.tools[0].notes === 'first in the batch', stagedValue.tools[0].notes);

elements.get('asi-selected-list').dispatch('click', { target: { closest: (selector) => (selector === '[data-tool-act]' ? { getAttribute: () => 'down', closest: () => ({ getAttribute: () => firstKey }) } : null) } });
check('move down reorders the queue', stagedValue.tools[1].key === firstKey, JSON.stringify(stagedValue.tools.map((t) => t.key)));

elements.get('asi-selected-sync').dispatch('click', { target: elements.get('asi-selected-sync') });
check('sync leaves a not-built tool planned', stagedValue.tools[1].status === 'planned', stagedValue.tools[1].status);

elements.get('asi-selected-list').dispatch('click', { target: { closest: (selector) => (selector === '[data-tool-act]' ? { getAttribute: () => 'remove', closest: () => ({ getAttribute: () => firstKey }) } : null) } });
check('remove drops the entry', stagedValue.tools.length === 1, JSON.stringify(stagedValue.tools.map((t) => t.key)));

elements.get('asi-selected-clear').dispatch('click', { target: elements.get('asi-selected-clear') });
check('clear empties the queue', Array.isArray(stagedValue.tools) && stagedValue.tools.length === 0, JSON.stringify(stagedValue.tools));
check('the badge returns to 0', elements.get('asi-tab-tool-count').textContent === '0', elements.get('asi-tab-tool-count').textContent);

if (failures) {
  console.log('\n' + failures + ' check(s) failed.');
  process.exit(1);
}
console.log('PASS');
console.log('catalog: ' + ideaTotal + ' ideas, ' + builtIds.length + ' built, ' + publishFolders.length + ' publish rows, bundle ' + Math.round(bundleText.length / 1024) + ' KB');
