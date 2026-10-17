#!/usr/bin/env node
/* =============================================================================
   build-test-harness.js
   Builds test-harness.html: a local preview of the website pages with the
   central header and footer loaded around them, so pages can be checked
   before they go into the CMS.

   Usage (from this folder):   node build-test-harness.js

   How the harness works
   - Every fragment (header, footer, each page) is embedded in the harness as a
     snapshot, so test-harness.html works when opened straight from disk
     (file://), where fetch() is blocked.
   - When the harness IS served over http, it reads the fragment files from disk
     instead, so edits show up without rebuilding.
   - To add a page: add one row to PAGES below and re-run this script.
   ============================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUTPUT = path.join(ROOT, 'test-harness.html');

/* ---- the pages shown in the harness (add new pages here) ---- */
const PAGES = [
	{ file: 'home-page.html', label: 'Home', slug: 'home', route: '/' },
	{ file: 'how-it-works.html', label: 'How it works', slug: 'how-it-works', route: '/how-it-works' },
	{ file: 'programs.html', label: 'Programmes', slug: 'programs', route: '/programs' },
	{ file: 'free-lessons.html', label: 'Free lessons', slug: 'free-lessons', route: '/free-lessons' },
	{ file: 'mock-exams.html', label: 'Mock exams', slug: 'mock-exams', route: '/mock-exams' },
	{ file: 'about-us.html', label: 'About us', slug: 'about-us', route: '/about-us' },
	{ file: 'contact.html', label: 'Contact', slug: 'contact', route: '/contact' },
	{ file: 'volunteer.html', label: 'Volunteer', slug: 'volunteer', route: '/volunteer' },
	{ file: 'volunteer-role-online-maths-teacher.html', label: 'Role: Maths teacher', slug: 'volunteer-role-online-maths-teacher', route: '/volunteer-role-online-maths-teacher' },
	{ file: 'volunteer-role-mock-exam-organiser.html', label: 'Role: Exam organiser', slug: 'volunteer-role-mock-exam-organiser', route: '/volunteer-role-mock-exam-organiser' },
	{ file: 'volunteer-role-seminar-presenter-english.html', label: 'Role: Seminar (EN)', slug: 'volunteer-role-seminar-presenter-english', route: '/volunteer-role-seminar-presenter-english' },
	{ file: 'volunteer-role-seminar-presenter-other-languages.html', label: 'Role: Seminar (other)', slug: 'volunteer-role-seminar-presenter-other-languages', route: '/volunteer-role-seminar-presenter-other-languages' },
	{ file: 'volunteer-role-self-paced-course-assistant.html', label: 'Role: Self-paced', slug: 'volunteer-role-self-paced-course-assistant', route: '/volunteer-role-self-paced-course-assistant' },
	{ file: 'volunteer-role-curriculum-builder.html', label: 'Role: Curriculum', slug: 'volunteer-role-curriculum-builder', route: '/volunteer-role-curriculum-builder' },
	{ file: 'volunteer-role-online-lessons-helper.html', label: 'Role: Lessons helper', slug: 'volunteer-role-online-lessons-helper', route: '/volunteer-role-online-lessons-helper' },
	{ file: 'volunteer-role-academic-writing-guide.html', label: 'Role: Writing guide', slug: 'volunteer-role-academic-writing-guide', route: '/volunteer-role-academic-writing-guide' },
	{ file: 'volunteer-role-career-coach.html', label: 'Role: Career coach', slug: 'volunteer-role-career-coach', route: '/volunteer-role-career-coach' },
	{ file: 'volunteer-role-career-path-presenter.html', label: 'Role: Profession talk', slug: 'volunteer-role-career-path-presenter', route: '/volunteer-role-career-path-presenter' },
	{ file: 'join.html', label: 'Join', slug: 'join', route: '/join' },
	{ file: 'formpages/career-fair-entry-registration-2026-10-17.html', label: 'Form: Career fair', slug: 'career-fair-entry-registration-2026-10-17', route: '/career-fair-entry-registration-2026-10-17' },
	{ file: 'faq.html', label: 'FAQ', slug: 'faq', route: '/faq' }
];

const CHROME = {
	header: 'header-footer/header.html',
	footer: 'header-footer/footer.html'
};

function readFileOrThrow(relativePath) {
	const absolutePath = path.join(ROOT, relativePath);
	if (!fs.existsSync(absolutePath)) {
		throw new Error('Missing fragment: ' + relativePath);
	}
	return fs.readFileSync(absolutePath, 'utf8');
}

const chromeHtml = {
	header: readFileOrThrow(CHROME.header),
	footer: readFileOrThrow(CHROME.footer)
};

const pageEntries = PAGES.map(function (page) {
	const html = readFileOrThrow(page.file);
	if (/<!DOCTYPE|<html[\s>]|<head[\s>]|<body[\s>]/i.test(html.replace(/<style>[\s\S]*?<\/style>/gi, '').replace(/<script>[\s\S]*?<\/script>/gi, ''))) {
		console.warn('WARNING: ' + page.file + ' looks like a full document, not a CMS fragment.');
	}
	return { file: page.file, label: page.label, slug: page.slug, route: page.route || '', html: html };
});

const payload = JSON.stringify({
	builtAt: new Date().toISOString(),
	chromePaths: CHROME,
	chrome: chromeHtml,
	pages: pageEntries
}).replace(/</g, '\\u003c');

const harness = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Future Bridge Academy - local page preview (header + page + footer)</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=Bricolage+Grotesque:wght@700;800&display=swap" rel="stylesheet">
<style>
	/* ---- dev tool chrome only; this file is never published ---- */
	:root {
		--tool-bar: #1f2937;
		--tool-bar-text: #e5e7eb;
		--tool-bg: #eef1f5;
		--tool-line: #d8dee6;
		--tool-muted: #5a6675;
	}

	* { box-sizing: border-box; }

	body {
		margin: 0;
		background: var(--tool-bg);
		color: #1e293b;
		font-family: 'DM Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
		line-height: 1.5;
	}

	.bar {
		position: sticky;
		top: 0;
		z-index: 9999;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
		padding: 10px 16px;
		background: var(--tool-bar);
		color: #fff;
		box-shadow: 0 2px 10px rgba(15, 23, 42, 0.28);
	}

	.bar .brand {
		font-size: 13.5px;
		font-weight: 700;
		letter-spacing: 0.02em;
		white-space: nowrap;
	}

	.bar .brand span {
		display: block;
		font-size: 11px;
		font-weight: 400;
		color: var(--tool-bar-text);
		letter-spacing: 0;
	}

	.bar .spacer { flex: 1 1 auto; }

	.group {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		padding: 4px;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.12);
	}

	#pageNav {
		flex: 1 1 100%;
	}

	.group-label {
		align-self: center;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: #cbd5e1;
		padding: 0 2px;
	}

	button {
		appearance: none;
		border: 0;
		background: transparent;
		color: var(--tool-bar-text);
		font: inherit;
		font-size: 12.5px;
		padding: 6px 13px;
		border-radius: 7px;
		cursor: pointer;
		white-space: nowrap;
	}

	button:hover { background: rgba(255, 255, 255, 0.18); }

	button.on {
		background: #fff;
		color: #1f2937;
		font-weight: 700;
	}

	button:focus-visible {
		outline: 3px solid #FFD23F;
		outline-offset: 2px;
	}

	.status {
		font-size: 12px;
		color: #cbd5e1;
		flex: 1 1 260px;
	}

	.status b { color: #fff; }

	.error {
		display: none;
		padding: 9px 16px;
		background: #fdeeec;
		color: #b23b30;
		font-size: 12.5px;
		border-bottom: 1px solid #f3c8c3;
	}

	.notice {
		display: none;
		padding: 9px 16px;
		background: #eaf2f8;
		color: #0f5c8a;
		font-size: 12.5px;
		border-bottom: 1px solid #cfe1ef;
	}

	.stage-wrap { padding: 18px; }

	.stage {
		width: 100%;
		max-width: 100%;
		margin: 0 auto;
		background: #fff;
		border: 1px solid var(--tool-line);
		box-shadow: 0 10px 34px rgba(15, 23, 42, 0.12);
		overflow: hidden;
		transition: width 0.18s ease;
	}

	.stage[data-w="1440"] { width: 1440px; max-width: 100%; }
	.stage[data-w="1024"] { width: 1024px; }
	.stage[data-w="768"] { width: 768px; }
	.stage[data-w="390"] { width: 390px; }

	.frame-note {
		max-width: 1180px;
		margin: 0 auto;
		padding: 0 6px 6px;
		font-size: 11.5px;
		color: var(--tool-muted);
		text-align: right;
	}

	.help {
		max-width: 1180px;
		margin: 0 auto;
		padding: 14px 18px 40px;
		font-size: 12.5px;
		color: var(--tool-muted);
	}

	.help b { color: #1e293b; }

	code {
		background: #fff;
		border: 1px solid var(--tool-line);
		border-radius: 4px;
		padding: 1px 5px;
		font-family: Consolas, 'Courier New', monospace;
		font-size: 12px;
	}

	@media (max-width: 1100px) {
		.stage[data-w="1440"], .stage[data-w="1024"], .stage[data-w="768"] { width: 100%; }
	}
</style>
</head>
<body>

<div class="bar">
	<div class="brand">Future Bridge Academy<span>local page preview - header + page + footer</span></div>

	<div class="group" id="pageNav" role="group" aria-label="Page"></div>

	<span class="group-label">width</span>
	<div class="group" id="viewNav" role="group" aria-label="Viewport width">
		<button type="button" data-w="full" class="on">Full</button>
		<button type="button" data-w="1440">1440</button>
		<button type="button" data-w="1024">1024</button>
		<button type="button" data-w="768">768</button>
		<button type="button" data-w="390">390</button>
	</div>

	<div class="group">
		<button type="button" id="reloadBtn">Reload</button>
	</div>

	<div class="status" id="status">Loading...</div>
</div>

<div class="error" id="errorBox"></div>
<div class="notice" id="noticeBox"></div>

<div class="stage-wrap">
	<div class="stage" id="stage">
		<div id="stageInner"></div>
	</div>
	<div class="frame-note" id="frameNote"></div>
</div>

<div class="help">
	<b>How to use this harness.</b>
	Pick a page above and it renders exactly the way the CMS composes it: the central header, then the page
	fragment, then the central footer.
	<br>
	<b>Served mode:</b> open this file through a local server (for example <code>npx serve .</code> or
	VS Code Live Server) and the harness reads <code>header-footer/header.html</code>, the page file and
	<code>header-footer/footer.html</code> straight from disk. Edit a file, hit <b>Reload</b>, done.
	<br>
	<b>File mode:</b> if you just double-click this file, browsers block local file reads, so the harness shows
	the snapshot embedded when the harness was built. Edit a page, then run
	<code>node build-test-harness.js</code> again and refresh.
	<br>
	<b>Links behave like the CMS:</b> the pages link with routes (<code>/</code>, <code>/how-it-works</code>,
	<code>/about-us</code>), never with <code>.html</code>. Clicking any internal link stays inside this harness
	and renders that page here; a route that has no page yet shows a blue notice instead of navigating away.
	<br>
	<b>Deep links:</b> <code>test-harness.html?page=how-it-works</code> or <code>test-harness.html#how-it-works</code>.
	<br>
	<b>Remember:</b> add new pages to the <code>PAGES</code> list in <code>build-test-harness.js</code> and rebuild,
	so every page stays testable here.
</div>

<script>
var FBA_PREVIEW = ${payload};

(function () {
	'use strict';

	var data = window.FBA_PREVIEW || { pages: [], chrome: {} };
	var pageNav = document.getElementById('pageNav');
	var viewNav = document.getElementById('viewNav');
	var stage = document.getElementById('stage');
	var stageInner = document.getElementById('stageInner');
	var statusLine = document.getElementById('status');
	var errorBox = document.getElementById('errorBox');
	var noticeBox = document.getElementById('noticeBox');
	var frameNote = document.getElementById('frameNote');
	var currentPage = data.pages[0] || null;

	function showError(message) {
		errorBox.textContent = 'Script error: ' + message;
		errorBox.style.display = 'block';
	}

	function showNotice(message) {
		noticeBox.textContent = message;
		noticeBox.style.display = 'block';
	}

	window.addEventListener('error', function (event) {
		showError((event.message || 'unknown') + (event.lineno ? ' (line ' + event.lineno + ')' : ''));
	});

	/* ---------- page buttons ---------- */
	data.pages.forEach(function (page) {
		var button = document.createElement('button');
		button.type = 'button';
		button.textContent = page.label;
		button.setAttribute('data-slug', page.slug);
		if (page.route) { button.title = page.route; }
		button.addEventListener('click', function () { render(page.slug); });
		pageNav.appendChild(button);
	});

	function markActive(container, attribute, value) {
		Array.prototype.forEach.call(container.querySelectorAll('button'), function (button) {
			button.classList.toggle('on', button.getAttribute(attribute) === value);
		});
	}

	/* ---------- viewport buttons ---------- */
	viewNav.addEventListener('click', function (event) {
		var button = event.target.closest ? event.target.closest('button') : null;
		if (!button) { return; }
		var width = button.getAttribute('data-w') || 'full';
		if (width === 'full') {
			stage.removeAttribute('data-w');
			frameNote.textContent = 'Full width (fills the browser window)';
		} else {
			stage.setAttribute('data-w', width);
			frameNote.textContent = 'Preview frame: ' + width + 'px wide';
		}
		markActive(viewNav, 'data-w', width);
	});

	document.getElementById('reloadBtn').addEventListener('click', function () {
		if (currentPage) { render(currentPage.slug); }
	});

	/* ---------- fragment loading: live when served, snapshot when opened from disk ---------- */
	function fetchOrEmbed(relativePath, embeddedHtml) {
		var url = relativePath + '?t=' + Date.now();
		return fetch(url, { cache: 'no-store' }).then(function (response) {
			if (!response.ok) { throw new Error('HTTP ' + response.status); }
			return response.text();
		}).then(function (text) {
			return { html: text, live: true };
		}).catch(function () {
			return { html: embeddedHtml, live: false };
		});
	}

	/* ---------- scripts inside fragments must be re-created to run ---------- */
	function runFragmentScripts(container) {
		var scripts = Array.prototype.slice.call(container.querySelectorAll('script'));
		scripts.forEach(function (oldScript) {
			var freshScript = document.createElement('script');
			if (oldScript.src) {
				freshScript.src = oldScript.src;
				freshScript.async = false;
			} else {
				freshScript.textContent = oldScript.textContent;
			}
			oldScript.parentNode.replaceChild(freshScript, oldScript);
		});
		return scripts.length;
	}

	function updateStatus(mode, scriptCount) {
		var builtAt = data.builtAt ? new Date(data.builtAt).toLocaleString() : 'unknown';
		if (mode === 'live') {
			statusLine.innerHTML = 'Served mode: reading the files from disk. Edit and press <b>Reload</b>.';
		} else {
			statusLine.innerHTML = 'File mode: showing the snapshot embedded ' + builtAt +
				'. After editing a file run <code>node build-test-harness.js</code> and refresh.';
		}
		statusLine.innerHTML += ' <b>' + scriptCount + ' fragment scripts run.</b>';
	}

	/* ---------- route helpers: in the CMS links look like /how-it-works ---------- */
	function routeKey(value) {
		var text = String(value == null ? '' : value);
		text = text.split('#')[0].split('?')[0];
		while (text.charAt(0) === '.') { text = text.slice(1); }
		while (text.charAt(0) === '/') { text = text.slice(1); }
		while (text.slice(-1) === '/') { text = text.slice(0, -1); }
		if (text.toLowerCase().slice(-5) === '.html') { text = text.slice(0, -5); }
		if (!text || text === 'index') { return 'home'; }
		return text;
	}

	function hashPart(value) {
		var parts = String(value == null ? '' : value).split('#');
		return parts.length > 1 ? parts[1] : '';
	}

	function pageFor(value) {
		var key = routeKey(value);
		var found = null;
		data.pages.forEach(function (candidate) {
			if (candidate.slug === key ||
				routeKey(candidate.file) === key ||
				routeKey(candidate.route || '') === key) {
				found = candidate;
			}
		});
		return found;
	}

	/* ---------- internal links stay inside the harness ----------
	   Links in the pages use CMS routes (/how-it-works, /about-us). Here they are
	   mapped back to the local files, so clicking the site's own navigation never
	   navigates away from the harness. A route with no page yet shows a notice. */
	var pendingAnchor = '';

	document.addEventListener('click', function (event) {
		var link = event.target.closest ? event.target.closest('a[href]') : null;
		if (!link) { return; }

		var href = link.getAttribute('href') || '';
		if (!href || href.charAt(0) === '#') { return; }
		if (href.indexOf('//') === 0 || /^[a-z][a-z0-9+.-]*:/i.test(href)) { return; }

		event.preventDefault();
		var target = pageFor(href);
		if (!target) {
			showNotice('That link points to "' + href + '", which is not in this harness yet. ' +
				'Add the page to the PAGES list in build-test-harness.js and rebuild.');
			return;
		}
		pendingAnchor = hashPart(href);
		render(target.slug);
	}, true);

	/* ---------- render ---------- */
	function render(value) {
		var page = pageFor(value) || (currentPage ? pageFor(currentPage.slug) : null) || data.pages[0];
		if (!page) { showError('No pages are configured in build-test-harness.js.'); return; }

		currentPage = page;
		markActive(pageNav, 'data-slug', page.slug);
		errorBox.style.display = 'none';
		noticeBox.style.display = 'none';

		try {
			if (location.hash !== '#' + page.slug) { history.replaceState(null, '', '#' + page.slug); }
		} catch (err) { /* file:// can refuse history writes; the page still renders */ }

		var anchorToJumpTo = pendingAnchor;
		pendingAnchor = '';

		Promise.all([
			fetchOrEmbed(data.chromePaths.header, data.chrome.header),
			fetchOrEmbed(page.file, page.html),
			fetchOrEmbed(data.chromePaths.footer, data.chrome.footer)
		]).then(function (parts) {
			stageInner.innerHTML = parts.map(function (part) { return part.html; }).join('\\n');
			var scriptCount = runFragmentScripts(stageInner);

			if (anchorToJumpTo) {
				var jumpTarget = document.getElementById(anchorToJumpTo);
				if (jumpTarget && jumpTarget.scrollIntoView) { jumpTarget.scrollIntoView(); }
			} else {
				window.scrollTo(0, 0);
			}

			var allLive = parts.every(function (part) { return part.live; });
			updateStatus(allLive ? 'live' : 'snapshot', scriptCount);
		}).catch(function (error) {
			showError('render failed: ' + (error && error.message ? error.message : error));
		});
	}

	/* ---------- initial page: ?page=... then #hash, else the first page ---------- */
	var initialValue = '';
	try {
		initialValue = new URLSearchParams(location.search).get('page') || '';
	} catch (err) { initialValue = ''; }
	if (!initialValue) { initialValue = (location.hash || '').replace('#', ''); }
	render(initialValue || (data.pages[0] ? data.pages[0].slug : ''));
})();
</script>
</body>
</html>
`;

fs.writeFileSync(OUTPUT, harness, 'utf8');

console.log('Built ' + path.relative(ROOT, OUTPUT));
console.log('  header : ' + CHROME.header + ' (' + chromeHtml.header.length + ' chars)');
console.log('  footer : ' + CHROME.footer + ' (' + chromeHtml.footer.length + ' chars)');
pageEntries.forEach(function (page) {
	console.log('  page   : ' + page.file + ' [' + page.label + ' / ' + page.slug + '] (' + page.html.length + ' chars)');
});
console.log('Open test-harness.html in a browser. Serve the folder for live file reloads.');
