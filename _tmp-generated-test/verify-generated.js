/* Verify Generated-content separation, promotion, and quality report parsing. */
const fs = require('fs');
const vm = require('vm');

const toolSource = fs.readFileSync(process.argv[2], 'utf8');
const report = [];
let assertions = 0;
function check(label, condition) { assertions++; report.push((condition ? 'PASS ' : 'FAIL ') + label); if (!condition) process.exitCode = 1; }

function extractFunction(functionName) {
  const start = toolSource.indexOf('function ' + functionName + '(');
  if (start < 0) throw new Error('function not found: ' + functionName);
  const braceStart = toolSource.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < toolSource.length; i++) {
    if (toolSource[i] === '{') depth++;
    else if (toolSource[i] === '}') { depth--; if (depth === 0) return toolSource.slice(start, i + 1); }
  }
  throw new Error('unbalanced braces for ' + functionName);
}

const globalsSource = `
var editingHtmlCode = '';
var studioGeneratedHtml = '';
var studioCurrentDocUrl = 'https://host.example/lesson.pdf';
var editingStudyDocGeneratedHtmlMap = {};
var savedCount = 0;
var notifications = [];
function autoSaveCurrentLesson() { savedCount++; }
function updateHtmlPreview() {}
function formatCount(value) { return String(value || 0); }
function setStudioStatus(message, kind) { notifications.push(kind + ': ' + message); }
function readableFileName(url) { return String(url).split('/').pop(); }
function esc(value) { return String(value || ''); }
function el() { return null; }
var tool = { notify: function (message) { notifications.push('notify: ' + message); } };
`;

const context = vm.createContext({
  console: { log: () => {}, warn: () => {} },
  String: String, Number: Number, Math: Math, Object: Object, Array: Array, JSON: JSON, Date: Date, RegExp: RegExp
});
vm.runInContext(globalsSource + '\n' + [
  extractFunction('loadStudioGeneratedForDoc'),
  extractFunction('renderStudioGeneratedPreview'),
  extractFunction('renderStudioGeneratedPreview'),
  extractFunction('publishGeneratedToStudyContent'),
  extractFunction('parseQualityReport'),
  extractFunction('buildStudyContentQualityPrompt')
].join('\n'), context);

// 1. Generated content is stored per document and loaded back
context.editingStudyDocGeneratedHtmlMap = {
  'https://host.example/lesson.pdf': { html: '<h1>Generated A</h1>', generatedAt: 1700000000000 }
};
vm.runInContext('loadStudioGeneratedForDoc(studioCurrentDocUrl)', context);
check('generated HTML is loaded for the open document', vm.runInContext('studioGeneratedHtml', context) === '<h1>Generated A</h1>');

// 2. Promotion APPENDS to the existing Study Content (combine multiple generated docs)
vm.runInContext('editingHtmlCode = "<h1>Existing Study Content</h1>"', context);
vm.runInContext('publishGeneratedToStudyContent("add")', context);
const appended = vm.runInContext('editingHtmlCode', context);
check('add keeps the existing Study Content', appended.indexOf('Existing Study Content') >= 0);
check('add appends the generated block with its source', appended.indexOf('Generated A') >= 0 && appended.indexOf('data-source="lesson.pdf"') >= 0);
check('add saved the lesson once', context.savedCount === 1);

// 3. Promotion REPLACES the Study Content on request
vm.runInContext('publishGeneratedToStudyContent("replace")', context);
const replaced = vm.runInContext('editingHtmlCode', context);
check('replace drops the old content', replaced.indexOf('Existing Study Content') < 0 && replaced.indexOf('Generated A') >= 0);

// 4. Replace with no existing content behaves like a set
vm.runInContext('editingHtmlCode = ""; publishGeneratedToStudyContent("add")', context);
check('add with empty Study Content sets it directly', vm.runInContext('editingHtmlCode', context) === '<h1>Generated A</h1>');

// 5. Quality report parsing tolerates fences and prose
context.__raw = '```json\n{"coverageScore": 88, "similarityScore": 21, "similarityRisk": "low", "missingPoints": ["x"]}\n```';
const parsed = vm.runInContext('parseQualityReport(__raw)', context);
check('JSON in code fences parses', parsed && parsed.coverageScore === 88 && parsed.missingPoints.length === 1);
context.__raw2 = 'Here is the report: {"coverageScore": 50} done';
check('JSON inside prose parses', vm.runInContext('parseQualityReport(__raw2)', context).coverageScore === 50);
context.__raw3 = 'not json';
check('invalid output returns null', vm.runInContext('parseQualityReport(__raw3)', context) === null);

// 6. Prompt covers the required checks
context.__source = 'SOURCE TEXT';
context.__generated = '<p>GENERATED</p>';
const prompt = vm.runInContext('buildStudyContentQualityPrompt(__source, __generated)', context);
check('prompt asks for coverage', prompt.indexOf('coverageScore') >= 0);
check('prompt asks for similarity/copyright', prompt.indexOf('similarityScore') >= 0 && prompt.indexOf('copyright') >= 0);
check('prompt asks for unverifiable additions', prompt.indexOf('unverifiableClaims') >= 0);
check('prompt embeds source and generated', prompt.indexOf('SOURCE TEXT') >= 0 && prompt.indexOf('<p>GENERATED</p>') >= 0);

// 7. Static wiring checks
check('generation no longer overwrites Study Content',
  toolSource.indexOf('editingHtmlCode = generatedHtml') < 0);
check('generated map persists into the lesson', /targetLesson\.studyDocGenerated = /.test(toolSource));
check('generated map is a heavy field', /HEAVY_LESSON_FIELDS = \[[\s\S]*'studyDocGenerated'\]/.test(toolSource));
check('Pictures tab exists in the JS tab list', /'btn-sd-tab-pictures', name: 'pictures'/.test(toolSource));

report.push('');
report.push('ASSERTIONS: ' + assertions + ' (failures: ' + report.filter(l => l.indexOf('FAIL') === 0).length + ')');
fs.writeFileSync('generated-report.txt', report.join('\n'), 'utf8');
