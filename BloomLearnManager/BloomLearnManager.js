/* ── Bloom & Learn Manager ──
   Gamified team management & micro-learning tool
   for AI-assisted math content development teams.
   Built for UniconHub CMS html-tool system.
────────────────────────────────────────── */

/* ── Helpers ── */
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function el(id) { return document.getElementById(id); }
function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return document.querySelectorAll(sel); }

/* ── Constants ── */
var LEVELS = [
  { name: 'Seedling', icon: '🌱', minXP: 0, color: 'lvl-seedling', badgeClass: 'badge-seedling' },
  { name: 'Sprout', icon: '🌿', minXP: 200, color: 'lvl-sprout', badgeClass: 'badge-sprout' },
  { name: 'Sapling', icon: '🌳', minXP: 500, color: 'lvl-sapling', badgeClass: 'badge-sapling' },
  { name: 'Tree', icon: '🌲', minXP: 1000, color: 'lvl-tree', badgeClass: 'badge-tree' },
  { name: 'Redwood', icon: '🌟', minXP: 2000, color: 'lvl-redwood', badgeClass: 'badge-redwood' }
];

var BADGES = {
  firstFlight: { icon: '🚀', name: 'First Flight', desc: 'Complete your first document' },
  eagleEye: { icon: '🔍', name: 'Eagle Eye', desc: 'Find 10 errors in peer review' },
  creativeSpark: { icon: '🎨', name: 'Creative Spark', desc: 'Create a "Three Ways" set' },
  speedDemon: { icon: '⚡', name: 'Speed Demon', desc: '5 documents in one day (quality pass)' },
  scholar: { icon: '📚', name: 'Scholar', desc: 'Complete 20 micro-learning cards' },
  promptWizard: { icon: '🧠', name: 'Prompt Wizard', desc: '5 prompts added to Team Library' },
  mentor: { icon: '🤝', name: 'Mentor', desc: 'Help 3 peers improve documents' },
  streakMaster: { icon: '🔥', name: 'Streak Master', desc: '10 consecutive days of activity' },
  qualityChampion: { icon: '💎', name: 'Quality Champion', desc: '10 documents rated 5-star' },
  mathWhiz: { icon: '🧮', name: 'Math Whiz', desc: 'Complete 15 math game challenges' },
  reviewerPro: { icon: '⭐', name: 'Reviewer Pro', desc: 'Complete 25 peer reviews' },
  earlyBird: { icon: '🌅', name: 'Early Bird', desc: 'First to complete daily challenge 5 times' },
  presenterPro: { icon: '🎤', name: 'Presenter Pro', desc: 'Complete your AI concept presentation' },
  appBuilder: { icon: '🛠️', name: 'App Builder', desc: 'Build and deploy a working HTML app' },
  bookEditor: { icon: '📚', name: 'Book Editor', desc: 'Compile a complete grade-level book' },
  bossSlayer: { icon: '⚔️', name: 'Boss Slayer', desc: 'Solve 3 weekly Boss Battle challenges' },
  skillMentor: { icon: '🔄', name: 'Skill Mentor', desc: 'Teach a new skill to another worker' },
  personaMaster: { icon: '🎭', name: 'Persona Master', desc: 'Adapt content for all 5 student personas' }
};

var QUALITY_GATES = ['accuracy', 'clarity', 'visual', 'engagement'];
var GATE_LABELS = { accuracy: '🔍 Accuracy', clarity: '🎨 Clarity', visual: '🖼️ Visual', engagement: '✨ Engagement' };

var DAY_THEMES = [
  { day: 1, icon: '🎯', name: 'Precision Day', desc: 'Focus on math accuracy & error hunting' },
  { day: 2, icon: '🎨', name: 'Creativity Day', desc: 'One Topic, Three Ways challenge' },
  { day: 3, icon: '🤝', name: 'Collaboration Day', desc: 'Peer review marathon & pair work' },
  { day: 4, icon: '🚀', name: 'Speed Day', desc: 'Timed creation sprints with quality gates' },
  { day: 5, icon: '🎓', name: 'Teach-Back Day', desc: 'Present one topic to the group' },
  { day: 6, icon: '📚', name: 'Deep Learn Day', desc: 'Extended learning & reflection' },
  { day: 0, icon: '🌟', name: 'Free Flow Day', desc: 'Creative exploration & catch-up' }
];

var AI_PRESENTATION_TOPICS = [
  // ── CATEGORY A: Understanding AI (How It Actually Works) ──
  'What Happens Inside an AI When You Press Enter? — Tokens, probabilities, and why AI is not "thinking"',
  'Why Does the Same Prompt Give Different Answers? — Temperature, randomness, and how to control AI output',
  'The AI Doesn\'t "Know" Math — How LLMs fake reasoning and why verification is YOUR job',
  'Context Window: The AI\'s Short-Term Memory — Why long documents confuse AI and how to work around it',
  'Training Data: Where AI\'s "Knowledge" Comes From — What\'s in the training data, what\'s missing, and why it matters for Turkish/math content',

  // ── CATEGORY B: Better Prompting (Skills That Level Up Their Work) ──
  'The Anatomy of a Great Prompt — Role, context, constraints, format, examples: the 5 ingredients',
  'Show, Don\'t Just Tell — How giving AI an example output transforms quality (few-shot prompting)',
  'Breaking Big Tasks into Small Steps — Chain-of-thought and why "think step by step" actually works',
  'When AI Gets Stuck on Math — Common math errors AI makes and how to design prompts that reduce them',
  'Your Prompt is a Contract — How to write constraints that AI actually follows (and why it sometimes doesn\'t)',

  // ── CATEGORY C: Working Smarter (Beyond Basic Prompting) ──
  'AI as Your Editor, Not Your Replacement — How to review, improve, and polish AI-generated content',
  'Building Your Personal Prompt Library — How to save, test, and improve your best prompts over time',
  'Spotting AI Hallucinations in Educational Content — Real examples, detection tricks, and prevention strategies',
  'How to Compare AI Models for Your Task — Claude vs ChatGPT vs Gemini: strengths, weaknesses, and when to use each',
  'The Future of Your Job — What AI means for education careers and how to stay valuable in an AI world'
];

var APP_PROJECT_IDEAS = [
  { name: 'Math Formula Cheat Sheet', desc: 'Searchable formula library by grade & topic', diff: 'easy', icon: '📋' },
  { name: 'Grade Calculator', desc: 'Weighted averages, final exam predictor', diff: 'easy', icon: '🧮' },
  { name: 'Daily Work Log', desc: 'Timer + what-I-did-today tracker', diff: 'easy', icon: '📝' },
  { name: 'Flashcard Reviewer', desc: 'Create & review flashcards with flip animation', diff: 'medium', icon: '🃏' },
  { name: 'Random Group Generator', desc: 'Input names, set size, get random groups', diff: 'easy', icon: '🎲' },
  { name: 'Lesson Plan Quick Builder', desc: 'Template-based lesson plan generator', diff: 'medium', icon: '📖' },
  { name: 'Math Word Problem Generator', desc: 'Select topic → AI generates unique problems', diff: 'medium', icon: '🧩' },
  { name: 'Peer Review Checklist Tool', desc: 'Digital version of quality gates', diff: 'easy', icon: '✅' },
  { name: 'Presentation Timer & Notes', desc: 'Countdown timer with cue cards', diff: 'easy', icon: '⏱️' },
  { name: 'Book Chapter Compiler', desc: 'Combine documents into structured book chapters', diff: 'medium', icon: '📚' }
];

var STUDENT_PERSONAS = [
  { id: 'sp1', name: 'Struggling Sarah', icon: '🤔', desc: 'Needs extra scaffolding, step-by-step breakdown, lots of examples' },
  { id: 'sp2', name: 'Bored Burak', icon: '😴', desc: 'Needs challenge problems, real-world puzzles, "why this matters"' },
  { id: 'sp3', name: 'Visual Veli', icon: '👁️', desc: 'Needs diagrams, graphs, color-coding, visual metaphors' },
  { id: 'sp4', name: 'Anxious Ayşe', icon: '😰', desc: 'Needs reassurance, growth mindset language, low-stakes practice' },
  { id: 'sp5', name: 'Curious Can', icon: '🧐', desc: 'Needs exploration paths, "what if" questions, deeper dives' }
];

var CURRICULUM_TOPICS = {
  '5': ['Numbers & Place Value', 'Addition & Subtraction', 'Multiplication Basics', 'Division Basics', 'Fractions Intro', 'Decimals Intro', 'Geometry: Shapes', 'Measurement', 'Data & Graphs', 'Patterns'],
  '6': ['Fractions Operations', 'Decimals & Percentages', 'Ratio & Proportion', 'Integers', 'Algebraic Expressions Intro', 'Geometry: Angles', 'Area & Perimeter', 'Statistics: Mean & Median', 'Probability Intro', 'Number Properties'],
  '7': ['Linear Equations', 'Inequalities', 'Proportional Relationships', 'Percent Applications', 'Geometry: Triangles', 'Surface Area & Volume', 'Statistics & Probability', 'Rational Numbers', 'Coordinate Plane', 'Scale Drawings'],
  '8': ['Linear Functions', 'Systems of Equations', 'Exponents & Roots', 'Scientific Notation', 'Pythagorean Theorem', 'Transformations', 'Scatter Plots', 'Two-Way Tables', 'Angle Relationships', 'Irrational Numbers'],
  '9': ['Quadratic Equations', 'Functions Deep Dive', 'Polynomials', 'Factoring', 'Trigonometry Intro', 'Coordinate Geometry', 'Complex Numbers', 'Sequences & Series', 'Probability: Compound Events', 'Data Analysis'],
  '10': ['Advanced Trigonometry', 'Logarithms', 'Exponential Functions', 'Conic Sections', 'Vectors', 'Matrices', 'Limits & Continuity', 'Derivatives Intro', 'Statistical Inference', 'Proof Techniques'],
  '11': ['Calculus: Derivatives', 'Calculus: Integrals', 'Differential Equations Intro', 'Advanced Probability', 'Linear Algebra Intro', 'Complex Analysis Intro', 'Mathematical Modeling', 'Number Theory', 'Graph Theory', 'Advanced Proofs']
};

var MICRO_LEARNING = {
  pedagogy: [
    { id: 'p1', title: 'Concrete → Pictorial → Abstract', body: 'Students learn math best when they experience it physically first (concrete), then see diagrams (pictorial), then work with symbols (abstract). Always include all three in your content.', xp: 5 },
    { id: 'p2', title: 'The Power of "What If?"', body: 'After explaining a concept, add a "What if..." question. Example: "What if the denominator was zero?" This builds mathematical thinking and curiosity.', xp: 5 },
    { id: 'p3', title: 'Visual Before Text', body: 'Research shows students retain 90% more when they see a visual or diagram BEFORE reading the explanation. Start every topic with an engaging visual.', xp: 5 },
    { id: 'p4', title: 'Scaffolding Technique', body: 'Break complex problems into smaller steps. Show each step clearly. Gradually remove the scaffolding so students learn to solve independently.', xp: 5 },
    { id: 'p5', title: 'Common Misconceptions First', body: 'Start by showing a COMMON MISTAKE, then explain WHY it\'s wrong, then show the correct approach. This is more memorable than just showing the right way.', xp: 5 },
    { id: 'p6', title: 'Real-World Connections', body: 'Every math topic should connect to something students care about. Fractions → pizza slices, sharing. Algebra → game scores, shopping discounts.', xp: 5 },
    { id: 'p7', title: 'The Feynman Technique', body: 'If you can\'t explain it simply, you don\'t understand it. Try explaining the math topic as if to a 10-year-old. This reveals gaps in your own understanding.', xp: 10 },
    { id: 'p8', title: 'Spaced Repetition', body: 'Include review problems from PREVIOUS topics in each new document. This reinforces learning through spaced repetition — the most effective study technique.', xp: 5 },
    { id: 'p9', title: 'Growth Mindset Language', body: 'Use phrases like "You haven\'t mastered this YET" instead of "This is hard." Growth mindset language improves student persistence by 30%+.', xp: 5 },
    { id: 'p10', title: 'Multiple Representations', body: 'Present the same concept in multiple ways: numerically, graphically, symbolically, and verbally. Different students connect with different representations.', xp: 5 }
  ],
  'prompt-drills': [
    { id: 'd1', title: 'Spot the Weakness #1', body: 'Prompt: "Explain fractions." — What\'s wrong? (Answer: Too vague. No grade level, no examples, no structure. A good prompt specifies audience, format, and expectations.)', xp: 15 },
    { id: 'd2', title: 'Spot the Weakness #2', body: 'Prompt: "Write a math lesson about algebra for grade 8 students. Make it good." — "Make it good" is meaningless to AI. Instead, specify: include 3 worked examples, 5 practice problems, and a real-world connection.', xp: 15 },
    { id: 'd3', title: 'Better Constraints', body: 'Which is better? A) "Create math problems" or B) "Create 5 word problems about percentages for grade 7, each involving a real shopping scenario, with step-by-step solutions"? — B is dramatically better. Specificity = quality.', xp: 10 },
    { id: 'd4', title: 'The Role of Examples', body: 'Always include 1-2 EXAMPLES of the desired output in your prompt. The AI learns the format, tone, and depth from your examples. This is called "few-shot prompting."', xp: 10 },
    { id: 'd5', title: 'Tone & Audience', body: 'Add to your prompt: "Write for a [grade level] student who [struggles with / is curious about] this topic. Use a [friendly / formal / story-like] tone." — This transforms output quality.', xp: 10 },
    { id: 'd6', title: 'The Error Check Prompt', body: 'After generating content, use this follow-up prompt: "Review the above content for mathematical errors, unclear explanations, and missing steps. List any issues found." — AI can self-correct!', xp: 15 }
  ],
  'math-games': [
    { id: 'g1', title: 'Connect the Concepts', body: 'In 2 sentences, explain how FRACTIONS connect to DECIMALS. Write your answer and compare with a peer.', xp: 10 },
    { id: 'g2', title: 'Real-World Math', body: 'Name 3 real-world situations where someone uses PERCENTAGES without realizing it. Think creatively!', xp: 10 },
    { id: 'g3', title: 'Pattern Hunt', body: 'Look at this sequence: 2, 6, 12, 20, 30... What\'s the pattern? What\'s the 10th term? (Answer: n(n+1), 10th = 110)', xp: 15 },
    { id: 'g4', title: 'Math in Nature', body: 'Find one example of the Fibonacci sequence or the Golden Ratio in nature. Describe it in 3 sentences.', xp: 10 },
    { id: 'g5', title: 'The Missing Step', body: 'A student solved 3x + 5 = 20 and got x = 7. What step did they likely miss? (Answer: They forgot to subtract 5 first: 3x = 15, then x = 5)', xp: 15 },
    { id: 'g6', title: 'Teach a Concept in Emojis', body: 'Explain the Pythagorean theorem using ONLY emojis. Show your friend and see if they understand!', xp: 10 }
  ],
  explain: [
    { id: 'e1', title: 'Explain Fractions to a 7-Year-Old', body: 'Write ONE sentence that explains what a fraction is to a child who has never heard of them. Best answer wins recognition!', xp: 10 },
    { id: 'e2', title: 'Why Negative × Negative = Positive?', body: 'Explain this in a way that makes intuitive sense — no "just memorize the rule" allowed. Use a real-world analogy.', xp: 15 },
    { id: 'e3', title: 'What IS Algebra?', body: 'Define algebra in one sentence that would make sense to someone who thinks math is just numbers. Make it inspiring!', xp: 10 },
    { id: 'e4', title: 'The = Sign', body: 'Explain why the equals sign means "is the same as" — NOT "here comes the answer." Why does this matter for student understanding?', xp: 10 }
  ]
};

/* ── State ── */
var DB = {
  workers: [],
  subjects: [],
  reviews: [],
  prompts: [],
  activityFeed: [],
  completedLearning: [],
  dailyChallenge: null,
  teamStreak: 0,
  lastActiveDate: null,
  presentations: [],
  appProjects: [],
  bookProjects: [],
  bossBattles: [],
  mysteryAssignments: [],
  customLearningCards: []
};

var isReadOnly = false;
var currentPage = 'dashboard';
var currentUser = null;
var currentWorkerId = null;
var currentLearnTab = 'pedagogy';
var currentLbTab = 'xp';
var editingSubjectId = null;
var editingPromptId = null;
var reviewingSubjectId = null;
var editingLearningCardId = null;
var currentPresTab = 'calendar';
var currentAppTab = 'projects';

/* ── User / Worker Resolution ── */
function resolveCurrentWorker() {
  var user = tool.getUser();
  currentUser = user;
  if (!user || !user.email) {
    // No authenticated user — fallback: use first worker or param
    var paramWorker = tool.param('workerId', '');
    if (paramWorker) {
      currentWorkerId = paramWorker;
    } else if (DB.workers.length > 0) {
      currentWorkerId = DB.workers[0].id;
    }
    return;
  }
  // Try to match by email
  var matched = DB.workers.find(function(w) { return w.email && w.email.toLowerCase() === user.email.toLowerCase(); });
  if (matched) {
    currentWorkerId = matched.id;
    return;
  }
  // Try to match by name
  matched = DB.workers.find(function(w) { return w.name && user.name && w.name.toLowerCase() === user.name.toLowerCase(); });
  if (matched) {
    currentWorkerId = matched.id;
    if (user.email && !matched.email) { matched.email = user.email; persist(); }
    return;
  }
  // No match — use param or first worker as fallback
  currentWorkerId = tool.param('workerId', '') || (DB.workers.length > 0 ? DB.workers[0].id : null);
}

function getMyWorker() {
  if (!currentWorkerId) return null;
  return DB.workers.find(function(w) { return w.id === currentWorkerId; }) || null;
}

function isManager() {
  return tool.param('managerView', '') === 'yes';
}

function isMe(workerId) {
  return workerId === currentWorkerId;
}

/* ── Default Workers ── */
function getDefaultWorkers() {
  return [
    { id: 'w1', name: 'Worker 1', avatar: '👩‍🔬', xp: 0, badges: [], joined: new Date().toISOString(), skills: {} },
    { id: 'w2', name: 'Worker 2', avatar: '👨‍💻', xp: 0, badges: [], joined: new Date().toISOString(), skills: {} },
    { id: 'w3', name: 'Worker 3', avatar: '👩‍🎓', xp: 0, badges: [], joined: new Date().toISOString(), skills: {} },
    { id: 'w4', name: 'Worker 4', avatar: '👨‍🏫', xp: 0, badges: [], joined: new Date().toISOString(), skills: {} },
    { id: 'w5', name: 'Worker 5', avatar: '👩‍💻', xp: 0, badges: [], joined: new Date().toISOString(), skills: {} },
    { id: 'w6', name: 'Worker 6', avatar: '👨‍🔬', xp: 0, badges: [], joined: new Date().toISOString(), skills: {} },
    { id: 'w7', name: 'Worker 7', avatar: '👩‍🏫', xp: 0, badges: [], joined: new Date().toISOString(), skills: {} },
    { id: 'w8', name: 'Worker 8', avatar: '👨‍🎓', xp: 0, badges: [], joined: new Date().toISOString(), skills: {} },
    { id: 'w9', name: 'Worker 9', avatar: '👩‍🔧', xp: 0, badges: [], joined: new Date().toISOString(), skills: {} },
    { id: 'w10', name: 'Worker 10', avatar: '👨‍🚀', xp: 0, badges: [], joined: new Date().toISOString(), skills: {} }
  ];
}

/* ── Level Calculation ── */
function getLevel(xp) {
  var lvl = LEVELS[0];
  for (var i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) { lvl = LEVELS[i]; break; }
  }
  return lvl;
}

function getNextLevel(xp) {
  for (var i = 0; i < LEVELS.length; i++) {
    if (xp < LEVELS[i].minXP) return LEVELS[i];
  }
  return null;
}

function getXPProgress(xp) {
  var current = getLevel(xp);
  var next = getNextLevel(xp);
  if (!next) return 100;
  var currentMin = current.minXP;
  var nextMin = next.minXP;
  var progress = ((xp - currentMin) / (nextMin - currentMin)) * 100;
  return Math.min(100, Math.max(0, progress));
}

/* ── Persistence ── */
function persist() {
  tool.setValue(JSON.parse(JSON.stringify(DB)));
  updateNavBadges();
}

function loadData(val) {
  if (val && typeof val === 'object') {
    DB = JSON.parse(JSON.stringify(val));
    // Ensure all keys exist
    if (!DB.workers) DB.workers = getDefaultWorkers();
    if (!DB.subjects) DB.subjects = [];
    if (!DB.reviews) DB.reviews = [];
    if (!DB.prompts) DB.prompts = [];
    if (!DB.activityFeed) DB.activityFeed = [];
    if (!DB.completedLearning) DB.completedLearning = [];
    if (!DB.dailyChallenge) DB.dailyChallenge = null;
    if (DB.teamStreak === undefined) DB.teamStreak = 0;
    if (!DB.lastActiveDate) DB.lastActiveDate = null;
    if (!DB.presentations) DB.presentations = [];
    if (!DB.appProjects) DB.appProjects = [];
    if (!DB.bookProjects) DB.bookProjects = [];
    if (!DB.bossBattles) DB.bossBattles = [];
    if (!DB.mysteryAssignments) DB.mysteryAssignments = [];
    if (!DB.customLearningCards) DB.customLearningCards = [];
    // Ensure 10 workers exist
    if (!DB.workers.length) DB.workers = getDefaultWorkers();
  } else {
    DB.workers = getDefaultWorkers();
    DB.subjects = [];
    DB.reviews = [];
    DB.prompts = [];
    DB.activityFeed = [];
    DB.completedLearning = [];
    DB.dailyChallenge = null;
    DB.teamStreak = 0;
    DB.lastActiveDate = null;
    DB.presentations = [];
    DB.appProjects = [];
    DB.bookProjects = [];
    DB.bossBattles = [];
    DB.mysteryAssignments = [];
    DB.customLearningCards = [];
    persist();
  }
}

/* ── Activity Feed ── */
function addActivity(icon, text) {
  DB.activityFeed.unshift({ icon: icon, text: text, time: new Date().toISOString() });
  if (DB.activityFeed.length > 50) DB.activityFeed.length = 50;
  persist();
}

/* ── Streak Tracking ── */
function updateStreak() {
  var today = new Date().toISOString().slice(0, 10);
  if (DB.lastActiveDate === today) return;
  var yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (DB.lastActiveDate === yesterday) {
    DB.teamStreak++;
  } else if (DB.lastActiveDate !== today) {
    DB.teamStreak = 1;
  }
  DB.lastActiveDate = today;
  persist();
}

/* ── Daily Challenge ── */
function ensureDailyChallenge() {
  var today = new Date().toISOString().slice(0, 10);
  if (DB.dailyChallenge && DB.dailyChallenge.date === today) return;
  var challenges = [
    { id: 'dc1', title: 'Quality Blitz', desc: 'Submit 3 documents that pass ALL 4 quality gates today. +50 XP bonus!', xpBonus: 50 },
    { id: 'dc2', title: 'Learning Spree', desc: 'Complete 5 micro-learning cards today. +30 XP bonus!', xpBonus: 30 },
    { id: 'dc3', title: 'Peer Review Hero', desc: 'Complete 3 peer reviews with detailed feedback. +40 XP bonus!', xpBonus: 40 },
    { id: 'dc4', title: 'Prompt Master', desc: 'Add a new prompt to the Team Prompt Library and use it successfully. +35 XP!', xpBonus: 35 },
    { id: 'dc5', title: 'Error Hunter', desc: 'Find and fix 5 errors across peer reviews today. +45 XP bonus!', xpBonus: 45 },
    { id: 'dc6', title: 'Creative Genius', desc: 'Create a "One Topic, Three Ways" set for any math topic. +60 XP!', xpBonus: 60 },
    { id: 'dc7', title: 'Helping Hand', desc: 'Help a teammate improve their document with specific suggestions. +25 XP!', xpBonus: 25 }
  ];
  var idx = new Date().getDate() % challenges.length;
  var picked = challenges[idx];
  DB.dailyChallenge = { date: today, id: picked.id, title: picked.title, desc: picked.desc, xpBonus: picked.xpBonus, completedBy: [] };
  persist();
}

/* ── Navigation ── */
function navigateTo(page) {
  currentPage = page;
  qsa('.nav-item').forEach(function(n) { n.classList.remove('active'); });
  qs('.nav-item[data-page="' + page + '"]').classList.add('active');
  qsa('.section').forEach(function(s) { s.classList.remove('active'); });
  var sec = el('sec-' + page);
  if (sec) sec.classList.add('active');
  renderCurrentPage();
  tool.resize();
}

function renderCurrentPage() {
  switch (currentPage) {
    case 'dashboard': renderDashboard(); break;
    case 'workers': renderWorkers(); break;
    case 'tasks': renderTasks(); break;
    case 'learn': renderLearnZone(); break;
    case 'review': renderReview(); break;
    case 'leaderboard': renderLeaderboard(); break;
    case 'prompts': renderPrompts(); break;
    case 'presentations': renderPresentations(); break;
    case 'apps': renderApps(); break;
    case 'books': renderBooks(); break;
    case 'portfolio': renderPortfolio(); break;
    case 'onboarding': renderOnboarding(); break;
  }
}

/* ── Nav Badges ── */
function updateNavBadges() {
  var pendingTasks = DB.subjects.filter(function(s) { return s.status === 'pending' || s.status === 'in-progress'; }).length;
  var pendingReviews = DB.subjects.filter(function(s) { return s.status === 'done'; }).length;
  var newLearnCount = getUncompletedLearningCount();
  var promptCount = DB.prompts.length;
  var presCount = DB.presentations.length;
  var appsCount = DB.appProjects.length;
  var booksCount = DB.bookProjects.length;
  el('nav-tasks-pending').textContent = pendingTasks || '0';
  el('nav-review-queue').textContent = pendingReviews || '0';
  el('nav-learn-new').textContent = newLearnCount || '0';
  el('nav-prompts-count').textContent = promptCount || '0';
  el('nav-pres-count').textContent = presCount || '0';
  el('nav-apps-count').textContent = appsCount || '0';
  el('nav-books-count').textContent = booksCount || '0';
}

/* ── Dashboard ── */
function renderDashboard() {
  updateStreak();
  ensureDailyChallenge();
  el('dash-date').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Stats
  var totalDocs = DB.subjects.length;
  var completedDocs = DB.subjects.filter(function(s) { return s.status === 'done' || s.status === 'reviewed'; }).length;
  var totalXP = DB.workers.reduce(function(sum, w) { return sum + (w.xp || 0); }, 0);
  var totalReviews = DB.reviews.length;
  var avgQuality = 0;
  var reviewedDocs = DB.subjects.filter(function(s) { return s.qualityScore != null; });
  if (reviewedDocs.length) {
    avgQuality = Math.round(reviewedDocs.reduce(function(s, d) { return s + (d.qualityScore || 0); }, 0) / reviewedDocs.length * 10) / 10;
  }
  var sessionDay = getProgramDay();
  var dayTheme = DAY_THEMES.find(function(t) { return t.day === (sessionDay % 7); }) || DAY_THEMES[6];

  el('dash-stats').innerHTML =
    '<div class="stat-card stat-primary"><div class="stat-value">' + completedDocs + '</div><div class="stat-label">Docs Completed</div></div>' +
    '<div class="stat-card stat-accent"><div class="stat-value">' + totalXP + '</div><div class="stat-label">Team XP</div></div>' +
    '<div class="stat-card stat-gold"><div class="stat-value">' + avgQuality + '</div><div class="stat-label">Avg Quality ⭐</div></div>' +
    '<div class="stat-card stat-success"><div class="stat-value">' + totalReviews + '</div><div class="stat-label">Peer Reviews</div></div>' +
    '<div class="stat-card stat-accent"><div class="stat-value">' + sessionDay + '</div><div class="stat-label">Program Day</div></div>';

  // Streak
  el('dash-streak').innerHTML =
    '<div class="streak-display"><div class="streak-flame">🔥</div><div class="streak-count">' + (DB.teamStreak || 1) + '</div><div class="streak-label">Day Streak</div></div>';

  // Daily Challenge
  var dc = DB.dailyChallenge;
  if (dc) {
    el('dash-challenge').innerHTML =
      '<div style="font-weight:700;margin-bottom:6px;">' + esc(dc.title) + ' (+' + dc.xpBonus + ' XP)</div>' +
      '<div style="font-size:13px;color:var(--text-secondary);">' + esc(dc.desc) + '</div>' +
      '<div style="margin-top:8px;font-size:11px;color:var(--text-secondary);">Completed by: ' + (dc.completedBy && dc.completedBy.length ? dc.completedBy.map(function(id) { var w = DB.workers.find(function(ww) { return ww.id === id; }); return w ? w.name : id; }).join(', ') : 'No one yet — be the first!') + '</div>';
  }

  // Activity Feed
  var feedHTML = '';
  var feed = DB.activityFeed.slice(0, 15);
  if (!feed.length) {
    feedHTML = '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">No activity yet. Start working to see the feed!</div></div>';
  } else {
    feed.forEach(function(f) {
      var t = new Date(f.time);
      var timeStr = t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      feedHTML += '<div class="feed-item"><span class="feed-icon">' + f.icon + '</span><span class="feed-text">' + esc(f.text) + '</span><span class="feed-time">' + timeStr + '</span></div>';
    });
  }
  el('dash-feed').innerHTML = feedHTML;

  // Sidebar theme
  el('theme-day-icon').textContent = dayTheme.icon;
  el('theme-day-label').textContent = 'Day ' + sessionDay + ' · ' + dayTheme.name;
}

function getProgramDay() {
  if (!DB.workers.length) return 1;
  var firstJoined = DB.workers.reduce(function(earliest, w) {
    return w.joined && w.joined < earliest ? w.joined : earliest;
  }, DB.workers[0].joined || new Date().toISOString());
  var diff = Date.now() - new Date(firstJoined).getTime();
  return Math.max(1, Math.floor(diff / 86400000) + 1);
}

/* ── Workers Page ── */
function renderWorkers() {
  var html = '';
  DB.workers.forEach(function(w) {
    var lvl = getLevel(w.xp || 0);
    var progress = getXPProgress(w.xp || 0);
    var nextLvl = getNextLevel(w.xp || 0);
    var completedDocs = DB.subjects.filter(function(s) { return s.assignedTo === w.id && (s.status === 'done' || s.status === 'reviewed'); }).length;
    var reviewCount = DB.reviews.filter(function(r) { return r.reviewerId === w.id; }).length;
    var badgeIcons = (w.badges || []).map(function(b) { return (BADGES[b] ? BADGES[b].icon : '🏅'); }).join(' ') || '<span style="font-size:10px;color:#94a3b8;">No badges yet</span>';

    html += '<div class="worker-card ' + lvl.color + '" onclick="showWorkerDetail(\'' + w.id + '\')">' +
      '<div class="worker-level-badge ' + lvl.badgeClass + '">' + lvl.icon + ' ' + lvl.name + '</div>' +
      '<div class="worker-avatar" style="background:#f1f5f9;">' + (w.avatar || '👤') + '</div>' +
      '<div class="worker-name">' + esc(w.name) + '</div>' +
      '<div class="worker-role">📝 ' + completedDocs + ' docs · ⭐ ' + reviewCount + ' reviews</div>' +
      '<div class="worker-xp-bar-wrap">' +
        '<div class="worker-xp-label"><span>' + (w.xp || 0) + ' XP</span><span>' + (nextLvl ? 'Next: ' + nextLvl.name + ' (' + nextLvl.minXP + ' XP)' : 'MAX LEVEL!') + '</span></div>' +
        '<div class="worker-xp-bar"><div class="worker-xp-fill" style="width:' + progress + '%"></div></div>' +
      '</div>' +
      '<div class="worker-badges">' + badgeIcons + '</div>' +
    '</div>';
  });
  el('workers-grid').innerHTML = html;
}

function showWorkerDetail(workerId) {
  var w = DB.workers.find(function(ww) { return ww.id === workerId; });
  if (!w) return;
  var lvl = getLevel(w.xp || 0);
  var progress = getXPProgress(w.xp || 0);
  var nextLvl = getNextLevel(w.xp || 0);
  var completedDocs = DB.subjects.filter(function(s) { return s.assignedTo === w.id && (s.status === 'done' || s.status === 'reviewed'); }).length;
  var reviewCount = DB.reviews.filter(function(r) { return r.reviewerId === w.id; }).length;
  var allBadges = Object.keys(BADGES);
  var earnedBadges = w.badges || [];
  var workerSubjects = DB.subjects.filter(function(s) { return s.assignedTo === w.id; });

  var badgesHTML = allBadges.map(function(bk) {
    var b = BADGES[bk];
    var earned = earnedBadges.indexOf(bk) !== -1;
    return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;' + (earned ? '' : 'opacity:0.35;') + '">' +
      '<span style="font-size:22px;">' + (earned ? b.icon : '🔒') + '</span>' +
      '<div><div style="font-weight:600;font-size:12px;">' + b.name + '</div><div style="font-size:10px;color:var(--text-secondary);">' + b.desc + '</div></div>' +
      (earned ? '<span style="margin-left:auto;color:var(--success);font-weight:700;font-size:10px;">✓</span>' : '') +
    '</div>';
  }).join('');

  var subjectsHTML = workerSubjects.length ? workerSubjects.map(function(s) {
    var stars = '';
    for (var i = 1; i <= 5; i++) stars += '<span class="' + (i <= (s.qualityScore || 0) ? '' : 'empty') + '">★</span>';
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px;">' +
      '<span>' + esc(s.topic) + ' <span style="color:var(--text-secondary);">(Gr ' + esc(s.grade) + ')</span></span>' +
      '<span class="badge badge-' + (s.status || 'pending') + '">' + (s.status || 'pending') + '</span>' +
      '<span class="quality-stars">' + stars + '</span>' +
    '</div>';
  }).join('') : '<div class="empty-state"><div class="empty-text">No subjects assigned yet</div></div>';

  var modalHTML =
    '<h3>' + esc(w.name) + ' <span class="badge ' + lvl.badgeClass + '">' + lvl.icon + ' ' + lvl.name + '</span></h3>' +
    '<div style="margin-bottom:16px;">' +
      '<div class="worker-xp-label"><span>' + (w.xp || 0) + ' XP</span><span>' + (nextLvl ? 'Next: ' + nextLvl.name + ' (' + nextLvl.minXP + ' XP)' : 'MAX LEVEL!') + '</span></div>' +
      '<div class="worker-xp-bar"><div class="worker-xp-fill" style="width:' + progress + '%"></div></div>' +
    '</div>' +
    '<div style="display:flex;gap:20px;margin-bottom:16px;font-size:12px;color:var(--text-secondary);">' +
      '<span>📝 ' + completedDocs + ' documents</span><span>⭐ ' + reviewCount + ' reviews</span>' +
    '</div>' +
    '<div style="margin-bottom:16px;"><div class="form-label">Badges (' + earnedBadges.length + '/' + allBadges.length + ')</div>' + badgesHTML + '</div>' +
    '<div><div class="form-label">Assigned Subjects</div>' + subjectsHTML + '</div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-outline" onclick="awardXP(\'' + w.id + '\', 50)">+50 XP Bonus</button>' +
      '<button class="btn btn-outline" onclick="awardXP(\'' + w.id + '\', 100)">+100 XP Bonus</button>' +
      '<button class="btn btn-primary" onclick="closeModal()">Close</button>' +
    '</div>';
  showModal(modalHTML);
}

function awardXP(workerId, amount) {
  var w = DB.workers.find(function(ww) { return ww.id === workerId; });
  if (!w) return;
  w.xp = (w.xp || 0) + amount;
  var oldLvl = getLevel(w.xp - amount);
  var newLvl = getLevel(w.xp);
  addActivity('⭐', w.name + ' earned +' + amount + ' XP');
  if (oldLvl.name !== newLvl.name) {
    addActivity('🎉', w.name + ' leveled up to ' + newLvl.icon + ' ' + newLvl.name + '!');
    tool.notify(w.name + ' reached ' + newLvl.name + ' level! 🎉', 'success');
  }
  checkBadges(workerId);
  persist();
  showWorkerDetail(workerId);
  renderCurrentPage();
}

function checkBadges(workerId) {
  var w = DB.workers.find(function(ww) { return ww.id === workerId; });
  if (!w) return;
  if (!w.badges) w.badges = [];

  var completedDocs = DB.subjects.filter(function(s) { return s.assignedTo === w.id && (s.status === 'done' || s.status === 'reviewed'); }).length;
  var reviewCount = DB.reviews.filter(function(r) { return r.reviewerId === w.id; }).length;
  var fiveStarDocs = DB.subjects.filter(function(s) { return s.assignedTo === w.id && s.qualityScore === 5; }).length;
  var promptsAdded = DB.prompts.filter(function(p) { return p.createdBy === w.id; }).length;
  var learningCompleted = DB.completedLearning.filter(function(l) { return l.workerId === w.id; }).length;
  var presDone = DB.presentations.filter(function(p) { return p.workerId === w.id && p.status === 'done'; }).length;
  var appsDeployed = DB.appProjects.filter(function(a) { return a.workerId === w.id && a.status === 'deployed'; }).length;
  var booksDone = DB.bookProjects.filter(function(b) { return b.editorId === w.id && b.status === 'complete'; }).length;
  var bossSolved = (DB.bossBattles || []).filter(function(bb) { return (bb.solvedBy || []).indexOf(w.id) !== -1; }).length;

  var checks = [
    { key: 'firstFlight', cond: completedDocs >= 1 },
    { key: 'eagleEye', cond: reviewCount >= 10 },
    { key: 'scholar', cond: learningCompleted >= 20 },
    { key: 'promptWizard', cond: promptsAdded >= 5 },
    { key: 'qualityChampion', cond: fiveStarDocs >= 10 },
    { key: 'reviewerPro', cond: reviewCount >= 25 },
    { key: 'streakMaster', cond: DB.teamStreak >= 10 },
    { key: 'presenterPro', cond: presDone >= 1 },
    { key: 'appBuilder', cond: appsDeployed >= 1 },
    { key: 'bookEditor', cond: booksDone >= 1 },
    { key: 'bossSlayer', cond: bossSolved >= 3 },
    { key: 'personaMaster', cond: learningCompleted >= 25 }
  ];

  checks.forEach(function(c) {
    if (c.cond && w.badges.indexOf(c.key) === -1) {
      w.badges.push(c.key);
      addActivity('🎖️', w.name + ' earned badge: ' + BADGES[c.key].icon + ' ' + BADGES[c.key].name + '!');
      tool.notify(w.name + ' earned: ' + BADGES[c.key].name + '!', 'success');
    }
  });
}

/* ── Tasks Page ── */
function renderTasks() {
  updateStreak();
  // Populate filter dropdowns
  var workerFilter = el('filter-worker');
  var currentFilterVal = workerFilter.value;
  workerFilter.innerHTML = '<option value="">All Workers</option>' +
    DB.workers.map(function(w) { return '<option value="' + w.id + '">' + esc(w.name) + '</option>'; }).join('');
  workerFilter.value = currentFilterVal;

  var filterW = el('filter-worker').value;
  var filterS = el('filter-status').value;

  var filtered = DB.subjects.filter(function(s) {
    if (filterW && s.assignedTo !== filterW) return false;
    if (filterS && s.status !== filterS) return false;
    return true;
  });

  var tbody = el('tasks-tbody');
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-text">No subjects found. Click "+ Add Subject" to start!</div></div></td></tr>';
  } else {
    tbody.innerHTML = filtered.map(function(s) {
      var worker = DB.workers.find(function(w) { return w.id === s.assignedTo; });
      var workerName = worker ? worker.name : 'Unassigned';
      var gatesPassed = (s.gates || []).filter(function(g) { return g.passed; }).length;
      var stars = '';
      for (var i = 1; i <= 5; i++) stars += '<span class="' + (i <= (s.qualityScore || 0) ? '' : 'empty') + '">★</span>';
      var gateDotsHTML = QUALITY_GATES.map(function(g) {
        var gd = (s.gates || []).find(function(gg) { return gg.gate === g; });
        return '<span class="gate-dot' + (gd && gd.passed ? ' passed' : '') + '" title="' + GATE_LABELS[g] + '"></span>';
      }).join('');
      return '<tr>' +
        '<td><strong>' + esc(s.topic) + '</strong>' + (s.reviewCycle ? ' <span style="font-size:9px;color:var(--text-secondary);">(C' + s.reviewCycle + ')</span>' : '') + '</td>' +
        '<td>' + esc(s.grade || '—') + '</td>' +
        '<td>' + esc(workerName) + '</td>' +
        '<td><span class="badge badge-' + (s.status || 'pending') + '">' + (s.status || 'pending') + '</span></td>' +
        '<td><span class="quality-stars">' + stars + '</span></td>' +
        '<td><div class="gate-dots">' + gateDotsHTML + '</div> <span style="font-size:10px;color:var(--text-secondary);">' + gatesPassed + '/4</span></td>' +
        '<td>' +
          '<button class="btn btn-sm btn-outline" onclick="editSubject(\'' + s.id + '\')" title="Edit">✏️</button> ' +
          '<button class="btn btn-sm btn-outline" onclick="deleteSubject(\'' + s.id + '\')" title="Delete">🗑️</button> ' +
          (s.status === 'pending' ? '<button class="btn btn-sm btn-success" onclick="startSubject(\'' + s.id + '\')">Start</button>' : '') +
          (s.status === 'in-progress' ? '<button class="btn btn-sm btn-primary" onclick="completeSubject(\'' + s.id + '\')">Done</button>' : '') +
          (s.status === 'done' ? '<button class="btn btn-sm btn-warning" onclick="openReview(\'' + s.id + '\')">Review</button>' : '') +
          (s.status === 'needs-fix' ? '<button class="btn btn-sm btn-warning" onclick="showFixView(\'' + s.id + '\')">🔧 Fix Issues (' + ((s.reviewFindings||[]).filter(function(f){return f.status==="open";}).length) + ')</button>' : '') +
          (s.status === 'fixes-submitted' ? '<button class="btn btn-sm btn-primary" onclick="openReview(\'' + s.id + '\')">Verify Fixes</button>' : '') +
        '</td>' +
      '</tr>';
    }).join('');
  }
}

function editSubject(id) {
  var s = id ? DB.subjects.find(function(ss) { return ss.id === id; }) : null;
  editingSubjectId = id || null;
  var isNew = !s;
  var topic = s ? s.topic : '';
  var grade = s ? s.grade : '';
  var assignedTo = s ? s.assignedTo : '';
  var status = s ? s.status : 'pending';

  var workerOpts = DB.workers.map(function(w) {
    return '<option value="' + w.id + '"' + (w.id === assignedTo ? ' selected' : '') + '>' + esc(w.name) + '</option>';
  }).join('');

  var statusOpts = ['pending', 'in-progress', 'done', 'needs-fix', 'fixes-submitted', 'reviewed'].map(function(st) {
    return '<option value="' + st + '"' + (st === status ? ' selected' : '') + '>' + st + '</option>';
  }).join('');

  var modalHTML =
    '<h3>' + (isNew ? '➕ Add New Subject' : '✏️ Edit Subject') + '</h3>' +
    '<div class="form-field"><label class="form-label">Subject / Topic</label><input type="text" class="form-input" id="modal-topic" value="' + esc(topic) + '" placeholder="e.g. Quadratic Equations" style="width:100%"></div>' +
    '<div class="form-grid">' +
      '<div class="form-field"><label class="form-label">Grade Level</label><input type="text" class="form-input" id="modal-grade" value="' + esc(grade) + '" placeholder="e.g. Grade 9" style="width:100%"></div>' +
      '<div class="form-field"><label class="form-label">Assigned To</label><select class="form-input" id="modal-worker" style="width:100%"><option value="">— Select —</option>' + workerOpts + '</select></div>' +
    '</div>' +
    '<div class="form-field"><label class="form-label">Status</label><select class="form-input" id="modal-status" style="width:100%">' + statusOpts + '</select></div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
      '<button class="btn btn-primary" onclick="saveSubject()">' + (isNew ? 'Add Subject' : 'Save Changes') + '</button>' +
    '</div>';
  showModal(modalHTML);
}

function saveSubject() {
  var topic = el('modal-topic').value.trim();
  var grade = el('modal-grade').value.trim();
  var assignedTo = el('modal-worker').value || currentWorkerId;
  var status = el('modal-status').value;
  if (!topic) { tool.notify('Please enter a subject/topic name.', 'warning'); return; }

  if (editingSubjectId) {
    var s = DB.subjects.find(function(ss) { return ss.id === editingSubjectId; });
    if (s) {
      var oldStatus = s.status;
      s.topic = topic;
      s.grade = grade;
      s.assignedTo = assignedTo;
      s.status = status;
      if (status === 'done' && oldStatus !== 'done') {
        addActivity('✅', 'Subject completed: ' + topic);
        if (assignedTo) {
          var w = DB.workers.find(function(ww) { return ww.id === assignedTo; });
          if (w) { w.xp = (w.xp || 0) + 25; checkBadges(assignedTo); }
        }
      }
    }
  } else {
    DB.subjects.push({
      id: genId(),
      topic: topic,
      grade: grade,
      assignedTo: assignedTo,
      status: status,
      qualityScore: null,
      gates: [],
      createdAt: new Date().toISOString()
    });
    addActivity('📝', 'New subject added: ' + topic);
  }
  closeModal();
  persist();
  renderTasks();
}

function startSubject(id) {
  var s = DB.subjects.find(function(ss) { return ss.id === id; });
  if (!s) return;
  s.status = 'in-progress';
  s.startedAt = new Date().toISOString();
  addActivity('▶️', 'Started working on: ' + s.topic);
  persist();
  renderTasks();
}

function completeSubject(id) {
  var s = DB.subjects.find(function(ss) { return ss.id === id; });
  if (!s) return;
  s.status = 'done';
  s.completedAt = new Date().toISOString();
  if (s.assignedTo) {
    var w = DB.workers.find(function(ww) { return ww.id === s.assignedTo; });
    if (w) {
      w.xp = (w.xp || 0) + 25;
      addActivity('✅', w.name + ' completed: ' + s.topic + ' (+25 XP)');
      checkBadges(s.assignedTo);
    }
  }
  persist();
  renderTasks();
  updateNavBadges();
  // If current user completed their own task, notify them
  if (s.assignedTo === currentWorkerId) {
    tool.notify('Task completed! +25 XP earned. Great work! 🎉', 'success');
  }
}

function deleteSubject(id) {
  var s = DB.subjects.find(function(ss) { return ss.id === id; });
  if (!s) return;
  if (!confirm('Delete "' + s.topic + '"? This cannot be undone.')) return;
  DB.subjects = DB.subjects.filter(function(ss) { return ss.id !== id; });
  DB.reviews = DB.reviews.filter(function(r) { return r.subjectId !== id; });
  addActivity('🗑️', 'Deleted subject: ' + s.topic);
  persist();
  renderTasks();
}

/* ── Learn Zone ── */
function getUncompletedLearningCount() {
  var allCards = getAllLearningCards();
  var completed = DB.completedLearning.filter(function(l) { return l.workerId === currentWorkerId || l.workerId === 'self'; }).map(function(l) { return l.learningId; });
  return allCards.filter(function(c) { return completed.indexOf(c.id) === -1; }).length;
}

function getAllLearningCards() {
  var cards = [];
  Object.keys(MICRO_LEARNING).forEach(function(cat) {
    MICRO_LEARNING[cat].forEach(function(l) { cards.push(l); });
  });
  (DB.customLearningCards || []).forEach(function(l) { cards.push(l); });
  return cards;
}

function getLearningCardsForCategory(cat) {
  var builtin = MICRO_LEARNING[cat] || [];
  var custom = (DB.customLearningCards || []).filter(function(c) { return c.category === cat; });
  return builtin.concat(custom);
}

function renderLearnZone() {
  updateStreak();
  var cards = getLearningCardsForCategory(currentLearnTab);
  var completedIds = DB.completedLearning.filter(function(l) { return l.workerId === currentWorkerId || l.workerId === 'self'; }).map(function(l) { return l.learningId; });
  var totalAll = getAllLearningCards().length;
  var completedAll = DB.completedLearning.filter(function(l) { return l.workerId === currentWorkerId || l.workerId === 'self'; }).length;
  el('learn-my-progress').textContent = '(' + completedAll + '/' + totalAll + ' completed)';

  // Show/hide manager toolbar
  el('learn-manager-toolbar').style.display = isManager() ? '' : 'none';

  var html = '';
  cards.forEach(function(card) {
    var completed = completedIds.indexOf(card.id) !== -1;
    var isCustom = !!(DB.customLearningCards || []).find(function(c) { return c.id === card.id; });
    html += '<div class="learn-card' + (completed ? ' completed' : '') + '" onclick="' + (completed ? '' : 'completeLearning(\'' + card.id + '\', \'' + currentLearnTab + '\')') + '">' +
      '<div class="learn-card-title">' + esc(card.title) + (isCustom ? ' <span style="font-size:10px;color:var(--accent);">(custom)</span>' : '') + '</div>' +
      '<div class="learn-card-body">' + esc(card.body) + '</div>' +
      '<span class="learn-card-xp">+ ' + card.xp + ' XP</span>' +
      (isManager() ? '<button class="btn btn-xs btn-outline" style="float:right;margin-top:4px;" onclick="event.stopPropagation();editLearningCard(\'' + card.id + '\')">✏️</button><button class="btn btn-xs btn-danger" style="float:right;margin-top:4px;margin-right:4px;" onclick="event.stopPropagation();deleteLearningCard(\'' + card.id + '\')">🗑️</button>' : '') +
    '</div>';
  });
  el('learn-content').innerHTML = html || '<div class="empty-state"><div class="empty-text">No cards in this category</div></div>';
  updateNavBadges();
}

/* ── Learning Card Management (Manager) ── */
function editLearningCard(id) {
  var card = null;
  var allCats = Object.keys(MICRO_LEARNING);
  if (id) {
    // Search built-in
    for (var c = 0; c < allCats.length; c++) {
      var found = MICRO_LEARNING[allCats[c]].find(function(l) { return l.id === id; });
      if (found) { card = found; card._category = allCats[c]; break; }
    }
    // Search custom
    if (!card) {
      card = (DB.customLearningCards || []).find(function(l) { return l.id === id; }) || null;
      if (card) card._category = card.category;
    }
  }
  // If no card found or creating new, treat as new card
  editingLearningCardId = id || null;
  var cat = card ? card._category : 'pedagogy';
  var catOpts = allCats.map(function(c) { return '<option value="' + c + '"' + (cat === c ? ' selected' : '') + '>' + c + '</option>'; }).join('');
  var modalHTML =
    '<h3>' + (id ? '✏️ Edit Learning Card' : '➕ Add New Learning Card') + '</h3>' +
    '<div class="form-field"><label class="form-label">Category</label><select class="form-input" id="modal-lc-cat" style="width:100%">' + catOpts + '</select></div>' +
    '<div class="form-field"><label class="form-label">Title</label><input type="text" class="form-input" id="modal-lc-title" value="' + esc(card ? card.title : '') + '" style="width:100%"></div>' +
    '<div class="form-field"><label class="form-label">Body / Content</label><textarea class="form-input" id="modal-lc-body" style="width:100%;min-height:100px;">' + esc(card ? card.body : '') + '</textarea></div>' +
    '<div class="form-field"><label class="form-label">XP Reward</label><input type="number" class="form-input" id="modal-lc-xp" value="' + (card ? card.xp || 5 : 5) + '" min="1" style="width:100px"></div>' +
    '<div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveLearningCard()">' + (id ? 'Save' : 'Add Card') + '</button></div>';
  showModal(modalHTML);
}

function saveLearningCard() {
  var cat = el('modal-lc-cat').value;
  var title = el('modal-lc-title').value.trim();
  var body = el('modal-lc-body').value.trim();
  var xp = parseInt(el('modal-lc-xp').value) || 5;
  if (!title || !body) { tool.notify('Title and body required.', 'warning'); return; }
  var id = editingLearningCardId || genId();
  // Remove from custom cards if exists
  DB.customLearningCards = (DB.customLearningCards || []).filter(function(c) { return c.id !== id; });
  // Add/update
  DB.customLearningCards.push({ id: id, title: title, body: body, xp: xp, category: cat });
  closeModal();
  persist();
  renderLearnZone();
  addActivity('🎓', 'Learning card updated: ' + title);
}

function deleteLearningCard(id) {
  var card = (DB.customLearningCards || []).find(function(c) { return c.id === id; });
  if (!card) { tool.notify('Built-in cards cannot be deleted. Only custom cards can be removed.', 'warning'); return; }
  if (!confirm('Delete learning card "' + card.title + '"?')) return;
  DB.customLearningCards = (DB.customLearningCards || []).filter(function(c) { return c.id !== id; });
  DB.completedLearning = DB.completedLearning.filter(function(l) { return l.learningId !== id; });
  persist();
  renderLearnZone();
}

function completeLearning(learningId, category) {
  if (DB.completedLearning.some(function(l) { return l.learningId === learningId && (l.workerId === currentWorkerId || l.workerId === 'self'); })) return;
  DB.completedLearning.push({ learningId: learningId, category: category, workerId: currentWorkerId || 'self', completedAt: new Date().toISOString() });
  var card = null;
  var cats = MICRO_LEARNING[category] || [];
  for (var i = 0; i < cats.length; i++) { if (cats[i].id === learningId) { card = cats[i]; break; } }
  var xpEarned = card ? card.xp : 5;
  // Award XP to the current worker (not split across team)
  var myW = getMyWorker();
  if (myW) {
    myW.xp = (myW.xp || 0) + xpEarned;
    checkBadges(currentWorkerId);
  }
  addActivity('🎓', (myW ? myW.name : 'You') + ' completed learning: ' + (card ? card.title : learningId) + ' (+' + xpEarned + ' XP)');
  tool.notify('Learning complete! +' + xpEarned + ' XP earned.', 'success');
  persist();
  renderLearnZone();
  updateNavBadges();
}

/* ── Peer Review ── */
function renderReview() {
  updateStreak();
  // Items that are "done" (first review), "needs-fix" (returned), or "fixes-submitted" (waiting verification)
  var reviewableSubjects = DB.subjects.filter(function(s) {
    return s.status === 'done' || s.status === 'needs-fix' || s.status === 'fixes-submitted';
  });
  var existingReviews = DB.reviews;

  var html = '<div style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">';
  html += '📋 Awaiting review: <strong>' + reviewableSubjects.length + '</strong>';
  var needsFixCount = DB.subjects.filter(function(s) { return s.status === 'needs-fix'; }).length;
  var fixesSubmittedCount = DB.subjects.filter(function(s) { return s.status === 'fixes-submitted'; }).length;
  if (needsFixCount) html += ' · 🔧 Needs fixes: <strong>' + needsFixCount + '</strong>';
  if (fixesSubmittedCount) html += ' · ✅ Fixes submitted: <strong>' + fixesSubmittedCount + '</strong>';
  html += '</div>';

  if (!reviewableSubjects.length) {
    html += '<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-text">No documents waiting for review. Great job!</div></div>';
  } else {
    html += reviewableSubjects.map(function(s) {
      var worker = DB.workers.find(function(w) { return w.id === s.assignedTo; });
      var findings = s.reviewFindings || [];
      var openFindings = findings.filter(function(f) { return f.status === 'open'; }).length;
      var statusLabel = s.status === 'needs-fix' ? '🔧 Needs Fixes' : s.status === 'fixes-submitted' ? '✅ Fixes Submitted' : '📝 Ready for Review';
      var statusColor = s.status === 'needs-fix' ? '#d97706' : s.status === 'fixes-submitted' ? '#16a34a' : '#2563eb';
      return '<div class="card" style="margin-bottom:10px;border-left:4px solid ' + statusColor + ';">' +
        '<div class="card-header">' +
          '<span class="card-title">' + esc(s.topic) + ' <span style="font-weight:400;color:var(--text-secondary);font-size:12px;">(Gr ' + esc(s.grade) + ')</span></span>' +
          '<span style="font-size:11px;">' +
            '<span style="color:' + statusColor + ';font-weight:600;">' + statusLabel + '</span>' +
            ' · By: ' + (worker ? worker.name : 'Unknown') +
            (s.reviewCycle ? ' · Cycle #' + s.reviewCycle : '') +
            (openFindings ? ' · ' + openFindings + ' open issues' : '') +
          '</span>' +
        '</div>' +
        '<div class="card-body">' +
          '<button class="btn btn-sm btn-primary" onclick="openReview(\'' + s.id + '\')">🔍 Open Review</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  el('review-queue').innerHTML = html;
  el('review-detail-card').style.display = reviewingSubjectId ? '' : 'none';

  if (reviewingSubjectId) {
    var subj = DB.subjects.find(function(s) { return s.id === reviewingSubjectId; });
    if (subj) {
      if (!subj.reviewFindings) subj.reviewFindings = [];
      if (!subj.reviewStatus) subj.reviewStatus = 'pending';
      var subjReviews = DB.reviews.filter(function(r) { return r.subjectId === reviewingSubjectId; });
      var worker = DB.workers.find(function(w) { return w.id === subj.assignedTo; });
      el('review-detail-title').textContent = 'Reviewing: ' + subj.topic + ' by ' + (worker ? worker.name : 'Unknown');

      // Quality Gates
      var gatesHTML = QUALITY_GATES.map(function(g) {
        var gd = (subj.gates || []).find(function(gg) { return gg.gate === g; });
        return '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);">' +
          '<span style="font-size:16px;">' + (gd && gd.passed ? '✅' : '⬜') + '</span>' +
          '<span style="flex:1;font-weight:500;">' + GATE_LABELS[g] + '</span>' +
          '<button class="btn btn-xs ' + (gd && gd.passed ? 'btn-outline' : 'btn-success') + '" onclick="toggleGate(\'' + subj.id + '\', \'' + g + '\')">' + (gd && gd.passed ? 'Undo' : 'Pass') + '</button>' +
        '</div>';
      }).join('');

      // Findings List
      var findingsHTML = '<div style="margin-top:12px;"><div class="form-label">🔍 Issues Found (' + subj.reviewFindings.length + ')</div>';
      if (!subj.reviewFindings.length) {
        findingsHTML += '<div style="font-size:11px;color:var(--text-secondary);padding:8px 0;">No issues logged yet. Use manual check or AI analysis below.</div>';
      } else {
        findingsHTML += subj.reviewFindings.map(function(f, fi) {
          var sevColors = { low: '#16a34a', medium: '#d97706', high: '#dc2626', critical: '#7c3aed' };
          var sevIcons = { low: '🟢', medium: '🟡', high: '🔴', critical: '🟣' };
          var statusIcon = f.status === 'verified' ? '✅' : f.status === 'fixed' ? '🔧' : '⚠️';
          return '<div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:11px;">' +
            '<span style="font-size:14px;">' + statusIcon + '</span>' +
            '<span style="color:' + (sevColors[f.severity] || '#64748b') + ';font-weight:600;min-width:50px;">' + (sevIcons[f.severity] || '') + ' ' + (f.severity || 'medium') + '</span>' +
            '<span style="flex:1;"><strong>' + esc(f.gate ? GATE_LABELS[f.gate] || f.gate : 'General') + ':</strong> ' + esc(f.description) + '</span>' +
            '<button class="btn btn-xs btn-outline" onclick="editFinding(\'' + subj.id + '\', ' + fi + ')" title="Edit">✏️</button>' +
            '<button class="btn btn-xs btn-danger" onclick="removeFinding(\'' + subj.id + '\', ' + fi + ')" title="Remove">✕</button>' +
          '</div>';
        }).join('');
      }
      findingsHTML += '<button class="btn btn-sm btn-outline" style="margin-top:6px;" onclick="addFinding(\'' + subj.id + '\')">+ Add Issue</button></div>';

      // AI Analysis Section
      var aiHTML = '<div style="margin-top:16px;background:#f8fafc;border:1px dashed var(--border);border-radius:var(--radius-sm);padding:14px;">' +
        '<div class="form-label">🤖 AI-Assisted Review</div>' +
        '<div style="font-size:11px;color:var(--text-secondary);margin-bottom:8px;">Paste the document content below and click "Analyze with AI" to automatically detect quality issues.</div>' +
        '<textarea class="form-input" id="review-ai-content" placeholder="Paste the full document content here for AI analysis..." style="width:100%;min-height:80px;font-size:11px;"></textarea>' +
        '<div style="margin-top:8px;display:flex;gap:6px;align-items:center;">' +
          '<button class="btn btn-sm btn-accent" id="btn-ai-review" onclick="runAiReview(\'' + subj.id + '\')">🤖 Analyze with AI</button>' +
          '<span id="ai-review-status" style="font-size:11px;color:var(--text-secondary);"></span>' +
        '</div>' +
      '</div>';

      // Previous Reviews
      var pastReviewsHTML = subjReviews.length ? subjReviews.map(function(r) {
        var reviewer = DB.workers.find(function(w) { return w.id === r.reviewerId; });
        return '<div style="padding:6px 0;font-size:11px;border-bottom:1px solid var(--border);">' +
          '<strong>' + (reviewer ? reviewer.name : 'Someone') + ':</strong> ' + esc(r.notes || 'No notes') +
          ' <span style="color:var(--text-secondary);">— ' + r.qualityScore + '/5 ⭐ · Cycle #' + (r.reviewCycle || 1) + '</span>' +
        '</div>';
      }).join('') : '<div style="font-size:11px;color:var(--text-secondary);">No reviews yet</div>';

      el('review-detail-body').innerHTML =
        '<div class="form-label">Quality Gates</div>' + gatesHTML +
        findingsHTML +
        aiHTML +
        '<div style="margin-top:12px;"><div class="form-label">Quality Score (1-5)</div>' +
        '<select class="form-input" id="review-score" style="width:100%">' +
          '<option value="5">⭐⭐⭐⭐⭐ (5) — Excellent</option>' +
          '<option value="4">⭐⭐⭐⭐ (4) — Good</option>' +
          '<option value="3">⭐⭐⭐ (3) — Acceptable</option>' +
          '<option value="2">⭐⭐ (2) — Needs Improvement</option>' +
          '<option value="1">⭐ (1) — Poor</option>' +
        '</select></div>' +
        '<div class="form-field"><label class="form-label">Overall Feedback Notes</label>' +
        '<textarea class="form-input" id="review-notes" placeholder="Summary feedback for the creator..." style="width:100%"></textarea></div>' +
        '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">' +
          '<button class="btn btn-success" onclick="approveReview(\'' + subj.id + '\')">✅ Approve (+15 XP)</button>' +
          '<button class="btn btn-warning" onclick="requestFixes(\'' + subj.id + '\')">🔧 Request Fixes</button>' +
          '<button class="btn btn-outline" onclick="reviewingSubjectId=null;renderReview();">Back to Queue</button>' +
        '</div>' +
        '<div style="margin-top:16px;"><div class="form-label">📜 Review History</div>' + pastReviewsHTML + '</div>';
    }
  }
}

/* ── Findings Management ── */
function addFinding(subjId) {
  var subj = DB.subjects.find(function(s) { return s.id === subjId; });
  if (!subj) return;
  if (!subj.reviewFindings) subj.reviewFindings = [];
  var gateOpts = QUALITY_GATES.map(function(g) { return '<option value="' + g + '">' + GATE_LABELS[g] + '</option>'; }).join('');
  gateOpts = '<option value="general">📋 General</option>' + gateOpts;
  var modalHTML =
    '<h3>➕ Add Issue Finding</h3>' +
    '<div class="form-field"><label class="form-label">Related Quality Gate</label><select class="form-input" id="modal-finding-gate" style="width:100%">' + gateOpts + '</select></div>' +
    '<div class="form-field"><label class="form-label">Severity</label><select class="form-input" id="modal-finding-severity" style="width:100%"><option value="low">🟢 Low — Minor suggestion</option><option value="medium" selected>🟡 Medium — Should be fixed</option><option value="high">🔴 High — Must be fixed</option><option value="critical">🟣 Critical — Blocker</option></select></div>' +
    '<div class="form-field"><label class="form-label">Description</label><textarea class="form-input" id="modal-finding-desc" placeholder="Describe the issue clearly so the creator can fix it..." style="width:100%;min-height:80px;"></textarea></div>' +
    '<div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveFinding(\'' + subjId + '\')">Add Issue</button></div>';
  showModal(modalHTML);
}

function saveFinding(subjId) {
  var subj = DB.subjects.find(function(s) { return s.id === subjId; });
  if (!subj) return;
  var gate = el('modal-finding-gate').value;
  var severity = el('modal-finding-severity').value;
  var desc = el('modal-finding-desc').value.trim();
  if (!desc) { tool.notify('Please describe the issue.', 'warning'); return; }
  if (!subj.reviewFindings) subj.reviewFindings = [];
  subj.reviewFindings.push({
    id: genId(), gate: gate, severity: severity, description: desc,
    status: 'open', foundBy: currentWorkerId, foundAt: new Date().toISOString()
  });
  closeModal();
  persist();
  renderReview();
  tool.notify('Issue added. ' + subj.reviewFindings.filter(function(f){return f.status==='open';}).length + ' open issues.', 'info');
}

function editFinding(subjId, idx) {
  var subj = DB.subjects.find(function(s) { return s.id === subjId; });
  if (!subj || !subj.reviewFindings || !subj.reviewFindings[idx]) return;
  var f = subj.reviewFindings[idx];
  var gateOpts = QUALITY_GATES.map(function(g) { return '<option value="' + g + '"' + (f.gate === g ? ' selected' : '') + '>' + GATE_LABELS[g] + '</option>'; }).join('');
  gateOpts = '<option value="general"' + (f.gate === 'general' ? ' selected' : '') + '>📋 General</option>' + gateOpts;
  var sevs = ['low','medium','high','critical'];
  var sevLabels = { low: '🟢 Low', medium: '🟡 Medium', high: '🔴 High', critical: '🟣 Critical' };
  var sevOpts = sevs.map(function(s) { return '<option value="' + s + '"' + (f.severity === s ? ' selected' : '') + '>' + sevLabels[s] + '</option>'; }).join('');
  var modalHTML =
    '<h3>✏️ Edit Issue</h3>' +
    '<div class="form-field"><label class="form-label">Quality Gate</label><select class="form-input" id="modal-finding-gate" style="width:100%">' + gateOpts + '</select></div>' +
    '<div class="form-field"><label class="form-label">Severity</label><select class="form-input" id="modal-finding-severity" style="width:100%">' + sevOpts + '</select></div>' +
    '<div class="form-field"><label class="form-label">Description</label><textarea class="form-input" id="modal-finding-desc" style="width:100%;min-height:80px;">' + esc(f.description) + '</textarea></div>' +
    '<div class="form-field"><label class="form-label">Status</label><select class="form-input" id="modal-finding-status" style="width:100%"><option value="open"' + (f.status === 'open' ? ' selected' : '') + '>⚠️ Open</option><option value="fixed"' + (f.status === 'fixed' ? ' selected' : '') + '>🔧 Fixed</option><option value="verified"' + (f.status === 'verified' ? ' selected' : '') + '>✅ Verified</option></select></div>' +
    '<div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="updateFinding(\'' + subjId + '\', ' + idx + ')">Save</button></div>';
  showModal(modalHTML);
}

function updateFinding(subjId, idx) {
  var subj = DB.subjects.find(function(s) { return s.id === subjId; });
  if (!subj || !subj.reviewFindings || !subj.reviewFindings[idx]) return;
  subj.reviewFindings[idx].gate = el('modal-finding-gate').value;
  subj.reviewFindings[idx].severity = el('modal-finding-severity').value;
  subj.reviewFindings[idx].description = el('modal-finding-desc').value.trim();
  subj.reviewFindings[idx].status = el('modal-finding-status').value;
  if (subj.reviewFindings[idx].status === 'fixed' && !subj.reviewFindings[idx].fixedAt) {
    subj.reviewFindings[idx].fixedAt = new Date().toISOString();
  }
  closeModal(); persist(); renderReview();
}

function removeFinding(subjId, idx) {
  var subj = DB.subjects.find(function(s) { return s.id === subjId; });
  if (!subj || !subj.reviewFindings) return;
  if (!confirm('Remove this issue?')) return;
  subj.reviewFindings.splice(idx, 1);
  persist(); renderReview();
}

/* ── AI-Powered Review ── */
function runAiReview(subjId) {
  var subj = DB.subjects.find(function(s) { return s.id === subjId; });
  if (!subj) return;
  var content = el('review-ai-content').value.trim();
  if (!content) { tool.notify('Please paste the document content first.', 'warning'); return; }
  el('btn-ai-review').disabled = true;
  el('ai-review-status').textContent = '⏳ Analyzing with AI...';

  var prompt = 'You are a math education quality reviewer. Analyze the following math educational content and identify ALL quality issues. For each issue, specify:\n' +
    '1. Which quality gate it relates to: accuracy (math errors), clarity (unclear explanations), visual (missing/bad diagrams), or engagement (boring/not interactive)\n' +
    '2. Severity: low (minor suggestion), medium (should fix), high (must fix), critical (blocker)\n' +
    '3. A clear description of the problem\n\n' +
    'Respond in JSON format: [{"gate":"accuracy|clarity|visual|engagement|general","severity":"low|medium|high|critical","description":"..."}]\n\n' +
    'CONTENT TO REVIEW:\n' + content.slice(0, 8000);

  tool.requestAI(prompt, 'Math content quality review for topic: ' + subj.topic + ' (Grade ' + subj.grade + ')', function(err, response) {
    el('btn-ai-review').disabled = false;
    if (err) { el('ai-review-status').textContent = '❌ AI error: ' + err; tool.notify('AI review failed: ' + err, 'error'); return; }
    try {
      // Try to extract JSON from response
      var jsonStr = response;
      var jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) jsonStr = jsonMatch[0];
      var findings = JSON.parse(jsonStr);
      if (!Array.isArray(findings)) throw new Error('Not an array');
      if (!subj.reviewFindings) subj.reviewFindings = [];
      var added = 0;
      findings.forEach(function(f) {
        if (f.description && f.description.trim()) {
          subj.reviewFindings.push({
            id: genId(), gate: f.gate || 'general', severity: f.severity || 'medium',
            description: f.description.trim(), status: 'open', foundBy: 'ai',
            foundAt: new Date().toISOString()
          });
          added++;
        }
      });
      persist(); renderReview();
      el('ai-review-status').textContent = '✅ AI found ' + added + ' issue(s)!';
      tool.notify('AI analysis complete! Found ' + added + ' potential issues.', 'success');
      addActivity('🤖', 'AI review completed for: ' + subj.topic + ' (' + added + ' issues found)');
    } catch(e) {
      el('ai-review-status').textContent = '⚠️ Could not parse AI response. You can manually add issues.';
      tool.notify('AI response could not be parsed. Try again or add issues manually.', 'warning');
    }
  });
}

/* ── Review Actions ── */
function approveReview(subjId) {
  var subj = DB.subjects.find(function(s) { return s.id === subjId; });
  if (!subj) return;
  var score = parseInt(el('review-score').value);
  var notes = el('review-notes').value.trim();

  // Check if all gates passed
  var gatesPassed = QUALITY_GATES.filter(function(g) {
    var gd = (subj.gates || []).find(function(gg) { return gg.gate === g; });
    return gd && gd.passed;
  }).length;
  if (gatesPassed < 4) {
    if (!confirm('Only ' + gatesPassed + '/4 quality gates passed. Approve anyway?')) return;
  }

  // Check if there are open findings
  var openFindings = (subj.reviewFindings || []).filter(function(f) { return f.status === 'open'; });
  if (openFindings.length > 0) {
    if (!confirm('There are ' + openFindings.length + ' open issues. Approve anyway? (Consider using "Request Fixes" instead.)')) return;
  }

  var cycle = (subj.reviewCycle || 0) + 1;
  subj.reviewCycle = cycle;

  DB.reviews.push({
    id: genId(), subjectId: subjId, reviewerId: currentWorkerId || 'self',
    qualityScore: score, notes: notes, reviewCycle: cycle, createdAt: new Date().toISOString()
  });

  // Update subject quality
  var allScores = DB.reviews.filter(function(r) { return r.subjectId === subjId; }).map(function(r) { return r.qualityScore; });
  subj.qualityScore = Math.round(allScores.reduce(function(a, b) { return a + b; }, 0) / allScores.length);
  subj.status = 'reviewed';
  subj.reviewStatus = 'approved';

  // Award XP to reviewer
  var myW = getMyWorker();
  if (myW) { myW.xp = (myW.xp || 0) + 15; checkBadges(currentWorkerId); }

  addActivity('✅', 'Review approved: ' + subj.topic + ' (' + score + '/5 ⭐, Cycle #' + cycle + ')');
  tool.notify('Review approved! +15 XP. Quality: ' + score + '/5 ⭐', 'success');

  reviewingSubjectId = null;
  persist();
  renderReview();
  updateNavBadges();
}

function requestFixes(subjId) {
  var subj = DB.subjects.find(function(s) { return s.id === subjId; });
  if (!subj) return;
  var notes = el('review-notes').value.trim();

  // Auto-add a finding from the notes if provided and no findings exist
  if (notes && (!subj.reviewFindings || subj.reviewFindings.length === 0)) {
    if (!subj.reviewFindings) subj.reviewFindings = [];
    subj.reviewFindings.push({
      id: genId(), gate: 'general', severity: 'medium', description: notes,
      status: 'open', foundBy: currentWorkerId, foundAt: new Date().toISOString()
    });
  }

  var openFindings = (subj.reviewFindings || []).filter(function(f) { return f.status === 'open'; });
  if (openFindings.length === 0) {
    tool.notify('Please add at least one issue before requesting fixes.', 'warning');
    return;
  }

  var cycle = (subj.reviewCycle || 0) + 1;
  subj.reviewCycle = cycle;
  subj.status = 'needs-fix';
  subj.reviewStatus = 'needs-fix';

  // Save a review record
  DB.reviews.push({
    id: genId(), subjectId: subjId, reviewerId: currentWorkerId || 'self',
    qualityScore: 0, notes: notes || ('Requested fixes for ' + openFindings.length + ' issues'),
    reviewCycle: cycle, createdAt: new Date().toISOString()
  });

  var creator = DB.workers.find(function(w) { return w.id === subj.assignedTo; });
  addActivity('🔧', 'Fixes requested for: ' + subj.topic + ' (' + openFindings.length + ' issues, Cycle #' + cycle + ')');
  tool.notify('Fix request sent! ' + openFindings.length + ' issues for ' + (creator ? creator.name : 'creator') + ' to address.', 'warning');

  reviewingSubjectId = null;
  persist();
  renderReview();
  renderTasks();
  updateNavBadges();
}

/* ── Creator: Submit Fixes ── */
function submitFixes(subjId) {
  var subj = DB.subjects.find(function(s) { return s.id === subjId; });
  if (!subj) return;
  var findings = subj.reviewFindings || [];
  var openFindings = findings.filter(function(f) { return f.status === 'open'; });
  if (openFindings.length > 0) {
    if (!confirm(openFindings.length + ' issues are still open. Submit anyway?')) return;
  }
  subj.status = 'fixes-submitted';
  subj.reviewStatus = 'fixes-submitted';
  var myW = getMyWorker();
  if (myW) { myW.xp = (myW.xp || 0) + 10; checkBadges(currentWorkerId); }
  addActivity('✅', (myW ? myW.name : 'Creator') + ' submitted fixes for: ' + subj.topic + ' (+10 XP)');
  tool.notify('Fixes submitted for review! +10 XP. The reviewer will verify.', 'success');
  persist();
  renderTasks();
  updateNavBadges();
}

/* ── Creator: Mark finding as fixed ── */
function markFindingFixed(subjId, findingId) {
  var subj = DB.subjects.find(function(s) { return s.id === subjId; });
  if (!subj || !subj.reviewFindings) return;
  var f = subj.reviewFindings.find(function(ff) { return ff.id === findingId; });
  if (!f) return;
  f.status = f.status === 'fixed' ? 'open' : 'fixed';
  if (f.status === 'fixed') f.fixedAt = new Date().toISOString();
  persist();
  renderTasks();
}

/* ── Creator Fix View ── */
function showFixView(subjId) {
  var subj = DB.subjects.find(function(s) { return s.id === subjId; });
  if (!subj) return;
  var findings = subj.reviewFindings || [];
  var openCount = findings.filter(function(f) { return f.status === 'open'; }).length;
  var fixedCount = findings.filter(function(f) { return f.status === 'fixed'; }).length;
  var reviewer = DB.reviews.filter(function(r) { return r.subjectId === subjId; }).pop();
  var reviewerName = 'Unknown';
  if (reviewer) { var rw = DB.workers.find(function(w) { return w.id === reviewer.reviewerId; }); if (rw) reviewerName = rw.name; }

  var findingsHTML = findings.length ? findings.map(function(f) {
    var sevColors = { low: '#16a34a', medium: '#d97706', high: '#dc2626', critical: '#7c3aed' };
    var checked = f.status === 'fixed' ? ' checked' : '';
    return '<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:12px;">' +
      '<input type="checkbox" style="margin-top:2px;"' + checked + ' onchange="markFindingFixed(\'' + subjId + '\', \'' + f.id + '\');showFixView(\'' + subjId + '\');">' +
      '<span style="color:' + (sevColors[f.severity] || '#64748b') + ';font-weight:600;min-width:60px;">' + (f.severity || 'medium').toUpperCase() + '</span>' +
      '<span style="flex:1;"><strong>' + esc(f.gate ? GATE_LABELS[f.gate] || f.gate : 'General') + ':</strong> ' + esc(f.description) + '</span>' +
    '</div>';
  }).join('') : '<div style="font-size:12px;color:var(--text-secondary);">No issues found.</div>';

  var modalHTML =
    '<h3>🔧 Fix Issues: ' + esc(subj.topic) + '</h3>' +
    '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;">Reviewed by: <strong>' + reviewerName + '</strong> · Cycle #' + (subj.reviewCycle || 1) + ' · ' + openCount + ' open, ' + fixedCount + ' fixed</div>' +
    '<div style="max-height:300px;overflow-y:auto;">' + findingsHTML + '</div>' +
    '<div style="font-size:11px;color:var(--text-secondary);margin-top:8px;">✅ Check each issue after you fix it. Then click "Submit Fixes" to send back for verification.</div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-outline" onclick="closeModal()">Close</button>' +
      '<button class="btn btn-primary" onclick="closeModal();submitFixes(\'' + subjId + '\')">✅ Submit Fixes (+10 XP)</button>' +
    '</div>';
  showModal(modalHTML);
}

function openReview(subjectId) {
  reviewingSubjectId = subjectId;
  renderReview();
}

function toggleGate(subjectId, gate) {
  var s = DB.subjects.find(function(ss) { return ss.id === subjectId; });
  if (!s) return;
  if (!s.gates) s.gates = [];
  var gd = s.gates.find(function(gg) { return gg.gate === gate; });
  if (gd) {
    gd.passed = !gd.passed;
  } else {
    s.gates.push({ gate: gate, passed: true });
  }
  persist();
  renderReview();
}

/* ── Leaderboard ── */
function renderLeaderboard() {
  updateStreak();
  var sorted = [];
  switch (currentLbTab) {
    case 'xp':
      sorted = DB.workers.slice().sort(function(a, b) { return (b.xp || 0) - (a.xp || 0); });
      break;
    case 'quality':
      sorted = DB.workers.slice().sort(function(a, b) {
        var aDocs = DB.subjects.filter(function(s) { return s.assignedTo === a.id && s.qualityScore != null; });
        var bDocs = DB.subjects.filter(function(s) { return s.assignedTo === b.id && s.qualityScore != null; });
        var aAvg = aDocs.length ? aDocs.reduce(function(s, d) { return s + d.qualityScore; }, 0) / aDocs.length : 0;
        var bAvg = bDocs.length ? bDocs.reduce(function(s, d) { return s + d.qualityScore; }, 0) / bDocs.length : 0;
        return bAvg - aAvg;
      });
      break;
    case 'badges':
      sorted = DB.workers.slice().sort(function(a, b) { return (b.badges || []).length - (a.badges || []).length; });
      break;
    case 'reviews':
      sorted = DB.workers.slice().sort(function(a, b) {
        return DB.reviews.filter(function(r) { return r.reviewerId === b.id; }).length - DB.reviews.filter(function(r) { return r.reviewerId === a.id; }).length;
      });
      break;
  }

  var html = '';
  sorted.forEach(function(w, idx) {
    var lvl = getLevel(w.xp || 0);
    var rankClass = idx === 0 ? 'lb-rank-1' : idx === 1 ? 'lb-rank-2' : idx === 2 ? 'lb-rank-3' : '';
    var medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';
    var completedDocs = DB.subjects.filter(function(s) { return s.assignedTo === w.id && (s.status === 'done' || s.status === 'reviewed'); }).length;
    var reviewCount = DB.reviews.filter(function(r) { return r.reviewerId === w.id; }).length;
    var aDocs = DB.subjects.filter(function(s) { return s.assignedTo === w.id && s.qualityScore != null; });
    var avgQ = aDocs.length ? Math.round(aDocs.reduce(function(s, d) { return s + d.qualityScore; }, 0) / aDocs.length * 10) / 10 : 0;

    var valueDisplay = '';
    switch (currentLbTab) {
      case 'xp': valueDisplay = '<strong>' + (w.xp || 0) + ' XP</strong>'; break;
      case 'quality': valueDisplay = '<strong>' + avgQ + ' ⭐</strong> (' + aDocs.length + ' docs)'; break;
      case 'badges': valueDisplay = '<strong>' + (w.badges || []).length + ' badges</strong>'; break;
      case 'reviews': valueDisplay = '<strong>' + reviewCount + ' reviews</strong>'; break;
    }

    html += '<div class="lb-rank-item ' + rankClass + '">' +
      '<div class="lb-rank-num">' + (medal || (idx + 1)) + '</div>' +
      '<div style="width:36px;height:36px;border-radius:50%;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:18px;">' + (w.avatar || '👤') + '</div>' +
      '<div style="flex:1;"><div style="font-weight:700;font-size:14px;">' + esc(w.name) + '</div><div style="font-size:11px;color:var(--text-secondary);">' + lvl.icon + ' ' + lvl.name + ' · 📝' + completedDocs + ' docs · ⭐' + reviewCount + ' reviews</div></div>' +
      '<div style="text-align:right;">' + valueDisplay + '</div>' +
    '</div>';
  });

  el('lb-content').innerHTML = html || '<div class="empty-state"><div class="empty-text">No data yet</div></div>';
}

/* ── Prompt Lab ── */
function renderPrompts() {
  updateStreak();
  var filterCat = el('filter-prompt-category').value;
  var filtered = DB.prompts.filter(function(p) {
    if (filterCat && p.category !== filterCat) return false;
    return true;
  });

  var html = '';
  if (!filtered.length) {
    html = '<div class="empty-state"><div class="empty-icon">💡</div><div class="empty-text">No prompts in the library yet. Add your first prompt!</div></div>';
  } else {
    html = filtered.map(function(p) {
      var creator = DB.workers.find(function(w) { return w.id === p.createdBy; });
      return '<div class="prompt-card">' +
        '<div class="prompt-category">' + esc(p.category || 'General') + '</div>' +
        '<div class="prompt-name">' + esc(p.name) + '</div>' +
        '<div class="prompt-preview">' + esc((p.template || '').slice(0, 150)) + '...</div>' +
        '<div class="prompt-footer">' +
          '<span>By: ' + (creator ? creator.name : 'Unknown') + '</span>' +
          '<span>⭐ ' + (p.rating || 0) + '</span>' +
          '<button class="btn btn-xs btn-outline" onclick="editPrompt(\'' + p.id + '\')">✏️</button>' +
          '<button class="btn btn-xs btn-danger" onclick="deletePrompt(\'' + p.id + '\')">🗑️</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }
  el('prompts-grid').innerHTML = html;
}

function editPrompt(id) {
  var p = id ? DB.prompts.find(function(pp) { return pp.id === id; }) : null;
  editingPromptId = id || null;
  var isNew = !p;
  var categories = ['explanation', 'story', 'visual', 'practice', 'assessment'];
  var catOpts = categories.map(function(c) {
    return '<option value="' + c + '"' + (p && p.category === c ? ' selected' : '') + '>' + c + '</option>';
  }).join('');

  var modalHTML =
    '<h3>' + (isNew ? '💡 Add New Prompt' : '✏️ Edit Prompt') + '</h3>' +
    '<div class="form-field"><label class="form-label">Prompt Name</label><input type="text" class="form-input" id="modal-prompt-name" value="' + esc(p ? p.name : '') + '" placeholder="e.g. Grade 9 Algebra Explainer" style="width:100%"></div>' +
    '<div class="form-field"><label class="form-label">Category</label><select class="form-input" id="modal-prompt-cat" style="width:100%">' + catOpts + '</select></div>' +
    '<div class="form-field"><label class="form-label">Prompt Template</label><textarea class="form-input" id="modal-prompt-template" placeholder="Write your prompt template here... Use [TOPIC], [GRADE], etc. as placeholders." style="width:100%;min-height:120px;">' + esc(p ? p.template : '') + '</textarea></div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
      '<button class="btn btn-primary" onclick="savePrompt()">' + (isNew ? 'Add to Library' : 'Save Changes') + '</button>' +
    '</div>';
  showModal(modalHTML);
}

function savePrompt() {
  var name = el('modal-prompt-name').value.trim();
  var category = el('modal-prompt-cat').value;
  var template = el('modal-prompt-template').value.trim();
  if (!name || !template) { tool.notify('Name and template are required.', 'warning'); return; }

  if (editingPromptId) {
    var p = DB.prompts.find(function(pp) { return pp.id === editingPromptId; });
    if (p) { p.name = name; p.category = category; p.template = template; }
  } else {
    DB.prompts.push({
      id: genId(),
      name: name,
      category: category,
      template: template,
      createdBy: currentUser || 'self',
      rating: 0,
      createdAt: new Date().toISOString()
    });
    addActivity('💡', 'New prompt added to library: ' + name);
  }
  closeModal();
  persist();
  renderPrompts();
}

function deletePrompt(id) {
  var p = DB.prompts.find(function(pp) { return pp.id === id; });
  if (!p) return;
  if (!confirm('Delete prompt "' + p.name + '"?')) return;
  DB.prompts = DB.prompts.filter(function(pp) { return pp.id !== id; });
  addActivity('🗑️', 'Prompt removed: ' + p.name);
  persist();
  renderPrompts();
}

/* ── Presentations ── */
function renderPresentations() {
  updateStreak();
  // Toggle sub-tab visibility
  el('pres-calendar').style.display = currentPresTab === 'calendar' ? '' : 'none';
  el('pres-calendar-toolbar').style.display = currentPresTab === 'calendar' ? '' : 'none';
  el('pres-catalog').style.display = currentPresTab === 'catalog' ? '' : 'none';

  if (currentPresTab === 'catalog') {
    renderPresCatalog();
    return;
  }

  var filterW = el('filter-pres-worker');
  var currentVal = filterW.value;
  filterW.innerHTML = '<option value="">All Presenters</option>' +
    DB.workers.map(function(w) { return '<option value="' + w.id + '">' + esc(w.name) + '</option>'; }).join('');
  filterW.value = currentVal;

  var filtered = DB.presentations.filter(function(p) {
    if (filterW.value && p.workerId !== filterW.value) return false;
    return true;
  });

  filtered.sort(function(a, b) { return (a.scheduledDate || '').localeCompare(b.scheduledDate || ''); });

  var html = '';
  if (!filtered.length) {
    html = '<div class="empty-state"><div class="empty-icon">🎤</div><div class="empty-text">No presentations scheduled yet. Click "+ Schedule Presentation" to start!</div></div>';
  } else {
    html = filtered.map(function(p) {
      var worker = DB.workers.find(function(w) { return w.id === p.workerId; });
      var d = new Date(p.scheduledDate + 'T00:00:00');
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var isDone = p.status === 'done';
      var avgScore = 0;
      if (p.scores) {
        var vals = [p.scores.clarity, p.scores.usefulness, p.scores.delivery, p.scores.visuals].filter(function(v) { return v != null; });
        if (vals.length) avgScore = Math.round(vals.reduce(function(a,b){return a+b;},0) / vals.length * 10) / 10;
      }
      return '<div class="pres-card ' + (isDone ? 'pres-done' : 'pres-upcoming') + '">' +
        '<div class="pres-date"><div class="pres-day">' + d.getDate() + '</div><div class="pres-month">' + months[d.getMonth()] + '</div></div>' +
        '<div class="pres-info">' +
          '<div class="pres-topic">' + esc(p.topic) + '</div>' +
          '<div class="pres-presenter">By: ' + (worker ? worker.name : 'Unknown') + ' · ' + (p.status === 'done' ? '✅ Presented' : '📅 Upcoming') + '</div>' +
        '</div>' +
        (isDone ? '<div class="pres-scores">' +
          '<div class="pres-score-item"><div class="pres-score-val">' + (p.scores ? p.scores.clarity || '-' : '-') + '</div>Clarity</div>' +
          '<div class="pres-score-item"><div class="pres-score-val">' + (p.scores ? p.scores.usefulness || '-' : '-') + '</div>Useful</div>' +
          '<div class="pres-score-item"><div class="pres-score-val">' + (p.scores ? p.scores.delivery || '-' : '-') + '</div>Delivery</div>' +
          '<div class="pres-score-item"><div class="pres-score-val">' + (p.scores ? p.scores.visuals || '-' : '-') + '</div>Visuals</div>' +
          '<div style="font-weight:800;font-size:16px;margin-left:6px;color:#f59e0b;">' + avgScore + '⭐</div>' +
        '</div>' : '') +
        '<div style="display:flex;gap:4px;">' +
          (p.status !== 'done' ? '<button class="btn btn-sm btn-success" onclick="markPresentationDone(\'' + p.id + '\')">Mark Done</button>' : '') +
          '<button class="btn btn-sm btn-outline" onclick="editPresentation(\'' + p.id + '\')">✏️</button>' +
          '<button class="btn btn-sm btn-outline" onclick="deletePresentation(\'' + p.id + '\')">🗑️</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }
  el('pres-calendar').innerHTML = html;
}

function editPresentation(id) {
  var p = id ? DB.presentations.find(function(pp) { return pp.id === id; }) : null;
  var isNew = !p;
  var workerOpts = DB.workers.map(function(w) {
    return '<option value="' + w.id + '"' + (p && p.workerId === w.id ? ' selected' : '') + '>' + esc(w.name) + '</option>';
  }).join('');
  var topicOpts = AI_PRESENTATION_TOPICS.map(function(t) {
    return '<option value="' + esc(t) + '"' + (p && p.topic === t ? ' selected' : '') + '>' + esc(t) + '</option>';
  }).join('');

  var modalHTML =
    '<h3>' + (isNew ? '🎤 Schedule Presentation' : '✏️ Edit Presentation') + '</h3>' +
    '<div class="form-field"><label class="form-label">Presenter</label><select class="form-input" id="modal-pres-worker" style="width:100%"><option value="">— Select —</option>' + workerOpts + '</select></div>' +
    '<div class="form-field"><label class="form-label">AI Topic</label><select class="form-input" id="modal-pres-topic" style="width:100%"><option value="">— Select —</option>' + topicOpts + '</select></div>' +
    '<div class="form-field"><label class="form-label">Scheduled Date</label><input type="date" class="form-input" id="modal-pres-date" value="' + esc(p ? p.scheduledDate : '') + '" style="width:100%"></div>' +
    (p && p.status === 'done' ? '<div class="form-label" style="margin-top:8px;">Peer Scores (1-5)</div>' +
      '<div class="form-grid">' +
        '<div class="form-field"><label class="form-label">Clarity</label><input type="number" class="form-input" id="modal-score-clarity" value="' + (p.scores ? p.scores.clarity || '' : '') + '" min="1" max="5" style="width:100%"></div>' +
        '<div class="form-field"><label class="form-label">Usefulness</label><input type="number" class="form-input" id="modal-score-usefulness" value="' + (p.scores ? p.scores.usefulness || '' : '') + '" min="1" max="5" style="width:100%"></div>' +
        '<div class="form-field"><label class="form-label">Delivery</label><input type="number" class="form-input" id="modal-score-delivery" value="' + (p.scores ? p.scores.delivery || '' : '') + '" min="1" max="5" style="width:100%"></div>' +
        '<div class="form-field"><label class="form-label">Visuals</label><input type="number" class="form-input" id="modal-score-visuals" value="' + (p.scores ? p.scores.visuals || '' : '') + '" min="1" max="5" style="width:100%"></div>' +
      '</div>' : '') +
    '<div class="modal-actions">' +
      '<button class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
      '<button class="btn btn-primary" onclick="savePresentation(\'' + (p ? p.id : '') + '\')">' + (isNew ? 'Schedule' : 'Save') + '</button>' +
    '</div>';
  showModal(modalHTML);
}

function savePresentation(id) {
  var workerId = el('modal-pres-worker').value;
  var topic = el('modal-pres-topic').value;
  var date = el('modal-pres-date').value;
  if (!workerId || !topic || !date) { tool.notify('All fields required.', 'warning'); return; }
  var p = DB.presentations.find(function(pp) { return pp.id === id; });
  if (p) {
    p.workerId = workerId; p.topic = topic; p.scheduledDate = date;
    if (p.status === 'done') {
      p.scores = {
        clarity: parseInt(el('modal-score-clarity').value) || 0,
        usefulness: parseInt(el('modal-score-usefulness').value) || 0,
        delivery: parseInt(el('modal-score-delivery').value) || 0,
        visuals: parseInt(el('modal-score-visuals').value) || 0
      };
    }
  } else {
    DB.presentations.push({
      id: genId(), workerId: workerId, topic: topic, scheduledDate: date,
      status: 'upcoming', scores: null, createdAt: new Date().toISOString()
    });
    addActivity('🎤', 'Presentation scheduled: ' + topic);
  }
  closeModal(); persist(); renderPresentations(); updateNavBadges();
}

function markPresentationDone(id) {
  var p = DB.presentations.find(function(pp) { return pp.id === id; });
  if (!p) return;
  p.status = 'done';
  if (!p.scores) p.scores = { clarity: 3, usefulness: 3, delivery: 3, visuals: 3 };
  var w = DB.workers.find(function(ww) { return ww.id === p.workerId; });
  if (w) { w.xp = (w.xp || 0) + 100; checkBadges(p.workerId); }
  addActivity('🎤', (w ? w.name : 'Someone') + ' completed presentation: ' + p.topic + ' (+100 XP)');
  persist(); renderPresentations();
}

function deletePresentation(id) {
  var p = DB.presentations.find(function(pp) { return pp.id === id; });
  if (!p || !confirm('Delete this presentation?')) return;
  DB.presentations = DB.presentations.filter(function(pp) { return pp.id !== id; });
  persist(); renderPresentations(); updateNavBadges();
}

/* ── Presentation Topic Catalog ── */
function renderPresCatalog() {
  var takenTopics = DB.presentations.map(function(p) { return p.topic; });
  var html = '';

  // Group A: Understanding AI
  var catATopics = AI_PRESENTATION_TOPICS.slice(0, 5);
  var catBTopics = AI_PRESENTATION_TOPICS.slice(5, 10);
  var catCTopics = AI_PRESENTATION_TOPICS.slice(10, 15);

  var categories = [
    { id: 'A', label: '🧠 Category A: Understanding AI — How It Actually Works', topics: catATopics, desc: 'Demystify the black box. These topics explain what is really happening inside AI.' },
    { id: 'B', label: '✍️ Category B: Better Prompting — Skills That Level Up Your Work', topics: catBTopics, desc: 'Immediately practical. Every topic teaches a technique you can use the same day.' },
    { id: 'C', label: '🚀 Category C: Working Smarter — Beyond Basic Prompting', topics: catCTopics, desc: 'Strategic thinking about AI — not just using it, but mastering it.' }
  ];

  var globalIdx = 0;
  categories.forEach(function(cat) {
    html += '<div class="pres-cat-section">';
    html += '<div class="pres-cat-header"><span class="pch-icon">' + cat.label.charAt(0) + '</span>' + cat.label + '</div>';
    html += '<div style="font-size:11px;color:var(--text-secondary);margin-bottom:10px;">' + cat.desc + '</div>';
    cat.topics.forEach(function(topic) {
      globalIdx++;
      var isTaken = takenTopics.indexOf(topic) !== -1;
      var takenBy = '';
      if (isTaken) {
        var pres = DB.presentations.find(function(p) { return p.topic === topic; });
        if (pres) {
          var w = DB.workers.find(function(ww) { return ww.id === pres.workerId; });
          takenBy = w ? w.name : 'Someone';
        }
      }
      html += '<div class="pres-topic-card" onclick="quickSchedulePres(\'' + esc(topic.replace(/'/g, "\\'")) + '\')">' +
        '<div class="ptc-num">' + globalIdx + '</div>' +
        '<div class="ptc-info">' +
          '<div class="ptc-title">' + esc(topic.split(' — ')[0]) + '</div>' +
          '<div class="ptc-sub">' + esc(topic.split(' — ')[1] || '') + '</div>' +
        '</div>' +
        '<span class="ptc-status ' + (isTaken ? 'ptc-taken' : 'ptc-free') + '">' + (isTaken ? '📌 ' + takenBy : '✅ Available') + '</span>' +
      '</div>';
    });
    html += '</div>';
  });

  el('pres-catalog').innerHTML = html;
}

function quickSchedulePres(topic) {
  editPresentation(null);
  setTimeout(function() {
    var sel = el('modal-pres-topic');
    if (sel) {
      for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value === topic) { sel.value = topic; break; }
      }
    }
  }, 100);
}

/* ── App Builder ── */
function renderApps() {
  updateStreak();
  // Toggle sub-tab visibility
  el('apps-grid').style.display = currentAppTab === 'projects' ? '' : 'none';
  el('apps-projects-toolbar').style.display = currentAppTab === 'projects' ? '' : 'none';
  el('apps-catalog').style.display = currentAppTab === 'catalog' ? '' : 'none';

  if (currentAppTab === 'catalog') {
    renderAppCatalog();
    return;
  }

  var filterS = el('filter-app-status').value;
  var filtered = DB.appProjects.filter(function(a) {
    if (filterS && a.status !== filterS) return false;
    return true;
  });
  var html = '';
  if (!filtered.length) {
    html = '<div class="empty-state"><div class="empty-icon">🛠️</div><div class="empty-text">No app projects yet. Click "+ New App Project" to start!</div></div>';
  } else {
    html = filtered.map(function(a) {
      var worker = DB.workers.find(function(w) { return w.id === a.workerId; });
      var idea = APP_PROJECT_IDEAS.find(function(i) { return i.name === a.name; });
      var icon = idea ? idea.icon : '🛠️';
      var diffClass = 'diff-' + (a.difficulty || 'easy');
      return '<div class="app-card">' +
        '<div class="app-header">' +
          '<span class="app-icon">' + icon + '</span>' +
          '<span class="app-name">' + esc(a.name) + '</span>' +
          '<span class="app-difficulty ' + diffClass + '">' + (a.difficulty || 'easy') + '</span>' +
        '</div>' +
        '<div class="app-desc">' + esc(a.description || '') + '</div>' +
        '<div class="app-meta">' +
          '<span>👤 ' + (worker ? worker.name : 'Unassigned') + '</span>' +
          '<span>📌 ' + (a.status || 'planning') + '</span>' +
          (a.deployedUrl ? '<span>🚀 Deployed</span>' : '') +
        '</div>' +
        '<div class="app-actions">' +
          '<button class="btn btn-sm btn-outline" onclick="editApp(\'' + a.id + '\')">✏️</button>' +
          '<button class="btn btn-sm btn-outline" onclick="deleteApp(\'' + a.id + '\')">🗑️</button>' +
          (a.status === 'planning' ? '<button class="btn btn-sm btn-primary" onclick="updateAppStatus(\'' + a.id + '\', \'building\')">Start Build</button>' : '') +
          (a.status === 'building' ? '<button class="btn btn-sm btn-warning" onclick="updateAppStatus(\'' + a.id + '\', \'testing\')">Send to Testing</button>' : '') +
          (a.status === 'testing' ? '<button class="btn btn-sm btn-success" onclick="updateAppStatus(\'' + a.id + '\', \'deployed\')">Mark Deployed</button>' : '') +
        '</div>' +
      '</div>';
    }).join('');
  }
  el('apps-grid').innerHTML = html;
}

function editApp(id) {
  var a = id ? DB.appProjects.find(function(aa) { return aa.id === id; }) : null;
  var isNew = !a;
  var workerOpts = DB.workers.map(function(w) {
    return '<option value="' + w.id + '"' + (a && a.workerId === w.id ? ' selected' : '') + '>' + esc(w.name) + '</option>';
  }).join('');
  var ideaOpts = APP_PROJECT_IDEAS.map(function(i) {
    return '<option value="' + esc(i.name) + '"' + (a && a.name === i.name ? ' selected' : '') + '>' + i.icon + ' ' + i.name + ' (' + i.diff + ')</option>';
  }).join('');

  var modalHTML =
    '<h3>' + (isNew ? '🛠️ New App Project' : '✏️ Edit App Project') + '</h3>' +
    '<div class="form-field"><label class="form-label">App Idea</label><select class="form-input" id="modal-app-idea" style="width:100%" onchange="onAppIdeaChange()"><option value="">— Select or type own —</option>' + ideaOpts + '<option value="__custom__">✏️ Custom Idea...</option></select></div>' +
    '<div class="form-field"><label class="form-label">App Name</label><input type="text" class="form-input" id="modal-app-name" value="' + esc(a ? a.name : '') + '" style="width:100%"></div>' +
    '<div class="form-field"><label class="form-label">Description</label><textarea class="form-input" id="modal-app-desc" style="width:100%">' + esc(a ? a.description : '') + '</textarea></div>' +
    '<div class="form-grid">' +
      '<div class="form-field"><label class="form-label">Assigned To</label><select class="form-input" id="modal-app-worker" style="width:100%"><option value="">— Select —</option>' + workerOpts + '</select></div>' +
      '<div class="form-field"><label class="form-label">Difficulty</label><select class="form-input" id="modal-app-diff" style="width:100%"><option value="easy"' + (a && a.difficulty === 'easy' ? ' selected' : '') + '>Easy</option><option value="medium"' + (a && a.difficulty === 'medium' ? ' selected' : '') + '>Medium</option><option value="hard"' + (a && a.difficulty === 'hard' ? ' selected' : '') + '>Hard</option></select></div>' +
    '</div>' +
    '<div class="form-field"><label class="form-label">Deployed URL (optional)</label><input type="text" class="form-input" id="modal-app-url" value="' + esc(a ? a.deployedUrl || '' : '') + '" placeholder="https://..." style="width:100%"></div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
      '<button class="btn btn-primary" onclick="saveApp(\'' + (a ? a.id : '') + '\')">' + (isNew ? 'Create Project' : 'Save') + '</button>' +
    '</div>';
  showModal(modalHTML);
}

function onAppIdeaChange() {
  var sel = el('modal-app-idea').value;
  if (sel === '__custom__') { el('modal-app-name').value = ''; el('modal-app-desc').value = ''; return; }
  var idea = APP_PROJECT_IDEAS.find(function(i) { return i.name === sel; });
  if (idea) { el('modal-app-name').value = idea.name; el('modal-app-desc').value = idea.desc; el('modal-app-diff').value = idea.diff; }
}

function saveApp(id) {
  var name = el('modal-app-name').value.trim();
  var desc = el('modal-app-desc').value.trim();
  var workerId = el('modal-app-worker').value;
  var diff = el('modal-app-diff').value;
  var url = el('modal-app-url').value.trim();
  if (!name) { tool.notify('App name is required.', 'warning'); return; }
  var a = DB.appProjects.find(function(aa) { return aa.id === id; });
  if (a) {
    a.name = name; a.description = desc; a.workerId = workerId; a.difficulty = diff; a.deployedUrl = url || null;
  } else {
    DB.appProjects.push({
      id: genId(), name: name, description: desc, workerId: workerId, difficulty: diff,
      status: 'planning', deployedUrl: url || null, createdAt: new Date().toISOString()
    });
    addActivity('🛠️', 'New app project: ' + name);
  }
  closeModal(); persist(); renderApps(); updateNavBadges();
}

function updateAppStatus(id, newStatus) {
  var a = DB.appProjects.find(function(aa) { return aa.id === id; });
  if (!a) return;
  a.status = newStatus;
  if (newStatus === 'deployed') {
    var w = DB.workers.find(function(ww) { return ww.id === a.workerId; });
    if (w) { w.xp = (w.xp || 0) + 150; checkBadges(a.workerId); addActivity('🚀', w.name + ' deployed app: ' + a.name + ' (+150 XP)'); }
  }
  persist(); renderApps();
}

function deleteApp(id) {
  var a = DB.appProjects.find(function(aa) { return aa.id === id; });
  if (!a || !confirm('Delete app project "' + a.name + '"?')) return;
  DB.appProjects = DB.appProjects.filter(function(aa) { return aa.id !== id; });
  persist(); renderApps(); updateNavBadges();
}

/* ── App Idea Catalog ── */
function renderAppCatalog() {
  var builtApps = DB.appProjects.map(function(a) { return a.name; });
  var html = '<div class="idea-grid">';

  APP_PROJECT_IDEAS.forEach(function(idea, idx) {
    var isBuilt = builtApps.indexOf(idea.name) !== -1;
    var diffClass = 'diff-' + idea.diff;
    html += '<div class="idea-card" onclick="quickCreateApp(\'' + esc(idea.name.replace(/'/g, "\\'")) + '\')">' +
      '<div class="ic-icon">' + idea.icon + '</div>' +
      '<div class="ic-info">' +
        '<div class="ic-name">' + (idx + 1) + '. ' + esc(idea.name) + '</div>' +
        '<div class="ic-desc">' + esc(idea.desc) + '</div>' +
        '<div class="ic-meta">' +
          '<span class="ic-difficulty ' + diffClass + '">' + idea.diff + '</span>' +
          (isBuilt ? '<span style="font-size:10px;color:var(--success);font-weight:600;">✅ Built</span>' : '<span style="font-size:10px;color:var(--text-secondary);">Available</span>') +
        '</div>' +
      '</div>' +
    '</div>';
  });

  html += '</div>';
  html += '<div class="card" style="margin-top:16px;text-align:center;padding:20px;border:1px dashed var(--border);">' +
    '<div style="font-size:11px;color:var(--text-secondary);">💡 Don\'t see what you want? Click <strong>+ New App Project</strong> in the Projects tab and choose <strong>"✏️ Custom Idea..."</strong> to create your own.</div>' +
  '</div>';

  el('apps-catalog').innerHTML = html;
}

function quickCreateApp(name) {
  editApp(null);
  setTimeout(function() {
    var sel = el('modal-app-idea');
    if (sel) {
      for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value === name) { sel.value = name; onAppIdeaChange(); break; }
      }
    }
  }, 100);
}

/* ── Book Builder ── */
function renderBooks() {
  updateStreak();
  var html = '';
  if (!DB.bookProjects.length) {
    html = '<div class="empty-state"><div class="empty-icon">📚</div><div class="empty-text">No book projects yet. Click "+ New Book Project" to start compiling a grade-level book!</div></div>';
  } else {
    html = DB.bookProjects.map(function(b) {
      var editor = DB.workers.find(function(w) { return w.id === b.editorId; });
      var totalTopics = (b.topics || []).length;
      var doneTopics = (b.topics || []).filter(function(t) { return t.status === 'done'; }).length;
      var pct = totalTopics ? Math.round(doneTopics / totalTopics * 100) : 0;
      var topicsHTML = (b.topics || []).map(function(t) {
        return '<span class="book-topic-chip ' + t.status + '" onclick="toggleBookTopic(\'' + b.id + '\', \'' + esc(t.name) + '\')">' + esc(t.name) + '</span>';
      }).join('');
      return '<div class="book-card">' +
        '<div class="book-header">' +
          '<div class="book-grade-badge">G' + b.grade + '</div>' +
          '<div class="book-info">' +
            '<div class="book-title">Grade ' + b.grade + ' Math Book</div>' +
            '<div class="book-editor">Editor: ' + (editor ? editor.name : 'Unassigned') + ' · ' + (b.status || 'draft') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="book-topics">' + topicsHTML + '</div>' +
        '<div class="book-progress">' +
          '<div class="book-progress-label"><span>' + doneTopics + '/' + totalTopics + ' topics complete</span><span>' + pct + '%</span></div>' +
          '<div class="book-progress-bar"><div class="book-progress-fill" style="width:' + pct + '%"></div></div>' +
        '</div>' +
        '<div style="margin-top:10px;display:flex;gap:6px;">' +
          '<button class="btn btn-sm btn-outline" onclick="editBook(\'' + b.id + '\')">✏️</button>' +
          '<button class="btn btn-sm btn-outline" onclick="deleteBook(\'' + b.id + '\')">🗑️</button>' +
          '<button class="btn btn-sm btn-primary" onclick="addMissingTopicsToBook(\'' + b.id + '\')">+ Add Missing Topics</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }
  el('books-grid').innerHTML = html;
}

function editBook(id) {
  var b = id ? DB.bookProjects.find(function(bb) { return bb.id === id; }) : null;
  var isNew = !b;
  var editorOpts = DB.workers.map(function(w) {
    return '<option value="' + w.id + '"' + (b && b.editorId === w.id ? ' selected' : '') + '>' + esc(w.name) + '</option>';
  }).join('');
  var gradeOpts = '';
  for (var g = 5; g <= 11; g++) {
    gradeOpts += '<option value="' + g + '"' + (b && b.grade === String(g) ? ' selected' : '') + '>Grade ' + g + '</option>';
  }

  var modalHTML =
    '<h3>' + (isNew ? '📚 New Book Project' : '✏️ Edit Book Project') + '</h3>' +
    '<div class="form-grid">' +
      '<div class="form-field"><label class="form-label">Grade Level</label><select class="form-input" id="modal-book-grade" style="width:100%">' + gradeOpts + '</select></div>' +
      '<div class="form-field"><label class="form-label">Editor</label><select class="form-input" id="modal-book-editor" style="width:100%"><option value="">— Select —</option>' + editorOpts + '</select></div>' +
    '</div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
      '<button class="btn btn-primary" onclick="saveBook(\'' + (b ? b.id : '') + '\')">' + (isNew ? 'Create Book Project' : 'Save & Regenerate Topics') + '</button>' +
    '</div>';
  showModal(modalHTML);
}

function saveBook(id) {
  var grade = el('modal-book-grade').value;
  var editorId = el('modal-book-editor').value;
  if (!grade || !editorId) { tool.notify('Grade and editor are required.', 'warning'); return; }
  var curriculumTopics = CURRICULUM_TOPICS[grade] || [];
  var b = DB.bookProjects.find(function(bb) { return bb.id === id; });
  if (b) {
    b.grade = grade; b.editorId = editorId;
    var existingNames = (b.topics || []).map(function(t) { return t.name; });
    curriculumTopics.forEach(function(ct) {
      if (existingNames.indexOf(ct) === -1) b.topics.push({ name: ct, status: 'missing' });
    });
  } else {
    DB.bookProjects.push({
      id: genId(), grade: grade, editorId: editorId,
      topics: curriculumTopics.map(function(ct) { return { name: ct, status: 'missing' }; }),
      status: 'draft', createdAt: new Date().toISOString()
    });
    addActivity('📚', 'Book project created: Grade ' + grade + ' Math');
  }
  closeModal(); persist(); renderBooks(); updateNavBadges();
}

function toggleBookTopic(bookId, topicName) {
  var b = DB.bookProjects.find(function(bb) { return bb.id === bookId; });
  if (!b) return;
  var t = (b.topics || []).find(function(tt) { return tt.name === topicName; });
  if (!t) return;
  var order = ['missing', 'in-progress', 'done'];
  var idx = order.indexOf(t.status);
  t.status = order[(idx + 1) % 3];
  var allDone = b.topics.every(function(tt) { return tt.status === 'done'; });
  if (allDone && b.status !== 'complete') {
    b.status = 'complete';
    var editor = DB.workers.find(function(w) { return w.id === b.editorId; });
    if (editor) { editor.xp = (editor.xp || 0) + 200; addActivity('📚', editor.name + ' completed Grade ' + b.grade + ' book! (+200 XP)'); }
  }
  persist(); renderBooks();
}

function addMissingTopicsToBook(bookId) {
  var b = DB.bookProjects.find(function(bb) { return bb.id === bookId; });
  if (!b) return;
  var curriculumTopics = CURRICULUM_TOPICS[b.grade] || [];
  var existingNames = (b.topics || []).map(function(t) { return t.name; });
  var added = 0;
  curriculumTopics.forEach(function(ct) {
    if (existingNames.indexOf(ct) === -1) { b.topics.push({ name: ct, status: 'missing' }); added++; }
  });
  if (added) tool.notify('Added ' + added + ' missing topics from curriculum.', 'info');
  else tool.notify('All curriculum topics are already included.', 'info');
  persist(); renderBooks();
}

function deleteBook(id) {
  var b = DB.bookProjects.find(function(bb) { return bb.id === id; });
  if (!b || !confirm('Delete Grade ' + b.grade + ' book project?')) return;
  DB.bookProjects = DB.bookProjects.filter(function(bb) { return bb.id !== id; });
  persist(); renderBooks(); updateNavBadges();
}

/* ── Portfolio ── */
function renderPortfolio() {
  updateStreak();
  var filterW = el('filter-portfolio-worker');
  var currentVal = filterW.value;
  filterW.innerHTML = '<option value="">— Select Worker —</option>' +
    DB.workers.map(function(w) { return '<option value="' + w.id + '"' + (w.id === currentVal ? ' selected' : '') + '>' + esc(w.name) + '</option>'; }).join('');
  filterW.value = currentVal;

  if (!currentVal) {
    el('portfolio-content').innerHTML = '<div class="empty-state"><div class="empty-icon">🎓</div><div class="empty-text">Select a worker to view their portfolio</div></div>';
    return;
  }

  var w = DB.workers.find(function(ww) { return ww.id === currentVal; });
  if (!w) return;
  var lvl = getLevel(w.xp || 0);
  var docs = DB.subjects.filter(function(s) { return s.assignedTo === w.id && (s.status === 'done' || s.status === 'reviewed'); });
  var reviews = DB.reviews.filter(function(r) { return r.reviewerId === w.id; });
  var prompts = DB.prompts.filter(function(p) { return p.createdBy === w.id; });
  var pres = DB.presentations.filter(function(p) { return p.workerId === w.id && p.status === 'done'; });
  var apps = DB.appProjects.filter(function(a) { return a.workerId === w.id; });
  var books = DB.bookProjects.filter(function(b) { return b.editorId === w.id; });
  var learningDone = DB.completedLearning.filter(function(l) { return l.workerId === w.id || l.workerId === 'self'; });
  var badgesEarned = (w.badges || []).map(function(bk) { return BADGES[bk]; }).filter(Boolean);

  var bestDocs = docs.filter(function(d) { return d.qualityScore && d.qualityScore >= 4; }).sort(function(a, b) { return (b.qualityScore || 0) - (a.qualityScore || 0); }).slice(0, 5);

  var html = '';
  // Header
  html += '<div class="card" style="margin-bottom:16px;"><div class="card-body">' +
    '<div style="display:flex;align-items:center;gap:16px;">' +
      '<div style="font-size:48px;">' + (w.avatar || '👤') + '</div>' +
      '<div style="flex:1;">' +
        '<div style="font-size:18px;font-weight:700;">' + esc(w.name) + '</div>' +
        '<div style="font-size:12px;color:var(--text-secondary);">' + lvl.icon + ' ' + lvl.name + ' · ' + (w.xp || 0) + ' XP · Joined ' + new Date(w.joined).toLocaleDateString('en-US', {month:'short',day:'numeric'}) + '</div>' +
        '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">' + badgesEarned.map(function(b) { return '<span title="' + b.desc + '" style="font-size:18px;">' + b.icon + '</span>'; }).join('') + '</div>' +
      '</div>' +
      '<div style="display:flex;gap:12px;">' +
        '<div class="portfolio-stat"><div class="ps-val">' + docs.length + '</div><div class="ps-lbl">Docs</div></div>' +
        '<div class="portfolio-stat"><div class="ps-val">' + reviews.length + '</div><div class="ps-lbl">Reviews</div></div>' +
        '<div class="portfolio-stat"><div class="ps-val">' + apps.length + '</div><div class="ps-lbl">Apps</div></div>' +
        '<div class="portfolio-stat"><div class="ps-val">' + pres.length + '</div><div class="ps-lbl">Presents</div></div>' +
      '</div>' +
    '</div></div></div>';

  // Best Documents
  html += '<div class="portfolio-section"><div class="ps-title">⭐ Top Rated Documents</div>';
  if (bestDocs.length) {
    bestDocs.forEach(function(d) {
      var stars = ''; for (var i = 1; i <= 5; i++) stars += '<span style="color:' + (i <= (d.qualityScore || 0) ? '#f59e0b' : '#d1d5db') + '">★</span>';
      html += '<div class="portfolio-doc-card"><span>' + esc(d.topic) + '</span><span style="color:var(--text-secondary);">Gr ' + esc(d.grade) + '</span><span>' + stars + '</span></div>';
    });
  } else { html += '<div class="empty-state"><div class="empty-text">No reviewed documents yet</div></div>'; }
  html += '</div>';

  // Prompts Created
  html += '<div class="portfolio-section"><div class="ps-title">💡 Prompts Contributed (' + prompts.length + ')</div>';
  if (prompts.length) {
    prompts.forEach(function(p) { html += '<div class="portfolio-doc-card"><span>' + esc(p.name) + '</span><span style="color:var(--text-secondary);">' + esc(p.category) + '</span></div>'; });
  } else { html += '<div class="empty-state"><div class="empty-text">No prompts contributed yet</div></div>'; }
  html += '</div>';

  // Apps Built
  html += '<div class="portfolio-section"><div class="ps-title">🛠️ Apps Built (' + apps.length + ')</div>';
  if (apps.length) {
    apps.forEach(function(a) { html += '<div class="portfolio-doc-card"><span>' + esc(a.name) + '</span><span class="badge badge-' + (a.status === 'deployed' ? 'reviewed' : 'in-progress') + '">' + a.status + '</span></div>'; });
  } else { html += '<div class="empty-state"><div class="empty-text">No apps built yet</div></div>'; }
  html += '</div>';

  // Presentations Done
  html += '<div class="portfolio-section"><div class="ps-title">🎤 Presentations (' + pres.length + ')</div>';
  if (pres.length) {
    pres.forEach(function(p) {
      var scores = p.scores || {};
      var avg = 0;
      var vals = [scores.clarity, scores.usefulness, scores.delivery, scores.visuals].filter(function(v) { return v != null; });
      if (vals.length) avg = Math.round(vals.reduce(function(a,b){return a+b;},0) / vals.length * 10) / 10;
      html += '<div class="portfolio-doc-card"><span>' + esc(p.topic) + '</span><span style="color:#f59e0b;font-weight:700;">' + avg + ' ⭐</span></div>';
    });
  } else { html += '<div class="empty-state"><div class="empty-text">No presentations done yet</div></div>'; }
  html += '</div>';

  // Books Edited
  html += '<div class="portfolio-section"><div class="ps-title">📚 Books Edited (' + books.length + ')</div>';
  if (books.length) {
    books.forEach(function(b) {
      var done = (b.topics || []).filter(function(t) { return t.status === 'done'; }).length;
      var total = (b.topics || []).length;
      html += '<div class="portfolio-doc-card"><span>Grade ' + b.grade + ' Math Book</span><span>' + done + '/' + total + ' topics · ' + b.status + '</span></div>';
    });
  } else { html += '<div class="empty-state"><div class="empty-text">No books edited yet</div></div>'; }
  html += '</div>';

  // Reflection / Journal prompt
  html += '<div class="card"><div class="card-header"><span class="card-title">📝 Reflection Journal</span></div><div class="card-body">' +
    '<textarea class="form-input" id="portfolio-reflection" placeholder="What did you learn this week? What are you most proud of? What do you want to improve?" style="width:100%;min-height:80px;">' + esc(w.reflection || '') + '</textarea>' +
    '<button class="btn btn-primary" style="margin-top:8px;" onclick="saveReflection(\'' + w.id + '\')">Save Reflection</button>' +
  '</div></div>';

  el('portfolio-content').innerHTML = html;
}

function saveReflection(workerId) {
  var w = DB.workers.find(function(ww) { return ww.id === workerId; });
  if (!w) return;
  w.reflection = el('portfolio-reflection').value;
  persist();
  tool.notify('Reflection saved! 📝', 'success');
}

/* ── Onboarding / How It Works ── */
function renderOnboarding() {
  var myW = getMyWorker();
  var lvl = myW ? getLevel(myW.xp || 0) : LEVELS[0];
  var html = '';

  // Welcome banner
  html += '<div class="card" style="margin-bottom:20px;border:2px solid var(--primary);">';
  html += '<div class="card-body" style="text-align:center;padding:24px;">';
  html += '<div style="font-size:48px;margin-bottom:8px;">🌱</div>';
  html += '<div style="font-size:20px;font-weight:800;margin-bottom:4px;">Welcome to Bloom &amp; Learn' + (myW ? ', ' + esc(myW.name) : '') + '!</div>';
  html += '<div style="font-size:13px;color:var(--text-secondary);">Your 2-month journey from content worker to AI-savvy creator</div>';
  if (myW) {
    html += '<div style="margin-top:12px;display:inline-block;padding:6px 16px;background:' + lvl.badgeClass.replace('badge-','') === 'seedling' ? '#dcfce7' : '#cffafe' + ';border-radius:20px;font-weight:700;font-size:13px;">' + lvl.icon + ' Level: ' + lvl.name + ' · ' + (myW.xp||0) + ' XP</div>';
  }
  html += '</div></div>';

  // Table of contents
  html += '<div class="onboard-toc"><strong style="font-size:14px;">📋 Quick Navigation</strong><div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:8px;">';
  var sections = [
    { id: 'overview', label: '🌟 Overview' },
    { id: 'daily', label: '📅 Your Daily Workflow' },
    { id: 'tabs', label: '📑 All Tabs Explained' },
    { id: 'xp', label: '⭐ XP & Levels' },
    { id: 'learn', label: '🎓 Learning & Growth' },
    { id: 'manager', label: '👩‍💼 For Managers' }
  ];
  sections.forEach(function(s) {
    html += '<a onclick="document.getElementById(\'os-' + s.id + '\').scrollIntoView({behavior:\'smooth\'});">' + s.label + '</a>';
  });
  html += '</div></div>';

  // Section 1: Overview
  html += '<div class="onboard-step" id="os-overview"><div class="os-num">1</div>';
  html += '<div class="os-title">🌟 What Is This Program?</div>';
  html += '<div class="os-body">';
  html += '<p>You are part of a <strong>2-month AI-assisted math content development program</strong>. Your job is to create high-quality math educational materials using AI tools like Claude and Notebook LM. But this isn\'t just a job — it\'s a <strong>learning accelerator</strong> designed to make you skilled in AI, content design, and digital tool building.</p>';
  html += '<p><strong>Three goals:</strong></p><ul>';
  html += '<li>🌱 <strong>BLOOM</strong> — Learn new skills every day (AI, math pedagogy, coding)</li>';
  html += '<li>🎯 <strong>PRODUCE</strong> — Create excellent math content that passes quality gates</li>';
  html += '<li>🔥 <strong>ENGAGE</strong> — Stay motivated through gamification and friendly competition</li>';
  html += '</ul></div></div>';

  // Section 2: Daily Workflow
  html += '<div class="onboard-step" id="os-daily"><div class="os-num">2</div>';
  html += '<div class="os-title">📅 Your Daily Workflow</div>';
  html += '<div class="os-body">';
  html += '<p><strong>Batch workflow</strong> (not one-at-a-time!):</p><ol>';
  html += '<li><strong>Queue up 4-5 prompts</strong> (15 min) — Prepare multiple content generation requests at once</li>';
  html += '<li><strong>Fire them all</strong> (1 min) — Send all prompts to Claude/Notebook LM</li>';
  html += '<li><strong>🌱 BLOOM BREAK (10 min)</strong> — While AI generates, do learning cards in the Learn Zone, practice prompt drills, or review a peer\'s document</li>';
  html += '<li><strong>Quality check</strong> (10 min) — Review AI outputs, check accuracy, clarity, visuals, engagement</li>';
  html += '<li><strong>Submit & earn XP</strong> — Mark tasks as done, get reviewed, earn XP and badges</li>';
  html += '</ol>';
  html += '<p>🔥 <strong>Pro tip:</strong> The moment you hit "Enter" on Claude, switch to the Learn Zone tab and complete ONE learning card. Make it a habit!</p>';
  html += '</div></div>';

  // Section 3: All Tabs
  html += '<div class="onboard-step" id="os-tabs"><div class="os-num">3</div>';
  html += '<div class="os-title">📑 All 12 Tabs Explained</div>';
  html += '<div class="os-body">';
  var tabExplanations = [
    { icon: '📊', name: 'Dashboard', desc: 'Your home base. See your stats, daily challenge, team streak, and recent activity. Start here every day.' },
    { icon: '👥', name: 'Team', desc: 'See all 10 team members, their levels, XP, and badges. Click any card to see details and award bonus XP.' },
    { icon: '📝', name: 'Task Board', desc: 'Your subject assignments. Each has a status (Pending → In Progress → Done → Reviewed) and 4 quality gates to pass.' },
    { icon: '🎓', name: 'Learn Zone', desc: 'Micro-learning cards organized by category. Complete cards during AI wait time to earn XP. 28+ built-in cards + custom ones.' },
    { icon: '⭐', name: 'Peer Review', desc: 'Review documents completed by teammates. Check the 4 quality gates, give a 1-5 star score, and write feedback.' },
    { icon: '🏆', name: 'Leaderboard', desc: 'See how you rank against teammates. Switch between XP, Quality Score, Badges, and Reviews rankings.' },
    { icon: '💡', name: 'Prompt Lab', desc: 'Team prompt library. Add your best prompts, browse others, rate them. Building good prompts is a core skill.' },
    { icon: '🎤', name: 'Presentations', desc: 'Each person presents one AI concept to the group. Schedule, track, and score presentations. +100 XP for presenting!' },
    { icon: '🛠️', name: 'App Builder', desc: 'Build real HTML tools using vibe-coding. Choose from 10 project ideas. Deploy working apps. +150 XP per deployed app!' },
    { icon: '📚', name: 'Book Builder', desc: 'Compile all documents for one grade into a complete book. Track topics, fill gaps, mark progress. +200 XP for a complete book!' },
    { icon: '🎓', name: 'My Portfolio', desc: 'Your personal showcase — best documents, prompts, apps, presentations, and reflection journal. Your resume-builder.' },
    { icon: '📖', name: 'How It Works', desc: 'You\'re reading it! This guide explains everything step by step.' }
  ];
  tabExplanations.forEach(function(t) {
    html += '<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">';
    html += '<span style="font-size:20px;min-width:28px;">' + t.icon + '</span>';
    html += '<div><strong>' + t.name + '</strong><br><span style="font-size:12px;color:var(--text-secondary);">' + t.desc + '</span></div>';
    html += '</div>';
  });
  html += '</div></div>';

  // Section 4: XP & Levels
  html += '<div class="onboard-step" id="os-xp"><div class="os-num">4</div>';
  html += '<div class="os-title">⭐ How XP and Levels Work</div>';
  html += '<div class="os-body">';
  html += '<p>You earn <strong>XP (Experience Points)</strong> for everything you do:</p><ul>';
  html += '<li>✅ Complete a subject document → <strong>+25 XP</strong></li>';
  html += '<li>🎓 Complete a learning card → <strong>+5 to +15 XP</strong></li>';
  html += '<li>⭐ Submit a peer review → <strong>+15 XP</strong></li>';
  html += '<li>🎤 Give a presentation → <strong>+100 XP</strong></li>';
  html += '<li>🛠️ Deploy an app → <strong>+150 XP</strong></li>';
  html += '<li>📚 Complete a book → <strong>+200 XP</strong></li>';
  html += '</ul>';
  html += '<p><strong>5 Levels:</strong></p>';
  LEVELS.forEach(function(l) {
    html += '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;">';
    html += '<span style="font-size:18px;">' + l.icon + '</span>';
    html += '<strong>' + l.name + '</strong>';
    html += '<span style="color:var(--text-secondary);font-size:12px;">(' + l.minXP + '+ XP)</span>';
    html += '</div>';
  });
  html += '<p style="margin-top:8px;">🏅 <strong>Badges</strong> are special achievements. There are 18 different badges to earn — check the Team tab to see who has what!</p>';
  html += '</div></div>';

  // Section 5: Learning Path
  html += '<div class="onboard-step" id="os-learn"><div class="os-num">5</div>';
  html += '<div class="os-title">🎓 Your Learning Journey</div>';
  html += '<div class="os-body">';
  html += '<p>Over 2 months, you\'ll grow through these stages:</p><ul>';
  html += '<li><strong>Week 1-2:</strong> Prompt Engineering Workshop → Start producing with quality gates → First peer reviews</li>';
  html += '<li><strong>Week 3-4:</strong> Prompt Variation Lab → "One Topic Three Ways" → Cross-pollination (swap subjects)</li>';
  html += '<li><strong>Week 5-6:</strong> Start building your HTML app → Begin your AI presentation → Deepen review skills</li>';
  html += '<li><strong>Week 7-8:</strong> Complete your book project → Graduate with a portfolio → Final Bloom Ceremony</li>';
  html += '</ul>';
  html += '<p><strong>Special activities:</strong></p><ul>';
  html += '<li>🎤 <strong>AI Presentations:</strong> Each person presents one AI topic to the group (see Presentations tab)</li>';
  html += '<li>🛠️ <strong>Vibe Coding:</strong> Build real HTML apps even if you don\'t know coding — AI helps you (see App Builder tab)</li>';
  html += '<li>📚 <strong>Book Compilation:</strong> Take all documents for one grade and turn them into a real book (see Book Builder tab)</li>';
  html += '<li>🎭 <strong>Student Personas:</strong> Learn to adapt content for 5 different learner types</li>';
  html += '</ul>';
  html += '</div></div>';

  // Section 6: For Managers
  html += '<div class="onboard-step" id="os-manager"><div class="os-num">6</div>';
  html += '<div class="os-title">👩‍💼 For Managers</div>';
  html += '<div class="os-body">';
  html += '<p>As a manager, you can:</p><ul>';
  html += '<li>📊 <strong>View all workers</strong> — The Team tab shows everyone\'s progress, XP, and badges</li>';
  html += '<li>➕ <strong>Add/assign subjects</strong> — Use the Task Board to distribute work</li>';
  html += '<li>🎓 <strong>Manage learning cards</strong> — Add custom cards via the Learn Zone (+ Add Card button)</li>';
  html += '<li>⭐ <strong>Award bonus XP</strong> — Click any worker in Team tab, then click +50 or +100 XP</li>';
  html += '<li>🎤 <strong>Schedule presentations</strong> — Use the Presentations tab</li>';
  html += '<li>📚 <strong>Create book projects</strong> — Use the Book Builder tab</li>';
  html += '<li>🔧 <strong>Configure via CMS params:</strong> Set <code>managerView=yes</code> to see management controls</li>';
  html += '</ul>';
  html += '<p><strong>How per-person instances work:</strong> Each worker opens their own instance of this tool. The tool detects who they are and shows only their tasks, their XP, and their progress. You manage the big picture through the Team tab and by configuring worker assignments.</p>';
  html += '</div></div>';

  // Final CTA
  html += '<div class="card" style="text-align:center;padding:24px;margin-top:20px;border:2px solid var(--xp-gold);">';
  html += '<div style="font-size:32px;margin-bottom:8px;">🚀</div>';
  html += '<div style="font-size:16px;font-weight:700;margin-bottom:4px;">Ready to start blooming?</div>';
  html += '<div style="font-size:13px;color:var(--text-secondary);">Go to the <strong>Dashboard</strong> and check today\'s challenge. Then head to the <strong>Task Board</strong> and start your first subject!</div>';
  html += '</div>';

  el('onboarding-content').innerHTML = html;
}

/* ── Add Worker ── */
function addWorker() {
  var modalHTML =
    '<h3>➕ Add New Worker</h3>' +
    '<div class="form-field"><label class="form-label">Name</label><input type="text" class="form-input" id="modal-worker-name" placeholder="Worker name" style="width:100%"></div>' +
    '<div class="form-field"><label class="form-label">Avatar Emoji</label><input type="text" class="form-input" id="modal-worker-avatar" placeholder="👩‍💻" style="width:100%"></div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
      '<button class="btn btn-primary" onclick="saveNewWorker()">Add Worker</button>' +
    '</div>';
  showModal(modalHTML);
}

function saveNewWorker() {
  var name = el('modal-worker-name').value.trim();
  var avatar = el('modal-worker-avatar').value.trim() || '👤';
  if (!name) { tool.notify('Please enter a name.', 'warning'); return; }
  DB.workers.push({
    id: genId(),
    name: name,
    avatar: avatar,
    xp: 0,
    badges: [],
    joined: new Date().toISOString(),
    skills: {}
  });
  addActivity('👋', name + ' joined the team!');
  closeModal();
  persist();
  renderWorkers();
}

/* ── Modal ── */
function showModal(html) {
  el('modal-box').innerHTML = html;
  el('modal-overlay').style.display = 'flex';
}

function closeModal() {
  el('modal-overlay').style.display = 'none';
  el('modal-box').innerHTML = '';
}

el('modal-overlay').addEventListener('click', function(e) {
  if (e.target === el('modal-overlay')) closeModal();
});

/* ── Event Delegation ── */
document.addEventListener('click', function(e) {
  // Navigation
  var navItem = e.target.closest('.nav-item');
  if (navItem) {
    var page = navItem.getAttribute('data-page');
    if (page) navigateTo(page);
    return;
  }

  // Learn tabs
  var learnTab = e.target.closest('.learn-tab');
  if (learnTab) {
    currentLearnTab = learnTab.getAttribute('data-learn');
    qsa('.learn-tab').forEach(function(t) { t.classList.remove('active'); });
    learnTab.classList.add('active');
    renderLearnZone();
    return;
  }

  // Leaderboard tabs
  var lbTab = e.target.closest('.lb-tab');
  if (lbTab) {
    currentLbTab = lbTab.getAttribute('data-lb');
    qsa('.lb-tab').forEach(function(t) { t.classList.remove('active'); });
    lbTab.classList.add('active');
    renderLeaderboard();
    return;
  }

  // Sub-tabs (presentations & apps)
  var subTab = e.target.closest('.sub-tab');
  if (subTab) {
    var presTab = subTab.getAttribute('data-pres-tab');
    var appTab = subTab.getAttribute('data-app-tab');
    if (presTab) {
      currentPresTab = presTab;
      qsa('#pres-subtabs .sub-tab').forEach(function(t) { t.classList.remove('active'); });
      subTab.classList.add('active');
      renderPresentations();
    }
    if (appTab) {
      currentAppTab = appTab;
      qsa('#apps-subtabs .sub-tab').forEach(function(t) { t.classList.remove('active'); });
      subTab.classList.add('active');
      renderApps();
    }
    return;
  }
});

// Filter change handlers
el('filter-worker').addEventListener('change', renderTasks);
el('filter-status').addEventListener('change', renderTasks);
el('filter-prompt-category').addEventListener('change', renderPrompts);

// Button handlers
el('btn-add-task').addEventListener('click', function() { editSubject(null); });
el('btn-add-prompt').addEventListener('click', function() { editPrompt(null); });
el('btn-add-worker').addEventListener('click', addWorker);
el('btn-sort-xp').addEventListener('click', function() {
  DB.workers.sort(function(a, b) { return (b.xp || 0) - (a.xp || 0); });
  renderWorkers();
});
el('btn-sort-name').addEventListener('click', function() {
  DB.workers.sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });
  renderWorkers();
});
el('btn-add-presentation').addEventListener('click', function() { editPresentation(null); });
el('btn-add-app').addEventListener('click', function() { editApp(null); });
el('btn-add-book').addEventListener('click', function() { editBook(null); });
el('filter-pres-worker').addEventListener('change', renderPresentations);
el('filter-app-status').addEventListener('change', renderApps);
el('filter-portfolio-worker').addEventListener('change', renderPortfolio);
el('btn-add-learning-card').addEventListener('click', function() { editingLearningCardId = null; editLearningCard(null); });
el('btn-reset-learning').addEventListener('click', function() {
  if (!confirm('Reset ALL your learning progress? This cannot be undone.')) return;
  DB.completedLearning = DB.completedLearning.filter(function(l) { return l.workerId !== currentWorkerId && l.workerId !== 'self'; });
  persist(); renderLearnZone(); tool.notify('Learning progress reset.', 'info');
});

/* ── Read-only ── */
function lockUI(ro) {
  isReadOnly = ro;
  qsa('.btn-primary, .btn-success, .btn-warning, .btn-danger').forEach(function(b) {
    b.style.display = ro ? 'none' : '';
  });
}

/* ── Entry Point ── */
tool.onReady(function(val, fields) {
  loadData(val);
  resolveCurrentWorker();
  if (tool.isReadOnly()) lockUI();

  tool.onValueChange(function(v) { loadData(v); resolveCurrentWorker(); renderCurrentPage(); });
  tool.onReadonlyChange(function(ro) { lockUI(ro); });
  tool.onUserChange(function(user) { currentUser = user; resolveCurrentWorker(); renderCurrentPage(); });

  navigateTo('dashboard');
  updateNavBadges();
  tool.resize();
  
  // Show worker identity banner on first load
  var myW = getMyWorker();
  if (myW && !isManager()) {
    tool.notify('Welcome back, ' + myW.name + '! 🌱 You are Level: ' + getLevel(myW.xp||0).name, 'info');
  }
});
