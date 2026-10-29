/* js build 2026-10-27-1 */
/* ───────────────────────────────────────────────────────────────────────
   FormSubmissionViewer
   One form submission, read as a dossier: every answer, who sent it, when,
   from which page and into which application.

   Object-level tool (TYPE 1). It renders the record it is mounted on:
   tool.onReady(value, fields) hands over the record, tool.onFieldsChange
   keeps it current, tool.getFields() reads it again on demand. Nothing
   else is read, and nothing is ever written back to the record. The only
   value this tool saves is its own tiny UI state.
   ─────────────────────────────────────────────────────────────────────── */
(function () {
	'use strict';

	var TOOL_BUILD = '2026-10-27-1';
	console.log('[TOOL:BOOT] build ' + TOOL_BUILD + ' FormSubmissionViewer');

	var toolApi = (typeof window !== 'undefined' && window.tool) ? window.tool : null;
	if (!toolApi || typeof toolApi.onReady !== 'function') {
		console.warn('[FormSubmissionViewer] The CMS tool SDK was not found, so the viewer cannot start.');
		return;
	}

	var SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
	var STORAGE_VERSION = 1;
	var DEFAULT_ACCENT_COLOR = '#004E89';
	var DEFAULT_BRAND_NAME = 'Form submission';
	var LONG_VALUE_THRESHOLD = 120;
	var UPDATED_CHIP_THRESHOLD_MS = 60000;

	/* shell keys are never answers - they are the record itself */
	var SHELL_FIELD_KEYS = [
		'id', '_id', 'contentId', 'name', 'slug', 'cmsObjectType', 'typeId', 'parentId',
		'tenantId', 'permissions', 'created', 'updated', 'createdAt', 'updatedAt', 'meta',
		'productData', 'objectData', 'seo', 'blocks', 'values', '_parentObjectId'
	];

	/* these three travel with the answers but are shown in the record card */
	var METADATA_VALUE_KEYS = ['formTypeId', 'page', 'submittedAt'];

	var GROUP_ORDER = ['person', 'contact', 'event', 'consents', 'answers'];
	var DEFAULT_GROUP_TITLES = {
		person: 'Person',
		contact: 'Contact',
		event: 'Event',
		consents: 'Consents',
		answers: 'Answers'
	};

	var PERSON_KEYWORDS = ['parent', 'student', 'name', 'guardian', 'child', 'first_name', 'last_name', 'grade', 'age', 'school', 'role', 'position'];
	var CONTACT_KEYWORDS = ['email', 'phone', 'mobile', 'contact'];
	var EVENT_KEYWORDS = ['exam', 'exam_date', 'date', 'city', 'area', 'venue', 'location', 'session', 'time', 'address'];
	var CONSENT_KEYWORDS = ['consent', 'opt_in', 'subscribe', 'permission', 'agree'];

	var ACRONYM_WORDS = { id: 'ID', url: 'URL', cemc: 'CEMC', ib: 'IB', sms: 'SMS' };

	var NAME_KEY_ORDER = ['student_name', 'child_name', 'full_name', 'person_name', 'name', 'contact_name', 'parent_name', 'guardian_name', 'first_name'];
	var CHIP_KEY_ORDER = ['student_grade', 'grade', 'grade_level', 'year_level', 'role', 'position', 'job_title'];

	var ICON_PATHS = {
		mail: ['M3 6.5h18v11H3z', 'M3 7l9 6 9-6'],
		phone: ['M6 3h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 4 5a2 2 0 0 1 2-2z'],
		copy: ['M9 9h10v11H9z', 'M5 15V4h10'],
		code: ['M9 8l-4 4 4 4', 'M15 8l4 4-4 4'],
		print: ['M7 8V3h10v5', 'M5 8h14v8h-3v5H8v-5H5z']
	};

	var PRINT_STYLESHEET = [
		'@page { size: A4 portrait; margin: 16mm; }',
		'* { box-sizing: border-box; }',
		'body { margin: 0; background: #ffffff; color: #1e293b; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 10.5pt; line-height: 1.5; }',
		'.print-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 12px; padding-bottom: 10px; border-bottom: 3px solid __ACCENT__; margin-bottom: 16px; }',
		'.print-brand { margin: 0; font-size: 10pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: __ACCENT__; }',
		'.print-title { margin: 4px 0 0; font-size: 18pt; line-height: 1.2; }',
		'.print-head-meta { text-align: right; font-size: 9.5pt; color: #475569; }',
		'.print-identity { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 14px; margin-bottom: 14px; break-inside: avoid; }',
		'.print-person { margin: 0; font-size: 14pt; font-weight: 700; }',
		'.print-chip { display: inline-block; margin-left: 8px; padding: 1px 8px; border: 1px solid #cbd5e1; border-radius: 999px; font-size: 9pt; color: #475569; }',
		'.print-contact { margin: 6px 0 0; font-size: 9.5pt; color: #475569; }',
		'.print-pairs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; margin: 12px 0 0; padding-top: 10px; border-top: 1px dashed #cbd5e1; }',
		'.print-sections { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }',
		'.print-section { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; break-inside: avoid; }',
		'.print-section h2 { margin: 0 0 8px; font-size: 9pt; letter-spacing: 0.08em; text-transform: uppercase; color: #475569; }',
		'.print-field { margin-bottom: 8px; }',
		'.print-label { display: block; font-size: 8pt; letter-spacing: 0.06em; text-transform: uppercase; color: #64748b; }',
		'.print-value { display: block; font-size: 10.5pt; white-space: pre-wrap; overflow-wrap: anywhere; }',
		'.print-empty { color: #64748b; font-style: italic; }',
		'.print-meta-table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 9pt; }',
		'.print-meta-table th, .print-meta-table td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }',
		'.print-meta-table th { width: 34%; color: #475569; font-weight: 600; }',
		'.print-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 8.5pt; overflow-wrap: anywhere; }',
		'.print-raw { margin-top: 14px; }',
		'.print-raw h2 { margin: 0 0 6px; font-size: 9pt; letter-spacing: 0.08em; text-transform: uppercase; color: #475569; }',
		'.print-raw pre { margin: 0 0 12px; padding: 10px; border: 1px solid #cbd5e1; background: #f8fafc; font-size: 8pt; white-space: pre-wrap; word-break: break-word; }',
		'.print-foot { margin-top: 18px; padding-top: 8px; border-top: 1px solid #cbd5e1; font-size: 8.5pt; color: #64748b; display: flex; justify-content: space-between; gap: 12px; }',
		'.print-page::after { content: "Page " counter(page) " of " counter(pages); }'
	].join('\n');

	/* ── runtime state ─────────────────────────────────────────────── */

	var uiState = { version: STORAGE_VERSION, ui: { showRaw: false, maskContacts: false } };
	var paramState = defaultParamState();
	var currentFields = {};
	var hasPaintedOnce = false;
	var activeRawTab = 'answers';

	/* ── small helpers ─────────────────────────────────────────────── */

	function logInfo(message, detail) {
		try {
			console.log('[FormSubmissionViewer] ' + message + (detail === undefined || detail === null ? '' : ' ' + detail));
		} catch (error) { }
	}

	function notify(message, severity) {
		try {
			if (typeof toolApi.notify === 'function') { toolApi.notify(message, severity || 'info'); }
		} catch (error) { }
	}

	function resizeTool() {
		try {
			if (typeof toolApi.resize === 'function') { toolApi.resize(); }
		} catch (error) { }
	}

	function isPlainObject(value) {
		return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
	}

	function stringOf(value) {
		if (value === null || value === undefined) { return ''; }
		if (typeof value === 'object') { return ''; }
		return String(value);
	}

	function firstText(candidates) {
		var index;
		for (index = 0; index < candidates.length; index += 1) {
			var candidate = candidates[index];
			if (candidate === null || candidate === undefined) { continue; }
			if (typeof candidate === 'object') { continue; }
			var text = String(candidate).trim();
			if (text) { return text; }
		}
		return '';
	}

	function escapeHtml(value) {
		return String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, function (character) {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
		});
	}

	function truncateText(text, maximumLength) {
		var value = String(text === null || text === undefined ? '' : text);
		if (value.length <= maximumLength) { return value; }
		return value.slice(0, maximumLength) + '\u2026';
	}

	/* ── DOM building (values always through textContent) ──────────── */

	function createElement(tagName, className, text) {
		var node = document.createElement(tagName);
		if (className) { node.className = className; }
		if (text !== undefined && text !== null) { node.textContent = String(text); }
		return node;
	}

	function iconNode(iconName) {
		var svg = document.createElementNS(SVG_NAMESPACE, 'svg');
		svg.setAttribute('viewBox', '0 0 24 24');
		svg.setAttribute('aria-hidden', 'true');
		svg.setAttribute('focusable', 'false');
		svg.setAttribute('class', 'fsv-icon');
		var paths = ICON_PATHS[iconName] || [];
		paths.forEach(function (pathData) {
			var path = document.createElementNS(SVG_NAMESPACE, 'path');
			path.setAttribute('d', pathData);
			svg.appendChild(path);
		});
		return svg;
	}

	function actionButton(labelText, iconName, onClick, extraClass) {
		var button = createElement('button', 'fsv-btn' + (extraClass ? ' ' + extraClass : ''));
		button.type = 'button';
		button.title = labelText;
		if (iconName) { button.appendChild(iconNode(iconName)); }
		button.appendChild(createElement('span', 'fsv-btn-label', labelText));
		button.addEventListener('click', onClick);
		return button;
	}

	function miniButton(labelText, onClick) {
		var button = createElement('button', 'fsv-mini-btn', labelText);
		button.type = 'button';
		button.addEventListener('click', onClick);
		return button;
	}

	function openExternal(url) {
		var target = String(url || '').trim();
		if (!target) { return; }
		try {
			if (typeof toolApi.openUrl === 'function') {
				toolApi.openUrl(target);
				return;
			}
		} catch (error) { }
		try { window.open(target, '_blank', 'noopener'); } catch (error) { }
	}

	/* ── parameters ────────────────────────────────────────────────── */

	function defaultParamState() {
		return {
			fieldMap: {},
			fieldGroups: {},
			formTypeLabels: {},
			brandName: DEFAULT_BRAND_NAME,
			accentColor: DEFAULT_ACCENT_COLOR,
			timeZone: '',
			websiteBaseUrl: '',
			maskContactDetails: false,
			showRawJson: true,
			showDiagnostics: false,
			warnings: []
		};
	}

	function readParamRaw(name) {
		try {
			if (typeof toolApi.param === 'function') {
				var value = toolApi.param(name, '');
				if (value !== undefined && value !== null) { return String(value); }
			}
		} catch (error) { }
		return '';
	}

	function textParam(name, fallback) {
		var raw = readParamRaw(name).trim();
		return raw ? raw : fallback;
	}

	function readJsonParam(name, fallback, warnings) {
		var raw = readParamRaw(name).trim();
		if (!raw) { return fallback; }
		try {
			var parsed = JSON.parse(raw);
			if (isPlainObject(parsed)) { return parsed; }
		} catch (error) { }
		warnings.push('The "' + name + '" parameter is not valid JSON, so the default value is used.');
		return fallback;
	}

	function resolveAccentColor(raw, warnings) {
		var value = String(raw || '').trim();
		if (/^#[0-9a-fA-F]{6}$/.test(value) || /^#[0-9a-fA-F]{3}$/.test(value)) { return value; }
		if (value && value !== DEFAULT_ACCENT_COLOR) {
			warnings.push('The "accentColor" parameter is not a hex colour, so the default colour is used.');
		}
		return DEFAULT_ACCENT_COLOR;
	}

	function resolveTimeZone(raw, warnings) {
		var zone = String(raw || '').trim();
		if (!zone) { return ''; }
		try {
			new Intl.DateTimeFormat('en-GB', { timeZone: zone });
			return zone;
		} catch (error) {
			warnings.push('The "timeZone" parameter is not a known time zone, so the browser time zone is used.');
			return '';
		}
	}

	function readParameters() {
		var warnings = [];
		var state = {
			fieldMap: readJsonParam('fieldMap', {}, warnings),
			fieldGroups: readJsonParam('fieldGroups', {}, warnings),
			formTypeLabels: readJsonParam('formTypeLabels', {}, warnings),
			brandName: textParam('brandName', DEFAULT_BRAND_NAME),
			accentColor: resolveAccentColor(textParam('accentColor', DEFAULT_ACCENT_COLOR), warnings),
			timeZone: resolveTimeZone(textParam('timeZone', ''), warnings),
			websiteBaseUrl: textParam('websiteBaseUrl', '').replace(/\/+$/, ''),
			maskContactDetails: textParam('maskContactDetails', 'no').toLowerCase() === 'yes',
			showRawJson: textParam('showRawJson', 'yes').toLowerCase() !== 'no',
			showDiagnostics: textParam('showDiagnostics', 'no').toLowerCase() === 'yes',
			warnings: warnings
		};
		return state;
	}

	function applyAccentColor() {
		var root = document.getElementById('fsv-root');
		if (root && root.style && typeof root.style.setProperty === 'function') {
			root.style.setProperty('--fsv-accent', paramState.accentColor);
		}
	}

	/* ── reading the record ────────────────────────────────────────── */

	function copyBag(source) {
		var bag = {};
		Object.keys(source).forEach(function (key) { bag[key] = source[key]; });
		return bag;
	}

	function recordValueBag(fields) {
		if (isPlainObject(fields.values)) { return copyBag(fields.values); }
		var bag = {};
		Object.keys(fields).forEach(function (key) {
			if (SHELL_FIELD_KEYS.indexOf(key) === -1) { bag[key] = fields[key]; }
		});
		return bag;
	}

	function dataCategoriesBag(fields) {
		var candidates = [];
		if (isPlainObject(fields.productData) && isPlainObject(fields.productData.data_categoriesBased)) {
			candidates.push(fields.productData.data_categoriesBased);
		}
		if (isPlainObject(fields.objectData) && isPlainObject(fields.objectData.data_categoriesBased)) {
			candidates.push(fields.objectData.data_categoriesBased);
		}
		var index;
		for (index = 0; index < candidates.length; index += 1) {
			if (Object.keys(candidates[index]).length > 0) { return copyBag(candidates[index]); }
		}
		return null;
	}

	function readSubmission(fields) {
		var record = (fields && typeof fields === 'object') ? fields : {};
		var values = recordValueBag(record);
		if (Object.keys(values).length === 0) {
			var fallbackBag = dataCategoriesBag(record);
			if (fallbackBag) { values = fallbackBag; }
		}
		var recordMeta = isPlainObject(record.meta) ? record.meta : {};
		var submission = {
			record: record,
			values: values,
			formTypeId: firstText([values.formTypeId, record.formTypeId, recordMeta.formTypeId]),
			pagePath: firstText([values.page, record.page, recordMeta.page]),
			submittedAt: firstText([values.submittedAt, record.created, record.createdAt, record.updated]),
			recordId: firstText([record.id, record._id]),
			contentId: firstText([record.contentId]),
			typeId: firstText([record.typeId]),
			sourceType: firstText([record.cmsObjectType]),
			created: firstText([record.created, record.createdAt]),
			updated: firstText([record.updated, record.updatedAt])
		};
		return submission;
	}

	function hasRecord(submission) {
		if (Object.keys(submission.record).length > 0) { return true; }
		if (submission.recordId || submission.formTypeId || submission.submittedAt) { return true; }
		return Object.keys(submission.values).length > 0;
	}

	/* ── labels and groups ─────────────────────────────────────────── */

	function deriveLabel(key) {
		var spaced = String(key === null || key === undefined ? '' : key).replace(/([a-z0-9])([A-Z])/g, '$1 $2');
		var words = spaced.split(/[^A-Za-z0-9]+/).filter(function (word) { return Boolean(word); });
		if (words.length === 0) { return 'Field'; }
		return words.map(function (word, wordIndex) {
			var lowerWord = word.toLowerCase();
			if (ACRONYM_WORDS[lowerWord]) { return ACRONYM_WORDS[lowerWord]; }
			if (wordIndex === 0) { return lowerWord.charAt(0).toUpperCase() + lowerWord.slice(1); }
			return lowerWord;
		}).join(' ');
	}

	function keyTokensOf(key) {
		var spaced = String(key === null || key === undefined ? '' : key).replace(/([a-z0-9])([A-Z])/g, '$1 $2');
		return spaced.toLowerCase().split(/[^a-z0-9]+/).filter(function (token) { return Boolean(token); });
	}

	/* keywords match whole words, so "message" never matches "age" and
	   "update" never matches "date". Underscored keywords match as a phrase. */
	function matchesKeyword(lowerKey, keywords) {
		var tokens = keyTokensOf(lowerKey);
		var index;
		for (index = 0; index < keywords.length; index += 1) {
			var keyword = keywords[index];
			if (keyword.indexOf('_') !== -1) {
				if (lowerKey.indexOf(keyword) !== -1) { return true; }
				continue;
			}
			if (tokens.indexOf(keyword) !== -1) { return true; }
		}
		return false;
	}

	function autoGroupOf(key) {
		var lowerKey = String(key || '').toLowerCase();
		if (matchesKeyword(lowerKey, PERSON_KEYWORDS)) { return 'person'; }
		if (matchesKeyword(lowerKey, CONTACT_KEYWORDS)) { return 'contact'; }
		if (matchesKeyword(lowerKey, EVENT_KEYWORDS)) { return 'event'; }
		if (matchesKeyword(lowerKey, CONSENT_KEYWORDS)) { return 'consents'; }
		return 'answers';
	}

	function groupTitleOf(groupKey) {
		if (paramState.fieldGroups[groupKey] !== undefined && paramState.fieldGroups[groupKey] !== null) {
			var configuredTitle = String(paramState.fieldGroups[groupKey]).trim();
			if (configuredTitle) { return configuredTitle; }
		}
		if (DEFAULT_GROUP_TITLES[groupKey]) { return DEFAULT_GROUP_TITLES[groupKey]; }
		return deriveLabel(groupKey);
	}

	function consentLabelOf(model) {
		var mapEntry = paramState.fieldMap[model.key];
		if (isPlainObject(mapEntry) && mapEntry.label) {
			var mappedLabel = String(mapEntry.label).trim();
			if (mappedLabel) { return mappedLabel; }
		}
		var lowerKey = String(model.key).toLowerCase();
		if (lowerKey === 'consent' || lowerKey === 'opt_in' || lowerKey === 'optin' ||
			lowerKey === 'subscribe' || lowerKey === 'email_consent' || lowerKey === 'consent_email') {
			return 'Email opt-in';
		}
		var derived = deriveLabel(model.key);
		if (/opt|consent|subscrib|permission|agree/i.test(derived)) { return derived; }
		return derived + ' opt-in';
	}

	/* ── value typing and formatting ───────────────────────────────── */

	function isIsoDateText(text) {
		return /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(String(text || ''));
	}

	function normalizeFieldType(rawType) {
		var type = String(rawType || '').trim().toLowerCase();
		if (type === 'text' || type === 'string') { return 'text'; }
		if (type === 'email' || type === 'e-mail') { return 'email'; }
		if (type === 'phone' || type === 'tel' || type === 'telephone') { return 'phone'; }
		if (type === 'date' || type === 'datetime' || type === 'date-time') { return 'date'; }
		if (type === 'boolean' || type === 'yesno' || type === 'yes/no' || type === 'bool') { return 'boolean'; }
		if (type === 'long' || type === 'textarea' || type === 'multiline') { return 'long'; }
		if (type === 'number' || type === 'numeric') { return 'number'; }
		if (type === 'url' || type === 'link') { return 'url'; }
		return 'text';
	}

	function detectFieldType(key, rawValue) {
		var text = stringOf(rawValue);
		var lowerKey = String(key || '').toLowerCase();
		if (!text.trim()) { return 'empty'; }
		if (/e-?mail/.test(lowerKey)) { return 'email'; }
		if (/phone|mobile|telephone|^tel$/.test(lowerKey)) { return 'phone'; }
		if (/^(https?:)?\/\//i.test(text) || /^www\./i.test(text)) { return 'url'; }
		if (isIsoDateText(text)) { return 'date'; }
		if (/^(yes|no|true|false|y|n)$/i.test(text) && matchesKeyword(lowerKey, CONSENT_KEYWORDS)) { return 'boolean'; }
		if (text.length > LONG_VALUE_THRESHOLD || text.indexOf('\n') !== -1) { return 'long'; }
		if (/^-?\d+(\.\d+)?$/.test(text)) { return 'number'; }
		return 'text';
	}

	function phoneDigits(text) {
		return String(text === null || text === undefined ? '' : text).replace(/\D/g, '');
	}

	function formatPhoneText(text) {
		var digits = phoneDigits(text);
		if (digits.length === 11 && digits.charAt(0) === '1') { digits = digits.slice(1); }
		if (digits.length !== 10) { return String(text === null || text === undefined ? '' : text); }
		return '(' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6);
	}

	function phoneHref(text) {
		var digits = phoneDigits(text);
		if (!digits) { return ''; }
		if (digits.length === 10) { digits = '1' + digits; }
		return 'tel:+' + digits;
	}

	function maskEmailText(text) {
		var emailText = String(text || '');
		var atIndex = emailText.lastIndexOf('@');
		if (atIndex <= 0) { return '\u2022\u2022\u2022'; }
		return emailText.charAt(0) + '***' + emailText.slice(atIndex);
	}

	function maskPhoneText(text) {
		var digits = phoneDigits(text);
		if (digits.length === 11 && digits.charAt(0) === '1') { digits = digits.slice(1); }
		if (digits.length === 10) {
			return '(' + digits.slice(0, 3) + ') \u2022\u2022\u2022-\u2022\u2022' + digits.slice(8);
		}
		if (digits.length > 4) {
			return '\u2022\u2022\u2022\u2022' + digits.slice(-2);
		}
		return '\u2022\u2022\u2022';
	}

	function parseDateText(text) {
		var match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/.exec(String(text || ''));
		if (!match) { return null; }
		var year = parseInt(match[1], 10);
		var month = parseInt(match[2], 10) - 1;
		var day = parseInt(match[3], 10);
		if (!match[4]) {
			return { date: new Date(Date.UTC(year, month, day)), hasTime: false };
		}
		var hour = parseInt(match[4], 10);
		var minute = parseInt(match[5], 10);
		var second = match[6] ? parseInt(match[6], 10) : 0;
		if (match[7]) {
			var normalized = match[1] + '-' + match[2] + '-' + match[3] + 'T' + match[4] + ':' + match[5] + ':' +
				(match[6] || '00') + match[7];
			var zonedDate = new Date(normalized);
			if (isNaN(zonedDate.getTime())) { return null; }
			return { date: zonedDate, hasTime: true };
		}
		return { date: new Date(year, month, day, hour, minute, second), hasTime: true };
	}

	function formatDateValue(date, includeTime, timeZone) {
		var options = {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		};
		if (includeTime) {
			options.hour = '2-digit';
			options.minute = '2-digit';
			options.hourCycle = 'h23';
		}
		if (timeZone) { options.timeZone = timeZone; }
		var parts = null;
		try {
			parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(date);
		} catch (error) {
			delete options.timeZone;
			try {
				parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(date);
			} catch (innerError) {
				return '';
			}
		}
		var values = {};
		parts.forEach(function (part) { values[part.type] = part.value; });
		if (!values.day || !values.month || !values.year) { return ''; }
		var dateText = (values.weekday ? values.weekday + ' ' : '') + values.day + ' ' + values.month + ' ' + values.year;
		if (!includeTime) { return dateText; }
		var hourText = values.hour === '24' ? '00' : values.hour;
		if (!hourText || !values.minute) { return dateText; }
		return dateText + ', ' + hourText + ':' + values.minute;
	}

	function humanDateText(text) {
		var parsed = parseDateText(text);
		if (!parsed) { return ''; }
		if (!parsed.hasTime) { return formatDateValue(parsed.date, false, 'UTC'); }
		return formatDateValue(parsed.date, true, paramState.timeZone);
	}

	function humanDateTimeText(text) {
		return humanDateText(text);
	}

	function humanNowText() {
		var options = {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		};
		if (paramState.timeZone) { options.timeZone = paramState.timeZone; }
		try {
			return new Intl.DateTimeFormat('en-GB', options).format(new Date());
		} catch (error) {
			delete options.timeZone;
			try {
				return new Intl.DateTimeFormat('en-GB', options).format(new Date());
			} catch (innerError) {
				return new Date().toISOString();
			}
		}
	}

	function numberText(text) {
		var rawText = String(text || '');
		if (/^-?\d+$/.test(rawText)) {
			try {
				return new Intl.NumberFormat('en-US').format(parseInt(rawText, 10));
			} catch (error) {
				return rawText;
			}
		}
		return rawText;
	}

	function scalarText(value) {
		if (value === null || value === undefined) { return 'empty'; }
		if (typeof value === 'object') {
			try { return JSON.stringify(value); } catch (error) { return 'structured value'; }
		}
		return String(value);
	}

	function structuredValueText(rawValue) {
		var jsonText = '';
		try { jsonText = JSON.stringify(rawValue); } catch (error) { jsonText = String(rawValue); }
		if (jsonText && jsonText.length > 300) {
			return 'Stored as structured data. Open the raw data block to read it.';
		}
		if (Array.isArray(rawValue)) {
			return rawValue.map(function (item) { return scalarText(item); }).join(', ');
		}
		return Object.keys(rawValue).map(function (key) {
			return key + ': ' + scalarText(rawValue[key]);
		}).join(' \u00b7 ');
	}

	function booleanValueText(text) {
		var value = String(text || '').trim().toLowerCase();
		if (value === 'yes' || value === 'true' || value === 'y') { return 'Yes'; }
		if (value === 'no' || value === 'false' || value === 'n') { return 'No'; }
		return String(text || '');
	}

	/* ── field models ──────────────────────────────────────────────── */

	function buildFieldModels(submission) {
		var models = [];
		Object.keys(submission.values).forEach(function (key) {
			if (METADATA_VALUE_KEYS.indexOf(key) !== -1) { return; }
			var rawValue = submission.values[key];
			var mapEntry = isPlainObject(paramState.fieldMap[key]) ? paramState.fieldMap[key] : {};
			var isComplex = Boolean(rawValue) && typeof rawValue === 'object';
			var type = mapEntry.type ? normalizeFieldType(mapEntry.type) : detectFieldType(key, rawValue);
			if (isComplex) { type = 'structured'; }
			var model = {
				key: key,
				label: mapEntry.label ? String(mapEntry.label) : deriveLabel(key),
				type: type,
				group: mapEntry.group ? String(mapEntry.group) : autoGroupOf(key),
				width: typeof mapEntry.width === 'number' ? mapEntry.width : null,
				rawValue: rawValue,
				textValue: isComplex ? '' : stringOf(rawValue),
				isComplex: isComplex
			};
			models.push(model);
		});
		return models;
	}

	function groupFieldModels(models) {
		var groups = [];
		var groupsByKey = {};
		GROUP_ORDER.forEach(function (groupKey) {
			var group = { key: groupKey, title: groupTitleOf(groupKey), fields: [] };
			groupsByKey[groupKey] = group;
			groups.push(group);
		});
		models.forEach(function (model) {
			var group = groupsByKey[model.group];
			if (!group) {
				group = { key: model.group, title: groupTitleOf(model.group), fields: [] };
				groupsByKey[model.group] = group;
				groups.push(group);
			}
			group.fields.push(model);
		});
		return groups.filter(function (group) { return group.fields.length > 0; });
	}

	function findModelByKey(models, wantedKey) {
		var index;
		for (index = 0; index < models.length; index += 1) {
			if (models[index].key === wantedKey) { return models[index]; }
		}
		return null;
	}

	function firstModelOfType(models, wantedType) {
		var index;
		for (index = 0; index < models.length; index += 1) {
			if (models[index].type === wantedType && String(models[index].textValue).trim()) { return models[index]; }
		}
		return null;
	}

	function personNameModelOf(models) {
		var personFields = models.filter(function (model) { return model.group === 'person'; });
		var index;
		for (index = 0; index < NAME_KEY_ORDER.length; index += 1) {
			var found = findModelByKey(personFields, NAME_KEY_ORDER[index]);
			if (found && String(found.textValue).trim()) { return found; }
		}
		for (index = 0; index < personFields.length; index += 1) {
			if (/name/i.test(personFields[index].key) && String(personFields[index].textValue).trim()) {
				return personFields[index];
			}
		}
		return null;
	}

	function personNameOf(models) {
		var nameModel = personNameModelOf(models);
		return nameModel ? String(nameModel.textValue).trim() : '';
	}

	function personChipModelOf(models, nameModel) {
		var personFields = models.filter(function (model) { return model.group === 'person'; });
		var index;
		for (index = 0; index < CHIP_KEY_ORDER.length; index += 1) {
			var found = findModelByKey(personFields, CHIP_KEY_ORDER[index]);
			if (found && found !== nameModel && String(found.textValue).trim()) { return found; }
		}
		for (index = 0; index < personFields.length; index += 1) {
			var model = personFields[index];
			if (model === nameModel) { continue; }
			if (String(model.textValue).trim() && /grade|role|position|level/i.test(model.key)) { return model; }
		}
		return null;
	}

	/* ── value rendering ───────────────────────────────────────────── */

	function buildLinkValue(url, text, title) {
		var link = createElement('a', 'fsv-link', text);
		link.setAttribute('href', url);
		if (title) { link.title = title; }
		link.addEventListener('click', function (event) {
			if (event && typeof event.preventDefault === 'function') { event.preventDefault(); }
			openExternal(url);
		});
		return link;
	}

	function buildEmailValue(model, extraClass) {
		var address = String(model.textValue || '').trim().toLowerCase();
		if (!address) { return createElement('span', 'fsv-value-empty', 'Not provided'); }
		if (uiState.ui.maskContacts) {
			return createElement('span', 'fsv-value fsv-value-masked' + (extraClass ? ' ' + extraClass : ''), maskEmailText(address));
		}
		return buildLinkValue('mailto:' + address, address, 'Write to ' + address);
	}

	function buildPhoneValue(model, extraClass) {
		var formatted = formatPhoneText(model.textValue);
		if (!String(formatted).trim()) { return createElement('span', 'fsv-value-empty', 'Not provided'); }
		if (uiState.ui.maskContacts) {
			return createElement('span', 'fsv-value fsv-value-masked' + (extraClass ? ' ' + extraClass : ''), maskPhoneText(formatted));
		}
		var href = phoneHref(model.textValue);
		if (!href) { return createElement('span', 'fsv-value' + (extraClass ? ' ' + extraClass : ''), formatted); }
		return buildLinkValue(href, formatted, 'Call ' + formatted);
	}

	function buildDateValue(model) {
		var human = humanDateText(model.textValue);
		if (!human) { return createElement('span', 'fsv-value', model.textValue); }
		var valueNode = createElement('span', 'fsv-value', human);
		valueNode.title = model.textValue;
		return valueNode;
	}

	function buildBooleanValue(model) {
		var label = booleanValueText(model.textValue);
		if (label === 'Yes') { return createElement('span', 'fsv-badge fsv-badge-yes', 'Yes'); }
		if (label === 'No') { return createElement('span', 'fsv-badge fsv-badge-no', 'No'); }
		return createElement('span', 'fsv-value', label);
	}

	function buildUrlValue(model) {
		var urlText = String(model.textValue || '').trim();
		var target = urlText;
		if (/^www\./i.test(urlText)) { target = 'https://' + urlText; }
		if (!/^https?:\/\//i.test(target)) { target = 'https://' + target; }
		return buildLinkValue(target, urlText, 'Open ' + urlText);
	}

	function buildStructuredValue(model) {
		return createElement('span', 'fsv-value fsv-value-long', structuredValueText(model.rawValue));
	}

	function buildValueNode(model) {
		if (model.isComplex) { return buildStructuredValue(model); }
		if (model.type === 'empty' || !String(model.textValue).trim()) {
			return createElement('span', 'fsv-value-empty', 'Not provided');
		}
		if (model.type === 'email') { return buildEmailValue(model); }
		if (model.type === 'phone') { return buildPhoneValue(model); }
		if (model.type === 'date') { return buildDateValue(model); }
		if (model.type === 'boolean') { return buildBooleanValue(model); }
		if (model.type === 'number') { return createElement('span', 'fsv-value fsv-value-number', numberText(model.textValue)); }
		if (model.type === 'url') { return buildUrlValue(model); }
		if (model.type === 'long') { return createElement('span', 'fsv-value fsv-value-long', model.textValue); }
		return createElement('span', 'fsv-value', model.textValue);
	}

	function buildFieldRow(model) {
		var isWide = model.type === 'long' || model.isComplex || (typeof model.width === 'number' && model.width >= 260);
		var row = createElement('div', 'fsv-field' + (isWide ? ' fsv-field-wide' : ''));
		if (typeof model.width === 'number' && model.width > 0) { row.style.minWidth = model.width + 'px'; }
		row.appendChild(createElement('span', 'fsv-label', model.label));
		row.appendChild(buildValueNode(model));
		if (model.isComplex) {
			row.appendChild(createElement('p', 'fsv-structured-note', 'This answer is structured data. The exact value is in the raw data block.'));
		}
		return row;
	}

	function buildConsentRow(model) {
		var row = createElement('div', 'fsv-field fsv-consent-row');
		var sentence = createElement('p', 'fsv-consent-line');
		sentence.appendChild(createElement('span', 'fsv-consent-label', consentLabelOf(model) + ': '));
		var consentValue = String(model.textValue).trim().toLowerCase();
		if (model.isComplex || !consentValue) {
			sentence.appendChild(createElement('span', 'fsv-consent-missing', 'not given'));
		} else if (consentValue === 'yes' || consentValue === 'true' || consentValue === 'y') {
			sentence.appendChild(createElement('span', 'fsv-badge fsv-badge-yes', 'yes'));
		} else if (consentValue === 'no' || consentValue === 'false' || consentValue === 'n') {
			sentence.appendChild(createElement('span', 'fsv-badge fsv-badge-no', 'no'));
		} else {
			sentence.appendChild(createElement('span', 'fsv-value', model.textValue));
		}
		row.appendChild(sentence);
		return row;
	}

	/* ── cards ─────────────────────────────────────────────────────── */

	function buildSectionCard(group) {
		var card = createElement('section', 'fsv-card fsv-section');
		card.appendChild(createElement('h2', 'fsv-card-title', group.title));
		var fieldsWrap = createElement('div', 'fsv-fields');
		if (group.fields.length === 0) {
			fieldsWrap.appendChild(createElement('p', 'fsv-empty-note fsv-consent-missing', 'Email opt-in: not given'));
		} else {
			group.fields.forEach(function (model) {
				fieldsWrap.appendChild(group.key === 'consents' ? buildConsentRow(model) : buildFieldRow(model));
			});
		}
		card.appendChild(fieldsWrap);
		return card;
	}

	function buildSectionsArea(submission, models) {
		var grid = createElement('div', 'fsv-sections');
		var groups = groupFieldModels(models).filter(function (group) { return group.key !== 'person'; });
		var hasConsents = groups.some(function (group) { return group.key === 'consents'; });
		if (!hasConsents && models.length > 0) {
			var syntheticGroup = { key: 'consents', title: groupTitleOf('consents'), fields: [] };
			var insertIndex = groups.length;
			groups.forEach(function (group, groupIndex) {
				if ((group.key === 'event' || group.key === 'contact') && insertIndex === groups.length) {
					insertIndex = groupIndex + 1;
				}
			});
			groups.splice(insertIndex, 0, syntheticGroup);
		}
		groups.forEach(function (group) {
			grid.appendChild(buildSectionCard(group));
		});
		if (groups.length === 0) { return null; }
		return grid;
	}

	function buildIdentityCard(submission, models) {
		var card = createElement('section', 'fsv-card fsv-identity');
		if (models.length === 0) {
			card.appendChild(createElement('h2', 'fsv-card-title', 'Submission'));
			card.appendChild(createElement('p', 'fsv-empty-note', 'No answers were stored for this submission.'));
			return card;
		}
		var nameModel = personNameModelOf(models);
		var chipModel = personChipModelOf(models, nameModel);
		var head = createElement('div', 'fsv-identity-head');
		if (nameModel) {
			head.appendChild(createElement('p', 'fsv-person-name', String(nameModel.textValue).trim()));
		} else {
			head.appendChild(createElement('p', 'fsv-person-name fsv-person-name-muted', 'Name not provided'));
		}
		if (chipModel) {
			head.appendChild(createElement('span', 'fsv-chip', String(chipModel.textValue).trim()));
		}
		card.appendChild(head);

		var emailModel = firstModelOfType(models, 'email');
		var phoneModel = firstModelOfType(models, 'phone');
		if (emailModel || phoneModel) {
			var contactLine = createElement('div', 'fsv-identity-contact');
			if (emailModel) { contactLine.appendChild(buildEmailValue(emailModel)); }
			if (phoneModel) { contactLine.appendChild(buildPhoneValue(phoneModel)); }
			card.appendChild(contactLine);
		}

		var personFields = models.filter(function (model) { return model.group === 'person'; });
		var pairFields = personFields.filter(function (model) {
			return model !== nameModel && model !== chipModel;
		});
		if (pairFields.length > 0) {
			var pairs = createElement('div', 'fsv-identity-pairs');
			pairFields.forEach(function (model) { pairs.appendChild(buildFieldRow(model)); });
			card.appendChild(pairs);
		}
		return card;
	}

	function buildWarningLine(warnings) {
		var line = createElement('p', 'fsv-warning');
		line.textContent = warnings.join(' ');
		return line;
	}

	function buildSubline(submission) {
		var subline = createElement('p', 'fsv-subline');
		var submittedHuman = humanDateText(submission.submittedAt);
		if (submittedHuman) {
			subline.appendChild(createElement('span', 'fsv-subline-item', submittedHuman));
		}
		if (submission.pagePath) {
			if (paramState.websiteBaseUrl) {
				var base = paramState.websiteBaseUrl.replace(/\/+$/, '');
				var path = submission.pagePath.charAt(0) === '/' ? submission.pagePath : '/' + submission.pagePath;
				var pageLink = buildLinkValue(base + path, submission.pagePath, 'Open ' + base + path);
				pageLink.className = 'fsv-link fsv-subline-item';
				subline.appendChild(pageLink);
			} else {
				subline.appendChild(createElement('span', 'fsv-subline-item', submission.pagePath));
			}
		}
		if (subline.childNodes.length === 0) { return null; }
		return subline;
	}

	function buildViewOptions() {
		var row = createElement('div', 'fsv-view-options');
		var label = createElement('label', 'fsv-switch');
		var input = document.createElement('input');
		input.type = 'checkbox';
		input.className = 'fsv-switch-input';
		input.checked = Boolean(uiState.ui.maskContacts);
		input.addEventListener('change', function () {
			uiState.ui.maskContacts = Boolean(input.checked);
			persistUiState();
			renderSubmission(currentFields);
		});
		label.appendChild(input);
		label.appendChild(createElement('span', 'fsv-switch-text', 'Hide contact details'));
		row.appendChild(label);
		row.appendChild(createElement('span', 'fsv-switch-note', 'The raw data block always shows the true values, because it is the audit trail.'));
		return row;
	}

	function buildActionBar(submission, models) {
		var bar = createElement('div', 'fsv-actionbar');
		var emailModel = firstModelOfType(models, 'email');
		if (emailModel) {
			var address = String(emailModel.textValue).trim().toLowerCase();
			bar.appendChild(actionButton('Reply by email', 'mail', function () {
				openExternal('mailto:' + address);
			}, 'fsv-btn-primary'));
		}
		bar.appendChild(actionButton('Copy summary', 'copy', function () {
			copyToClipboard(buildSummaryText(submission, models), 'Summary copied.');
		}));
		bar.appendChild(actionButton('Copy JSON', 'code', function () {
			copyToClipboard(jsonTextOf(submission.record), 'Record JSON copied.');
		}));
		bar.appendChild(actionButton('Print / PDF', 'print', function () {
			printSubmission(submission, models);
		}));
		return bar;
	}

	function buildLetterhead(submission, models) {
		var header = createElement('header', 'fsv-letterhead');
		var top = createElement('div', 'fsv-letterhead-top');
		var identityColumn = createElement('div', 'fsv-letterhead-id');
		identityColumn.appendChild(createElement('p', 'fsv-kicker', 'Form submission'));
		identityColumn.appendChild(createElement('h1', 'fsv-title', formLabelOf(submission)));
		var subline = buildSubline(submission);
		if (subline) { identityColumn.appendChild(subline); }
		top.appendChild(identityColumn);
		top.appendChild(buildActionBar(submission, models));
		header.appendChild(top);
		header.appendChild(buildViewOptions());
		return header;
	}

	/* ── record card ───────────────────────────────────────────────── */

	function timestampsShowUpdate(submission) {
		if (!submission.created || !submission.updated) { return false; }
		var createdDate = new Date(submission.created);
		var updatedDate = new Date(submission.updated);
		if (isNaN(createdDate.getTime()) || isNaN(updatedDate.getTime())) { return false; }
		return (updatedDate.getTime() - createdDate.getTime()) > UPDATED_CHIP_THRESHOLD_MS;
	}

	function buildMetaRow(labelText, valueText, options) {
		var settings = options || {};
		var row = createElement('div', 'fsv-meta-row');
		row.appendChild(createElement('span', 'fsv-label', labelText));
		var valueWrap = createElement('div', 'fsv-meta-value');
		if (valueText) {
			var displayText = settings.truncate ? truncateText(valueText, 26) : valueText;
			if (settings.linkUrl) {
				var link = buildLinkValue(settings.linkUrl, displayText, settings.linkUrl);
				link.className = 'fsv-link fsv-mono';
				valueWrap.appendChild(link);
			} else {
				var valueNode = createElement('span', settings.mono ? 'fsv-mono' : 'fsv-value', displayText);
				if (settings.truncate && displayText !== valueText) { valueNode.title = valueText; }
				valueWrap.appendChild(valueNode);
			}
			if (settings.copy) {
				valueWrap.appendChild(miniButton('Copy', function () {
					copyToClipboard(valueText, labelText + ' copied.');
				}));
			}
		} else {
			valueWrap.appendChild(createElement('span', 'fsv-value-empty', 'Not provided'));
		}
		row.appendChild(valueWrap);
		return row;
	}

	function buildMetadataCard(submission) {
		var details = createElement('details', 'fsv-card fsv-meta-card');
		details.open = window.innerWidth > 720;
		var summary = createElement('summary', 'fsv-meta-summary');
		summary.appendChild(createElement('span', 'fsv-card-title', 'Record'));
		if (timestampsShowUpdate(submission)) {
			summary.appendChild(createElement('span', 'fsv-updated-chip', 'Updated after submission'));
		}
		details.appendChild(summary);

		var grid = createElement('div', 'fsv-meta-grid');
		grid.appendChild(buildMetaRow('Record ID', submission.recordId, { mono: true, copy: true, truncate: true }));
		grid.appendChild(buildMetaRow('Form type ID', submission.formTypeId, { mono: true }));
		grid.appendChild(buildMetaRow('Source application', submission.sourceType, { mono: true }));
		grid.appendChild(buildMetaRow('Content ID', submission.contentId, { mono: true }));
		grid.appendChild(buildMetaRow('Folder type ID', submission.typeId, { mono: true }));
		grid.appendChild(buildMetaRow('Submitted at', submission.submittedAt, { mono: true }));
		grid.appendChild(buildMetaRow('Created', submission.created, { mono: true }));
		grid.appendChild(buildMetaRow('Updated', submission.updated, { mono: true }));

		var pageOptions = { mono: true };
		if (submission.pagePath && paramState.websiteBaseUrl) {
			var base = paramState.websiteBaseUrl.replace(/\/+$/, '');
			var path = submission.pagePath.charAt(0) === '/' ? submission.pagePath : '/' + submission.pagePath;
			pageOptions.linkUrl = base + path;
		}
		grid.appendChild(buildMetaRow('Page path', submission.pagePath, pageOptions));

		details.appendChild(grid);
		return details;
	}

	/* ── raw data ──────────────────────────────────────────────────── */

	function jsonTextOf(value) {
		try {
			return JSON.stringify(value === undefined ? null : value, null, 2);
		} catch (error) {
			return String(value);
		}
	}

	function buildRawBlock(submission) {
		var details = createElement('details', 'fsv-card fsv-raw');
		details.open = Boolean(uiState.ui.showRaw);
		var summary = createElement('summary', 'fsv-raw-summary');
		summary.appendChild(createElement('span', 'fsv-card-title', 'Raw data'));
		summary.appendChild(createElement('span', 'fsv-raw-note', 'Exact JSON as received'));
		details.appendChild(summary);

		var body = createElement('div', 'fsv-raw-body');
		var tabs = createElement('div', 'fsv-tabs');
		var answersTab = createElement('button', 'fsv-tab', 'Answers');
		answersTab.type = 'button';
		var recordTab = createElement('button', 'fsv-tab', 'Full record');
		recordTab.type = 'button';
		tabs.appendChild(answersTab);
		tabs.appendChild(recordTab);

		var answersCode = createElement('pre', 'fsv-code');
		answersCode.textContent = jsonTextOf(submission.values);
		var recordCode = createElement('pre', 'fsv-code');
		recordCode.textContent = jsonTextOf(submission.record);

		function applyTabState(tabName) {
			activeRawTab = tabName === 'full' ? 'full' : 'answers';
			answersCode.hidden = activeRawTab !== 'answers';
			recordCode.hidden = activeRawTab !== 'full';
			answersTab.className = 'fsv-tab' + (activeRawTab === 'answers' ? ' is-active' : '');
			recordTab.className = 'fsv-tab' + (activeRawTab === 'full' ? ' is-active' : '');
		}
		answersTab.addEventListener('click', function () { applyTabState('answers'); });
		recordTab.addEventListener('click', function () { applyTabState('full'); });

		var toolbar = createElement('div', 'fsv-raw-toolbar');
		toolbar.appendChild(miniButton('Copy answers JSON', function () {
			copyToClipboard(answersCode.textContent, 'Answers JSON copied.');
		}));
		toolbar.appendChild(miniButton('Copy full record JSON', function () {
			copyToClipboard(recordCode.textContent, 'Full record JSON copied.');
		}));

		body.appendChild(tabs);
		body.appendChild(toolbar);
		body.appendChild(answersCode);
		body.appendChild(recordCode);
		body.appendChild(createElement('p', 'fsv-raw-note', 'These two blocks are the audit trail. Contact masking never changes them.'));
		details.appendChild(body);

		applyTabState(activeRawTab);

		details.addEventListener('toggle', function () {
			if (uiState.ui.showRaw !== Boolean(details.open)) {
				uiState.ui.showRaw = Boolean(details.open);
				persistUiState();
			}
		});
		return details;
	}

	/* ── diagnostics ───────────────────────────────────────────────── */

	function buildDiagnosticsBlock(submission, models) {
		var details = createElement('details', 'fsv-card fsv-diagnostics');
		var summary = createElement('summary', 'fsv-meta-summary');
		summary.appendChild(createElement('span', 'fsv-card-title', 'Fields (diagnostics)'));
		summary.appendChild(createElement('span', 'fsv-raw-note', models.length + ' key(s) found'));
		details.appendChild(summary);

		var list = createElement('ul', 'fsv-diag-list');
		models.forEach(function (model) {
			var item = createElement('li', 'fsv-diag-item');
			item.appendChild(createElement('span', 'fsv-diag-key', model.key));
			item.appendChild(createElement('span', 'fsv-diag-example', truncateText(summaryValueText(model), 70)));
			list.appendChild(item);
		});
		if (models.length === 0) {
			list.appendChild(createElement('li', 'fsv-diag-item', 'No answer keys were found in this record.'));
		}
		details.appendChild(list);

		var fieldMapSample = {};
		models.forEach(function (model) {
			fieldMapSample[model.key] = {
				label: model.label,
				type: model.type === 'structured' ? 'text' : model.type,
				group: model.group
			};
		});
		var sampleCode = createElement('pre', 'fsv-code');
		sampleCode.textContent = jsonTextOf(fieldMapSample);
		details.appendChild(sampleCode);
		details.appendChild(miniButton('Copy fieldMap JSON', function () {
			copyToClipboard(sampleCode.textContent, 'fieldMap JSON copied.');
		}));
		return details;
	}

	var CONFIGURATION_HELP = [
		['fieldMap', 'JSON object keyed by answer key: { "phone": { "label": "Phone", "type": "phone", "group": "contact", "width": 150 } }. Overrides the label, the value type, the section and the minimum width of one answer. Types: text, email, phone, date, boolean, long, number, url.'],
		['fieldGroups', 'JSON object that renames a section, for example { "event": "Exam" }.'],
		['formTypeLabels', 'JSON object that maps a formTypeId to the label shown as the page title, for example { "contact-message": "Contact message" }.'],
		['brandName', 'Name printed in the letterhead of the print / PDF document. Default: Form submission.'],
		['accentColor', 'Hex colour of the letterhead rule, the links and the badges. Default: #004E89.'],
		['timeZone', 'IANA time zone used for every date and time, for example America/Vancouver. Empty means the browser time zone.'],
		['websiteBaseUrl', 'When set, the stored page path becomes a link to this address plus the path, for example https://example.com.'],
		['maskContactDetails', 'yes starts with email addresses and phone numbers hidden. The reader can still toggle it inside the tool, and the raw data block always shows the true values.'],
		['showRawJson', 'yes shows the raw data block with the answers object and the full record. Default: yes.'],
		['showDiagnostics', 'yes adds a Fields panel that lists every key found in the record and a ready to copy fieldMap JSON, so an administrator can learn the real keys. Default: no.']
	];

	function buildConfigurationNote() {
		var details = createElement('details', 'fsv-card fsv-config');
		var summary = createElement('summary', 'fsv-meta-summary');
		summary.appendChild(createElement('span', 'fsv-card-title', 'How to configure'));
		summary.appendChild(createElement('span', 'fsv-raw-note', 'Optional parameters'));
		details.appendChild(summary);
		details.appendChild(createElement('p', 'fsv-raw-note',
			'Every parameter is optional. This viewer only reads the submission record and never writes to it; the only value it saves is its own small view state.'));
		var list = createElement('div', 'fsv-config-list');
		CONFIGURATION_HELP.forEach(function (entry) {
			var row = createElement('div', 'fsv-config-row');
			row.appendChild(createElement('span', 'fsv-config-name', entry[0]));
			row.appendChild(createElement('span', 'fsv-config-text', entry[1]));
			list.appendChild(row);
		});
		details.appendChild(list);
		return details;
	}

	function buildFooterLine() {
		return createElement('p', 'fsv-footer-line',
			'This record was submitted by a visitor through a public form. Values shown here are exactly as received.');
	}

	/* ── labels for the document title and the summary ──────────────── */

	function formLabelOf(submission) {
		if (submission.formTypeId && paramState.formTypeLabels[submission.formTypeId] !== undefined) {
			var configuredLabel = String(paramState.formTypeLabels[submission.formTypeId]).trim();
			if (configuredLabel) { return configuredLabel; }
		}
		if (submission.formTypeId) { return submission.formTypeId; }
		return 'Submission';
	}

	function documentTitleOf(submission, models) {
		var label = formLabelOf(submission);
		var personName = personNameOf(models);
		return personName ? label + ' - ' + personName : label;
	}

	function updateDocumentTitle(submission, models) {
		try { document.title = documentTitleOf(submission, models); } catch (error) { }
	}

	function summaryValueText(model) {
		if (model.isComplex) { return structuredValueText(model.rawValue); }
		var text = String(model.textValue || '');
		if (!text.trim()) { return ''; }
		if (model.type === 'email') {
			var address = text.trim().toLowerCase();
			return uiState.ui.maskContacts ? maskEmailText(address) : address;
		}
		if (model.type === 'phone') {
			var formatted = formatPhoneText(text);
			return uiState.ui.maskContacts ? maskPhoneText(formatted) : formatted;
		}
		if (model.type === 'date') {
			var human = humanDateText(text);
			return human || text;
		}
		if (model.type === 'boolean') {
			return booleanValueText(text).toLowerCase();
		}
		if (model.type === 'number') { return numberText(text); }
		return text;
	}

	function buildSummaryText(submission, models) {
		var lines = [formLabelOf(submission)];
		var submittedHuman = humanDateTimeText(submission.submittedAt);
		if (submittedHuman) { lines.push('Submitted: ' + submittedHuman); }
		groupFieldModels(models).forEach(function (group) {
			group.fields.forEach(function (model) {
				var valueText = summaryValueText(model);
				if (!String(valueText).trim()) { return; }
				var labelText = group.key === 'consents' ? consentLabelOf(model) : model.label;
				lines.push(labelText + ': ' + valueText);
			});
		});
		if (submission.pagePath) { lines.push('Page: ' + submission.pagePath); }
		lines.push('');
		if (submission.recordId) { lines.push('Record: ' + submission.recordId); }
		return lines.join('\n').replace(/[ \t]+$/gm, '').replace(/\n+$/, '');
	}

	/* ── clipboard ─────────────────────────────────────────────────── */

	function legacyCopy(text) {
		try {
			var area = document.createElement('textarea');
			area.value = text;
			area.setAttribute('readonly', 'readonly');
			area.style.position = 'fixed';
			area.style.top = '-1000px';
			area.style.opacity = '0';
			document.body.appendChild(area);
			area.select();
			var copied = document.execCommand ? document.execCommand('copy') : false;
			document.body.removeChild(area);
			return Boolean(copied);
		} catch (error) {
			return false;
		}
	}

	function copyToClipboard(text, successMessage) {
		var value = String(text === null || text === undefined ? '' : text);
		if (!value) {
			notify('There is nothing to copy.', 'warning');
			return;
		}
		var finish = function (copied) {
			if (copied) {
				notify(successMessage || 'Copied.', 'success');
			} else {
				notify('Copying is blocked in this window. Select the text and copy it by hand.', 'error');
			}
		};
		try {
			if (navigator && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
				navigator.clipboard.writeText(value).then(function () {
					finish(true);
				}, function () {
					finish(legacyCopy(value));
				});
				return;
			}
		} catch (error) { }
		finish(legacyCopy(value));
	}

	/* ── print / PDF ───────────────────────────────────────────────── */

	function printValueTextOf(model) {
		var summaryText = summaryValueText(model);
		if (String(summaryText).trim()) { return summaryText; }
		return 'Not provided';
	}

	function buildPrintLetterhead(submission) {
		var submittedHuman = humanDateTimeText(submission.submittedAt);
		var headMeta = submittedHuman ? 'Submitted ' + escapeHtml(submittedHuman) : 'Submitted date not recorded';
		return '<div class="print-head"><div><p class="print-brand">' + escapeHtml(paramState.brandName) +
			'</p><h1 class="print-title">' + escapeHtml(formLabelOf(submission)) + '</h1></div>' +
			'<div class="print-head-meta">' + headMeta + '</div></div>';
	}

	function buildPrintIdentity(models) {
		if (models.length === 0) {
			return '<div class="print-identity"><p class="print-value print-empty">No answers were stored for this submission.</p></div>';
		}
		var nameModel = personNameModelOf(models);
		var chipModel = personChipModelOf(models, nameModel);
		var parts = [];
		parts.push('<div class="print-identity">');
		parts.push('<p class="print-person">' + escapeHtml(nameModel ? String(nameModel.textValue).trim() : 'Name not provided') +
			(chipModel ? '<span class="print-chip">' + escapeHtml(String(chipModel.textValue).trim()) + '</span>' : '') + '</p>');
		var emailModel = firstModelOfType(models, 'email');
		var phoneModel = firstModelOfType(models, 'phone');
		if (emailModel || phoneModel) {
			var contactBits = [];
			if (emailModel) { contactBits.push(escapeHtml(printValueTextOf(emailModel))); }
			if (phoneModel) { contactBits.push(escapeHtml(printValueTextOf(phoneModel))); }
			parts.push('<p class="print-contact">' + contactBits.join(' \u00b7 ') + '</p>');
		}
		var pairFields = models.filter(function (model) {
			return model.group === 'person' && model !== nameModel && model !== chipModel;
		});
		if (pairFields.length > 0) {
			parts.push('<div class="print-pairs">');
			pairFields.forEach(function (model) {
				parts.push('<div class="print-field"><span class="print-label">' + escapeHtml(model.label) +
					'</span><span class="print-value">' + escapeHtml(printValueTextOf(model)) + '</span></div>');
			});
			parts.push('</div>');
		}
		parts.push('</div>');
		return parts.join('');
	}

	function buildPrintSections(models) {
		var groups = groupFieldModels(models).filter(function (group) { return group.key !== 'person'; });
		var hasConsents = groups.some(function (group) { return group.key === 'consents'; });
		if (!hasConsents && models.length > 0) {
			var syntheticGroup = { key: 'consents', title: groupTitleOf('consents'), fields: [] };
			var insertIndex = groups.length;
			groups.forEach(function (group, groupIndex) {
				if ((group.key === 'event' || group.key === 'contact') && insertIndex === groups.length) {
					insertIndex = groupIndex + 1;
				}
			});
			groups.splice(insertIndex, 0, syntheticGroup);
		}
		if (groups.length === 0) { return ''; }
		var parts = ['<div class="print-sections">'];
		groups.forEach(function (group) {
			parts.push('<div class="print-section"><h2>' + escapeHtml(group.title) + '</h2>');
			if (group.fields.length === 0) {
				parts.push('<p class="print-value print-empty">Email opt-in: not given</p>');
			} else {
				group.fields.forEach(function (model) {
					if (group.key === 'consents') {
						parts.push('<div class="print-field"><span class="print-value">' + escapeHtml(consentLabelOf(model)) + ': ' +
							escapeHtml(String(summaryValueText(model)).trim() || 'not given') + '</span></div>');
					} else {
						parts.push('<div class="print-field"><span class="print-label">' + escapeHtml(model.label) +
							'</span><span class="print-value">' + escapeHtml(printValueTextOf(model)) + '</span></div>');
					}
				});
			}
			parts.push('</div>');
		});
		parts.push('</div>');
		return parts.join('');
	}

	function buildPrintMetadata(submission) {
		var rows = [
			['Record ID', submission.recordId],
			['Form type ID', submission.formTypeId],
			['Source application', submission.sourceType],
			['Content ID', submission.contentId],
			['Folder type ID', submission.typeId],
			['Submitted at', submission.submittedAt],
			['Created', submission.created],
			['Updated', submission.updated],
			['Page path', submission.pagePath]
		];
		var parts = ['<table class="print-meta-table">'];
		rows.forEach(function (row) {
			parts.push('<tr><th>' + escapeHtml(row[0]) + '</th><td class="print-mono">' +
				escapeHtml(row[1] || 'Not provided') + '</td></tr>');
		});
		parts.push('</table>');
		return parts.join('');
	}

	function buildPrintRaw(submission) {
		return '<div class="print-raw"><h2>Answers</h2><pre>' + escapeHtml(jsonTextOf(submission.values)) +
			'</pre><h2>Full record</h2><pre>' + escapeHtml(jsonTextOf(submission.record)) + '</pre></div>';
	}

	function buildPrintFooter() {
		var userName = '';
		try {
			var user = (typeof toolApi.getUser === 'function') ? toolApi.getUser() : null;
			if (user && user.name) { userName = String(user.name); }
		} catch (error) { }
		var generatedLine = 'Generated ' + humanNowText() + (userName ? ' by ' + userName : '');
		return '<div class="print-foot"><span>' + escapeHtml(generatedLine) + '</span><span class="print-page"></span></div>';
	}

	function buildStandaloneDocument(submission, models) {
		var parts = [];
		parts.push('<!DOCTYPE html>');
		parts.push('<html lang="en">');
		parts.push('<head>');
		parts.push('<meta charset="utf-8">');
		parts.push('<title>' + escapeHtml(documentTitleOf(submission, models)) + '</title>');
		parts.push('<style>' + PRINT_STYLESHEET.replace(/__ACCENT__/g, paramState.accentColor) + '</style>');
		parts.push('</head>');
		parts.push('<body>');
		parts.push('<div class="print-doc">');
		parts.push(buildPrintLetterhead(submission));
		parts.push(buildPrintIdentity(models));
		parts.push(buildPrintSections(models));
		parts.push(buildPrintMetadata(submission));
		if (uiState.ui.showRaw) { parts.push(buildPrintRaw(submission)); }
		parts.push(buildPrintFooter());
		parts.push('</div>');
		parts.push('</body>');
		parts.push('</html>');
		return parts.join('\n');
	}

	function sanitizeFilePart(text) {
		return String(text || 'record').replace(/[^A-Za-z0-9_-]+/g, '-');
	}

	function printSubmission(submission, models) {
		var documentHtml = buildStandaloneDocument(submission, models);
		var filename = 'submission-' + sanitizeFilePart(submission.recordId || 'record') + '.pdf';
		if (typeof toolApi.requestExportPdf === 'function') {
			try {
				toolApi.requestExportPdf({ html: documentHtml, filename: filename, landscape: false }, function (error, file) {
					if (error || !file || !file.url) {
						notify('The print document could not be stored, so the browser print dialog opens instead.', 'warning');
						fallbackPrint();
						return;
					}
					notify('Print document ready in a new tab.', 'success');
					openExternal(file.url);
				});
				return;
			} catch (error) {
				notify('The print document could not be built, so the browser print dialog opens instead.', 'warning');
			}
		}
		fallbackPrint();
	}

	function fallbackPrint() {
		try {
			window.print();
		} catch (error) {
			notify('Printing is not available in this window.', 'error');
		}
	}

	/* ── states ────────────────────────────────────────────────────── */

	function paintEmptyState(host) {
		var box = createElement('div', 'fsv-empty-state');
		box.appendChild(createElement('p', 'fsv-empty-title', 'No submission selected'));
		box.appendChild(createElement('p', 'fsv-empty-text',
			'This tool shows one form submission. Open a submission from the form application folder to see its details.'));
		host.appendChild(box);
	}

	function paintErrorState(host, error) {
		var box = createElement('div', 'fsv-empty-state fsv-error-state');
		box.appendChild(createElement('p', 'fsv-empty-title', 'This submission could not be displayed'));
		box.appendChild(createElement('p', 'fsv-empty-text',
			'The record loaded, but the viewer hit a problem while building the page. Copy the technical details and send them to your administrator.'));
		box.appendChild(miniButton('Copy technical details', function () {
			var details = 'FormSubmissionViewer build ' + TOOL_BUILD + '\n' +
				(error && error.stack ? error.stack : String(error));
			copyToClipboard(details, 'Technical details copied.');
		}));
		host.appendChild(box);
		logInfo('render-failed', (error && error.message) ? error.message : 'unknown error');
	}

	function paintSubmission(host, submission) {
		var models = buildFieldModels(submission);
		var documentWrap = createElement('div', 'fsv-doc' + (hasPaintedOnce ? '' : ' fsv-first-paint'));
		if (paramState.warnings.length > 0) { documentWrap.appendChild(buildWarningLine(paramState.warnings)); }
		documentWrap.appendChild(buildLetterhead(submission, models));
		documentWrap.appendChild(buildIdentityCard(submission, models));
		var sectionsArea = buildSectionsArea(submission, models);
		if (sectionsArea) { documentWrap.appendChild(sectionsArea); }
		documentWrap.appendChild(buildMetadataCard(submission));
		if (paramState.showRawJson) { documentWrap.appendChild(buildRawBlock(submission)); }
		if (paramState.showDiagnostics) { documentWrap.appendChild(buildDiagnosticsBlock(submission, models)); }
		documentWrap.appendChild(buildFooterLine());
		documentWrap.appendChild(buildConfigurationNote());
		host.appendChild(documentWrap);
		hasPaintedOnce = true;
		updateDocumentTitle(submission, models);
		logInfo('render', (submission.recordId ? 'record ' + submission.recordId : 'record') + ' answers=' + models.length);
	}

	function renderSubmission(fields) {
		var host = document.getElementById('fsv-host');
		if (!host) { return; }
		try {
			currentFields = fields || (typeof toolApi.getFields === 'function' ? toolApi.getFields() : {});
			paramState = readParameters();
			applyAccentColor();
			var submission = readSubmission(currentFields);
			host.textContent = '';
			if (!hasRecord(submission)) {
				paintEmptyState(host);
			} else {
				paintSubmission(host, submission);
			}
		} catch (error) {
			host.textContent = '';
			paintErrorState(host, error);
		}
		resizeTool();
	}

	/* ── saved state (UI only) ─────────────────────────────────────── */

	function persistUiState() {
		try {
			if (typeof toolApi.isReadOnly === 'function' && toolApi.isReadOnly()) { return; }
			if (typeof toolApi.setValue === 'function') {
				toolApi.setValue({
					version: STORAGE_VERSION,
					ui: {
						showRaw: Boolean(uiState.ui.showRaw),
						maskContacts: Boolean(uiState.ui.maskContacts)
					}
				});
			}
		} catch (error) {
			logInfo('ui-state-not-saved');
		}
	}

	function readInitialUiState(value) {
		var storedUi = (isPlainObject(value) && isPlainObject(value.ui)) ? value.ui : null;
		uiState = {
			version: STORAGE_VERSION,
			ui: {
				showRaw: storedUi ? Boolean(storedUi.showRaw) : false,
				maskContacts: storedUi && typeof storedUi.maskContacts === 'boolean' ? storedUi.maskContacts : false
			}
		};
		if (!storedUi && readParamRaw('maskContactDetails').trim().toLowerCase() === 'yes') {
			uiState.ui.maskContacts = true;
		}
	}

	/* ── parameters declaration ────────────────────────────────────── */

	function declareToolParameters() {
		if (typeof toolApi.declareParams !== 'function') { return; }
		try {
			toolApi.declareParams([
				{
					name: 'fieldMap',
					label: 'Field map',
					type: 'text',
					default: '{}',
					severity: 'goodToHave',
					hint: 'JSON object: field key to { "label": "Phone", "type": "phone", "group": "contact", "width": 150 }. Overrides the label, the value type and the section of any answer.'
				},
				{
					name: 'fieldGroups',
					label: 'Section titles',
					type: 'text',
					default: '{}',
					severity: 'optional',
					hint: 'JSON object: group key to display title, for example { "event": "Exam" } to rename the Event section.'
				},
				{
					name: 'formTypeLabels',
					label: 'Form type labels',
					type: 'text',
					default: '{}',
					severity: 'goodToHave',
					hint: 'JSON object: formTypeId to display label, for example { "contact-message": "Contact message" }. Used as the page title.'
				},
				{
					name: 'brandName',
					label: 'Brand name',
					type: 'text',
					default: 'Form submission',
					severity: 'optional',
					hint: 'Printed in the letterhead of the print / PDF document.'
				},
				{
					name: 'accentColor',
					label: 'Accent colour',
					type: 'text',
					default: '#004E89',
					severity: 'optional',
					hint: 'Hex colour of the letterhead rule, links and badges.'
				},
				{
					name: 'timeZone',
					label: 'Time zone',
					type: 'text',
					default: '',
					severity: 'optional',
					hint: 'IANA time zone for dates, for example America/Vancouver. Empty uses the browser time zone.'
				},
				{
					name: 'websiteBaseUrl',
					label: 'Website base URL',
					type: 'text',
					default: '',
					severity: 'optional',
					hint: 'When set, the page path becomes a link to this address plus the stored path, for example https://example.com.'
				},
				{
					name: 'maskContactDetails',
					label: 'Mask contact details',
					type: 'toggle',
					default: 'no',
					severity: 'optional',
					hint: 'yes starts with email addresses and phone numbers hidden. The reader can still toggle it inside the tool.'
				},
				{
					name: 'showRawJson',
					label: 'Show raw JSON',
					type: 'toggle',
					default: 'yes',
					severity: 'optional',
					hint: 'Shows the audit trail block with the answers object and the full record.'
				},
				{
					name: 'showDiagnostics',
					label: 'Show field diagnostics',
					type: 'toggle',
					default: 'no',
					severity: 'optional',
					hint: 'Adds a Fields panel that lists every key found in the record and a ready to copy fieldMap JSON.'
				}
			]);
		} catch (error) {
			logInfo('declare-params-failed');
		}
	}

	/* ── boot ──────────────────────────────────────────────────────── */

	function updateBuildBadge() {
		var badge = document.getElementById('fsv-build-badge');
		if (badge) { badge.textContent = 'tool build ' + TOOL_BUILD; }
	}

	updateBuildBadge();
	declareToolParameters();

	toolApi.onReady(function (value, fields) {
		readInitialUiState(value);
		renderSubmission(fields);
		if (typeof toolApi.onFieldsChange === 'function') {
			toolApi.onFieldsChange(function (nextFields) {
				renderSubmission(nextFields);
			});
		}
		if (typeof toolApi.onValueChange === 'function') {
			toolApi.onValueChange(function (nextValue) {
				var storedMask = (isPlainObject(nextValue) && isPlainObject(nextValue.ui)) ? nextValue.ui.maskContacts : undefined;
				if (typeof storedMask === 'boolean' && storedMask !== uiState.ui.maskContacts) {
					uiState.ui.maskContacts = storedMask;
					renderSubmission(currentFields);
				}
			});
		}
	});
})();
