let currentUser = null;
let isAdmin = false;
let isRO = false;
let savedData = { html: '', css: '', js: '', notes: [] };
let notesCollapsed = false;
let richEditActive = false;
let preEditSnapshot = '';
let currentTab = 'viewer';
let currentSubTab = 'html';
let autoSaveTimer = null;
let saveIndicatorTimer = null;
let codeDebounceTimer = null;

// Monaco editor instances
let monacoEditors = {};   // { html, css, js }
let monacoReady = false;
let monacoReadyQueue = [];   // callbacks waiting for monaco

/* ── Bootstrap ── */
tool.onReady((val, fields) => {
	currentUser = tool.getUser();
	isAdmin = hasEditRole(currentUser);
	savedData = parseValue(val);

	initMonaco(() => {
		renderAll();
		isRO = tool.isReadOnly();
		applyReadOnly(isRO);
	});

	tool.onValueChange(v => {
		if (richEditActive) return;
		savedData = parseValue(v);
		renderViewer();
		setMonacoValues();
		renderNotes();
	});
	tool.onReadonlyChange(ro => { isRO = ro; applyReadOnly(ro); });
	tool.onUserChange(u => {
		currentUser = u;
		isAdmin = hasEditRole(u);
		applyReadOnly(isRO);
		renderNotes();
	});
});

/* ── Monaco init ── */
function initMonaco(cb) {
	require.config({
		paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' }
	});

	require(['vs/editor/editor.main'], () => {
		const commonOpts = {
			theme: 'vs',
			fontSize: 13,
			lineHeight: 22,
			fontFamily: "'Fira Code', 'Cascadia Code', 'Courier New', monospace",
			fontLigatures: true,
			minimap: { enabled: false },
			scrollBeyondLastLine: false,
			wordWrap: 'on',
			automaticLayout: false,   // we call layout() manually
			tabSize: 2,
			renderLineHighlight: 'line',
			scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
			padding: { top: 12, bottom: 12 },
			suggest: { showWords: true },
			quickSuggestions: { other: true, comments: false, strings: false }
		};

		monacoEditors.html = monaco.editor.create(
			document.getElementById('monaco-html'),
			{ ...commonOpts, language: 'html', value: savedData.html }
		);
		monacoEditors.css = monaco.editor.create(
			document.getElementById('monaco-css'),
			{ ...commonOpts, language: 'css', value: savedData.css }
		);
		monacoEditors.js = monaco.editor.create(
			document.getElementById('monaco-js'),
			{ ...commonOpts, language: 'javascript', value: savedData.js }
		);

		// wire change listeners
		monacoEditors.html.onDidChangeModelContent(() => onMonacoChange('html'));
		monacoEditors.css.onDidChangeModelContent(() => onMonacoChange('css'));
		monacoEditors.js.onDidChangeModelContent(() => onMonacoChange('js'));

		monacoReady = true;
		document.getElementById('monaco-loading').classList.add('hidden');

		layoutActiveEditor();
		cb && cb();
	});
}

function layoutActiveEditor() {
	const ed = monacoEditors[currentSubTab];
	if (ed) ed.layout();
}

function setMonacoValues() {
	if (!monacoReady) return;
	['html', 'css', 'js'].forEach(k => {
		const ed = monacoEditors[k];
		const val = savedData[k] || '';
		if (ed && ed.getValue() !== val) {
			ed.setValue(val);
		}
	});
	updateSubtabBadges();
	updateCharCount();
}

function onMonacoChange(field) {
	if (!monacoReady) return;
	savedData[field] = monacoEditors[field].getValue();
	updateCharCount();
	updateSubtabBadges();
	clearTimeout(codeDebounceTimer);
	codeDebounceTimer = setTimeout(() => {
		save(true);
		if (currentTab === 'viewer') renderViewer();
	}, 800);
}

/* ── Helpers ── */
function hasEditRole(u) {
	return u && Array.isArray(u.roles) &&
		(u.roles.includes('admin') || u.roles.includes('editor'));
}

function parseValue(val) {
	if (!val) return { html: '', css: '', js: '', notes: [] };
	if (typeof val === 'string') return { html: val, css: '', js: '', notes: [] };
	return {
		html: val.html || '',
		css: val.css || '',
		js: val.js || '',
		notes: Array.isArray(val.notes) ? val.notes : []
	};
}

function save(silent) {
	tool.setValue(savedData);
	tool.reportValid(true);
	if (silent) showSaveIndicator();
}

function showSaveIndicator() {
	const el = document.getElementById('autosave-indicator');
	el.style.display = 'flex';
	el.classList.add('visible');
	clearTimeout(saveIndicatorTimer);
	saveIndicatorTimer = setTimeout(() => {
		el.classList.remove('visible');
		setTimeout(() => { el.style.display = 'none'; }, 400);
	}, 2000);
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function formatTime(iso) {
	const d = new Date(iso);
	return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
		' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function escHtml(str) {
	return String(str)
		.replace(/&/g, '&amp;').replace(/</g, '&lt;')
		.replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function visibleNotes() {
	if (isAdmin) return savedData.notes;
	const myId = currentUser ? currentUser.id : null;
	return savedData.notes.filter(n => n.authorId === myId);
}

function updateCharCount() {
	const val = monacoReady
		? (monacoEditors[currentSubTab]?.getValue() || '')
		: (savedData[currentSubTab] || '');
	const len = val.length;
	document.getElementById('char-count').textContent =
		len.toLocaleString() + ' char' + (len !== 1 ? 's' : '');
}

function updateSubtabBadges() {
	document.getElementById('css-badge').style.display = savedData.css.trim() ? 'inline-flex' : 'none';
	document.getElementById('js-badge').style.display = savedData.js.trim() ? 'inline-flex' : 'none';
}

/* ── Viewer ── */
function buildViewerHTML() {
	const html = savedData.html || '';
	const css = savedData.css || '';
	const js = savedData.js || '';
	return `<!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      body { margin: 0; padding: 0; font-family: system-ui, sans-serif; font-size: 15px; line-height: 1.7; color: #111; }
      h1 { font-size: 2em; font-weight: 600; margin: 0.75em 0 0.4em; }
      h2 { font-size: 1.5em; font-weight: 600; margin: 0.75em 0 0.4em; }
      h3 { font-size: 1.2em; font-weight: 600; margin: 0.75em 0 0.4em; }
      p { margin: 0 0 0.75em; } ul, ol { margin: 0 0 0.75em 1.5em; } li { margin: 0.2em 0; }
      a { color: #185FA5; } table { border-collapse: collapse; width: 100%; margin: 0 0 0.75em; }
      th, td { border: 0.5px solid #ccc; padding: 8px 12px; text-align: left; }
      th { background: #f5f5f3; font-weight: 500; }
      img { max-width: 100%; height: auto; }
      blockquote { border-left: 3px solid #ccc; margin: 0 0 0.75em; padding: 4px 0 4px 16px; color: #666; }
      pre, code { font-family: monospace; background: #f5f5f3; border-radius: 4px; font-size: 13px; }
      pre { padding: 12px 16px; overflow-x: auto; margin: 0 0 0.75em; }
      code { padding: 1px 5px; }
      ${css}
    </style>
  </head><body>
    <div style="padding: 24px 32px;">${html || '<p style="color:#bbb;font-style:italic;">No content yet.</p>'}</div>
    ${js ? `<script>\n${js}\n<\/script>` : ''}
  </body></html>`;
}

function renderViewer() {
	if (richEditActive) return;
	const wrap = document.getElementById('preview-wrap');
	const hasCSS = savedData.css.trim().length > 0;
	const hasJS = savedData.js.trim().length > 0;

	if (hasCSS || hasJS) {
		let iframe = document.getElementById('viewer-iframe');
		document.getElementById('preview-content').style.display = 'none';
		if (!iframe) {
			iframe = document.createElement('iframe');
			iframe.id = 'viewer-iframe';
			iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
			iframe.style.cssText = 'flex:1;width:100%;height:100%;border:none;min-height:0;';
			wrap.appendChild(iframe);
		}
		iframe.srcdoc = buildViewerHTML();
	} else {
		const iframe = document.getElementById('viewer-iframe');
		if (iframe) iframe.remove();
		const content = document.getElementById('preview-content');
		content.style.display = '';
		content.innerHTML = savedData.html ||
			'<p style="color:#bbb;font-style:italic;">No content yet.</p>';
	}
}

function renderAll() {
	renderViewer();
	setMonacoValues();
	renderNotes();
}

/* ── Tab switching ── */
function switchTab(tab) {
	currentTab = tab;
	const paneViewer = document.getElementById('pane-viewer');
	const paneCode = document.getElementById('pane-code');
	const btnViewer = document.getElementById('btn-viewer');
	const btnCode = document.getElementById('btn-code');

	if (tab === 'viewer') {
		paneViewer.classList.add('active');
		paneCode.classList.remove('active');
		btnViewer.classList.add('active');
		btnCode.classList.remove('active');
		renderViewer();
	} else {
		if (richEditActive) exitRichEdit(false);
		paneCode.classList.add('active');
		paneViewer.classList.remove('active');
		btnCode.classList.add('active');
		btnViewer.classList.remove('active');
		// give DOM a frame to paint before layout
		requestAnimationFrame(() => layoutActiveEditor());
	}
	tool.resize();
}

function switchSubTab(sub) {
	currentSubTab = sub;
	document.querySelectorAll('.code-subtab').forEach(b =>
		b.classList.toggle('active', b.dataset.sub === sub));
	document.querySelectorAll('.monaco-pane').forEach(p =>
		p.classList.toggle('active', p.id === 'monaco-' + sub));
	updateCharCount();
	// layout after display:block kicks in
	requestAnimationFrame(() => layoutActiveEditor());
}

/* ── Rich edit (viewer, HTML only) ── */
function enterRichEdit() {
	if (savedData.css.trim() || savedData.js.trim()) {
		tool.notify('Visual edit is unavailable when CSS or JS is present — edit HTML in the Code tab instead.', 'warning');
		return;
	}
	richEditActive = true;
	preEditSnapshot = savedData.html;

	const content = document.getElementById('preview-content');
	content.contentEditable = 'true';
	content.classList.add('edit-mode');
	content.focus();

	document.getElementById('rich-edit-toolbar').style.display = 'flex';
	document.getElementById('btn-toggle-edit').style.display = 'none';
	document.getElementById('btn-save-edit').style.display = 'flex';
	document.getElementById('btn-cancel-edit').style.display = 'flex';
	document.getElementById('viewer-mode-label').textContent = 'Editing';
	document.getElementById('edit-mode-banner').classList.add('visible');

	content.addEventListener('input', onRichInput);
	content.addEventListener('paste', onRichPaste);
	content.addEventListener('keyup', updateToolbarState);
	content.addEventListener('mouseup', updateToolbarState);
	tool.resize();
}

function exitRichEdit(doSave) {
	richEditActive = false;
	const content = document.getElementById('preview-content');

	content.removeEventListener('input', onRichInput);
	content.removeEventListener('paste', onRichPaste);
	content.removeEventListener('keyup', updateToolbarState);
	content.removeEventListener('mouseup', updateToolbarState);
	clearTimeout(autoSaveTimer);

	if (doSave) {
		savedData.html = content.innerHTML;
		save(false);
		if (monacoReady && monacoEditors.html.getValue() !== savedData.html) {
			monacoEditors.html.setValue(savedData.html);
		}
		tool.notify('Document saved', 'success');
	} else {
		content.innerHTML = preEditSnapshot ||
			'<p style="color:#bbb;font-style:italic;">No content yet.</p>';
		savedData.html = preEditSnapshot;
	}

	content.contentEditable = 'false';
	content.classList.remove('edit-mode');

	document.getElementById('rich-edit-toolbar').style.display = 'none';
	document.getElementById('btn-toggle-edit').style.display = 'flex';
	document.getElementById('btn-save-edit').style.display = 'none';
	document.getElementById('btn-cancel-edit').style.display = 'none';
	document.getElementById('viewer-mode-label').textContent = 'Viewing';
	document.getElementById('edit-mode-banner').classList.remove('visible');
	tool.resize();
}

function onRichInput() {
	savedData.html = document.getElementById('preview-content').innerHTML;
	if (monacoReady && monacoEditors.html.getValue() !== savedData.html) {
		monacoEditors.html.setValue(savedData.html);
	}
	clearTimeout(autoSaveTimer);
	autoSaveTimer = setTimeout(() => {
		tool.setValue(savedData);
		tool.reportValid(true);
		showSaveIndicator();
	}, 800);
}

function onRichPaste(e) {
	e.preventDefault();
	const clip = e.clipboardData || window.clipboardData;
	const htmlData = clip.getData('text/html');
	const textData = clip.getData('text/plain');
	let toInsert = '';

	if (htmlData && htmlData.trim()) {
		toInsert = sanitizePastedHTML(htmlData);
	} else if (textData) {
		toInsert = textData.split('\n')
			.map(l => l.trim()
				? `<p>${l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`
				: '<br>')
			.join('');
	}
	if (!toInsert) return;

	const sel = window.getSelection();
	if (!sel.rangeCount) return;
	sel.deleteFromDocument();
	const range = sel.getRangeAt(0);
	const frag = document.createRange().createContextualFragment(toInsert);
	const lastNode = frag.lastChild;
	range.insertNode(frag);
	if (lastNode) {
		const r = document.createRange();
		r.setStartAfter(lastNode);
		r.collapse(true);
		sel.removeAllRanges();
		sel.addRange(r);
	}
	onRichInput();
}

function sanitizePastedHTML(html) {
	const doc = new DOMParser().parseFromString(html, 'text/html');
	const ALLOWED = new Set([
		'p', 'br', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
		'strong', 'b', 'em', 'i', 'u', 's', 'mark', 'ul', 'ol', 'li', 'a',
		'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
		'img', 'blockquote', 'pre', 'code', 'hr', 'figure', 'figcaption'
	]);
	const ATTRS = {
		'a': ['href', 'title', 'target'],
		'img': ['src', 'alt', 'width', 'height'],
		'td': ['colspan', 'rowspan'],
		'th': ['colspan', 'rowspan', 'scope'],
		'col': ['span']
	};
	function clean(node) {
		if (node.nodeType === Node.TEXT_NODE) return node.cloneNode();
		if (node.nodeType !== Node.ELEMENT_NODE) return null;
		const tag = node.tagName.toLowerCase();
		if (!ALLOWED.has(tag)) {
			const frag = document.createDocumentFragment();
			node.childNodes.forEach(c => { const n = clean(c); if (n) frag.appendChild(n); });
			return frag;
		}
		const el = document.createElement(tag);
		(ATTRS[tag] || []).forEach(attr => {
			if (!node.hasAttribute(attr)) return;
			const val = node.getAttribute(attr);
			if ((attr === 'href' || attr === 'src') && /^javascript:/i.test(val.trim())) return;
			el.setAttribute(attr, val);
		});
		if (tag === 'a') { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener noreferrer'); }
		node.childNodes.forEach(c => { const n = clean(c); if (n) el.appendChild(n); });
		return el;
	}
	const wrap = document.createElement('div');
	const frag = document.createDocumentFragment();
	doc.body.childNodes.forEach(c => { const n = clean(c); if (n) frag.appendChild(n); });
	wrap.appendChild(frag);
	return wrap.innerHTML;
}

/* ── RTE toolbar ── */
document.getElementById('rich-edit-toolbar').addEventListener('mousedown', e => {
	const btn = e.target.closest('.rte-btn');
	if (!btn) return;
	e.preventDefault();
	const cmd = btn.dataset.cmd;
	const content = document.getElementById('preview-content');
	if (cmd === 'h1' || cmd === 'h2' || cmd === 'h3') {
		document.execCommand('formatBlock', false, cmd);
	} else if (cmd === 'createLink') {
		const sel = window.getSelection();
		if (sel && sel.toString().trim()) {
			const link = prompt('Enter URL:');
			if (link && link.trim()) {
				document.execCommand('createLink', false, link.trim());
				content.querySelectorAll('a:not([rel])').forEach(a => {
					a.setAttribute('target', '_blank');
					a.setAttribute('rel', 'noopener noreferrer');
				});
			}
		} else {
			tool.notify('Select text first to add a link', 'warning');
		}
	} else {
		document.execCommand(cmd, false, null);
	}
	content.focus();
	onRichInput();
	updateToolbarState();
});

function updateToolbarState() {
	['bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList'].forEach(cmd => {
		const btn = document.querySelector(`.rte-btn[data-cmd="${cmd}"]`);
		if (btn) btn.classList.toggle('active', document.queryCommandState(cmd));
	});
}

/* ── Read-only ── */
function applyReadOnly(ro) {
	const app = document.getElementById('app');
	const btnToggleEdit = document.getElementById('btn-toggle-edit');
	const tabBar = document.getElementById('tab-bar');

	if (monacoReady) {
		['html', 'css', 'js'].forEach(k => {
			monacoEditors[k]?.updateOptions({ readOnly: ro });
		});
	}

	if (ro) {
		app.classList.add('readonly-mode');
		if (richEditActive) exitRichEdit(false);
		btnToggleEdit.style.display = 'none';
		tabBar.style.display = 'none';
	} else {
		app.classList.remove('readonly-mode');
		tabBar.style.display = 'flex';
		btnToggleEdit.style.display = isAdmin ? 'flex' : 'none';
	}
	switchTab('viewer');
	tool.resize();
}

/* ── Clear ── */
document.getElementById('btn-clear').addEventListener('click', () => {
	if (!savedData[currentSubTab]?.trim()) return;
	savedData[currentSubTab] = '';
	if (monacoReady) monacoEditors[currentSubTab]?.setValue('');
	updateCharCount();
	updateSubtabBadges();
	save(true);
	renderViewer();
	tool.notify(`${currentSubTab.toUpperCase()} cleared`, 'info');
});

/* ── Tab / subtab buttons ── */
document.getElementById('btn-viewer').addEventListener('click', () => switchTab('viewer'));
document.getElementById('btn-code').addEventListener('click', () => switchTab('code'));
document.getElementById('btn-toggle-edit').addEventListener('click', () => enterRichEdit());
document.getElementById('btn-save-edit').addEventListener('click', () => exitRichEdit(true));
document.getElementById('btn-cancel-edit').addEventListener('click', () => exitRichEdit(false));
document.querySelectorAll('.code-subtab').forEach(btn =>
	btn.addEventListener('click', () => switchSubTab(btn.dataset.sub)));

/* ── Notes ── */
function renderNotes() {
	const list = document.getElementById('notes-list');
	const notes = visibleNotes();
	const myId = currentUser ? currentUser.id : null;

	if (notes.length === 0) {
		list.innerHTML = '<p class="notes-empty">No notes yet. Be the first to add one.</p>';
		updateNotesTitle(0); return;
	}

	const sorted = [...notes].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
	list.innerHTML = '';
	sorted.forEach(note => {
		const isOwn = note.authorId === myId;
		const item = document.createElement('div');
		item.className = 'note-item' + (isOwn ? ' own-note' : '');
		item.dataset.id = note.id;
		item.innerHTML = `
      <div class="note-meta">
        <span class="note-author">${escHtml(note.authorName || 'Unknown')}</span>
        ${isOwn ? '<span class="note-badge">You</span>' : ''}
        <span class="note-time">${formatTime(note.createdAt)}</span>
        ${note.updatedAt ? '<span class="note-time"> · edited</span>' : ''}
      </div>
      <div class="note-text">${escHtml(note.text)}</div>
      <textarea class="note-edit-area" rows="3">${escHtml(note.text)}</textarea>
      ${isOwn ? `
        <div class="note-actions">
          <button class="note-btn edit-trigger"><i class="ti ti-edit"></i> Edit</button>
          <button class="note-btn save" style="display:none"><i class="ti ti-check"></i> Save</button>
          <button class="note-btn cancel-edit" style="display:none"><i class="ti ti-x"></i> Cancel</button>
          <button class="note-btn danger delete-btn"><i class="ti ti-trash"></i> Delete</button>
        </div>` : ''}
    `;
		if (isOwn) {
			item.querySelector('.edit-trigger').addEventListener('click', () => startNoteEdit(item, note.id));
			item.querySelector('.save').addEventListener('click', () => commitNoteEdit(item, note.id));
			item.querySelector('.cancel-edit').addEventListener('click', () => cancelNoteEdit(item, note.id));
			item.querySelector('.delete-btn').addEventListener('click', () => deleteNote(note.id));
		}
		list.appendChild(item);
	});
	updateNotesTitle(notes.length);
}

function updateNotesTitle(count) {
	document.getElementById('notes-title').innerHTML =
		`<i class="ti ti-notes"></i> Notes${count > 0
			? ` <span style="font-size:11px;background:var(--color-background-secondary);border:0.5px solid var(--color-border-tertiary);border-radius:99px;padding:1px 7px;">${count}</span>`
			: ''}`;
}

function startNoteEdit(item, id) {
	item.querySelector('.note-text').classList.add('editing');
	item.querySelector('.note-edit-area').classList.add('visible');
	item.querySelector('.edit-trigger').style.display = 'none';
	item.querySelector('.save').style.display = 'flex';
	item.querySelector('.cancel-edit').style.display = 'flex';
	item.querySelector('.delete-btn').style.display = 'none';
	item.querySelector('.note-edit-area').focus();
}

function cancelNoteEdit(item, id) {
	const note = savedData.notes.find(n => n.id === id);
	item.querySelector('.note-edit-area').value = note ? note.text : '';
	item.querySelector('.note-text').classList.remove('editing');
	item.querySelector('.note-edit-area').classList.remove('visible');
	item.querySelector('.edit-trigger').style.display = 'flex';
	item.querySelector('.save').style.display = 'none';
	item.querySelector('.cancel-edit').style.display = 'none';
	item.querySelector('.delete-btn').style.display = 'flex';
}

function commitNoteEdit(item, id) {
	const newText = item.querySelector('.note-edit-area').value.trim();
	if (!newText) { tool.notify('Note cannot be empty', 'warning'); return; }
	const idx = savedData.notes.findIndex(n => n.id === id);
	if (idx === -1) return;
	savedData.notes[idx].text = newText;
	savedData.notes[idx].updatedAt = new Date().toISOString();
	save(false); renderNotes();
	tool.notify('Note updated', 'success');
}

function deleteNote(id) {
	savedData.notes = savedData.notes.filter(n => n.id !== id);
	save(false); renderNotes();
	tool.notify('Note deleted', 'info');
}

function postNote() {
	const input = document.getElementById('note-input');
	const text = input.value.trim();
	if (!text) return;
	savedData.notes.push({
		id: uid(), authorId: currentUser?.id || 'anonymous',
		authorName: currentUser?.name || 'Anonymous',
		text, createdAt: new Date().toISOString(), updatedAt: null
	});
	save(false); renderNotes();
	input.value = ''; input.style.height = '';
	tool.notify('Note posted', 'success');
	document.getElementById('notes-list').scrollTop = 0;
}

document.getElementById('btn-post-note').addEventListener('click', postNote);
document.getElementById('note-input').addEventListener('keydown', e => {
	if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); postNote(); }
});
document.getElementById('note-input').addEventListener('input', function () {
	this.style.height = 'auto';
	this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});
document.getElementById('notes-header').addEventListener('click', () => {
	notesCollapsed = !notesCollapsed;
	document.getElementById('notes-panel').classList.toggle('collapsed', notesCollapsed);
	tool.resize();
});