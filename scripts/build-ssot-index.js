// ── SSOT CONTROL TOWER INDEX (npm run ssot:index) ──────────────────────────
// Scans docs/ssot.html under every tool folder and writes _docs/index.html as
// a TAXONOMY TREE - the same folder hierarchy as the repo: branch (BUSINESS /
// PERSONAL) > type (GENERAL / VERTICAL) > category > subcategory > tool rows.
// Nodes follow the taxonomy order from folder-hierarchy-import.json (never
// sorted by name). Every node shows aggregate counts (tools, tasks, decisions,
// releases, open risks). Includes a search filter and expand/collapse controls.
// Also invoked automatically by npm run rel after each release.
const { readFileSync, writeFileSync } = require('fs')
const { join, relative } = require('path')
const releaseContext = require('./releaseContext')

const INDEX_PATH = join(releaseContext.ROOT, '_docs', 'index.html')
const TAXONOMY_PATH = join(releaseContext.ROOT, 'UNICON-TOOLS', 'folder-hierarchy-import.json')

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function extractField(content, pattern, fallback = '') {
  const match = content.match(pattern)
  return match ? match[1].trim() : fallback
}

function folderBaseName(folderName) {
  // dynamic folder names look like <slug>_<apps>_of_<ideas>
  return String(folderName || '').replace(/_\d+_of_\d+$/, '')
}

function buildDocumentInfo(document) {
  const content = readFileSync(document.path, 'utf8')
  if (!content.includes('<h1>')) return null   // empty placeholder file - not a real document yet
  const visibleContent = releaseContext.stripHtmlComments(content)
  const tool = releaseContext.findToolByName(document.name)
  const relativePath = relative(releaseContext.ROOT, document.path).replace(/\\/g, '/')
  const openRisks = releaseContext.getOpenRisksFromSsotDocuments().filter((risk) => risk.documentName === document.name)
  return {
    toolName: document.name,
    relativePath,
    name: extractField(content, /<h1>([^<]+)<\/h1>/) || document.name,
    parts: tool ? tool.parts.join(', ') : '',
    version: extractField(content, /Document version<\/th><td>([^<]+)/),
    updated: extractField(content, /Last updated<\/th><td>([^<]+)/),
    status: extractField(content, /class="doc-status[^"]*"[^>]*>([^<]+)/),
    decisionCount: (visibleContent.match(/<tr>\s*<td>D-[A-Z]+-\d+<\/td>/g) || []).length,
    groupCount: (visibleContent.match(/data-release-group="/g) || []).length,
    taskCount: (visibleContent.match(/data-task-id="/g) || []).length,
    riskCount: (visibleContent.match(/data-risk-id="/g) || []).length,
    openRiskCount: openRisks.length,
    releaseCount: (extractField(content, /<tbody id="release-log-rows">([\s\S]*?)<\/tbody>/) || '').split('<tr>').length - 1,
  }
}

function loadTaxonomyTree() {
  let taxonomy
  try { taxonomy = JSON.parse(readFileSync(TAXONOMY_PATH, 'utf8')) } catch (_e) { return { roots: [], codeBySlug: {} } }
  const codeBySlug = {}
  const register = (node) => {
    if (node.slug) codeBySlug[node.slug] = node.code
    ;(node.children || []).forEach(register)
  }
  ;(taxonomy.folders || []).forEach(register)
  return { roots: taxonomy.folders || [], codeBySlug }
}

function aggregateCounts(node, toolsBySubcategoryCode) {
  const counts = { tools: 0, tasks: 0, decisions: 0, releases: 0, openRisks: 0 }
  ;(toolsBySubcategoryCode[node.code] || []).forEach((info) => {
    counts.tools += 1
    counts.tasks += info.taskCount
    counts.decisions += info.decisionCount
    counts.releases += info.releaseCount
    counts.openRisks += info.openRiskCount
  })
  ;(node.children || []).forEach((child) => {
    const childCounts = aggregateCounts(child, toolsBySubcategoryCode)
    counts.tools += childCounts.tools
    counts.tasks += childCounts.tasks
    counts.decisions += childCounts.decisions
    counts.releases += childCounts.releases
    counts.openRisks += childCounts.openRisks
  })
  node.counts = counts
  return counts
}

function countChip(count, label) {
  return '<span class="tw-chip">' + count + ' ' + label + (count === 1 ? '' : 's') + '</span>'
}

function toolRowHtml(info) {
  const riskClass = info.openRiskCount > 0 ? ' tw-risk-open' : ''
  return [
    '<div class="tw-tool-row" data-tool-name="' + escapeHtml(info.toolName) + '" data-tool-text="' + escapeHtml((info.name + ' ' + info.toolName).toLowerCase()) + '">',
    '<a class="tw-tool-name" href="' + info.relativePath + '">' + escapeHtml(info.name) + '</a>',
    '<span class="tw-tool-folder">' + escapeHtml(info.toolName) + '</span>',
    '<span class="tw-cell tw-cell-version">v' + escapeHtml(info.version) + '</span>',
    '<span class="tw-cell tw-cell-status">' + escapeHtml(info.status) + '</span>',
    '<span class="tw-cell" title="Decisions / Groups / Tasks / Releases">D ' + info.decisionCount + ' - G ' + info.groupCount + ' - T ' + info.taskCount + ' - R ' + info.releaseCount + '</span>',
    '<span class="tw-cell' + riskClass + '">' + (info.openRiskCount > 0 ? info.openRiskCount + ' open risk' + (info.openRiskCount === 1 ? '' : 's') : 'clear') + '</span>',
    '<span class="tw-cell tw-cell-updated">' + escapeHtml(info.updated) + '</span>',
    '</div>',
  ].join('')
}

function subcategoryHtml(node, toolsBySubcategoryCode) {
  const tools = toolsBySubcategoryCode[node.code] || []
  if (tools.length === 0) {
    return '<div class="tw-sub tw-sub-empty" data-node-text="' + escapeHtml(node.name.toLowerCase()) + '">'
      + '<span class="tw-sub-name">' + escapeHtml(node.name) + '</span>'
      + '<span class="tw-sub-slug">' + escapeHtml(node.slug || '') + '</span>'
      + '<span class="tw-chip tw-chip-muted">0 tools</span>'
      + '</div>'
  }
  return [
    '<details class="tw-sub" data-node-text="' + escapeHtml(node.name.toLowerCase()) + '">',
    '<summary><span class="tw-sub-name">' + escapeHtml(node.name) + '</span>'
      + '<span class="tw-sub-slug">' + escapeHtml(node.slug || '') + '</span>'
      + '<span class="tw-chip">' + tools.length + ' tool' + (tools.length === 1 ? '' : 's') + '</span></summary>',
    '<div class="tw-tools">' + tools.map(toolRowHtml).join('') + '</div>',
    '</details>',
  ].join('')
}

function categoryHtml(categoryNode, toolsBySubcategoryCode) {
  const counts = categoryNode.counts || {}
  const children = (categoryNode.children || []).map((subNode) => subcategoryHtml(subNode, toolsBySubcategoryCode)).join('')
  return [
    '<details class="tw-cat" data-node-text="' + escapeHtml(categoryNode.name.toLowerCase()) + '">',
    '<summary><span class="tw-cat-name">' + escapeHtml(categoryNode.name) + '</span>'
      + '<span class="tw-cat-code">' + escapeHtml(categoryNode.code || '') + '</span>'
      + countChip(counts.tools || 0, 'tool')
      + countChip(counts.tasks || 0, 'task')
      + (counts.openRisks ? '<span class="tw-chip tw-chip-risk">' + counts.openRisks + ' risk' + (counts.openRisks === 1 ? '' : 's') + '</span>' : '')
      + '</summary>',
    '<div class="tw-cat-body">' + children + '</div>',
    '</details>',
  ].join('')
}

function typeHtml(typeNode, toolsBySubcategoryCode) {
  const counts = typeNode.counts || {}
  const children = (typeNode.children || []).map((categoryNode) => categoryHtml(categoryNode, toolsBySubcategoryCode)).join('')
  return [
    '<details class="tw-type" data-node-text="' + escapeHtml(typeNode.name.toLowerCase()) + '" open="open">',
    '<summary><span class="tw-type-name">' + escapeHtml(typeNode.name.toUpperCase()) + '</span>'
      + '<span class="tw-type-slug">' + escapeHtml(typeNode.slug || '') + '</span>'
      + countChip(counts.tools || 0, 'tool')
      + countChip(counts.tasks || 0, 'task')
      + countChip(counts.decisions || 0, 'decision')
      + countChip(counts.releases || 0, 'release')
      + (counts.openRisks ? '<span class="tw-chip tw-chip-risk">' + counts.openRisks + ' open risk' + (counts.openRisks === 1 ? '' : 's') + '</span>' : '')
      + '</summary>',
    '<div class="tw-type-body">' + children + '</div>',
    '</details>',
  ].join('')
}

function branchHtml(branchNode, toolsBySubcategoryCode) {
  const counts = branchNode.counts || {}
  const children = (branchNode.children || []).map((typeNode) => typeHtml(typeNode, toolsBySubcategoryCode)).join('')
  return [
    '<details class="tw-branch" data-node-text="' + escapeHtml(branchNode.name.toLowerCase()) + '" open="open">',
    '<summary><span class="tw-branch-name">' + escapeHtml(branchNode.name.toUpperCase()) + '</span>'
      + countChip(counts.tools || 0, 'tool')
      + countChip(counts.tasks || 0, 'task')
      + countChip(counts.decisions || 0, 'decision')
      + countChip(counts.releases || 0, 'release')
      + (counts.openRisks ? '<span class="tw-chip tw-chip-risk">' + counts.openRisks + ' open risk' + (counts.openRisks === 1 ? '' : 's') + '</span>' : '')
      + '</summary>',
    '<div class="tw-branch-body">' + children + '</div>',
    '</details>',
  ].join('')
}

function buildSsotIndex() {
  const documentInfos = releaseContext.listToolSsotDocuments()
    .map((document) => buildDocumentInfo(document))
    .filter(Boolean)

  const { roots, codeBySlug } = loadTaxonomyTree()

  // map every tool into its subcategory code (from its folder path)
  const toolsBySubcategoryCode = {}
  const toolsByName = {}
  documentInfos.forEach((info) => { toolsByName[info.toolName] = info })
  releaseContext.listToolParts().forEach((tool) => {
    const segments = tool.toolDirectory.replace(/\\/g, '/').split('/')
    const subcategorySlug = folderBaseName(segments[segments.length - 2] || '')
    const code = codeBySlug[subcategorySlug]
    const info = toolsByName[tool.toolName]
    if (code && info) {
      if (!toolsBySubcategoryCode[code]) toolsBySubcategoryCode[code] = []
      toolsBySubcategoryCode[code].push(info)
    }
  })

  roots.forEach((rootNode) => aggregateCounts(rootNode, toolsBySubcategoryCode))

  const totals = documentInfos.reduce((sum, info) => ({
    tools: sum.tools + 1,
    tasks: sum.tasks + info.taskCount,
    decisions: sum.decisions + info.decisionCount,
    releases: sum.releases + info.releaseCount,
    openRisks: sum.openRisks + info.openRiskCount,
  }), { tools: 0, tasks: 0, decisions: 0, releases: 0, openRisks: 0 })

  const branchesHtml = roots.map((rootNode) => branchHtml(rootNode, toolsBySubcategoryCode)).join('')

  const indexHtml = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="UTF-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<title>SSOT Tool Control Tower</title>',
    '<link rel="stylesheet" type="text/css" href="assets/ssot.css" />',
    '<style>',
    '/* control tower tree - professional hierarchy view */',
    '.tw-summary { display:grid; grid-template-columns:repeat(5,1fr); gap:12px; margin:18px 0; }',
    '@media (max-width:900px){ .tw-summary { grid-template-columns:repeat(2,1fr); } }',
    '.tw-summary-card { background:#fff; border:1px solid var(--line); border-radius:12px; padding:14px 16px; }',
    '.tw-summary-big { font-size:1.5rem; font-weight:800; color:var(--accent); }',
    '.tw-summary-big.tw-risk { color:var(--risk); }',
    '.tw-summary-label { color:var(--muted); font-size:.8rem; margin-top:2px; }',
    '.tw-controls { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin:14px 0; }',
    '.tw-search { flex:1; min-width:220px; padding:9px 14px; border:1px solid var(--line); border-radius:10px; font-size:.9rem; background:#fff; }',
    '.tw-btn { border:1px solid var(--line); background:#fff; border-radius:10px; padding:8px 14px; font-size:.85rem; font-weight:700; color:var(--text); cursor:pointer; }',
    '.tw-btn:hover { border-color:var(--accent); color:var(--accent); }',
    'details.tw-branch, details.tw-type, details.tw-cat { margin:6px 0; }',
    'details.tw-branch > summary { background:#0f172a; color:#fff; }',
    'details.tw-type > summary { background:#eef2ff; color:#312e81; }',
    'details.tw-cat > summary { background:#f8fafc; color:var(--ink); }',
    '.tw-branch summary, .tw-type summary, .tw-cat summary, .tw-sub summary { list-style:none; cursor:pointer; display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding:10px 14px; border-radius:12px; border:1px solid var(--line); font-weight:700; }',
    '.tw-branch summary::-webkit-details-marker, .tw-type summary::-webkit-details-marker, .tw-cat summary::-webkit-details-marker, .tw-sub summary::-webkit-details-marker { display:none; }',
    '.tw-branch-name, .tw-type-name, .tw-cat-name, .tw-sub-name { font-size:.95rem; }',
    '.tw-type-slug, .tw-sub-slug, .tw-cat-code { font-size:.75rem; color:var(--muted); font-weight:600; }',
    '.tw-branch-body { border-left:2px solid #c7d2fe; margin-left:18px; padding-left:14px; }',
    '.tw-type-body { border-left:2px solid #e0e7ff; margin-left:18px; padding-left:14px; }',
    '.tw-cat-body { border-left:2px solid #f1f5f9; margin-left:18px; padding-left:14px; }',
    '.tw-chip { background:var(--accent-soft); color:var(--accent); border-radius:999px; padding:2px 10px; font-size:.72rem; font-weight:800; }',
    '.tw-chip-muted { background:var(--soft); color:var(--muted); border:1px solid var(--line); }',
    '.tw-chip-risk { background:var(--risk-soft); color:var(--risk); }',
    '.tw-sub { margin:4px 0; }',
    '.tw-sub-empty { display:flex; align-items:center; gap:8px; padding:7px 12px; border:1px dashed var(--line); border-radius:10px; color:var(--muted); font-size:.85rem; }',
    '.tw-tools { display:flex; flex-direction:column; gap:6px; padding:8px 0 8px 8px; }',
    '.tw-tool-row { display:grid; grid-template-columns: minmax(200px,1.4fr) minmax(160px,1fr) 70px 120px 160px 90px 100px; gap:10px; align-items:center; padding:9px 12px; border:1px solid var(--line); border-radius:10px; background:#fff; font-size:.85rem; }',
    '@media (max-width:1100px){ .tw-tool-row { grid-template-columns: 1fr 1fr; } .tw-cell-updated { display:none; } }',
    '.tw-tool-name { font-weight:800; color:var(--accent); text-decoration:none; }',
    '.tw-tool-name:hover { text-decoration:underline; }',
    '.tw-tool-folder { font-size:.78rem; color:var(--muted); }',
    '.tw-cell-version { font-weight:800; color:#312e81; }',
    '.tw-cell-status { font-size:.75rem; font-weight:700; color:#15803d; }',
    '.tw-risk-open { color:var(--risk); font-weight:800; }',
    '.tw-hidden { display:none !important; }',
    '</style>',
    '</head>',
    '<body>',
    '<div id="content" style="margin-left:0; margin-right:0; max-width:1200px;">',
    '<h1>SSOT - tool control tower</h1>',
    '<p class="meta">The full documentation tree, grouped exactly like the repo folders: branch > type > category > subcategory > tool. Generated by <code>npm run ssot:index</code> on ' + new Date().toISOString().slice(0, 10) + '. Templates and the doc system rules live in <code>_docs/templates/README.md</code>; the publishing protocol lives in <code>publish-rules.txt</code>.</p>',
    '<div class="tw-summary">',
    '<div class="tw-summary-card"><div class="tw-summary-big">' + totals.tools + '</div><div class="tw-summary-label">Tools documented</div></div>',
    '<div class="tw-summary-card"><div class="tw-summary-big">' + totals.tasks + '</div><div class="tw-summary-label">SSOT tasks</div></div>',
    '<div class="tw-summary-card"><div class="tw-summary-big">' + totals.decisions + '</div><div class="tw-summary-label">Decisions logged</div></div>',
    '<div class="tw-summary-card"><div class="tw-summary-big">' + totals.releases + '</div><div class="tw-summary-label">Releases</div></div>',
    '<div class="tw-summary-card"><div class="tw-summary-big' + (totals.openRisks ? ' tw-risk' : '') + '">' + totals.openRisks + '</div><div class="tw-summary-label">Open risks</div></div>',
    '</div>',
    '<div class="tw-controls">',
    '<input class="tw-search" id="tw-search" type="search" placeholder="Search tools and categories..." />',
    '<button class="tw-btn" id="tw-expand-all" type="button">Expand all</button>',
    '<button class="tw-btn" id="tw-collapse-all" type="button">Collapse all</button>',
    '</div>',
    '<div class="tw-tree">' + branchesHtml + '</div>',
    '</div>',
    '<script>',
    '(function () {',
    "  var searchInput = document.getElementById('tw-search');",
    "  var expandAllButton = document.getElementById('tw-expand-all');",
    "  var collapseAllButton = document.getElementById('tw-collapse-all');",
    "  function setAllDetails(openState) { document.querySelectorAll('.tw-tree details').forEach(function (d) { d.open = openState; }); }",
    "  if (expandAllButton) expandAllButton.addEventListener('click', function () { setAllDetails(true); });",
    "  if (collapseAllButton) collapseAllButton.addEventListener('click', function () { setAllDetails(false); });",
    '  if (searchInput) {',
    "    searchInput.addEventListener('input', function () {",
    '      var query = searchInput.value.trim().toLowerCase();',
    '      if (!query) {',
    "        document.querySelectorAll('.tw-hidden').forEach(function (el) { el.classList.remove('tw-hidden'); });",
    '        return;',
    '      }',
    '      setAllDetails(true);',
    "      document.querySelectorAll('.tw-tree details, .tw-tool-row').forEach(function (el) {",
    "        var text = el.getAttribute('data-node-text') || el.getAttribute('data-tool-text') || el.textContent.toLowerCase();",
    "        el.classList.toggle('tw-hidden', text.indexOf(query) === -1);",
    '      });',
    '    });',
    '  }',
    '})();',
    '</script>',
    '</body>',
    '</html>',
  ].join('\n')

  writeFileSync(INDEX_PATH, indexHtml, 'utf8')
  console.log('→ SSOT control tower written to ' + INDEX_PATH + ' (' + documentInfos.length + ' tools across ' + roots.length + ' branches)')
}

if (require.main === module) {
  buildSsotIndex()
}

module.exports = { buildSsotIndex }
