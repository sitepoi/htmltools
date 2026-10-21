/* =============================================================================
   Build the ten role flyers
   -----------------------------------------------------------------------------
   One source for the design: the CSS and the export script are lifted out of
   volunteers-flyer.html, so a change there reaches every role flyer the next
   time this script runs. Only the role copy lives here.

   Run:  node build-role-flyers.js
   Out:  roles/role-<slug>.html   (standalone, dual format: Desktop A4 + Mobile)
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const SOURCE_FLYER = path.join(HERE, 'volunteers-flyer.html');
const OUT_DIR = path.join(HERE, 'roles');

const source = fs.readFileSync(SOURCE_FLYER, 'utf8');

/* design: the base stylesheet and the export switch come from the main flyer */
const styleMatch = /<style>\n([\s\S]*?)\n<\/style>/.exec(source);
const scriptMatch = /<script>\n([\s\S]*?)\n<\/script>\s*<\/body>/.exec(source);
if (!styleMatch || !scriptMatch) {
  throw new Error('Could not lift the stylesheet or the export script from volunteers-flyer.html');
}
const BASE_CSS = styleMatch[1];
const EXPORT_JS = scriptMatch[1];

const LOGO = 'https://firebasestorage.googleapis.com/v0/b/websites-a0e13.appspot.com/o/IBAP%2FCMS_CONTENT%2FMEDIA%2Fwebsite%2F2025-09-22-Y29G6FKM7K-ibap%2FLogoFull-400-CMMY.webp?alt=media&token=0b0e973f-f3de-4f7e-9abf-d94c5871a9cd';
const SITE = 'https://futurebridgeacademy.ca';

/* one photo per role; focus is the object-position that keeps the subject
   clear of the dark wash and the title on the left */
const PHOTOS = {
  'curriculum-builder': { id: '4990545', focus: '42% 32%' },
  'career-coach': { id: '5816300', focus: '50% 30%' },
  'self-paced-course-assistant': { id: '16420237', focus: '50% 30%' },
  'online-maths-teacher': { id: '5212321', focus: '50% 20%' },
  'seminar-presenter-english': { id: '8424451', focus: '50% 30%' },
  'career-path-presenter': { id: '38081093', focus: '50% 30%' },
  'academic-writing-guide': { id: '5756573', focus: '50% 50%' },
  'mock-exam-organiser': { id: '7092523', focus: '50% 35%' },
  'online-lessons-helper': { id: '4314216', focus: '50% 30%' },
  'seminar-presenter-other-languages': { id: '14814047', focus: '50% 50%' }
};

function photoFor(slug) {
  const entry = PHOTOS[slug] || { id: '6683675', focus: '50% 6%' };
  return {
    src: `https://images.pexels.com/photos/${entry.id}/pexels-photo-${entry.id}.jpeg?auto=compress&cs=tinysrgb&w=1400`,
    focus: entry.focus
  };
}

const ICONS = {
  check: '<circle cx="12" cy="12" r="8.6"/><path d="M8.3 12.3l2.6 2.6 4.9-5.1"/>',
  doc: '<path d="M7 3.6h6.6L18 8v12.4H7z"/><path d="M13.4 3.6V8H18"/><path d="M9.6 12.4h5.4M9.6 16h3.6"/>',
  chat: '<path d="M4 5.4h16v10.2H12l-5 3.4v-3.4H4z"/><path d="M7.8 9.2h8.4M7.8 12.2h5"/>',
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.4V12l3.3 2"/>',
  chart: '<path d="M4 19.4h16"/><path d="M7 19.4v-5.2M12 19.4V7.2M17 19.4v-8.4"/>',
  target: '<circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="4"/><path d="M12 3.6v2.6M12 17.8v2.6M3.6 12h2.6M17.8 12h2.6"/>',
  mic: '<rect x="9" y="3.4" width="6" height="10" rx="3"/><path d="M6.4 11.4a5.6 5.6 0 0 0 11.2 0"/><path d="M12 17v3.4"/>',
  calc: '<rect x="5" y="3.4" width="14" height="17.2" rx="2.2"/><path d="M8.4 7.6h7.2"/><path d="M8.6 12.2h.01M12 12.2h.01M15.4 12.2h.01M8.6 16.2h.01M12 16.2h.01M15.4 16.2h.01"/>',
  people: '<circle cx="9" cy="8.4" r="3"/><path d="M3.6 19.2c0-2.9 2.4-4.8 5.4-4.8s5.4 1.9 5.4 4.8"/><path d="M16 6.2a3 3 0 0 1 0 5.6"/><path d="M17.4 14.6c1.9.6 3 2.2 3 4.6"/>',
  card: '<rect x="3.4" y="6" width="17.2" height="12" rx="2"/><path d="M3.8 10.4h16.4"/><path d="M7 14.4h4"/>'
};

const ROLES = [
  {
    slug: 'curriculum-builder',
    name: 'Curriculum builder',
    hours: 'From 1 hour a week · your own pace',
    lede: 'Build the material one task at a time: take a task from our list, finish it properly, mark it done and take the next. How much you take on is up to you.',
    doing: [
      ['doc', 'Pick one task', 'from our long, ready-made list.'],
      ['check', 'Write or check it', 'to the standard of the tasks around it.'],
      ['chart', 'Mark it done', 'and take the next one when you have time.']
    ],
    fit: ['Solid in the subject you build for', 'Happy to work from a list, unsupervised']
  },
  {
    slug: 'career-coach',
    name: 'Career coach',
    hours: 'Hours agreed with the programme lead',
    lede: 'Guide one high-school student at a time: set the goal together, build their file, and work the tasks with them until it is complete.',
    doing: [
      ['target', 'Set the goal', 'with the student, not for them.'],
      ['people', 'Agree the tasks', 'that will complete their file.'],
      ['check', 'Meet and work', 'the tasks with them, date by date.']
    ],
    fit: ['You have walked a university, college or trades path', 'Reliable with a teenager\u2019s deadlines, without nagging']
  },
  {
    slug: 'self-paced-course-assistant',
    name: 'Self-paced course assistant',
    hours: 'WhatsApp group · your own schedule',
    lede: 'Guide a group of students through a self-paced course, online in a WhatsApp group: answer their questions and keep an eye on who is falling behind.',
    doing: [
      ['chat', 'Answer the group', 'when students get stuck.'],
      ['chart', 'Follow each student', 'subject by subject, in the system.'],
      ['check', 'Clear them forward', 'to the next subject when they finish one.']
    ],
    fit: ['Quick to reply on WhatsApp', 'Patient when the same question comes back']
  },
  {
    slug: 'online-maths-teacher',
    name: 'Online maths teacher',
    hours: '1 hour a week · one lesson every week',
    lede: 'Teach the weekly free online maths lesson: explain the topic, work through it with the group, and close the gap you find.',
    doing: [
      ['calc', 'Prepare the topic', 'with the lesson plan we give you.'],
      ['mic', 'Teach one hour a week', 'to the live online group.'],
      ['chart', 'Find the gap', 'and tell us where it was.']
    ],
    fit: ['Maths to grade 12 level', 'One fixed weekly slot you can hold']
  },
  {
    slug: 'seminar-presenter-english',
    name: 'Scholarship presenter (English)',
    hours: 'Research at your own pace · presenting hours agreed',
    lede: 'Find the scholarships that are really open, record every detail, build the presentation pages, then present the seminar in English.',
    doing: [
      ['doc', 'Check the sources', 'official pages only, not aggregator sites.'],
      ['chart', 'Record each one', 'value, eligibility, documents, deadline.'],
      ['mic', 'Present the seminar', 'in English, and take the awkward questions.']
    ],
    fit: ['Precise with official sources and numbers', 'Comfortable presenting online']
  },
  {
    slug: 'career-path-presenter',
    name: 'Career path presenter',
    hours: 'Hours agreed with the programme lead',
    lede: 'Present your own profession to students and parents from every angle: the real week, the pay, the requirements, and what actually gets you hired.',
    doing: [
      ['card', 'Show the real week', 'what you do, not the job advert.'],
      ['chart', 'Explain the route', 'subjects, courses, licences, pay, hours.'],
      ['mic', 'Answer the room', 'and say what to prepare at school now.']
    ],
    fit: ['You work in that profession today', 'Can talk plainly about pay and trade-offs']
  },
  {
    slug: 'academic-writing-guide',
    name: 'Academic writing guide',
    hours: 'Hours agreed with the programme lead',
    lede: 'Set the writing tasks, follow how each student is doing, and give feedback on structure and editing, not on what they think.',
    doing: [
      ['doc', 'Set the tasks', 'clearly enough to know what finished looks like.'],
      ['chart', 'Follow progress', 'student by student, inside the system.'],
      ['check', 'Coach the writing', 'structure, argument and editing.']
    ],
    fit: ['You write well and can explain why', 'You coach instead of rewriting']
  },
  {
    slug: 'mock-exam-organiser',
    name: 'Mock exam organiser',
    hours: '6 to 8 hours per exam · at most one every two months',
    lede: 'Run the monthly mock exam with the exam team: print the papers, manage the registrations, help on the day, then check and enter the results.',
    doing: [
      ['doc', 'Prepare the papers', 'printed and checked before the day.'],
      ['people', 'Manage registrations', 'the list, confirmations and reminders.'],
      ['check', 'Run exam day', 'then mark against the key and enter results.']
    ],
    fit: ['Organised with dates, lists and follow-ups', 'Free on the exam day you take']
  },
  {
    slug: 'online-lessons-helper',
    name: 'Online lessons helper',
    hours: 'One or more lessons · you choose how many',
    lede: 'Sit inside the live lesson with the teacher: answer the chat, look after the students who go quiet, and follow up about dates and anything they missed.',
    doing: [
      ['chat', 'Be in the lesson', 'alongside the teacher, every time.'],
      ['check', 'Watch the quiet ones', 'so nobody is lost inside the hour.'],
      ['clock', 'Follow up', 'with students and parents about dates.']
    ],
    fit: ['Comfortable in a live online session', 'Good at noticing the student who went quiet']
  },
  {
    slug: 'seminar-presenter-other-languages',
    name: 'Scholarship presenter (other languages)',
    hours: 'Research at your own pace · presenting hours agreed',
    lede: 'Take the scholarship research and presentation, translate the parts that must be exact, and present the seminar in your language.',
    doing: [
      ['doc', 'Check the sources', 'official pages only, in both languages.'],
      ['check', 'Translate exactly', 'eligibility, documents, deadlines, money.'],
      ['mic', 'Present your language', 'and answer what parents ask quietly.']
    ],
    fit: ['Fluent in English and in your language', 'Careful with numbers, dates and translation']
  }
];

const EXTRA_CSS = `
  /* =========================================================================
     ROLE FLYER - one page per idea, tuned on top of the shared flyer styles
     ========================================================================= */
  .role-flyer .hero .hero-title { font-size: 40px; max-width: 92%; }
  html[data-format="mobile"] .role-flyer .hero .hero-title { font-size: 26px; }

  /* the role photo carries the poster, so the wash is a little lighter than
     the main flyer and the hero keeps a bit more height */
  .role-flyer .hero-wash {
    background:
      linear-gradient(100deg, rgba(0,34,60,0.94) 0%, rgba(0,44,78,0.78) 46%, rgba(0,54,95,0.16) 100%),
      radial-gradient(120% 90% at 98% 4%, rgba(255,107,53,0.42) 0%, rgba(255,107,53,0) 62%);
  }
  html[data-format="mobile"] .role-flyer .hero .hero-inner { padding: 26px 6mm 28px; }

  .role-hours {
    display: inline-flex; align-items: center; gap: 8px;
    margin-top: 12px; padding: 6px 13px; border-radius: 999px;
    background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.30);
    color: #fff; font-size: 11.5px; font-weight: 700;
  }
  .role-hours::before {
    content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--brand-3);
  }
  html[data-format="mobile"] .role-hours { margin-top: 10px; padding: 5px 10px; font-size: 10.5px; }

  .fit .inner { padding-top: 6mm; padding-bottom: 7mm; }
  .fit-head { font-size: 12px; font-weight: 900; letter-spacing: 0.12em; text-transform: uppercase; color: var(--brand-1); }
  .fit-list { display: grid; gap: 8px; margin-top: 10px; }
  @media (min-width: 640px) { .fit-list { grid-template-columns: 1fr 1fr; gap: 10px 22px; } }
  .fit-item {
    display: flex; align-items: flex-start; gap: 9px;
    font-size: 12.5px; line-height: 1.35; color: var(--muted); font-weight: 600;
  }
  .fit-item::before {
    content: ""; flex: 0 0 auto; width: 8px; height: 8px; margin-top: 5px;
    border-radius: 2px; background: var(--brand-4);
  }
  html[data-format="mobile"] .fit .inner { padding-top: 5mm; padding-bottom: 6mm; }
  html[data-format="mobile"] .fit-item { font-size: 12px; }

  /* desktop sheets: the hero and the closing block take the leftover height */
  @media print {
    html[data-format="desktop"] .role-flyer .page-1 .hero { flex: 1 1 auto; }
    html[data-format="desktop"] .role-flyer .cta-giant {
      flex: 1 1 auto;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
    }
    /* mobile sheets: proof + steps open sheet 2, the gold block closes sheet 3 */
    html[data-format="mobile"] .role-flyer .why,
    html[data-format="mobile"] .role-flyer .statement,
    html[data-format="mobile"] .role-flyer .steps { page-break-before: auto; break-before: auto; }
    html[data-format="mobile"] .role-flyer .leave { page-break-before: always; break-before: page; }
    html[data-format="mobile"] .role-flyer .statement { min-height: 0; }
    html[data-format="mobile"] .role-flyer .positions { min-height: 0; }
    html[data-format="mobile"] .role-flyer .cta-giant { min-height: calc(230mm - 400px); }
    html[data-format="mobile"] .role-flyer .fit { page-break-inside: avoid; break-inside: avoid; }
  }
`;

function iconSvg(name) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + ICONS[name] + '</svg>';
}

function renderSections(role) {
  const reasons = role.doing.map(([icon, head, body]) => `          <div class="reason">
            <span class="reason-ico" aria-hidden="true">
              ${iconSvg(icon)}
            </span>
            <p class="reason-txt"><strong>${head}</strong>${body}</p>
          </div>`).join('\n');

  const fitItems = role.fit.map((line) => `          <li class="fit-item">${line}</li>`).join('\n');

  return { reasons, fitItems };
}

function renderPage(role) {
  const roleUrl = `${SITE}/volunteer-role-${role.slug}`;
  const applyUrl = `${SITE}/volunteer`;
  const { reasons, fitItems } = renderSections(role);
  const photo = photoFor(role.slug);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${role.name} - volunteer flyer | Future Bridge Academy</title>
<style>
${BASE_CSS}
</style>
<style id="fba-page-size"></style>
<style>${EXTRA_CSS}</style>
</head>
<body>

<div class="export-bar no-print">
  <span class="export-label">Save as PDF:</span>
  <button type="button" data-export="desktop">Desktop (A4)</button>
  <button type="button" data-export="mobile">Mobile (phone)</button>
  <span class="export-hint">In the print dialog choose Destination "Save as PDF", Margins "None" and turn Background graphics on.</span>
</div>

<div class="flyer role-flyer">

  <!-- ============================ PAGE 1 ============================ -->
  <div class="page page-1">
    <div class="topbar">
      <img class="topbar-logo" src="${LOGO}" alt="Future Bridge Academy">
      <span class="topbar-tag">Volunteer<br>role</span>
    </div>

    <section class="hero">
      <img class="hero-photo" src="${photo.src}" alt="" style="object-position:${photo.focus}">
      <div class="hero-wash" aria-hidden="true"></div>
      <div class="inner hero-inner">
        <p class="kicker gold">Volunteer role</p>
        <h1 class="hero-title">${role.name}</h1>
        <p class="hero-lede">${role.lede}</p>
        <p class="role-hours">${role.hours}</p>
        <div class="hero-cta">
          <a class="btn btn-xl" href="${applyUrl}">Apply for this role <span class="arrow">\u2192</span></a>
          <a class="btn ghost" href="${roleUrl}">Full role details</a>
        </div>
      </div>
      <div class="ribbon" aria-hidden="true"><span>Open now</span></div>
    </section>

    <div class="slash" aria-hidden="true"></div>

    <section class="why">
      <div class="inner">
        <p class="fit-head">What you would actually do</p>
        <div class="reasons">
${reasons}
        </div>
      </div>
    </section>

    <section class="fit">
      <div class="inner">
        <p class="fit-head">You would be good at this if</p>
        <ul class="fit-list">
${fitItems}
        </ul>
      </div>
    </section>

    <div class="ticket-wrap">
      <div class="ticket">
        <div>
          <strong class="ticket-strong">Apply in 3 minutes</strong>
          <span>futurebridgeacademy.ca/volunteer</span>
        </div>
        <a class="ticket-btn" href="${applyUrl}">Apply <span>\u2192</span></a>
      </div>
    </div>
  </div>

  <!-- ============================ PAGE 2 ============================ -->
  <div class="page page-2">

    <div class="topbar">
      <img class="topbar-logo" src="${LOGO}" alt="Future Bridge Academy">
      <span class="topbar-tag">Apply<br>today</span>
    </div>

    <section class="leave">
      <div class="inner">
        <p class="kicker gold">What you leave with</p>
        <h2 class="big-h2 big-h2-light">Proof you can hand to <span class="hl2">anyone.</span></h2>
        <div class="leave-grid">
          <div class="leave-item">
            <span class="leave-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.6"/><path d="M12 7.4V12l3.3 2"/></svg>
            </span>
            <strong>Documented hours</strong><span>A written record</span>
          </div>
          <div class="leave-item">
            <span class="leave-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.4" y="5.6" width="17.2" height="12.8" rx="2.2"/><path d="M3.9 6.8 12 12.7l8.1-5.9"/></svg>
            </span>
            <strong>Specific reference</strong><span>What you did</span>
          </div>
          <div class="leave-item">
            <span class="leave-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.6 9.3 12 5.1l9.4 4.2-9.4 4.2z"/><path d="M6.6 11.4v4.1c0 1.4 2.4 2.4 5.4 2.4s5.4-1 5.4-2.4v-4.1"/><path d="M21.4 9.3v5.2"/></svg>
            </span>
            <strong>Support letter</strong><span>Uni or scholarship</span>
          </div>
          <div class="leave-item">
            <span class="leave-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.4h16"/><path d="M7 19.4v-5.2M12 19.4V7.2M17 19.4v-8.4"/></svg>
            </span>
            <strong>Term review</strong><span>What to work on</span>
          </div>
        </div>
      </div>
    </section>

    <section class="steps">
      <div class="inner">
        <p class="kicker">How to join</p>
        <h2 class="big-h2">Five steps.</h2>
        <div class="steps-grid">
          <div class="step"><span class="num">1</span><strong>Apply</strong><p>Three minutes, one form.</p></div>
          <div class="step"><span class="num">2</span><strong>Interview</strong><p>A short video chat.</p></div>
          <div class="step"><span class="num">3</span><strong>Sample</strong><p>Show the work once.</p></div>
          <div class="step"><span class="num">4</span><strong>References</strong><p>We make the calls.</p></div>
          <div class="step"><span class="num">5</span><strong>Decision</strong><p>Role and start date.</p></div>
        </div>
      </div>
    </section>

    <section class="cta-giant">
      <img class="cta-logo" src="${LOGO}" alt="Future Bridge Academy">
      <h2>Apply for ${role.name}</h2>
      <p>One form, three minutes. Choose this role and tell us when you are genuinely free.</p>
      <a class="btn" href="${applyUrl}">Start my application <span class="arrow">\u2192</span></a>
      <a class="cta-url-big" href="${roleUrl}">${roleUrl.replace('https://', '')}</a>
    </section>

    <div class="footer">
      <div class="inner">
        <span>\u00a9 2026 Future Bridge Academy \u00b7 All rights reserved.</span>
        <span>Questions? <a href="mailto:info@futurebridgeacademy.ca">info@futurebridgeacademy.ca</a></span>
        <span><a href="${SITE}/volunteer-positions">All ten roles \u2192</a></span>
      </div>
    </div>
  </div>

</div>

<script>
${EXPORT_JS}
</script>

</body>
</html>
`;
}

function renderIndex(roles) {
  const items = roles.map((role) => `      <li>
        <a class="name" href="role-${role.slug}.html">${role.name}</a>
        <span class="hours">${role.hours}</span>
        <span class="links">
          <a href="role-${role.slug}.html">A4</a>
          <a href="role-${role.slug}.html?format=mobile">Mobile</a>
        </span>
      </li>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Role flyers | Future Bridge Academy</title>
<style>
  :root { --ink: #102A43; --muted: #486581; --line: #E2E8F0; --brand: #FF6B35; --brand-2: #004E89; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, "Segoe UI", Arial, sans-serif; background: #F5F8FC; color: var(--ink); padding: 32px 18px 60px; }
  main { max-width: 780px; margin: 0 auto; }
  h1 { font-size: 26px; letter-spacing: -0.01em; }
  p.lede { margin-top: 8px; color: var(--muted); font-size: 14px; line-height: 1.55; }
  ul { list-style: none; margin-top: 24px; background: #fff; border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
  li { display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px 16px; padding: 14px 18px; border-top: 1px solid var(--line); }
  li:first-child { border-top: 0; }
  a { color: var(--brand-2); }
  li .name { font-weight: 800; font-size: 15px; text-decoration: none; }
  li .name:hover { color: var(--brand); }
  li .hours { flex: 1 1 240px; color: var(--muted); font-size: 12.5px; }
  li .links { display: flex; gap: 8px; }
  li .links a { font-size: 12px; font-weight: 800; text-decoration: none; border: 1px solid var(--line); border-radius: 999px; padding: 6px 12px; }
  li .links a:hover { background: var(--brand-2); border-color: var(--brand-2); color: #fff; }
</style>
</head>
<body>
<main>
  <h1>Ten role flyers</h1>
  <p class="lede">One flyer per open role, in the same design as the main volunteer flyer. Each file opens in
    the Desktop (A4) format; the Mobile link opens the phone-sized format. In the page's export bar choose
    "Save as PDF", set Margins to "None" and turn Background graphics on.</p>
  <ul>
${items}
  </ul>
</main>
</body>
</html>
`;
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  ROLES.forEach((role) => {
    const html = renderPage(role);
    const file = path.join(OUT_DIR, 'role-' + role.slug + '.html');
    fs.writeFileSync(file, html, 'utf8');
    console.log('built ' + path.basename(file));
  });
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), renderIndex(ROLES), 'utf8');
  console.log('built index.html');
  console.log('total roles: ' + ROLES.length);
}

main();
