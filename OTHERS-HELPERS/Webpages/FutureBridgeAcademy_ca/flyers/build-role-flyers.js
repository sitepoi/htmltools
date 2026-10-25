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
  'curriculum-builder': { id: '39190907', focus: '50% 35%' },
  'career-coach': { id: '5940706', focus: '50% 35%' },
  'self-paced-course-assistant': { id: '8926900', focus: '50% 30%' },
  'online-maths-teacher': { id: '8192244', focus: '55% 30%' },
  'seminar-presenter-english': { id: '8424451', focus: '50% 30%' },
  'career-path-presenter': { id: '8199134', focus: '50% 40%' },
  'academic-writing-guide': { id: '5676746', focus: '50% 40%' },
  'mock-exam-organiser': { id: '8423075', focus: '50% 35%' },
  'online-lessons-helper': { id: '5905749', focus: '50% 45%' },
  'seminar-presenter-other-languages': { id: '6150530', focus: '50% 30%' }
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

/* every role flyer carries the volunteer-network signature; the styles live in
   volunteers-flyer.html so both the main flyer and the role flyers share one copy */
const SHOW_NETWORK = true;

const ROLES = [
  {
    slug: 'curriculum-builder',
    name: 'Curriculum builder',
    hours: 'From 1 hour a week · your own pace',
    lede: 'Work through our task list with the tools we give you: finish one item properly, mark it done, take the next. No subject expertise needed.',
    doing: [
      ['doc', 'Pick one task', 'from our long, ready-made list.'],
      ['check', 'Write or check it', 'to the standard of the tasks around it.'],
      ['chart', 'Mark it done', 'and take the next one when you have time.']
    ],
    fit: ['Confident with computers and online tools', 'Patient until one task is exactly right']
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
    fit: ['Maths from grade 5 to grade 12', 'One fixed weekly slot you can hold']
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
    lede: 'Do the messages around each lesson and help inside it: let students and parents know it is coming, remind them of the time, and answer them in the chat while it runs.',
    doing: [
      ['chat', 'Send the reminders', 'that the lesson is happening, and when.'],
      ['clock', 'Follow it through', 'before the start, at the start, just after.'],
      ['check', 'Help in the lesson', 'answer students and parents in the chat.']
    ],
    fit: ['Confident messaging students and parents', 'Punctual with reminders, helpful in the chat']
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
  html[data-format="mobile"] .role-flyer .hero .hero-inner { padding: 50px 6mm 54px; }

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

  /* how to join, as one compact strip so sheet two holds the whole story */
  .steps-strip { background: var(--paper); }
  .steps-strip .inner { padding-top: 6mm; padding-bottom: 6mm; }
  .strip-list {
    display: flex; flex-wrap: wrap; gap: 8px 7px;
    margin-top: 10px; list-style: none; counter-reset: strip;
  }
  .strip-list li {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 6px 11px; border-radius: 999px;
    background: var(--paper-soft); border: 1px solid var(--line);
    color: var(--ink); font-size: 11.5px; font-weight: 700;
  }
  .strip-list li::before {
    counter-increment: strip; content: counter(strip);
    display: inline-flex; align-items: center; justify-content: center;
    width: 16px; height: 16px; border-radius: 50%;
    background: var(--brand-1); color: #fff; font-size: 9px; font-weight: 900;
  }
  html[data-format="mobile"] .steps-strip .inner { padding-top: 5mm; padding-bottom: 5mm; }
  html[data-format="mobile"] .strip-list { gap: 6px; }
  html[data-format="mobile"] .strip-list li { font-size: 11px; padding: 5px 9px; }

  html[data-format="mobile"] .role-flyer .cta-giant.has-lockup { padding-top: 5mm; padding-bottom: 5mm; }

  /* one sheet only: nothing in a role flyer may start a fresh page */
  @media print {
    html[data-format="mobile"] .role-flyer .why,
    html[data-format="mobile"] .role-flyer .leave,
    html[data-format="mobile"] .role-flyer .leave-compact {
      page-break-before: auto; break-before: auto;
    }
    html[data-format="mobile"] .role-flyer .fit { page-break-inside: avoid; break-inside: avoid; }
  }

  /* =========================================================================
     RULESET PORT - see FLYER-RULES.md
     label pill, photo shift, print bake, phone sheet that ends on the footer
     ========================================================================= */
  .role-flyer .hero-pill {
    display: inline-flex; align-items: center; gap: 8px;
    margin: 0 0 10px; padding: 7px 15px; border-radius: 999px;
    background: #fff; color: var(--brand-2-deep);
    font-size: 11px; font-weight: 900; letter-spacing: 0.16em; text-transform: uppercase;
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.26);
  }
  .role-flyer .hero-pill::before {
    content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--brand-1);
  }
  html[data-format="mobile"] .role-flyer .hero-pill { font-size: 10px; padding: 5px 12px; margin-bottom: 8px; }
  /* one primary action on the narrow sheet, and no ribbon over the face */
  html[data-format="mobile"] .role-flyer .hero .hero-cta .btn.ghost { display: none; }
  html[data-format="mobile"] .role-flyer .ribbon { display: none; }

  /* 110% wide, anchored left: the subject sits right of the copy, no gap */
  .role-flyer .hero-photo {
    position: absolute; top: 0; left: 0; width: 110%; height: 100%; object-fit: cover;
  }

  /* =========================================================================
     ONE PAGE ROLE SHEET
     Hero, what you would do, who fits, what you leave with, contacts. The
     five-step strip, the second ticket and the giant closing block were
     dropped: they repeated the apply action and cost a whole sheet.
     ========================================================================= */
  .role-flyer .leave.leave-compact { background: var(--paper); color: var(--ink); padding: 0; }
  .role-flyer .leave-compact .inner { padding-top: 5mm; padding-bottom: 6mm; }
  /* one small label instead of the old gold kicker + display heading */
  .role-flyer .leave-compact .kicker {
    display: block; margin: 0; font-size: 12px; font-weight: 900;
    letter-spacing: 0.12em; text-transform: uppercase; color: var(--brand-1);
  }
  .role-flyer .leave-compact .big-h2 { display: none; }
  .role-flyer .leave-compact .leave-grid { margin-top: 8px; gap: 8px; }
  .role-flyer .leave-compact .leave-item {
    text-align: left; border: 1px solid var(--line); border-radius: 10px;
    background: var(--paper-soft); padding: 9px 11px;
  }
  .role-flyer .leave-compact .leave-ico { display: none; }
  .role-flyer .leave-compact .leave-item strong { font-size: 12px; color: var(--ink); }
  .role-flyer .leave-compact .leave-item span { font-size: 10px; color: var(--muted); }
  html[data-format="mobile"] .role-flyer .leave-compact .leave-grid { grid-template-columns: 1fr 1fr; gap: 6px; }
  html[data-format="mobile"] .role-flyer .leave-compact .leave-item { padding: 7px 9px; }
  html[data-format="mobile"] .role-flyer .leave-compact .leave-item strong { font-size: 11.5px; }
  html[data-format="mobile"] .role-flyer .leave-compact .leave-item span { font-size: 9.5px; }

  /* phone sheet: every block has to earn its height */
  html[data-format="mobile"] .role-flyer .hero .hero-inner { padding: 20px 6mm 22px; }
  html[data-format="mobile"] .role-flyer .hero .hero-cta { margin-top: 12px; }
  html[data-format="mobile"] .role-flyer .why .inner { padding-top: 3mm; padding-bottom: 3mm; }
  html[data-format="mobile"] .role-flyer .leave-compact .kicker { font-size: 10.5px; letter-spacing: 0.10em; }
  html[data-format="mobile"] .role-flyer .reasons { gap: 5px; }
  html[data-format="mobile"] .role-flyer .reason { padding: 7px 11px; }
  html[data-format="mobile"] .role-flyer .fit .inner { padding-top: 3mm; padding-bottom: 3mm; }
  html[data-format="mobile"] .role-flyer .fit-list { display: flex; flex-wrap: wrap; gap: 6px; }
  html[data-format="mobile"] .role-flyer .fit-item { font-size: 10.5px; }
  html[data-format="mobile"] .role-flyer .leave-compact .inner { padding-top: 3mm; padding-bottom: 2mm; }

  /* closing bar: stamp + contacts + apply, the same bar the main flyer uses */
  .role-flyer .foot-one {
    margin-top: auto;
    display: flex; align-items: center; justify-content: space-between;
    gap: 10px 18px; flex-wrap: wrap;
    padding: 9px 10mm 11px;
    background: var(--brand-2-deep); color: rgba(255, 255, 255, 0.85);
  }
  .role-flyer .foot-one .net-lockup {
    margin: 0; padding: 5px 12px;
    background: rgba(255, 255, 255, 0.10);
    border: 1px solid rgba(255, 255, 255, 0.32);
  }
  .role-flyer .foot-one .net-lockup b { color: #fff; font-size: 12px; }
  .role-flyer .foot-one .net-lockup span { color: rgba(255, 255, 255, 0.72); font-size: 7px; }
  /* a long mail address must be allowed to shrink and wrap, otherwise it runs
     underneath the apply pill on the A4 bar */
  .role-flyer .foot-meta {
    display: flex; flex-direction: column; gap: 1px; font-size: 8.5px; line-height: 1.5;
    flex: 1 1 200px; min-width: 0;
  }
  .role-flyer .foot-meta span,
  .role-flyer .foot-meta a { overflow-wrap: anywhere; }
  .role-flyer .foot-meta a { color: var(--brand-3); font-weight: 700; text-decoration: none; }
  .role-flyer .foot-apply {
    display: inline-flex; align-items: center;
    background: var(--brand-3); color: var(--brand-2-deep);
    font-size: 10px; font-weight: 900; letter-spacing: 0.03em;
    padding: 8px 15px; border-radius: 999px; text-decoration: none;
  }
  html[data-format="mobile"] .role-flyer .foot-one {
    display: grid; grid-template-columns: 1fr auto; align-items: center;
    gap: 8px 10px; padding: 10px 6mm 13px;
  }
  html[data-format="mobile"] .role-flyer .foot-one .net-lockup { grid-column: 1; grid-row: 1; }
  html[data-format="mobile"] .role-flyer .foot-apply { grid-column: 2; grid-row: 1; font-size: 10px; padding: 8px 14px; }
  html[data-format="mobile"] .role-flyer .foot-meta {
    grid-column: 1 / -1; flex-direction: row; flex-wrap: wrap; gap: 2px 10px; font-size: 8px;
  }

  @media print {
    /* viewers that drop alpha gradients over an image would leave the copy on
       the bare photo, so the darkening is baked into the bitmap instead */
    .role-flyer .hero-wash { display: none !important; }
    .role-flyer .hero-photo { filter: brightness(0.40) saturate(0.92) contrast(1.06); }

    /* the sheet ends on the closing bar; the leftover height is shared as
       even gaps between blocks instead of one white hole */
    .role-flyer .page { display: flex; flex-direction: column; justify-content: space-between; }
    .role-flyer .page > .hero { flex: 0 0 auto; }
    .role-flyer .page > .leave-compact { flex: 0 0 auto; }
    .role-flyer .page > .foot-one { margin-top: 0; }
    html[data-format="mobile"] .role-flyer .page { min-height: 229mm; }
    html[data-format="mobile"] .role-flyer .page > .fit { flex: 0 0 auto; }
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

  <!-- ============================ SHEET ============================ -->
  <div class="page page-1">
    <div class="topbar">
      <img class="topbar-logo" src="${LOGO}" alt="Future Bridge Academy">
      <span class="topbar-tag">Volunteer<br>role</span>
    </div>

    <section class="hero">
      <img class="hero-photo" src="${photo.src}" alt="" style="object-position:${photo.focus}">
      <div class="hero-wash" aria-hidden="true"></div>
      <div class="inner hero-inner">
        <p class="hero-pill">Volunteer role</p>
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

    <section class="leave leave-compact">
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

    <!-- closing bar: stamp, contacts, apply - the last block of the sheet -->
    <footer class="foot-one">
      <div class="net-lockup"><b>FBVN</b><span>Future Bridge Volunteer Network</span></div>
      <div class="foot-meta">
        <span>\u00a9 2026 Future Bridge Academy \u00b7 All rights reserved.</span>
        <span>Questions? <a href="mailto:info@futurebridgeacademy.ca">info@futurebridgeacademy.ca</a></span>
      </div>
      <a class="foot-apply" href="${applyUrl}">Apply online \u2192</a>
    </footer>
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
  <p class="lede" style="margin-top:26px;">
    Sharing the flyers on WhatsApp? The ready-made Turkish and English messages for parents, students and
    partners are in <a href="../whatsapp-messages.html">whatsapp-messages.html</a>.
  </p>
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
