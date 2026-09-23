// ── DOCS SCAFFOLD (npm run docs:init) ──────────────────────────────────────
// Creates the docs/ folder for every tool that does not have it yet, with
// the seven documents born from _docs/templates/:
//   index.html (one-page shell with a thin left menu that loads all of the
//   documents and the test harness into a full-page iframe),
//   ssot.html, webpage.html, help.html, presentation.html, updates.html,
//   social.html
// Only creates MISSING files - existing documents are never overwritten, so
// re-running is always safe. No AI is used here; the AI regeneration happens
// with scripts/generate-docs.js (npm run docs:generate / npm run rel).
//
// Usage:  npm run docs:init
//         npm run docs:init -- --tool AIChatPresentationBuilder
const { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } = require('fs')
const { join } = require('path')
const context = require('./releaseContext')

const TOOL_PARTS = context.TOOL_PARTS
const SATELLITE_FILES = context.SATELLITE_FILES

function templatePath(templateName) {
  return join(context.TEMPLATES_DIR, '_' + templateName + '-template.html')
}

function fillCommonPlaceholders(templateContent, replacements) {
  let content = templateContent
  Object.keys(replacements).forEach((placeholder) => {
    content = content.split(placeholder).join(replacements[placeholder])
  })
  return content
}

// ── Webpage design-system helpers ──
function expandHex(hex) {
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    return '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
  }
  return '#4f46e5'
}
function darkenHex(hex, factor) {
  const expanded = expandHex(hex)
  const channels = [1, 3, 5].map((index) => Math.round(parseInt(expanded.slice(index, index + 2), 16) * factor))
  return '#' + channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')
}
// The tool's own color: first --primary found in its CSS. Fallback indigo.
function extractToolAccent(tool) {
  const cssPath = join(tool.toolDirectory, 'app', tool.toolName + '.css')
  let cssText = ''
  try { cssText = readFileSync(cssPath, 'utf8') } catch (_e) { return '#4f46e5' }
  const match = cssText.match(/--primary\s*:\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\b/)
  return match ? expandHex(match[1]) : '#4f46e5'
}

// ── Screenshots helpers ──
const SCREENSHOT_SHOT_DEFAULTS = {
  '01-dashboard-desktop.png': { label: 'Dashboard (desktop)', page: 'dashboard', viewport: '1440x900' },
  '02-dashboard-mobile.png': { label: 'Dashboard (mobile)', page: 'dashboard', viewport: '390x844' },
  '03-documents-desktop.png': { label: 'Documents (desktop)', page: 'documents', viewport: '1440x900' },
  '04-transactions-desktop.png': { label: 'Transactions (desktop)', page: 'transactions', viewport: '1440x900' },
  '05-expense-finder-desktop.png': { label: 'Expense Finder (desktop)', page: 'finder', viewport: '1440x900' },
  '06-gst-desktop.png': { label: 'GST / PST (desktop)', page: 'gst', viewport: '1440x900' },
  '07-assistant-desktop.png': { label: 'AI Assistant (desktop)', page: 'assistant', viewport: '1440x900' },
  '08-reports-desktop.png': { label: 'Reports (desktop)', page: 'reports', viewport: '1440x900' },
  '09-settings-desktop.png': { label: 'Settings (desktop)', page: 'settings', viewport: '1440x900' },
}

// Lists the tool's screenshots with everything the index viewer and the
// other documents need: the screenshots.json manifest (written by
// npm run screenshots) supplies labels, viewport, REAL pixel dimensions and
// capture time; fall back to defaults when the manifest is missing.
function buildScreenshotsPayload(tool) {
  const screenshotsDirectory = join(tool.docsDirectory, 'screenshots')
  let pngFiles = []
  try {
    pngFiles = readdirSync(screenshotsDirectory).filter((name) => /\.png$/i.test(name)).sort()
  } catch (_e) { return [] }
  let manifest = { shots: [] }
  try {
    manifest = JSON.parse(readFileSync(join(screenshotsDirectory, 'screenshots.json'), 'utf8')) || manifest
  } catch (_e) { /* manifest missing */ }
  const manifestByFile = {}
  ;(manifest.shots || []).forEach((entry) => { if (entry && entry.file) manifestByFile[entry.file] = entry })

  // where each shot is used across the docs - shown in the viewer info panel
  const docUsage = {}
  const usageSources = ['webpage.html', 'help.html', 'presentation.html', 'ssot.html', 'updates.html', 'social.html']
  usageSources.forEach((fileName) => {
    let documentContent = ''
    try { documentContent = readFileSync(join(tool.docsDirectory, fileName), 'utf8') } catch (_e) { return }
    pngFiles.forEach((pngFile) => {
      if (documentContent.indexOf('screenshots/' + pngFile) !== -1) {
        ;(docUsage[pngFile] = docUsage[pngFile] || []).push(fileName)
      }
    })
  })

  return pngFiles.map((pngFile) => {
    const manifestEntry = manifestByFile[pngFile] || {}
    const defaults = SCREENSHOT_SHOT_DEFAULTS[pngFile] || {}
    return {
      src: 'screenshots/' + pngFile,
      name: pngFile,
      label: manifestEntry.label || defaults.label || pngFile,
      page: manifestEntry.page || defaults.page || '',
      viewport: manifestEntry.viewport || defaults.viewport || '',
      width: manifestEntry.width || 0,
      height: manifestEntry.height || 0,
      capturedAt: manifestEntry.capturedAt || '',
      usedIn: docUsage[pngFile] || [],
    }
  })
}

// The help document's fixed "What it looks like" section: figures for every
// captured shot (page shots only - the mobile duplicate is skipped). Empty
// string when the tool has no screenshots, so the section disappears.
function buildHelpShotsSection(tool, displayName) {
  const shots = buildScreenshotsPayload(tool).filter((shot) => shot.page)
  if (!shots.length) return ''
  const figures = shots.map((shot) => {
    const captionParts = [shot.label]
    if (shot.viewport) captionParts.push(shot.viewport)
    if (shot.width && shot.height) captionParts.push(shot.width + 'x' + shot.height)
    return '<figure class="ssot-shot"><img src="screenshots/' + shot.name + '" alt="' + displayName + ' - ' + captionParts.join(' - ') + '" loading="lazy" /><figcaption>' + captionParts.join(' - ') + '</figcaption></figure>'
  }).join('\n')
  return [
    '<h2 id="screenshots">6. What it looks like</h2>',
    '<p>Screenshots of ' + displayName + ' with sample data - see exactly what you get.</p>',
    '<div class="ssot-shots">' + figures + '</div>',
  ].join('\n')
}

// CSS for the social shell sections (media strip + share-set archive).
// Injected into legacy self-contained social.html files whose inline
// <style> predates the shell sections.
const SOCIAL_SHELL_CSS = [
  '  /* media to attach + per-ship share sets (shared shell) */',
  '  .share-media { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-top: 10px; }',
  '  .share-media-shot { margin: 0; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; background: #f8fafc; }',
  '  .share-media-shot img { width: 100%; aspect-ratio: 16 / 10; object-fit: cover; object-position: top; display: block; }',
  '  .share-media-shot figcaption { padding: 6px 9px; font-size: 0.7rem; color: #64748b; word-break: break-all; }',
  '  .share-set { margin: 12px 0; border: 1px solid #e2e8f0; border-radius: 14px; background: #ffffff; overflow: hidden; }',
  '  .share-set > summary { cursor: pointer; padding: 14px 18px; font-weight: 700; color: #0f172a; background: #f8fafc; list-style: none; }',
  '  .share-set > summary::before { content: \'\\25B8 \'; color: #4f46e5; }',
  '  .share-set[open] > summary::before { content: \'\\25BE \'; }',
  '  .share-set > summary .share-set-date { float: right; color: #64748b; font-weight: 500; font-size: 0.8rem; }',
  '  .share-set-body { padding: 4px 18px 16px; }',
  '  .share-set-body .share-card { border: 1px solid #eef2ff; }',
].join('\n')

// The social document's fixed shell sections: the "Media to attach" strip
// with real screenshot thumbnails, and the per-ship share set archive.
function buildSocialShellSection(tool, displayName) {
  const shots = buildScreenshotsPayload(tool).filter((shot) => shot.page)
  const mediaHtml = shots.length
    ? shots.map((shot) => {
      return '<figure class="share-media-shot"><img src="screenshots/' + shot.name + '" alt="' + displayName + ' - ' + shot.label + '" loading="lazy" /><figcaption>' + shot.name + '</figcaption></figure>'
    }).join('\n')
    : '<p class="share-note">No screenshots yet - run npm run screenshots -- ' + tool.toolName + ' and re-run docs:init.</p>'
  return [
    '<h2 id="media">7. Media to attach</h2>',
    '<div class="share-card">',
    '  <div class="share-card-head"><span class="share-tag">Screenshots for the latest ship</span></div>',
    '  <p class="share-note">Attach the real screenshots below to every post of this release. Diagrams or',
    '  promo images can be added the same way - the goal is one strong visual per post.</p>',
    '  <div class="share-media">' + mediaHtml + '</div>',
    '</div>',
    '',
    '<!-- SHARE-SETS-START - one archived share set per ship, newest first.',
    '     After every SHIP, Copilot moves the previous kit here as a',
    '     <details class="share-set"> block and writes the new kit between the',
    '     GENERATED markers above. -->',
    '<h2 id="share-sets">8. Share sets by release</h2>',
    '<p class="meta">Every SHIP adds its own share set - use the newest on top. Multiple updates',
    'mean multiple sets; nothing is ever deleted, only archived.</p>',
    '<!-- SHARE-SETS-END -->',
  ].join('\n')
}

function fillSsotDocument(templateContent, tool, replacements) {
  let content = fillCommonPlaceholders(templateContent, replacements)

  // Applies to: list the built parts with their folder paths.
  const partsText = tool.parts.map((partName) => partName + '/').join(', ')
  content = content.replace(
    /(<tr><th>Applies to<\/th><td>)([\s\S]*?)(<\/td><\/tr>)/,
    (match, before, _placeholderText, after) =>
      before + 'The ' + partsText + ' part(s) of this tool folder (' + tool.toolName + ').' + after
  )

  // Primary code areas: the actual files of every part.
  const codeAreas = []
  tool.parts.forEach((partName) => {
    const partDirectory = join(tool.toolDirectory, partName)
    let fileEntries
    try { fileEntries = readdirSync(partDirectory, { withFileTypes: true }) } catch (_e) { return }
    fileEntries.forEach((entry) => {
      if (!entry.isFile()) return
      codeAreas.push(partName + '/' + entry.name)
    })
  })
  if (codeAreas.length) {
    content = content.replace(
      /(<tr><th>Primary code areas<\/th><td>)([\s\S]*?)(<\/td><\/tr>)/,
      (match, before, _placeholderText, after) =>
        before + '<code>' + codeAreas.join('</code>, <code>') + '</code>' + after
    )
  }

  // Footer version line keeps the template default - nothing to do.
  return content
}

function buildUpdatesDocument(templateContent, replacements) {
  return fillCommonPlaceholders(templateContent, replacements)
}

function buildWebpageDocument(templateContent, tool, replacements) {
  let content = fillCommonPlaceholders(templateContent, replacements)
  // per-tool accent colors (from the tool's own --primary) - the only
  // per-tool difference in the shared webpage design system
  const accent = extractToolAccent(tool)
  content = content.split('[ACCENT]').join(accent)
  content = content.split('[ACCENT_2]').join(darkenHex(accent, 0.72))
  // highlight-row screenshots from docs/screenshots/ (empty src shows the
  // placeholder plate via webpage.js when the shot does not exist)
  const screenshotsDirectory = join(tool.docsDirectory, 'screenshots')
  const dashboardShot = existsSync(join(screenshotsDirectory, '01-dashboard-desktop.png')) ? 'screenshots/01-dashboard-desktop.png' : ''
  const documentsShot = existsSync(join(screenshotsDirectory, '03-documents-desktop.png')) ? 'screenshots/03-documents-desktop.png' : ''
  const mobileShot = existsSync(join(screenshotsDirectory, '02-dashboard-mobile.png')) ? 'screenshots/02-dashboard-mobile.png' : ''
  content = content.split('[SCREENSHOT_1]').join(dashboardShot)
  content = content.split('[SCREENSHOT_2]').join(documentsShot || dashboardShot)
  content = content.split('[SCREENSHOT_3]').join(mobileShot)
  // without a mobile shot the whole mobile highlight row disappears
  if (!mobileShot) {
    const mobileStart = content.indexOf('<!-- MOBILE-HIGHLIGHT-START')
    const mobileEnd = content.indexOf('<!-- MOBILE-HIGHLIGHT-END -->')
    if (mobileStart !== -1 && mobileEnd !== -1) {
      content = content.slice(0, mobileStart) + content.slice(mobileEnd + '<!-- MOBILE-HIGHLIGHT-END -->'.length)
    }
  }
  // the screenshot gallery (the protected "demo" - images only, the tool's
  // code never ships to the public page): one item per unique captured shot
  const galleryShots = buildScreenshotsPayload(tool).filter((shot) => shot.page)
  const galleryHtml = galleryShots.length
    ? galleryShots.map((shot) => {
      return '<button class="wp-gallery-item" type="button"><img src="screenshots/' + shot.name + '" alt="' + replacements['[FEATURE NAME]'] + ' - ' + shot.label + '" loading="lazy" /><span>' + shot.label + '</span></button>'
    }).join('\n')
    : '<p class="wp-gallery-empty">Screenshots are being prepared - check back soon.</p>'
  content = content.split('[GALLERY_SHOTS]').join(galleryHtml)
  return content
}

function buildSocialDocument(templateContent, tool, replacements) {
  let content = fillCommonPlaceholders(templateContent, replacements)
  // the fixed "Media to attach" strip: real screenshot thumbnails the team
  // attaches to every social post of the latest ship
  const shots = buildScreenshotsPayload(tool).filter((shot) => shot.page)
  const mediaHtml = shots.length
    ? shots.map((shot) => {
      return '<figure class="share-media-shot"><img src="screenshots/' + shot.name + '" alt="' + replacements['[FEATURE NAME]'] + ' - ' + shot.label + '" loading="lazy" /><figcaption>' + shot.name + '</figcaption></figure>'
    }).join('\n')
    : '<p class="share-note">No screenshots yet - run npm run screenshots -- ' + tool.toolName + ' and re-run docs:init.</p>'
  content = content.split('[SOCIAL_MEDIA_SHOTS]').join(mediaHtml)
  return content
}

function buildDocsIndexDocument(templateContent, tool, replacements) {
  let content = fillCommonPlaceholders(templateContent, replacements)
  // The test-harness menu item appears only when the tool actually has one.
  const harnessPath = join(tool.toolDirectory, 'app', 'test-harness.html')
  const harnessItem = existsSync(harnessPath)
    ? '<button class="docs-nav-item docs-nav-harness" data-doc="harness" data-src="../app/test-harness.html">Test harness<span class="docs-nav-sub">live tool with mock SDK</span></button>'
    : '<!-- no app/test-harness.html for this tool -->'
  content = content.replace('[HARNESS_ITEM]', harnessItem)
  // The HTML/CSS/JS code of the tool, embedded so the index can show + copy it.
  // split/join (NOT replace) - the payload contains $ sequences that
  // String.replace would interpret as special patterns.
  const codePayload = buildCodePayload(tool)
  const payloadText = JSON.stringify(codePayload).replace(/<\//g, '<\\/')
  content = content.split('[CODE_PAYLOAD]').join(payloadText)
  // screenshots viewer payload (files + manifest info + where each shot is used)
  const shotsPayloadText = JSON.stringify(buildScreenshotsPayload(tool)).replace(/<\//g, '<\\/')
  content = content.split('[SCREENSHOTS_PAYLOAD]').join(shotsPayloadText)
  return content
}

function buildHelpDocument(templateContent, tool, replacements) {
  let content = fillCommonPlaceholders(templateContent, replacements)
  // the fixed screenshots section - only present when the tool has shots
  const sectionHtml = buildHelpShotsSection(tool, replacements['[FEATURE NAME]'])
  content = content.split('[HELP_SHOTS_SECTION]').join(sectionHtml)
  return content
}

// Reads the tool's app code files (named after the tool by convention) and
// returns the payload embedded into docs/index.html. Missing files are null.
function buildCodePayload(tool) {
  const payload = { html: null, css: null, js: null }
  const appDirectory = join(tool.toolDirectory, 'app')
  const kinds = {
    html: { extension: '.html', label: 'HTML' },
    css: { extension: '.css', label: 'CSS' },
    js: { extension: '.js', label: 'JS' },
  }
  Object.keys(kinds).forEach((kind) => {
    const fileName = tool.toolName + kinds[kind].extension
    const filePath = join(appDirectory, fileName)
    if (!existsSync(filePath)) return
    let fileContent = ''
    try { fileContent = readFileSync(filePath, 'utf8') } catch (_e) { return }
    if (fileContent.length > 2000000) return   // skip pathological files
    payload[kind] = {
      name: fileName,
      src: '../app/' + fileName,
      content: fileContent,
    }
  })
  return payload
}

function buildToolDocuments(tool, onlyMissing, log) {
  const docsDirectory = tool.docsDirectory
  mkdirSync(docsDirectory, { recursive: true })

  const allToolsEntry = context.getAllToolsEntry(tool)
  const displayName = (allToolsEntry && allToolsEntry.displayName) || context.toDisplayName(tool.toolName)
  const decisionPrefix = context.toDecisionPrefix(tool.toolName)
  const today = new Date().toISOString().slice(0, 10)
  const assetsRelative = context.assetsRelativeFrom(docsDirectory)
  const cssClass = context.toKebabClass(tool.toolName)

  const replacements = {
    '[FEATURE NAME]': displayName,
    '[DATE]': today,
    '[CODE]': decisionPrefix,
    '[ASSETS_RELATIVE]': assetsRelative,
    '[SSOT FILE]': SATELLITE_FILES.ssot,
    '[CSS_CLASS]': cssClass,
  }

  const filesToBuild = {
    index: (templateContent) => buildDocsIndexDocument(templateContent, tool, replacements),
    ssot: (templateContent) => fillSsotDocument(templateContent, tool, replacements),
    webpage: (templateContent) => buildWebpageDocument(templateContent, tool, replacements),
    help: (templateContent) => buildHelpDocument(templateContent, tool, replacements),
    presentation: (templateContent) => fillCommonPlaceholders(templateContent, replacements),
    updates: (templateContent) => buildUpdatesDocument(templateContent, replacements),
    social: (templateContent) => buildSocialDocument(templateContent, tool, replacements),
  }

  const outputNames = {
    index: 'index.html',
    ssot: SATELLITE_FILES.ssot,
    webpage: SATELLITE_FILES.webpage,
    help: SATELLITE_FILES.help,
    presentation: SATELLITE_FILES.presentation,
    updates: SATELLITE_FILES.updates,
    social: SATELLITE_FILES.social,
  }

  let createdCount = 0
  Object.keys(filesToBuild).forEach((documentType) => {
    const outputPath = join(docsDirectory, outputNames[documentType])
    if (existsSync(outputPath)) return
    if (onlyMissing && existsSync(outputPath)) return
    const templateContent = readFileSync(templatePath(documentType), 'utf8')
    writeFileSync(outputPath, filesToBuild[documentType](templateContent), 'utf8')
    createdCount++
  })

  if (log) {
    console.log(
      createdCount > 0
        ? `→ ${tool.toolName}: created ${createdCount} document(s) in docs/ (${tool.parts.join(', ')})`
        : `→ ${tool.toolName}: docs complete, nothing missing`
    )
  }
  return createdCount
}

// ── DOCS SHELL REFRESH (npm run docs:init -- --refresh-shells) ─────────────
// Migrates EXISTING docs to the current shell templates without touching
// hand/AI-maintained content:
//  - docs/index.html is fully regenerated from the template (it is a
//    generated file: menu + panes + code payload + screenshots payload),
//  - docs/help.html gets the fixed "What it looks like" screenshots section
//    inserted right after the GENERATED-END marker,
//  - docs/social.html gets the shell sections (media strip + per-ship share
//    set archive) inserted right after the GENERATED-END marker.
// Insertions are idempotent - markers keep re-runs safe.
function refreshToolShells(tool, log) {
  const indexPath = join(tool.docsDirectory, 'index.html')
  try { unlinkSync(indexPath) } catch (_e) { /* no index yet */ }
  buildToolDocuments(tool, true, false)   // rebuilds index.html from the template

  const allToolsEntry = context.getAllToolsEntry(tool)
  const displayName = (allToolsEntry && allToolsEntry.displayName) || context.toDisplayName(tool.toolName)

  // help.html - screenshots section (only when shots exist)
  const helpPath = join(tool.docsDirectory, SATELLITE_FILES.help)
  if (existsSync(helpPath)) {
    let helpContent = readFileSync(helpPath, 'utf8')
    if (helpContent.indexOf('id="screenshots"') !== -1) {
      if (log) console.log('→ ' + tool.toolName + ': help screenshots section already present')
    } else {
      const endIndex = helpContent.indexOf('<!-- GENERATED-END -->')
      if (endIndex === -1) {
        if (log) console.log('→ ' + tool.toolName + ': help.html has no GENERATED-END marker - skipped')
      } else {
        const sectionHtml = buildHelpShotsSection(tool, displayName)
        if (!sectionHtml) {
          if (log) console.log('→ ' + tool.toolName + ': no screenshots yet - help section left out')
        } else {
          const insertPoint = endIndex + '<!-- GENERATED-END -->'.length
          helpContent = helpContent.slice(0, insertPoint) + '\n\n' + sectionHtml + helpContent.slice(insertPoint)
          writeFileSync(helpPath, helpContent, 'utf8')
          if (log) console.log('→ ' + tool.toolName + ': help screenshots section inserted')
        }
      }
    }
  }

  // social.html - shell sections (media strip + per-ship share set archive)
  const socialPath = join(tool.docsDirectory, SATELLITE_FILES.social)
  if (existsSync(socialPath)) {
    let socialContent = readFileSync(socialPath, 'utf8')
    let socialChanged = false
    // legacy self-contained files: make sure the shell CSS exists
    if (socialContent.indexOf('.share-media {') === -1 && socialContent.indexOf('</style>') !== -1) {
      socialContent = socialContent.replace('</style>', SOCIAL_SHELL_CSS + '\n</style>')
      socialChanged = true
    }
    if (socialContent.indexOf('SHARE-SETS-START') !== -1) {
      if (log) console.log('→ ' + tool.toolName + ': social shell sections already present')
    } else {
      const socialEndIndex = socialContent.indexOf('<!-- GENERATED-END -->')
      if (socialEndIndex === -1) {
        if (log) console.log('→ ' + tool.toolName + ': social.html has no GENERATED-END marker - skipped')
      } else {
        const socialSection = buildSocialShellSection(tool, displayName)
        const socialInsertPoint = socialEndIndex + '<!-- GENERATED-END -->'.length
        socialContent = socialContent.slice(0, socialInsertPoint) + '\n\n' + socialSection + socialContent.slice(socialInsertPoint)
        socialChanged = true
      }
    }
    if (socialChanged) {
      writeFileSync(socialPath, socialContent, 'utf8')
      if (log) console.log('→ ' + tool.toolName + ': social shell sections/CSS inserted')
    }
  }

  return true
}

function main() {
  const args = process.argv.slice(2)
  const requestedToolName = args.includes('--tool') ? args[args.indexOf('--tool') + 1] : ''
  const verbose = args.includes('--verbose')
  const refreshShells = args.includes('--refresh-shells')

  const tools = requestedToolName
    ? [context.findToolByName(requestedToolName)].filter(Boolean)
    : context.listToolParts()

  if (requestedToolName && tools.length === 0) {
    console.error('Tool not found: ' + requestedToolName)
    process.exit(1)
  }

  if (refreshShells) {
    let migratedCount = 0
    tools.forEach((tool) => {
      if (refreshToolShells(tool, verbose)) migratedCount++
    })
    console.log(`\nDocs shell refresh complete: ${migratedCount} of ${tools.length} tool(s) processed.`)
    console.log('index.html regenerated from the template; help + social shell sections inserted where missing.')
    return
  }

  let totalCreated = 0
  tools.forEach((tool) => {
    totalCreated += buildToolDocuments(tool, true, verbose)
  })

  console.log(`\nDocs scaffold complete: ${tools.length} tool(s) checked, ${totalCreated} document(s) created.`)
  console.log('Next: fill the SSOT (features, decisions, tasks, risks), then regenerate the')
  console.log('satellites with:  npm run docs:generate -- <ToolName>')
}

if (require.main === module) {
  main()
}

module.exports = { buildToolDocuments, fillCommonPlaceholders, buildCodePayload, extractToolAccent, buildWebpageDocument, buildScreenshotsPayload, buildHelpShotsSection, buildSocialShellSection, refreshToolShells }
