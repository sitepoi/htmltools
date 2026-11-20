/* js build 2026-11-17-1 */
/* ───────────────────────────────────────────────────────────────────────
   Asset Drive
   Browse an asset library as folders derived from file paths, preview
   images, copy effective URLs, download files one by one and manage the
   records (rename, move, duplicate, star, lock, colour, tags, delete).

   Object-level html-tool (TYPE 1). All data lives in this field's value:
     { folderId, name, files: [FileRecord], emptyFolders: [string] }
   No network access, no browser dialogs, no storage APIs. Every outside
   action goes through the window.tool SDK.
   ─────────────────────────────────────────────────────────────────────── */
(function () {
	'use strict';

	var TOOL_BUILD = '2026-11-17-1';
	console.log('[TOOL:BOOT] build ' + TOOL_BUILD + ' AssetDrive');

	var toolApi = (typeof window !== 'undefined' && window.tool) ? window.tool : null;
	if (!toolApi || typeof toolApi.onReady !== 'function') {
		console.warn('[AssetDrive] The CMS tool SDK was not found, so the drive cannot start.');
		return;
	}

	var MAX_TAG_COUNT = 12;
	var MAX_TAG_LENGTH = 32;
	var COPY_FEEDBACK_MS = 1500;
	var FLASH_FEEDBACK_MS = 1700;
	var DOWNLOAD_STEP_MS = 350;
	var SIZE_WARN_BYTES = 900 * 1024;
	var VALID_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
	var COLOR_LABELS = { red: 'Red', orange: 'Orange', yellow: 'Yellow', green: 'Green', blue: 'Blue', purple: 'Purple' };
	var IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif', 'tiff'];
	var TYPE_EXTENSIONS = {
		image: IMAGE_EXTENSIONS,
		document: ['doc', 'docx', 'txt', 'rtf', 'odt', 'md', 'mdx', 'pages', 'tex'],
		spreadsheet: ['xls', 'xlsx', 'csv', 'tsv', 'ods', 'numbers'],
		presentation: ['ppt', 'pptx', 'odp', 'key'],
		pdf: ['pdf'],
		video: ['mp4', 'webm', 'mov', 'm4v', 'ogv', 'avi', 'mkv', 'wmv'],
		audio: ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus']
	};
	var MIME_BY_EXTENSION = {
		png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
		svg: 'image/svg+xml', bmp: 'image/bmp', ico: 'image/x-icon', avif: 'image/avif', tiff: 'image/tiff',
		pdf: 'application/pdf', csv: 'text/csv', txt: 'text/plain', md: 'text/markdown', json: 'application/json',
		doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg'
	};
	var TYPE_ICONS = { image: 'image', document: 'doc', spreadsheet: 'sheet', presentation: 'slides', pdf: 'doc', video: 'video', audio: 'audio', other: 'file' };

	var state = {
		value: emptyValue(),
		currentPath: '',
		search: '',
		typeFilter: 'all',
		sortBy: 'name',
		sortDir: 'asc',
		view: 'grid',
		selectMode: false,
		selectedIds: {},
		lastClickedId: '',
		visibleFileIds: [],
		detailId: '',
		readOnly: false,
		user: null,
		noIdentity: false,
		openMenu: '',
		context: null,
		modal: null,
		duplicateWarning: '',
		sizeWarned: false,
		titleEditing: false,
		lastLocalJson: '',
		bound: false,
		searchTimer: 0,
		resizeTimer: 0,
		downloadBusy: false
	};

	/* ── small helpers ─────────────────────────────────────────────────── */

	function byId(id) { return document.getElementById(id); }

	function esc(value) {
		return String(value === null || value === undefined ? '' : value)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	function escAttr(value) { return esc(value); }

	function icon(name, extraClass) {
		return '<svg class="ad-ico ' + (extraClass || '') + '" aria-hidden="true"><use href="#ad-i-' + name + '"></use></svg>';
	}

	function setText(id, text) {
		var element = byId(id);
		if (element) { element.textContent = text; }
	}

	function safeParam(name, fallback) {
		try {
			var value = toolApi.param(name, fallback);
			if (value === undefined || value === null || value === '') { return fallback; }
			return value;
		} catch (error) {
			return fallback;
		}
	}

	function driveLabel() { return String(safeParam('driveLabel', 'Asset Drive')); }
	function maxUploadMb() {
		var value = Number(safeParam('maxUploadSizeMb', '25'));
		return isFinite(value) && value > 0 ? value : 25;
	}
	function showSaveButton() { return String(safeParam('showSaveButton', 'no')).toLowerCase() === 'yes'; }

	function notify(message, severity) {
		try {
			if (toolApi && typeof toolApi.notify === 'function') { toolApi.notify(message, severity || 'info'); }
		} catch (error) {
			console.log('[AssetDrive] notify failed: ' + (error && error.message ? error.message : error));
		}
	}

	function resizeSoon() {
		if (state.resizeTimer) { window.clearTimeout(state.resizeTimer); }
		state.resizeTimer = window.setTimeout(function () {
			try { if (toolApi && typeof toolApi.resize === 'function') { toolApi.resize(); } } catch (error) { }
		}, 30);
	}

	function timeValue(value) {
		if (typeof value === 'number' && isFinite(value)) { return value > 0 ? value : 0; }
		if (typeof value === 'string' && value) {
			var parsed = Date.parse(value);
			if (isFinite(parsed)) { return parsed; }
		}
		return 0;
	}

	function formatBytes(bytes) {
		var size = Number(bytes);
		if (!isFinite(size) || size <= 0) { return '0 B'; }
		var units = ['B', 'KB', 'MB', 'GB', 'TB'];
		var index = Math.floor(Math.log(size) / Math.log(1024));
		if (index < 0) { index = 0; }
		if (index >= units.length) { index = units.length - 1; }
		var scaled = size / Math.pow(1024, index);
		var digits = index === 0 ? 0 : (scaled < 10 ? 1 : 0);
		return scaled.toFixed(digits) + ' ' + units[index];
	}

	function formatDate(value) {
		var milliseconds = timeValue(value);
		if (!milliseconds) { return '-'; }
		try {
			return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(milliseconds));
		} catch (error) {
			return new Date(milliseconds).toISOString().slice(0, 10);
		}
	}

	function formatDateTime(value) {
		var milliseconds = timeValue(value);
		if (!milliseconds) { return '-'; }
		try {
			return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(milliseconds));
		} catch (error) {
			return new Date(milliseconds).toISOString();
		}
	}

	function countLabel(count, singular, plural) {
		return count + ' ' + (count === 1 ? singular : (plural || singular + 's'));
	}

	function extensionOf(name) {
		var text = String(name || '');
		var dot = text.lastIndexOf('.');
		if (dot < 0 || dot === text.length - 1) { return ''; }
		return text.slice(dot + 1).toLowerCase();
	}

	function baseNameOf(path) {
		var text = String(path || '');
		var slash = text.lastIndexOf('/');
		return slash < 0 ? text : text.slice(slash + 1);
	}

	function dirNameOf(path) {
		var text = String(path || '');
		var slash = text.lastIndexOf('/');
		return slash < 0 ? '' : text.slice(0, slash);
	}

	function parentFolderOf(path) {
		return dirNameOf(String(path || ''));
	}

	function joinPath(folder, name) {
		var cleanFolder = String(folder || '').replace(/^\/+|\/+$/g, '');
		var cleanName = String(name || '').replace(/^\/+/, '');
		return cleanFolder ? cleanFolder + '/' + cleanName : cleanName;
	}

	function cleanFolderPath(path) {
		var text = String(path || '').replace(/\\/g, '/').trim();
		var segments = text.split('/');
		var cleaned = [];
		for (var index = 0; index < segments.length; index++) {
			var segment = segments[index].trim();
			if (!segment || segment === '.' || segment === '..') { continue; }
			cleaned.push(segment);
		}
		return cleaned.join('/').slice(0, 240);
	}

	function uniqueId() {
		return 'f_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
	}

	function hashText(text) {
		var hash = 0;
		var value = String(text || '');
		for (var index = 0; index < value.length; index++) {
			hash = ((hash << 5) - hash) + value.charCodeAt(index);
			hash = hash | 0;
		}
		return (hash >>> 0).toString(36);
	}

	function stableFileId(record, index) {
		return 'f_' + hashText(String(record.path || '') + '|' + String(record.url || '') + '|' + index);
	}

	function normalizeNameKey(name) {
		return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
	}

	function normalizeTagList(tags) {
		if (!Array.isArray(tags)) { return []; }
		var result = [];
		var seen = {};
		for (var index = 0; index < tags.length; index++) {
			var tag = String(tags[index] === null || tags[index] === undefined ? '' : tags[index]).trim().slice(0, MAX_TAG_LENGTH);
			if (!tag) { continue; }
			var key = tag.toLowerCase();
			if (seen[key]) { continue; }
			seen[key] = true;
			result.push(tag);
			if (result.length >= MAX_TAG_COUNT) { break; }
		}
		return result;
	}

	function normalizeVersions(versions) {
		var list = [];
		if (!Array.isArray(versions)) { return list; }
		for (var index = 0; index < versions.length; index++) {
			var entry = versions[index];
			if (!entry || typeof entry !== 'object') { continue; }
			var url = typeof entry.url === 'string' ? entry.url : '';
			if (!url) { continue; }
			list.push({
				url: url,
				size: isFinite(Number(entry.size)) ? Number(entry.size) : 0,
				updatedAt: timeValue(entry.updatedAt)
			});
		}
		return list.slice(-3);
	}

	/* ── value model ───────────────────────────────────────────────────── */

	function emptyValue() {
		return { folderId: '', name: '', files: [], emptyFolders: [] };
	}

	function normalizeFileRecord(record, index) {
		if (!record || typeof record !== 'object' || Array.isArray(record)) { return null; }
		var name = String(record.name || '').trim();
		var path = String(record.path || '').replace(/\\/g, '/').replace(/^\/+/, '');
		if (!name && path) { name = baseNameOf(path); }
		if (!name) { return null; }
		if (!path) { path = name; }
		var file = {
			id: String(record.id || '') || stableFileId({ path: path, url: record.url }, index),
			name: name,
			displayName: typeof record.displayName === 'string' ? record.displayName.trim().slice(0, 240) : '',
			path: path,
			url: typeof record.url === 'string' ? record.url : '',
			thumb_url: typeof record.thumb_url === 'string' ? record.thumb_url : '',
			cdnUrl: typeof record.cdnUrl === 'string' ? record.cdnUrl : '',
			contentType: typeof record.contentType === 'string' ? record.contentType : '',
			size: isFinite(Number(record.size)) && Number(record.size) >= 0 ? Number(record.size) : 0,
			updatedAt: timeValue(record.updatedAt),
			firstUploadedAt: timeValue(record.firstUploadedAt),
			starred: record.starred === true,
			locked: record.locked === true,
			tags: normalizeTagList(record.tags),
			colorLabel: VALID_COLORS.indexOf(record.colorLabel) >= 0 ? record.colorLabel : '',
			versions: normalizeVersions(record.versions)
		};
		return file;
	}

	function normalizeValue(raw) {
		var source = raw;
		if (typeof source === 'string') {
			try { source = JSON.parse(source); } catch (error) { source = null; }
		}
		if (!source || typeof source !== 'object' || Array.isArray(source)) { source = {}; }
		var value = emptyValue();
		value.folderId = typeof source.folderId === 'string' ? source.folderId : '';
		value.name = typeof source.name === 'string' ? source.name.slice(0, 80) : '';
		var files = [];
		var seenIds = {};
		if (Array.isArray(source.files)) {
			for (var index = 0; index < source.files.length; index++) {
				var file = normalizeFileRecord(source.files[index], index);
				if (!file) { continue; }
				if (seenIds[file.id]) {
					file.id = file.id + '-' + index;
				}
				seenIds[file.id] = true;
				files.push(file);
			}
		}
		value.files = files;
		var folders = [];
		var seenFolders = {};
		if (Array.isArray(source.emptyFolders)) {
			for (var folderIndex = 0; folderIndex < source.emptyFolders.length; folderIndex++) {
				var folder = cleanFolderPath(source.emptyFolders[folderIndex]);
				if (!folder || seenFolders[folder]) { continue; }
				seenFolders[folder] = true;
				folders.push(folder);
			}
		}
		value.emptyFolders = folders;
		return value;
	}

	function serializeFile(file) {
		var record = {
			id: file.id,
			name: file.name,
			path: file.path,
			url: file.url
		};
		if (file.displayName) { record.displayName = file.displayName; }
		if (file.thumb_url) { record.thumb_url = file.thumb_url; }
		if (file.cdnUrl) { record.cdnUrl = file.cdnUrl; }
		if (file.contentType) { record.contentType = file.contentType; }
		if (file.size) { record.size = file.size; }
		if (file.updatedAt) { record.updatedAt = file.updatedAt; }
		if (file.firstUploadedAt) { record.firstUploadedAt = file.firstUploadedAt; }
		if (file.starred) { record.starred = true; }
		if (file.locked) { record.locked = true; }
		if (file.tags && file.tags.length) { record.tags = file.tags.slice(); }
		if (file.colorLabel) { record.colorLabel = file.colorLabel; }
		if (file.versions && file.versions.length) { record.versions = file.versions.slice(-3); }
		return record;
	}

	function plainValue() {
		var files = [];
		for (var index = 0; index < state.value.files.length; index++) {
			files.push(serializeFile(state.value.files[index]));
		}
		return {
			folderId: state.value.folderId || '',
			name: state.value.name || '',
			files: files,
			emptyFolders: state.value.emptyFolders.slice()
		};
	}

	function persist() {
		var plain = plainValue();
		state.lastLocalJson = JSON.stringify(normalizeValue(plain));
		try {
			toolApi.setValue(plain);
		} catch (error) {
			console.warn('[AssetDrive] setValue failed: ' + (error && error.message ? error.message : error));
			notify('The drive could not be saved.', 'error');
		}
		checkValueSize(plain);
		resizeSoon();
	}

	function checkValueSize(plain) {
		var size = 0;
		try { size = JSON.stringify(plain).length; } catch (error) { size = 0; }
		if (size > SIZE_WARN_BYTES) {
			if (!state.sizeWarned) {
				state.sizeWarned = true;
				notify('This drive is approaching the 1 MB field limit. Remove unused records to keep saving reliable.', 'warning');
			}
		} else if (size < SIZE_WARN_BYTES - 80000) {
			state.sizeWarned = false;
		}
	}

	/* ── file helpers ──────────────────────────────────────────────────── */

	function fileDisplayName(file) {
		return file && file.displayName ? file.displayName : (file ? file.name : '');
	}

	function effectiveUrl(file) {
		if (!file) { return ''; }
		return file.cdnUrl || file.url || '';
	}

	function thumbnailUrl(file) {
		if (!file) { return ''; }
		return file.thumb_url || file.cdnUrl || file.url || '';
	}

	function isImageFile(file) {
		if (!file) { return false; }
		if (String(file.contentType || '').toLowerCase().indexOf('image/') === 0) { return true; }
		return IMAGE_EXTENSIONS.indexOf(extensionOf(file.name)) >= 0;
	}

	function classifyType(file) {
		var extension = extensionOf(file ? file.name : '');
		var contentType = String(file && file.contentType ? file.contentType : '').toLowerCase();
		var keys = ['image', 'document', 'spreadsheet', 'presentation', 'pdf', 'video', 'audio'];
		for (var index = 0; index < keys.length; index++) {
			if (TYPE_EXTENSIONS[keys[index]].indexOf(extension) >= 0) { return keys[index]; }
		}
		if (contentType.indexOf('image/') === 0) { return 'image'; }
		if (contentType.indexOf('video/') === 0) { return 'video'; }
		if (contentType.indexOf('audio/') === 0) { return 'audio'; }
		if (contentType.indexOf('application/pdf') === 0) { return 'pdf'; }
		if (contentType.indexOf('text/csv') === 0 || contentType.indexOf('spreadsheet') >= 0) { return 'spreadsheet'; }
		if (contentType.indexOf('presentation') >= 0) { return 'presentation'; }
		if (contentType.indexOf('word') >= 0 || contentType.indexOf('text/') === 0) { return 'document'; }
		return 'other';
	}

	function typeLabelOf(file) {
		var extension = extensionOf(file && file.name ? file.name : '');
		if (extension) { return extension.toUpperCase().slice(0, 5); }
		var contentType = String(file && file.contentType ? file.contentType : '');
		if (contentType) {
			var slash = contentType.indexOf('/');
			var subtype = slash >= 0 ? contentType.slice(slash + 1) : contentType;
			return subtype.split(';')[0].toUpperCase().slice(0, 5);
		}
		return 'FILE';
	}

	function mimeForName(name) {
		return MIME_BY_EXTENSION[extensionOf(name)] || '';
	}

	function fileById(id) {
		if (!id) { return null; }
		for (var index = 0; index < state.value.files.length; index++) {
			if (state.value.files[index].id === id) { return state.value.files[index]; }
		}
		return null;
	}

	function filesByIds(ids) {
		var wanted = {};
		var list = [];
		for (var index = 0; index < ids.length; index++) { wanted[ids[index]] = true; }
		for (var fileIndex = 0; fileIndex < state.value.files.length; fileIndex++) {
			if (wanted[state.value.files[fileIndex].id]) { list.push(state.value.files[fileIndex]); }
		}
		return list;
	}

	function selectedIds() {
		var ids = [];
		for (var key in state.selectedIds) {
			if (Object.prototype.hasOwnProperty.call(state.selectedIds, key) && state.selectedIds[key]) { ids.push(key); }
		}
		return ids;
	}

	function selectedFiles() {
		return filesByIds(selectedIds());
	}

	function directFilesOf(path) {
		var folder = String(path || '');
		var list = [];
		for (var index = 0; index < state.value.files.length; index++) {
			var file = state.value.files[index];
			if (dirNameOf(file.path) === folder) { list.push(file); }
		}
		return list;
	}

	function recursiveFilesOf(path) {
		var folder = String(path || '');
		var prefix = folder ? folder + '/' : '';
		var list = [];
		for (var index = 0; index < state.value.files.length; index++) {
			var file = state.value.files[index];
			if (!folder) { list.push(file); continue; }
			if (file.path === folder || file.path.indexOf(prefix) === 0) { list.push(file); }
		}
		return list;
	}

	function isCopyable(file) {
		return !!(file && effectiveUrl(file) && String(file.name || '').toLowerCase() !== '.gitkeep');
	}

	function sortByPath(list) {
		return list.slice().sort(function (left, right) {
			var a = String(left.path || left.name || '').toLowerCase();
			var b = String(right.path || right.name || '').toLowerCase();
			if (a < b) { return -1; }
			if (a > b) { return 1; }
			return 0;
		});
	}

	function copyableUrls(files) {
		return files.map(function (file) { return effectiveUrl(file); }).filter(function (url) { return !!url; });
	}

	/* ── folder tree model ─────────────────────────────────────────────── */

	function buildFolderTree() {
		var root = { path: '', name: 'Root', children: [], direct: 0, total: 0 };
		var map = { '': root };

		function ensure(path) {
			var folder = String(path || '');
			if (map[folder]) { return map[folder]; }
			var parentPath = parentFolderOf(folder);
			var parent = ensure(parentPath);
			var node = { path: folder, name: baseNameOf(folder), children: [], direct: 0, total: 0 };
			map[folder] = node;
			parent.children.push(node);
			return node;
		}

		for (var index = 0; index < state.value.files.length; index++) {
			var file = state.value.files[index];
			ensure(dirNameOf(file.path)).direct += 1;
		}
		for (var folderIndex = 0; folderIndex < state.value.emptyFolders.length; folderIndex++) {
			ensure(state.value.emptyFolders[folderIndex]);
		}

		function computeTotals(node) {
			var total = node.direct;
			node.children.sort(function (left, right) {
				return left.name.toLowerCase() < right.name.toLowerCase() ? -1 : (left.name.toLowerCase() > right.name.toLowerCase() ? 1 : 0);
			});
			for (var childIndex = 0; childIndex < node.children.length; childIndex++) {
				total += computeTotals(node.children[childIndex]);
			}
			node.total = total;
			return total;
		}
		computeTotals(root);
		return { root: root, map: map };
	}

	function allFolderPaths() {
		var tree = buildFolderTree();
		var list = [];
		for (var key in tree.map) {
			if (Object.prototype.hasOwnProperty.call(tree.map, key) && key) { list.push(key); }
		}
		list.sort(function (left, right) { return left.toLowerCase() < right.toLowerCase() ? -1 : (left.toLowerCase() > right.toLowerCase() ? 1 : 0); });
		return list;
	}

	function folderExists(path) {
		var folder = String(path || '');
		if (!folder) { return true; }
		var tree = buildFolderTree();
		return !!tree.map[folder];
	}

	function nodeForPath(path) {
		var tree = buildFolderTree();
		return tree.map[String(path || '')] || null;
	}

	function addEmptyFolder(path) {
		var folder = cleanFolderPath(path);
		if (!folder) { return; }
		if (state.value.emptyFolders.indexOf(folder) < 0) { state.value.emptyFolders.push(folder); }
	}

	function removeEmptyFolder(path) {
		var folder = String(path || '');
		if (!folder) { return; }
		var remaining = [];
		for (var index = 0; index < state.value.emptyFolders.length; index++) {
			if (state.value.emptyFolders[index] !== folder) { remaining.push(state.value.emptyFolders[index]); }
		}
		state.value.emptyFolders = remaining;
	}

	function removeEmptyFolderTree(path) {
		var folder = String(path || '');
		var prefix = folder + '/';
		var remaining = [];
		for (var index = 0; index < state.value.emptyFolders.length; index++) {
			var entry = state.value.emptyFolders[index];
			if (entry === folder || entry.indexOf(prefix) === 0) { continue; }
			remaining.push(entry);
		}
		state.value.emptyFolders = remaining;
	}

	function hasAnyFileIn(folderPath) {
		var folder = String(folderPath || '');
		var prefix = folder ? folder + '/' : '';
		for (var index = 0; index < state.value.files.length; index++) {
			var file = state.value.files[index];
			if (!folder) { return true; }
			if (file.path === folder || file.path.indexOf(prefix) === 0) { return true; }
		}
		return false;
	}

	function preserveEmptyChain(folderPath) {
		var current = String(folderPath || '');
		while (current) {
			if (hasAnyFileIn(current)) { break; }
			addEmptyFolder(current);
			current = parentFolderOf(current);
		}
	}

	/* ── user and permissions ──────────────────────────────────────────── */

	function safeGetUser() {
		try {
			if (toolApi && typeof toolApi.getUser === 'function') { return toolApi.getUser() || null; }
		} catch (error) { }
		return null;
	}

	function roleList() {
		var user = state.user || safeGetUser();
		if (!user) { return []; }
		return Array.isArray(user.roles) ? user.roles : [];
	}

	function hasRole(name) { return roleList().indexOf(name) >= 0; }

	function canWrite() {
		if (state.readOnly) { return false; }
		if (state.noIdentity) { return true; }
		if (hasRole('admin') || hasRole('owner') || hasRole('developer') || hasRole('user-manager') || hasRole('editor')) { return true; }
		var access = state.user && state.user.effectiveAccess ? state.user.effectiveAccess : null;
		return !!(access && (access.isEditor || access.isManager));
	}

	function initIdentity() {
		if (!toolApi || typeof toolApi.getUser !== 'function') {
			state.noIdentity = true;
			state.user = null;
			return;
		}
		var user = safeGetUser();
		if (user) {
			state.user = user;
			state.noIdentity = false;
			return;
		}
		var delays = [400, 1200, 2600, 5000];
		for (var index = 0; index < delays.length; index++) {
			(function (position) {
				window.setTimeout(function () {
					if (state.user) { return; }
					var nextUser = safeGetUser();
					if (nextUser) {
						state.user = nextUser;
						state.noIdentity = false;
						renderAll();
						return;
					}
					if (position === delays.length - 1) {
						state.noIdentity = true;
						renderAll();
					}
				}, delays[position]);
			})(index);
		}
	}

	/* ── clipboard ─────────────────────────────────────────────────────── */

	function fallbackCopy(text, finish) {
		var area = null;
		try {
			area = document.createElement('textarea');
			area.value = text;
			area.setAttribute('readonly', 'readonly');
			area.style.position = 'fixed';
			area.style.top = '-1000px';
			area.style.left = '-1000px';
			area.style.opacity = '0';
			document.body.appendChild(area);
			area.select();
			area.setSelectionRange(0, area.value.length);
			var ok = false;
			try { ok = document.execCommand('copy'); } catch (error) { ok = false; }
			document.body.removeChild(area);
			finish(ok);
		} catch (error) {
			if (area && area.parentNode) { area.parentNode.removeChild(area); }
			finish(false);
		}
	}

	function copyText(text, callback) {
		if (!text) {
			notify('Nothing to copy.', 'warning');
			if (callback) { callback(false); }
			return;
		}
		var finished = false;
		function finish(ok) {
			if (finished) { return; }
			finished = true;
			if (!ok) { notify('Could not copy to the clipboard.', 'error'); }
			if (callback) { callback(ok); }
		}
		try {
			if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
				navigator.clipboard.writeText(text).then(function () { finish(true); }, function () { fallbackCopy(text, finish); });
				return;
			}
		} catch (error) { }
		fallbackCopy(text, finish);
	}

	function flashInlineButton(button) {
		if (!button) { return; }
		button.classList.add('is-copied');
		window.setTimeout(function () { button.classList.remove('is-copied'); }, COPY_FEEDBACK_MS);
	}

	function flashToolbarButton(button, text) {
		if (!button) { return; }
		if (!button.getAttribute('data-ad-original')) {
			button.setAttribute('data-ad-original', button.innerHTML);
		}
		button.innerHTML = '<span>' + esc(text) + '</span>';
		button.classList.add('is-copied');
		var original = button.getAttribute('data-ad-original');
		window.setTimeout(function () {
			button.innerHTML = original;
			button.classList.remove('is-copied');
		}, FLASH_FEEDBACK_MS);
	}

	function copyFilesToClipboard(files, options) {
		var list = sortByPath(files.filter(isCopyable));
		var urls = options && options.thumbnails
			? list.map(function (file) { return thumbnailUrl(file); }).filter(function (url) { return !!url; })
			: copyableUrls(list);
		if (!urls.length) {
			notify('No file URLs in this selection.', 'warning');
			return;
		}
		var button = options && options.button ? options.button : byId('ad-copy-menu-button');
		copyText(urls.join('\n'), function (ok) {
			if (!ok) { return; }
			var label = (options && options.thumbnails ? 'Copied ' + countLabel(urls.length, 'thumbnail URL') : 'Copied ' + countLabel(urls.length, 'URL'));
			flashToolbarButton(button, label);
			notify(label + '.', 'success');
		});
	}

	/* ── external URL and downloads ────────────────────────────────────── */

	function openExternal(url) {
		if (!url) {
			notify('This file has no URL.', 'warning');
			return false;
		}
		if (!toolApi || typeof toolApi.openUrl !== 'function') {
			notify('Opening links is not available in this CMS field.', 'error');
			return false;
		}
		try {
			toolApi.openUrl(url);
			return true;
		} catch (error) {
			notify('The link could not be opened.', 'error');
			return false;
		}
	}

	function downloadFilesOneByOne(files) {
		var list = sortByPath(files.filter(isCopyable));
		var downloadButton = byId('ad-download-menu-button');
		if (!list.length) {
			notify('There are no files with a URL to download.', 'warning');
			return;
		}
		if (state.downloadBusy) {
			notify('A download run is already in progress.', 'info');
			return;
		}
		state.downloadBusy = true;
		if (downloadButton && !downloadButton.getAttribute('data-ad-original')) {
			downloadButton.setAttribute('data-ad-original', downloadButton.innerHTML);
		}
		var started = 0;
		var index = 0;

		function restoreButton() {
			if (downloadButton) {
				var original = downloadButton.getAttribute('data-ad-original');
				if (original) { downloadButton.innerHTML = original; }
			}
			state.downloadBusy = false;
		}

		function step() {
			if (index >= list.length) {
				restoreButton();
				if (started > 0) {
					notify('Started ' + countLabel(started, 'download') + '.', 'success');
				} else {
					notify('Download failed.', 'error');
				}
				return;
			}
			var file = list[index];
			index += 1;
			if (downloadButton) {
				downloadButton.innerHTML = '<span>Downloading ' + index + '/' + list.length + '...</span>';
			}
			if (openExternal(effectiveUrl(file))) { started += 1; }
			window.setTimeout(step, DOWNLOAD_STEP_MS);
		}

		try {
			step();
		} catch (error) {
			restoreButton();
			notify('Download failed.', 'error');
		}
	}

	/* ── render: header, toolbar, breadcrumb ───────────────────────────── */

	function renderBuildBadge() {
		setText('ad-build-badge', 'tool build ' + TOOL_BUILD);
	}

	function renderHeader() {
		if (!state.titleEditing) {
			var title = state.value.name || driveLabel();
			setText('ad-title-text', title);
			var button = byId('ad-title-button');
			if (button) { button.title = canWrite() ? 'Click to rename this drive' : title; }
		}
		var files = directFilesOf(state.currentPath);
		var bytes = 0;
		for (var index = 0; index < files.length; index++) { bytes += Number(files[index].size) || 0; }
		var folderCount = 0;
		var node = nodeForPath(state.currentPath);
		if (node) { folderCount = node.children.length; }
		var summary = countLabel(files.length, 'file') + ' - ' + formatBytes(bytes);
		if (folderCount) { summary += ' - ' + countLabel(folderCount, 'folder'); }
		if (state.search) { summary = countLabel(state.visibleFileIds.length, 'match', 'matches') + ' in all folders'; }
		setText('ad-subtitle', summary);
	}

	function renderToolbar() {
		var editable = canWrite();
		var uploadButton = byId('ad-upload-button');
		var folderButton = byId('ad-new-folder-button');
		if (uploadButton) { uploadButton.hidden = !editable; }
		if (folderButton) { folderButton.hidden = !editable; }

		var saveButton = byId('ad-save-button');
		if (saveButton) { saveButton.hidden = !(editable && showSaveButton()); }

		var searchInput = byId('ad-search-input');
		if (searchInput && searchInput.value !== state.search) { searchInput.value = state.search; }
		var clearSearch = byId('ad-search-clear');
		if (clearSearch) { clearSearch.hidden = !state.search; }

		var typeFilter = byId('ad-type-filter');
		if (typeFilter) { typeFilter.value = state.typeFilter; }
		var sortSelect = byId('ad-sort-select');
		if (sortSelect) { sortSelect.value = state.sortBy; }

		var sortDirButton = byId('ad-sort-dir-button');
		if (sortDirButton) {
			var ascending = state.sortDir === 'asc';
			sortDirButton.innerHTML = icon(ascending ? 'sort-asc' : 'sort-desc');
			sortDirButton.title = ascending ? 'Sort ascending' : 'Sort descending';
			sortDirButton.setAttribute('aria-label', ascending ? 'Sort ascending' : 'Sort descending');
		}

		var gridButton = byId('ad-view-grid');
		var listButton = byId('ad-view-list');
		if (gridButton) {
			gridButton.classList.toggle('is-active', state.view === 'grid');
			gridButton.setAttribute('aria-pressed', state.view === 'grid' ? 'true' : 'false');
		}
		if (listButton) {
			listButton.classList.toggle('is-active', state.view === 'list');
			listButton.setAttribute('aria-pressed', state.view === 'list' ? 'true' : 'false');
		}

		var selectModeButton = byId('ad-select-mode-button');
		if (selectModeButton) {
			selectModeButton.classList.toggle('is-active', state.selectMode);
			selectModeButton.setAttribute('aria-pressed', state.selectMode ? 'true' : 'false');
			selectModeButton.textContent = state.selectMode ? 'Selecting' : 'Select';
		}

		var treeButton = byId('ad-tree-toggle-button');
		if (treeButton) {
			var root = byId('ad-root');
			treeButton.setAttribute('aria-expanded', root && root.classList.contains('ad-tree-open') ? 'true' : 'false');
		}

		var copyButton = byId('ad-copy-menu-button');
		var downloadButton = byId('ad-download-menu-button');
		if (copyButton) { copyButton.setAttribute('aria-expanded', state.openMenu === 'copy' ? 'true' : 'false'); }
		if (downloadButton) { downloadButton.setAttribute('aria-expanded', state.openMenu === 'download' ? 'true' : 'false'); }
	}

	function renderBreadcrumb() {
		var element = byId('ad-breadcrumb');
		if (!element) { return; }
		var html = '';
		html += '<button type="button" class="ad-crumb' + (state.currentPath ? '' : ' is-current') + '" data-ad-act="navigate" data-path="">' + icon('folder') + '<span>Root</span></button>';
		var segments = state.currentPath ? state.currentPath.split('/') : [];
		var path = '';
		for (var index = 0; index < segments.length; index++) {
			path = path ? path + '/' + segments[index] : segments[index];
			html += '<span class="ad-crumb-sep" aria-hidden="true">/</span>';
			var current = index === segments.length - 1;
			html += '<button type="button" class="ad-crumb' + (current ? ' is-current' : '') + '" data-ad-act="navigate" data-path="' + escAttr(path) + '"><span>' + esc(segments[index]) + '</span></button>';
		}
		element.innerHTML = html;
	}

	function renderTree() {
		var element = byId('ad-tree');
		if (!element) { return; }
		var tree = buildFolderTree();
		var rows = [];
		function walk(node, depth) {
			var active = node.path === state.currentPath;
			rows.push(
				'<button type="button" class="ad-tree-row' + (active ? ' is-active' : '') + '" data-ad-act="navigate" data-path="' + escAttr(node.path) + '" data-ad-folder-path="' + escAttr(node.path) + '" title="' + escAttr(node.path || 'Root') + '" style="padding-left:' + (6 + depth * 13) + 'px">' +
				icon('folder') +
				'<span class="ad-tree-label">' + esc(node.name) + '</span>' +
				'<span class="ad-tree-count" title="' + escAttr(countLabel(node.total, 'file') + ' including subfolders') + '">' + node.total + '</span>' +
				'</button>'
			);
			for (var index = 0; index < node.children.length; index++) {
				walk(node.children[index], depth + 1);
			}
		}
		walk(tree.root, 0);
		element.innerHTML = rows.join('');
	}

	/* ── render: file area ─────────────────────────────────────────────── */

	function matchesSearch(file, query) {
		var tokens = String(query || '').toLowerCase().split(/\s+/);
		var haystack = (fileDisplayName(file) + ' ' + file.name + ' ' + (file.tags || []).join(' ')).toLowerCase();
		for (var index = 0; index < tokens.length; index++) {
			if (tokens[index] && haystack.indexOf(tokens[index]) < 0) { return false; }
		}
		return true;
	}

	function filteredFiles(list) {
		if (state.typeFilter === 'all') { return list.slice(); }
		return list.filter(function (file) { return classifyType(file) === state.typeFilter; });
	}

	function sortedFiles(list) {
		var direction = state.sortDir === 'desc' ? -1 : 1;
		var sorted = list.slice();
		sorted.sort(function (left, right) {
			var comparison = 0;
			if (state.sortBy === 'modified') {
				comparison = (left.updatedAt || 0) - (right.updatedAt || 0);
			} else if (state.sortBy === 'size') {
				comparison = (Number(left.size) || 0) - (Number(right.size) || 0);
			} else {
				var a = fileDisplayName(left).toLowerCase();
				var b = fileDisplayName(right).toLowerCase();
				comparison = a < b ? -1 : (a > b ? 1 : 0);
			}
			if (comparison === 0) {
				var leftPath = String(left.path || left.name || '').toLowerCase();
				var rightPath = String(right.path || right.name || '').toLowerCase();
				comparison = leftPath < rightPath ? -1 : (leftPath > rightPath ? 1 : 0);
			}
			if (comparison === 0) {
				var leftId = String(left.id || '');
				var rightId = String(right.id || '');
				comparison = leftId < rightId ? -1 : (leftId > rightId ? 1 : 0);
			}
			return comparison * direction;
		});
		return sorted;
	}

	function typeTint(type) {
		return 'ad-tint-' + (TYPE_ICONS[type] ? type : 'other');
	}

	function mediaHtml(file) {
		var thumb = thumbnailUrl(file);
		var fallback = '<span class="ad-type-icon ' + typeTint(classifyType(file)) + '">' + icon(TYPE_ICONS[classifyType(file)] || 'file') + '<span class="ad-type-ext">' + esc(typeLabelOf(file)) + '</span></span>';
		if (isImageFile(file) && thumb) {
			return '<img class="ad-thumb" src="' + escAttr(thumb) + '" alt="" loading="lazy">' + fallback;
		}
		return fallback;
	}

	function badgesHtml(file) {
		var badges = [];
		if (file.starred) { badges.push('<span class="ad-badge ad-badge-star" title="Starred">' + icon('star') + '</span>'); }
		if (file.locked) { badges.push('<span class="ad-badge ad-badge-lock" title="Locked">' + icon('lock') + '</span>'); }
		if (file.colorLabel) { badges.push('<span class="ad-color-dot ad-color-' + file.colorLabel + '" title="' + escAttr(COLOR_LABELS[file.colorLabel] || '') + ' label"></span>'); }
		if (!badges.length) { return ''; }
		return '<span class="ad-card-badges">' + badges.join('') + '</span>';
	}

	function inlineBadgesHtml(file) {
		var badges = [];
		if (file.starred) { badges.push('<span class="ad-badge ad-badge-star" title="Starred">' + icon('star') + '</span>'); }
		if (file.locked) { badges.push('<span class="ad-badge ad-badge-lock" title="Locked">' + icon('lock') + '</span>'); }
		if (file.colorLabel) { badges.push('<span class="ad-color-dot ad-color-' + file.colorLabel + '" title="' + escAttr(COLOR_LABELS[file.colorLabel] || '') + ' label"></span>'); }
		return badges.join('');
	}

	function checkboxHtml(file) {
		var checked = !!state.selectedIds[file.id];
		if (!state.selectMode && !checked) { return ''; }
		var label = fileDisplayName(file);
		return '<label class="ad-card-check" title="Select ' + escAttr(label) + '"><input type="checkbox" data-ad-select-id="' + escAttr(file.id) + '"' + (checked ? ' checked' : '') + ' aria-label="Select ' + escAttr(label) + '"></label>';
	}

	function toolsHtml(file) {
		var label = fileDisplayName(file);
		return '<span class="ad-card-tools">' +
			'<button type="button" class="ad-card-copy" data-ad-act="copy-file" data-id="' + escAttr(file.id) + '" title="Copy URL" aria-label="Copy URL of ' + escAttr(label) + '">' +
			icon('copy', 'ad-icon-copy') + icon('check', 'ad-icon-check') + '</button>' +
			'<button type="button" class="ad-card-more" data-ad-act="file-menu" data-id="' + escAttr(file.id) + '" title="More actions" aria-label="More actions for ' + escAttr(label) + '">' + icon('more') + '</button>' +
			'</span>';
	}

	function folderHintHtml(file) {
		var folder = dirNameOf(file.path);
		return '<p class="ad-folder-hint">' + icon('folder') + '<span>' + esc(folder || 'Root') + '</span></p>';
	}

	function fileCardHtml(file, showFolderHint) {
		var name = fileDisplayName(file);
		var selected = !!state.selectedIds[file.id];
		return '<article class="ad-card' + (selected ? ' is-selected' : '') + (file.locked ? ' is-locked' : '') + '" role="listitem" tabindex="-1" data-ad-file-id="' + escAttr(file.id) + '">' +
			'<div class="ad-card-media">' + mediaHtml(file) + badgesHtml(file) + checkboxHtml(file) + toolsHtml(file) + '</div>' +
			'<div class="ad-card-body">' +
			'<p class="ad-card-name" title="' + escAttr(name) + '">' + esc(name) + '</p>' +
			'<p class="ad-card-meta"><span class="ad-type-badge">' + esc(typeLabelOf(file)) + '</span><span class="ad-size">' + esc(formatBytes(file.size)) + '</span></p>' +
			(showFolderHint ? folderHintHtml(file) : '') +
			'</div></article>';
	}

	function folderCardHtml(node) {
		return '<article class="ad-card ad-folder-card" role="listitem" tabindex="-1" data-ad-folder-path="' + escAttr(node.path) + '">' +
			'<div class="ad-card-media">' + icon('folder', 'ad-folder-big') +
			'<span class="ad-card-tools"><button type="button" class="ad-card-more" data-ad-act="folder-menu" data-path="' + escAttr(node.path) + '" title="Folder actions" aria-label="Folder actions for ' + escAttr(node.name) + '">' + icon('more') + '</button></span>' +
			'</div>' +
			'<div class="ad-card-body">' +
			'<p class="ad-card-name" title="' + escAttr(node.path) + '">' + esc(node.name) + '</p>' +
			'<p class="ad-card-meta"><span class="ad-size">' + esc(countLabel(node.total, 'file')) + '</span></p>' +
			'</div></article>';
	}

	function listHeadHtml() {
		function headCell(column, label, extraClass) {
			var isSorted = state.sortBy === column;
			var iconName = isSorted ? (state.sortDir === 'asc' ? 'sort-asc' : 'sort-desc') : '';
			return '<button type="button" class="ad-list-head-cell is-sortable' + (isSorted ? ' is-sorted' : '') + (extraClass ? ' ' + extraClass : '') + '" data-ad-act="sort-column" data-sort="' + column + '" title="Sort by ' + escAttr(label) + '">' +
				'<span>' + esc(label) + '</span>' + (iconName ? icon(iconName) : '') + '</button>';
		}
		return '<div class="ad-list-head" role="row">' +
			'<span class="ad-row-check"></span>' +
			headCell('name', 'Name') +
			'<span class="ad-list-head-cell ad-col-type">Type</span>' +
			headCell('size', 'Size', 'ad-col-size') +
			headCell('modified', 'Modified', 'ad-col-date') +
			'<span class="ad-list-head-cell ad-col-url">URL</span>' +
			'<span class="ad-list-head-cell"></span>' +
			'</div>';
	}

	function fileRowHtml(file, showFolderHint) {
		var name = fileDisplayName(file);
		var selected = !!state.selectedIds[file.id];
		var checked = !!state.selectedIds[file.id];
		var check = (state.selectMode || checked)
			? '<input type="checkbox" data-ad-select-id="' + escAttr(file.id) + '"' + (checked ? ' checked' : '') + ' aria-label="Select ' + escAttr(name) + '">'
			: '<span class="ad-row-check-placeholder"></span>';
		var thumb = thumbnailUrl(file);
		var rowIcon = isImageFile(file) && thumb
			? '<img class="ad-thumb ad-row-thumb" src="' + escAttr(thumb) + '" alt="" loading="lazy">' + icon(TYPE_ICONS[classifyType(file)] || 'file')
			: icon(TYPE_ICONS[classifyType(file)] || 'file');
		return '<div class="ad-row' + (selected ? ' is-selected' : '') + '" role="listitem" tabindex="-1" data-ad-file-id="' + escAttr(file.id) + '">' +
			'<div class="ad-row-check">' + check + '</div>' +
			'<div class="ad-row-name"><span class="ad-row-name-icon ' + typeTint(classifyType(file)) + '">' + rowIcon + '</span>' +
			'<div class="ad-row-name-text"><div class="ad-row-name-main"><p title="' + escAttr(name) + '">' + esc(name) + '</p>' + inlineBadgesHtml(file) + '</div>' +
			(showFolderHint ? '<p class="ad-row-folderhint">' + esc(dirNameOf(file.path) || 'Root') + '</p>' : '') +
			'</div></div>' +
			'<span class="ad-row-type">' + esc(typeLabelOf(file)) + '</span>' +
			'<span class="ad-row-size">' + esc(formatBytes(file.size)) + '</span>' +
			'<span class="ad-row-date">' + esc(formatDate(file.updatedAt)) + '</span>' +
			'<span class="ad-row-url" title="' + escAttr(effectiveUrl(file)) + '">' + esc(effectiveUrl(file)) + '</span>' +
			'<div class="ad-row-actions">' +
			'<button type="button" data-ad-act="copy-file" data-id="' + escAttr(file.id) + '" title="Copy URL" aria-label="Copy URL of ' + escAttr(name) + '">' + icon('copy', 'ad-icon-copy') + icon('check', 'ad-icon-check') + '</button>' +
			'<button type="button" data-ad-act="file-menu" data-id="' + escAttr(file.id) + '" title="More actions" aria-label="More actions for ' + escAttr(name) + '">' + icon('more') + '</button>' +
			'</div></div>';
	}

	function folderRowHtml(node) {
		return '<div class="ad-row is-folder" role="listitem" tabindex="-1" data-ad-folder-path="' + escAttr(node.path) + '">' +
			'<div class="ad-row-check"><span class="ad-row-check-placeholder"></span></div>' +
			'<div class="ad-row-name"><span class="ad-row-name-icon ad-tint-folder">' + icon('folder') + '</span>' +
			'<div class="ad-row-name-text"><div class="ad-row-name-main"><p title="' + escAttr(node.path) + '">' + esc(node.name) + '</p></div></div></div>' +
			'<span class="ad-row-type">Folder</span>' +
			'<span class="ad-row-size">' + esc(countLabel(node.total, 'file')) + '</span>' +
			'<span class="ad-row-date">-</span><span class="ad-row-url">-</span>' +
			'<div class="ad-row-actions"><button type="button" data-ad-act="folder-menu" data-path="' + escAttr(node.path) + '" title="Folder actions" aria-label="Folder actions for ' + escAttr(node.name) + '">' + icon('more') + '</button></div>' +
			'</div>';
	}

	function emptyStateHtml(searching) {
		var title = 'This folder is empty';
		var text = 'Upload a file or create a folder to start building this drive.';
		var actions = '';
		if (searching) {
			title = 'No files match this search';
			text = 'Search looks at every folder in the drive. Try a shorter word or clear the search.';
			actions = '<button type="button" class="ad-btn" data-ad-act="clear-search">Clear search</button>';
		} else if (state.typeFilter !== 'all') {
			title = 'No files match this filter';
			text = 'There are files in this folder, but none of this type.';
			actions = '<button type="button" class="ad-btn" data-ad-act="clear-filters">Clear filters</button>';
		}
		if (canWrite() && !searching) {
			actions += '<button type="button" class="ad-btn ad-btn-primary" data-ad-act="upload">' + icon('upload') + '<span>Upload</span></button>';
			actions += '<button type="button" class="ad-btn" data-ad-act="new-folder">' + icon('folder-plus') + '<span>New folder</span></button>';
		}
		if (!actions) {
			text = 'Nothing has been added to this folder yet.';
		}
		return '<div class="ad-empty">' + icon('folder', 'ad-empty-icon') +
			'<p class="ad-empty-title">' + esc(title) + '</p>' +
			'<p class="ad-empty-text">' + esc(text) + '</p>' +
			(actions ? '<div class="ad-empty-actions">' + actions + '</div>' : '') +
			'</div>';
	}

	function renderContent() {
		var filesElement = byId('ad-files');
		var mainElement = byId('ad-main');
		if (!filesElement) { return; }
		var scrollTop = mainElement ? mainElement.scrollTop : 0;
		var searching = !!state.search;
		var childNodes = [];
		var visibleFiles;

		if (searching) {
			visibleFiles = sortedFiles(filteredFiles(state.value.files.filter(function (file) { return matchesSearch(file, state.search); })));
		} else {
			var node = nodeForPath(state.currentPath);
			childNodes = node ? node.children.slice() : [];
			childNodes.sort(function (left, right) {
				var a = left.name.toLowerCase();
				var b = right.name.toLowerCase();
				if (a < b) { return state.sortDir === 'desc' ? 1 : -1; }
				if (a > b) { return state.sortDir === 'desc' ? -1 : 1; }
				return 0;
			});
			visibleFiles = sortedFiles(filteredFiles(directFilesOf(state.currentPath)));
		}

		state.visibleFileIds = visibleFiles.map(function (file) { return file.id; });

		var totalBytes = 0;
		for (var index = 0; index < visibleFiles.length; index++) { totalBytes += Number(visibleFiles[index].size) || 0; }
		if (searching) {
			setText('ad-main-title', 'Search results');
			setText('ad-main-sub', countLabel(visibleFiles.length, 'match', 'matches') + ' for "' + state.search + '"');
			setText('ad-main-hint', 'The folder of each result is shown on the card.');
		} else {
			setText('ad-main-title', state.currentPath ? baseNameOf(state.currentPath) : (state.value.name || driveLabel()));
			var subtitle = countLabel(visibleFiles.length, 'file') + ' - ' + formatBytes(totalBytes);
			if (childNodes.length) { subtitle += ' - ' + countLabel(childNodes.length, 'folder'); }
			setText('ad-main-sub', subtitle);
			setText('ad-main-hint', 'Right-click a file for more actions. Downloads open one file at a time.');
		}

		var html = '';
		var isEmpty = !childNodes.length && !visibleFiles.length;
		if (isEmpty) {
			html = emptyStateHtml(searching);
		} else if (state.view === 'list') {
			html = listHeadHtml();
			for (var nodeIndex = 0; nodeIndex < childNodes.length; nodeIndex++) { html += folderRowHtml(childNodes[nodeIndex]); }
			for (var fileIndex = 0; fileIndex < visibleFiles.length; fileIndex++) { html += fileRowHtml(visibleFiles[fileIndex], searching); }
		} else {
			for (var cardIndex = 0; cardIndex < childNodes.length; cardIndex++) { html += folderCardHtml(childNodes[cardIndex]); }
			for (var visibleIndex = 0; visibleIndex < visibleFiles.length; visibleIndex++) { html += fileCardHtml(visibleFiles[visibleIndex], searching); }
		}

		filesElement.className = 'ad-files ' + (state.view === 'list' ? 'ad-files-list' : 'ad-files-grid') + (state.selectMode ? ' is-selecting' : '');
		filesElement.innerHTML = html;
		if (mainElement) { mainElement.scrollTop = scrollTop; }
	}

	function renderBulkBar() {
		var bar = byId('ad-bulk-bar');
		if (!bar) { return; }
		var files = selectedFiles();
		var count = files.length;
		bar.hidden = count === 0;
		setText('ad-bulk-count', count + ' selected');
		var editable = canWrite();
		var mutating = ['bulk-star', 'bulk-unstar', 'bulk-move', 'bulk-delete'];
		for (var index = 0; index < mutating.length; index++) {
			var button = bar.querySelector('[data-ad-act="' + mutating[index] + '"]');
			if (button) { button.hidden = !editable; }
		}
	}

	function renderDuplicateBanner() {
		var banner = byId('ad-duplicate-banner');
		if (!banner) { return; }
		banner.hidden = !state.duplicateWarning;
		setText('ad-duplicate-text', state.duplicateWarning);
	}

	/* ── render: detail panel ──────────────────────────────────────────── */

	function renderDetail() {
		var panel = byId('ad-detail-panel');
		var body = document.querySelector('.ad-body');
		if (!panel || !body) { return; }
		var file = fileById(state.detailId);
		if (!file) {
			state.detailId = '';
			panel.hidden = true;
			panel.innerHTML = '';
			body.classList.add('ad-detail-closed');
			return;
		}
		panel.hidden = false;
		body.classList.remove('ad-detail-closed');

		var editable = canWrite();
		var name = fileDisplayName(file);
		var url = effectiveUrl(file);
		var thumb = thumbnailUrl(file);
		var type = classifyType(file);
		var tint = typeTint(type);
		var starLock = [];
		if (file.starred) { starLock.push('Starred'); }
		if (file.locked) { starLock.push('Locked'); }

		var html = '';
		html += '<div class="ad-detail-head"><span class="ad-detail-kicker">File details</span>' +
			'<button type="button" class="ad-icon-btn" data-ad-act="close-detail" aria-label="Close file details">' + icon('x') + '</button></div>';
		html += '<div class="ad-detail-preview">' + mediaHtml(file) + '</div>';
		html += '<div class="ad-detail-section">' +
			'<label class="ad-detail-label" for="ad-detail-name-input">Display name</label>' +
			'<input type="text" class="ad-detail-name-input" id="ad-detail-name-input" data-ad-detail-name="' + escAttr(file.id) + '" value="' + escAttr(name) + '" maxlength="240"' + (editable ? '' : ' disabled') + '>' +
			'</div>';
		html += '<div class="ad-detail-section">' +
			'<span class="ad-detail-label">URL</span>' +
			'<div class="ad-url-row"><input type="text" class="ad-url-input" readonly value="' + escAttr(url) + '" aria-label="File URL">' +
			'<button type="button" class="ad-copy-btn" data-ad-act="detail-copy-url" data-id="' + escAttr(file.id) + '">' + icon('copy') + '<span>Copy</span></button></div>' +
			'<span class="ad-detail-label" style="margin-top:8px">Thumbnail URL</span>' +
			'<div class="ad-url-row"><input type="text" class="ad-url-input" readonly value="' + escAttr(thumb) + '" aria-label="Thumbnail URL">' +
			'<button type="button" class="ad-copy-btn" data-ad-act="detail-copy-thumb" data-id="' + escAttr(file.id) + '">' + icon('copy') + '<span>Copy</span></button></div>' +
			'</div>';
		html += '<div class="ad-detail-section"><span class="ad-detail-label">Metadata</span><div class="ad-meta-grid">' +
			'<div class="ad-meta-item"><span class="ad-meta-key">Folder</span><span class="ad-meta-value">' + esc(dirNameOf(file.path) || 'Root') + '</span></div>' +
			'<div class="ad-meta-item"><span class="ad-meta-key">Type</span><span class="ad-meta-value">' + esc(typeLabelOf(file)) + (file.contentType ? ' - ' + esc(file.contentType) : '') + '</span></div>' +
			'<div class="ad-meta-item"><span class="ad-meta-key">Size</span><span class="ad-meta-value">' + esc(formatBytes(file.size)) + '</span></div>' +
			'<div class="ad-meta-item"><span class="ad-meta-key">Modified</span><span class="ad-meta-value">' + esc(formatDateTime(file.updatedAt)) + '</span></div>' +
			'<div class="ad-meta-item"><span class="ad-meta-key">First uploaded</span><span class="ad-meta-value">' + esc(file.firstUploadedAt ? formatDateTime(file.firstUploadedAt) : '-') + '</span></div>' +
			'<div class="ad-meta-item"><span class="ad-meta-key">Status</span><span class="ad-meta-value">' + esc(starLock.length ? starLock.join(' - ') : 'Normal') + '</span></div>' +
			'</div></div>';
		html += '<div class="ad-detail-section"><span class="ad-detail-label">Colour label</span><div class="ad-color-row">' +
			'<button type="button" class="ad-color-none" data-ad-act="detail-color" data-id="' + escAttr(file.id) + '" data-color="" title="No colour"' + (editable ? '' : ' hidden') + '>' + icon('x') + '</button>';
		for (var colorIndex = 0; colorIndex < VALID_COLORS.length; colorIndex++) {
			var color = VALID_COLORS[colorIndex];
			html += '<button type="button" class="ad-color-swatch ad-color-' + color + (file.colorLabel === color ? ' is-active' : '') + '" data-ad-act="detail-color" data-id="' + escAttr(file.id) + '" data-color="' + color + '" title="' + escAttr(COLOR_LABELS[color]) + '"' + (editable ? '' : ' hidden') + ' aria-label="' + escAttr(COLOR_LABELS[color]) + ' label"></button>';
		}
		html += '</div></div>';
		html += '<div class="ad-detail-section"><label class="ad-detail-label" for="ad-detail-tags-input">Tags</label>' +
			'<input type="text" class="ad-detail-tags-input" id="ad-detail-tags-input" data-ad-detail-tags="' + escAttr(file.id) + '" value="' + escAttr((file.tags || []).join(', ')) + '" placeholder="Comma separated tags"' + (editable ? '' : ' disabled') + '>' +
			'</div>';
		html += '<div class="ad-detail-section"><span class="ad-detail-label">Actions</span><div class="ad-detail-actions">' +
			'<button type="button" class="ad-btn ad-btn-primary" data-ad-act="detail-copy-url" data-id="' + escAttr(file.id) + '">' + icon('copy') + '<span>Copy URL</span></button>' +
			'<button type="button" class="ad-btn" data-ad-act="detail-copy-thumb" data-id="' + escAttr(file.id) + '">' + icon('copy') + '<span>Copy thumbnail</span></button>' +
			'<button type="button" class="ad-btn" data-ad-act="detail-open" data-id="' + escAttr(file.id) + '"' + (url ? '' : ' disabled') + '>' + icon('external') + '<span>Open in new tab</span></button>' +
			'<button type="button" class="ad-btn" data-ad-act="detail-download" data-id="' + escAttr(file.id) + '"' + (url ? '' : ' disabled') + '>' + icon('download') + '<span>Download</span></button>' +
			'<button type="button" class="ad-btn" data-ad-act="detail-share" data-id="' + escAttr(file.id) + '"' + (url ? '' : ' disabled') + '>' + icon('link') + '<span>Share link</span></button>' +
			'</div></div>';
		if (file.versions && file.versions.length) {
			html += '<div class="ad-detail-section"><span class="ad-detail-label">Versions (' + file.versions.length + ')</span>';
			for (var versionIndex = 0; versionIndex < file.versions.length; versionIndex++) {
				var version = file.versions[versionIndex];
				html += '<div class="ad-version-row"><span class="ad-version-label">v' + (versionIndex + 1) + ' <span class="ad-version-meta">' + esc(formatBytes(version.size)) + ' - ' + esc(formatDate(version.updatedAt)) + '</span></span>' +
					'<button type="button" data-ad-act="version-copy" data-id="' + escAttr(file.id) + '" data-index="' + versionIndex + '" title="Copy version URL" aria-label="Copy version URL">' + icon('copy') + '</button>' +
					'<button type="button" data-ad-act="version-open" data-id="' + escAttr(file.id) + '" data-index="' + versionIndex + '" title="Open version" aria-label="Open version">' + icon('external') + '</button>' +
					'</div>';
			}
			html += '</div>';
		}
		panel.innerHTML = html;
	}

	function renderAll() {
		renderBuildBadge();
		renderHeader();
		renderToolbar();
		renderBreadcrumb();
		renderTree();
		renderContent();
		renderBulkBar();
		renderDuplicateBanner();
		renderDetail();
		renderHeader();
		resizeSoon();
	}

	/* ── menus ─────────────────────────────────────────────────────────── */

	function menuItemHtml(action, iconName, label, options) {
		var settings = options || {};
		return '<button type="button" class="ad-menu-item' + (settings.danger ? ' ad-menu-item-danger' : '') + '" role="menuitem" data-ad-act="' + escAttr(action) + '"' +
			(settings.id ? ' data-id="' + escAttr(settings.id) + '"' : '') +
			(settings.path ? ' data-path="' + escAttr(settings.path) + '"' : '') +
			(settings.disabled ? ' disabled' : '') + '>' +
			icon(iconName) + '<span>' + esc(label) + '</span>' +
			(settings.count ? '<span class="ad-menu-count">' + esc(settings.count) + '</span>' : '') +
			'</button>';
	}

	function closeDropdowns() {
		var copyMenu = byId('ad-copy-menu');
		var downloadMenu = byId('ad-download-menu');
		if (copyMenu) { copyMenu.hidden = true; }
		if (downloadMenu) { downloadMenu.hidden = true; }
		var copyButton = byId('ad-copy-menu-button');
		var downloadButton = byId('ad-download-menu-button');
		if (copyButton) { copyButton.setAttribute('aria-expanded', 'false'); }
		if (downloadButton) { downloadButton.setAttribute('aria-expanded', 'false'); }
		state.openMenu = '';
	}

	function renderCopyMenu() {
		var menu = byId('ad-copy-menu');
		if (!menu) { return; }
		var direct = directFilesOf(state.currentPath).filter(isCopyable);
		var recursive = recursiveFilesOf(state.currentPath).filter(isCopyable);
		var directImages = direct.filter(isImageFile);
		var selected = selectedFiles().filter(isCopyable);
		var html = '';
		html += menuItemHtml('copy-folder', 'folder', 'Copy this folder', { count: countLabel(direct.length, 'file'), disabled: direct.length === 0 });
		html += menuItemHtml('copy-folder-recursive', 'folder', 'Copy this folder + subfolders', { count: countLabel(recursive.length, 'file'), disabled: recursive.length === 0 });
		html += menuItemHtml('copy-image-urls', 'image', 'Copy image URLs (this folder)', { count: countLabel(directImages.length, 'image'), disabled: directImages.length === 0 });
		html += menuItemHtml('copy-image-thumbs', 'image', 'Copy image thumbnails (this folder)', { count: countLabel(directImages.length, 'image'), disabled: directImages.length === 0 });
		if (selected.length) {
			html += '<div class="ad-menu-sep"></div>';
			html += menuItemHtml('copy-selected', 'check', 'Copy selected files', { count: countLabel(selected.length, 'file') });
		}
		html += '<div class="ad-menu-hint">One URL per line, in stable path order. Placeholders and records without a URL are skipped.</div>';
		menu.innerHTML = html;
	}

	function renderDownloadMenu() {
		var menu = byId('ad-download-menu');
		if (!menu) { return; }
		var direct = directFilesOf(state.currentPath).filter(isCopyable);
		var recursive = recursiveFilesOf(state.currentPath).filter(isCopyable);
		var selected = selectedFiles().filter(isCopyable);
		var html = '';
		html += menuItemHtml('download-folder', 'download', 'Download this folder', { count: countLabel(direct.length, 'file'), disabled: direct.length === 0 });
		html += menuItemHtml('download-folder-recursive', 'download', 'Download this folder + subfolders', { count: countLabel(recursive.length, 'file'), disabled: recursive.length === 0 });
		if (selected.length) {
			html += '<div class="ad-menu-sep"></div>';
			html += menuItemHtml('download-selected', 'download', 'Download selected files', { count: countLabel(selected.length, 'file') });
		}
		html += '<div class="ad-menu-hint">Files open one at a time. Your browser may ask you to allow multiple downloads.</div>';
		menu.innerHTML = html;
	}

	function toggleDropdown(name) {
		var isOpen = state.openMenu === name;
		closeDropdowns();
		if (isOpen) { return; }
		state.openMenu = name;
		if (name === 'copy') {
			renderCopyMenu();
			var copyMenu = byId('ad-copy-menu');
			var copyButton = byId('ad-copy-menu-button');
			if (copyMenu) { copyMenu.hidden = false; }
			if (copyButton) { copyButton.setAttribute('aria-expanded', 'true'); }
		} else {
			renderDownloadMenu();
			var downloadMenu = byId('ad-download-menu');
			var downloadButton = byId('ad-download-menu-button');
			if (downloadMenu) { downloadMenu.hidden = false; }
			if (downloadButton) { downloadButton.setAttribute('aria-expanded', 'true'); }
		}
	}

	function closeContextMenu() {
		var menu = byId('ad-context-menu');
		if (menu) { menu.hidden = true; menu.innerHTML = ''; }
		state.context = null;
	}

	function positionMenu(menu, x, y) {
		menu.style.left = '0px';
		menu.style.top = '0px';
		var rect = menu.getBoundingClientRect();
		var maxLeft = window.innerWidth - rect.width - 8;
		var maxTop = window.innerHeight - rect.height - 8;
		menu.style.left = Math.max(8, Math.min(x, maxLeft)) + 'px';
		menu.style.top = Math.max(8, Math.min(y, maxTop)) + 'px';
	}

	function colorRowHtml(activeColor, action, fileId) {
		var html = '<div class="ad-menu-color-row">';
		html += '<button type="button" class="ad-color-none" data-ad-act="' + action + '" data-id="' + escAttr(fileId) + '" data-color="" title="No colour">' + icon('x') + '</button>';
		for (var index = 0; index < VALID_COLORS.length; index++) {
			var color = VALID_COLORS[index];
			html += '<button type="button" class="ad-color-swatch ad-color-' + color + (activeColor === color ? ' is-active' : '') + '" data-ad-act="' + action + '" data-id="' + escAttr(fileId) + '" data-color="' + color + '" title="' + escAttr(COLOR_LABELS[color]) + '" aria-label="' + escAttr(COLOR_LABELS[color]) + ' label"></button>';
		}
		html += '</div>';
		return html;
	}

	function openFileContextMenu(id, x, y) {
		var file = fileById(id);
		var menu = byId('ad-context-menu');
		if (!file || !menu) { return; }
		state.context = { kind: 'file', id: id };
		var editable = canWrite();
		var url = effectiveUrl(file);
		var locked = !!file.locked;
		var html = '';
		html += menuItemHtml('ctx-props', 'info', 'Properties', { id: id });
		html += menuItemHtml('ctx-open', 'external', 'Open in new tab', { id: id, disabled: !url });
		html += menuItemHtml('ctx-copy', 'copy', 'Copy URL', { id: id, disabled: !url });
		html += menuItemHtml('ctx-copy-thumb', 'copy', 'Copy thumbnail URL', { id: id });
		html += menuItemHtml('ctx-download', 'download', 'Download', { id: id, disabled: !url });
		if (editable) {
			html += '<div class="ad-menu-sep"></div>';
			html += menuItemHtml('ctx-rename', 'edit', 'Rename display name', { id: id });
			html += menuItemHtml('ctx-move', 'move', 'Move to...', { id: id, disabled: locked });
			html += menuItemHtml('ctx-duplicate', 'copy', 'Duplicate', { id: id });
			html += menuItemHtml('ctx-star', 'star', file.starred ? 'Unstar' : 'Star', { id: id });
			html += menuItemHtml('ctx-lock', file.locked ? 'unlock' : 'lock', file.locked ? 'Unlock' : 'Lock', { id: id });
			html += '<div class="ad-menu-hint">Colour label</div>';
			html += colorRowHtml(file.colorLabel, 'ctx-color', id);
			html += '<div class="ad-menu-sep"></div>';
			html += menuItemHtml('ctx-delete', 'trash', 'Delete', { id: id, danger: true, disabled: locked });
		}
		menu.innerHTML = html;
		menu.hidden = false;
		positionMenu(menu, x, y);
	}

	function openFolderContextMenu(path, x, y) {
		var menu = byId('ad-context-menu');
		if (!menu) { return; }
		var folder = String(path || '');
		var node = nodeForPath(folder);
		var files = recursiveFilesOf(folder).filter(isCopyable);
		state.context = { kind: 'folder', path: folder };
		var html = '';
		html += menuItemHtml('ctx-open-folder', 'folder', 'Open folder', { path: folder });
		html += menuItemHtml('ctx-folder-copy', 'copy', 'Copy all file URLs', { path: folder, count: countLabel(files.length, 'file'), disabled: files.length === 0 });
		html += menuItemHtml('ctx-folder-download', 'download', 'Download folder', { path: folder, count: countLabel(files.length, 'file'), disabled: files.length === 0 });
		if (canWrite() && folder) {
			html += '<div class="ad-menu-sep"></div>';
			html += menuItemHtml('ctx-folder-delete', 'trash', 'Delete folder', { path: folder, danger: true, count: countLabel(node ? node.total : 0, 'file') });
		}
		menu.innerHTML = html;
		menu.hidden = false;
		positionMenu(menu, x, y);
	}

	/* ── modal ─────────────────────────────────────────────────────────── */

	function openModal(config) {
		var modal = byId('ad-modal');
		if (!modal) { return; }
		state.modal = config || {};
		setText('ad-modal-title', state.modal.title || '');
		var body = byId('ad-modal-body');
		if (body) { body.innerHTML = state.modal.bodyHtml || ''; }
		var confirmButton = byId('ad-modal-confirm');
		if (confirmButton) {
			confirmButton.textContent = state.modal.confirmLabel || 'Confirm';
			confirmButton.classList.toggle('ad-btn-primary', !state.modal.danger);
			confirmButton.classList.toggle('ad-btn-danger', !!state.modal.danger);
		}
		modal.hidden = false;
		window.setTimeout(function () {
			var focusable = body ? body.querySelector('input, select, textarea') : null;
			if (focusable) {
				try { focusable.focus(); focusable.select && focusable.select(); } catch (error) { }
			} else if (confirmButton) {
				try { confirmButton.focus(); } catch (error) { }
			}
		}, 30);
	}

	function closeModal() {
		var modal = byId('ad-modal');
		if (modal) { modal.hidden = true; }
		state.modal = null;
	}

	function confirmModal() {
		if (!state.modal || typeof state.modal.onConfirm !== 'function') {
			closeModal();
			return;
		}
		var keepOpen = state.modal.onConfirm();
		if (keepOpen === false) { return; }
		closeModal();
	}

	function showModalError(message) {
		var body = byId('ad-modal-body');
		if (!body) { return; }
		var error = body.querySelector('.ad-modal-error');
		if (!error) {
			error = document.createElement('p');
			error.className = 'ad-modal-error';
			body.appendChild(error);
		}
		error.textContent = message;
	}

	/* ── actions: upload and folder operations ─────────────────────────── */

	function requestUploadNow() {
		if (!canWrite()) { notify('This drive is read-only.', 'warning'); return; }
		if (!toolApi || typeof toolApi.requestUpload !== 'function') {
			notify('Uploading is not available in this CMS field (allowUpload is not enabled).', 'warning');
			return;
		}
		var accept = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.json,.svg,.webp';
		toolApi.requestUpload(accept, function (error, file) {
			if (error) {
				notify('Upload failed: ' + error, 'error');
				return;
			}
			if (!file || !file.url) {
				notify('The upload did not return a file.', 'warning');
				return;
			}
			var name = String(file.name || 'upload').trim() || 'upload';
			var size = Number(file.size) || 0;
			if (size > maxUploadMb() * 1024 * 1024) {
				notify(name + ' is larger than ' + maxUploadMb() + ' MB.', 'error');
				return;
			}
			var now = Date.now();
			var targetPath = joinPath(state.currentPath, name);
			var existing = null;
			for (var index = 0; index < state.value.files.length; index++) {
				if (state.value.files[index].path === targetPath) { existing = state.value.files[index]; break; }
			}
			var warning = '';
			var nameKey = normalizeNameKey(name);
			for (var similarIndex = 0; similarIndex < state.value.files.length; similarIndex++) {
				var candidate = state.value.files[similarIndex];
				if (candidate.path === targetPath) { continue; }
				if (normalizeNameKey(candidate.name) === nameKey) {
					warning = 'A file with a very similar name ("' + fileDisplayName(candidate) + '") already exists in "' + (dirNameOf(candidate.path) || 'Root') + '". Both records are kept.';
					break;
				}
			}

			if (existing) {
				if (!Array.isArray(existing.versions)) { existing.versions = []; }
				existing.versions.push({
					url: existing.url,
					size: existing.size || 0,
					updatedAt: existing.updatedAt || now
				});
				existing.versions = existing.versions.slice(-3);
				existing.url = file.url;
				existing.size = size;
				existing.contentType = file.type || existing.contentType || mimeForName(name);
				existing.updatedAt = now;
				if (!existing.firstUploadedAt) { existing.firstUploadedAt = now; }
				removeEmptyFolder(state.currentPath);
				state.detailId = existing.id;
				persist();
				notify('Replaced ' + fileDisplayName(existing) + '. The previous file is kept as a version.', 'success');
			} else {
				var record = {
					id: uniqueId(),
					name: name,
					displayName: '',
					path: targetPath,
					url: file.url,
					thumb_url: '',
					cdnUrl: '',
					contentType: file.type || mimeForName(name),
					size: size,
					updatedAt: now,
					firstUploadedAt: now,
					starred: false,
					locked: false,
					tags: [],
					colorLabel: '',
					versions: []
				};
				state.value.files.push(record);
				removeEmptyFolder(state.currentPath);
				state.detailId = record.id;
				persist();
				notify('Uploaded ' + name + '.', 'success');
			}
			if (warning) { state.duplicateWarning = warning; }
			renderAll();
		});
	}

	function openNewFolderModal() {
		if (!canWrite()) { return; }
		openModal({
			title: 'New folder',
			bodyHtml: '<div class="ad-modal-field"><label class="ad-modal-label" for="ad-modal-folder-name">Folder name</label>' +
				'<input type="text" class="ad-modal-input" id="ad-modal-folder-name" maxlength="120" placeholder="For example: Clients/2026" autocomplete="off">' +
				'<p class="ad-main-sub">Nested paths are allowed. Nothing is created in storage; the folder is part of this drive record.</p></div>',
			confirmLabel: 'Create folder',
			onConfirm: function () {
				var input = byId('ad-modal-folder-name');
				var raw = input ? input.value : '';
				var folder = cleanFolderPath(raw);
				if (!folder) {
					showModalError('Enter a folder name.');
					return false;
				}
				if (folderExists(folder)) {
					navigateTo(folder);
					notify('Opened the existing folder "' + folder + '".', 'info');
					return true;
				}
				addEmptyFolder(folder);
				persist();
				navigateTo(folder);
				notify('Folder "' + folder + '" created.', 'success');
				return true;
			}
		});
	}

	function openRenameModal(id) {
		var file = fileById(id);
		if (!file || !canWrite()) { return; }
		openModal({
			title: 'Rename display name',
			bodyHtml: '<div class="ad-modal-field"><label class="ad-modal-label" for="ad-modal-rename">Display name</label>' +
				'<input type="text" class="ad-modal-input" id="ad-modal-rename" maxlength="240" value="' + escAttr(fileDisplayName(file)) + '">' +
				'<p class="ad-main-sub">Only the visible name changes. The file path and the stored URL stay the same.</p></div>',
			confirmLabel: 'Save name',
			onConfirm: function () {
				var input = byId('ad-modal-rename');
				var nextName = input ? input.value.trim().slice(0, 240) : '';
				file.displayName = nextName;
				persist();
				renderAll();
				notify('Display name updated.', 'success');
				return true;
			}
		});
	}

	function folderOptionsHtml(currentTarget) {
		var folders = allFolderPaths();
		var html = '<option value="">Root</option>';
		for (var index = 0; index < folders.length; index++) {
			var folder = folders[index];
			html += '<option value="' + escAttr(folder) + '"' + (folder === currentTarget ? ' selected' : '') + '>' + esc(folder) + '</option>';
		}
		return html;
	}

	function openMoveModal(ids) {
		if (!canWrite()) { return; }
		var files = filesByIds(ids);
		if (!files.length) { return; }
		var editableFiles = files.filter(function (file) { return !file.locked; });
		var lockedCount = files.length - editableFiles.length;
		openModal({
			title: files.length === 1 ? 'Move file' : 'Move ' + countLabel(files.length, 'file'),
			bodyHtml: '<div class="ad-modal-field"><label class="ad-modal-label" for="ad-modal-move-target">Destination folder</label>' +
				'<select class="ad-modal-select" id="ad-modal-move-target">' + folderOptionsHtml('') + '</select></div>' +
				'<div class="ad-modal-warning">' + icon('alert') + '<span>Moving only rewrites the folder path. The stored URL never changes, so links that were already shared keep working.</span></div>' +
				(lockedCount ? '<p class="ad-modal-error">' + esc(countLabel(lockedCount, 'locked file')) + ' will be skipped. Unlock first to move.</p>' : ''),
			confirmLabel: 'Move',
			onConfirm: function () {
				var select = byId('ad-modal-move-target');
				var target = select ? String(select.value || '') : '';
				var moved = 0;
				var skipped = 0;
				var oldFolders = {};
				for (var index = 0; index < files.length; index++) {
					var file = files[index];
					if (file.locked) { skipped += 1; continue; }
					var oldFolder = dirNameOf(file.path);
					if (oldFolder === target) { continue; }
					oldFolders[oldFolder] = true;
					file.path = joinPath(target, file.name);
					moved += 1;
				}
				removeEmptyFolder(target);
				for (var folder in oldFolders) {
					if (Object.prototype.hasOwnProperty.call(oldFolders, folder)) { preserveEmptyChain(folder); }
				}
				if (moved) {
					persist();
					state.selectedIds = {};
					renderAll();
					notify('Moved ' + countLabel(moved, 'file') + (skipped ? ' - ' + countLabel(skipped, 'locked file') + ' skipped' : '') + '.', 'success');
				} else if (skipped) {
					notify('Nothing was moved. ' + countLabel(skipped, 'locked file') + ' cannot be moved.', 'warning');
				} else {
					notify('The files are already in that folder.', 'info');
				}
				return true;
			}
		});
	}

	function deleteFilesByIds(ids, label) {
		if (!canWrite()) { return; }
		var files = filesByIds(ids);
		if (!files.length) { return; }
		var unlocked = files.filter(function (file) { return !file.locked; });
		var lockedCount = files.length - unlocked.length;
		if (!unlocked.length) {
			notify('Locked files cannot be deleted. Unlock them first.', 'warning');
			return;
		}
		var removeIds = {};
		for (var index = 0; index < unlocked.length; index++) { removeIds[unlocked[index].id] = true; }
		var oldFolders = {};
		var remaining = [];
		for (var fileIndex = 0; fileIndex < state.value.files.length; fileIndex++) {
			var file = state.value.files[fileIndex];
			if (removeIds[file.id]) {
				oldFolders[dirNameOf(file.path)] = true;
			} else {
				remaining.push(file);
			}
		}
		state.value.files = remaining;
		for (var folder in oldFolders) {
			if (Object.prototype.hasOwnProperty.call(oldFolders, folder)) { preserveEmptyChain(folder); }
		}
		if (state.detailId && removeIds[state.detailId]) { state.detailId = ''; }
		state.selectedIds = {};
		persist();
		renderAll();
		if (unlocked.length) {
			notify('Deleted ' + countLabel(unlocked.length, 'file') + (label ? ' from ' + label : '') + (lockedCount ? ' - ' + countLabel(lockedCount, 'locked file') + ' kept' : '') + '.', 'info');
		} else {
			notify('Locked files cannot be deleted. Unlock them first.', 'warning');
		}
	}

	function openDeleteFileModal(id) {
		var file = fileById(id);
		if (!file || !canWrite()) { return; }
		if (file.locked) {
			notify('This file is locked. Unlock it before deleting.', 'warning');
			return;
		}
		var warning = file.firstUploadedAt
			? '<div class="ad-modal-warning">' + icon('alert') + '<span>Deleting will remove this record; the stored URL becomes unmanaged.</span></div>'
			: '';
		openModal({
			title: 'Delete file',
			bodyHtml: '<p>Delete <strong>' + esc(fileDisplayName(file)) + '</strong> from this drive?</p>' + warning,
			confirmLabel: 'Delete',
			danger: true,
			onConfirm: function () {
				deleteFilesByIds([id], '');
				return true;
			}
		});
	}

	function openDeleteFolderModal(path) {
		if (!canWrite()) { return; }
		var folder = String(path || '');
		if (!folder) { return; }
		var files = recursiveFilesOf(folder);
		var lockedCount = files.filter(function (file) { return file.locked; }).length;
		openModal({
			title: 'Delete folder',
			bodyHtml: '<p>Delete <strong>' + esc(folder) + '</strong> and its ' + esc(countLabel(files.length, 'file record')) + '?</p>' +
				'<div class="ad-modal-warning">' + icon('alert') + '<span>Records are removed from this drive. Stored files and their URLs are not deleted. Links that were already shared keep working.</span></div>' +
				(lockedCount ? '<p class="ad-modal-error">' + esc(countLabel(lockedCount, 'locked file')) + ' inside this folder will be kept.</p>' : ''),
			confirmLabel: 'Delete folder',
			danger: true,
			onConfirm: function () {
				var removeIds = {};
				for (var index = 0; index < files.length; index++) {
					if (!files[index].locked) { removeIds[files[index].id] = true; }
				}
				var remaining = [];
				var removedCount = 0;
				for (var fileIndex = 0; fileIndex < state.value.files.length; fileIndex++) {
					var file = state.value.files[fileIndex];
					if (removeIds[file.id]) { removedCount += 1; } else { remaining.push(file); }
				}
				state.value.files = remaining;
				removeEmptyFolderTree(folder);
				preserveEmptyChain(parentFolderOf(folder));
				var wasInside = state.currentPath === folder || state.currentPath.indexOf(folder + '/') === 0;
				state.selectedIds = {};
				state.lastClickedId = '';
				if (wasInside) { state.currentPath = parentFolderOf(folder); }
				if (state.detailId && !fileById(state.detailId)) { state.detailId = ''; }
				persist();
				renderAll();
				if (removedCount) {
					notify('Deleted "' + folder + '" (' + countLabel(removedCount, 'file') + ')' + (lockedCount ? ' - ' + countLabel(lockedCount, 'locked file') + ' kept' : '') + '.', 'info');
				} else {
					notify('The folder records are locked and were kept.', 'warning');
				}
				return true;
			}
		});
	}

	/* ── actions: record updates ───────────────────────────────────────── */

	function setStarForIds(ids, starred) {
		var files = filesByIds(ids);
		var changed = 0;
		for (var index = 0; index < files.length; index++) {
			if (files[index].starred !== starred) { files[index].starred = starred; changed += 1; }
		}
		if (!changed) { return; }
		persist();
		renderAll();
		notify(starred ? 'Starred ' + countLabel(changed, 'file') + '.' : 'Removed the star from ' + countLabel(changed, 'file') + '.', 'success');
	}

	function toggleLock(id) {
		var file = fileById(id);
		if (!file || !canWrite()) { return; }
		file.locked = !file.locked;
		persist();
		renderAll();
		notify(file.locked ? 'File locked. It cannot be moved or deleted.' : 'File unlocked.', 'info');
	}

	function setColor(id, color) {
		var file = fileById(id);
		if (!file || !canWrite()) { return; }
		file.colorLabel = VALID_COLORS.indexOf(color) >= 0 ? color : '';
		persist();
		renderAll();
		notify(file.colorLabel ? 'Colour label set to ' + COLOR_LABELS[file.colorLabel] + '.' : 'Colour label cleared.', 'success');
	}

	function saveDetailTags(id, text) {
		var file = fileById(id);
		if (!file || !canWrite()) { return; }
		var parts = String(text || '').split(',');
		var nextTags = normalizeTagList(parts);
		if (nextTags.join('|') === (file.tags || []).join('|')) { return; }
		file.tags = nextTags;
		persist();
		renderAll();
		notify('Tags updated.', 'success');
	}

	function saveDetailName(id, text) {
		var file = fileById(id);
		if (!file || !canWrite()) { return; }
		var nextName = String(text || '').trim().slice(0, 240);
		if (nextName === file.displayName) { return; }
		file.displayName = nextName;
		persist();
		renderAll();
		notify('Display name updated.', 'success');
	}

	function duplicateFile(id) {
		var file = fileById(id);
		if (!file || !canWrite()) { return; }
		var extension = extensionOf(file.name);
		var stem = extension ? file.name.slice(0, file.name.length - extension.length - 1) : file.name;
		var attempt = 1;
		var nextName = stem + ' (copy)' + (extension ? '.' + extension : '');
		var folder = dirNameOf(file.path);
		while (filePathExists(joinPath(folder, nextName))) {
			attempt += 1;
			nextName = stem + ' (copy ' + attempt + ')' + (extension ? '.' + extension : '');
		}
		var now = Date.now();
		var copy = {
			id: uniqueId(),
			name: nextName,
			displayName: '',
			path: joinPath(folder, nextName),
			url: file.url,
			thumb_url: file.thumb_url,
			cdnUrl: file.cdnUrl,
			contentType: file.contentType,
			size: file.size,
			updatedAt: now,
			firstUploadedAt: now,
			starred: file.starred,
			locked: false,
			tags: file.tags.slice(),
			colorLabel: file.colorLabel,
			versions: file.versions.slice()
		};
		state.value.files.push(copy);
		persist();
		state.detailId = copy.id;
		renderAll();
		notify('Duplicated as "' + nextName + '".', 'success');
	}

	function filePathExists(path) {
		for (var index = 0; index < state.value.files.length; index++) {
			if (state.value.files[index].path === path) { return true; }
		}
		return false;
	}

	/* ── title editing ─────────────────────────────────────────────────── */

	function startTitleEdit() {
		if (!canWrite()) { return; }
		var input = byId('ad-title-input');
		var button = byId('ad-title-button');
		if (!input || !button) { return; }
		state.titleEditing = true;
		input.value = state.value.name || '';
		input.placeholder = driveLabel();
		button.hidden = true;
		input.hidden = false;
		input.focus();
		try { input.select(); } catch (error) { }
	}

	function commitTitleEdit(commit) {
		var input = byId('ad-title-input');
		var button = byId('ad-title-button');
		if (!state.titleEditing || !input || !button) { return; }
		state.titleEditing = false;
		if (commit) {
			var nextName = input.value.trim().slice(0, 80);
			if (nextName !== state.value.name) {
				state.value.name = nextName;
				persist();
				notify('Drive name updated.', 'success');
			}
		}
		input.hidden = true;
		button.hidden = false;
		renderAll();
	}

	/* ── navigation and selection ──────────────────────────────────────── */

	function navigateTo(path) {
		var folder = cleanFolderPath(path);
		if (folder && !folderExists(folder)) { return; }
		state.currentPath = folder;
		state.search = '';
		state.selectedIds = {};
		state.lastClickedId = '';
		state.detailId = '';
		closeDropdowns();
		closeContextMenu();
		renderAll();
	}

	function openDetail(id) {
		if (!fileById(id)) { return; }
		state.detailId = id;
		renderDetail();
		var root = byId('ad-root');
		if (root) { root.classList.remove('ad-tree-open'); }
	}

	function clearSelection() {
		state.selectedIds = {};
		state.lastClickedId = '';
		updateSelectionUi();
	}

	function selectAllVisible() {
		state.selectedIds = {};
		for (var index = 0; index < state.visibleFileIds.length; index++) {
			state.selectedIds[state.visibleFileIds[index]] = true;
		}
		updateSelectionUi();
	}

	function selectSingle(id) {
		state.selectedIds = {};
		state.selectedIds[id] = true;
		state.lastClickedId = id;
		updateSelectionUi();
	}

	function toggleSelection(id) {
		if (state.selectedIds[id]) { delete state.selectedIds[id]; } else { state.selectedIds[id] = true; }
		state.lastClickedId = id;
		updateSelectionUi();
	}

	function selectRange(id) {
		var ids = state.visibleFileIds;
		var targetIndex = ids.indexOf(id);
		if (targetIndex < 0) { return; }
		var anchorIndex = state.lastClickedId ? ids.indexOf(state.lastClickedId) : -1;
		if (anchorIndex < 0) { anchorIndex = targetIndex; }
		var start = Math.min(anchorIndex, targetIndex);
		var end = Math.max(anchorIndex, targetIndex);
		for (var index = start; index <= end; index++) { state.selectedIds[ids[index]] = true; }
		state.lastClickedId = id;
		updateSelectionUi();
	}

	function updateSelectionUi() {
		renderContent();
		renderBulkBar();
	}

	/* ── event handlers ────────────────────────────────────────────────── */

	function handleFileActivation(element, event) {
		var id = element.getAttribute('data-ad-file-id');
		if (!id) { return; }
		if (event.ctrlKey || event.metaKey) {
			toggleSelection(id);
			return;
		}
		if (event.shiftKey) {
			selectRange(id);
			return;
		}
		if (state.selectMode) {
			selectSingle(id);
			return;
		}
		openDetail(id);
	}

	function handleAction(element, event) {
		var action = element.getAttribute('data-ad-act');
		var fileId = element.getAttribute('data-id') || '';
		var targetPath = element.getAttribute('data-path');
		switch (action) {
			case 'upload': requestUploadNow(); break;
			case 'new-folder': openNewFolderModal(); break;
			case 'toggle-tree': {
				var root = byId('ad-root');
				if (root) {
					var isOpen = root.classList.toggle('ad-tree-open');
					var button = byId('ad-tree-toggle-button');
					if (button) { button.setAttribute('aria-expanded', isOpen ? 'true' : 'false'); }
				}
				break;
			}
			case 'navigate': navigateTo(targetPath); break;
			case 'clear-search': {
				state.search = '';
				state.selectedIds = {};
				var searchInput = byId('ad-search-input');
				if (searchInput) { searchInput.value = ''; }
				renderAll();
				break;
			}
			case 'clear-filters': {
				state.search = '';
				state.typeFilter = 'all';
				state.selectedIds = {};
				renderAll();
				break;
			}
			case 'toggle-sort-dir': {
				state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
				renderToolbar();
				renderContent();
				break;
			}
			case 'sort-column': {
				var column = element.getAttribute('data-sort');
				if (!column) { break; }
				if (state.sortBy === column) {
					state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
				} else {
					state.sortBy = column;
					state.sortDir = column === 'name' ? 'asc' : 'desc';
				}
				renderToolbar();
				renderContent();
				break;
			}
			case 'set-grid': state.view = 'grid'; renderToolbar(); renderContent(); break;
			case 'set-list': state.view = 'list'; renderToolbar(); renderContent(); break;
			case 'toggle-select-mode': {
				state.selectMode = !state.selectMode;
				if (!state.selectMode) { state.selectedIds = {}; state.lastClickedId = ''; }
				renderToolbar();
				updateSelectionUi();
				break;
			}
			case 'toggle-copy-menu': toggleDropdown('copy'); break;
			case 'toggle-download-menu': toggleDropdown('download'); break;
			case 'copy-file': {
				var file = fileById(fileId);
				if (file) {
					copyText(effectiveUrl(file), function (ok) {
						if (ok) { flashInlineButton(element); notify('URL copied.', 'success'); }
					});
				}
				break;
			}
			case 'file-menu': {
				var rect = element.getBoundingClientRect();
				openFileContextMenu(fileId, rect.right - 218, rect.bottom + 4);
				break;
			}
			case 'folder-menu': {
				var folderRect = element.getBoundingClientRect();
				openFolderContextMenu(targetPath, folderRect.right - 218, folderRect.bottom + 4);
				break;
			}
			case 'copy-folder': {
				copyFilesToClipboard(directFilesOf(state.currentPath), { button: byId('ad-copy-menu-button') });
				closeDropdowns();
				break;
			}
			case 'copy-folder-recursive': {
				copyFilesToClipboard(recursiveFilesOf(state.currentPath), { button: byId('ad-copy-menu-button') });
				closeDropdowns();
				break;
			}
			case 'copy-image-urls': {
				copyFilesToClipboard(directFilesOf(state.currentPath).filter(isImageFile), { button: byId('ad-copy-menu-button') });
				closeDropdowns();
				break;
			}
			case 'copy-image-thumbs': {
				copyFilesToClipboard(directFilesOf(state.currentPath).filter(isImageFile), { thumbnails: true, button: byId('ad-copy-menu-button') });
				closeDropdowns();
				break;
			}
			case 'copy-selected': {
				copyFilesToClipboard(selectedFiles(), { button: byId('ad-copy-menu-button') });
				closeDropdowns();
				break;
			}
			case 'download-folder': {
				downloadFilesOneByOne(directFilesOf(state.currentPath));
				closeDropdowns();
				break;
			}
			case 'download-folder-recursive': {
				downloadFilesOneByOne(recursiveFilesOf(state.currentPath));
				closeDropdowns();
				break;
			}
			case 'download-selected': {
				downloadFilesOneByOne(selectedFiles());
				closeDropdowns();
				break;
			}
			case 'select-all': selectAllVisible(); break;
			case 'select-none': clearSelection(); break;
			case 'bulk-star': setStarForIds(selectedIds(), true); break;
			case 'bulk-unstar': setStarForIds(selectedIds(), false); break;
			case 'bulk-copy': copyFilesToClipboard(selectedFiles(), { button: byId('ad-copy-menu-button') }); break;
			case 'bulk-download': downloadFilesOneByOne(selectedFiles()); break;
			case 'bulk-move': openMoveModal(selectedIds()); break;
			case 'bulk-delete': {
				var files = selectedFiles();
				if (!files.length) { break; }
				var locked = files.filter(function (item) { return item.locked; }).length;
				openModal({
					title: 'Delete selected files',
					bodyHtml: '<p>Delete ' + esc(countLabel(files.length, 'file record')) + ' from this drive?</p>' +
						'<div class="ad-modal-warning">' + icon('alert') + '<span>Records are removed. Stored files and their URLs are not deleted.</span></div>' +
						(locked ? '<p class="ad-modal-error">' + esc(countLabel(locked, 'locked file')) + ' will be kept.</p>' : ''),
					confirmLabel: 'Delete',
					danger: true,
					onConfirm: function () {
						deleteFilesByIds(files.map(function (item) { return item.id; }), '');
						return true;
					}
				});
				break;
			}
			case 'dismiss-duplicate': state.duplicateWarning = ''; renderDuplicateBanner(); break;
			case 'close-detail': state.detailId = ''; renderDetail(); break;

			case 'detail-copy-url': {
				var detailFile = fileById(fileId);
				if (detailFile) {
					copyText(effectiveUrl(detailFile), function (ok) {
						if (ok) { flashInlineButton(element); notify('URL copied.', 'success'); }
					});
				}
				break;
			}
			case 'detail-copy-thumb': {
				var thumbFile = fileById(fileId);
				if (thumbFile) {
					copyText(thumbnailUrl(thumbFile), function (ok) {
						if (ok) { flashInlineButton(element); notify('Thumbnail URL copied.', 'success'); }
					});
				}
				break;
			}
			case 'detail-open': {
				var openFile = fileById(fileId);
				if (openFile) { openExternal(effectiveUrl(openFile)); }
				break;
			}
			case 'detail-download': {
				var downloadFile = fileById(fileId);
				if (downloadFile) { downloadFilesOneByOne([downloadFile]); }
				break;
			}
			case 'detail-share': {
				var shareFile = fileById(fileId);
				if (shareFile) {
					copyText(effectiveUrl(shareFile), function (ok) {
						if (ok) { flashInlineButton(element); notify('Share link copied.', 'success'); }
					});
				}
				break;
			}
			case 'detail-color': setColor(fileId, element.getAttribute('data-color') || ''); break;
			case 'version-copy': {
				var versionFile = fileById(fileId);
				var versionIndex = Number(element.getAttribute('data-index'));
				if (versionFile && versionFile.versions && versionFile.versions[versionIndex]) {
					copyText(versionFile.versions[versionIndex].url, function (ok) {
						if (ok) { flashInlineButton(element); notify('Version URL copied.', 'success'); }
					});
				}
				break;
			}
			case 'version-open': {
				var openVersionFile = fileById(fileId);
				var openVersionIndex = Number(element.getAttribute('data-index'));
				if (openVersionFile && openVersionFile.versions && openVersionFile.versions[openVersionIndex]) {
					openExternal(openVersionFile.versions[openVersionIndex].url);
				}
				break;
			}

			case 'ctx-props': openDetail(fileId); closeContextMenu(); break;
			case 'ctx-open': {
				var contextOpenFile = fileById(fileId);
				if (contextOpenFile) { openExternal(effectiveUrl(contextOpenFile)); }
				closeContextMenu();
				break;
			}
			case 'ctx-copy': {
				var contextCopyFile = fileById(fileId);
				if (contextCopyFile) { copyText(effectiveUrl(contextCopyFile), function (ok) { if (ok) { notify('URL copied.', 'success'); } }); }
				closeContextMenu();
				break;
			}
			case 'ctx-copy-thumb': {
				var contextThumbFile = fileById(fileId);
				if (contextThumbFile) { copyText(thumbnailUrl(contextThumbFile), function (ok) { if (ok) { notify('Thumbnail URL copied.', 'success'); } }); }
				closeContextMenu();
				break;
			}
			case 'ctx-download': {
				var contextDownloadFile = fileById(fileId);
				if (contextDownloadFile) { downloadFilesOneByOne([contextDownloadFile]); }
				closeContextMenu();
				break;
			}
			case 'ctx-rename': closeContextMenu(); openRenameModal(fileId); break;
			case 'ctx-move': closeContextMenu(); openMoveModal([fileId]); break;
			case 'ctx-duplicate': closeContextMenu(); duplicateFile(fileId); break;
			case 'ctx-star': {
				var starFile = fileById(fileId);
				if (starFile) { setStarForIds([fileId], !starFile.starred); }
				closeContextMenu();
				break;
			}
			case 'ctx-lock': closeContextMenu(); toggleLock(fileId); break;
			case 'ctx-color': setColor(fileId, element.getAttribute('data-color') || ''); closeContextMenu(); break;
			case 'ctx-delete': closeContextMenu(); openDeleteFileModal(fileId); break;

			case 'ctx-open-folder': navigateTo(targetPath); closeContextMenu(); break;
			case 'ctx-folder-copy': {
				copyFilesToClipboard(recursiveFilesOf(targetPath), { button: byId('ad-copy-menu-button') });
				closeContextMenu();
				break;
			}
			case 'ctx-folder-download': {
				downloadFilesOneByOne(recursiveFilesOf(targetPath));
				closeContextMenu();
				break;
			}
			case 'ctx-folder-delete': closeContextMenu(); openDeleteFolderModal(targetPath); break;

			case 'modal-confirm': confirmModal(); break;
			case 'modal-cancel': closeModal(); break;
			case 'modal-close': closeModal(); break;
			default: break;
		}
	}

	function onRootClick(event) {
		var target = event.target;
		if (!target || !target.closest) { return; }
		if (target.closest('input[type="checkbox"]')) { return; }
		var actionElement = target.closest('[data-ad-act]');
		if (actionElement) {
			var actionName = actionElement.getAttribute('data-ad-act');
			handleAction(actionElement, event);
			if (actionName === 'file-menu' || actionName === 'folder-menu' || actionName === 'toggle-copy-menu' || actionName === 'toggle-download-menu') {
				event.stopPropagation();
			}
			return;
		}
		var fileElement = target.closest('[data-ad-file-id]');
		if (fileElement) {
			if (target.closest('button, input, select, label, a')) { return; }
			handleFileActivation(fileElement, event);
			return;
		}
		var folderElement = target.closest('[data-ad-folder-path]');
		if (folderElement) {
			if (target.closest('button, input, select, label, a')) { return; }
			navigateTo(folderElement.getAttribute('data-ad-folder-path'));
		}
	}

	function onRootContextMenu(event) {
		var target = event.target;
		if (!target || !target.closest) { return; }
		var fileElement = target.closest('[data-ad-file-id]');
		if (fileElement) {
			event.preventDefault();
			openFileContextMenu(fileElement.getAttribute('data-ad-file-id'), event.clientX, event.clientY);
			return;
		}
		var folderElement = target.closest('[data-ad-folder-path]');
		if (folderElement) {
			var path = folderElement.getAttribute('data-ad-folder-path');
			if (path) {
				event.preventDefault();
				openFolderContextMenu(path, event.clientX, event.clientY);
			}
		}
	}

	function onRootChange(event) {
		var target = event.target;
		if (!target) { return; }
		if (target.getAttribute && target.getAttribute('data-ad-select-id')) {
			var id = target.getAttribute('data-ad-select-id');
			if (target.checked) { state.selectedIds[id] = true; } else { delete state.selectedIds[id]; }
			state.lastClickedId = id;
			updateSelectionUi();
			return;
		}
		if (target.getAttribute && target.getAttribute('data-ad-detail-name')) {
			saveDetailName(target.getAttribute('data-ad-detail-name'), target.value);
			return;
		}
		if (target.getAttribute && target.getAttribute('data-ad-detail-tags')) {
			saveDetailTags(target.getAttribute('data-ad-detail-tags'), target.value);
			return;
		}
		if (target.id === 'ad-type-filter') {
			state.typeFilter = target.value || 'all';
			state.selectedIds = {};
			renderContent();
			renderHeader();
			renderBulkBar();
			return;
		}
		if (target.id === 'ad-sort-select') {
			state.sortBy = target.value || 'name';
			state.sortDir = state.sortBy === 'name' ? 'asc' : 'desc';
			renderToolbar();
			renderContent();
		}
	}

	function onDocumentClick(event) {
		var target = event.target;
		if (!target || !target.closest) { closeDropdowns(); closeContextMenu(); return; }
		if (!target.closest('.ad-menu-wrap, #ad-context-menu')) {
			closeDropdowns();
		}
		if (!target.closest('#ad-context-menu')) {
			closeContextMenu();
		}
	}

	function handleArrowNavigation(event) {
		var tag = String(event.target && event.target.tagName ? event.target.tagName : '').toUpperCase();
		if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') { return; }
		var filesElement = byId('ad-files');
		if (!filesElement) { return; }
		var items = filesElement.querySelectorAll('[data-ad-file-id], [data-ad-folder-path]');
		if (!items.length) { return; }
		var active = document.activeElement;
		var current = active && active.closest ? active.closest('[data-ad-file-id], [data-ad-folder-path]') : null;
		var index = -1;
		for (var position = 0; position < items.length; position++) {
			if (items[position] === current) { index = position; break; }
		}
		var nextIndex = -1;
		if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
			nextIndex = index < 0 ? 0 : Math.min(index + 1, items.length - 1);
		} else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
			nextIndex = index <= 0 ? 0 : index - 1;
		} else if (event.key === 'Home') {
			nextIndex = 0;
		} else if (event.key === 'End') {
			nextIndex = items.length - 1;
		} else if (event.key === 'Enter' && current) {
			event.preventDefault();
			var entryId = current.getAttribute('data-ad-file-id');
			if (entryId) { openDetail(entryId); } else { navigateTo(current.getAttribute('data-ad-folder-path')); }
			return;
		} else if (event.key === ' ' && current) {
			var spaceId = current.getAttribute('data-ad-file-id');
			if (spaceId) {
				event.preventDefault();
				toggleSelection(spaceId);
			}
			return;
		} else {
			return;
		}
		if (nextIndex >= 0) {
			event.preventDefault();
			try { items[nextIndex].focus(); } catch (error) { }
		}
	}

	function onGlobalKeyDown(event) {
		if (event.key === 'Escape') {
			var modal = byId('ad-modal');
			if (modal && !modal.hidden) {
				event.preventDefault();
				closeModal();
				return;
			}
			if (state.titleEditing) {
				event.preventDefault();
				commitTitleEdit(false);
				return;
			}
			var contextMenu = byId('ad-context-menu');
			if (contextMenu && !contextMenu.hidden) {
				event.preventDefault();
				closeContextMenu();
				return;
			}
			if (state.openMenu) {
				event.preventDefault();
				closeDropdowns();
				return;
			}
			if (selectedIds().length) {
				event.preventDefault();
				clearSelection();
			}
			return;
		}
		if (event.key === 'Enter') {
			var openModalElement = byId('ad-modal');
			if (openModalElement && !openModalElement.hidden) {
				var tag = String(event.target && event.target.tagName ? event.target.tagName : '').toUpperCase();
				if (tag !== 'TEXTAREA') {
					event.preventDefault();
					confirmModal();
				}
				return;
			}
		}
		var detailInput = event.target && event.target.getAttribute ? (event.target.getAttribute('data-ad-detail-name') || event.target.getAttribute('data-ad-detail-tags')) : '';
		if (event.key === 'Enter' && detailInput) {
			event.preventDefault();
			event.target.blur();
			return;
		}
		var modalElement = byId('ad-modal');
		if (modalElement && !modalElement.hidden) { return; }
		handleArrowNavigation(event);
	}

	/* ── wiring ────────────────────────────────────────────────────────── */

	function bindOnce() {
		var root = byId('ad-root');
		if (!root) { return; }
		if (root.getAttribute('data-ad-bound') === '1') { return; }
		root.setAttribute('data-ad-bound', '1');
		root.addEventListener('click', onRootClick);
		root.addEventListener('contextmenu', onRootContextMenu);
		root.addEventListener('change', onRootChange);
		document.addEventListener('click', onDocumentClick);
		document.addEventListener('keydown', onGlobalKeyDown);

		var titleButton = byId('ad-title-button');
		if (titleButton) {
			titleButton.addEventListener('click', function (event) {
				event.preventDefault();
				startTitleEdit();
			});
		}
		var titleInput = byId('ad-title-input');
		if (titleInput) {
			titleInput.addEventListener('keydown', function (event) {
				if (event.key === 'Enter') { event.preventDefault(); commitTitleEdit(true); }
				else if (event.key === 'Escape') { event.preventDefault(); commitTitleEdit(false); }
			});
			titleInput.addEventListener('blur', function () {
				if (state.titleEditing) { commitTitleEdit(true); }
			});
		}

		var searchInput = byId('ad-search-input');
		if (searchInput) {
			searchInput.addEventListener('input', function () {
				var nextSearch = searchInput.value;
				if (state.searchTimer) { window.clearTimeout(state.searchTimer); }
				state.searchTimer = window.setTimeout(function () {
					state.search = nextSearch.trim();
					state.selectedIds = {};
					state.lastClickedId = '';
					renderToolbar();
					renderContent();
					renderHeader();
					renderBulkBar();
				}, 120);
			});
		}

		var saveButton = byId('ad-save-button');
		if (saveButton) {
			saveButton.addEventListener('click', function () {
				if (!toolApi || typeof toolApi.requestSave !== 'function') {
					notify('Saving is not available in this CMS field (allowRequestSave is not enabled).', 'warning');
					return;
				}
				toolApi.requestSave(function (error, ok) {
					if (error || !ok) {
						notify('Save failed: ' + (error || 'not allowed'), 'error');
					} else {
						notify('Drive saved.', 'success');
					}
				});
			});
		}

		root.addEventListener('error', function (event) {
			var image = event.target;
			if (!image || !image.classList || !image.classList.contains('ad-thumb')) { return; }
			var media = image.closest('.ad-card-media, .ad-detail-preview, .ad-row-name-icon');
			if (media) { media.classList.add('ad-media-failed'); }
			if (image.parentNode) { image.parentNode.removeChild(image); }
		}, true);

		var modalOverlay = byId('ad-modal');
		if (modalOverlay) {
			modalOverlay.addEventListener('mousedown', function (event) {
				if (event.target === modalOverlay) { closeModal(); }
			});
		}
	}

	/* ── boot ──────────────────────────────────────────────────────────── */

	toolApi.onReady(function (value) {
		state.value = normalizeValue(value);
		state.lastLocalJson = JSON.stringify(state.value);
		state.currentPath = '';
		try { bindOnce(); } catch (error) {
			console.warn('[AssetDrive] DOM wiring failed: ' + (error && error.message ? error.message : error));
		}
		initIdentity();
		renderAll();

		try {
			state.readOnly = typeof toolApi.isReadOnly === 'function' ? !!toolApi.isReadOnly() : false;
		} catch (error) { state.readOnly = false; }
		renderAll();

		try {
			if (typeof toolApi.onValueChange === 'function') {
				toolApi.onValueChange(function (nextValue) {
					var normalized = normalizeValue(nextValue);
					var incoming = JSON.stringify(normalized);
					if (incoming === state.lastLocalJson) { return; }
					state.value = normalized;
					if (state.currentPath && !folderExists(state.currentPath)) { state.currentPath = ''; }
					if (state.detailId && !fileById(state.detailId)) { state.detailId = ''; }
					var keepSelection = {};
					for (var key in state.selectedIds) {
						if (Object.prototype.hasOwnProperty.call(state.selectedIds, key) && fileById(key)) { keepSelection[key] = true; }
					}
					state.selectedIds = keepSelection;
					renderAll();
				});
			}
		} catch (error) { }

		try {
			if (typeof toolApi.onReadonlyChange === 'function') {
				toolApi.onReadonlyChange(function (readOnly) {
					state.readOnly = !!readOnly;
					renderAll();
				});
			}
		} catch (error) { }

		try {
			if (typeof toolApi.onUserChange === 'function') {
				toolApi.onUserChange(function (user) {
					state.user = user || null;
					if (user) { state.noIdentity = false; }
					renderAll();
				});
			}
		} catch (error) { }

		try {
			if (typeof toolApi.declareParams === 'function') {
				toolApi.declareParams([
					{ name: 'driveLabel', label: 'Drive label', type: 'text', default: 'Asset Drive', severity: 'optional', hint: 'Header title used when this drive has no name yet.' },
					{ name: 'maxUploadSizeMb', label: 'Maximum upload size (MB)', type: 'number', default: '25', severity: 'optional', hint: 'Uploads larger than this are rejected with a message.' },
					{ name: 'showSaveButton', label: 'Show Save button', type: 'toggle', default: 'no', severity: 'optional', hint: 'Adds a Save button that calls tool.requestSave. Requires allowRequestSave.' }
				]);
			}
			if (typeof toolApi.reportMissingParams === 'function') { toolApi.reportMissingParams([]); }
			if (typeof toolApi.declareOutput === 'function') {
				toolApi.declareOutput({
					type: 'object',
					properties: {
						folderId: { type: 'string' },
						name: { type: 'string' },
						emptyFolders: { type: 'array', items: { type: 'string' } },
						files: {
							type: 'array',
							items: {
								type: 'object',
								properties: {
									id: { type: 'string' },
									name: { type: 'string' },
									displayName: { type: 'string' },
									path: { type: 'string' },
									url: { type: 'string' },
									thumb_url: { type: 'string' },
									cdnUrl: { type: 'string' },
									contentType: { type: 'string' },
									size: { type: 'number' },
									updatedAt: { type: 'number' },
									firstUploadedAt: { type: 'number' },
									starred: { type: 'boolean' },
									locked: { type: 'boolean' },
									tags: { type: 'array', items: { type: 'string' } },
									colorLabel: { type: 'string' },
									versions: { type: 'array' }
								}
							}
						}
					}
				});
			}
		} catch (error) {
			console.warn('[AssetDrive] declaration failed: ' + (error && error.message ? error.message : error));
		}
	});
})();
