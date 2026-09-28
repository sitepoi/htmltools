/* ═══════════════════════════════════════════════
   JS - CSJ Staff Handbook Tool
   ═══════════════════════════════════════════════ */

// ── DEFAULT DATA MODEL ──────────────────────────────
const DEFAULTS = {
  programYear: '2026',
  effectiveDate: 'June 26, 2026',
  contractStartDate: '',
  contractEndDate: '',
  durationWeeks: 8,
  durationLabel: '8 Weeks (2 Months)',
  durationDisplay: 'fixed',
  hoursPerWeek: 35,
  dailyStart: '10:00 AM',
  dailyEnd: '5:30 PM',
  breakStart: '2:00 PM',
  breakEnd: '2:30 PM',
  breakMin: 30,
  shiftHrs: 7.5,
  paidHrs: 7.0,
  workDays: 'Monday – Friday',
  weekend: 'Saturday / Sunday',
  holidays: [
    { name: 'Canada Day', date: 'July 1',
      note: 'Regular workday - 30-day qualifying period not met (only ~1 week employed)' },
    { name: 'BC Day (Civic Holiday)', date: 'First Monday of August',
      note: '✅ Paid day off - 30-day rule met, no make-up required' },
    { name: 'Labour Day', date: 'First Monday of September',
      note: 'Outside contract dates - does not apply' }
  ],
  contacts: {
    supervisor:  { name: '', phone: '', email: '' },
    hr:          { name: '', phone: '', email: '' },
    safety:      { name: '', phone: '', email: '' },
    it:          { name: '', phone: '', email: '' },
    afterHours:  { name: '', phone: '', email: '' }
  },
  emergencyLoc: {
    fireAlarm: '',
    fireExt: '',
    firstAid: '',
    primaryExit: '',
    secondaryExit: '',
    assembly: '',
    eyewash: ''
  },
  orgName: 'our organization',
  orgNameCap: 'Our organization',
  companyName: '',
  companyLogo: '',
  province: 'British Columbia',
  showIPSection: 'no'
};

// ── PROVINCE-SPECIFIC LEGAL REFERENCES ──────────────
var PROVINCE_LAW = {
  'British Columbia': {
    ohsAct: 'Workers Compensation Act',
    ohsReg: 'Occupational Health and Safety Regulation',
    harassmentLaw: 'Bill 14 - Workers Compensation Amendment Act (harassment & violence prevention)',
    employmentStandards: 'Employment Standards Act',
    humanRights: 'BC Human Rights Code',
    wsib: 'WorkSafeBC',
    wsibPhone: '1-888-621-7233',
    wsibWeb: 'worksafebc.com'
  },
  'Alberta': {
    ohsAct: 'Occupational Health and Safety Act',
    ohsReg: 'OHS Code',
    harassmentLaw: 'OHS Act (harassment & violence prevention provisions)',
    employmentStandards: 'Employment Standards Code',
    humanRights: 'Alberta Human Rights Act',
    wsib: 'WCB Alberta',
    wsibPhone: '1-866-922-9221',
    wsibWeb: 'wcb.ab.ca'
  },
  'Saskatchewan': {
    ohsAct: 'Occupational Health and Safety Act',
    ohsReg: 'Occupational Health and Safety Regulations',
    harassmentLaw: 'OHS Act (harassment & violence prevention provisions)',
    employmentStandards: 'Employment Standards Act',
    humanRights: 'Saskatchewan Human Rights Code',
    wsib: 'WCB Saskatchewan',
    wsibPhone: '1-800-667-7590',
    wsibWeb: 'wcbsask.com'
  },
  'Manitoba': {
    ohsAct: 'Workplace Safety and Health Act',
    ohsReg: 'Workplace Safety and Health Regulation',
    harassmentLaw: 'Workplace Safety and Health Act (harassment & violence prevention provisions)',
    employmentStandards: 'Employment Standards Code',
    humanRights: 'Manitoba Human Rights Code',
    wsib: 'WCB Manitoba',
    wsibPhone: '1-855-954-4321',
    wsibWeb: 'wcb.mb.ca'
  },
  'Ontario': {
    ohsAct: 'Occupational Health and Safety Act (OHSA)',
    ohsReg: 'O. Reg. 213/91 and other applicable regulations',
    harassmentLaw: 'Bill 132 / Bill 168 - OHSA amendments (workplace harassment & violence)',
    employmentStandards: 'Employment Standards Act, 2000',
    humanRights: 'Ontario Human Rights Code',
    wsib: 'WSIB Ontario',
    wsibPhone: '1-800-387-0750',
    wsibWeb: 'wsib.ca'
  },
  'Quebec': {
    ohsAct: 'Act respecting occupational health and safety (AOHS)',
    ohsReg: 'Regulation respecting occupational health and safety',
    harassmentLaw: 'AOHS and Act respecting labour standards (psychological & sexual harassment)',
    employmentStandards: 'Act respecting labour standards',
    humanRights: 'Charter of Human Rights and Freedoms',
    wsib: 'CNESST',
    wsibPhone: '1-844-838-0808',
    wsibWeb: 'cnesst.gouv.qc.ca'
  },
  'New Brunswick': {
    ohsAct: 'Occupational Health and Safety Act',
    ohsReg: 'OHS Regulations',
    harassmentLaw: 'OHS Act (harassment & violence prevention provisions)',
    employmentStandards: 'Employment Standards Act',
    humanRights: 'New Brunswick Human Rights Act',
    wsib: 'WorkSafeNB',
    wsibPhone: '1-800-999-9775',
    wsibWeb: 'worksafenb.ca'
  },
  'Nova Scotia': {
    ohsAct: 'Occupational Health and Safety Act',
    ohsReg: 'OHS Regulations',
    harassmentLaw: 'OHS Act (harassment & violence prevention provisions)',
    employmentStandards: 'Labour Standards Code',
    humanRights: 'Nova Scotia Human Rights Act',
    wsib: 'WCB Nova Scotia',
    wsibPhone: '1-800-870-3331',
    wsibWeb: 'wcb.ns.ca'
  },
  'Prince Edward Island': {
    ohsAct: 'Occupational Health and Safety Act',
    ohsReg: 'OHS Regulations',
    harassmentLaw: 'OHS Act (harassment & violence prevention provisions)',
    employmentStandards: 'Employment Standards Act',
    humanRights: 'PEI Human Rights Act',
    wsib: 'WCB PEI',
    wsibPhone: '1-800-237-5049',
    wsibWeb: 'wcb.pe.ca'
  },
  'Newfoundland and Labrador': {
    ohsAct: 'Occupational Health and Safety Act',
    ohsReg: 'OHS Regulations',
    harassmentLaw: 'OHS Act (harassment & violence prevention provisions)',
    employmentStandards: 'Labour Standards Act',
    humanRights: 'Newfoundland and Labrador Human Rights Act',
    wsib: 'WorkplaceNL',
    wsibPhone: '1-800-563-9000',
    wsibWeb: 'workplacenl.ca'
  },
  'Yukon': {
    ohsAct: 'Occupational Health and Safety Act',
    ohsReg: 'OHS Regulations',
    harassmentLaw: 'OHS Act (harassment & violence prevention provisions)',
    employmentStandards: 'Employment Standards Act',
    humanRights: 'Yukon Human Rights Act',
    wsib: 'WCB Yukon',
    wsibPhone: '1-800-661-0443',
    wsibWeb: 'wcb.yk.ca'
  },
  'Northwest Territories': {
    ohsAct: 'Occupational Health and Safety Act',
    ohsReg: 'OHS Regulations',
    harassmentLaw: 'OHS Act (harassment & violence prevention provisions)',
    employmentStandards: 'Employment Standards Act',
    humanRights: 'NWT Human Rights Act',
    wsib: 'WSCC NWT',
    wsibPhone: '1-800-661-0792',
    wsibWeb: 'wscc.nt.ca'
  },
  'Nunavut': {
    ohsAct: 'Occupational Health and Safety Act',
    ohsReg: 'OHS Regulations',
    harassmentLaw: 'OHS Act (harassment & violence prevention provisions)',
    employmentStandards: 'Labour Standards Act',
    humanRights: 'Nunavut Human Rights Act',
    wsib: 'WSCC Nunavut',
    wsibPhone: '1-877-404-4407',
    wsibWeb: 'wscc.nu.ca'
  }
};

// Default fallback for any province not explicitly listed
function provLaw() {
  var p = data.province || 'British Columbia';
  if (PROVINCE_LAW[p]) return PROVINCE_LAW[p];
  return {
    ohsAct: 'Occupational Health and Safety Act',
    ohsReg: 'OHS Regulations',
    harassmentLaw: 'provincial OHS workplace violence & harassment provisions',
    employmentStandards: 'Employment Standards legislation',
    humanRights: 'provincial Human Rights legislation',
    wsib: "provincial Workers' Compensation Board",
    wsibPhone: 'contact your supervisor',
    wsibWeb: ''
  };
}

// ── STATE ───────────────────────────────────────────
var data = {};
var readOnly = true;
var user = null;
var activeId = 's1';
var settingsOpen = false;

// ── HELPERS: company name with fallback ─────────────
function orgName() { return data.companyName || data.orgName || 'our organization'; }
function orgNameCap() { return data.companyName || data.orgNameCap || 'Our organization'; }

// ── SECTION META (for TOC generation) ───────────────
var SECTIONS = [
  { id:'s1',  num:'1', icon:'👋', badge:'',      title:'Welcome & Program Overview' },
  { id:'s2',  num:'2', icon:'⚖️', badge:'blue',   title:'Your Rights & Entitlements' },
  { id:'s3',  num:'3', icon:'🕐', badge:'green',  title:'Work Hours, Scheduling & Attendance' },
  { id:'s4',  num:'4', icon:'🎓', badge:'orange', title:'Mandatory Training & Professional Development' },
  { id:'s5',  num:'5', icon:'🦺', badge:'',       title:'Workplace Health & Safety' },
  { id:'s6',  num:'6', icon:'🤝', badge:'purple', title:'Workplace Conduct & Professionalism' },
  { id:'s7',  num:'7', icon:'🛡️', badge:'teal',   title:'Harassment, Discrimination & Equity' },
  { id:'s8',  num:'8', icon:'👕', badge:'gray',   title:'Dress Code & Personal Presentation' },
  { id:'s9',  num:'9', icon:'💻', badge:'blue',   title:'Technology, Equipment & Property Use' },
  { id:'s10', num:'10',icon:'🔒', badge:'',       title:'Confidentiality & Privacy' },
  { id:'s11', num:'11',icon:'📱', badge:'purple', title:'Social Media Policy' },
  { id:'s12', num:'12',icon:'🚒', badge:'',       title:'Emergency Procedures' },
  { id:'s13', num:'13',icon:'📈', badge:'green',  title:'Performance Expectations & Feedback' },
  { id:'s14', num:'14',icon:'📦', badge:'gray',   title:'End of Employment & Offboarding' },
  { id:'s15', num:'15',icon:'📞', badge:'teal',   title:'Key Contacts & Resources' },
  { id:'s16', num:'16',icon:'✍️', badge:'',       title:'Staff Acknowledgement Form' }
];

// ── HELPERS ─────────────────────────────────────────
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function h(tag, attrs, html) {
  var a = '';
  if (attrs) { for (var k in attrs) { a += ' ' + k + '="' + esc(attrs[k]) + '"'; } }
  return '<' + tag + a + '>' + (html || '') + '</' + tag + '>';
}

function tbl(rows, header) {
  var s = '<table><thead><tr>';
  if (header) { for (var i = 0; i < header.length; i++) s += '<th>' + header[i] + '</th>'; }
  s += '</tr></thead><tbody>';
  for (var r = 0; r < rows.length; r++) {
    s += '<tr>';
    for (var c = 0; c < rows[r].length; c++) s += '<td>' + rows[r][c] + '</td>';
    s += '</tr>';
  }
  s += '</tbody></table>';
  return s;
}

function infoBox(type, icon, html) {
  return '<div class="info-box ' + type + '"><span class="ib-icon">' + icon + '</span><div>' + html + '</div></div>';
}

function subH(cls, text) {
  return '<h3 class="sub' + (cls ? ' ' + cls : '') + '">' + text + '</h3>';
}

function badge(cls, text) {
  return '<span class="section-badge' + (cls ? ' ' + cls : '') + '">' + text + '</span>';
}

function miniCard(title, items) {
  var s = '<div class="mini-card"><h4>' + title + '</h4><ul>';
  for (var i = 0; i < items.length; i++) s += '<li>' + items[i] + '</li>';
  s += '</ul></div>';
  return s;
}

function miniCardHTML(title, html) {
  return '<div class="mini-card"><h4>' + title + '</h4>' + html + '</div>';
}

// ── GLOSSARY DATA ───────────────────────────────────
var GLOSSARY = {
  'Record of Employment': {
    title: 'Record of Employment (ROE)',
    body: '<p>A <strong>Record of Employment</strong> is an official government form that your employer must issue when you stop working.</p>' +
      '<p><strong>Why it matters to you:</strong> You need your ROE to apply for <strong>Employment Insurance (EI)</strong> benefits. Service Canada uses the information on your ROE to determine if you qualify.</p>' +
      '<p><strong>When you will get it:</strong> By law, your employer must issue your ROE within <strong>5 calendar days</strong> of your last paid day. It is submitted electronically to Service Canada. You can view it in your <strong>My Service Canada Account</strong> online.</p>' +
      '<div class="glossary-tip"><strong>💡 Tip:</strong> Even if you do not plan to apply for EI, keep your ROE for your records. If you are applying, check your My Service Canada Account about a week after your contract ends.</div>'
  },
  'ROE': {
    title: 'Record of Employment (ROE)',
    body: '<p>A <strong>Record of Employment</strong> is an official government form your employer must issue when you stop working. You need it to apply for <strong>Employment Insurance (EI)</strong> benefits.</p>' +
      '<p>Your employer must issue it within 5 calendar days of your last paid day. Check your My Service Canada Account online.</p>' +
      '<div class="glossary-tip"><strong>💡 Tip:</strong> Keep your ROE for your records even if you do not plan to apply for EI right away.</div>'
  },
  'WHMIS': {
    title: 'WHMIS 2015 - Workplace Hazardous Materials Information System',
    body: '<p><strong>WHMIS</strong> is Canada\'s national system for communicating information about hazardous materials used in the workplace.</p>' +
      '<p><strong>What you learn in WHMIS training:</strong> How to read safety labels, understand <strong>Safety Data Sheets (SDS)</strong>, and recognize <strong>hazard symbols</strong> (flame = flammable, skull = toxic, etc.).</p>' +
      '<p><strong>Do you need it?</strong> If your role involves handling cleaning products, chemicals, paints, or industrial materials - yes. If your role is entirely office-based, your supervisor may confirm WHMIS is not required for you.</p>' +
      '<div class="glossary-tip"><strong>💡 Tip:</strong> Knowing hazard symbols is useful life knowledge even if you do not handle chemicals at work.</div>'
  },
  'PIPEDA': {
    title: 'PIPEDA - Personal Information Protection and Electronic Documents Act',
    body: '<p><strong>PIPEDA</strong> is a federal privacy law that sets rules for how organizations collect, use, and protect <strong>personal information</strong> - names, addresses, financial details, health information, and more.</p>' +
      '<p><strong>What this means for you:</strong> If you handle client files, donor records, staff information, or any personal data at work, keep it <strong>private and secure</strong>. Do not share it, do not discuss it outside work, and do not leave documents where others can see them.</p>' +
      '<div class="glossary-tip"><strong>💡 Tip:</strong> A good rule: if you would not want your own personal information shared casually, do not share anyone else\'s.</div>'
  },
  'Statutory Holiday': {
    title: 'Statutory Holiday',
    body: '<p>A <strong>statutory holiday</strong> (or "stat holiday") is a public holiday recognized by law. In BC, if you have been employed for at least <strong>30 calendar days</strong> before the holiday, you are entitled to <strong>take the day off with pay</strong>.</p>' +
      '<p><strong>How it works with your contract:</strong> Your CSJ agreement defines your position as ' + data.durationWeeks + ' weeks at ' + data.hoursPerWeek + ' hours per week. When you qualify for a statutory holiday, you take the paid day off and simply work fewer hours that week. The agreement\'s total-hours number is the math (weeks × hours), not a separate requirement you need to hit.</p>' +
      '<div class="glossary-tip"><strong>💡 Example:</strong> With a June 26 start, you do <em>not</em> qualify for Canada Day on July 1 (only 5 days employed - the 30-day rule is not met). You <em>do</em> qualify for BC Day in early August. That week you take Monday off with pay and work Tuesday–Friday as normal. That\'s it.</div>'
  },
  'Employment Insurance': {
    title: 'Employment Insurance (EI)',
    body: '<p><strong>Employment Insurance (EI)</strong> is a federal program that provides temporary financial support when you lose your job through no fault of your own - like when a contract ends.</p>' +
      '<p><strong>Can you apply?</strong> Possibly - it depends on how many insurable hours you worked and your region\'s unemployment rate. Your ROE shows your accumulated hours. Apply online through <strong>Service Canada</strong> as soon as your contract ends.</p>' +
      '<div class="glossary-tip"><strong>💡 Tip:</strong> Apply for EI right after your last day - there is a waiting period, and delaying can affect your benefits.</div>'
  }
};

var glossaryOpen = false;

function showGlossary(term) {
  var entry = GLOSSARY[term];
  if (!entry) return;
  document.getElementById('glossary-title').textContent = '📖 ' + entry.title;
  document.getElementById('glossary-body').innerHTML = entry.body;
  document.getElementById('glossary-overlay').classList.add('open');
  document.getElementById('glossary-drawer').classList.add('open');
  glossaryOpen = true;
}

function closeGlossary() {
  document.getElementById('glossary-overlay').classList.remove('open');
  document.getElementById('glossary-drawer').classList.remove('open');
  glossaryOpen = false;
}

function glossaryTerm(term, label) {
  return '<span class="glossary-term" onclick="showGlossary(&quot;' + esc(term) + '&quot;)" title="Click to learn more">' + (label || term) + '</span>';
}

// ── BUILD TOC ───────────────────────────────────────
function buildTOC() {
  var html = '';
  for (var i = 0; i < SECTIONS.length; i++) {
    var sec = SECTIONS[i];
    html += '<li><a href="#' + sec.id + '" data-id="' + sec.id + '">' +
      '<span class="toc-badge' + (sec.badge ? ' ' + sec.badge : '') + '">' + sec.num + '</span>' +
      esc(sec.title) + '</a></li>';
  }
  document.getElementById('toc-list').innerHTML = html;
}

// ═══════════════════════════════════════════════
// HANDBOOK SECTION RENDERERS
// ═══════════════════════════════════════════════

function cardOpen(sec, pageBreak) {
  return '<div class="card' + (pageBreak ? ' page-break' : '') + '" id="' + sec.id + '">' +
    '<div class="card-header"><span class="icon">' + sec.icon + '</span><div>' +
    badge(sec.badge, 'Section ' + sec.num) + '<h2>' + esc(sec.title) + '</h2></div></div>' +
    '<div class="card-body">';
}
function cardClose() { return '</div></div>'; }

// ── S1: Welcome & Overview ──────────────────────────
function buildS1() {
  var sec = SECTIONS[0];
  var s = cardOpen(sec);
  s += '<p>Welcome to the team! We are genuinely excited to have you with us this summer. Your position is funded through the <strong>Canada Summer Jobs (CSJ) program</strong>, but make no mistake - <strong>you are here for your growth</strong>. Our primary goal is to help you bloom: to build real skills, gain confidence, and leave this summer with experience that opens doors for your future. If ' + orgName() + ' benefits along the way - and it will - that is a welcome bonus, not the main point.</p>';
  s += subH('', 'Why You Are Here');
  s += '<p>We believe that investing in young people is one of the most important things an organization can do. The CSJ program lets us bring you onto our team not just to get tasks done, but to <strong>develop you as a professional</strong>. Every project you work on, every training session you attend, and every conversation you have with a colleague is designed to help you grow. You were selected because we see potential in you - our job this summer is to help you realize it.</p>';
  s += '<div class="two-col">';
  s += miniCard('🌱 What We Want You to Take Away', [
    'Real, hands-on skills you can put on your resumé with confidence',
    'A strong reference and professional network',
    'Clarity about your career direction and strengths',
    'The experience of contributing meaningfully to a team'
  ]);
  var durationText = data.durationDisplay === 'upto' ? 'Up to <strong>' + data.durationWeeks + ' weeks</strong>' : '<strong>' + data.durationWeeks + ' weeks</strong>';
  var termItems = [
    'Duration: ' + durationText,
    'Position type: Temporary / Seasonal - Full Time',
    data.hoursPerWeek + ' hours per week',
    'You report to and are supported by your direct supervisor'
  ];
  if (data.contractStartDate || data.contractEndDate) {
    termItems.push('📝 Your Contract: <strong>' + (data.contractStartDate || 'TBD') + ' – ' + (data.contractEndDate || 'TBD') + '</strong>');
  }
  s += miniCard('📌 Your Employment Term', termItems);
  s += '</div>';
  s += subH('', 'Your Place on Our Team');
  s += '<p>From day one, you are a full member of our team - not "just a summer student." We expect you to show up, speak up, take initiative, and take pride in your work. In return, we will support you, train you, give you honest feedback, and advocate for you long after this summer ends. This is your time - make the most of it.</p>';
  s += infoBox('green', '✅', '<strong>Your Growth Is the Point:</strong> We measure the success of this program not by what you produce for us, but by what you <strong>learn and become</strong>. The work matters, but <strong>you</strong> matter more.');
  s += cardClose();
  return s;
}

// ── S2: Rights & Entitlements ───────────────────────
function buildS2() {
  var sec = SECTIONS[1];
  var s = cardOpen(sec);
  var L2 = provLaw();
  s += '<p>We want you to know exactly what you are entitled to as a member of our team. Your employment is governed by the <strong>' + L2.employmentStandards + '</strong> and federal legislation. We are committed to meeting - and exceeding - those standards. Nothing in this handbook reduces your legal rights.</p>';
  s += subH('blue', 'What We Guarantee You');
  s += '<ul><li>You will be paid at least the applicable <strong>minimum wage</strong>, on time, every pay period</li>' +
    '<li>You will work in a <strong>safe and healthy</strong> environment - we do not compromise on this</li>' +
    '<li>You will be treated with respect - <strong>harassment and discrimination have no place here</strong></li>' +
    '<li>You have the right to <strong>refuse work you reasonably believe is unsafe</strong> without any fear of consequences</li>' +
    '<li>You have full access to your rights under the <em>Canadian Human Rights Act</em> and your province\'s employment standards</li>' +
    '<li>You will receive <strong>paid statutory holidays</strong> (or pay in lieu) that fall within your term</li>' +
    '<li>You are entitled to a <strong>rest break</strong> - your scheduled break is ' + data.breakMin + ' minutes per day, meeting the legal minimum of 30 minutes for every 5 consecutive hours worked</li>' +
    '<li>You will receive a ' + glossaryTerm('Record of Employment', '<strong>Record of Employment (ROE)</strong>') + ' when your contract ends, as required by law</li></ul>';

  s += subH('blue', 'Statutory Holidays - What This Means for You');
  s += '<p>Your contract is <strong>' + data.durationWeeks + ' weeks at ' + data.hoursPerWeek + ' hours per week</strong>. In BC, to qualify for a paid statutory holiday you must be employed for at least <strong>30 calendar days</strong> before the holiday. This means some holidays that fall within your term may be regular workdays if you have not yet reached the 30-day mark.</p>';

  s += '<p>When you <em>do</em> qualify for a ' + glossaryTerm('Statutory Holiday', 'statutory holiday') + ', <strong>you take that day off with pay</strong>. That week you work ' + (data.hoursPerWeek - data.paidHrs) + ' hours instead of ' + data.hoursPerWeek + ' - and that is completely fine. Nothing to make up. No Saturday. Your contract end date does not change.</p>';

  var holidayRows = [];
  for (var i = 0; i < data.holidays.length; i++) {
    var hh = data.holidays[i];
    holidayRows.push([hh.name, hh.date, hh.note]);
  }
  s += tbl(holidayRows, ['Holiday', 'Typical Date', 'Does It Apply to You?']);

  s += subH('blue', 'Example With Your Contract Dates');
  s += '<p>With a ' + (data.contractStartDate || 'late June') + ' start and ' + (data.contractEndDate || 'late August') + ' end, here is how the holidays in your term play out:</p>';
  s += '<ol>' +
    '<li><strong>Canada Day (July 1):</strong> You work this day as normal. You will only have been employed for about a week - well short of the 30 days needed to qualify for the paid day off.</li>' +
    '<li><strong>BC Day (First Monday of August):</strong> You qualify! You have been employed for over 30 days. You take this day off with full pay. That week you work ' + (data.hoursPerWeek - data.paidHrs) + ' hours - no make-up required.</li>' +
    '<li><strong>Labour Day (First Monday of September):</strong> This falls after your contract end date, so it does not affect your term.</li>' +
  '</ol>';
  s += '<p><strong>Important:</strong> If you ever qualify for a statutory holiday, do not work that day unless your supervisor has given you prior written approval. It is your legal right to take that day as paid time off.</p>';
  s += cardClose();
  return s;
}

// ── S3: Work Hours ──────────────────────────────────
function buildS3() {
  var sec = SECTIONS[2];
  var s = cardOpen(sec, true);

  s += subH('green', 'Standard Hours of Work');
  s += '<p>All staff are scheduled <strong>' + data.hoursPerWeek + ' hours per week</strong> (' + data.shiftHrs + ' hours per day including a ' + data.breakMin + '-minute unpaid break). Each day combines hands-on work with structured learning and professional development.</p>';

  s += subH('green', 'Weekly Schedule');
  var rows = [
    ['Monday',    data.dailyStart, data.dailyEnd, data.breakMin + ' min', data.shiftHrs + ' hrs', data.paidHrs + ' hrs'],
    ['Tuesday',   data.dailyStart, data.dailyEnd, data.breakMin + ' min', data.shiftHrs + ' hrs', data.paidHrs + ' hrs'],
    ['Wednesday', data.dailyStart, data.dailyEnd, data.breakMin + ' min', data.shiftHrs + ' hrs', data.paidHrs + ' hrs'],
    ['Thursday',  data.dailyStart, data.dailyEnd, data.breakMin + ' min', data.shiftHrs + ' hrs', data.paidHrs + ' hrs'],
    ['Friday',    data.dailyStart, data.dailyEnd, data.breakMin + ' min', data.shiftHrs + ' hrs', data.paidHrs + ' hrs'],
    ['<strong>Weekly Total</strong>', '-', '-', data.breakMin * 5 + ' min', '<strong>' + (data.shiftHrs * 5).toFixed(1) + ' hrs</strong>', '<strong>' + (data.paidHrs * 5).toFixed(1) + ' hrs</strong>']
  ];
  s += tbl(rows, ['Day', 'Start', 'End', 'Break', 'Shift', 'Paid Hrs']);
  s += '<p style="margin-top:-8px;font-size:0.88rem;color:#666;">' + data.weekend + ': Not scheduled - off unless individually confirmed in writing by your supervisor.</p>';

  s += subH('green', 'Daily Rhythm');
  s += '<p>Within each workday, your time is structured to balance hands-on work with learning and personal growth:</p>';
  s += tbl([
    ['<span style="white-space:nowrap">10:00 AM - 12:00 PM</span>', '<strong>Morning Values & Learning</strong>', 'Guided discussions on ethics, moral reasoning, workplace values, and character development.'],
    ['<span style="white-space:nowrap">12:00 PM - 2:00 PM</span>', '<strong>Project Work</strong>', 'Hands-on tasks, team projects, and role-specific duties.'],
    ['<span style="white-space:nowrap">2:00 PM - 2:30 PM</span>', '<strong>Break</strong>', 'Unpaid 30-minute break. Step away from your workstation.'],
    ['<span style="white-space:nowrap">2:30 PM - 4:30 PM</span>', '<strong>Project Work</strong>', 'Continue your assigned tasks and collaborate with teammates.'],
    ['<span style="white-space:nowrap">4:30 PM - 5:30 PM</span>', '<strong>Professional Development</strong>', 'AI literacy, IT tools, productivity habits, and conversations with visiting professionals.']
  ], ['Time', 'Session', 'What Happens']);
  s += '<p>This rhythm may be adjusted by your supervisor based on operational needs. Any changes will be communicated in advance.</p>';

  s += subH('green', 'Break Period');
  s += '<ul>' +
    '<li><strong>Daily break:</strong> One ' + data.breakMin + '-minute unpaid break taken at <strong>' + data.breakStart + '</strong> every day</li>' +
    '<li>The break begins at ' + data.breakStart + ' sharp and ends at ' + data.breakEnd + ' - please return to your workstation on time</li>' +
    '<li>Breaks must be taken away from your workstation when possible</li>' +
    '<li>The break may not be skipped, accumulated, or used to arrive late or leave early</li>' +
    '<li>Your scheduled shift ends at ' + data.dailyEnd + ' - the break does not shorten or extend your workday</li></ul>';

  s += subH('green', 'Attendance & Punctuality');
  s += infoBox('orange', '⚠️', '<strong>Attendance is mandatory.</strong> Consistent absenteeism or late arrivals may result in disciplinary action, including early termination of the employment contract.');
  s += '<ul>' +
    '<li>Arrive on time and be ready to work at your scheduled start time</li>' +
    '<li>If you are going to be late or absent, <strong>notify your supervisor as early as possible</strong> - ideally before your shift starts</li>' +
    '<li>All absences must be reported by calling or texting the designated supervisor contact number</li>' +
    '<li>Unexcused absences or no-call/no-shows may be grounds for contract termination</li>' +
    '<li>Medical absences may require documentation for absences exceeding two (2) consecutive days</li></ul>';

  s += subH('green', 'Beyond Your Scheduled Hours');
  s += '<p>Your scheduled hours are <strong>' + data.hoursPerWeek + ' per week</strong>. We encourage you to learn, explore, and grow - if you want to stay longer to observe, help out, or develop your skills, you are welcome to. This is entirely your choice and never expected or required.</p>';
  s += '<ul><li>Time beyond your scheduled shift is <strong>voluntary and unpaid</strong></li>' +
    '<li>You are free to volunteer, shadow colleagues, or work on personal development during this time</li>' +
    '<li>Your supervisor can help you find learning opportunities if you are interested</li>' +
    '<li>There is never any pressure or obligation to stay past your scheduled hours</li></ul>';

  s += cardClose();
  return s;
}

// ── S4: Mandatory Training ──────────────────────────
function buildS4() {
  var sec = SECTIONS[3];
  var s = cardOpen(sec);

  s += infoBox('red', '🚨', '<strong>Training is a condition of your employment.</strong> You are paid for all training time. Attendance, punctuality, and active participation in every assigned training session are mandatory. Failure to attend or complete required training is a breach of your employment conditions and may result in disciplinary action, up to and including termination of your contract.');

  s += subH('orange', 'Why Training Is Central to Your Role');
  s += '<p>The training you receive here is not separate from your job - it <strong>is</strong> part of your job. Our organization operates in environments that require industrial skills, ethical judgment, physical safety awareness, and professional conduct. You cannot perform your duties without these foundations, and we cannot legally or ethically allow you to try.</p>';
  s += '<p>Every session is paid time. We expect you to arrive prepared, engage fully, ask questions, and apply what you learn immediately. This is how professional workplaces operate - and you are a professional here.</p>';

  var L = provLaw();
  s += subH('orange', 'Training Overview');
  s += '<p>All training falls into two categories. Both are mandatory:</p>';

  s += '<h3 class="sub orange" style="margin-top:18px;">Legally Required Training - ' + (data.province || 'Your Province') + '</h3>';
  s += '<p style="font-size:0.88rem;color:#666;margin-bottom:10px;">Mandated under the <strong>' + L.ohsAct + '</strong> and <strong>' + L.ohsReg + '</strong>. You are legally prohibited from performing job duties until these are completed.</p>';
  s += tbl([
    ['Workplace Health & Safety (OHS) Orientation', 'Week 1 - before any hands-on duties', L.ohsAct],
    ['Workplace Violence & Harassment Prevention', 'Week 1 – 2', L.harassmentLaw],
    ['Emergency Procedures & Evacuation Drill', 'Week 1', L.ohsReg + ' & Fire Code'],
    ['WHMIS 2015 (if applicable to your role)', 'Week 1', 'Federal WHMIS 2015 Regulations']
  ], ['Training Session', 'When Required', 'Legal Basis']);

  s += '<h3 class="sub orange" style="margin-top:18px;">Organizational Training - Required by ' + orgNameCap() + '</h3>';
  s += '<p style="font-size:0.88rem;color:#666;margin-bottom:10px;">These are mandated by our organization as conditions of employment. They cover the industrial, ethical, and professional standards you are expected to meet every day on the job.</p>';
  s += tbl([
    ['Workplace Orientation & Onboarding', 'Day 1 – Week 1', '✅ Mandatory'],
    ['Handbook, Paperwork & Documentation', 'Day 1 – 2', '✅ Mandatory'],
    ['Industrial Skills & Job-Specific Training', 'Week 1 – 3', '✅ Mandatory'],
    ['Ethics, Integrity & Professional Conduct', 'Week 1 – 2', '✅ Mandatory'],
    ['Equity, Diversity & Inclusion (EDI)', 'Week 2', '✅ Mandatory'],
    ['Confidentiality & Data Privacy', 'Week 2', '✅ Mandatory'],
    ['Client & Community Service Standards', 'Week 2 – 3', '✅ Mandatory'],
    ['Refresher & Additional Sessions', 'As scheduled', '✅ Mandatory']
  ], ['Training Session', 'When Required', 'Status']);

  s += subH('orange', 'Detailed Training Descriptions');
  s += subH('orange', '1. Orientation & Onboarding (Week 1)');
  s += '<p>Your first week is structured to fully integrate you into ' + orgName() + '. You will:</p>';
  s += '<ul><li>Tour the entire workplace and meet every member of your team and all supervisors</li>' +
    '<li>Receive and review this handbook in full with your supervisor</li>' +
    '<li>Complete all required administrative and payroll paperwork</li>' +
    '<li>Understand ' + orgNameCap() + '\'s mission, values, structure, and your role within it</li>' +
    '<li>Learn your specific job duties, daily expectations, and reporting structure</li>' +
    '<li>Complete all Day-1 safety and compliance requirements before performing any tasks</li></ul>';

  s += subH('orange', '2. Handbook, Paperwork & Documentation (Day 1-2)');
  s += '<p>You will learn how to complete the daily and administrative documentation that is part of your role. This includes:</p>';
  s += '<ul>' +
    '<li><strong>Daily logs:</strong> How to write clear, accurate daily activity logs in our system. This is a core expectation of your position and helps us track your progress and hours.</li>' +
    '<li><strong>This handbook:</strong> A guided walkthrough of every section so you understand your rights, responsibilities, and what is expected of you.</li>' +
    '<li><strong>Legal documents:</strong> How to read and complete employment agreements, confidentiality forms, acknowledgement forms, and other required paperwork. You will never be asked to sign something you do not understand.</li>' +
    '<li><strong>Documentation standards:</strong> How we write, file, and organize records. Accuracy matters - these documents are part of our official records.</li>' +
  '</ul>' +
  '<p>This session may be split across your first two days if needed. Take your time. Ask questions. Every form and process will be explained before you are expected to use it.</p>';

  s += subH('orange', '3. Workplace Health & Safety Training');
  s += '<p>You are legally prohibited from performing physical or hands-on duties until this training is complete. It covers:</p>';
  s += '<ul><li>Identifying, reporting, and controlling hazards in your specific work area</li>' +
    '<li>Proper use of all Personal Protective Equipment (PPE) assigned to your role</li>' +
    '<li>Safe operation of tools, equipment, and machinery you are authorized to use</li>' +
    '<li>Ergonomics - proper lifting, sitting, and movement techniques to prevent injury</li>' +
    '<li>' + glossaryTerm('WHMIS', 'WHMIS 2015') + ' - identifying hazard symbols, reading Safety Data Sheets (SDS), safe handling of chemicals</li>' +
    '<li>Emergency evacuation procedures - routes, assembly points, roles during an emergency</li>' +
    '<li>Incident reporting - how, when, and to whom you report any accident or near-miss</li></ul>';

  s += subH('orange', '4. Industrial Skills & Job-Specific Training');
  s += '<p>You will receive hands-on training specific to the tasks, tools, equipment, and processes used in your role. This training is delivered by experienced supervisors and covers the practical skills you need to perform your duties safely and competently.</p>';
  s += '<ul><li>Operation of any machinery, tools, or equipment assigned to you</li>' +
    '<li>Workplace-specific processes, workflows, and quality standards</li>' +
    '<li>Inventory, materials handling, and organizational systems</li>' +
    '<li>Any certifications or licenses required for your position</li></ul>';

  s += subH('orange', '5. Ethics, Integrity & Professional Conduct');
  s += '<p>All staff are required to complete ethics and professional conduct training. This is not optional and is treated with the same seriousness as safety training. You are expected to understand and apply ethical standards in every task, interaction, and decision you make at work.</p>';
  s += '<p>This training covers:</p>';
  s += '<ul><li><strong>Workplace integrity:</strong> Acting honestly and transparently in all tasks, communications, and decisions</li>' +
    '<li><strong>Conflict of interest:</strong> Recognizing and disclosing situations where personal interests may conflict with your duties</li>' +
    '<li><strong>Accountability:</strong> Taking full ownership of your actions, mistakes, and their consequences</li>' +
    '<li><strong>Ethical decision-making:</strong> A practical framework for identifying and resolving ethical dilemmas on the job</li>' +
    '<li><strong>Reporting obligations:</strong> Your professional and procedural duty to report wrongdoing, waste, dishonesty, or unsafe behaviour</li>' +
    '<li><strong>Confidentiality as an ethical and legal duty:</strong> Protecting private information is both a policy requirement and a matter of professional integrity</li>' +
    '<li><strong>Fair treatment:</strong> Applying consistent, unbiased standards in all interactions</li></ul>';

  s += subH('orange', '6. Anti-Harassment & Respectful Workplace Training');
  s += '<p>All staff must complete this training within the first two weeks. Topics include:</p>';
  s += '<ul><li>Recognizing all forms of harassment, discrimination, and bullying (see also Section 7)</li>' +
    '<li><strong>Bystander responsibility</strong> - what you must do when you witness harassment, not just what you can do</li>' +
    '<li>How to report incidents safely and confidentially</li>' +
    '<li>Personal responsibility in actively creating an inclusive, welcoming workplace</li>' +
    '<li>Real-world case studies and group discussion scenarios</li>' +
    '<li>Consequences of non-compliance - for the individual and for ' + orgName() + '</li></ul>';

  s += subH('orange', '7. Equity, Diversity & Inclusion (EDI) Training');
  s += '<ul><li>Understanding systemic barriers and their impact in the workplace</li>' +
    '<li>Cultural awareness and respectful communication across all backgrounds and identities</li>' +
    '<li>Being an active ally and advocate - not a passive bystander</li>' +
    '<li>' + orgNameCap() + '\'s commitment to Indigenous reconciliation and inclusive service delivery</li>' +
    '<li>Inclusive language - what to say, what to avoid, and how to recover when you make a mistake</li></ul>';

  s += subH('orange', '8. Ongoing & Refresher Training');
  s += '<p>Throughout your term, you may be assigned additional training relevant to your role or required as updates to policies and procedures. These may include First Aid/CPR certification, new software or tools, updated safety protocols, or specialized project training.</p>';
  s += '<p>Every session assigned to you is mandatory. There is no distinction between "core" and "supplementary" training.</p>';

  s += subH('orange', '9. Daily Learning & Professional Development');
  s += '<p>Beyond the structured training modules above, your <strong>every day</strong> includes dedicated time for learning and growth:</p>';
  s += '<ul>' +
    '<li><strong>Morning Values & Learning (10:00 AM - 12:00 PM):</strong> Each day begins with guided group sessions on ethics, moral reasoning, character development, and workplace values. These discussions are led by your supervisor or a senior team member and are designed to build the ethical foundation you carry into every task and interaction.</li>' +
    '<li><strong>Professional Development (4:30 PM - 5:30 PM):</strong> The final hour of each day is dedicated to building skills beyond your immediate role. Sessions include AI and digital literacy, IT tools, workplace productivity habits, and conversations with visiting professionals from the community. This is your time to explore, ask questions, and grow.</li>' +
  '</ul>' +
  '<p>These daily sessions are <strong>paid training time</strong> and attendance is required just like any other part of your schedule. They are what make this program different from a regular summer job - we are investing in <strong>you</strong>, not just your output.</p>';

  s += subH('orange', 'Training Attendance Rules');
  s += infoBox('orange', '⚠️', 'Missing a training session without a valid, pre-approved reason is a <strong>serious breach of your employment conditions</strong>. If an emergency prevents your attendance, you must notify your supervisor before the session. A make-up session must be completed within 48 hours. Repeated absences from training will result in progressive disciplinary action.');
  s += '<ul><li>Arrive on time - being late to a training session is the same as being late to work</li>' +
    '<li>Remain for the <strong>full duration</strong> of every session; early departures are not permitted without supervisor approval</li>' +
    '<li><strong>Actively participate</strong> - raise your hand, contribute to discussions, complete all exercises. Passive attendance is not acceptable.</li>' +
    '<li>Complete all pre-reading, worksheets, quizzes, or post-training assessments assigned</li>' +
    '<li>A <strong>training record</strong> is maintained for each employee in our training verification system. You will complete and sign off on each module through that system. Your supervisor reviews and confirms all completions.</li>' +
    '<li>Incomplete training may restrict you from performing certain duties until the training is done</li>' +
    '<li>Training completion is a formal factor in your mid-term and final performance reviews</li></ul>';

  s += cardClose();
  return s;
}

// ── S5: Health & Safety ─────────────────────────────
function buildS5() {
  var sec = SECTIONS[4];
  var s = cardOpen(sec, true);
  s += infoBox('red', '🚨', '<strong>Your Safety Comes First - Always.</strong> Nothing we do is more important than making sure every person goes home healthy at the end of the day. You have our full backing to speak up about any safety concern and to refuse any task you believe is unsafe. We will never penalize you for putting safety first.');
  var L5 = provLaw();
  s += subH('', 'Legislative Framework - ' + (data.province || 'Your Province'));
  s += '<p>Workplace safety in ' + (data.province || 'your province') + ' is governed by:</p>';
  s += '<ul><li>The <strong>' + L5.ohsAct + '</strong> and <strong>' + L5.ohsReg + '</strong></li>' +
    '<li>The <em>Canada Labour Code</em> (for federally regulated workplaces)</li>' +
    '<li><strong>WHMIS 2015</strong> – Workplace Hazardous Materials Information System</li></ul>';
  s += subH('', 'Three Core Rights of Every Worker');
  s += '<div class="two-col">';
  s += miniCardHTML('1️⃣ Right to Know', '<p>You have the right to know about any hazards in your workplace, including chemicals, equipment, and procedures that may pose a risk to your health or safety.</p>');
  s += miniCardHTML('2️⃣ Right to Participate', '<p>You have the right to be involved in health and safety decisions, raise concerns, and participate in workplace safety committees or discussions.</p>');
  s += '</div>';
  s += '<div class="mini-card" style="margin-top:16px;"><h4>3️⃣ Right to Refuse Unsafe Work</h4><p>You have the right to <strong>refuse work that you reasonably believe is dangerous</strong> to yourself or others. You must immediately report the concern to your supervisor. You will not be penalized for exercising this right.</p></div>';
  s += subH('', 'General Safety Rules - All Staff Must Follow');
  s += '<ul><li>Complete all required safety orientations and training before starting work</li>' +
    '<li>Always use <strong>Personal Protective Equipment (PPE)</strong> as required for your role (gloves, safety vest, eye protection, etc.)</li>' +
    '<li>Report <strong>all hazards, near misses, injuries, and accidents</strong> to your supervisor immediately</li>' +
    '<li>Never operate equipment you have not been trained to use</li>' +
    '<li>Keep your work area clean, organized, and free of slip/trip hazards</li>' +
    '<li>Do not bring or consume alcohol or drugs on work premises</li>' +
    '<li>Know the locations of: fire extinguishers, first aid kits, emergency exits, and eyewash stations</li>' +
    '<li>Follow all posted signs, warnings, and safety notices</li>' +
    '<li>Do not use your phone while operating equipment or performing safety-sensitive tasks</li></ul>';
  s += subH('', 'If an Accident or Injury Occurs');
  s += '<ol><li>Ensure immediate safety - move yourself and others away from danger if possible</li>' +
    '<li>Call for help or call <strong>911</strong> if it is a medical emergency</li>' +
    '<li>Notify your supervisor immediately (same day)</li>' +
    '<li>Complete an <strong>Incident/Accident Report form</strong> - available from your supervisor</li>' +
    '<li>Seek first aid or medical attention if required</li>' +
    '<li>Cooperate fully with any investigation</li></ol>';
  s += infoBox('yellow', '📋', '<strong>WHMIS Training:</strong> If your role involves handling any chemicals, cleaning products, or hazardous materials, you must complete WHMIS training before handling those substances. Ask your supervisor if you are unsure.');
  s += subH('', 'Mental Health & Wellness');
  s += '<p>We recognize that well-being includes mental health. If you are experiencing stress, anxiety, or personal difficulties that are affecting your work:</p>';
  s += '<ul><li>Speak confidentially with your supervisor or HR contact</li>' +
    '<li>Use the free <strong>Crisis Line: 1-833-456-4566</strong> (Canada Suicide Prevention Service – 24/7)</li>' +
    '<li>Access <strong>Kids Help Phone</strong> (if under 25): 1-800-668-6868 or text HELLO to 686868</li>' +
    '<li>We have a zero-tolerance policy for workplace bullying that affects mental wellness</li></ul>';
  s += cardClose();
  return s;
}

// ── S6: Conduct & Professionalism ───────────────────
function buildS6() {
  var sec = SECTIONS[5];
  var s = cardOpen(sec, true);
  s += '<p>How you carry yourself reflects on you and on all of us. We expect every team member - regardless of role or how long they have been here - to act professionally, treat others with respect, and take responsibility for their words and actions. This applies in the office, at events, working remotely, and anytime you are representing ' + orgName() + ' in the community.</p>';
  s += subH('purple', 'Standards of Conduct');
  s += '<ul><li>Treat all colleagues, supervisors, clients, and members of the public with <strong>dignity and respect</strong></li>' +
    '<li>Communicate professionally - in person, by phone, email, or chat</li>' +
    '<li>Be cooperative, flexible, and willing to take on assigned tasks</li>' +
    '<li>Maintain a <strong>positive attitude</strong> and contribute to a healthy team environment</li>' +
    '<li>Ask for help when you are unsure - it is always better to ask than to guess</li>' +
    '<li>Take ownership of your work and meet your commitments and deadlines</li>' +
    '<li>Respect organizational hierarchy and follow reasonable instructions</li></ul>';
  s += subH('purple', 'Unacceptable Conduct - Zero Tolerance');
  s += infoBox('red', '🚫', 'The following behaviours may result in <strong>immediate termination</strong> of your contract without notice:');
  s += '<ul><li>Theft, fraud, or misappropriation of organizational property or funds</li>' +
    '<li>Physical violence, threats, or intimidation toward any person</li>' +
    '<li>Harassment, bullying, or discrimination of any kind</li>' +
    '<li>Reporting to work under the influence of alcohol or non-prescribed drugs</li>' +
    '<li>Serious insubordination or willful refusal to follow lawful instructions</li>' +
    '<li>Falsifying records, reports, or timesheets</li>' +
    '<li>Unauthorized disclosure of confidential information</li>' +
    '<li>Destruction or misuse of organizational property</li>' +
    '<li><strong>Refusing to attend, skipping, or repeatedly disrupting mandatory training sessions</strong></li>' +
    '<li>Wilfully failing to apply training standards after confirmed completion</li></ul>';
  s += subH('purple', 'Progressive Discipline');
  s += '<p>For less serious breaches of conduct, the following progressive steps may apply:</p>';
  s += '<ol><li><strong>Verbal Warning</strong> - documented by supervisor</li>' +
    '<li><strong>Written Warning</strong> - placed on file</li>' +
    '<li><strong>Suspension</strong> - without pay (if applicable)</li>' +
    '<li><strong>Termination</strong> - with or without notice depending on severity</li></ol>';
  s += '<p>You have the right to respond to any disciplinary action and to have a support person present during formal meetings if desired.</p>';
  s += cardClose();
  return s;
}

// ── S7: Harassment & Equity ─────────────────────────
function buildS7() {
  var sec = SECTIONS[6];
  var s = cardOpen(sec, true);
  s += '<p>Everybody who works here deserves to feel safe, respected, and valued. We have zero tolerance for harassment or discrimination of any kind. This is personal for us - not just a policy.</p>';
  s += subH('teal', 'Protected Grounds Under the Canadian Human Rights Act');
  s += '<p>We do not discriminate based on any of the following protected grounds:</p>';
  s += '<div class="two-col"><ul><li>Race or colour</li><li>National or ethnic origin</li><li>Religion or faith</li><li>Age</li><li>Sex, sexual orientation, gender identity or expression</li><li>Marital or family status</li></ul><ul><li>Disability (physical or mental)</li><li>Genetic characteristics</li><li>Pardoned conviction</li><li>Pregnancy or breastfeeding</li><li>Indigenous identity</li></ul></div>';
  s += subH('teal', 'What Constitutes Harassment?');
  s += '<p>Harassment includes, but is not limited to:</p>';
  s += '<ul><li>Verbal abuse, insults, put-downs, or mockery</li>' +
    '<li>Offensive jokes, comments, or gestures related to a protected ground</li>' +
    '<li>Unwanted physical contact or invasion of personal space</li>' +
    '<li>Inappropriate or offensive comments about someone\'s appearance, identity, or background</li>' +
    '<li>Cyberbullying or online harassment using organizational devices or accounts</li>' +
    '<li>Deliberate exclusion or social isolation of a colleague</li>' +
    '<li>Displaying or sharing offensive images, materials, or content</li></ul>';
  s += subH('teal', 'How to Report');
  s += infoBox('green', '📣', '<strong>We have your back when you speak up.</strong> If you report harassment or discrimination in good faith, you have our full protection. Nobody will face consequences for raising a concern. We mean that.');
  s += '<ol><li>Document the incident: date, time, location, what was said or done, witnesses</li>' +
    '<li>Report to your <strong>direct supervisor</strong> or, if they are the subject of the complaint, to <strong>HR or the next level of management</strong></li>' +
    '<li>A confidential investigation will be initiated within 5 business days</li>' +
    '<li>Both parties will be notified of the outcome and any corrective action taken</li></ol>';
  s += cardClose();
  return s;
}

// ── S8: Dress Code ──────────────────────────────────
function buildS8() {
  var sec = SECTIONS[7];
  var s = cardOpen(sec);
  s += '<p>Your appearance reflects both your professionalism and the reputation of ' + orgName() + '. Please dress appropriately for your role and work environment.</p>';
  s += '<div class="two-col">';
  s += miniCard('✅ Acceptable Attire', [
    'Clean, neat, and well-fitting clothing',
    'Business casual (office roles)',
    'Appropriate footwear for the work environment',
    'Closed-toe shoes in areas with physical hazards',
    'Organization-provided uniform or vest (if applicable)'
  ]);
  s += miniCard('❌ Not Acceptable', [
    'Torn, dirty, or overly revealing clothing',
    'Offensive slogans, symbols, or images on clothing',
    'Sandals/open-toed footwear in hazard zones',
    'Hats or hoods indoors (unless for religious/cultural reasons)'
  ]);
  s += '</div>';
  s += infoBox('blue', 'ℹ️', '<strong>Accommodations & Scent-Free Workplace:</strong> Religious, cultural, or medical accommodations to the dress code will always be respectfully considered. This is a <strong>scent-free environment</strong> - please do not wear perfumes, colognes, or scented products. These can cause serious reactions for colleagues with allergies, asthma, or chemical sensitivities. Speak to your supervisor or HR confidentially if you require an accommodation.');
  s += '<p>If there is any doubt about whether an outfit is appropriate, choose the more conservative option, or ask your supervisor in advance.</p>';
  s += cardClose();
  return s;
}

// ── S9: Technology & Equipment ──────────────────────
function buildS9() {
  var sec = SECTIONS[8];
  var s = cardOpen(sec, true);
  s += subH('blue', 'Organizational Equipment');
  s += '<p>Any computer, phone, vehicle, tool, or equipment provided to you by ' + orgName() + ' is for <strong>work purposes only</strong>. You are responsible for its safe and proper use.</p>';
  s += '<ul><li>Report any damaged, lost, or malfunctioning equipment to your supervisor immediately</li>' +
    '<li>Return all organizational property at the end of your employment term</li>' +
    '<li>Do not install unauthorized software on organizational computers</li>' +
    '<li>Do not use organizational vehicles without proper authorization and a valid driver\'s licence</li>' +
    '<li>Costs of damage caused by negligence or misuse may be recovered from the employee</li></ul>';
  s += subH('blue', 'Computer & Internet Use');
  s += '<ul><li>Computers and internet access are provided for <strong>work-related tasks only</strong></li>' +
    '<li>Minimal personal use is permitted (e.g., checking personal email during breaks) but must not interfere with work</li>' +
    '<li>Prohibited uses: accessing inappropriate websites, streaming entertainment, online gaming, or using torrents</li>' +
    '<li>All activity on organizational devices and networks may be monitored</li>' +
    '<li>Do not share your login credentials with anyone</li>' +
    '<li>Lock your computer screen when leaving your workstation</li></ul>';
  s += subH('blue', 'Personal Mobile Devices');
  s += '<ul><li>Personal phones should be on silent during working hours</li>' +
    '<li>Limit personal calls/texts to break times whenever possible</li>' +
    '<li>Do not use your personal phone while operating any vehicle, machinery, or tool</li>' +
    '<li>Photography or video recording in the workplace requires prior supervisor approval</li></ul>';
  s += cardClose();
  return s;
}

// ── S10: Confidentiality ────────────────────────────
function buildS10() {
  var sec = SECTIONS[9];
  var s = cardOpen(sec, true);
  s += '<p>During your employment, you will have access to confidential information belonging to ' + orgName() + ', its clients, partners, donors, or other staff. You are legally and ethically obligated to protect this information.</p>';
  s += subH('', 'What is Confidential?');
  s += '<ul><li>Client and donor personal information (names, addresses, financial details)</li>' +
    '<li>Organizational financial records, budgets, or funding details</li>' +
    '<li>Personnel files, wages, or personal staff information</li>' +
    '<li>Strategic plans, internal reports, or unpublished materials</li>' +
    '<li>Any information explicitly marked "CONFIDENTIAL" or "INTERNAL"</li></ul>';
  s += subH('', 'Your Obligations');
  s += '<ul><li>Never share confidential information with unauthorized persons - inside or outside ' + orgName() + '</li>' +
    '<li>Do not discuss confidential matters in public places (elevators, restaurants, etc.)</li>' +
    '<li>Store physical documents securely and shred sensitive materials when no longer needed</li>' +
    '<li>Report any suspected data breach or unauthorized access to your supervisor immediately</li>' +
    '<li>Confidentiality obligations continue <strong>after your employment ends</strong></li></ul>';
  s += subH('', 'Privacy Legislation');
  s += '<p>We comply with the ' + glossaryTerm('PIPEDA', '<em>Personal Information Protection and Electronic Documents Act (PIPEDA)</em>') + ' and applicable provincial privacy laws. Employees who handle personal information must do so in accordance with these laws and organizational privacy policies.</p>';
  s += cardClose();
  return s;
}

// ── S11: Social Media ───────────────────────────────
function buildS11() {
  var sec = SECTIONS[10];
  var s = cardOpen(sec);
  s += '<p>Social media use - both personal and professional - reflects on you and ' + orgName() + '. Please follow these guidelines.</p>';
  s += '<div class="two-col">';
  s += miniCard('🏢 Official Organizational Accounts', [
    'Only designated staff may post on official accounts',
    'All content must be approved by a supervisor before publishing',
    'Respond professionally to all public messages',
    'Never publish client photos without written consent'
  ]);
  s += miniCard('👤 Personal Accounts', [
    'Do not post confidential or sensitive organizational information',
    'Do not share photos of clients, staff, or the workplace without consent',
    'You may share your role, but make clear posts are your own views',
    'Treat colleagues, clients, and ' + orgName() + ' with respect online'
  ]);
  s += '</div>';
  s += infoBox('orange', '⚠️', 'Social media posts that defame ' + orgName() + ', disclose confidential information, or harass colleagues may result in disciplinary action, including termination. Remember: <strong>the internet is permanent</strong>.');
  s += cardClose();
  return s;
}

// ── S12: Emergency Procedures ───────────────────────
function buildS12() {
  var sec = SECTIONS[11];
  var s = cardOpen(sec, true);
  s += infoBox('red', '📞', '<strong>Emergency Services: Call 911 immediately for any life-threatening emergency.</strong> Do not hesitate.');
  s += subH('', 'Fire Emergency');
  s += '<ol><li><strong>Activate</strong> the nearest fire alarm pull station</li>' +
    '<li><strong>Call 911</strong> if the fire is beyond a very early stage</li>' +
    '<li><strong>Evacuate</strong> the building using the nearest safe exit - do NOT use elevators</li>' +
    '<li><strong>Proceed</strong> to the designated <strong>Assembly Point</strong>: ' + (data.emergencyLoc.assembly || 'confirm location with your supervisor on Day 1') + '</li>' +
    '<li><strong>Do not re-enter</strong> the building until authorized by emergency responders</li>' +
    '<li>Assist persons with disabilities to the nearest stairwell refuge area if evacuation is not possible</li></ol>';
  s += subH('', 'Medical Emergency');
  s += '<ol><li>Call <strong>911</strong> immediately if the person is unresponsive, not breathing, or in serious distress</li>' +
    '<li>Send a colleague to meet paramedics at the building entrance</li>' +
    '<li>Retrieve the <strong>first aid kit</strong><br><em style="color:#c8102e;font-weight:700;">📍 ' + (data.emergencyLoc.firstAid || '_____________________ (ask your supervisor)') + '</em></li>' +
    '<li>Only administer first aid if you are trained to do so</li>' +
    '<li>Notify your supervisor immediately</li>' +
    '<li>Complete an <strong>Incident Report</strong> form</li></ol>';
  s += subH('', 'Lockdown / Security Threat');
  s += '<ol><li>If you see or suspect a security threat, <strong>call 911 immediately</strong></li>' +
    '<li>Follow the <strong>Run – Hide – Fight</strong> framework:<ul>' +
    '<li><strong>Run:</strong> Evacuate if you can do so safely</li>' +
    '<li><strong>Hide:</strong> Lock or barricade yourself in a room, silence your phone</li>' +
    '<li><strong>Fight:</strong> As an absolute last resort, defend yourself</li></ul></li>' +
    '<li>Do not open doors for anyone until given the all-clear by authorities</li>' +
    '<li>Do not post about the situation on social media during the incident</li></ol>';
  s += subH('', 'Know Your Emergency Locations');
  s += tbl([
    ['🔴 Fire Alarm Pull Stations', data.emergencyLoc.fireAlarm || '___________________________________'],
    ['🧯 Fire Extinguishers', data.emergencyLoc.fireExt || '___________________________________'],
    ['🩹 First Aid Kit', data.emergencyLoc.firstAid || '___________________________________'],
    ['🚪 Primary Emergency Exit', data.emergencyLoc.primaryExit || '___________________________________'],
    ['🚪 Secondary Emergency Exit', data.emergencyLoc.secondaryExit || '___________________________________'],
    ['🟢 Assembly Point', data.emergencyLoc.assembly || '___________________________________'],
    ['👁️ Eyewash Station', data.emergencyLoc.eyewash || '___________________________________']
  ], ['Item', 'Location (Fill In with Supervisor)']);
  s += cardClose();
  return s;
}

// ── S13: Performance & Feedback ─────────────────────
function buildS13() {
  var sec = SECTIONS[12];
  var s = cardOpen(sec);
  s += '<p>We want this summer to be a standout experience for you - one you will look back on as the start of something bigger. The expectations below are not about checking boxes. They are here to help you grow, build your reputation, and leave with real accomplishments you can talk about in your next interview.</p>';
  s += subH('green', 'What We Expect From You');
  s += '<ul><li>Complete all assigned tasks accurately and on time</li>' +
    '<li>Communicate proactively about challenges or delays</li>' +
    '<li>Show initiative - look for ways to contribute beyond the minimum</li>' +
    '<li>Demonstrate willingness to learn and receive feedback</li>' +
    '<li>Participate actively in team meetings and training sessions</li>' +
    '<li>Maintain a positive, solutions-oriented attitude</li>' +
    '<li><strong>Attend every mandatory training session fully and on time - no exceptions</strong></li>' +
    '<li>Complete all training log entries and post-training assessments as assigned</li>' +
    '<li>Apply what you learn in training directly and immediately to your day-to-day work</li>' +
    '<li>Demonstrate the ethical and moral standards covered in training in every interaction</li></ul>';
  s += subH('green', 'Check-ins & Reviews');
  s += tbl([
    ['Informal Check-in', 'End of Week 2', 'Settling-in conversation; early issue identification; confirm all Week 1 training is complete'],
    ['Mid-Term Review', 'End of Week ' + Math.ceil(data.durationWeeks / 2), 'Formal performance discussion; training log review; goal adjustment'],
    ['Final Evaluation', 'End of Week ' + data.durationWeeks, 'Overall performance & training completion assessment; reference letter discussion']
  ], ['Review Type', 'Timing', 'Purpose']);
  s += subH('green', 'Letter of Reference');
  s += '<p>Employees who complete their term in good standing are eligible to receive a <strong>letter of reference</strong> from their supervisor. To be eligible:</p>';
  s += '<ul><li>Complete the full contracted term without disciplinary issues</li>' +
    '<li>Demonstrate professional conduct and strong work ethic throughout</li>' +
    '<li><strong>Complete all mandatory training sessions</strong> with full attendance and active participation</li>' +
    '<li>Have a fully signed and completed training log on file</li>' +
    '<li>Request the letter from your supervisor before your last day</li></ul>';
  s += infoBox('blue', '💡', '<strong>Our Advice:</strong> The people who grow the fastest here are the ones who listen to feedback without getting defensive. When someone takes the time to help you improve, thank them - and then show them you heard it by applying it. That is how you earn respect and a strong reference.');
  s += cardClose();
  return s;
}

// ── S14: End of Employment ──────────────────────────
function buildS14() {
  var sec = SECTIONS[13];
  var s = cardOpen(sec);
  s += subH('gray', 'Contract Conclusion');
  s += '<p>Your position is a fixed-term contract' + (data.contractStartDate && data.contractEndDate ? ' running from <strong>' + data.contractStartDate + ' to ' + data.contractEndDate + '</strong>' : ' that concludes at the end of your ' + data.durationWeeks + '-week term') + '. Both you and we understand this is a seasonal role with a set end date. When your contract concludes, no additional notice period applies - we both planned for this from day one.</p>';
  s += subH('gray', 'Early Resignation');
  s += '<ul><li>If you choose to resign before the end of your term, provide a minimum of <strong>two (2) weeks written notice</strong></li>' +
    '<li>Submit written resignation to your supervisor with your final intended work date</li>' +
    '<li>Early departure without notice may affect your eligibility for a reference letter</li></ul>';
  s += subH('gray', 'Offboarding Checklist');
  s += tbl([
    ['Return all access cards, keys, and badges', 'Last day', '☐'],
    ['Return all organizational equipment (laptop, phone, tools)', 'Last day', '☐'],
    ['Submit final signed timesheet', 'Last day', '☐'],
    ['Complete exit survey / interview', 'Last week', '☐'],
    ['Delete access to organizational accounts/systems', 'Last day', '☐'],
    ['Hand over all ongoing work files and notes', 'Last day', '☐'],
    ['Confirm mailing address for T4 slip', 'Last week', '☐']
  ], ['Task', 'Due', 'Done ✓']);
  s += subH('gray', 'Record of Employment (ROE)');
  s += '<p>Your employer is required to issue a ' + glossaryTerm('ROE', '<strong>Record of Employment (ROE)</strong>') + ' within 5 calendar days of the last day you are paid. This document is needed to apply for ' + glossaryTerm('Employment Insurance', '<strong>Employment Insurance (EI)</strong>') + ' benefits if applicable. The ROE will be issued electronically to Service Canada, or provided to you in paper form upon request.</p>';
  s += cardClose();
  return s;
}

// ── S15: Key Contacts ───────────────────────────────
function buildS15() {
  var sec = SECTIONS[14];
  var s = cardOpen(sec, true);
  var L15 = provLaw();
  s += subH('teal', 'Internal Contacts');
  var c = data.contacts;
  s += tbl([
    ['Direct Supervisor', c.supervisor.name || '_______________________', (c.supervisor.phone || '__________') + ' / ' + (c.supervisor.email || '__________')],
    ['HR / Payroll Contact', c.hr.name || '_______________________', (c.hr.phone || '__________') + ' / ' + (c.hr.email || '__________')],
    ['Health & Safety Officer', c.safety.name || '_______________________', (c.safety.phone || '__________') + ' / ' + (c.safety.email || '__________')],
    ['IT Support', c.it.name || '_______________________', (c.it.phone || '__________') + ' / ' + (c.it.email || '__________')],
    ['After-Hours Emergency Contact', c.afterHours.name || '_______________________', (c.afterHours.phone || '__________') + ' / ' + (c.afterHours.email || '__________')]
  ], ['Role', 'Name', 'Phone / Email']);
  s += subH('teal', 'External Resources');
  s += tbl([
    ['Emergency Services', '<strong>911</strong>'],
    ['Canada Summer Jobs – Program Information', 'canada.ca/en/employment-social-development'],
    ['Canada Revenue Agency (CRA) – Tax Enquiries', '1-800-959-8281 | canada.ca/cra'],
    ['Canadian Human Rights Commission', '1-888-214-1090 | chrc-ccdp.gc.ca'],
    ['Service Canada (EI, ROE, SIN)', '1-800-206-7218 | canada.ca/service-canada'],
    ['Canada Suicide Prevention Service', '1-833-456-4566 (24/7)'],
    ['Kids Help Phone (under 25)', '1-800-668-6868 | Text: 686868'],
    ['Workplace Safety & Insurance - ' + L15.wsib, L15.wsibPhone + (L15.wsibWeb ? ' | ' + L15.wsibWeb : '')],
    ['Employment Standards - ' + (data.province || 'Your Province'), L15.employmentStandards]
  ], ['Resource', 'Contact / Website']);
  s += cardClose();
  return s;
}

// ── SIP: Intellectual Property ──────────────────────
function buildSIP() {
  var s = '<div class="card" id="sip">' +
    '<div class="card-header"><span class="icon">📄</span><div>' +
    '<span class="section-badge">IP</span>' +
    '<h2>Intellectual Property & Work Product</h2></div></div>' +
    '<div class="card-body">';

  s += '<p>During your employment with ' + orgNameCap() + ', you may create, develop, or contribute to materials including educational content, training resources, written documents, designs, software, processes, or other creative and intellectual work. This section explains who owns that work.</p>';

  s += subH('', 'What Is Intellectual Property?');
  s += '<p>Intellectual property (IP) means creations of the mind - things you write, design, develop, or invent. This includes lesson plans, training materials, guides, templates, graphics, videos, code, processes, branding, and any other original work product created as part of your job.</p>';

  s += subH('', 'Who Owns What You Create');
  s += '<p>Any work you create during your paid employment hours, using ' + orgName() + ' resources, or as part of your assigned duties belongs to <strong>' + orgNameCap() + '</strong>. This is standard in all workplaces - the organization owns the work it pays staff to produce, just as it owns the tools and equipment it provides.</p>';
  s += '<p>This means:</p>';
  s += '<ul>' +
    '<li>Materials you create as part of your job are the property of ' + orgNameCap() + '</li>' +
    '<li>' + orgNameCap() + ' may continue to use, modify, share, and build upon these materials after your employment ends</li>' +
    '<li>You may not take copies of these materials for use elsewhere without written permission</li>' +
    '<li>You may list this work on your resumé and portfolio as work you contributed to during your employment</li>' +
  '</ul>';

  s += subH('', 'What This Means for You');
  s += '<p>This does not mean your contributions are not valued or recognized. On the contrary - the work you create becomes part of ' + orgNameCap() + '\'s lasting resources, and you should be proud of that. Your name may be credited on materials you help develop, and your supervisor can provide a reference describing your specific contributions.</p>';
  s += '<p>If you have questions about whether something you are working on falls under this policy, ask your supervisor. We want you to understand your rights and responsibilities clearly.</p>';

  s += infoBox('blue', 'ℹ️', '<strong>Outside of work:</strong> This policy applies to work done during your paid hours and assigned duties. Personal creative projects you do on your own time, using your own resources, are yours.');

  s += '</div></div>';
  return s;
}

// ── S16: Acknowledgement ────────────────────────────
function buildS16() {
  var sec = SECTIONS[15];
  var s = cardOpen(sec);
  s += '<div class="ack-form">';
  s += '<h3>📝 Employee Acknowledgement - Canada Summer Jobs ' + data.programYear + '</h3>';
  var ackContractLine = '';
  if (data.contractStartDate && data.contractEndDate) {
    ackContractLine = '<li>My employment term runs from <strong>' + data.contractStartDate + ' to ' + data.contractEndDate + '</strong> (' + data.durationWeeks + ' weeks)</li>';
  }
  s += '<p>I, the undersigned, confirm that I have <strong>received, read, and understood</strong> the contents of this handbook. I agree to abide by all the rules, policies, and standards outlined herein for the duration of my employment term with ' + orgNameCap() + '.</p>';
  s += '<p>I understand that:</p>';
  s += '<ul>' +
    ackContractLine +
    '<li>This handbook does not constitute a guarantee of employment beyond the contracted term</li>' +
    '<li>Policies may be updated during my term, and I will be notified of any material changes</li>' +
    '<li>Violations of these policies may result in disciplinary action, up to and including termination</li>' +
    '<li>My confidentiality obligations extend beyond the end of my employment</li>' +
    '<li>I have the right to ask questions about any content in this handbook</li>' +
    '<li><strong>Attendance at all mandatory training sessions is a condition of my employment - I agree to attend every session fully and on time</strong></li>' +
    '<li><strong>I am fully responsible and accountable to my supervisors here for my conduct, attendance, performance, and training completion</strong></li>' +
    '<li>Ethics and moral standards are not optional - they apply to everything I do in this workplace</li></ul>';
  s += '<div class="sig-line">' +
    '<div class="sig-field"><label>Employee Full Name (Print)</label><div class="line"></div></div>' +
    '<div class="sig-field"><label>Employee Signature</label><div class="line"></div></div>' +
    '<div class="sig-field"><label>Date</label><div class="line"></div></div></div>';
  s += '<div class="sig-line">' +
    '<div class="sig-field"><label>Supervisor / HR Representative (Print)</label><div class="line"></div></div>' +
    '<div class="sig-field"><label>Supervisor Signature</label><div class="line"></div></div>' +
    '<div class="sig-field"><label>Date</label><div class="line"></div></div></div>';
  s += '<p style="margin-top:20px; font-size:0.85rem; color:#666;"><strong>Distribution:</strong> One signed copy to be kept by the employee · One signed copy to be placed on file by HR/Supervisor</p>';
  s += '</div>';
  s += cardClose();
  return s;
}

// ── BUILD FULL HANDBOOK ─────────────────────────────
function buildHandbook() {
  // Build header logo block
  var logoBlock = '';
  var headerTitle = esc(orgNameCap());
  var headerTagline = 'Staff Handbook & Workplace Guide – ' + data.programYear;
  if (data.companyLogo) {
    logoBlock = '<div class="hb-company"><img src="' + esc(data.companyLogo) + '" alt="' + esc(data.companyName || 'Company Logo') + '" class="hb-logo-img" /><div class="hb-company-text"><span class="hb-company-name">' + esc(data.companyName || '') + '</span><span class="hb-company-tagline">' + headerTagline + '</span></div></div>';
  }

  // Build contract dates line
  var contractLine = '';
  if (data.contractStartDate || data.contractEndDate) {
    contractLine = '<span>📝 Contract: ' + (data.contractStartDate || 'TBD') + ' – ' + (data.contractEndDate || 'TBD') + '</span>';
  }

  return '<div class="handbook-wrapper">' +
    // Header
    '<div class="hb-header">' +
      '<div class="flag-bar"></div>' +
      (logoBlock
        ? logoBlock
        : '<h1>🍁 ' + headerTitle + '</h1><h2>' + headerTagline + '</h2>') +
      (logoBlock ? '' : '') +
      '<div class="meta">' +
        '<span>📅 ' + data.durationLabel + '</span>' +
        '<span>📋 Effective: ' + data.effectiveDate + '</span>' +
        '<span>🇨🇦 Canada Summer Jobs – ' + data.programYear + '</span>' +
        contractLine +
      '</div>' +
    '</div>' +
    // All sections
    buildS1() + buildS2() + buildS3() + buildS4() + buildS5() +
    buildS6() + buildS7() + buildS8() + buildS9() + buildS10() +
    buildS11() + buildS12() + buildS13() + buildS14() + buildS15() +
    (data.showIPSection === 'yes' ? buildSIP() : '') + buildS16() +
    '</div>';
}

// ═══════════════════════════════════════════════
// SETTINGS FORM BUILDER
// ═══════════════════════════════════════════════

function settingsSection(title, content) {
  return '<div class="settings-section">' +
    '<div class="settings-section-title">' + esc(title) + '</div>' +
    '<div class="settings-section-body">' + content + '</div></div>';
}

function fg(label, id, type, val, hint) {
  type = type || 'text';
  var input;
  if (type === 'textarea') {
    input = '<textarea id="sf-' + id + '" rows="2">' + esc(String(val || '')) + '</textarea>';
  } else if (type === 'number') {
    input = '<input type="number" id="sf-' + id + '" value="' + esc(String(val)) + '" step="any" />';
  } else {
    input = '<input type="' + type + '" id="sf-' + id + '" value="' + esc(String(val || '')) + '" />';
  }
  return '<div class="form-group"><label for="sf-' + id + '">' + esc(label) + '</label>' +
    input + (hint ? '<div class="form-hint">' + hint + '</div>' : '') + '</div>';
}

function buildSettingsForm() {
  var html = '';

  // ── Company Identity (FIRST - most important) ──
  var brand = '';
  brand += '<div style="background:#fdf4f4;border-left:4px solid #c8102e;padding:12px 14px;margin-bottom:14px;border-radius:4px;"><strong style="color:#c8102e;">🏢 This is your organization\'s document.</strong> The name and logo you enter here will appear prominently at the top of the handbook and throughout the text.</div>';
  brand += fg('Company / Organization Name', 'companyName', 'text', data.companyName, 'e.g. Maple Leaf Community Services - used everywhere in the document');
  brand += '<div style="margin-top:14px;">';
  if (data.companyLogo) {
    brand += '<img src="' + esc(data.companyLogo) + '" alt="Logo preview" style="max-width:200px;max-height:80px;display:block;margin-bottom:8px;border:1px solid #ddd;border-radius:4px;padding:4px;" />';
  }
  brand += '<button class="btn btn-outline btn-sm" id="btn-upload-logo" type="button">📁 Upload Company Logo</button>';
  brand += '<div class="form-hint" style="margin-top:4px;">Recommended: PNG or JPG, max 500px wide. Appears in the header and sidebar.</div>';
  brand += '</div>';
  brand += fg('Logo URL (auto-filled on upload)', 'companyLogo', 'text', data.companyLogo, 'Upload a logo or paste a URL directly');
  html += settingsSection('🏢 Company Identity - Name & Logo', brand);

  // Program Info
  var prog = '';
  prog += fg('Program Year', 'programYear', 'text', data.programYear);
  prog += fg('Effective Date', 'effectiveDate', 'text', data.effectiveDate, 'e.g. June 26, 2026');
  prog += '<div class="form-row">' + fg('Contract Start Date', 'contractStartDate', 'text', data.contractStartDate, 'e.g. June 26, 2026') + fg('Contract End Date', 'contractEndDate', 'text', data.contractEndDate, 'e.g. August 21, 2026') + '</div>';
  prog += fg('Duration (Weeks)', 'durationWeeks', 'number', data.durationWeeks);
  prog += fg('Duration Label', 'durationLabel', 'text', data.durationLabel, 'e.g. 8 Weeks (2 Months)');
  prog += '<div class="form-group"><label for="sf-durationDisplay">Duration Display</label><select id="sf-durationDisplay" style="width:100%;padding:7px 10px;border:1px solid #d0d5dd;border-radius:5px;font-size:0.88rem;font-family:inherit;"><option value="fixed"' + (data.durationDisplay === 'fixed' ? ' selected' : '') + '>Fixed - show exact weeks (e.g. "8 weeks")</option><option value="upto"' + (data.durationDisplay === 'upto' ? ' selected' : '') + '>Range - show "Up to X weeks"</option></select><div class="form-hint">Choose "Fixed" if all positions have the same duration. Choose "Range" if durations vary and the maximum is shown.</div></div>';
  prog += '<div class="form-group"><label for="sf-province">📍 Province / Territory</label><select id="sf-province" style="width:100%;padding:7px 10px;border:1px solid #d0d5dd;border-radius:5px;font-size:0.88rem;font-family:inherit;">' +
    '<option value="British Columbia"' + (data.province === 'British Columbia' ? ' selected' : '') + '>British Columbia</option>' +
    '<option value="Alberta"' + (data.province === 'Alberta' ? ' selected' : '') + '>Alberta</option>' +
    '<option value="Saskatchewan"' + (data.province === 'Saskatchewan' ? ' selected' : '') + '>Saskatchewan</option>' +
    '<option value="Manitoba"' + (data.province === 'Manitoba' ? ' selected' : '') + '>Manitoba</option>' +
    '<option value="Ontario"' + (data.province === 'Ontario' ? ' selected' : '') + '>Ontario</option>' +
    '<option value="Quebec"' + (data.province === 'Quebec' ? ' selected' : '') + '>Quebec</option>' +
    '<option value="New Brunswick"' + (data.province === 'New Brunswick' ? ' selected' : '') + '>New Brunswick</option>' +
    '<option value="Nova Scotia"' + (data.province === 'Nova Scotia' ? ' selected' : '') + '>Nova Scotia</option>' +
    '<option value="Prince Edward Island"' + (data.province === 'Prince Edward Island' ? ' selected' : '') + '>Prince Edward Island</option>' +
    '<option value="Newfoundland and Labrador"' + (data.province === 'Newfoundland and Labrador' ? ' selected' : '') + '>Newfoundland and Labrador</option>' +
    '<option value="Yukon"' + (data.province === 'Yukon' ? ' selected' : '') + '>Yukon</option>' +
    '<option value="Northwest Territories"' + (data.province === 'Northwest Territories' ? ' selected' : '') + '>Northwest Territories</option>' +
    '<option value="Nunavut"' + (data.province === 'Nunavut' ? ' selected' : '') + '>Nunavut</option>' +
    '</select><div class="form-hint">Updates all legal references throughout the handbook - OHS Act, Employment Standards, Human Rights legislation, and workers\' compensation board for your province</div></div>';
  prog += '<div class="form-group"><label for="sf-showIPSection">Intellectual Property Section</label><select id="sf-showIPSection" style="width:100%;padding:7px 10px;border:1px solid #d0d5dd;border-radius:5px;font-size:0.88rem;font-family:inherit;"><option value="no"' + (data.showIPSection !== 'yes' ? ' selected' : '') + '>Do not include</option><option value="yes"' + (data.showIPSection === 'yes' ? ' selected' : '') + '>Include Intellectual Property section</option></select><div class="form-hint">Turn on if staff create content, materials, or resources that become organizational intellectual property during their employment</div></div>';
  html += settingsSection('📋 Program Info', prog);

  // Work Schedule
  var sched = '';
  sched += '<div class="form-row">' + fg('Daily Start Time', 'dailyStart', 'text', data.dailyStart) + fg('Daily End Time', 'dailyEnd', 'text', data.dailyEnd) + '</div>';
  sched += '<div class="form-row">' + fg('Break Start', 'breakStart', 'text', data.breakStart) + fg('Break End', 'breakEnd', 'text', data.breakEnd) + '</div>';
  sched += '<div class="form-row">' + fg('Break (min)', 'breakMin', 'number', data.breakMin) + fg('Hours Per Week', 'hoursPerWeek', 'number', data.hoursPerWeek) + '</div>';
  sched += '<div class="form-row">' + fg('Shift Total (hrs)', 'shiftHrs', 'number', data.shiftHrs) + fg('Paid Hours/Day', 'paidHrs', 'number', data.paidHrs) + '</div>';
  sched += fg('Work Days', 'workDays', 'text', data.workDays, 'e.g. Monday – Friday');
  sched += fg('Weekend Label', 'weekend', 'text', data.weekend, 'e.g. Saturday / Sunday');
  html += settingsSection('🕐 Work Schedule', sched);

  // Holidays
  var hol = '<div id="holiday-list">';
  for (var i = 0; i < data.holidays.length; i++) {
    var hh = data.holidays[i];
    hol += '<div class="holiday-row">' +
      '<div class="form-group"><label>Name</label><input type="text" class="hol-name" value="' + esc(hh.name) + '" /></div>' +
      '<div class="form-group"><label>Date</label><input type="text" class="hol-date" value="' + esc(hh.date) + '" /></div>' +
      '<button class="btn btn-sm btn-secondary hol-remove" title="Remove">✕</button>' +
      '<div class="form-group" style="grid-column:1/-1"><label>Note</label><input type="text" class="hol-note" value="' + esc(hh.note) + '" /></div>' +
      '</div>';
  }
  hol += '</div>';
  hol += '<button class="add-row-btn" id="add-holiday">+ Add Holiday</button>';
  html += settingsSection('📅 Statutory Holidays', hol);

  // Internal Contacts
  var contacts = '';
  var contactRoles = [
    { key: 'supervisor', label: 'Direct Supervisor' },
    { key: 'hr', label: 'HR / Payroll Contact' },
    { key: 'safety', label: 'Health & Safety Officer' },
    { key: 'it', label: 'IT Support' },
    { key: 'afterHours', label: 'After-Hours Emergency Contact' }
  ];
  for (var ci = 0; ci < contactRoles.length; ci++) {
    var cr = contactRoles[ci];
    var cc = data.contacts[cr.key];
    contacts += '<div style="border:1px solid #eee;border-radius:6px;padding:10px;margin-bottom:10px;"><strong style="font-size:0.85rem;color:#555;">' + esc(cr.label) + '</strong>' +
      '<div class="form-row-3">' +
      fg('Name', 'contact-' + cr.key + '-name', 'text', cc.name) +
      fg('Phone', 'contact-' + cr.key + '-phone', 'text', cc.phone) +
      fg('Email', 'contact-' + cr.key + '-email', 'text', cc.email) +
      '</div></div>';
  }
  html += settingsSection('📞 Internal Contacts', contacts);

  // Emergency Locations
  var em = '';
  em += fg('Fire Alarm Pull Stations', 'eloc-fireAlarm', 'text', data.emergencyLoc.fireAlarm);
  em += fg('Fire Extinguishers', 'eloc-fireExt', 'text', data.emergencyLoc.fireExt);
  em += fg('First Aid Kit', 'eloc-firstAid', 'text', data.emergencyLoc.firstAid);
  em += fg('Primary Emergency Exit', 'eloc-primaryExit', 'text', data.emergencyLoc.primaryExit);
  em += fg('Secondary Emergency Exit', 'eloc-secondaryExit', 'text', data.emergencyLoc.secondaryExit);
  em += fg('Assembly Point', 'eloc-assembly', 'text', data.emergencyLoc.assembly);
  em += fg('Eyewash Station', 'eloc-eyewash', 'text', data.emergencyLoc.eyewash);
  html += settingsSection('🚒 Emergency Locations', em);

  return html;
}

function collectSettingsForm() {
  var out = JSON.parse(JSON.stringify(data));

  // Program info
  out.programYear = document.getElementById('sf-programYear').value.trim() || DEFAULTS.programYear;
  out.effectiveDate = document.getElementById('sf-effectiveDate').value.trim() || DEFAULTS.effectiveDate;
  out.contractStartDate = document.getElementById('sf-contractStartDate').value.trim();
  out.contractEndDate = document.getElementById('sf-contractEndDate').value.trim();
  out.durationWeeks = parseInt(document.getElementById('sf-durationWeeks').value) || DEFAULTS.durationWeeks;
  out.durationLabel = document.getElementById('sf-durationLabel').value.trim() || DEFAULTS.durationLabel;
  out.durationDisplay = document.getElementById('sf-durationDisplay').value || DEFAULTS.durationDisplay;
  out.showIPSection = document.getElementById('sf-showIPSection').value || DEFAULTS.showIPSection;
  out.province = document.getElementById('sf-province').value.trim() || DEFAULTS.province;
  // Company name - single source of truth, synced to orgName/orgNameCap for backward compat
  out.companyName = document.getElementById('sf-companyName').value.trim();
  out.companyLogo = document.getElementById('sf-companyLogo').value.trim();
  out.orgName = out.companyName || DEFAULTS.orgName;
  out.orgNameCap = out.companyName || DEFAULTS.orgNameCap;

  // Schedule
  out.dailyStart = document.getElementById('sf-dailyStart').value.trim() || DEFAULTS.dailyStart;
  out.dailyEnd = document.getElementById('sf-dailyEnd').value.trim() || DEFAULTS.dailyEnd;
  out.breakStart = document.getElementById('sf-breakStart').value.trim() || DEFAULTS.breakStart;
  out.breakEnd = document.getElementById('sf-breakEnd').value.trim() || DEFAULTS.breakEnd;
  out.breakMin = parseInt(document.getElementById('sf-breakMin').value) || DEFAULTS.breakMin;
  out.hoursPerWeek = parseInt(document.getElementById('sf-hoursPerWeek').value) || DEFAULTS.hoursPerWeek;
  out.shiftHrs = parseFloat(document.getElementById('sf-shiftHrs').value) || DEFAULTS.shiftHrs;
  out.paidHrs = parseFloat(document.getElementById('sf-paidHrs').value) || DEFAULTS.paidHrs;
  out.workDays = document.getElementById('sf-workDays').value.trim() || DEFAULTS.workDays;
  out.weekend = document.getElementById('sf-weekend').value.trim() || DEFAULTS.weekend;

  // Holidays
  var holNames = document.querySelectorAll('.hol-name');
  var holDates = document.querySelectorAll('.hol-date');
  var holNotes = document.querySelectorAll('.hol-note');
  out.holidays = [];
  for (var hi = 0; hi < holNames.length; hi++) {
    var hn = holNames[hi].value.trim();
    if (hn) {
      out.holidays.push({
        name: hn,
        date: holDates[hi].value.trim(),
        note: holNotes[hi].value.trim()
      });
    }
  }

  // Contacts
  var contactKeys = ['supervisor', 'hr', 'safety', 'it', 'afterHours'];
  for (var ck = 0; ck < contactKeys.length; ck++) {
    var key = contactKeys[ck];
    out.contacts[key] = {
      name: document.getElementById('sf-contact-' + key + '-name').value.trim(),
      phone: document.getElementById('sf-contact-' + key + '-phone').value.trim(),
      email: document.getElementById('sf-contact-' + key + '-email').value.trim()
    };
  }

  // Emergency locations
  var elocKeys = ['fireAlarm', 'fireExt', 'firstAid', 'primaryExit', 'secondaryExit', 'assembly', 'eyewash'];
  for (var ek = 0; ek < elocKeys.length; ek++) {
    out.emergencyLoc[elocKeys[ek]] = document.getElementById('sf-eloc-' + elocKeys[ek]).value.trim();
  }

  return out;
}

// ═══════════════════════════════════════════════
// RENDER & NAVIGATION
// ═══════════════════════════════════════════════

function renderHandbook() {
  document.getElementById('handbook-view').innerHTML = buildHandbook();
  document.getElementById('sidebar-year').textContent = data.programYear;
  document.getElementById('footer-year').textContent = data.programYear;
  document.getElementById('footer-company').textContent = data.companyName || 'Staff';
  document.getElementById('footer-duration').textContent = data.durationLabel + ' Employment Term';

  // Sidebar logo: company logo if available, otherwise maple leaf
  var logoEl = document.getElementById('sidebar-logo');
  if (logoEl) {
    if (data.companyLogo) {
      logoEl.innerHTML = '<img src="' + esc(data.companyLogo) + '" alt="' + esc(data.companyName || 'Logo') + '" style="max-width:100%;max-height:48px;object-fit:contain;" />';
      logoEl.className = 'sidebar-logo has-logo';
    } else {
      logoEl.innerHTML = '🍁';
      logoEl.className = 'sidebar-logo';
    }
  }

  tool.resize();
}

function updateTopBar() {
  var actions = document.getElementById('top-actions');
  var html = '<button id="btn-export" class="btn btn-outline btn-sm" title="Export as PDF">📄 Export PDF</button>';
  if (!readOnly) {
    html += ' <button id="btn-settings" class="btn btn-outline btn-sm">⚙️ Edit Handbook Settings</button>';
  }
  actions.innerHTML = html;
  var badge = document.getElementById('mode-badge');
  if (badge) badge.style.display = 'none';
}

function openSettings() {
  if (readOnly) return;
  document.getElementById('settings-form').innerHTML = buildSettingsForm();
  document.getElementById('settings-overlay').classList.add('open');
  document.getElementById('settings-panel').classList.add('open');
  settingsOpen = true;
  bindSettingsEvents();
}

function closeSettings() {
  document.getElementById('settings-overlay').classList.remove('open');
  document.getElementById('settings-panel').classList.remove('open');
  settingsOpen = false;
}

// ── PDF / HTML Export ───────────────────────────────
var _printModeActive = false;
var _printSavedDisplay = {};

function enterPrintMode() {
  if (_printModeActive) return;
  _printModeActive = true;
  var ids = ['sidebar', 'top-bar', 'nav-toggle', 'back-to-top', 'settings-panel', 'settings-overlay', 'th-bar'];
  for (var i = 0; i < ids.length; i++) {
    var el = document.getElementById(ids[i]);
    if (el) {
      _printSavedDisplay[ids[i]] = el.style.display;
      el.style.display = 'none';
    }
  }
  document.getElementById('content').style.marginLeft = '0';
}

function exitPrintMode() {
  if (!_printModeActive) return;
  _printModeActive = false;
  var ids = ['sidebar', 'top-bar', 'nav-toggle', 'back-to-top', 'settings-panel', 'settings-overlay', 'glossary-drawer', 'glossary-overlay', 'th-bar'];
  for (var i = 0; i < ids.length; i++) {
    var el = document.getElementById(ids[i]);
    if (el && _printSavedDisplay[ids[i]] !== undefined) {
      el.style.display = _printSavedDisplay[ids[i]];
    }
  }
  document.getElementById('content').style.marginLeft = '';
  _printSavedDisplay = {};
}

function handleExport() {
  var filename = 'CSJ-Staff-Handbook-' + data.programYear;

  // Try CMS PDF export channel first - uses current DOM (with chrome hidden)
  if (typeof tool.requestExportPdf === 'function') {
    enterPrintMode();
    // Small delay to ensure DOM changes settle before CMS captures the frame
    setTimeout(function() {
      tool.requestExportPdf({
        filename: filename,
        landscape: false
      }, function(err, file) {
        exitPrintMode();
        if (err) {
          tool.notify('CMS export unavailable - using browser print.', 'warning');
          enterPrintMode();
          window.print();
          setTimeout(exitPrintMode, 1000);
          return;
        }
        tool.notify('Document exported! Opening for print…', 'success');
        window.open(file.url, '_blank');
      });
    }, 100);
  } else {
    // No CMS channel - use browser print directly
    enterPrintMode();
    tool.notify('Use Ctrl+P → Save as PDF. Press Escape to cancel.', 'info');
    window.print();
    setTimeout(exitPrintMode, 1500);
  }
}

function saveSettings() {
  var newData = collectSettingsForm();
  data = newData;
  tool.setValue(data);
  renderHandbook();
  buildTOC();
  closeSettings();
  tool.notify('Handbook settings saved and applied.', 'success');
  tool.reportValid(true);
}

function bindSettingsEvents() {
  document.getElementById('settings-close').onclick = closeSettings;
  document.getElementById('settings-cancel').onclick = closeSettings;
  document.getElementById('settings-save').onclick = saveSettings;
  document.getElementById('settings-overlay').onclick = closeSettings;

  // Logo upload button
  var uploadBtn = document.getElementById('btn-upload-logo');
  if (uploadBtn) {
    uploadBtn.onclick = function() {
      if (typeof tool.requestUpload === 'function') {
        tool.requestUpload('image/*', function(err, file) {
          if (err) { tool.notify('Upload failed: ' + err, 'error'); return; }
          document.getElementById('sf-companyLogo').value = file.url;
          // Update preview
          var preview = uploadBtn.parentElement.querySelector('img');
          if (preview) {
            preview.src = file.url;
          } else {
            var img = document.createElement('img');
            img.src = file.url;
            img.alt = 'Logo preview';
            img.style.cssText = 'max-width:200px;max-height:80px;display:block;margin-bottom:8px;border:1px solid #ddd;border-radius:4px;padding:4px;';
            uploadBtn.parentElement.insertBefore(img, uploadBtn);
          }
          tool.notify('Logo uploaded: ' + file.name, 'success');
        });
      } else {
        tool.notify('File upload not available in this environment. Paste a logo URL directly.', 'warning');
      }
    };
  }

  var addBtn = document.getElementById('add-holiday');
  if (addBtn) {
    addBtn.onclick = function() {
      var list = document.getElementById('holiday-list');
      var row = document.createElement('div');
      row.className = 'holiday-row';
      row.innerHTML = '<div class="form-group"><label>Name</label><input type="text" class="hol-name" value="" /></div>' +
        '<div class="form-group"><label>Date</label><input type="text" class="hol-date" value="" /></div>' +
        '<button class="btn btn-sm btn-secondary hol-remove" title="Remove">✕</button>' +
        '<div class="form-group" style="grid-column:1/-1"><label>Note</label><input type="text" class="hol-note" value="" /></div>';
      list.appendChild(row);
      row.querySelector('.hol-remove').onclick = function() { row.remove(); };
    };
  }

  var removes = document.querySelectorAll('.hol-remove');
  for (var r = 0; r < removes.length; r++) {
    removes[r].onclick = function() {
      this.closest('.holiday-row').remove();
    };
  }
}

// ── Scrollspy ───────────────────────────────────────
function updateActiveTOC() {
  var scrollY = window.scrollY || document.documentElement.scrollTop;
  var viewH = window.innerHeight;
  var bestId = 's1';
  var bestTop = Infinity;

  for (var i = 0; i < SECTIONS.length; i++) {
    var el = document.getElementById(SECTIONS[i].id);
    if (!el) continue;
    var rect = el.getBoundingClientRect();
    var top = rect.top;
    // Prefer the section whose top is closest to but not beyond 30% of viewport
    if (top <= viewH * 0.35 && top > -rect.height * 0.7) {
      if (top > -bestTop || bestTop === Infinity) {
        // pick the lowest one that passed the threshold
      }
    }
  }

  // Simpler approach: find the last section whose top is above 120px
  for (var j = SECTIONS.length - 1; j >= 0; j--) {
    var el2 = document.getElementById(SECTIONS[j].id);
    if (!el2) continue;
    var r2 = el2.getBoundingClientRect();
    if (r2.top <= 120) {
      bestId = SECTIONS[j].id;
      break;
    }
  }

  if (bestId !== activeId) {
    activeId = bestId;
    var links = document.querySelectorAll('#toc-list a');
    for (var k = 0; k < links.length; k++) {
      var link = links[k];
      if (link.getAttribute('data-id') === activeId) {
        link.classList.add('active');
        // Scroll TOC to show active link
        link.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        link.classList.remove('active');
      }
    }
  }

  // Back to top button
  var btt = document.getElementById('back-to-top');
  if (scrollY > 400) {
    btt.classList.add('visible');
  } else {
    btt.classList.remove('visible');
  }
}

// ── Bind navigation events ──────────────────────────
function bindNavEvents() {
  // TOC link clicks
  var links = document.querySelectorAll('#toc-list a');
  for (var i = 0; i < links.length; i++) {
    links[i].onclick = function(e) {
      e.preventDefault();
      var id = this.getAttribute('data-id');
      var el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        activeId = id;
        // Close mobile sidebar
        document.getElementById('sidebar').classList.remove('open');
      }
    };
  }

  // Nav toggle (mobile)
  document.getElementById('nav-toggle').onclick = function() {
    document.getElementById('sidebar').classList.toggle('open');
  };

  // Back to top
  document.getElementById('back-to-top').onclick = function() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Export button (always visible)
  var btnExport = document.getElementById('btn-export');
  if (btnExport) {
    btnExport.onclick = handleExport;
  }

  // Settings button (in top bar, edit mode only)
  var btnSettings = document.getElementById('btn-settings');
  if (btnSettings) {
    btnSettings.onclick = openSettings;
  }

  // Scroll event
  var scrollTicking = false;
  window.addEventListener('scroll', function() {
    if (!scrollTicking) {
      requestAnimationFrame(function() {
        updateActiveTOC();
        scrollTicking = false;
      });
      scrollTicking = true;
    }
  }, { passive: true });

  // Close sidebar when clicking outside on mobile
  document.getElementById('content').addEventListener('click', function(e) {
    if (window.innerWidth <= 860) {
      document.getElementById('sidebar').classList.remove('open');
    }
  });

  // Keyboard: ESC closes settings or glossary
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      if (glossaryOpen) { closeGlossary(); return; }
      if (settingsOpen) closeSettings();
      document.getElementById('sidebar').classList.remove('open');
    }
  });

  // Glossary close and overlay click
  var glossaryCloseBtn = document.getElementById('glossary-close');
  if (glossaryCloseBtn) glossaryCloseBtn.onclick = closeGlossary;
  var glossaryOverlay = document.getElementById('glossary-overlay');
  if (glossaryOverlay) glossaryOverlay.onclick = closeGlossary;
}

// ═══════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════

function init(val) {
  // Merge saved data over defaults
  data = JSON.parse(JSON.stringify(DEFAULTS));
  if (val && typeof val === 'object' && Object.keys(val).length > 0) {
    deepMerge(data, val);
  }

  readOnly = tool.isReadOnly();
  user = tool.getUser();

  buildTOC();
  renderHandbook();
  updateTopBar();
  bindNavEvents();
  updateActiveTOC();
  tool.reportValid(true);
  tool.resize();
}

function deepMerge(target, source) {
  for (var key in source) {
    if (!source.hasOwnProperty(key)) continue;
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
}

// ── SDK Entry Point ─────────────────────────────────
tool.onReady(function(val, fields) {
  init(val);

  tool.onValueChange(function(v) {
    if (v && typeof v === 'object' && Object.keys(v).length > 0) {
      data = JSON.parse(JSON.stringify(DEFAULTS));
      deepMerge(data, v);
    } else if (!v || Object.keys(v).length === 0) {
      data = JSON.parse(JSON.stringify(DEFAULTS));
    }
    buildTOC();
    renderHandbook();
    updateTopBar();
    bindNavEvents();
    updateActiveTOC();
    tool.resize();
  });

  tool.onReadonlyChange(function(ro) {
    readOnly = ro;
    updateTopBar();
    if (ro && settingsOpen) closeSettings();
    // Re-bind buttons in case they appeared/disappeared
    var btnExport = document.getElementById('btn-export');
    if (btnExport) btnExport.onclick = handleExport;
    var btnSettings = document.getElementById('btn-settings');
    if (btnSettings) btnSettings.onclick = openSettings;
    tool.resize();
  });

  tool.onUserChange(function(u) {
    user = u;
  });
});

// ── Output schema declaration ───────────────────────
tool.declareOutput({
  type: 'object',
  description: 'CSJ Staff Handbook configuration - program info, work schedule, holidays, contacts, emergency locations, company branding',
  properties: {
    programYear: { type: 'string' },
    effectiveDate: { type: 'string' },
    contractStartDate: { type: 'string' },
    contractEndDate: { type: 'string' },
    durationWeeks: { type: 'number' },
    hoursPerWeek: { type: 'number' },
    dailyStart: { type: 'string' },
    dailyEnd: { type: 'string' },
    holidays: { type: 'array' },
    contacts: { type: 'object' },
    emergencyLoc: { type: 'object' },
    companyName: { type: 'string' },
    companyLogo: { type: 'string' },
    province: { type: 'string' },
    showIPSection: { type: 'string' }
  }
});

tool.declareParams([
  { name: 'allowExportPdf', label: 'Allow PDF Export', type: 'toggle', default: 'yes', hint: 'Enable PDF export of the handbook' },
  { name: 'allowSendEmail', label: 'Allow Email Sending', type: 'toggle', default: 'no', hint: 'Enable emailing the handbook' },
  { name: 'allowUpload', label: 'Allow File Upload', type: 'toggle', default: 'yes', hint: 'Enable company logo upload via file picker' }
]);
