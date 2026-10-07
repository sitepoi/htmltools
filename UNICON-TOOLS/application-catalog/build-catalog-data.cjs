#!/usr/bin/env node
/* ============================================================================
   APPLICATION CATALOG DATA BUILDER
   ----------------------------------------------------------------------------
   The SINGLE SOURCE OF TRUTH for the application ideas catalog is the file:

       application-ideas-catalog.json

   This script only READS that JSON and produces the derived artifacts:

     - application-catalog-data.js                 (var APP_CATALOG = <json>;)
       Loaded by application-ideas-catalog.html via <script src> as the
       file:// fallback (fetch of a local JSON is blocked on file://).
       Over http the page prefers the live JSON via fetch(), so editing the
       JSON is immediately visible - no rebuild and no sync step.

     - application-folder-hierarchy-import.json    (export copy for the CMS
       folder import - meta + scalingRules + folders).

   One-time page migration: if application-ideas-catalog.html still embeds
   the data inline, the block is replaced by the script-src tag so the page
   becomes UI-only.

   Usage:  node build-catalog-data.cjs      (or: npm run catalog:apps)
   ========================================================================== */

const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const JSON_PATH = path.join(DIR, 'application-ideas-catalog.json');
const DATA_JS_PATH = path.join(DIR, 'application-catalog-data.js');
const HIERARCHY_PATH = path.join(DIR, 'application-folder-hierarchy-import.json');
const PAGE_PATH = path.join(DIR, 'application-ideas-catalog.html');

const raw = fs.readFileSync(JSON_PATH, 'utf8');
let data;
try {
  data = JSON.parse(raw);
} catch (err) {
  console.error('application-ideas-catalog.json is not valid JSON: ' + err.message);
  process.exit(1);
}

if (!data || !data.hierarchy || !Array.isArray(data.applications)) {
  console.error('Invalid catalog JSON: it needs a hierarchy object and an applications array.');
  process.exit(1);
}

/* Write the JS data copy the page can load via script tag.
   Escape any "</" so the file can never close its own script tag. */
const jsSafe = JSON.stringify(data).replace(/<\//g, '<\\/');
const dataJs =
  '// GENERATED FILE - do not edit by hand.\n' +
  '// Single source of truth: application-ideas-catalog.json\n' +
  '// Regenerate with: node build-catalog-data.cjs (or npm run catalog:apps)\n' +
  'var APP_CATALOG = ' + jsSafe + ';\n';

fs.writeFileSync(DATA_JS_PATH, dataJs, 'utf8');
fs.writeFileSync(HIERARCHY_PATH, JSON.stringify(data.hierarchy, null, 2) + '\n', 'utf8');

/* One-time page migration: swap the inline data block for the script tag. */
let page = fs.readFileSync(PAGE_PATH, 'utf8');
const before = page;
page = page.replace(/<script>var APP_CATALOG = \{[\s\S]*?<\/script>/, '<script src="application-catalog-data.js"></script>');
if (page !== before) {
  fs.writeFileSync(PAGE_PATH, page, 'utf8');
  console.log('Migrated page: inline data block replaced with <script src="application-catalog-data.js"></script>.');
} else {
  console.log('Page already migrated (no inline data block found).');
}

console.log('Wrote application-catalog-data.js            (' + data.applications.length + ' applications)');
console.log('Wrote application-folder-hierarchy-import.json');
