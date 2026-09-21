// Unicon Studio - project document system (CODE-38)
// Implements the complete feature-document ruleset (the sitepoicms system
// definition): one SSOT working document per feature plus six derived
// satellites, a monthly digest, shared design/behavior files, and strict
// governance. Documents are generated inside the opened folder under
// _docs/ from the bundled templates (main/document-system/templates) and
// the bundled shared assets (main/document-system/assets) - regenerated
// from the canonical ruleset by scripts/extract-document-templates.js.
//
// The AI prompt gets only the COMPACT ruleset below (buildDocumentRulesBlock)
// - never the full explainer - so prompts stay small while the full rules
// document remains available to the user in the Docs overlay.

const fs = require('fs')
const path = require('path')
const projectFileService = require('./project-file-service')

const templatesDirectory = path.join(__dirname, 'document-system', 'templates')
const assetsDirectory = path.join(__dirname, 'document-system', 'assets')
const documentsFolderName = '_docs'

const sharedAssetFileNames = [
  'ssot.css', 'ssot.js',
  'onepager.css', 'onepager.js',
  'presentation.css', 'presentation.js'
]

// One entry per document type - the full registry used by the
// create_document tool. fileName(slug) returns the path under _docs/.
const documentTypeRegistry = {
  ssot: { label: 'SSOT working document', template: '_feature-template.html', fileName: (slug) => slug + '-ssot.html', cssPath: 'ssot.css', jsPath: 'ssot.js', depthFix: true },
  help: { label: 'User help page', template: '_help-template.html', fileName: () => '_help.html', cssPath: 'ssot.css', jsPath: '' },
  marketing: { label: 'Marketing webpage fragment', template: '_marketing-template.html', fileName: () => '_marketing.html', cssPath: '', jsPath: '' },
  updates: { label: 'Change log / release updates', template: '_updates-template.html', fileName: () => '_updates.html', cssPath: 'ssot.css', jsPath: '' },
  social: { label: 'Social posts + WhatsApp messages', template: '_social-template.html', fileName: () => '_social.html', cssPath: 'ssot.css', jsPath: '' },
  onepager: { label: 'Printable A4 one-pager', template: '_onepager-template.html', fileName: () => '_onepager.html', cssPath: 'onepager.css', jsPath: 'onepager.js' },
  presentation: { label: '9-slide marketing presentation', template: '_presentation-template.html', fileName: () => '_presentation.html', cssPath: 'presentation.css', jsPath: 'presentation.js' },
  monthly: { label: 'Monthly digest', template: '_monthly-template.html', fileName: () => '_monthly/' + new Date().toISOString().slice(0, 7) + '.html', cssPath: '../ssot.css', jsPath: '' }
}

function toTitleCase(nameSlug) {
  return String(nameSlug).split(/[-_]+/).filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function toDecisionPrefix(nameSlug) {
  const initials = String(nameSlug).split(/[-_]+/).filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
  return 'D-' + initials.slice(0, 4)
}

function toCssClassSlug(nameSlug) {
  return String(nameSlug).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
}

// Placeholders are replaced with split/join only (the ruleset rule: never
// regex on the template text - the text itself must never break the
// replacement).
function applyPlaceholders(templateContent, replacements) {
  let content = templateContent
  Object.keys(replacements).forEach((placeholder) => {
    content = content.split(placeholder).join(replacements[placeholder])
  })
  return content
}

function ensureSharedAssets(documentsRoot) {
  const copied = []
  sharedAssetFileNames.forEach((assetFileName) => {
    const targetPath = path.join(documentsRoot, assetFileName)
    if (fs.existsSync(targetPath)) return
    fs.copyFileSync(path.join(assetsDirectory, assetFileName), targetPath)
    copied.push(assetFileName)
  })
  return copied
}

function createDocument(projectRoot, options) {
  const type = options && options.type
  const nameSlug = String((options && options.name) || '').trim().toLowerCase()
  const typeDefinition = documentTypeRegistry[type]
  if (!typeDefinition) {
    return { ok: false, error: 'Unknown document type "' + type + '" - use one of: ' + Object.keys(documentTypeRegistry).join(', ') }
  }
  if (type !== 'monthly' && !/^[a-z0-9][a-z0-9_-]*$/.test(nameSlug)) {
    return { ok: false, error: 'Invalid feature name "' + nameSlug + '" - use lowercase letters, digits, hyphens and underscores.' }
  }

  const documentsRoot = projectFileService.resolveInsideRoot(projectRoot, documentsFolderName)
  const relativeTargetPath = documentsFolderName + '/' + typeDefinition.fileName(nameSlug)
  const targetPath = projectFileService.resolveInsideRoot(projectRoot, relativeTargetPath)
  if (fs.existsSync(targetPath)) {
    return { ok: false, error: 'Already exists: ' + relativeTargetPath + ' - the document system never overwrites existing files.' }
  }

  const featureTitle = toTitleCase(nameSlug)
  const today = new Date().toISOString().slice(0, 10)
  const replacements = {
    '[FEATURE NAME]': featureTitle,
    '[DATE]': today,
    '[CSS_CLASS]': toCssClassSlug(nameSlug),
    '[SSOT FILE]': nameSlug + '-ssot.html',
    '[CODE]': toDecisionPrefix(nameSlug),
    '[CSS_PATH]': typeDefinition.cssPath,
    '[JS_PATH]': typeDefinition.jsPath,
    '[MONTH]': today.slice(0, 7)
  }

  let content = applyPlaceholders(
    fs.readFileSync(path.join(templatesDirectory, typeDefinition.template), 'utf8'),
    replacements
  )
  if (typeDefinition.depthFix) {
    // The SSOT template sits one level shallower than generated documents;
    // generated SSOT files live NEXT to the shared assets in _docs/.
    content = content.split('href="../ssot.css"').join('href="ssot.css"')
    content = content.split('src="../ssot.js"').join('src="ssot.js"')
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  fs.writeFileSync(targetPath, content, 'utf8')
  const copiedAssets = ensureSharedAssets(documentsRoot)

  return {
    ok: true,
    path: relativeTargetPath,
    copiedAssets: copiedAssets,
    message: 'Created ' + relativeTargetPath + '. ' +
      (copiedAssets.length ? 'Shared design/behavior files copied to ' + documentsFolderName + '/. ' : '') +
      'Now fill the remaining [PLACEHOLDERS] section by section from the code and the discussion - the SSOT is the source of truth, satellites stay derived from it.'
  }
}

// ── Compact ruleset for AI prompts (CODE-38) ──────────────────────────────
// The full explainer is NOT injected into prompts - only this condensed
// operational summary. The user can open the full rules document from the
// Docs overlay (built-in entry).
const compactRulesetText = [
  'PROJECT DOCUMENT SYSTEM (rules in effect for this folder):',
  '- One SSOT working document per feature: _docs/<feature>-ssot.html with 19 numbered sections (purpose/governance, related files, existing capabilities, glossary, verified problem + root cause, requirements, option evaluation + decision, solution design, failure matrix, limitations, append-only decision register, maintenance rules, checklist, open questions, release-group task list, ideas backlog, test plan, risk + push-gate register, release log).',
  '- Six derived satellites next to the SSOT in _docs/: _help.html (user how-to), _marketing.html (publishable webpage fragment), _updates.html (changelog), _social.html (social posts + WhatsApp), _onepager.html (printable A4), _presentation.html (9-slide 16:9 deck). Monthly digest: _docs/_monthly/YYYY-MM.html.',
  '- Naming: decision IDs use a per-feature prefix (D-[CODE]-NN sequential); capabilities C-01.., ideas I-01.., risks R-01.., tasks T-01..; version + Last updated bumped on EVERY edit.',
  '- Governance: the SSOT is the single source of truth and wins every disagreement; the decision register is APPEND-ONLY (reversals are marked, never deleted); a decision that is not in the register did not happen; every code change updates the document in the same change.',
  '- Design: never inline styles or scripts - the shared files ssot.css / ssot.js / onepager.css / onepager.js / presentation.css / presentation.js live in _docs/ and every document links them.',
  '- Names must be self-explanatory; no cryptic abbreviations; acronyms expanded at every use.',
  '- Workflow: use the create_document tool to scaffold a document (it refuses to overwrite existing files), then fill the remaining placeholders section by section from the verified code and our discussion. Satellites retell the SSOT for their audience - when they disagree, the SSOT wins. Update the SSOT in the same change as every code edit and keep the satellites consistent.',
  '- PDF export rules (onepager/presentation): render with standalone html2canvas 1.4.1 (never html2pdf clone pipeline); page size exactly 297x167mm landscape with explicit pageSize; no background-clip:text, border-image or backdrop-filter in slide CSS; disable animations during capture; searchable text layer drawn with renderingMode invisible.'
].join('\n')

function buildDocumentRulesBlock(userText) {
  const lowered = String(userText || '').toLowerCase()
  const isDocumentRequest = /\b(ssot|doc|docs|document|documentation|marketing page|help page|social|presentation|onepager|monthly digest|satellite|updates)\b/.test(lowered)
  if (!isDocumentRequest) return null
  return { role: 'system', content: compactRulesetText }
}

module.exports = { createDocument, buildDocumentRulesBlock, compactRulesetText, documentTypeRegistry }
