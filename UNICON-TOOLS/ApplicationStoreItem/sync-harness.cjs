// Sync test-harness.html content between the TOOL HTML markers.
// The harness must embed the tool HTML verbatim so the markup is tested in
// the same shape the CMS tokenizer sees (_verify.cjs enforces the equality).
const fs = require('fs');
const path = require('path');
const dir = __dirname;

const toolHtml = fs.readFileSync(path.join(dir, 'ApplicationStoreItem.html'), 'utf8');
let harness = fs.readFileSync(path.join(dir, 'test-harness.html'), 'utf8');

const START = '<!-- TOOL HTML START -->';
const END = '<!-- TOOL HTML END -->';
const startIdx = harness.indexOf(START);
const endIdx = harness.indexOf(END);
if (startIdx < 0 || endIdx < 0 || endIdx <= startIdx) {
  console.error('Markers not found in test-harness.html');
  process.exit(1);
}
const before = harness.slice(0, startIdx + START.length);
const after = harness.slice(endIdx);
fs.writeFileSync(path.join(dir, 'test-harness.html'), before + '\n' + toolHtml + '\n' + after, 'utf8');
console.log('sync-harness: test-harness.html updated from ApplicationStoreItem.html');
