#!/usr/bin/env node
/**
 * check-html-tool-rules.js
 * Scans every built html-tool (HTML + CSS + JS set) in the workspace and checks
 * it against the MANDATORY rules in html-tool-rules.txt (v3.0, 2026-11-18).
 * Generates a self-contained HTML compliance report.
 *
 * Usage: node scripts/check-html-tool-rules.js
 * Output: RULES-COMPLIANCE-REPORT.html (workspace root)
 */
'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..');
var REPORT_PATH = path.join(ROOT, 'RULES-COMPLIANCE-REPORT.html');

var SKIP_DIRS = ['node_modules', '.git', 'ship-out', '_docs', 'scripts', 'archive', 'DESKTOP-APPS', 'OTHERS-HELPERS', '.checkpoints', '.backup', 'runs', 'selftest-output'];
var SUPPORT_FILE_PREFIXES = ['test-harness', 'qa-', 'build-harness', 'DEVELOPMENT-PLAN', 'MARKET-ANALYSIS', 'rules-comparison-report', 'sample-export', '_BACKUP', '--', '_probe', 'gloria-migration-report'];

/* ── Rule catalogue (id, title, severity, requirement) ── */
var RULES = {
  BUILD_ID:        { title: 'TOOL_BUILD identifier', severity: 'critical', text: 'The [JS] block must declare var TOOL_BUILD = \'YYYY-MM-DD-N\'.' },
  BUILD_LOG:       { title: 'Boot log line', severity: 'critical', text: 'console.log(\'[TOOL:BOOT] build \' + TOOL_BUILD + \' ...\') must be the FIRST console line.' },
  BUILD_LOG_ORDER: { title: 'Boot log is first console line', severity: 'minor', text: 'The boot log must be the first console.* call so the console proves which build runs.' },
  BUILD_BADGE:     { title: 'Visible build badge', severity: 'major', text: 'TOOL_BUILD must be rendered in the visible UI (e.g. #tool-build-badge) as "tool build ...".' },
  STAMP_HTML:      { title: 'HTML per-file stamp', severity: 'critical', text: 'First line must be <!-- html build YYYY-MM-DD-N -->.' },
  STAMP_CSS:       { title: 'CSS per-file stamp', severity: 'critical', text: 'First line must be /* css build YYYY-MM-DD-N */.' },
  STAMP_JS:        { title: 'JS per-file stamp', severity: 'critical', text: 'First line must be /* js build YYYY-MM-DD-N */.' },
  STAMP_NEWER:     { title: 'Stamp newer than TOOL_BUILD', severity: 'major', text: 'A file stamp must never be newer than the tool build number.' },
  TOKEN_CLOSE_SCRIPT: { title: 'Raw </script in JS', severity: 'critical', text: 'A raw </script sequence terminates the inline script element. Write <\\/script.' },
  TOKEN_OPEN_COMMENT: { title: 'Unclosed raw <!-- in JS', severity: 'critical', text: 'A raw <!-- must be closed by --> on the SAME line, otherwise the inline tokenizer breaks.' },
  TOKEN_SCRIPT_LITERAL: { title: 'Raw <script literal in JS', severity: 'minor', text: 'Avoid raw <script literals in the [JS] block - write \'<scr\' + \'ipt>\' or \\u003Cscript.' },
  HTML_FORBIDDEN_TAG: { title: 'Forbidden tag in [HTML]', severity: 'critical', text: '[HTML] is body markup only - no <html>, <head>, <body>, <style>, <script> or <!DOCTYPE>.' },
  CSS_FORBIDDEN_TAG: { title: 'Forbidden tag in [CSS]', severity: 'critical', text: '[CSS] is stylesheet rules only - no <style> tags.' },
  ENTRY_READY:     { title: 'tool.onReady entry point', severity: 'critical', text: 'The tool must boot through tool.onReady(cb) as its single entry point.' },
  DOM_LOAD:        { title: 'DOMContentLoaded / window.onload', severity: 'major', text: 'Never use DOMContentLoaded, window.onload or inline onload - use tool.onReady.' },
  STORAGE:         { title: 'localStorage / sessionStorage', severity: 'major', text: 'The sandbox has no storage - cache in memory only.' },
  ALERT_CONFIRM_PROMPT: { title: 'alert / confirm / prompt', severity: 'major', text: 'Never use alert(), confirm() or prompt() - build in-tool UI.' },
  POSTMESSAGE:     { title: 'Raw postMessage', severity: 'major', text: 'Never call postMessage directly - always use the tool.* SDK.' },
  DIRECT_FETCH:    { title: 'Direct network call', severity: 'critical', text: 'No fetch/XHR/sendBeacon from the iframe - use tool.requestFetch/requestObjects (parent relay).' },
  EXTERNAL_HTML:   { title: 'External resource in [HTML]', severity: 'major', text: 'No external <script src>, <link>, remote images/iframes or fonts - everything inline or via the CMS relay.' },
  EXTERNAL_CSS:    { title: 'External resource in [CSS]', severity: 'major', text: 'No @import or url(https://...) - resources must be inline or relayed.' },
  DECLARE_PARAMS:  { title: 'Undeclared tool.param', severity: 'major', text: 'Every param read with tool.param() must be declared with tool.declareParams().' },
  REPORT_MISSING_PARAMS: { title: 'reportMissingParams missing', severity: 'minor', text: 'With declared params, call tool.reportMissingParams() in onReady for missing mandatory values.' },
  READONLY_GUARD:  { title: 'No read-only handling', severity: 'minor', text: 'Check tool.isReadOnly() inside onReady and on onReadonlyChange.' },
  API_PROBE:       { title: 'New API used without feature probe', severity: 'minor', text: 'Probe typeof tool.requestUploadBinary / requestGenerateImage === \'function\' and handle the error case.' },
  HARNESS_INLINE:  { title: 'Harness has no inline mode', severity: 'minor', text: 'Every test harness must offer ?inlinejs=1 so the exact CMS tokenization is exercised.' },
  GW_TYPE_ID:      { title: 'gw- prefix in a type id', severity: 'major', text: 'gw is the page-runtime namespace - never use it in a cmsObjectType / mainObjectType id.' },
  MISSING_CSS:     { title: 'Missing CSS file', severity: 'minor', text: 'A built tool is a three-file set (HTML + CSS + JS).' }
};

/* ── Helpers ── */
function read(file) { return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''); }
function rel(file) { return path.relative(ROOT, file).replace(/\\/g, '/'); }
function escHtml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function lineOfIndex(text, index) {
  var line = 1;
  for (var i = 0; i < index && i < text.length; i++) if (text[i] === '\n') line++;
  return line;
}
function lineText(text, lineNumber) {
  var lines = text.split(/\r?\n/);
  var value = lines[lineNumber - 1] || '';
  value = value.trim();
  return value.length > 220 ? value.substring(0, 220) + '…' : value;
}

/** Replace JS comments with spaces (newlines kept) so documentation text is
 *  not mistaken for code. Real tokenizer checks use the RAW source. */
function maskJsComments(source) {
  var masked = source.replace(/\/\*[\s\S]*?\*\//g, function (m) { return m.replace(/[^\n]/g, ' '); });
  masked = masked.replace(/\/\/[^\n]*/g, function (m) { return m.replace(/[^\n]/g, ' '); });
  return masked;
}

/** Find every regex match in text and return findings. */
function scan(text, regex, ruleId, file, suggestion) {
  var found = [];
  var match;
  regex.lastIndex = 0;
  while ((match = regex.exec(text)) !== null) {
    var line = lineOfIndex(text, match.index);
    found.push({
      rule: ruleId,
      file: file,
      line: line,
      snippet: lineText(text, line),
      suggestion: suggestion || ''
    });
    if (found.length >= 25) break; // cap noise per rule/file
    if (match.index === regex.lastIndex) regex.lastIndex++;
  }
  return found;
}

/** Walk the tree and collect tool sets: app/<Base>.html + <Base>.js (+ <Base>.css). */
function findToolSets() {
  var toolSets = [];
  function walk(dir) {
    var entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    entries.forEach(function (entry) {
      if (!entry.isDirectory()) return;
      var full = path.join(dir, entry.name);
      if (SKIP_DIRS.indexOf(entry.name) !== -1) return;
      if (entry.name === 'app') {
        var files;
        try { files = fs.readdirSync(full); } catch (e) { return; }
        files.forEach(function (fileName) {
          if (!/\.js$/i.test(fileName)) return;
          var base = fileName.replace(/\.js$/i, '');
          var lowerBase = base.toLowerCase();
          var isSupport = SUPPORT_FILE_PREFIXES.some(function (prefix) { return lowerBase.indexOf(prefix.toLowerCase()) === 0; });
          if (isSupport) return;
          var htmlPath = path.join(full, base + '.html');
          if (!fs.existsSync(htmlPath)) return;
          var cssPath = path.join(full, base + '.css');
          var harnessPath = path.join(full, 'test-harness.html');
          toolSets.push({
            name: base,
            folder: path.basename(path.dirname(full)),
            dir: full,
            htmlPath: htmlPath,
            cssPath: fs.existsSync(cssPath) ? cssPath : '',
            jsPath: path.join(full, fileName),
            harnessPath: fs.existsSync(harnessPath) ? harnessPath : '',
            archived: /OLD|delete|backup/i.test(path.basename(path.dirname(full))) || /OLD|backup/i.test(base)
          });
        });
        return;
      }
      walk(full);
    });
  }
  walk(ROOT);
  return toolSets;
}

function checkTool(tool) {
  var findings = [];
  var info = { toolBuild: '', stamps: {} };
  var html = read(tool.htmlPath);
  var css = tool.cssPath ? read(tool.cssPath) : '';
  var js = read(tool.jsPath);
  var harness = tool.harnessPath ? read(tool.harnessPath) : '';
  var jsCode = maskJsComments(js);

  var buildMatch = jsCode.match(/TOOL_BUILD\s*=\s*['"]([^'"]+)['"]/);
  info.toolBuild = buildMatch ? buildMatch[1] : '';

  /* R1 build identifier */
  if (!buildMatch) {
    findings.push({ rule: 'BUILD_ID', file: rel(tool.jsPath), line: 1, snippet: 'var TOOL_BUILD = ... not found', suggestion: 'Add the tool build line in the [JS] block.' });
  } else if (!/^\d{4}-\d{2}-\d{2}-\d+$/.test(buildMatch[1])) {
    findings.push({ rule: 'BUILD_ID', file: rel(tool.jsPath), line: lineOfIndex(js, buildMatch.index), snippet: lineText(js, lineOfIndex(js, buildMatch.index)), suggestion: 'Format must be YYYY-MM-DD-N.' });
  }

  /* R2 boot log + R2b first console line */
  var bootRegex = /console\.log\(\s*['"]\[TOOL:BOOT\]\s*build\s*['"]/;
  var bootMatch = jsCode.match(bootRegex);
  if (!bootMatch) {
    findings.push({ rule: 'BUILD_LOG', file: rel(tool.jsPath), line: 1, snippet: 'console.log(\'[TOOL:BOOT] build \' + TOOL_BUILD + \' ...\') not found', suggestion: 'Log the boot line first.' });
  } else {
    var firstConsoleIndex = jsCode.search(/console\.\w+\s*\(/);
    if (firstConsoleIndex !== -1 && firstConsoleIndex < bootMatch.index) {
      findings.push({ rule: 'BUILD_LOG_ORDER', file: rel(tool.jsPath), line: lineOfIndex(jsCode, firstConsoleIndex), snippet: lineText(jsCode, lineOfIndex(jsCode, firstConsoleIndex)), suggestion: 'Move the boot log above every other console call.' });
    }
  }

  /* R3 visible badge - any UI assignment that renders TOOL_BUILD counts */
  var buildUsageCount = (jsCode.match(/TOOL_BUILD/g) || []).length;
  var badgeUiPattern = /(textContent|innerHTML)\s*=\s*[^;\n]*TOOL_BUILD|TOOL_BUILD\s*\+[^;\n]*(textContent|innerHTML)/;
  var badgeFound = /tool-build-badge|toolBuildBadge|build-badge|tool build\s/i.test(html + '\n' + jsCode) || badgeUiPattern.test(jsCode);
  if (buildMatch && (!badgeFound || buildUsageCountL)\s*=\s*[^;\n]*TOOL_BUILD|TOOL_BUILD\s*\+[^;\n]*(textContent|innerHTML)/;
  var badgeFound = /tool-build-badge|toolBuildBadge|build-badge|tool build\s/i.test(html + '\n' + jsCode) || badgeUiPattern.test(jsCode);
  if (buildMatch && (!badgeFound || buildUsageCountdBadge|build-badge|tool build\s/i.test(html + '\n' + jsCode) || badgeUiPattern.test(jsCode);
  if (buildMatch && (!badgeFound || buildUsageCount < 2)) {
    findings.push({ rule: 'BUILD_BADGE', file: rel(tool.htmlPath), line: 1, snippet: 'No visible build badge shows TOOL_BUILD', suggestion: 'Render "tool build <TOOL_BUILD>" in the tool header.' });
  }

  /* R4 per-file stamps */
  function stampCheck(text, regex, ruleId, file) {
    var firstLine = text.split(/\r?\n/)[0] || '';
    var m = firstLine.match(regex);
    if (!m) {
      findings.push({ rule: ruleId, file: rel(file), line: 1, snippet: firstLine, suggestion: 'Add the per-file first-line stamp.' });
      return '';
    }
    return m[1];
  }
  info.stamps.html = stampCheck(html, /^<!--\s*html build\s+(\d{4}-\d{2}-\d{2}-\d+)\s*-->/, 'STAMP_HTML', tool.htmlPath);
  if (tool.cssPath) info.stamps.css = stampCheck(css, /^\/\*\s*css build\s+(\d{4}-\d{2}-\d{2}-\d+)\s*\*\//, 'STAMP_CSS', tool.cssPath);
  else findings.push({ rule: 'MISSING_CSS', file: rel(tool.dir), line: 1, snippet: 'No ' + tool.name + '.css next to the JS/HTML', suggestion: 'Provide the complete three-file set.' });
  info.stamps.js = stampCheck(js, /^\/\*\s*js build\s+(\d{4}-\d{2}-\d{2}-\d+)\s*\*\//, 'STAMP_JS', tool.jsPath);

  if (info.toolBuild) {
    ['html', 'css', 'js'].forEach(function (kind) {
      var stamp = info.stamps[kind];
      if (stamp && stamp > info.toolBuild) {
        findings.push({ rule: 'STAMP_NEWER', file: rel(kind === 'html' ? tool.htmlPath : kind === 'css' ? tool.cssPath : tool.jsPath), line: 1, snippet: kind + ' stamp ' + stamp + ' > TOOL_BUILD ' + info.toolBuild, suggestion: 'Bump TOOL_BUILD or correct the stamp.' });
      }
    });
  }

  /* R5 raw </script in JS */
  findings = findings.concat(scan(js, /<\/script/gi, 'TOKEN_CLOSE_SCRIPT', rel(tool.jsPath), 'Write <\\/script instead.'));
  /* R6 unclosed raw <!-- on the same line */
  js.split(/\r?\n/).forEach(function (line, index) {
    var openIndex = line.indexOf('<!--');
    if (openIndex === -1) return;
    var closeIndex = line.indexOf('-->', openIndex + 4);
    if (closeIndex === -1) {
      findings.push({ rule: 'TOKEN_OPEN_COMMENT', file: rel(tool.jsPath), line: index + 1, snippet: line.trim().substring(0, 220), suggestion: 'Write \\u003C!-- or close it on the same line.' });
    }
  });
  /* R7 raw <script literal in JS */
  findings = findings.concat(scan(js, /<script/gi, 'TOKEN_SCRIPT_LITERAL', rel(tool.jsPath), 'Write \'<scr\' + \'ipt>\' or \\u003Cscript.'));

  /* R8 forbidden tags in HTML */
  scan(html, /<(html|head|body|style|script)\b/gi, 'HTML_FORBIDDEN_TAG', rel(tool.htmlPath), 'Keep the [HTML] block to body markup only.').forEach(function (f) { findings.push(f); });
  scan(html, /<!doctype/gi, 'HTML_FORBIDDEN_TAG', rel(tool.htmlPath), 'No <!DOCTYPE> in the [HTML] block.').forEach(function (f) { findings.push(f); });

  /* R9 forbidden tags in CSS */
  if (css) {
    scan(css, /<\/?style\b/gi, 'CSS_FORBIDDEN_TAG', rel(tool.cssPath), 'Stylesheet rules only - no <style> tag.').forEach(function (f) { findings.push(f); });
  }

  /* R10 entry point */
  if (!/tool\.onReady\s*\(/.test(jsCode)) {
    findings.push({ rule: 'ENTRY_READY', file: rel(tool.jsPath), line: 1, snippet: 'tool.onReady(...) not found', suggestion: 'Boot through tool.onReady as the single entry point.' });
  }

  /* R11 DOM load - only the forbidden BOOT patterns; element.onload = ... is
     normal JS and must not be flagged */
  scan(jsCode, /DOMContentLoaded|window\.onload/g, 'DOM_LOAD', rel(tool.jsPath), 'Use tool.onReady instead.').forEach(function (f) { findings.push(f); });
  scan(html, /\sonload\s*=/gi, 'DOM_LOAD', rel(tool.htmlPath), 'No inline onload attributes - use tool.onReady.').forEach(function (f) { findings.push(f); });

  /* R12 storage - actual usage only (a regex like /localStorage|sessionStorage/i
     that VALIDATES generated code is not a violation) */
  scan(jsCode, /(local|session)Storage\s*\./g, 'STORAGE', rel(tool.jsPath), 'Cache in memory only.').forEach(function (f) { findings.push(f); });

  /* R13 alert/confirm/prompt - real calls only. A custom method like
     c.prompt(ctx) or documentation text must not be flagged. */
  scan(jsCode, /(^|[^\w$.])(alert|confirm|prompt)\(\s*(['"]|[A-Za-z_$][\w$]*\s*[,)])/gm, 'ALERT_CONFIRM_PROMPT', rel(tool.jsPath), 'Build in-tool dialogs instead.').forEach(function (f) { findings.push(f); });
  scan(jsCode, /\b(window|globalThis)\.(alert|confirm|prompt)\s*\(/g, 'ALERT_CONFIRM_PROMPT', rel(tool.jsPath), 'Build in-tool dialogs instead.').forEach(function (f) { findings.push(f); });

  /* R14 raw postMessage */
  scan(jsCode, /\bpostMessage\s*\(/g, 'POSTMESSAGE', rel(tool.jsPath), 'Use the tool.* SDK only.').forEach(function (f) { findings.push(f); });

  /* R15 direct network calls */
  scan(jsCode, /(^|[^\w$.])fetch\s*\(|XMLHttpRequest|sendBeacon/g, 'DIRECT_FETCH', rel(tool.jsPath), 'Use tool.requestFetch / tool.requestObjects (parent relay).').forEach(function (f) { findings.push(f); });

  /* R16 external resources */
  scan(html, /<script[^>]*\bsrc\s*=/gi, 'EXTERNAL_HTML', rel(tool.htmlPath), 'No external scripts - inline everything.').forEach(function (f) { findings.push(f); });
  scan(html, /<link\b[^>]*\bhref\s*=/gi, 'EXTERNAL_HTML', rel(tool.htmlPath), 'No external stylesheets/fonts - inline or relay.').forEach(function (f) { findings.push(f); });
  scan(html, /<(img|iframe|source|video|audio)\b[^>]*\bsrc\s*=\s*["']https?:/gi, 'EXTERNAL_HTML', rel(tool.htmlPath), 'Remote media must come through the CMS relay.').forEach(function (f) { findings.push(f); });
  if (css) {
    scan(css, /@import\b/gi, 'EXTERNAL_CSS', rel(tool.cssPath), 'No @import - inline the rules.').forEach(function (f) { findings.push(f); });
    scan(css, /url\(\s*["']?https?:/gi, 'EXTERNAL_CSS', rel(tool.cssPath), 'No remote CSS assets.').forEach(function (f) { findings.push(f); });
  }
  scan(html + '\n' + css, /fonts\.googleapis|fonts\.gstatic/gi, 'EXTERNAL_HTML', rel(tool.htmlPath), 'No external font hosts.').forEach(function (f) { findings.push(f); });

  /* R17/R18 params */
  var paramNames = [];
  var paramRegex = /tool\.param\s*\(\s*['"]([^'"]+)['"]/g;
  var paramMatch;
  while ((paramMatch = paramRegex.exec(jsCode)) !== null) {
    if (paramNames.indexOf(paramMatch[1]) === -1) paramNames.push(paramMatch[1]);
  }
  var declaredNames = [];
  var declareIndex = jsCode.indexOf('tool.declareParams');
  if (declareIndex !== -1) {
    var declareChunk = jsCode.substring(declareIndex, declareIndex + 12000);
    var nameRegex = /name\s*:\s*['"]([^'"]+)['"]/g;
    var nameMatch;
    while ((nameMatch = nameRegex.exec(declareChunk)) !== null) {
      if (declaredNames.indexOf(nameMatch[1]) === -1) declaredNames.push(nameMatch[1]);
    }
  }
  /* Context params are provided by the platform (e.g. objectId / recordId),
     not configured by the admin - not subject to declareParams. */
  var CONTEXT_PARAMS = ['objectId', 'recordId', 'contentId', 'parentId', 'tenantId', 'slug', 'fieldId', 'language', 'locale'];
  var undeclared = paramNames.filter(function (name) {
    return declaredNames.indexOf(name) === -1 && CONTEXT_PARAMS.indexOf(name) === -1;
  });
  if (paramNames.length && declareIndex === -1) {
    findings.push({ rule: 'DECLARE_PARAMS', file: rel(tool.jsPath), line: 1, snippet: 'tool.param used: ' + paramNames.join(', ') + ' - no tool.declareParams found', suggestion: 'Declare every param.' });
  } else if (undeclared.length) {
    findings.push({ rule: 'DECLARE_PARAMS', file: rel(tool.jsPath), line: 1, snippet: 'Undeclared: ' + undeclared.join(', '), suggestion: 'Add these names to tool.declareParams().' });
  }
  if (declareIndex !== -1 && !/tool\.reportMissingParams\s*\(/.test(jsCode)) {
    findings.push({ rule: 'REPORT_MISSING_PARAMS', file: rel(tool.jsPath), line: 1, snippet: 'declareParams present but no reportMissingParams call', suggestion: 'Report missing mandatory params inside onReady.' });
  }

  /* R19 read-only handling */
  if (!/isReadOnly\s*\(/.test(jsCode)) {
    findings.push({ rule: 'READONLY_GUARD', file: rel(tool.jsPath), line: 1, snippet: 'tool.isReadOnly() never used', suggestion: 'Check read-only mode in onReady and lock the UI.' });
  }

  /* R20 new API probes */
  ['requestUploadBinary', 'requestGenerateImage'].forEach(function (apiName) {
    var usedRegex = new RegExp('tool\\.' + apiName + '\\s*\\(');
    if (!usedRegex.test(jsCode)) return;b
    var probeRegex = new RegExp('typeof\\s+tool\\.' + apiName + '\\b');
    if (!probeRegex.test(jsCode)) {
      findings.push({ rule: 'API_PROBE', file: rel(tool.jsPath), line: lineOfIndex(jsCode, jsCode.search(usedRegex)), snippet: 'tool.' + apiName + ' used without a typeof probe', suggestion: 'Probe the method and degrade gracefully on older hosts.' });
    }
  });

  /* R21 harness inline mode */
  if (tool.harnessPath && !/inlinejs/i.test(harness)) {
    findings.push({ rule: 'HARNESS_INLINE', file: rel(tool.harnessPath), line: 1, snippet: 'Harness has no inlinejs mode', suggestion: 'Add ?inlinejs=1 to test the exact CMS tokenization.' });
  }

  /* R22 gw type ids - only real TYPE assignments; gw-* CSS classes and
     documentation text are not type ids */
  scan(jsCode, /(mainObjectType|cmsObjectType|objectType)\s*:\s*['"]gw-/g, 'GW_TYPE_ID', rel(tool.jsPath), 'gw- is reserved for the page runtime namespace.').forEach(function (f) { findings.push(f); });

  /* Dedupe identical findings */
  var seen = {};
  findings = findings.filter(function (f) {
    var key = f.rule + '|' + f.file + '|' + f.line + '|' + f.snippet;
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });

  tool.findings = findings;
  tool.info = info;
  return tool;
}

/* ── Run ── */
var tools = findToolSets().map(checkTool);
tools.sort(function (a, b) {
  if (a.archived !== b.archived) return a.archived ? 1 : -1;
  var ca = a.findings.filter(function (f) { return RULES[f.rule].severity === 'critical'; }).length;
  var cb = b.findings.filter(function (f) { return RULES[f.rule].severity === 'critical'; }).length;
  if (ca !== cb) return cb - ca;
  return a.name.localeCompare(b.name);
});

var stats = { critical: 0, major: 0, minor: 0 };
var ruleCounts = {};
tools.forEach(function (tool) {
  tool.findings.forEach(function (f) {
    var severity = RULES[f.rule] ? RULES[f.rule].severity : 'minor';
    stats[severity]++;
    ruleCounts[f.rule] = (ruleCounts[f.rule] || 0) + 1;
  });
});
var activeTools = tools.filter(function (t) { return !t.archived; });
var archivedTools = tools.filter(function (t) { return t.archived; });
var failingTools = tools.filter(function (t) { return t.findings.length > 0; });
var blockingTools = tools.filter(function (t) {
  return t.findings.some(function (f) { return RULES[f.rule].severity !== 'minor'; });
});
var advisoryOnlyTools = tools.filter(function (t) {
  return t.findings.length > 0 && !t.findings.some(function (f) { return RULES[f.rule].severity !== 'minor'; });
});
var cleanTools = tools.filter(function (t) { return t.findings.length === 0; });

function severityChip(severity) {
  return '<span class="sev sev-' + severity + '">' + severity.toUpperCase() + '</span>';
}
function findingRows(findings) {
  if (!findings.length) return '<tr><td colspan="5" class="clean-row">No findings - compliant.</td></tr>';
  var order = { critical: 0, major: 1, minor: 2 };
  return findings.slice().sort(function (a, b) {
    return order[RULES[a.rule].severity] - order[RULES[b.rule].severity];
  }).map(function (f) {
    var rule = RULES[f.rule] || { title: f.rule, severity: 'minor', text: '' };
    return '<tr>' +
      '<td>' + severityChip(rule.severity) + '</td>' +
      '<td class="rule-cell"><strong>' + escHtml(rule.title) + '</strong><div class="rule-text">' + escHtml(rule.text) + '</div></td>' +
      '<td class="file-cell">' + escHtml(f.file) + '<div class="line-note">line ' + f.line + '</div></td>' +
      '<td class="snippet-cell"><code>' + escHtml(f.snippet) + '</code>' + (f.suggestion ? '<div class="suggestion">' + escHtml(f.suggestion) + '</div>' : '') + '</td>' +
      '</tr>';
  }).join('');
}

var html = [];
html.push('<!DOCTYPE html>');
html.push('<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">');
html.push('<title>HTML Tool Rules Compliance Report - 2026-11-18</title>');
html.push('<style>');
html.push(':root{--bg:#f8fafc;--surface:#fff;--border:#e2e8f0;--text:#1e293b;--muted:#64748b;--crit:#dc2626;--crit-bg:#fef2f2;--major:#d97706;--major-bg:#fffbeb;--minor:#0284c7;--minor-bg:#f0f9ff;--ok:#059669;--ok-bg:#ecfdf5;--primary:#4f46e5}');
html.push('*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--text);line-height:1.55;font-size:14px}');
html.push('.wrap{max-width:1280px;margin:0 auto;padding:32px 24px 64px}');
html.push('header.report-head{background:linear-gradient(135deg,#312e81,#4f46e5);color:#fff;border-radius:16px;padding:30px 32px;box-shadow:0 10px 30px rgba(49,46,129,.25)}');
html.push('header.report-head h1{margin:0 0 6px;font-size:26px;letter-spacing:-.01em}');
html.push('header.report-head p{margin:2px 0;color:#e0e7ff;font-size:13px}');
html.push('.meta-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}');
html.push('.meta-chip{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:4px 12px;font-size:12px}');
html.push('.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px;margin:24px 0}');
html.push('.card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 18px;box-shadow:0 1px 3px rgba(15,23,42,.06)}');
html.push('.card .num{font-size:28px;font-weight:800;line-height:1.2}.card .lbl{font-size:12px;color:var(--muted);margin-top:2px}');
html.push('.card.crit .num{color:var(--crit)}.card.major .num{color:var(--major)}.card.minor .num{color:var(--minor)}.card.ok .num{color:var(--ok)}');
html.push('section{background:var(--surface);border:1px solid var(--border);border-radius:14px;margin:18px 0;box-shadow:0 1px 3px rgba(15,23,42,.05);overflow:hidden}');
html.push('section > h2{margin:0;padding:16px 22px;font-size:16px;border-bottom:1px solid var(--border);background:#fbfcfe}');
html.push('.section-body{padding:18px 22px}');
html.push('table{width:100%;border-collapse:collapse;font-size:13px}');
html.push('th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);padding:8px 10px;border-bottom:1px solid var(--border);background:#fbfcfe}');
html.push('td{padding:10px;border-bottom:1px solid #eef2f7;vertical-align:top}');
html.push('tr:last-child td{border-bottom:none}');
html.push('.sev{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.05em;border-radius:999px;padding:2px 8px;white-space:nowrap}');
html.push('.sev-critical{background:var(--crit-bg);color:var(--crit);border:1px solid #fecaca}');
html.push('.sev-major{background:var(--major-bg);color:var(--major);border:1px solid #fde68a}');
html.push('.sev-minor{background:var(--minor-bg);color:var(--minor);border:1px solid #bae6fd}');
html.push('.rule-cell strong{display:block;font-size:13px}.rule-text{font-size:11.5px;color:var(--muted);margin-top:2px;max-width:340px}');
html.push('.file-cell{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;color:#334155;word-break:break-all;max-width:280px}');
html.push('.line-note{color:var(--muted);font-size:11px}.snippet-cell code{display:block;background:#f8fafc;border:1px solid #e8eef6;border-radius:6px;padding:6px 8px;font-size:11.5px;word-break:break-all;color:#0f172a}');
html.push('.suggestion{font-size:11.5px;color:var(--muted);margin-top:4px}');
html.push('.clean-row{text-align:center;color:var(--ok);font-weight:600;background:var(--ok-bg)}');
html.push('details.tool{border:1px solid var(--border);border-radius:10px;margin:10px 0;overflow:hidden;background:#fff}');
html.push('details.tool summary{cursor:pointer;padding:12px 16px;display:flex;flex-wrap:wrap;align-items:center;gap:8px;background:#fbfcfe;list-style:none}');
html.push('details.tool summary::-webkit-details-marker{display:none}');
html.push('details.tool summary .tool-name{font-weight:700;font-size:13.5px}');
html.push('details.tool summary .tool-path{font-size:11px;color:var(--muted);word-break:break-all}');
html.push('details.tool summary .count{margin-left:auto;display:inline-flex;gap:6px;flex-wrap:wrap}');
html.push('.count-chip{font-size:10.5px;font-weight:700;border-radius:999px;padding:2px 8px;border:1px solid var(--border);background:#fff;color:var(--muted)}');
html.push('.count-chip.crit{background:var(--crit-bg);color:var(--crit);border-color:#fecaca}.count-chip.major{background:var(--major-bg);color:var(--major);border-color:#fde68a}.count-chip.minor{background:var(--minor-bg);color:var(--minor);border-color:#bae6fd}.count-chip.ok{background:var(--ok-bg);color:var(--ok);border-color:#a7f3d0}');
html.push('.tool-body{padding:0 12px 12px}');
html.push('.tool-meta{display:flex;flex-wrap:wrap;gap:10px;font-size:11.5px;color:var(--muted);padding:10px 4px}');
html.push('.tool-meta code{background:#f1f5f9;border-radius:4px;padding:1px 6px}');
html.push('.legend td:first-child{white-space:nowrap}');
html.push('.note{font-size:12.5px;color:var(--muted)}.note ul{margin:8px 0 0 18px;padding:0}.note li{margin:3px 0}');
html.push('.clean-list{display:flex;flex-wrap:wrap;gap:8px}.clean-list span{font-size:12px;background:var(--ok-bg);color:#047857;border:1px solid #a7f3d0;border-radius:999px;padding:3px 10px}');
html.push('footer{margin-top:28px;text-align:center;font-size:11.5px;color:var(--muted)}');
html.push('@media print{body{background:#fff}.wrap{padding:0}section,details.tool,header.report-head{box-shadow:none}details.tool{break-inside:avoid}}');
html.push('</style></head><body><div class="wrap">');

html.push('<header class="report-head">');
html.push('<h1>HTML Tool Rules Compliance Report</h1>');
html.push('<p>Active ruleset: <strong>html-tool-rules.txt v3.0 (2026-11-18)</strong></p>');
html.push('<p>Generated: 2026-11-18 - Scope: every built HTML + CSS + JS tool set under the workspace</p>');
html.push('<div class="meta-chips">');
html.push('<span class="meta-chip">' + tools.length + ' tool sets scanned</span>');
html.push('<span class="meta-chip">' + activeTools.length + ' active / ' + archivedTools.length + ' archived</span>');
html.push('<span class="meta-chip">' + blockingTools.length + ' blocked (critical/major)</span>');
html.push('<span class="meta-chip">' + advisoryOnlyTools.length + ' advisory only</span>');
html.push('<span class="meta-chip">' + cleanTools.length + ' clean</span>');
html.push('</div></header>');

html.push('<div class="cards">');
html.push('<div class="card crit"><div class="num">' + stats.critical + '</div><div class="lbl">Critical findings</div></div>');
html.push('<div class="card major"><div class="num">' + stats.major + '</div><div class="lbl">Major findings</div></div>');
html.push('<div class="card minor"><div class="num">' + stats.minor + '</div><div class="lbl">Minor findings</div></div>');
html.push('<div class="card crit"><div class="num">' + blockingTools.length + '</div><div class="lbl">Tools blocked</div></div>');
html.push('<div class="card ok"><div class="num">' + cleanTools.length + '</div><div class="lbl">Fully compliant tools</div></div>');
html.push('</div>');

html.push('<section><h2>Scope &amp; method</h2><div class="section-body note">');
html.push('<p>Each tool folder under <code>**/app/</code> was treated as one tool set: the pair <code>&lt;Base&gt;.html</code> + <code>&lt;Base&gt;.js</code> with the matching <code>&lt;Base&gt;.css</code>. Test harnesses, QA scripts, development plans, migration reports and archived build outputs were excluded from the per-tool scan.</p>');
html.push('<ul>');
html.push('<li>Excluded: <code>ship-out/</code> (exported builds), <code>_docs/</code>, <code>scripts/</code>, <code>node_modules/</code>, support files (<code>qa-*</code>, <code>build-harness-*</code>, <code>DEVELOPMENT-PLAN</code>, <code>MARKET-ANALYSIS</code>, <code>sample-export</code>, backups).</li>');
html.push('<li>Archived tools (folder or file name contains OLD / delete / backup) are listed separately and do not count toward the active totals.</li>');
html.push('<li>Static analysis only: rules that need a live CMS host (relay permissions, runtime errors) cannot be fully proven here.</li>');
html.push('</ul></div></section>');

html.push('<section><h2>Findings by rule</h2><div class="section-body"><table class="legend"><thead><tr><th>Rule</th><th>Severity</th><th>Requirement</th><th>Tools</th></tr></thead><tbody>');
Object.keys(ruleCounts).sort(function (a, b) { return ruleCounts[b] - ruleCounts[a]; }).forEach(function (ruleId) {
  var rule = RULES[ruleId];
  html.push('<tr><td><strong>' + escHtml(ruleId) + '</strong><div class="rule-text">' + escHtml(rule.title) + '</div></td><td>' + severityChip(rule.severity) + '</td><td class="rule-text">' + escHtml(rule.text) + '</td><td><strong>' + ruleCounts[ruleId] + '</strong></td></tr>');
});
if (!Object.keys(ruleCounts).length) html.push('<tr><td colspan="4" class="clean-row">No violations found.</td></tr>');
html.push('</tbody></table></div></section>');

html.push('<section><h2>Tool findings (' + failingTools.length + ')</h2><div class="section-body">');
failingTools.forEach(function (tool) {
  var counts = { critical: 0, major: 0, minor: 0 };
  tool.findings.forEach(function (f) { counts[RULES[f.rule].severity]++; });
  var stamps = 'html ' + (tool.info.stamps.html || 'missing') + ' / css ' + (tool.info.stamps.css || 'missing') + ' / js ' + (tool.info.stamps.js || 'missing');
  html.push('<details class="tool"' + (counts.critical ? ' open' : '') + '>');
  html.push('<summary>');
  html.push('<span class="tool-name">' + escHtml(tool.name) + (tool.archived ? ' <em>(archived)</em>' : '') + '</span>');
  html.push('<span class="tool-path">' + escHtml(rel(tool.dir)) + '</span>');
  html.push('<span class="count">');
  if (counts.critical) html.push('<span class="count-chip crit">' + counts.critical + ' critical</span>');
  if (counts.major) html.push('<span class="count-chip major">' + counts.major + ' major</span>');
  if (counts.minor) html.push('<span class="count-chip minor">' + counts.minor + ' minor</span>');
  if (!counts.critical && !counts.major && !counts.minor) html.push('<span class="count-chip ok">clean</span>');
  html.push('</span></summary>');
  html.push('<div class="tool-body">');
  html.push('<div class="tool-meta"><span>TOOL_BUILD: <code>' + escHtml(tool.info.toolBuild || 'missing') + '</code></span><span>Stamps: <code>' + escHtml(stamps) + '</code></span></div>');
  html.push('<table><thead><tr><th>Severity</th><th>Rule</th><th>File / line</th><th>Evidence &amp; fix</th></tr></thead><tbody>');
  html.push(findingRows(tool.findings));
  html.push('</tbody></table></div></details>');
});
html.push('</div></section>');

html.push('<section><h2>Compliant tools (' + cleanTools.length + ')</h2><div class="section-body">');
if (cleanTools.length) {
  html.push('<div class="clean-list">');
  cleanTools.forEach(function (tool) { html.push('<span>' + escHtml(tool.name) + (tool.archived ? ' (archived)' : '') + '</span>'); });
  html.push('</div>');
} else {
  html.push('<p class="note">No tool set is fully compliant with every checked rule.</p>');
}
html.push('</div></section>');

html.push('<section><h2>Archived tool sets (' + archivedTools.length + ')</h2><div class="section-body note">');
html.push('<p>These folders are marked OLD / delete / backup. Findings are reported for completeness only; do not spend release time on them unless they can still be opened from the CMS.</p>');
html.push('<ul>' + archivedTools.map(function (tool) { return '<li><strong>' + escHtml(tool.name) + '</strong> - ' + escHtml(rel(tool.dir)) + ' (' + tool.findings.length + ' finding(s))</li>'; }).join('') + '</ul>');
html.push('</div></section>');

html.push('<footer>Generated by scripts/check-html-tool-rules.js - static analysis against html-tool-rules.txt v3.0.</footer>');
html.push('</div></body></html>');

fs.writeFileSync(REPORT_PATH, html.join('\n'), 'utf8');

console.log('Scanned ' + tools.length + ' tool sets (' + activeTools.length + ' active, ' + archivedTools.length + ' archived).');
console.log('Critical: ' + stats.critical + ' | Major: ' + stats.major + ' | Minor: ' + stats.minor);
console.log('Blocked (critical/major): ' + blockingTools.length + ' | Advisory only: ' + advisoryOnlyTools.length + ' | Clean: ' + cleanTools.length);
console.log('Report: ' + REPORT_PATH);
if (process.argv.indexOf('--list') !== -1) {
  failingTools.forEach(function (tool) {
    console.log('- ' + tool.name + ': ' + tool.findings.map(function (f) { return f.rule; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', '));
  });
}
if (process.argv.indexOf('--rules') !== -1) {
  Object.keys(ruleCounts).sort(function (a, b) { return ruleCounts[b] - ruleCounts[a]; }).forEach(function (ruleId) {
    var affected = tools.filter(function (tool) {
      return tool.findings.some(function (f) { return f.rule === ruleId; });
    }).map(function (tool) { return tool.name; });
    console.log(ruleId + ' [' + RULES[ruleId].severity + '] ' + ruleCounts[ruleId] + ' finding(s) in ' + affected.length + ' tool(s): ' + affected.join(', '));
  });
}
if (process.argv.indexOf('--rules') !== -1) {
  Object.keys(ruleCounts).sort(function (a, b) { return ruleCounts[b] - ruleCounts[a]; }).forEach(function (ruleId) {
    var affected = tools.filter(function (tool) { return tool.findings.some(function (f) { return f.rule === ruleId; }); }).map(function (tool) { return tool.name; });
    console.log(ruleId + ' [' + RULES[ruleId].severity + '] ' + ruleCounts[ruleId] + ' finding(s) in ' + affected.length + ' tool(s): ' + affected.join(', '));
  });
}
