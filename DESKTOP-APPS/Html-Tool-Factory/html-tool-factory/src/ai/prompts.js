'use strict'

// Prompt builders. Rules for every prompt:
//   1. Fixed, short system message.
//   2. Only the slice of the specification the stage needs.
//   3. The exact JSON contract, with limits on every array.
//   4. A machine context trailer (used by the mock provider and for tracing).
// Keeping output arrays bounded is the main lever on output tokens.

const { buildDigest } = require('../ssot/model')
const { toolCatalogText } = require('./tools')
const { truncateMiddle, truncateTail } = require('../util')

const SYSTEM_BASE = [
  'You are a senior product engineer and technical writer working inside an autonomous build loop.',
  'Answer with ONE JSON object and nothing else: no prose, no markdown fences, no comments.',
  'Be concrete and short. Never invent facts about the business; state an assumption instead.',
  'Never put secrets, keys or personal data in the output.'
].join(' ')

function contextTrailer(stage, extraLines) {
  const lines = ['@@STAGE:' + stage + '@@']
  ;(extraLines || []).forEach((line) => {
    if (line) lines.push(line)
  })
  lines.push('Machine context tags above are for the build tooling. Do not mention them in the JSON.')
  return lines.join('\n')
}

const SECURITY_DEFAULTS = [
  'Deny by default: every write checks identity and ownership.',
  'Validate and normalise input at the boundary; reject unknown or oversized fields.',
  'Never put secrets, tokens or personal data in code, the client bundle, or logs.',
  'Never rely on client side checks for authorisation.',
  'Escape all output; treat user and model text as untrusted.',
  'Bound list sizes, string lengths and uploads; rate limit anything public.',
  'Destructive actions need an explicit confirmation step and an undo path where possible.',
  'Prefer the platform services that already exist over adding new infrastructure.'
].join('\n- ')

function ideaLine(idea) {
  return '"' + idea.name + '" - ' + (idea.purpose || 'no purpose recorded') +
    (idea.category ? ' (category: ' + idea.category + ')' : '')
}

function researchPrompt(request) {
  const idea = request.idea
  const industryFocus = request.industryFocus ? '\nOperator focus: ' + request.industryFocus : ''
  const knowledge = request.knowledge ? '\n' + request.knowledge + '\n' : ''
  const user = [
    'STAGE 1 - FIRST SPECIFICATION.',
    'Idea: ' + ideaLine(idea),
    '',
    'Review how the best products in this industry solve this problem today, then define the',
    'complete product a professional would expect from a tool with this name - the whole job,',
    'not a demo of it. One screen, but every step of the job on that screen.',
    industryFocus.trim(),
    knowledge,
    'DEPTH RULES:',
    '- The deliverable is plain HTML, CSS and JavaScript in three files. Never React, Next, Vue,',
    '  Svelte, TypeScript, JSX, a bundler, a package.json or any build step.',
    '- A feature is only listed when you can name the user action and the visible result.',
    '- The product must cover the full working loop: get the data in, work on it, see the result,',
    '  keep it, take it out. A tool that only shows one output is not finished.',
    '- Expect 5 to 8 must-have features. Never pad with vague features and never stop at two.',
    '- The tool runs as three files in the browser with an AI helper: no server, no database,',
    '  no accounts. Design inside that boundary.',
    '',
    'SPEC SHEET (be concrete: rules, fields, formats, wording, not adjectives):',
    '- problem = the current painful workflow, in the words the user would use.',
    '- solution = what the tool does, step by step.',
    '- audience = who exactly, how often, on what device.',
    '- technology = the three files plus which platform SDK calls the tool needs.',
    '',
    'Return JSON with this exact shape:',
    '{',
    '  "definition": {',
    '    "summary": "3 to 5 sentences: what this tool IS, in plain language. Name the user, the job and the outcome.",',
    '    "jobs": ["the concrete jobs the user hires this tool for, one line each, 4 to 8"],',
    '    "screens": ["the areas of the single screen: name + what the user does there"],',
    '    "data": ["the records and fields the tool owns, with their type and example"],',
    '    "rules": ["decision rules: validation, defaults, calculations, ordering, permissions"],',
    '    "outOfScope": ["what this tool explicitly does NOT do in version 1"],',
    '    "success": ["observable outcomes that prove the tool works, one line each"]',
    '  },',
    '  "product": {',
    '    "name": "string",',
    '    "tagline": "one short line",',
    '    "problem": "2 sentences max",',
    '    "solution": "2 sentences max",',
    '    "audience": "who exactly",',
    '    "marketNotes": "2 sentences on the market and why this can win",',
    '    "competitors": [{"name": "", "strength": "", "weakness": ""}],',
    '    "differentiators": ["3 short lines"],',
    '    "technology": ["stack decisions, e.g. plain HTML/CSS/JS, local JSON document"]',
    '  },',
    '  "features": [{"title": "", "description": "one line", "priority": "must|should|could"}],',
    '  "decisions": [{"text": "", "rationale": "one line"}],',
    '  "questions": [{"text": "", "assumption": "the safe default you would pick"}],',
    '  "risks": [{"severity": "high|medium|low", "text": "", "mitigation": "one line"}]',
    '}',
    '',
    'Limits: 3 competitors, max 8 features (at least 2 must), max 6 decisions, max 5 questions, max 5 risks.',
    'Questions must only cover things a reasonable engineer cannot decide alone.',
    '',
    'DEFINITION RULES:',
    '- The definition is written FIRST and it is what the build follows. Be specific, never generic.',
    '- jobs = what the user wants to get done, not features. One job can need several features.',
    '- data = the exact records the tool keeps; say which are typed by the user, computed, or fetched.',
    '- rules = the logic that makes the output correct: required fields, number formats, ordering, caps.',
    '- outOfScope = the things a naive build would add and this tool must not. At least 3 lines.',
    '- success = how a reviewer checks the tool in one minute, without reading code.',
    '',
    contextTrailer('research-ssot', ['@@IDEA:' + idea.name.replace(/@@/g, '') + '@@'])
  ].join('\n')
  return { system: SYSTEM_BASE, user }
}

function folderLayoutBlock(toolName, prefix) {
  const name = toolName || 'TheTool'
  const p = prefix || 'tl-'
  return [
    'HTML TOOL CONTRACT (html-tool-rules.txt) - breaking any line fails the task:',
    '- The tool is exactly three files plus one harness, and nothing else:',
    '  app/' + name + '.html  body markup fragment only',
    '  app/' + name + '.css   rules only',
    '  app/' + name + '.js    logic only',
    '  app/test-harness.html  local preview page with a mock tool SDK',
    '- Never create app/index.html, app/src/**, *.jsx, *.tsx, *.ts, *.vue, *.svelte, a package.json or any build step.',
    '- No framework, no bundler, no npm and no CDN: no https:// or http:// anywhere in the files.',
    '- The first line of every file is its build comment: "<!-- html build YYYY-MM-DD-N -->",',
    '  "/* css build YYYY-MM-DD-N */", "/* js build YYYY-MM-DD-N */". Keep it and raise N when you change the file.',
    '- app/*.html has no <!DOCTYPE>, <html>, <head>, <body>, <link>, <style> or <script>. It is a fragment.',
    '- app/*.html keeps an element with data-tool-build="<stamp>" so the visible build badge is correct.',
    '- app/*.js has no <script> tag, no DOMContentLoaded, no localStorage, no fetch, no XMLHttpRequest,',
    '  no alert, no import/export, no require and no eval. Entry point is tool.onReady(function (value) { ... }).',
    '- app/*.js declares var TOOL_BUILD = \'YYYY-MM-DD-N\', logs console.log(\'[TOOL:BOOT] build \' + TOOL_BUILD),',
    '  calls tool.declareParams for its inputs and tool.reportMissingParams when a required input is empty.',
    '- AI work goes through tool.requestAI({ prompt, schema }) and must handle a rejected promise.',
    '  Never call a network endpoint, never store data in the browser storage.',
    '- Every class and id you add starts with ' + p + ' and stays unique inside the tool.',
    '- Keep the markup usable without JavaScript: a visible status line instead of alert().',
    '- Never write docs/ssot.html: the factory generates the documentation.',
    '- Edits are additive and safe: keep ids that earlier tasks and the harness rely on.',
    '- Class prefix for new markup and CSS: ' + p
  ].join('\n')
}

function planTasksPrompt(request) {
  const ssot = request.ssot
  const iteration = request.iteration
  const codemap = request.codemap || ''
  const existingTitles = ssot.tasks.slice(-12).map((task) => task.id + ' [' + task.status + '] ' + task.title).join('\n')
  const lastIterations = ssot.iterations.slice(-2).map((entry) => {
    return 'Iteration ' + entry.n + ': ' + (entry.summary || '')
  }).join('\n')
  const failing = request.failingChecks || []
  const knowledge = request.knowledge ? request.knowledge + '\n' : ''
  const checklist = request.openChecklist || []
  const checklistBlock = checklist.length
    ? 'DEPTH CHECKLIST ITEMS STILL MISSING (each one needs a task):\n' +
      checklist.map((item) => item.id + ' ' + item.title + ' - ' + item.detail).join('\n')
    : 'DEPTH CHECKLIST: every item is already covered.'

  const user = [
    'STAGE 3a - TASK LIST.',
    'Turn the specification into the next batch of build tasks. This is iteration ' + iteration + '.',
    'A task must deliver a visible capability a user can exercise, not a rename or a comment.',
    '',
    buildDigest(ssot, { maxTasks: 8 }),
    '',
    checklistBlock,
    '',
    'PLANNED IMPROVEMENT IDEAS (turn these into tasks where they matter):',
    ssot.ideas.filter((idea) => idea.status === 'planned').slice(0, 4)
      .map((idea) => idea.id + ' ' + idea.title + ' - ' + (idea.why || '')).join('\n') || '(none)',
    '',
    knowledge,
    'EXISTING TASKS (do not repeat these titles):',
    existingTitles || '(none)',
    '',
    lastIterations ? 'LAST ITERATIONS:\n' + lastIterations : '',
    failing.length ? 'FAILING CHECKS THAT MUST BE FIXED FIRST:\n' + failing.map((check) => check.name + ': ' + check.detail).join('\n') : '',
    '',
    'CURRENT APPLICATION FILES:',
    codemap,
    '',
    folderLayoutBlock(request.toolName, request.toolPrefix),
    '',
    'Return JSON:',
    '{ "tasks": [ { "title": "imperative and specific", "kind": "code|doc|test|chore",',
    '  "files": ["relative/path.ext"], "acceptance": ["verifiable statement"] } ], "notes": "one line" }',
    '',
    'Rules:',
    '- Max ' + (request.maxTasks || 4) + ' tasks. Each task touches at most 4 files.',
    '- Plan the missing depth checklist items first, then the features that are still pending.',
    '- One task = one reviewable change that leaves the tool usable. A task may rewrite a whole file.',
    '- No task may depend on a file that no other task creates first unless it creates that file itself.',
    '- Paths are relative to the tool folder and must be one of app/' + (request.toolName || 'TheTool') +
      '.html, app/' + (request.toolName || 'TheTool') + '.css, app/' + (request.toolName || 'TheTool') +
      '.js or app/test-harness.html.',
    '- Write the user visible wording (labels, button text, empty and error messages) inside the task.',
    '- Acceptance statements must be checkable without human judgement.',
    '- If a check is failing, the first task must fix it.',
    '',
    contextTrailer('plan-tasks', [
      '@@ITERATION:' + iteration + '@@',
      '@@TOOLNAME:' + String(request.toolName || 'TheTool').replace(/@@/g, '') + '@@',
      failing.length ? '@@FAILED_TESTS:' + String(failing[0].name || '').replace(/@@/g, '').slice(0, 60) + '@@' : ''
    ])
  ].filter(Boolean).join('\n')
  return { system: SYSTEM_BASE, user }
}

function riskReviewPrompt(request) {
  const ssot = request.ssot
  const codemap = request.codemap || ''
  const user = [
    'STAGE 3b - RISK AND QUESTION REVIEW.',
    'Review the specification as a sceptical reviewer. Find what will break, what is unsafe,',
    'and what is still unknown. Do not solve them yet - only name them precisely.',
    '',
    buildDigest(ssot, { includeTasks: false }),
    '',
    'CURRENT APPLICATION FILES:',
    codemap,
    '',
    'Return JSON:',
    '{ "risks": [{"severity": "high|medium|low", "text": "the concrete failure", "mitigation": "one line"}],',
    '  "questions": [{"text": "", "assumption": "the safe default", "recommendedAnswer": ""}],',
    '  "notes": "one line" }',
    '',
    'Limits: max 5 risks, max 4 questions. Only list a risk if it can actually happen in this product.',
    'Only list a question if a reasonable engineer could not decide it alone.',
    'Never repeat a risk or question that is already in the specification.',
    '',
    contextTrailer('risk-review', ['@@QUESTION_COUNT:' + ssot.questions.length + '@@'])
  ].join('\n')
  return { system: SYSTEM_BASE, user }
}

function resolveRisksPrompt(request) {
  const ssot = request.ssot
  const openRiskList = ssot.risks.filter((risk) => risk.status !== 'mitigated' && risk.status !== 'accepted')
  const openQuestionList = ssot.questions.filter((question) => question.status !== 'answered')

  const user = [
    'STAGE 3c - RESOLVE.',
    'Answer every open question with the safest sensible default and turn each open risk into',
    'a decision plus, optionally, a build task. Do not ask anything back.',
    '',
    buildDigest(ssot, { includeTasks: false }),
    '',
    'OPEN RISKS:',
    openRiskList.map((risk) => risk.id + ' [' + risk.severity + '] ' + risk.text).join('\n') || '(none)',
    '',
    'OPEN QUESTIONS:',
    openQuestionList.map((question) => question.id + ' ' + question.text + ' (assumed: ' + (question.assumption || '') + ')')
      .join('\n') || '(none)',
    '',
    'SECURITY DEFAULTS you must apply unless the specification says otherwise:',
    '- ' + SECURITY_DEFAULTS,
    '',
    'Return JSON:',
    '{ "answers": [{"questionId": "Q-01", "answer": "the decision, one sentence"}],',
    '  "decisions": [{"text": "", "rationale": "one line"}],',
    '  "riskActions": [{"riskId": "R-01", "status": "mitigated|accepted", "mitigation": "one line"}],',
    '  "tasks": [{"title": "", "kind": "code|doc|test|chore", "files": [], "acceptance": []}] }',
    '',
    'Limits: one answer per open question, at most 3 risk actions, at most 3 new tasks.',
    'Return empty arrays when there is nothing to do.',
    '',
    contextTrailer('resolve-risks', [
      '@@QUESTIONS:' + openQuestionList.map((question) => question.id).join('|') + '@@'
    ])
  ].join('\n')
  return { system: SYSTEM_BASE, user }
}

function fileSection(workspace, filePath, options) {
  const settings = options || {}
  const maxChars = Number(settings.maxSourceFileChars) || 90000
  const inlineLimit = Number(settings.inlineFileChars) || 0
  if (!workspace.exists(filePath)) {
    return '### ' + filePath + ' (does not exist yet - use "create")'
  }
  let content = ''
  try {
    content = workspace.readText(filePath)
  } catch (error) {
    return '### ' + filePath + ' (could not be read: ' + error.message + ')'
  }
  const sizeLabel = (content.length / 1024).toFixed(1) + 'KB'
  // Big files are not pasted into the prompt: the model reads the parts it
  // needs with read_file, which keeps every call small.
  if (inlineLimit > 0 && content.length > inlineLimit) {
    const head = content.split('\n').slice(0, 30).join('\n')
    return '### ' + filePath + ' (' + sizeLabel + ', exists - LARGE, not inlined)\n```\n' + head +
      '\n```\nThe file is ' + content.length + ' characters. Read the parts you need first: ' +
      '{"toolCalls":[{"tool":"read_file","path":"' + filePath + '","fromLine":1,"toLine":80}]}'
  }
  const body = content.length > maxChars ? truncateMiddle(content, maxChars) : content
  return '### ' + filePath + ' (' + sizeLabel + ', exists - use "replace" or "append")\n```\n' + body + '\n```'
}

function applyTaskPrompt(request) {
  const workspace = request.workspace
  const task = request.task
  const ssot = request.ssot
  const attempt = request.attempt || 1
  const previousProblems = request.previousProblems || []
  const files = Array.isArray(task.files) && task.files.length ? task.files : []
  const existingFiles = files.filter((filePath) => workspace.exists(filePath))

  const user = [
    'STAGE 3d - IMPLEMENT ONE TASK.',
    'Task ' + task.id + ': ' + task.title,
    'Acceptance:',
    (task.acceptance || []).map((line) => '- ' + line).join('\n') || '- (none recorded)',
    '',
    'Product context:',
    buildDigest(ssot, { includeTasks: false, maxFeatures: 8 }),
    '',
    'Files to touch (and nothing else):',
    files.join(', ') || '(choose the smallest sensible set)',
    '',
    folderLayoutBlock(request.toolName, request.toolPrefix),
    '',
    toolCatalogText(),
    '',
    attemptsSection(attempt, previousProblems),
    'CURRENT CONTENT:',
    files.map((filePath) => fileSection(workspace, filePath, request)).join('\n\n') || '(new files)',
    '',
    'Return JSON:',
    '{ "summary": "one line, what changed", "ops": [ { "op": "create|replace|append|delete",',
    '  "file": "relative/path.ext", "find": "only for replace", "content": "only where needed" } ], "notes": "" }',
    '',
    'Rules:',
    '- "create" fails when the file exists; use "replace" with a "find" anchor that exists exactly once.',
    '- Keep "find" short (2-6 lines) but unique. Never rewrite a whole existing file when a patch is enough.',
    '- Keep existing behaviour and existing ids/class names unless the task says otherwise.',
    '- Plain, dependency free code. No frameworks, no build step, no CDN unless the task requires it.',
    '- The JavaScript entry point is tool.onReady. Never use DOMContentLoaded, window.onload, localStorage, fetch or alert.',
    '- Escape any "</script>" inside JavaScript strings.',
    '',
    contextTrailer('apply-tasks', [
      '@@TASK:' + task.id + '@@',
      '@@TOOLNAME:' + String(request.toolName || 'TheTool').replace(/@@/g, '') + '@@',
      '@@FILES:' + files.join('|') + '@@',
      '@@EXISTS:' + existingFiles.join('|') + '@@'
    ])
  ].join('\n')
  return { system: SYSTEM_BASE, user }
}

// Several small tasks are sent as ONE prompt when together they reach roughly
// the 100 point target. The model implements the batch in one patch, so the
// tool never sits in a half applied state between two tiny tasks.
function applyBatchPrompt(request) {
  const workspace = request.workspace
  const tasks = Array.isArray(request.tasks) ? request.tasks : []
  const ssot = request.ssot
  const attempt = request.attempt || 1
  const previousProblems = request.previousProblems || []
  const fileSet = []
  tasks.forEach((task) => {
    (Array.isArray(task.files) ? task.files : []).forEach((filePath) => {
      if (filePath && !fileSet.includes(filePath)) fileSet.push(filePath)
    })
  })
  const existingFiles = fileSet.filter((filePath) => workspace.exists(filePath))
  const totalPoints = tasks.reduce((total, task) => total + (Number(task.points) || 0), 0)
  const taskBlocks = tasks.map((task) => {
    const acceptance = (Array.isArray(task.acceptance) ? task.acceptance : [])
      .map((line) => '  - ' + line).join('\n')
    return '### ' + task.id + ' [' + (task.points || 0) + ' points] ' + task.title + '\n' +
      (acceptance || '  - (no acceptance recorded)')
  }).join('\n\n')

  const user = [
    'STAGE 3d - IMPLEMENT THIS BATCH IN ONE PATCH.',
    'Batch ' + (request.batchId || '') + ' - ' + tasks.length + ' task(s), ' + totalPoints + ' of 100 points.',
    'Do all of them in a single pass so the tool never spends time in a half built state.',
    '',
    taskBlocks,
    '',
    'Product context:',
    buildDigest(ssot, { includeTasks: false, maxFeatures: 8 }),
    '',
    'Files you may touch (and nothing else):',
    fileSet.join(', ') || '(choose the smallest sensible set)',
    '',
    folderLayoutBlock(request.toolName, request.toolPrefix),
    '',
    toolCatalogText(),
    '',
    attemptsSection(attempt, previousProblems),
    'CURRENT CONTENT:',
    fileSet.map((filePath) => fileSection(workspace, filePath, request)).join('\n\n') || '(new files)',
    '',
    'Return JSON:',
    '{ "summary": "one line, what changed", "completed": ["T-01"],',
    '  "ops": [ { "op": "create|replace|append|overwrite|delete", "file": "relative/path.ext",',
    '  "find": "only for replace", "content": "only where needed" } ], "notes": "" }',
    '',
    'Rules:',
    '- "create" fails when the file exists; use "replace" with a "find" anchor that exists exactly once.',
    request.allowOverwrite
      ? '- "overwrite" replaces a whole file and is allowed for this batch (' + totalPoints +
        ' points). Use it when a file is being rebuilt; send its complete new content.'
      : '- "overwrite" is not allowed for this batch (' + totalPoints +
        ' points, the threshold is ' + (request.overwriteMinPoints || 80) +
        '): use "replace" with an anchor or "append".',
    '- Cover every task above in the same ops list. One replace per region is better than many tiny appends.',
    '- Keep existing behaviour and existing ids/class names unless a task says otherwise.',
    '- Plain, dependency free HTML/CSS/JS. No framework, no build step, no CDN, no TypeScript.',
    '- The JavaScript entry point is tool.onReady. Never use DOMContentLoaded, window.onload, localStorage, fetch or alert.',
    '- Escape any "</script>" inside JavaScript strings.',
    '- List in "completed" only the task ids this patch really implements.',
    '',
    contextTrailer('apply-tasks', [
      '@@TASK:' + tasks.map((task) => task.id).join(',') + '@@',
      '@@BATCH:' + String(request.batchId || '') + '@@',
      '@@TOOLNAME:' + String(request.toolName || 'TheTool').replace(/@@/g, '') + '@@',
      '@@FILES:' + fileSet.join('|') + '@@',
      '@@EXISTS:' + existingFiles.join('|') + '@@'
    ])
  ].join('\n')
  return { system: SYSTEM_BASE, user }
}

function attemptsSection(attempt, previousProblems) {
  if (attempt <= 1 || !previousProblems.length) return ''
  return [
    'YOUR PREVIOUS ATTEMPT FAILED. Fix these problems exactly:',
    previousProblems.map((problem) => '- ' + (problem.file ? problem.file + ': ' : '') + problem.message).join('\n'),
    ''
  ].join('\n')
}

function usabilityPrompt(request) {
  const ssot = request.ssot
  const uiMap = request.uiMap || ''
  const codemap = request.codemap || ''
  const user = [
    'STAGE 3e2 - USABILITY AND PERSONA REVIEW.',
    'The application exists already. Judge it the way a real user would, not the way a developer would.',
    '',
    'Answer four questions explicitly:',
    '1. How can this be more understandable and easier to use?',
    '2. What is redundant and not necessary?',
    '3. What can be removed to simplify it?',
    '4. Walk at least one persona through real scenarios and name the exact step that is not clear.',
    '',
    buildDigest(ssot, { includeTasks: false, maxFeatures: 8 }),
    '',
    'WHAT THE USER SEES (headings, buttons, labels, ids):',
    uiMap,
    '',
    'FILES:',
    codemap,
    '',
    (ssot.usability || []).length
      ? 'ALREADY REPORTED FINDINGS (do not repeat them):\n' +
        ssot.usability.slice(-8).map((finding) => '- ' + String(finding.observation || '').slice(0, 120)).join('\n')
      : '',
    '',
    'Return JSON:',
    '{',
    '  "personas": [{"name": "", "role": "", "goal": "", "context": ""}],',
    '  "scenarios": [{"persona": "", "goal": "", "steps": [{"step": "", "expected": "", "observation": "", "ok": true}], "outcome": ""}],',
    '  "findings": [{"type": "understandability|redundant|removable|unclear-step", "severity": "high|medium|low",',
    '    "where": "the exact control or screen", "observation": "", "suggestion": ""}],',
    '  "tasks": [{"title": "", "kind": "code|doc|chore", "files": [], "acceptance": []}],',
    '  "notes": "one line"',
    '}',
    '',
    'Limits: 1 persona (2 at most), max 3 scenarios with max 6 steps each, max 6 findings, max 3 tasks.',
    'Rules:',
    '- Name the exact control, heading or field you are talking about. No generic advice.',
    '- A finding is only worth reporting if the user would actually get stuck or give up.',
    '- "removable" findings must say what to delete, not only what is wrong.',
    '- Tasks must be small and checkable; do not propose a redesign.',
    '',
    contextTrailer('usability-review', [
      '@@ITERATION:' + (request.iteration || 1) + '@@',
      '@@TOOLNAME:' + String(request.toolName || 'TheTool').replace(/@@/g, '') + '@@'
    ])
  ].filter(Boolean).join('\n')
  return { system: SYSTEM_BASE, user }
}

function improvePrompt(request) {
  const ssot = request.ssot
  const iteration = request.iteration
  const codemap = request.codemap || ''
  const testSummary = ssot.tests.slice(-8).map((test) => (test.ok ? 'PASS ' : 'FAIL ') + test.name).join('\n')

  const user = [
    'STAGE 3f - NEXT ITERATION IDEAS.',
    'The application now exists (see the file map). Propose what would make it clearly better next.',
    'Judge from the product, not from the code style.',
    '',
    buildDigest(ssot, { maxTasks: 6 }),
    '',
    'APPLICATION FILES:',
    codemap,
    '',
    'LATEST CHECKS:',
    testSummary || '(none)',
    '',
    'EXISTING IDEAS (do not repeat):',
    ssot.ideas.map((idea) => idea.title).join('; ') || '(none)',
    '',
    'Return JSON:',
    '{ "ideas": [{"title": "", "why": "one line, user benefit", "impact": "high|medium|low"}], "nextFocus": "one line" }',
    '',
    'Limits: 3 ideas. Prefer ideas that are cheap to build and easy to verify.',
    '',
    contextTrailer('improve-product', ['@@ITERATION:' + iteration + '@@'])
  ].join('\n')
  return { system: SYSTEM_BASE, user }
}

function repairPrompt(request) {
  const user = [
    'Your previous answer could not be used.',
    'Problem: ' + request.problem,
    '',
    'Return ONLY the corrected JSON object for this contract:',
    request.contract,
    '',
    'Your previous answer started with:',
    truncateTail(String(request.rawText || ''), 1200)
  ].join('\n')
  return { system: SYSTEM_BASE, user }
}

module.exports = {
  SYSTEM_BASE,
  SECURITY_DEFAULTS,
  researchPrompt,
  planTasksPrompt,
  riskReviewPrompt,
  resolveRisksPrompt,
  usabilityPrompt,
  applyTaskPrompt,
  applyBatchPrompt,
  improvePrompt,
  repairPrompt,
  contextTrailer
}
