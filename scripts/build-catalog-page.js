// ── CATALOG DATA BUILDER (npm run catalog:build) ──────────────────────────
// Regenerates UNICON-TOOLS/tools-catalog/catalog-data.js from the
// MANUAL region of catalog-data.js (the single source of truth, edited
// via AI conversation) + a live repo scan. Also re-exports the three
// JSON files consumed outside the page:
//   tool-ideas-catalog.json       (re-sync / release consumers)
//   folder-hierarchy-import.json  (CMS import + re-sync)
//   tool-publish-state.json       (publish consumers)
// Structure of catalog-data.js:
//   MANUAL-DATA-START .. END    - PRESERVED verbatim by this script:
//       var IDEA_GROUPS, var FOLDER_HIERARCHY, var REPO_PUBLISH_STATE
//   GENERATED-DATA-START .. END - rewritten by this script:
//       var IDEA_TOOLS (repo scan), var CATALOG_BUILT_AT
// On the first run (no manual region yet) the manual region is seeded
// from the existing JSON files; from then on the JSON files are just
// generated outputs of the manual region.
//
// Usage: npm run catalog:build
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const ROOT = path.join(__dirname, '..')
const TOOLS_CATALOG = path.join(ROOT, 'UNICON-TOOLS/tools-catalog')

// tool folder name -> { idea: exact idea name, code: subcategory code }
const TOOL_IDEA_MAP = {
  AIChatPresentationBuilder: { idea: 'AI Chat Presentation Builder', code: 'B-G-01-b' },
  AILegalFormattedDocumentBuilder: { idea: 'AI Legal Document Builder', code: 'B-G-01-b' },
  NewsGenerator: { idea: 'AI News Article Generator', code: 'B-G-01-b' },
  VibeCodingHTMLAppBuilder: { idea: 'Vibe Coding HTML App Builder', code: 'B-G-01-b' },
  WebpageBuilder: { idea: 'Webpage Builder Studio', code: 'B-G-01-b' },
  InvoiceAndExpenseCollector: { idea: 'Invoice & Expense Collector', code: 'B-G-02-a' },
  PaymentsManagement: { idea: 'Payments Management Console', code: 'B-G-02-c' },
  BrandSetGenerator: { idea: 'Brand Set Generator', code: 'B-G-04-f' },
  InterviewManager: { idea: 'Interview Scorecard Kit', code: 'B-G-07-a' },
  EmploymentAgreementBuilder: { idea: 'Employment Agreement Builder', code: 'B-G-07-b' },
  SummerJobs_StaffHandbook: { idea: 'New Hire Onboarding Hub', code: 'B-G-07-b' },
  EmployeeDataCollection: { idea: 'Employee File Cabinet', code: 'B-G-07-c' },
  DailySupervisionLogs: { idea: 'Crew Task & Handover Log', code: 'B-G-07-e' },
  EmployeeDailyLogs: { idea: 'Employee Daily Log Book', code: 'B-G-07-e' },
  StaffPermitManagement: { idea: 'Leave & Permit Desk', code: 'B-G-07-f' },
  StaffTrainingVerification: { idea: 'Training Cert Tracker', code: 'B-G-07-g' },
  WeeklyMentorshipLogs: { idea: '1:1 Meeting & Goal Tracker', code: 'B-G-07-h' },
  IncidentAccidentReportForm: { idea: 'Incident & Accident Reports', code: 'B-G-07-i' },
  SprintTaskManager: { idea: 'Sprint Task Manager', code: 'B-G-08-b' },
  RecurringTaskManager: { idea: 'Recurring Task Manager', code: 'B-G-08-c' },
  HierarchyItemChecklistManager: { idea: 'SOP Builder & Checklist Runner', code: 'B-G-08-d' },
  Matchmaking: { idea: 'Skill-based Shift Matcher', code: 'B-G-08-e' },
  CompanyProfile: { idea: 'Company Profile Builder', code: 'B-G-09-c' },
  AISystemDesign: { idea: 'AI System Design Studio', code: 'B-G-11-e' },
  HTMLContentEditorAndViewer: { idea: 'HTML Content Editor & Viewer', code: 'B-G-11-f' },
  ImageEditingTools: { idea: 'Image Editing Toolkit', code: 'B-G-12-a' },
  HtmlBulkTranslator: { idea: 'HTML Bulk Translator', code: 'B-G-13-b' },
  AttendanceChecker: { idea: 'Class Attendance Checker', code: 'B-V-01-a' },
  EducationProgramPresentation: { idea: 'Education Program Presentation Builder', code: 'B-V-01-a' },
  EducationProgramPresentation2: { idea: 'Interactive Program Showcase', code: 'B-V-01-a' },
  StudentFileBuilderForApplications: { idea: 'Student Application File Builder', code: 'B-V-01-b' },
  BloomLearnManager: { idea: 'Bloom Learning Manager', code: 'B-V-01-c' },
  CurriculumBuilder: { idea: 'Curriculum Builder', code: 'B-V-01-c' },
  EssaySubjectBuilder: { idea: 'Essay Subject Builder', code: 'B-V-01-c' },
  EssayWritingEducator: { idea: 'AI Essay Writing Evaluator', code: 'B-V-01-c' },
  SelfPacedEducationBySection: { idea: 'Self-Paced Education Tracker', code: 'B-V-01-c' },
  RestaurantAndMenuManager: { idea: 'Restaurant Menu & Content Manager', code: 'B-V-02-a' },
  RestaurantDeliveryZones: { idea: 'Delivery Zone Mapper', code: 'B-V-02-a' },
  RestaurantMenuManagement: { idea: 'Menu Engineering & Allergy Matrix', code: 'B-V-02-a' },
  RestaurantSettings: { idea: 'Restaurant Operations Console', code: 'B-V-02-a' },
  FundraisingCampaingManager: { idea: 'Fundraising Campaign Manager', code: 'B-V-04-a' },
  'GrantPlanner-v1-delete': { idea: 'Grant Impact Reporter', code: 'B-V-04-b' },
  GrantWorkflowManager: { idea: 'Grant Workflow Manager', code: 'B-V-04-b' },
  PledgeAndDonationTracker: { idea: 'Recurring Giving Manager', code: 'B-V-04-c' },
  VolunteerManagement: { idea: 'Volunteer Hour Tracker & Awards', code: 'B-V-04-d' },
  BusCompanyWorkOrder: { idea: 'Bus Company Work Orders', code: 'B-V-07-a' },
  WarehouseManager: { idea: 'Warehouse Manager', code: 'B-V-07-b' },
  AIBlindsConsultation: { idea: 'AI Blinds Consultation', code: 'B-V-11-d' },
  PersonalTaxPreparation: { idea: 'Personal Tax Preparation', code: 'P-G-01-b' },
  TravelPlanner: { idea: 'Travel Planner', code: 'P-V-01-a' },
}

// ---- find tool folders by walking the taxonomy (roots carry dynamic names) ----
const rootDirs = fs.readdirSync(ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^(BUSINESS|PERSONAL)_/.test(entry.name))
  .map((entry) => entry.name)

const toolLocations = {}
function walkTools(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    if (!entry.isDirectory()) return
    const full = path.join(dir, entry.name)
    const children = fs.readdirSync(full, { withFileTypes: true })
    const isTool = children.some((child) => child.isDirectory() && (child.name === 'app' || child.name === 'listing' || child.name === 'reporting'))
    if (isTool) {
      toolLocations[entry.name] = full
      return
    }
    walkTools(full)
  })
}
rootDirs.forEach((branch) => walkTools(path.join(ROOT, branch)))

// ---- build IDEA_GROUPS from the JSON sources (used ONLY to seed the
// manual region on the very first run) ----
function buildGroupsFromJson(catalog, tax) {
const groups = []
tax.folders.forEach((root) => {
  const group = { key: root.code + '-' + root.children[0].code.toLowerCase(), label: root.name + ' / ' + root.children[0].name, categories: [] }
  root.children.forEach((type) => {
    type.children.forEach((cat) => {
      const catEntry = { key: cat.code, label: cat.name, ideas: [] }
      cat.children.forEach((sub) => {
        catalog.ideas.forEach((idea) => {
          if (idea.code !== sub.code) return
          catEntry.ideas.push({
            id: '',   // filled below with code + suffix
            code: sub.code,
            name: idea.name,
            purpose: idea.purpose,
            users: idea.users,
            tam: idea.tam,
            sam: idea.sam,
            som: idea.som,
            licensing: idea.licensing,
            sub: sub.name,
          })
        })
      })
      // idea ids: first idea of a subcategory gets the code, later ones get
      // code-N (stable order = catalog order)
      const counts = {}
      catEntry.ideas.forEach((idea) => {
        counts[idea.code] = (counts[idea.code] || 0) + 1
        idea.id = counts[idea.code] === 1 ? idea.code : idea.code + '-' + counts[idea.code]
      })
      if (catEntry.ideas.length) group.categories.push(catEntry)
    })
  })
  groups.push(group)
})
// business groups first, then personal (same as the JSON order)
groups.sort((a, b) => (a.key.charAt(0) === 'B' ? -1 : 1) - (b.key.charAt(0) === 'B' ? -1 : 1))
// restore original order for groups of the same branch
const ordered = []
tax.folders.forEach((root) => {
  const key = root.code + '-' + root.children[0].code.toLowerCase()
  const found = groups.find((group) => group.key === key)
  if (found) ordered.push(found)
})
groups.length = 0
ordered.forEach((group) => groups.push(group))
return groups
}

// ---- load the manual region (SSOT) from catalog-data.js ----
const catalogDataPath = path.join(TOOLS_CATALOG, 'catalog-data.js')
const MANUAL_START = '// ===== MANUAL-DATA-START ====='
const MANUAL_END = '// ===== MANUAL-DATA-END ====='
const GENERATED_START = '// ===== GENERATED-DATA-START ====='
const GENERATED_END = '// ===== GENERATED-DATA-END ====='
const existingData = fs.existsSync(catalogDataPath) ? fs.readFileSync(catalogDataPath, 'utf8') : ''
let manualText = ''
const mStart = existingData.indexOf(MANUAL_START)
const mEnd = existingData.indexOf(MANUAL_END)
if (mStart !== -1 && mEnd !== -1 && mEnd > mStart) {
  manualText = existingData.slice(mStart, mEnd + MANUAL_END.length)
} else {
  // seed the manual region from the existing JSON files (first run)
  const ideasJsonPath = path.join(TOOLS_CATALOG, 'tool-ideas-catalog.json')
  const hierarchyJsonPath = path.join(TOOLS_CATALOG, 'folder-hierarchy-import.json')
  const publishJsonPath = path.join(TOOLS_CATALOG, 'tool-publish-state.json')
  const seedCatalog = fs.existsSync(ideasJsonPath) ? JSON.parse(fs.readFileSync(ideasJsonPath, 'utf8')) : null
  const seedTax = fs.existsSync(hierarchyJsonPath) ? JSON.parse(fs.readFileSync(hierarchyJsonPath, 'utf8')) : null
  const seedPublish = fs.existsSync(publishJsonPath) ? JSON.parse(fs.readFileSync(publishJsonPath, 'utf8')) : null
  manualText = MANUAL_START + '\n' +
    '// SSOT - edit via AI conversation. npm run catalog:build PRESERVES this region verbatim.\n' +
    'var IDEA_GROUPS = ' + JSON.stringify(seedCatalog && seedTax ? buildGroupsFromJson(seedCatalog, seedTax) : []) + ';\n' +
    'var FOLDER_HIERARCHY = ' + JSON.stringify(seedTax || {}) + ';\n' +
    'var REPO_PUBLISH_STATE = ' + JSON.stringify(seedPublish || null) + ';\n' +
    MANUAL_END + '\n'
}
const sandbox = {}
vm.runInNewContext(
  manualText.replace(MANUAL_START, '').replace(MANUAL_END, '') +
  '\n__catalogResult = { groups: (typeof IDEA_GROUPS === "undefined" ? [] : IDEA_GROUPS), hierarchy: (typeof FOLDER_HIERARCHY === "undefined" ? null : FOLDER_HIERARCHY), publish: (typeof REPO_PUBLISH_STATE === "undefined" ? null : REPO_PUBLISH_STATE) };',
  sandbox
)
const manual = sandbox.__catalogResult || { groups: [], hierarchy: null, publish: null }
const allIdeaEntries = []
manual.groups.forEach((g) => g.categories.forEach((c) => c.ideas.forEach((i) => allIdeaEntries.push(i))))

// ---- scan the built tools ----
const ideaTools = {}
Object.keys(TOOL_IDEA_MAP).forEach((folderName) => {
  const mapping = TOOL_IDEA_MAP[folderName]
  const idea = allIdeaEntries.find((entry) => entry.code === mapping.code && entry.name === mapping.idea)
  if (!idea) { console.log('! idea not found for tool ' + folderName + ': ' + mapping.idea); return }
  // idea id: same derivation as IDEA_GROUPS
  const siblings = allIdeaEntries.filter((entry) => entry.code === mapping.code)
  const ideaIndex = siblings.indexOf(idea)
  const ideaId = ideaIndex === 0 ? mapping.code : mapping.code + '-' + (ideaIndex + 1)

  const toolDir = toolLocations[folderName]
  if (!toolDir) { console.log('! tool folder not found: ' + folderName); return }
  const parts = fs.readdirSync(toolDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && (entry.name === 'app' || entry.name === 'listing' || entry.name === 'reporting'))
    .map((entry) => entry.name)

  const files = []
  let modifiedAt = ''
  parts.forEach((partName) => {
    fs.readdirSync(path.join(toolDir, partName), { withFileTypes: true }).forEach((entry) => {
      if (!entry.isFile()) return
      const filePath = path.join(toolDir, partName, entry.name)
      const stat = fs.statSync(filePath)
      files.push({ name: partName + '/' + entry.name, bytes: stat.size })
      if (!modifiedAt || stat.mtime.toISOString() > modifiedAt) modifiedAt = stat.mtime.toISOString()
    })
  })

  const docsDir = path.join(toolDir, 'docs')
  const DOCS_CANONICAL = ['index.html', 'ssot.html', 'webpage.html', 'help.html', 'presentation.html', 'updates.html', 'social.html']
  const docsList = DOCS_CANONICAL.filter((name) => fs.existsSync(path.join(docsDir, name)))
  const docsCount = docsList.length
  const shotsDir = path.join(docsDir, 'screenshots')
  let screenshots = 0
  if (fs.existsSync(shotsDir)) {
    screenshots = fs.readdirSync(shotsDir).filter((name) => /\.png$/i.test(name)).length
  }
  const harness = fs.existsSync(path.join(toolDir, 'app', 'test-harness.html'))

  ideaTools[ideaId] = {
    folder: folderName,
    path: path.relative(ROOT, toolDir).replace(/\\/g, '/'),
    parts,
    files,
    docsCount,
    docsTotal: 7,
    docsList,
    screenshots,
    harness,
    modifiedAt,
  }
})

// ---- write catalog-data.js (manual region preserved verbatim) ----
const builtAt = new Date().toISOString()
const generatedText = GENERATED_START + '\n' +
  '// npm run catalog:build rewrites ONLY this region (repo scan). Do not edit by hand.\n' +
  'var IDEA_TOOLS = ' + JSON.stringify(ideaTools) + ';\n' +
  'var CATALOG_BUILT_AT = ' + JSON.stringify(builtAt) + ';\n' +
  GENERATED_END + '\n'
const dataText = '// GENERATED FILE - npm run catalog:build rewrites this file.\n' +
  '// Single source of truth for the catalog page: the MANUAL region is edited\n' +
  '// via AI conversation (ideas, hierarchy, publish state); the GENERATED region\n' +
  '// is the live repo scan. The JSON files in this folder are exported copies.\n' +
  manualText + '\n' + generatedText
fs.writeFileSync(catalogDataPath, dataText, 'utf8')

// ---- re-export the three JSON files consumed outside the page ----
if (manual.hierarchy) {
  fs.writeFileSync(path.join(TOOLS_CATALOG, 'folder-hierarchy-import.json'), JSON.stringify(manual.hierarchy, null, 2) + '\n', 'utf8')
}
if (manual.publish) {
  fs.writeFileSync(path.join(TOOLS_CATALOG, 'tool-publish-state.json'), JSON.stringify(manual.publish, null, 2) + '\n', 'utf8')
}
const codePath = {}
;(function indexNode(node, ancestors) {
  codePath[node.code] = ancestors.concat([node.name]).join(' > ')
  ;(node.children || []).forEach((child) => indexNode(child, ancestors.concat([node.name])))
})(manual.hierarchy, [])
const ideasOut = []
manual.groups.forEach((g) => g.categories.forEach((c) => c.ideas.forEach((idea) => {
  const entry = {
    code: idea.code,
    folder: codePath[idea.code] || idea.code,
    name: idea.name,
    purpose: idea.purpose,
    users: idea.users,
    tam: idea.tam,
    sam: idea.sam,
    som: idea.som,
    licensing: idea.licensing,
  }
  if (idea.id !== idea.code) entry.id = idea.id
  ideasOut.push(entry)
})))
const ideasJson = {
  schema: 'uniconhub-tool-idea-catalog',
  version: '1.0.0',
  generatedAt: builtAt.slice(0, 10),
  disclaimer: 'Directional planning estimates (order of magnitude), not market research. Validate user counts, TAM/SAM/SOM and licensing per idea before development.',
  licensingTypes: ['freemium', 'subscription-monthly', 'subscription-annual', 'one-time', 'per-seat-monthly', 'usage-based', 'white-label', 'app-bundle'],
  metricNotes: {
    users: 'Rough worldwide count of potential users or organizations for this niche.',
    tam: 'Estimated global annual software spend (USD) for this niche - order of magnitude.',
    sam: 'TAM narrowed to the SMB / reachable segment UniconHub can realistically serve (about 10-25 percent).',
    som: 'What the UniconHub store could realistically capture within about 3 years (about 0.1-0.5 percent of SAM).'
  },
  generatedNote: 'GENERATED from catalog-data.js by npm run catalog:build - do not edit by hand.',
  ideas: ideasOut
}
fs.writeFileSync(path.join(TOOLS_CATALOG, 'tool-ideas-catalog.json'), JSON.stringify(ideasJson, null, 2) + '\n', 'utf8')

const ideaCount = manual.groups.reduce((sum, group) => sum + group.categories.reduce((csum, cat) => csum + cat.ideas.length, 0), 0)
console.log('catalog-data.js updated: ' + manual.groups.length + ' groups, ' + ideaCount + ' ideas, ' + Object.keys(ideaTools).length + ' built tools mapped. JSON exports refreshed.')
