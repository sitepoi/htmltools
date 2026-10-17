#!/usr/bin/env node
/* =============================================================================
   check-menu.js
   Keeps main-menu.json (the CMS mobile menu source) honest.

   Usage (from this folder):   node check-menu.js

   It asserts that
   - the JSON parses and every item has an id, a label and a url,
   - all ids are unique, clean slugs,
   - every url is in route form (never .html) and is a route reserved in the SSOT,
   - every url also appears in the header chrome, and every route the header
     links appears in the menu, so the two can never drift apart,
   - the two volunteer anchors used by the menu exist on the volunteer page.

   Run it after changing the header navigation, adding a page, or editing the
   menu JSON.
   ============================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const MENU_FILE = path.join(ROOT, 'main-menu.json');
const HEADER_FILE = path.join(ROOT, 'header-footer', 'header.html');
const FOOTER_FILE = path.join(ROOT, 'header-footer', 'footer.html');
const SSOT_FILE = path.join(ROOT, 'ssot_future-bridge-webste.html');
const VOLUNTEER_FILE = path.join(ROOT, 'volunteer.html');

let failures = 0;
let checks = 0;
function check(ok, label, detail) {
	checks = checks + 1;
	if (!ok) {
		failures = failures + 1;
		console.log('FAIL  ' + label + (detail ? ' :: ' + detail : ''));
	}
}

const menu = JSON.parse(fs.readFileSync(MENU_FILE, 'utf8'));
const header = fs.readFileSync(HEADER_FILE, 'utf8');
const footer = fs.readFileSync(FOOTER_FILE, 'utf8');
const ssot = fs.readFileSync(SSOT_FILE, 'utf8');
const volunteer = fs.readFileSync(VOLUNTEER_FILE, 'utf8');

check(menu.id === 'main-menu' && typeof menu.name === 'string', 'top level id and name present');
check(Array.isArray(menu.menus) && menu.menus.length > 1, 'menus array present', String((menu.menus || []).length));

const ids = [];
const urls = [];
menu.menus.forEach(function (item) {
	['id', 'label', 'url'].forEach(function (key) {
		check(typeof item[key] === 'string' && item[key].length > 0, 'top level ' + item.id + ' has ' + key);
	});
	ids.push(item.id);
	urls.push(item.url);
	(item.children || []).forEach(function (child) {
		['id', 'label', 'url'].forEach(function (key) {
			check(typeof child[key] === 'string' && child[key].length > 0, 'child ' + child.id + ' has ' + key);
		});
		ids.push(child.id);
		urls.push(child.url);
	});
});

check(new Set(ids).size === ids.length, 'all menu ids are unique', (ids.length - new Set(ids).size) + ' duplicates');
ids.forEach(function (id) { check(/^[a-z0-9-]+$/.test(id), 'id is a clean slug: ' + id); });

urls.forEach(function (url) {
	check(url.charAt(0) === '/' && !/\.html(\b|$)/i.test(url), 'url is in route form: ' + url);
});

const routes = new Set(urls.map((url) => url.split('#')[0]));
const reserved = new Set(['/']);
(ssot.match(/<td class="mono">([^<]+)<\/td>/g) || []).forEach(function (cell) {
	const slug = cell.replace(/<td class="mono">/, '').replace(/<\/td>/, '').trim();
	if (!slug || slug.indexOf(' ') > -1 || slug.indexOf('<') > -1) { return; }
	reserved.add(slug);
});

routes.forEach(function (route) {
	check(reserved.has(route), 'route is reserved in the SSOT: ' + route);
	check(header.indexOf('href="' + route + '"') > -1 || header.indexOf('href="' + route + '#') > -1, 'route is in the header too: ' + route);
});

const headerRoutes = (header.match(/href="(\/[^"]*)"/g) || [])
	.map((value) => value.slice(6, -1).split('#')[0])
	.filter((route) => route.charAt(0) === '/' && route.indexOf('//') !== 0);
new Set(headerRoutes).forEach(function (route) {
	check(routes.has(route), 'header route is in the menu JSON: ' + route);
});

check(urls.indexOf('/volunteer#fba-volunteer-positions') > -1, 'menu links the position list anchor');
check(urls.indexOf('/volunteer#fba-volunteer-form') > -1, 'menu links the application form anchor');
['fba-volunteer-positions', 'fba-volunteer-form'].forEach(function (id) {
	check(volunteer.indexOf('id="' + id + '"') > -1, 'anchor exists on the volunteer page: ' + id);
});

const footerMissing = (footer.match(/href="(\/volunteer[^"]*)"/g) || [])
	.map((value) => value.slice(6, -1))
	.filter((href) => urls.indexOf(href) < 0);
console.log('footer volunteer links not in the menu: ' + (footerMissing.length ? footerMissing.join(', ') : 'none'));

const childCount = ids.length - menu.menus.length;
console.log('menu items: ' + menu.menus.length + ' top level + ' + childCount + ' children = ' + ids.length + ' links, ' + routes.size + ' unique routes');

console.log('');
console.log(failures === 0 ? 'ALL ' + checks + ' CHECKS PASSED' : failures + ' of ' + checks + ' CHECKS FAILED');
process.exit(failures === 0 ? 0 : 1);
