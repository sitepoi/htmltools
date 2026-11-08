/* Rebuilds the profile-preset payload inside test-harness.html.
   Run after adding or editing a file in CustomerProfile/profiles/. */
'use strict';
const fs = require('fs');
const path = require('path');

const appDirectory = __dirname;
const profilesDirectory = path.join(appDirectory, '..', 'profiles');
const harnessPath = path.join(appDirectory, 'test-harness.html');
const indexPath = path.join(profilesDirectory, 'index.json');
const manifest = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
const presets = {};

(manifest.presets || []).forEach(function (entry) {
	const filePath = path.join(profilesDirectory, entry.file || '');
	if (!entry.file || !fs.existsSync(filePath)) {
		console.warn('Skipping missing preset: ' + (entry.file || '(no file)'));
		return;
	}
	const key = entry.file.replace(/\.json$/i, '');
	const config = JSON.parse(fs.readFileSync(filePath, 'utf8'));
	presets[key] = {
		key: key,
		name: entry.name || key,
		file: entry.file,
		mode: entry.mode || 'fixed',
		bestFor: entry.bestFor || '',
		segments: entry.segments || [],
		notes: entry.notes || '',
		config: config
	};
});

const payload = JSON.stringify(presets, null, '\t').replace(/</g, '\\u003c');
let source = fs.readFileSync(harnessPath, 'utf8');
const startMarker = '/* HARNESS-PROFILE-PRESETS-START */';
const endMarker = '/* HARNESS-PROFILE-PRESETS-END */';
if (source.indexOf(startMarker) < 0 || source.indexOf(endMarker) < 0) {
	throw new Error('Harness preset markers are missing. Re-apply the harness profile selector patch.');
}
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start) + endMarker.length;
source = source.slice(0, start) + startMarker + '\nwindow.HARNESS_PROFILE_PRESETS = ' + payload + ';\n' + endMarker + source.slice(end);
fs.writeFileSync(harnessPath, source, 'utf8');
console.log('Embedded ' + Object.keys(presets).length + ' profile presets in test-harness.html');
