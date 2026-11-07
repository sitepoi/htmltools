/* Regenerates the embedded HTML fallback in test-harness.html. */
'use strict';

const fs = require('fs');
const path = require('path');

const harnessPath = path.join(__dirname, 'test-harness.html');
const htmlPath = path.join(__dirname, 'CustomerProfile.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const literal = JSON.stringify(html).replace(/</g, '\\u003c');
const lines = fs.readFileSync(harnessPath, 'utf8').split(/\r?\n/);
const index = lines.findIndex(function (line) {
	return line.indexOf('window.EMBEDDED_CUSTOMER_PROFILE_HTML = ') === 0;
});

if (index === -1) throw new Error('Embedded HTML assignment not found in test-harness.html.');
lines[index] = 'window.EMBEDDED_CUSTOMER_PROFILE_HTML = ' + literal + ';';
fs.writeFileSync(harnessPath, lines.join('\n'), 'utf8');
console.log('Embedded HTML updated: ' + literal.length + ' characters.');
