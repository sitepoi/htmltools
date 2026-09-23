// ── ONE-COMMAND RELEASE (npm run rel) ──────────────────────────────────────
// Finds every tool whose app / listing / reporting files changed since the
// last push, updates its documentation and ships everything:
//   1. SSOT push gate (open risks across all tool SSOTs)
//   2. git add -A + AI-generated one-line commit message
//   3. npm version patch (bumps package.json, commits + tags)
//   4. git push --follow-tags
//   5. For every changed tool:
//      - appends a release row to docs/ssot.html and docs/updates.html
//      - stamps shipped tasks (when RELEASE_SSOT_GROUPS is set)
//      - regenerates the AI satellites (webpage/help/presentation/social +
//        update highlights) from the code + SSOT + AI chat
//   6. rebuilds the SSOT control tower (_docs/index.html)
//   7. commits + pushes the documentation updates
//
// Env vars:
//   RELEASE_COMMIT_MESSAGE="message"  - skip AI, use a fixed message
//   RELEASE_SSOT_GATE=strict|warn|off - push gate on SSOT open risks (strict)
//   RELEASE_SSOT_GATE_LEVEL=critical|high|medium|low - minimum blocking level (high)
//   RELEASE_SSOT_GROUPS=all|key1,key2 - stamp shipped tasks of these groups
//   RELEASE_DRY_RUN=1 or --dry-run   - print the whole plan, change nothing
//
// AI backend + env vars: see scripts/releaseContext.js.

const { writeFileSync, readFileSync, mkdtempSync, existsSync } = require('fs')
const { tmpdir } = require('os')
const { join } = require('path')
const context = require('./releaseContext')
const { buildToolDocuments } = require('./init-docs')
const { generateToolDocumentation } = require('./generate-docs')
const { refreshToolIndexCode, refreshToolIndexScreenshots } = require('./refresh-docs-index')

const MAX_SHORT_MESSAGE_DIFF_CHARS = 12000
const RISK_LEVEL_RANK = { low: 1, medium: 2, high: 3, critical: 4 }

function buildShortCommitPrompt() {
  const pushedCommit = context.getPushedCommit()
  const changedFiles = context.getChangedFileList(pushedCommit)
  const codeDiff = context.getDiffSinceCommit(pushedCommit, MAX_SHORT_MESSAGE_DIFF_CHARS)
  return [
    'Write ONE short git commit message line for the code changes below.',
    '',
    '=== CHANGED FILES ===',
    changedFiles || '(none)',
    '',
    '=== CODE DIFF (truncated) ===',
    codeDiff || '(no changes)',
    '',
    'Rules:',
    '- A SINGLE line, maximum 72 characters, starting with a conventional-commit prefix (feat/fix/chore/docs/refactor/perf/test).',
    '- Only a concise summary of WHAT changed. No bullets, no explanation, no markdown, no quotes.',
  ].join('\n')
}

function checkSsotPushGate() {
  const gateMode = (process.env.RELEASE_SSOT_GATE || 'strict').toLowerCase()
  if (gateMode === 'off') return
  const thresholdLevel = (process.env.RELEASE_SSOT_GATE_LEVEL || 'high').toLowerCase()
  const thresholdRank = RISK_LEVEL_RANK[thresholdLevel] || RISK_LEVEL_RANK.high

  const openRisks = context.getOpenRisksFromSsotDocuments()
  if (openRisks.length === 0) {
    console.log('→ SSOT push gate: no open risks. CLEAR.')
    return
  }

  const levelCounts = {}
  openRisks.forEach((risk) => {
    const level = risk.level || 'medium'
    levelCounts[level] = (levelCounts[level] || 0) + 1
  })
  console.log('→ SSOT risk report - remaining open risks overall:')
  Object.keys(levelCounts)
    .sort((levelA, levelB) => (RISK_LEVEL_RANK[levelB] || 0) - (RISK_LEVEL_RANK[levelA] || 0))
    .forEach((level) => console.log('    ' + level + ': ' + levelCounts[level]))

  const blockingRisks = openRisks.filter((risk) => (RISK_LEVEL_RANK[risk.level] || RISK_LEVEL_RANK.medium) >= thresholdRank)
  if (blockingRisks.length > 0) {
    console.log('→ Blocking risks for this push (level >= ' + thresholdLevel + '):')
    blockingRisks.forEach((risk) => {
      console.log('    - ' + risk.documentName + ': ' + risk.riskId + ' [' + risk.level + '] ' + risk.riskTitle)
    })
    if (gateMode === 'strict') {
      throw new Error('Push blocked: ' + blockingRisks.length + ' open risk(s) at or above the "' + thresholdLevel + '" level. Solve or accept them, then re-run. Set RELEASE_SSOT_GATE=warn to proceed, or RELEASE_SSOT_GATE_LEVEL=critical to raise the bar.')
    }
    console.log('→ Gate mode is "warn" - continuing anyway.')
  } else {
    console.log('→ No risks at or above the "' + thresholdLevel + '" level - push allowed by the gate.')
  }
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function appendReleaseLogRow(tool, { version, commitHash, today, commitMessage }) {
  const ssotPath = join(tool.docsDirectory, context.SATELLITE_FILES.ssot)
  let documentContent
  try { documentContent = readFileSync(ssotPath, 'utf8') } catch (_e) { return false }
  const marker = '<!-- RELEASE-LOG-ROWS'
  const markerIndex = documentContent.indexOf(marker)
  if (markerIndex === -1) return false
  const escapedMessage = escapeHtml(commitMessage.split(/\r?\n/)[0])
  const newRow = '    <tr><td>' + today + '</td><td>' + version + '</td><td>' + commitHash + '</td><td>' + escapedMessage + '</td></tr>\n    '
  writeFileSync(ssotPath, documentContent.slice(0, markerIndex) + newRow + documentContent.slice(markerIndex), 'utf8')
  return true
}

function appendUpdatesRow(tool, { version, commitHash, today, commitMessage }) {
  const updatesPath = join(tool.docsDirectory, context.SATELLITE_FILES.updates)
  let documentContent
  try { documentContent = readFileSync(updatesPath, 'utf8') } catch (_e) { return false }
  const marker = '<!-- UPDATES-ROWS'
  const markerIndex = documentContent.indexOf(marker)
  if (markerIndex === -1) return false
  const escapedMessage = escapeHtml(commitMessage.split(/\r?\n/)[0])
  const newRow = '  <tr><td>' + today + '</td><td>' + version + '</td><td>' + escapedMessage + '</td><td>all users</td></tr>\n  '
  writeFileSync(updatesPath, documentContent.slice(0, markerIndex) + newRow + documentContent.slice(markerIndex), 'utf8')
  return true
}

function stampPushedTasks(tool, { version, commitHash, pushedAt }) {
  const groupsSetting = (process.env.RELEASE_SSOT_GROUPS || '').trim()
  if (!groupsSetting) return 0
  const groupsToStamp = groupsSetting === 'all' ? null : new Set(groupsSetting.split(',').map((key) => key.trim()).filter(Boolean))
  const ssotPath = join(tool.docsDirectory, context.SATELLITE_FILES.ssot)
  let documentContent
  try { documentContent = readFileSync(ssotPath, 'utf8') } catch (_e) { return 0 }
  let documentChanged = false
  let stampedTaskCount = 0

  const groupPattern = /<section class="task-group" data-release-group="([^"]+)"[^>]*>/g
  let groupMatch
  while ((groupMatch = groupPattern.exec(documentContent)) !== null) {
    const groupKey = groupMatch[1]
    if (groupsToStamp && !groupsToStamp.has(groupKey)) continue

    const groupStart = groupMatch.index
    const groupEnd = documentContent.indexOf('</section>', groupStart)
    const groupBlockEnd = groupEnd === -1 ? documentContent.length : groupEnd
    let groupBlock = documentContent.slice(groupStart, groupBlockEnd)

    const taskPattern = /<div class="task-item" data-task-id="[^"]*"[^>]*>/g
    let taskMatch
    while ((taskMatch = taskPattern.exec(groupBlock)) !== null) {
      const taskTag = taskMatch[0]
      if (taskTag.includes('data-pushed-version')) continue
      let stampedTag = taskTag.slice(0, -1)
      if (taskTag.includes('data-task-status=')) {
        stampedTag = stampedTag.replace(/data-task-status="[^"]*"/, 'data-task-status="done"')
      } else {
        stampedTag += ' data-task-status="done"'
      }
      stampedTag += ' data-pushed-version="' + version + '" data-pushed-commit="' + commitHash + '" data-pushed-at="' + pushedAt + '">'
      groupBlock = groupBlock.replace(taskTag, stampedTag)
      stampedTaskCount++
    }

    if (!groupBlock.includes('data-group-status="pushed"')) {
      groupBlock = groupBlock.replace(/data-group-status="[^"]*"/, 'data-group-status="pushed"')
    }

    if (groupBlock !== documentContent.slice(groupStart, groupBlockEnd)) {
      documentContent = documentContent.slice(0, groupStart) + groupBlock + documentContent.slice(groupBlockEnd)
      documentChanged = true
    }
  }

  if (documentChanged) {
    try { writeFileSync(ssotPath, documentContent, 'utf8') } catch (_e) { /* read-only document */ }
  }
  return stampedTaskCount
}

async function main() {
  const dryRun = process.argv.includes('--dry-run') || (process.env.RELEASE_DRY_RUN || '') === '1'
  const prefix = dryRun ? '[dry-run] ' : ''
  console.log((prefix ? '[dry-run] ' : '') + 'Release plan for the html-based tools store.')

  const pushedCommit = context.getPushedCommit()
  const changedTools = context.getChangedToolsSince(pushedCommit)
  console.log(prefix + 'Tools changed since the last push (' + (pushedCommit || 'no pushed commit yet') + '): '
    + (changedTools.length ? changedTools.map((tool) => tool.toolName).join(', ') : 'none'))

  const codeDiff = context.getDiffSinceCommit(pushedCommit, 4000).trim()
  const unpushedCommits = context.getUnpushedCommitLog().trim()
  let untrackedFiles = ''
  try { untrackedFiles = context.runCommand('git ls-files --others --exclude-standard', { silent: true }).trim() } catch (_e) { /* git unavailable */ }
  if (!codeDiff && !unpushedCommits && !untrackedFiles) {
    console.log('Nothing to commit - the tree matches the last push.')
    if (dryRun) { console.log('[dry-run] Would run: npm version patch + git push --follow-tags (no-op if no changes).') }
    return
  }

  if (dryRun) {
    console.log(prefix + 'Would run the SSOT push gate.')
  } else {
    checkSsotPushGate()
  }

  // ---- 1. commit + version + push the code changes ----
  let commitMessage
  if (dryRun) {
    commitMessage = process.env.RELEASE_COMMIT_MESSAGE || '(AI-generated commit message)'
    console.log(prefix + 'Would run: git add -A; git commit; npm version patch; git push --follow-tags.')
  } else {
    context.runCommand('git add -A', { silent: true })
    if (!process.env.RELEASE_COMMIT_MESSAGE) {
      console.log('→ Generating a short commit message...')
      commitMessage = context.cleanMessage(await context.getAiResponse(buildShortCommitPrompt()))
      commitMessage = commitMessage.split(/\r?\n/)[0].trim()
      if (!commitMessage) {
        throw new Error('The AI returned an empty commit message. Set RELEASE_COMMIT_MESSAGE to skip AI.')
      }
    } else {
      commitMessage = process.env.RELEASE_COMMIT_MESSAGE
    }
    const messageFilePath = join(mkdtempSync(join(tmpdir(), 'release-msg-')), 'COMMIT_EDITMSG')
    writeFileSync(messageFilePath, commitMessage, 'utf8')
    context.runCommand(`git commit -F "${messageFilePath}"`)
    context.runCommand('npm version patch')
    context.runCommand('git push --follow-tags')
  }

  // ---- 2. update the documentation of every changed tool ----
  let version = '0.0.0'
  try { version = require('../package.json').version } catch (_e) { /* package.json missing */ }
  let commitHash = ''
  try { commitHash = context.runCommand('git rev-parse --short HEAD', { silent: true }).trim() } catch (_e) { /* no commit */ }
  const today = new Date().toISOString().slice(0, 10)
  const pushedAt = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC'

  if (changedTools.length === 0) {
    console.log('→ No tool code changed in this push - documentation left untouched.')
  } else {
    for (const tool of changedTools) {
      console.log(`\n=== ${tool.toolName} - documentation update ===`)
      buildToolDocuments(tool, true, false)
      if (!dryRun) {
        const releaseLogged = appendReleaseLogRow(tool, { version, commitHash, today, commitMessage })
        const updatesLogged = appendUpdatesRow(tool, { version, commitHash, today, commitMessage })
        const stampedCount = stampPushedTasks(tool, { version, commitHash, pushedAt })
        console.log(`→ ${tool.toolName}: release log ${releaseLogged ? 'appended' : 'skipped (no marker)'}, updates row ${updatesLogged ? 'appended' : 'skipped (no marker)'}, tasks stamped ${stampedCount}.`)
      } else {
        console.log(`→ [dry-run] ${tool.toolName}: would append the release + updates rows and stamp tasks (RELEASE_SSOT_GROUPS=${process.env.RELEASE_SSOT_GROUPS || 'unset'}).`)
      }
      await generateToolDocumentation(tool, { types: context.SATELLITE_TYPES, dryRun })
      // keep the embedded code panes of docs/index.html in sync with the new code
      if (dryRun) {
        console.log(`→ [dry-run] ${tool.toolName}: would refresh the code payload in docs/index.html.`)
      } else {
        refreshToolIndexCode(tool)
      }
      // refresh the marketing screenshots used by docs/webpage.html + the
      // index viewer + help (headless Edge, sample data) - skipped in dry-run
      if (dryRun) {
        console.log(`→ [dry-run] ${tool.toolName}: would refresh docs/screenshots/ via npm run screenshots.`)
      } else {
        const { screenshotTool } = require('./capture-screenshots')
        screenshotTool(tool)
        // keep the index viewer payload in sync with the fresh captures
        refreshToolIndexScreenshots(tool)
      }
    }
  }

  // ---- 3. rebuild the SSOT control tower ----
  if (dryRun) {
    console.log(prefix + 'Would rebuild the SSOT control tower (_docs/index.html).')
  } else {
    try {
      require('./build-ssot-index').buildSsotIndex()
    } catch (indexError) {
      console.log('→ SSOT index update skipped (' + (indexError?.message || indexError) + ')')
    }
  }

  // ---- 4. commit + push the documentation updates ----
  if (dryRun) {
    console.log(prefix + 'Would run: git add _docs; git commit "docs: update tool documentation"; git push.')
  } else {
    // code was already committed above; stage everything left (the doc updates
    // live under the taxonomy roots AND under _docs) so all of it ships.
    context.runCommand('git add -A', { silent: true })
    let hasStagedDocChanges = false
    try {
      context.runCommand('git diff --cached --quiet', { silent: true })
    } catch (_e) {
      hasStagedDocChanges = true
    }
    if (hasStagedDocChanges) {
      context.runCommand('git commit -m "docs: update tool documentation"')
      context.runCommand('git push')
    } else {
      console.log('→ No documentation changes to commit.')
    }
  }

  console.log('\nRelease ' + (dryRun ? 'plan (dry run - nothing was changed)' : 'complete') + '.')
  if (!dryRun) console.log('Commit message used: ' + commitMessage)
}

if (require.main === module) {
  main().catch((releaseError) => {
    console.error('\nRelease failed:', releaseError?.message || releaseError)
    process.exit(1)
  })
}

module.exports = { main }
