// ── AI SATELLITE GENERATOR (npm run docs:generate) ─────────────────────────
// Regenerates the AI-written satellite documents of a tool from its code,
// its SSOT, its update history, the tool ideas catalog, the taxonomy path
// and this project's AI chat:
//   webpage.html     - marketing webpage fragment (content block only)
//   help.html        - user help document
//   presentation.html - marketing slide deck
//   social.html      - social media + WhatsApp share kit
//   updates.html     - only the Highlights section (rows come from npm run rel)
// The SSOT itself is NEVER overwritten - it is the source of truth.
//
// Usage:
//   npm run docs:generate -- <ToolName> [webpage|help|presentation|social|updates ...]
//   npm run docs:generate -- --changed     - every tool changed since the last push
//   npm run docs:generate -- --all         - every tool
//   npm run docs:generate -- <ToolName> --dry-run   - print the plan, no AI, no writes
const { readFileSync, writeFileSync, existsSync } = require('fs')
const { join } = require('path')
const context = require('./releaseContext')
const { buildToolDocuments } = require('./init-docs')

const GENERATED_START = '<!-- GENERATED-START'
const GENERATED_END = '<!-- GENERATED-END -->'
const HIGHLIGHTS_START = '<!-- GENERATED-HIGHLIGHTS-START'
const HIGHLIGHTS_END = '<!-- GENERATED-HIGHLIGHTS-END -->'
const MAX_CODE_CHARS_PER_FILE = 14000
const MAX_CODE_CHARS_TOTAL = 50000
const MAX_SSOT_CHARS = 30000
const MAX_UPDATES_CHARS = 8000
const MAX_TEMPLATE_CHARS = 24000

const GENERATION_SPECS = {
  webpage: {
    templateName: 'webpage',
    promptTitle: 'MARKETING WEBPAGE FRAGMENT',
    outputContract: [
      'Output ONLY the content block, exactly two parts in this order:',
      '1. one <style> block whose rules are ALL scoped under the .[css]-page class',
      '   (never style bare html/body/a/button tags)',
      '2. one <div class="[css]-page"> ... </div> block.',
      'Follow the template structure: full-width hero with eyebrow, headline, subheadline,',
      'two CTA buttons and trust points; a stats band overlapping the hero; a benefits',
      'grid of six cards with SVG icons; two alternating highlight rows with checklists;',
      'a three-step how-it-works; a comparison table (the usual way vs this tool); three',
      'testimonials with five stars; an FAQ with three details blocks; a final full-width',
      'CTA band. Keep every class name of the template (the [css] prefix stands for',
      'the class prefix given below). Replace every placeholder with real content.',
      'Focus on BENEFITS and outcomes that sell the product - the reader is a buyer.',
      'Do NOT output html/head/body tags, code fences, or markdown. Do NOT invent',
      'customer names - use "Customer, Role at Company" style placeholders only when',
      'a real name is unavailable.',
    ].join('\n'),
  },
  help: {
    templateName: 'help',
    promptTitle: 'USER HELP DOCUMENT',
    outputContract: [
      'Output ONLY the HTML between the GENERATED-START and GENERATED-END markers',
      'of the template below - the five sections:',
      '1. <h2 id="overview">Overview</h2> - what the tool is and who it is for',
      '2. <h2 id="before">Before you start</h2> - permissions and where to find it',
      '3. <h2 id="howto">Step by step</h2> - an ordered list of exact actions',
      '4. <h2 id="faq">Common questions</h2> - a question/answer table',
      '5. <h2 id="troubleshooting">Troubleshooting</h2> - a problem/fix table',
      'Write in plain user words - no implementation details, no decisions, no code.',
      'Do NOT output the h1, the meta paragraph, the footer, or the markers.',
      'Do NOT output code fences or markdown.',
    ].join('\n'),
  },
  presentation: {
    templateName: 'presentation',
    promptTitle: 'MARKETING PRESENTATION DECK',
    outputContract: [
      'Output ONLY the nine <section class="pres-slide"> blocks between the',
      'GENERATED-START and GENERATED-END markers of the template below, in order:',
      '01 title (class "pres-slide pres-title-slide" with kicker, h1, subtitle, 3 chips),',
      '02 problem (kicker + headline + paragraph + 3 pain points),',
      '03 solution (kicker + headline + paragraph + pres-grid-2 with 2 pres-card blocks),',
      '04 benefits (pres-grid-3 with 3 pres-card blocks),',
      '05 highlights (pres-list with 4 items),',
      '06 how it works (pres-grid-3 with 3 numbered pres-card blocks),',
      '07 numbers (pres-table with 3 metric rows),',
      '08 quote (pres-quote with cite),',
      '09 closing (class "pres-slide pres-closing" with headline, nudge and pres-btn).',
      'Keep every class name and the data-slide-number attributes of the template.',
      'Replace every placeholder with real content. Focus on BENEFITS to sell.',
      'Do NOT output the pres-root wrapper, the nav, or the markers.',
      'Do NOT output code fences or markdown.',
    ].join('\n'),
  },
  social: {
    templateName: 'social',
    promptTitle: 'SOCIAL MEDIA SHARE KIT',
    outputContract: [
      'Output ONLY the HTML between the GENERATED-START and GENERATED-END markers',
      'of the template below, with all six sections:',
      '1. WhatsApp messages - three share-cards (short / medium / long announcement),',
      '   each with a div.share-body[data-share-text] holding the message text',
      '2. Social media posts - four share-cards (X post under 280 characters,',
      '   LinkedIn post, Instagram caption, Facebook post)',
      '3. Hashtags - one share-card with data-share-text plus the .hashtags chips',
      '4. Suggested visuals - three concrete ideas (screenshot, before/after, recording)',
      '5. One-pager pitch - one share-card with data-share-text elevator pitch',
      '6. Links to use - keep the list of the other documents',
      'Keep the share-card / share-tag / share-copy structure exactly - the Copy',
      'buttons depend on data-share-text. Emojis are welcome INSIDE the share texts',
      'but never in headings. Use [link] as a placeholder for the public URL.',
      'Do NOT output the h1, meta paragraph, footer or script. No code fences.',
    ].join('\n'),
  },
  updates: {
    templateName: 'updates',
    promptTitle: 'UPDATE HIGHLIGHTS',
    outputContract: [
      'Output ONLY the HTML between the GENERATED-HIGHLIGHTS-START and',
      'GENERATED-HIGHLIGHTS-END markers of the template below: one short',
      '<p> paragraph per milestone release worth highlighting (usually the',
      'newest 1-3), each starting with the version, written for end users.',
      'When the changelog has only the initialization row, output a single',
      'friendly line saying the tool is in active development and the first',
      'user-visible release will be highlighted here.',
      'No code fences, no markdown, no headings - only the paragraphs.',
    ].join('\n'),
  },
}

function templateContent(templateName) {
  return readFileSync(join(context.TEMPLATES_DIR, '_' + templateName + '-template.html'), 'utf8')
}

function templateRegionBetween(content, startMarker, endMarker) {
  const startIndex = content.indexOf(startMarker)
  if (startIndex === -1) return ''
  const endIndex = content.indexOf(endMarker, startIndex)
  if (endIndex === -1) return ''
  return content.slice(startIndex, endIndex + endMarker.length)
}

function buildGenerationPrompt({ tool, documentType, spec, conversationContext }) {
  const allToolsEntry = context.getAllToolsEntry(tool) || {}
  const displayName = allToolsEntry.displayName || context.toDisplayName(tool.toolName)
  const cssClass = context.toKebabClass(tool.toolName)
  const partsText = tool.parts.join(', ')
  const codeContext = context.getToolCodeContext(tool, MAX_CODE_CHARS_PER_FILE, MAX_CODE_CHARS_TOTAL)
  const ssotText = context.getToolSsotText(tool, MAX_SSOT_CHARS)
  const updatesText = context.getToolUpdatesText(tool, MAX_UPDATES_CHARS)
  const taxonomyContext = context.getTaxonomyContext(tool)
  const catalogContext = context.getCatalogContext(tool)
  const template = templateContent(spec.templateName)
  const templateRegion = documentType === 'updates'
    ? templateRegionBetween(template, HIGHLIGHTS_START, HIGHLIGHTS_END)
    : documentType === 'webpage'
      ? template.slice(template.indexOf('<style>'))
      : templateRegionBetween(template, GENERATED_START, GENERATED_END)

  return [
    'You are writing the ' + spec.promptTitle + ' for "' + displayName + '",',
    'a tool of the UniconHub CMS tool store.',
    '',
    '=== TOOL IDENTITY ===',
    'Tool name: ' + tool.toolName,
    'Display name: ' + displayName,
    'Built parts: ' + partsText,
    taxonomyContext,
    'Class prefix to use in the output: ' + cssClass,
    allToolsEntry.note ? 'Index note: ' + allToolsEntry.note : '',
    '',
    '=== TOOL IDEAS CATALOG ===',
    catalogContext || '(no catalog entry)',
    '',
    '=== SSOT (single source of truth) ===',
    ssotText || '(the SSOT is still mostly empty - rely on the code below)',
    '',
    '=== UPDATE HISTORY ===',
    updatesText || '(no releases yet)',
    '',
    '=== AI CHAT ABOUT THIS PROJECT (may contain decisions and context) ===',
    conversationContext || '(not available)',
    '',
    '=== TOOL CODE ===',
    codeContext || '(no code found)',
    '',
    '=== TEMPLATE TO FOLLOW (keep its structure and class names) ===',
    templateRegion.slice(0, MAX_TEMPLATE_CHARS) || '(template region missing)',
    '',
    '=== OUTPUT CONTRACT ===',
    spec.outputContract,
    '',
    'Never invent facts that are not in these sources. When the SSOT and the',
    'code disagree, the SSOT wins. Use a hyphen "-", never an em dash.',
  ].join('\n')
}

function stripCodeFences(text) {
  return String(text || '')
    .replace(/^```[a-zA-Z]*\s*\n?/m, '')
    .replace(/\n?```\s*$/m, '')
    .trim()
}

function spliceRegion(documentContent, startMarker, endMarker, newContent) {
  const startIndex = documentContent.indexOf(startMarker)
  if (startIndex === -1) return documentContent
  const endIndex = documentContent.indexOf(endMarker, startIndex)
  if (endIndex === -1) return documentContent
  const startMarkerEnd = documentContent.indexOf('-->', startIndex) + 3
  const before = documentContent.slice(0, startMarkerEnd)
  const after = documentContent.slice(endIndex)
  return before + '\n' + newContent + '\n' + after
}

function spliceWebpage(previousContent, newContent) {
  const headerCommentEnd = previousContent.indexOf('-->') + 3
  if (headerCommentEnd <= 3) return newContent
  return previousContent.slice(0, headerCommentEnd) + '\n' + newContent + '\n'
}

async function generateToolDocumentation(tool, { types = context.SATELLITE_TYPES, dryRun = false, sinceTime = '' } = {}) {
  const log = (message) => console.log(message)
  log(`\n=== ${tool.toolName} (${tool.parts.join(', ')}) ===`)
  // Make sure the docs folder and all six files exist first.
  buildToolDocuments(tool, true, false)

  const allToolsEntry = context.getAllToolsEntry(tool) || {}
  const displayName = allToolsEntry.displayName || context.toDisplayName(tool.toolName)
  const cssClass = context.toKebabClass(tool.toolName)

  // The conversation context is the same for all types of one tool.
  let conversationContext = ''
  if (!dryRun) {
    conversationContext = context.getConversationContext({ sinceTime, maxChars: 12000 })
  }

  for (const documentType of types) {
    const spec = GENERATION_SPECS[documentType]
    if (!spec) {
      console.log(`→ ${documentType}: unknown type, skipped`)
      continue
    }
    const outputPath = join(tool.docsDirectory, context.SATELLITE_FILES[documentType])
    let currentContent = ''
    try { currentContent = readFileSync(outputPath, 'utf8') } catch (_e) { /* keep empty */ }
    const prompt = buildGenerationPrompt({ tool, documentType, spec, conversationContext, displayName, cssClass })

    if (dryRun) {
      console.log(`→ [dry-run] ${documentType}: would regenerate ${context.SATELLITE_FILES[documentType]} (prompt ${prompt.length} chars)`)
      continue
    }

    console.log(`→ ${documentType}: asking the AI...`)
    let aiOutput = ''
    try {
      aiOutput = stripCodeFences(await context.getAiResponse(prompt))
    } catch (aiError) {
      console.log(`→ ${documentType}: AI failed (${aiError?.message || aiError}) - kept the current file.`)
      continue
    }
    if (!aiOutput) {
      console.log(`→ ${documentType}: AI returned nothing - kept the current file.`)
      continue
    }

    let newContent
    if (documentType === 'webpage') {
      newContent = spliceWebpage(currentContent || templateContent('webpage'), aiOutput)
    } else if (documentType === 'updates') {
      newContent = spliceRegion(currentContent, HIGHLIGHTS_START, HIGHLIGHTS_END, aiOutput)
    } else {
      newContent = spliceRegion(currentContent, GENERATED_START, GENERATED_END, aiOutput)
    }
    if (!newContent) continue
    writeFileSync(outputPath, newContent, 'utf8')
    console.log(`→ ${documentType}: written to ${outputPath}`)
  }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const allTools = args.includes('--all')
  const changedOnly = args.includes('--changed')
  const typeArgs = args.filter((arg) => context.SATELLITE_TYPES.includes(arg))
  const types = typeArgs.length ? typeArgs : context.SATELLITE_TYPES
  const toolArg = args.find((arg) => !arg.startsWith('--') && !context.SATELLITE_TYPES.includes(arg))

  let tools = []
  if (allTools) {
    tools = context.listToolParts()
  } else if (changedOnly) {
    const pushedCommit = context.getPushedCommit()
    tools = context.getChangedToolsSince(pushedCommit)
    if (tools.length === 0) {
      console.log('→ No tool changed since the last push.')
      return
    }
  } else if (toolArg) {
    const tool = context.findToolByName(toolArg)
    if (!tool) {
      console.error('Tool not found: ' + toolArg)
      process.exit(1)
    }
    tools = [tool]
  } else {
    console.error('Usage: npm run docs:generate -- <ToolName> [types] | --changed | --all [--dry-run]')
    process.exit(1)
  }

  const sinceTime = context.getLastPushTime()
  for (const tool of tools) {
    await generateToolDocumentation(tool, { types, dryRun, sinceTime })
  }
  console.log(dryRun
    ? '\nDry run finished - nothing was written.'
    : '\nDocumentation generation finished.')
}

if (require.main === module) {
  main().catch((generationError) => {
    console.error('\nGeneration failed:', generationError?.message || generationError)
    process.exit(1)
  })
}

module.exports = { generateToolDocumentation, GENERATION_SPECS }
