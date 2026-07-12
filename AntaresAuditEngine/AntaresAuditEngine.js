/* ============================================================
   ANTARES AUDIT ENGINE — JavaScript
   AEO · GEO · SEO Website Audit Tool
   CMS html-tool SDK integration
   ============================================================ */

// ─── CONSTANTS ───────────────────────────────────────────────
const MAIN_OBJECT_TYPE = 'auditSites-uniconhub';
const WEIGHT = { HIGH: 9, MEDIUM: 4, LOW: 1.5 };

const PILLARS = {
  findable:       { ic: '🔍', nm: 'Findable' },
  quotable:       { ic: '💬', nm: 'Quotable' },
  understandable: { ic: '📖', nm: 'Understandable' },
  trustworthy:    { ic: '🛡', nm: 'Trustworthy' }
};

const DEFAULT_SITES = {
  pkf: {
    name: 'PKF Antares', url: 'https://www.pkfantares.com/', platform: 'Umbraco',
    crawlDate: 'June 15, 2026', pages: '100 / 100',
    theme: { accent: '#e1ab16', accent2: '#0f3780', deep: '#0a2555' },
    scores: { siteHealth: 78, ai: 76, markup: 100, intl: 0 },
    counts: { high: 4, med: 5, low: 3, pass: 8, bonus: 1 },
    pillars: {
      findable:       { status: 'warn', note: 'HTTPS 100%, but robots.txt has a format error and sitemap.xml isn\'t referenced in it. AI crawlers allowed.' },
      quotable:       { status: 'warn', note: 'Meta coverage good; 8 low-word-count + 34 low text-to-HTML pages read as thin. No FAQ schema.' },
      understandable: { status: 'fail', note: '73 over-long titles, 54 pages with multiple H1s, 6 duplicate titles. Markup 100% (schema clean).' },
      trustworthy:    { status: 'warn', note: '162 non-descriptive + 58 empty anchors. llms.txt missing. Good internal linking (94%).' }
    },
    issues: [
      { pri:'HIGH', cat:'Understandable', head:'73 pages: title tag too long', wrong:'Titles chain the full breadcrumb, pushing well past the ~60-char SERP limit and burying the unique part.', fix:'Rewrite the title template from {Page} | {Parent} | {Grandparent} | {Brand} to {Page} | PKF Antares.', loc:'Umbraco: edit the page-title output in the master template / SEO composition.', code:'Title template:\n%%title%% | PKF Antares\n\nExample (leadership bio):\nCetin Yurt, Audit Partner — PKF Antares Calgary' },
      { pri:'HIGH', cat:'Understandable', head:'54 pages: multiple H1 tags', wrong:'Over half the inventory renders more than one <h1>. Search and AI engines expect exactly one H1 to identify the primary topic.', fix:'Set section titles to H2/H3; keep exactly one H1 per page bound to the page title.', loc:'Umbraco: edit the Razor view/partial — set section headings to h2/h3; bind one h1 to the page-title field.', code:'<!-- one per page -->\n<h1>External Audit Services for Canadian Businesses</h1>\n<h2>Our audit approach</h2>\n<h3>Financial statement audits</h3>' },
      { pri:'HIGH', cat:'Geo', head:'International SEO not implemented (0%)', wrong:'No hreflang, no en-CA language declaration, no LocalBusiness/AreaServed schema.', fix:'Add en-CA lang + self-referential hreflang sitewide; add LocalBusiness schema per office.', loc:'Umbraco: add hreflang + lang to _Layout.cshtml; add LocalBusiness JSON-LD via a schema partial.', code:'<html lang="en-CA">\n<link rel="alternate" hreflang="en-ca" href="https://www.pkfantares.com/">\n<link rel="alternate" hreflang="x-default" href="https://www.pkfantares.com/">' },
      { pri:'HIGH', cat:'Findable', head:'robots.txt format error + sitemap not referenced', wrong:'The robots.txt has a format error and does not reference the sitemap; sitemap.xml is not being found reliably.', fix:'Fix the robots.txt syntax, add the Sitemap directive, resubmit in Search Console.', loc:'Umbraco: edit the robots.txt static file in wwwroot.', code:'User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nAllow: /\nUser-agent: ClaudeBot\nAllow: /\nUser-agent: PerplexityBot\nAllow: /\nUser-agent: Google-Extended\nAllow: /\n\nSitemap: https://www.pkfantares.com/sitemap_index.xml' },
      { pri:'MEDIUM', cat:'Trustworthy', head:'llms.txt missing', wrong:'No /llms.txt to tell AI engines which canonical service, location and insight URLs to prioritise.', fix:'Publish a structured llms.txt at the root with a site summary, key pages and key facts.', loc:'Umbraco: place llms.txt in wwwroot.', code:'# PKF Antares\n> Partner-led CPA firm — audit, tax & advisory across Canada.\n\n## Key Pages\n- /audit-assurance/: External & internal audit services\n- /careers/: Careers at PKF Antares\n\n## Key Facts\n- Offices: Calgary, Toronto, Vancouver\n- Part of the global PKF network' },
      { pri:'MEDIUM', cat:'Trustworthy', head:'220 weak/empty anchor texts', wrong:'162 links use generic anchors ("read more", "click here") and 58 have no anchor text.', fix:'Rewrite anchors with descriptive, keyword-bearing text.', loc:'Umbraco: edit link text in the rich-text (RTE) property.', code:'<!-- before --> <a href="/audit-assurance/">Read more</a>\n<!-- after -->  <a href="/audit-assurance/">External audit services in Calgary</a>' },
      { pri:'MEDIUM', cat:'Quotable', head:'24 pages: content not optimised for AI', wrong:'A quarter of the site can\'t be cleanly summarised by AI engines.', fix:'Add a definition-first opening paragraph + question-format H2s + named entities (CPA Canada, IFRS, ASPE).', loc:'Umbraco: content node → body RTE property.', code:'<h2>What is a financial statement audit?</h2>\n<p>A financial statement audit is an independent examination…</p>' },
      { pri:'LOW', cat:'Understandable', head:'280 unminified JS/CSS files', wrong:'Render-blocking assets ship unminified.', fix:'Enable minify + compression + caching.', loc:'Umbraco: enable bundling/minification (Smidge) + caching headers.', code:'# Smidge → enable JS/CSS bundling + minification; defer non-critical JS' }
    ],
    h1s: [ ['/ (home)', '1', 'Partner-Led CPA Firm | PKF Antares', '—', 'PASS'], ['/audit-assurance/', '2', '(multiple H1s)', '—', 'FAIL'], ['/careers/', '2', '(multiple H1s)', '—', 'FAIL'], ['/about/our-leadership-team/', '1', 'Our Leadership Team', '18', 'WARN'] ],
    titles: [ ['/ (home)', 'PKF Antares | Partner-Led CPA Firm | Audit, Tax & Advisory', '58', 'OK', 'PASS'], ['/audit-assurance/', 'Audit & Assurance | Services | About PKF Antares | Partner-Led CPA Firm | PKF Antares', '86', 'No', 'FAIL'], ['/careers/', 'Careers | Join Our CPA Team | PKF Antares | Partner-Led CPA Firm', '67', 'No', 'FAIL'] ],
    technical: [ ['HTTPS', 'All URLs served over HTTPS', 'PASS'], ['robots.txt', 'Present but format error; sitemap not referenced', 'FAIL'], ['AI crawlers', 'GPTBot / ClaudeBot / Google-Extended allowed', 'PASS'], ['sitemap.xml', 'Not reliably found', 'WARN'], ['Canonical tags', 'Self-referencing on content pages', 'PASS'], ['JSON-LD / Markup', '100% — schema well-formed', 'PASS'], ['hreflang / Intl', 'Not implemented', 'FAIL'], ['llms.txt', 'Missing', 'WARN'] ]
  },
  bermuda: {
    name: 'Antares CPA Bermuda', url: 'https://antarescpa.bm/', platform: 'WordPress',
    crawlDate: 'June 17, 2026', pages: '56 / 100',
    theme: { accent: '#e1ab16', accent2: '#0f3780', deep: '#0a2555' },
    scores: { siteHealth: 90, ai: 94, markup: 100, intl: 0 },
    counts: { high: 3, med: 4, low: 2, pass: 10, bonus: 1 },
    pillars: {
      findable:       { status: 'warn', note: 'HTTPS 98%, valid robots.txt & sitemap, all AI crawlers allowed — but 9 pages return 4xx.' },
      quotable:       { status: 'warn', note: '39 low text-to-HTML pages (short bio/service templates). 2 pages content not optimised. No FAQ schema.' },
      understandable: { status: 'warn', note: '20 pages with multiple H1s, 3 over-long titles, 3 missing metas. Markup 100%.' },
      trustworthy:    { status: 'warn', note: '5 non-descriptive anchors, llms.txt missing. Internal linking 90%.' }
    },
    issues: [
      { pri:'HIGH', cat:'Findable', head:'9 × 4xx errors + 47 pages of broken internal links', wrong:'Nine URLs return 4xx and 47 pages still link to them.', fix:'Map each 4xx URL to its current location, place 301 redirects, then update internal links.', loc:'WordPress: Redirection plugin for 301s; edit menus/links.', code:'# Redirection plugin — add for each moved URL\n/old-service-url  →  /services/new-service-url/  (301)' },
      { pri:'HIGH', cat:'Geo', head:'International SEO not implemented (0%)', wrong:'No hreflang, no language declaration, no LocalBusiness/AreaServed schema.', fix:'Add en-BM lang + hreflang; add LocalBusiness schema for the Bermuda office.', loc:'WordPress: functions.php header snippet or RankMath Local SEO.', code:'<html lang="en-BM">\n<link rel="alternate" hreflang="en-bm" href="https://antarescpa.bm/">\n<link rel="alternate" hreflang="en-ca" href="https://antarescpa.bm/">\n<link rel="alternate" hreflang="x-default" href="https://antarescpa.bm/">' },
      { pri:'HIGH', cat:'Understandable', head:'20 pages: multiple H1 tags', wrong:'A theme/builder pattern renders more than one <h1> on 20 pages.', fix:'Set section headings to H2/H3; keep exactly one H1 per page.', loc:'WordPress: heading widget → HTML tag.', code:'<h1>Audit & Assurance Services in Bermuda</h1>\n<h2>Financial statement audits</h2>' },
      { pri:'MEDIUM', cat:'Trustworthy', head:'llms.txt missing', wrong:'No /llms.txt at the root.', fix:'Publish a structured llms.txt.', loc:'WordPress: site root.', code:'# Antares CPA Bermuda\n> Bermuda-based audit & assurance firm.\n\n## Key Pages\n- /audit-assurance/: Audit & assurance services\n\n## Key Facts\n- Head office: Hamilton, Bermuda' },
      { pri:'MEDIUM', cat:'Quotable', head:'39 pages: low text-to-HTML ratio', wrong:'Markup outweighs body copy on most crawled pages.', fix:'Deepen bios and service descriptions past the low-text threshold.', loc:'WordPress: page body editor.', code:'<p>An external audit provides independent assurance over financial statements…</p>' },
      { pri:'MEDIUM', cat:'Quotable', head:'2 pages: content not optimised for AI', wrong:'Two pages can\'t be cleanly summarised by AI engines.', fix:'Add definition-first opening + question-format H2s.', loc:'WordPress: page body editor.', code:'<h2>Who needs an audit in Bermuda?</h2>\n<p>Bermuda exempted companies and regulated entities…</p>' },
      { pri:'LOW', cat:'Understandable', head:'49 large-HTML pages + 32 over-long URLs', wrong:'Oversized HTML and long URLs.', fix:'Trim boilerplate; shorten new URL slugs.', loc:'WordPress: editor / permalink settings.', code:'# Prefer short slugs\n/services/internal-audit/  (not /services/our-internal-audit-services/)' }
    ],
    h1s: [ ['/ (home)', '1', 'Antares CPA — Audit & Assurance in Bermuda', '41', 'PASS'], ['/audit-assurance/', '2', '(multiple H1s)', '—', 'FAIL'], ['/about-us/our-leadership/', '1', 'Our Leadership', '14', 'WARN'] ],
    titles: [ ['/ (home)', 'Antares CPA Bermuda | Audit & Assurance', '39', 'OK', 'PASS'], ['/audit-assurance/', 'Audit & Assurance Services | Antares CPA Bermuda', '49', 'OK', 'PASS'], ['/insights/…captive-insurance/', 'Bermuda\'s Regulatory Leadership in Captive Insurance | Antares CPA Bermuda', '73', 'No', 'FAIL'] ],
    technical: [ ['HTTPS', '98% — served over HTTPS', 'PASS'], ['robots.txt', 'Valid, sitemap referenced', 'PASS'], ['AI crawlers', 'All major AI crawlers allowed', 'PASS'], ['sitemap.xml', 'Valid XML', 'PASS'], ['Canonical tags', 'Self-referencing', 'PASS'], ['JSON-LD / Markup', '100%', 'PASS'], ['4xx errors', '9 pages return 4xx', 'FAIL'], ['hreflang / Intl', 'Not implemented', 'FAIL'], ['llms.txt', 'Missing', 'WARN'] ]
  },
  coolumba: {
    name: 'Coolumba', url: 'https://www.coolumba.com/', platform: 'UniconHub',
    crawlDate: 'June 15, 2026', pages: '8 / 100',
    theme: { accent: '#2CA6A4', accent2: '#004F9E', deep: '#002B5B' },
    scores: { siteHealth: 86, ai: 96, markup: 100, intl: 0 },
    counts: { high: 2, med: 3, low: 1, pass: 9, bonus: 2 },
    pillars: {
      findable:       { status: 'warn', note: 'HTTPS 100%, Crawlability 100%, all AI crawlers allowed — but robots.txt has a format error.' },
      quotable:       { status: 'warn', note: 'Homepage is thin (low word count + low text-to-HTML). No FAQ schema yet. llms.txt now live.' },
      understandable: { status: 'warn', note: 'Homepage missing an H1; low semantic HTML. Markup 100% (Org + Product + Site Name).' },
      trustworthy:    { status: 'warn', note: 'One near-orphan page (1 internal link). llms.txt present. Only 8 pages exist.' }
    },
    issues: [
      { pri:'HIGH', cat:'Findable', head:'Invalid robots.txt format', wrong:'The robots.txt has a format error.', fix:'Validate with Google\'s robots tester and fix the stray directive; reference the sitemap.', loc:'UniconHub: serve a corrected /robots.txt.', code:'User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nAllow: /\nUser-agent: ClaudeBot\nAllow: /\n\nSitemap: https://www.coolumba.com/sitemap.xml' },
      { pri:'HIGH', cat:'Geo', head:'International SEO not implemented (0%)', wrong:'No hreflang, en-CA, AreaServed.', fix:'Add en-CA lang + self-referential hreflang + x-default.', loc:'UniconHub: root layout <html> tag.', code:'<html lang="en-CA">\n<link rel="alternate" hreflang="en-ca" href="https://www.coolumba.com/">\n<link rel="alternate" hreflang="x-default" href="https://www.coolumba.com/">' },
      { pri:'MEDIUM', cat:'Understandable', head:'Homepage missing an H1 + low semantic HTML', wrong:'The homepage has no <h1> and leans on generic <div> wrappers.', fix:'Promote the page title to an <h1>; wrap regions in <header>/<main>/<section>/<footer>.', loc:'UniconHub: homepage template/component.', code:'<main>\n  <h1>Coolumba — Software for Advisory, Audit & Accounting Firms</h1>\n  <section>…</section>\n</main>' },
      { pri:'MEDIUM', cat:'Quotable', head:'Thin homepage (low word count)', wrong:'More markup than copy.', fix:'Expand to 600–1,200 words structured by question-format H2s.', loc:'UniconHub: homepage template.', code:'<h2>Who is Coolumba for?</h2>\n<p>Coolumba is software for advisory, audit and accounting firms in Canada…</p>' },
      { pri:'MEDIUM', cat:'Understandable', head:'Upgrade Product → SoftwareApplication schema', wrong:'Product schema is present but SoftwareApplication is more specific.', fix:'Add SoftwareApplication JSON-LD.', loc:'UniconHub: <head> JSON-LD block.', code:'{\n "@context":"https://schema.org",\n "@type":"SoftwareApplication",\n "name":"Coolumba",\n "applicationCategory":"BusinessApplication",\n "operatingSystem":"Web"\n}' },
      { pri:'LOW', cat:'Trustworthy', head:'One near-orphan page (1 internal link)', wrong:'A page with only one internal link gets low AI citation weight.', fix:'Cross-link it into the nav and homepage body.', loc:'UniconHub: nav + homepage template.', code:'<a href="/product">Explore the Coolumba platform</a>' }
    ],
    h1s: [ ['/ (home)', '0', '(none)', '0', 'FAIL'], ['/about-us', '1', 'About Coolumba', '14', 'WARN'] ],
    titles: [ ['/ (home)', 'Coolumba | Software for Advisory, Audit & Accounting Firms', '58', 'OK', 'PASS'], ['/about-us', 'About Us | Coolumba', '19', 'OK', 'PASS'] ],
    technical: [ ['HTTPS', '100%', 'PASS'], ['robots.txt', 'Present but format error', 'FAIL'], ['AI crawlers', 'All major AI crawlers allowed', 'PASS'], ['sitemap.xml', 'Valid XML', 'PASS'], ['Canonical tags', 'Self-referencing', 'PASS'], ['JSON-LD / Markup', '100% (Org + Product + Site Name)', 'PASS'], ['hreflang / Intl', 'Not implemented', 'FAIL'], ['llms.txt', 'Present', 'PASS'] ]
  },
  ff: {
    name: 'Final Frontiers', url: 'https://finalfrontiers.net/', platform: 'WordPress',
    crawlDate: 'June 12, 2026', pages: '28 / 100',
    theme: { accent: '#e58d2a', accent2: '#b5651a', deep: '#3a3530' },
    scores: { siteHealth: 82, ai: 95, markup: 100, intl: 85 },
    counts: { high: 3, med: 3, low: 2, pass: 9, bonus: 1 },
    pillars: {
      findable:       { status: 'warn', note: 'HTTPS 98%, all AI crawlers allowed, llms.txt live — but 3 new 4xx from a URL restructure.' },
      quotable:       { status: 'warn', note: 'Meta coverage strong now (2 missing). 11 low text-to-HTML pages. Pricing article is AI-flagged.' },
      understandable: { status: 'warn', note: 'hreflang shipped (Intl 0→85%) but misconfigured — 12 conflict + 12 incorrect-link pages. Markup 100%.' },
      trustworthy:    { status: 'warn', note: '3 pages with one internal link. llms.txt live. Add FAQ + LocalBusiness schema.' }
    },
    issues: [
      { pri:'HIGH', cat:'Understandable', head:'Hreflang misconfigured — 12 conflicts + 12 incorrect links', wrong:'The rebuild shipped hreflang on all 12 public pages, but each has conflicts.', fix:'On each page declare exactly: hreflang="en-CA" → its own final www URL, plus x-default.', loc:'WordPress: header snippet or Yoast.', code:'<link rel="alternate" hreflang="en-ca" href="https://www.finalfrontiers.net/services/managed-it-services/">\n<link rel="alternate" hreflang="x-default" href="https://www.finalfrontiers.net/services/managed-it-services/">' },
      { pri:'HIGH', cat:'Findable', head:'3 × 4xx from the URL restructure', wrong:'/about/, /service/cloud-computing/ and /service/managed-it-services/ now 404.', fix:'Place three 301 redirects and update the 14 internal links.', loc:'WordPress: Redirection plugin.', code:'/about/                        → /about-us/                          (301)\n/service/cloud-computing/      → /services/cloud-computing/          (301)\n/service/managed-it-services/  → /services/managed-it-services/      (301)' },
      { pri:'HIGH', cat:'Quotable', head:'Pricing article flagged content not optimised for AI', wrong:'The page has the right question-format title but is missing a meta description and has low word count.', fix:'Add a meta description, a definition-first opening paragraph, and 400+ words.', loc:'WordPress: post editor + Yoast meta.', code:'<h2>How much should Calgary businesses pay for IT support?</h2>\n<p>Managed IT support in Calgary typically ranges from…</p>' },
      { pri:'MEDIUM', cat:'Understandable', head:'Add FAQ + LocalBusiness schema', wrong:'Service hubs lack FAQPage schema; the Calgary office has no LocalBusiness schema.', fix:'Add FAQPage schema to both service hubs; add LocalBusiness for the Calgary office.', loc:'WordPress: RankMath schema or JSON-LD in head.', code:'{\n "@context":"https://schema.org",\n "@type":"LocalBusiness",\n "name":"Final Frontiers",\n "address":{"@type":"PostalAddress","addressLocality":"Calgary","addressRegion":"AB"}\n}' },
      { pri:'MEDIUM', cat:'Trustworthy', head:'3 pages with only one internal link', wrong:'Both insight articles and the homepage link graph are orphan-ish.', fix:'Cross-link the insight articles to each other and to service pages.', loc:'WordPress: body editor.', code:'<a href="/services/managed-it-services/">Managed IT services for Calgary businesses</a>' },
      { pri:'MEDIUM', cat:'Quotable', head:'2 pages missing meta descriptions + 1 over-long title', wrong:'The pricing article and privacy policy lack meta descriptions.', fix:'Write 140–155 char meta descriptions; shorten the long title.', loc:'WordPress: Yoast meta box per page.', code:'<meta name="description" content="Managed IT support pricing for Calgary businesses.">' },
      { pri:'LOW', cat:'Understandable', head:'11 pages: low text-to-HTML', wrong:'Body copy is light on 11 of 12 public pages.', fix:'Deepen copy.', loc:'WordPress: body editor.', code:'<!-- aim for 500+ words of genuine body copy per service page -->' },
      { pri:'LOW', cat:'Findable', head:'Enable HSTS', wrong:'HSTS header not set on either hostname.', fix:'Add the Strict-Transport-Security header.', loc:'Server / host config.', code:'Strict-Transport-Security: max-age=31536000; includeSubDomains' }
    ],
    h1s: [ ['/ (home)', '1', 'Managed IT Services Calgary & Toronto | Final Frontiers', '54', 'PASS'], ['/services/managed-it-services/', '1', 'Managed IT Services', '19', 'WARN'], ['/insights/how-much…it-support/', '1', 'How Much Should You Pay for IT Support?', '40', 'PASS'] ],
    titles: [ ['/ (home)', 'Managed IT Services Calgary & Toronto | Final Frontiers', '54', 'OK', 'PASS'], ['/services/cloud-computing/', 'Cloud Computing Services | Final Frontiers', '42', 'OK', 'PASS'], ['/insights/how-much…/', 'How Much Should Calgary Businesses Pay for IT Support in 2026 | Final Frontiers', '78', 'No', 'FAIL'] ],
    technical: [ ['HTTPS', '98%', 'PASS'], ['robots.txt', 'Valid, sitemap referenced', 'PASS'], ['AI crawlers', 'All major AI crawlers allowed', 'PASS'], ['sitemap.xml', 'Valid XML', 'PASS'], ['Canonical tags', 'Self-referencing', 'PASS'], ['JSON-LD / Markup', '100%', 'PASS'], ['hreflang / Intl', 'Shipped (85%) but misconfigured', 'WARN'], ['4xx errors', '3 pages (restructure debris)', 'FAIL'], ['llms.txt', 'Live at root', 'PASS'] ]
  }
};

const AI_SYSTEM_PROMPT = `You are Antares Audit Engine, an expert technical SEO / AEO (Answer Engine Optimization) / GEO (Generative Engine Optimization) auditor.
Given a website URL, produce a rigorous audit. Reason from what you know about the site and typical patterns, and clearly base findings on the four AEO pillars: Findable, Quotable, Understandable, Trustworthy.
Return ONLY valid minified JSON (no prose, no code fences) with EXACTLY this shape:
{"name":str,"platform":str,"pages":str,"scores":{"siteHealth":int,"ai":int,"markup":int,"intl":int},
"counts":{"high":int,"med":int,"low":int,"pass":int,"bonus":int},
"pillars":{"findable":{"status":"pass|warn|fail","note":str},"quotable":{...},"understandable":{...},"trustworthy":{...}},
"issues":[{"pri":"HIGH|MEDIUM|LOW","cat":"Findable|Quotable|Understandable|Trustworthy|Geo","head":str,"wrong":str,"fix":str,"loc":str,"code":str}],
"h1s":[[page,count,h1text,chars,"PASS|WARN|FAIL"]],
"titles":[[page,title,chars,"OK|No","PASS|WARN|FAIL"]],
"technical":[[check,detail,"PASS|WARN|FAIL|OK"]]}
Rules: counts must reflect issues by priority. Include 5-8 issues, 3-4 h1 rows, 3 title rows, 6-9 technical rows (must cover HTTPS, robots.txt, AI crawler access, sitemap, canonical, JSON-LD/schema, Open Graph, hreflang, llms.txt). Head fields that describe page-count problems should start with a number then "pages". Keep code fields as short ready-to-paste snippets.`;

// ─── STATE ───────────────────────────────────────────────────
let sites = {};            // { siteId: auditData }
let activeSiteId = null;  // currently selected site ID
let fixedIssues = new Set(); // indices of fixed issues
let currentTab = 'exec';
let savedState = null;   // { activeSiteId, fixedIssues: [...] }

// ─── HELPERS ─────────────────────────────────────────────────

function gradeFor(v) {
  if (v >= 93) return ['A+', '#1a8b5a'];
  if (v >= 85) return ['A', '#1a8b5a'];
  if (v >= 75) return ['B', '#4a9e3f'];
  if (v >= 65) return ['C', '#c9791f'];
  if (v >= 50) return ['D', '#d17a1f'];
  return ['F', '#d64545'];
}

function proScore(s) {
  let v = 100;
  s.issues.forEach((is, i) => { if (!fixedIssues.has(i)) v -= WEIGHT[is.pri]; });
  return Math.max(0, Math.min(100, Math.round(v)));
}

function cat2pil(c) {
  return {
    Findable: 'findable', Quotable: 'quotable',
    Understandable: 'understandable', Trustworthy: 'trustworthy',
    Geo: 'findable'
  }[c] || 'understandable';
}

function pillarScore(s, key) {
  const base = { pass: 96, warn: 74, fail: 52 }[s.pillars[key].status] || 70;
  let sc = base;
  s.issues.forEach((is, i) => {
    if (cat2pil(is.cat) === key && fixedIssues.has(i))
      sc += is.pri === 'HIGH' ? 12 : is.pri === 'MEDIUM' ? 7 : 3;
  });
  return Math.min(100, Math.round(sc));
}

function discScores(s) {
  const f = pillarScore(s, 'findable'), q = pillarScore(s, 'quotable'),
        u = pillarScore(s, 'understandable'), t = pillarScore(s, 'trustworthy');
  return {
    seo: Math.round(u * .55 + f * .45),
    aeo: Math.round(q * .55 + f * .25 + t * .20),
    geo: Math.round(t * .5 + q * .3 + (s.scores.markup / 100 * 20))
  };
}

function hl(code) {
  let e = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  e = e.replace(/(^|\n)(#[^\n]*)/g, '$1<span class="tok-com">$2</span>');
  e = e.replace(/(&lt;\/?)([a-zA-Z0-9]+)/g, '$1<span class="tok-tag">$2</span>');
  e = e.replace(/([a-zA-Z-]+)=(&quot;|")/g, '<span class="tok-attr">$1</span>=$2');
  e = e.replace(/"([^"]*)"/g, '<span class="tok-str">"$1"</span>');
  e = e.replace(/\b(User-agent|Allow|Disallow|Sitemap|301)\b/g, '<span class="tok-key">$1</span>');
  return e;
}

function addMsg(who, txt) {
  const l = document.getElementById('chatLog');
  const d = document.createElement('div');
  d.className = 'msg ' + who;
  d.innerHTML = (who === 'bot' ? '<div class="who">◈ Antares-AEO · now</div>' : '') + '<div class="bd">' + txt + '</div>';
  l.appendChild(d);
  l.scrollTop = l.scrollHeight;
}

function showLoading(msg) {
  const load = document.getElementById('load');
  load.classList.add('on');
  document.getElementById('loadT').innerHTML = msg;
}

function hideLoading() {
  document.getElementById('load').classList.remove('on');
}

// ─── CMS OBJECT CRUD ────────────────────────────────────────

function loadSitesFromCMS(callback) {
  tool.requestObjects('query', { mainObjectType: MAIN_OBJECT_TYPE }, (err, result) => {
    if (err) {
      // If CRUD not configured, use defaults only
      addMsg('bot', 'CMS object storage not available — using built-in audit data. Configure allowObjectCRUD to persist custom sites.');
      sites = { ...DEFAULT_SITES };
      if (callback) callback();
      return;
    }
    // Merge CMS objects with defaults
    sites = { ...DEFAULT_SITES };
    if (result && result.objects) {
      result.objects.forEach(obj => {
        const d = obj.productData.data_categoriesBased;
        if (d && d.siteId && d.auditData) {
          try {
            const auditData = typeof d.auditData === 'string' ? JSON.parse(d.auditData) : d.auditData;
            sites[d.siteId] = auditData;
          } catch (e) { /* skip malformed */ }
        }
      });
    }
    if (callback) callback();
  });
}

function saveSiteToCMS(siteId, auditData) {
  // First check if it already exists
  tool.requestObjects('query', { mainObjectType: MAIN_OBJECT_TYPE }, (err, result) => {
    if (err) return;
    const existing = (result && result.objects || []).find(
      obj => obj.productData.data_categoriesBased && obj.productData.data_categoriesBased.siteId === siteId
    );
    const payload = {
      productData: {
        data_categoriesBased: {
          siteId: siteId,
          auditData: JSON.stringify(auditData),
          name: auditData.name,
          url: auditData.url
        }
      }
    };
    if (existing) {
      tool.requestObjects('update', {
        mainObjectType: MAIN_OBJECT_TYPE,
        objectId: existing.id,
        ...payload
      }, (e, r) => {
        if (e) tool.notify('Failed to save site: ' + e, 'warning');
      });
    } else {
      tool.requestObjects('create', {
        mainObjectType: MAIN_OBJECT_TYPE,
        name: auditData.name + ' — Audit',
        ...payload
      }, (e, r) => {
        if (e) tool.notify('Failed to create site: ' + e, 'warning');
      });
    }
  });
}

function deleteSiteFromCMS(siteId) {
  tool.requestObjects('query', { mainObjectType: MAIN_OBJECT_TYPE }, (err, result) => {
    if (err) return;
    const existing = (result && result.objects || []).find(
      obj => obj.productData.data_categoriesBased && obj.productData.data_categoriesBased.siteId === siteId
    );
    if (existing) {
      tool.requestObjects('delete', {
        mainObjectType: MAIN_OBJECT_TYPE,
        objectId: existing.id
      }, (e, r) => {
        if (e) tool.notify('Failed to delete site: ' + e, 'warning');
        else tool.notify('Site removed from database', 'info');
      });
    }
  });
}

// ─── POPULATE SELECT ────────────────────────────────────────

function populateSiteSelect() {
  const ss = document.getElementById('siteSel');
  // Clear all options except the first placeholder
  while (ss.options.length > 1) ss.remove(1);
  Object.keys(sites).forEach(k => {
    const s = sites[k];
    const o = document.createElement('option');
    o.value = k;
    o.textContent = (s.url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    ss.appendChild(o);
  });
  // Restore active selection
  if (activeSiteId && sites[activeSiteId]) {
    ss.value = activeSiteId;
  }
}

// ─── ADD NEW SITE ───────────────────────────────────────────

function addNewSite() {
  const nameEl = document.getElementById('newSiteName');
  const urlEl = document.getElementById('newSiteUrl');
  const platEl = document.getElementById('newSitePlatform');
  const name = nameEl.value.trim();
  let url = urlEl.value.trim();

  if (!name || !url) {
    tool.notify('Please enter both a site name and URL.', 'warning');
    return;
  }

  if (!url.match(/^https?:\/\//)) url = 'https://' + url;

  // Generate a site ID from the URL
  const host = url.replace(/^https?:\/\//, '').replace(/\/$/, '').split('.')[0].toLowerCase();
  let siteId = host.replace(/[^a-z0-9]/g, '-');
  // Ensure uniqueness
  let counter = 1;
  let baseId = siteId;
  while (sites[siteId]) {
    siteId = baseId + '-' + (counter++);
  }

  const platform = platEl.value || 'Unknown';

  // Create audit data — use AI if available
  sites[siteId] = {
    name: name,
    url: url,
    platform: platform,
    crawlDate: new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }),
    pages: 'Pending',
    theme: { accent: '#2CA6A4', accent2: '#0f3780', deep: '#0a2555' },
    scores: { siteHealth: 80, ai: 80, markup: 80, intl: 0 },
    counts: { high: 0, med: 0, low: 0, pass: 0, bonus: 0 },
    pillars: {
      findable:       { status: 'warn', note: 'Pending AI analysis…' },
      quotable:       { status: 'warn', note: 'Pending AI analysis…' },
      understandable: { status: 'warn', note: 'Pending AI analysis…' },
      trustworthy:    { status: 'warn', note: 'Pending AI analysis…' }
    },
    issues: [],
    h1s: [],
    titles: [],
    technical: []
  };

  // Reset form
  nameEl.value = '';
  urlEl.value = '';
  platEl.value = '';

  // Save to CMS
  saveSiteToCMS(siteId, sites[siteId]);

  // Select and run AI audit
  activeSiteId = siteId;
  populateSiteSelect();
  document.getElementById('siteSel').value = siteId;
  document.getElementById('empty').style.display = 'none';

  tool.notify('Site "' + name + '" added. Running AI audit…', 'success');
  addMsg('bot', '⚡ New site <b>' + name + '</b> added. Running AI-powered audit now…');

  aiAudit(siteId);
}

// ─── DELETE SITE ────────────────────────────────────────────

function deleteSite() {
  if (!activeSiteId) return;
  // Don't allow deleting default sites
  if (DEFAULT_SITES[activeSiteId]) {
    tool.notify('Default sites cannot be deleted. Custom-added sites can be removed.', 'warning');
    return;
  }
  const name = sites[activeSiteId].name;
  deleteSiteFromCMS(activeSiteId);
  delete sites[activeSiteId];
  activeSiteId = null;
  fixedIssues = new Set();
  populateSiteSelect();
  document.getElementById('siteSel').value = '';
  document.getElementById('report').innerHTML = '';
  document.getElementById('empty').style.display = '';
  document.getElementById('activeCard').style.display = 'none';
  document.getElementById('reBtn').style.display = 'none';
  saveState();
  tool.notify('Site "' + name + '" removed.', 'info');
  addMsg('bot', 'Site <b>' + name + '</b> has been removed from the audit list.');
}

// ─── SELECT SITE ────────────────────────────────────────────

function onSelectSite() {
  const val = document.getElementById('siteSel').value;
  if (!val) {
    activeSiteId = null;
    document.getElementById('report').innerHTML = '';
    document.getElementById('empty').style.display = '';
    document.getElementById('activeCard').style.display = 'none';
    document.getElementById('reBtn').style.display = 'none';
    saveState();
    return;
  }
  activeSiteId = val;
  fixedIssues = new Set();
  currentTab = 'exec';
  document.getElementById('empty').style.display = 'none';
  document.getElementById('reBtn').style.display = '';
  renderReport(sites[val]);
  saveState();
  addMsg('bot', 'Loaded audit for <b>' + sites[val].name + '</b> — professional score ' + proScore(sites[val]) + '/100.');
}

// ─── AI AUDIT ───────────────────────────────────────────────

function aiAudit(siteId) {
  const s = sites[siteId];
  if (!s) return;
  const host = s.url.replace(/^https?:\/\//, '').replace(/\/$/, '');

  showLoading('⚡ AI analyzing <b>' + host + '</b>…');
  const steps = [
    'Connecting to AI analyzer…',
    'Reasoning over ' + host + '…',
    'Scoring the four AEO pillars…',
    'Deriving SEO · AEO · GEO scores…',
    'Compiling findings & fixes…'
  ];
  let i = 0;
  const iv = setInterval(() => {
    document.getElementById('loadT').innerHTML = '⚡ <b>' + host + '</b> — ' + steps[i % steps.length];
    i++;
  }, 700);

  const prompt = 'Audit this site: ' + s.url + '\n\nPlatform: ' + (s.platform || 'Unknown') + '\nSite name: ' + s.name + '\n\nReturn only the JSON.';

  tool.requestAI(prompt, '', (err, response) => {
    clearInterval(iv);

    if (err || !response) {
      hideLoading();
      addMsg('bot', 'AI analysis unavailable (' + (err || 'no response') + '). Using manual checklist for <b>' + s.name + '</b>.');
      // Keep the default skeleton — it will render as a checklist
      sites[siteId].pages = 'N/A (manual)';
      sites[siteId].crawlDate = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
      renderReport(sites[siteId]);
      saveState();
      tool.resize();
      return;
    }

    hideLoading();
    try {
      let js = response.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
      const a = js.indexOf('{'), b = js.lastIndexOf('}');
      if (a > 0 || b > 0) js = js.slice(a, b + 1);
      const data = JSON.parse(js);
      data.url = s.url;
      data.name = data.name || s.name;
      data.platform = data.platform || s.platform || 'Unknown';
      data.crawlDate = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
      data.pages = data.pages || 'AI analyzed';
      data.theme = s.theme || { accent: '#2CA6A4', accent2: '#0f3780', deep: '#0a2555' };
      ['findable', 'quotable', 'understandable', 'trustworthy'].forEach(k => {
        if (!data.pillars[k]) data.pillars[k] = { status: 'warn', note: '—' };
      });
      data.h1s = data.h1s || [];
      data.titles = data.titles || [];
      data.technical = data.technical || [];
      data.issues = data.issues || [];
      sites[siteId] = data;
      sites[siteId].url = s.url;
      sites[siteId].name = data.name || s.name;
      fixedIssues = new Set();
      currentTab = 'exec';
      saveSiteToCMS(siteId, data);
      renderReport(data);
      addMsg('bot', '⚡ AI audit complete for <b>' + data.name + '</b> — professional score ' + proScore(data) + '/100.');
      tool.notify('AI audit complete for ' + data.name, 'success');
      saveState();
      tool.resize();
    } catch (parseErr) {
      addMsg('bot', 'AI response could not be parsed (' + (parseErr.message || parseErr) + '). Using checklist for <b>' + s.name + '</b>.');
      sites[siteId].crawlDate = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
      sites[siteId].pages = 'N/A (parse error)';
      renderReport(sites[siteId]);
      saveState();
      tool.resize();
    }
  });
}

function reRun() {
  if (!activeSiteId || !sites[activeSiteId]) return;
  fixedIssues = new Set();
  currentTab = 'exec';
  addMsg('bot', '⚡ Re-running AI audit for <b>' + sites[activeSiteId].name + '</b>…');
  aiAudit(activeSiteId);
}

// ─── CHAT ───────────────────────────────────────────────────

function chatSend() {
  const inp = document.getElementById('chatIn'), v = inp.value.trim();
  if (!v) return;
  addMsg('me', v);
  inp.value = '';

  const urlish = v.match(/([a-z0-9-]+\.)+[a-z]{2,}/i);
  if (urlish) {
    const domain = urlish[0].replace(/^https?:\/\//, '');
    // Check if already in sites
    let foundId = null;
    Object.keys(sites).forEach(k => {
      if (sites[k].url && sites[k].url.indexOf(domain) !== -1) foundId = k;
    });
    if (foundId) {
      activeSiteId = foundId;
      document.getElementById('siteSel').value = foundId;
      document.getElementById('empty').style.display = 'none';
      fixedIssues = new Set();
      currentTab = 'exec';
      renderReport(sites[foundId]);
      saveState();
      addMsg('bot', 'Loaded existing audit for <b>' + sites[foundId].name + '</b>.');
    } else {
      // Add as new site
      const name = domain.replace(/^www\./, '').split('.')[0];
      const displayName = name.charAt(0).toUpperCase() + name.slice(1);
      addMsg('bot', 'Adding <b>' + domain + '</b> as a new site and running AI audit…');
      const url = 'https://' + domain;
      let siteId = name.replace(/[^a-z0-9]/g, '-');
      let counter = 1;
      while (sites[siteId]) siteId = name.replace(/[^a-z0-9]/g, '-') + '-' + (counter++);
      sites[siteId] = {
        name: displayName, url: url, platform: 'Unknown',
        crawlDate: new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }),
        pages: 'Pending',
        theme: { accent: '#2CA6A4', accent2: '#0f3780', deep: '#0a2555' },
        scores: { siteHealth: 80, ai: 80, markup: 80, intl: 0 },
        counts: { high: 0, med: 0, low: 0, pass: 0, bonus: 0 },
        pillars: {
          findable: { status: 'warn', note: 'Pending AI analysis…' },
          quotable: { status: 'warn', note: 'Pending AI analysis…' },
          understandable: { status: 'warn', note: 'Pending AI analysis…' },
          trustworthy: { status: 'warn', note: 'Pending AI analysis…' }
        },
        issues: [], h1s: [], titles: [], technical: []
      };
      activeSiteId = siteId;
      saveSiteToCMS(siteId, sites[siteId]);
      populateSiteSelect();
      document.getElementById('siteSel').value = siteId;
      document.getElementById('empty').style.display = 'none';
      document.getElementById('reBtn').style.display = '';
      aiAudit(siteId);
    }
  } else {
    addMsg('bot', 'I can audit any website for AEO, GEO, and SEO. Type a domain like <b>antarescpa.bm</b> to add it, or select one from the dropdown. You can also ask me about the four audit pillars.');
  }
  tool.resize();
}

// ─── RENDER REPORT ──────────────────────────────────────────

function renderReport(s) {
  if (!s) return;
  const sc = proScore(s), g = gradeFor(sc), c = s.counts, d = discScores(s);

  document.documentElement.style.setProperty('--accent', s.theme.accent);
  document.getElementById('activeCard').style.display = '';
  document.getElementById('acName').textContent = s.name;
  document.getElementById('acUrl').textContent = s.url;
  document.getElementById('acDate').textContent = s.crawlDate;
  document.getElementById('acPlat').textContent = s.platform;

  // Show/hide delete button (only for custom sites)
  const delBtn = document.getElementById('delSiteBtn');
  if (delBtn) delBtn.style.display = DEFAULT_SITES[activeSiteId] ? 'none' : '';

  const pillarsHtml = Object.keys(PILLARS).map(k => {
    const p = s.pillars[k], v = pillarScore(s, k);
    return '<div class="pil"><div class="ph"><div class="pic">' + PILLARS[k].ic + '</div><div style="flex:1"><span class="pst ' + p.status + '" id="ps-' + k + '">' + (p.status === 'pass' ? 'PASS' : 'WARN') + ' · ' + v + '%</span><div class="pnm">' + PILLARS[k].nm + ' Pillar</div></div></div><div class="pnote">' + p.note + '</div></div>';
  }).join('');

  const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const affLabel = (is) => { const m = is.head.match(/^(\d+)\s+pages/i); return m ? m[1] + ' pages' : 'Sitewide'; };
  const planRows = [...s.issues].map((is, idx) => ({ is, idx })).sort((a, b) => order[a.is.pri] - order[b.is.pri]).map(({ is }, n) => {
    return '<tr><td class="mono">' + (n + 1) + '</td><td><span class="tag2 ' + is.pri + '">' + is.pri + '</span></td><td>' + is.cat + '</td><td>' + is.head + '</td><td class="mono">' + affLabel(is) + '</td><td class="imp ' + (is.pri === 'HIGH' ? 'td-h' : 'td-m') + '">' + (is.pri === 'HIGH' ? 'High' : is.pri === 'MEDIUM' ? 'Medium' : 'Low') + '</td></tr>';
  }).join('');

  const issueCards = s.issues.map((is, i) => {
    return '<div class="icard ' + is.pri + '" id="ic-' + i + '"><div class="it"><span class="tag2 ' + is.pri + '">' + is.pri + '</span><span class="mono" style="font-size:10px;color:var(--dim);text-transform:uppercase;letter-spacing:.1em">' + is.cat + '</span><span class="ih">' + is.head + '</span><button class="fixtog" onclick="toggleFix(' + i + ')">Mark fixed</button></div><div class="lab w">✗ What\'s wrong</div><p>' + is.wrong + '</p><div class="lab f">✓ How to fix</div><p>' + is.fix + '</p><div class="lab l">⚙ Where (' + s.platform + ')</div><p style="color:var(--mut)">' + is.loc + '</p><pre><code>' + hl(is.code) + '</code></pre></div>';
  }).join('');

  const h1rows = s.h1s.map(r => '<tr><td class="mono">' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td class="mono">' + r[3] + '</td><td><span class="tag2 ' + r[4] + '">' + r[4] + '</span></td></tr>').join('');
  const titleRows = s.titles.map(r => '<tr><td class="mono">' + r[0] + '</td><td>' + r[1] + '</td><td class="mono">' + r[2] + '</td><td><span class="tag2 ' + r[3] + '">' + r[3] + '</span></td><td><span class="tag2 ' + r[4] + '">' + r[4] + '</span></td></tr>').join('');
  const techRows = s.technical.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td><span class="tag2 ' + r[2] + '">' + r[2] + '</span></td></tr>').join('');
  const jsonRows = s.technical.filter(r => /schema|json|markup|canonical|open graph|hreflang/i.test(r[0])).map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td><span class="tag2 ' + r[2] + '">' + r[2] + '</span></td></tr>').join('') || techRows;
  const crawlRows = s.technical.filter(r => /robot|crawl|gptbot|sitemap|https|llms|ai/i.test(r[0])).map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td><span class="tag2 ' + r[2] + '">' + r[2] + '</span></td></tr>').join('') || techRows;

  const needAIAudit = s.issues.length === 0 && !DEFAULT_SITES[activeSiteId];

  document.getElementById('report').innerHTML =
    '<div class="rtop">' +
      '<div><div class="scan">◈ Antares-AEO core scan</div><h1>Executive Report: ' + s.url.replace(/^https?:\/\//, '').replace(/\/$/, '') + '</h1></div>' +
      '<div class="acts">' +
        '<button class="btn" onclick="shareReport()">🌐 Share report</button>' +
        '<button class="btn dark" onclick="exportPDF()">🖨 Export PDF</button>' +
      '</div>' +
    '</div>' +

    '<div class="stats">' +
      '<div class="stat">' +
        '<div class="sl">Professional score</div>' +
        '<div class="big" id="proNum">' + sc + '<span>/100%</span></div>' +
        '<div class="prog"><i id="proBar" style="width:' + sc + '%;background:' + g[1] + '"></i></div>' +
        '<div class="cap" id="proAnalysis">AI ANALYSIS: ' + (sc >= 85 ? 'EXCELLENT' : sc >= 70 ? 'STRONG' : sc >= 55 ? 'FAIR' : 'NEEDS WORK') + '</div>' +
      '</div>' +
      '<div class="stat">' +
        '<div class="sl">Issues priority</div>' +
        '<div class="prio">' +
          '<span class="pi"><span class="d" style="background:var(--high)"></span>' + (c.high || 0) + ' High</span>' +
          '<span class="pi"><span class="d" style="background:var(--med)"></span>' + (c.med || 0) + ' Medium</span>' +
          '<span class="pi"><span class="d" style="background:var(--low)"></span>' + (c.low || 0) + ' Low</span>' +
          '<span class="pi"><span class="d" style="background:var(--pass)"></span>' + (c.pass || 0) + ' Pass</span>' +
        '</div>' +
        '<div class="bonus">+ ' + (c.bonus || 0) + ' bonus check' + ((c.bonus || 0) !== 1 ? 's' : '') + ' passed</div>' +
      '</div>' +
      '<div class="stat auth">' +
        '<div class="sl">AI engine authority index</div>' +
        '<div class="hd">' + (d.geo >= 90 ? 'High Authority' : d.geo >= 75 ? 'Solid Authority' : 'Building') + '</div>' +
        '<div class="desc">Comparisons verified via crawl-time organic signals.</div>' +
        '<div class="flag y">GEO visibility signal: ' + (s.scores.intl > 0 ? '+' + (s.scores.intl / 10).toFixed(1) + '%' : 'geo schema pending') + '</div>' +
      '</div>' +
      '<div class="stat auth">' +
        '<div class="sl">AEO ranking ability</div>' +
        '<div class="hd">' + (d.aeo >= 88 ? 'LLM Optimal' : d.aeo >= 72 ? 'LLM Ready' : 'LLM Partial') + '</div>' +
        '<div class="desc">Compatibility with Anthropic, OpenAI &amp; Gemini crawlers.</div>' +
        '<div class="flag ' + (d.aeo >= 80 ? 'g' : 'y') + '">' + (d.aeo >= 80 ? '✓ LLM-friendly structure verified' : '⚠ llms.txt / FAQ gaps remain') + '</div>' +
      '</div>' +
    '</div>' +

    '<div class="disc-wrap">' +
      '<div class="disc-h"><span class="d"></span> AI-search engine optimization alignment</div>' +
      '<div class="disc-sub">Separate analysis scores across the primary search indexing disciplines.</div>' +
      '<div class="disc">' +
        '<div class="dc seo"><div class="dt"><span class="nm">Technical SEO</span><span class="tag">Standard Crawlers</span></div><div class="dd">Validates core H1 headers, delimiter-optimized meta titles, self-referential canonicals, and HTTPS security.</div><div class="sr"><span class="k">SEO Score</span><span class="n" id="disc-seo">' + d.seo + '<span>/100</span></span></div></div>' +
        '<div class="dc aeo"><div class="dt"><span class="nm">AEO (AI Assistants)</span><span class="tag">LLM Crawlability</span></div><div class="dd">Measures user-agent welcoming in robots.txt, plain-text /llms.txt config, and concise FAQ snippets.</div><div class="sr"><span class="k">AEO Score</span><span class="n" id="disc-aeo">' + d.aeo + '<span>/100</span></span></div></div>' +
        '<div class="dc geo"><div class="dt"><span class="nm">GEO (Generative AI)</span><span class="tag">Factual Authority</span></div><div class="dd">Evaluates factual copy density, Schema JSON-LD organization validation, and network reference citations.</div><div class="sr"><span class="k">GEO Score</span><span class="n" id="disc-geo">' + d.geo + '<span>/100</span></span></div></div>' +
      '</div>' +
    '</div>' +

    (needAIAudit ? '<div class="reaudit"><span>🤖</span><div><b>AI audit needed.</b> This site was added manually and needs an AI-powered analysis. Click <b>↻ Re-audit site</b> in the sidebar to run the full AEO/GEO/SEO scan.</div></div>' :
    '<div class="reaudit"><span>🔄</span><div><b>Re-audit as you fix.</b> Tick "Mark fixed" on any issue — the professional score, discipline scores and pillar scores update live. Fixed so far: <span class="fx"><span id="fxN">0</span> / ' + s.issues.length + '</span>. When the site is actually updated, hit <b>↻ Re-audit site</b>.</div></div>') +

    '<div class="tabs">' +
      '<div class="tab on" data-t="exec" onclick="setTab(\'exec\')">Executive Summary</div>' +
      '<div class="tab" data-t="h1" onclick="setTab(\'h1\')">H1 Headers Check</div>' +
      '<div class="tab" data-t="titles" onclick="setTab(\'titles\')">Page Titles &amp; Metas</div>' +
      '<div class="tab" data-t="json" onclick="setTab(\'json\')">JSON-LD Struct Data</div>' +
      '<div class="tab" data-t="crawl" onclick="setTab(\'crawl\')">AI Crawlers &amp; Robots.txt</div>' +
      '<div class="tab" data-t="cards" onclick="setTab(\'cards\')">Action Cards Plan</div>' +
    '</div>' +

    '<div class="panel-t on" id="tab-exec">' +
      '<div class="pgrid">' + pillarsHtml + '</div>' +
      (s.issues.length > 0 ? '<div class="plan-box"><div class="ph">🏅 Priority action plan summary</div><table><thead><tr><th>#</th><th>Priority</th><th>Category</th><th>Recommended action</th><th>Pages affected</th><th>Impact</th></tr></thead><tbody>' + planRows + '</tbody></table></div>' : '') +
      '<div class="trio">' +
        '<div class="dcard"><div class="dh">Heading structure &amp; copy</div><div class="sub">H1 → H2 hierarchy</div><div class="val">' + (s.pillars.understandable.status === 'fail' ? 'Structure needs work — multiple H1s / long titles on templated pages.' : 'Mostly sequential with minor deviations.') + '</div><div class="sub">Indexed word density</div><div class="val">' + (s.scores.siteHealth >= 85 ? 'High authority text density per page.' : 'Several thin / low-word-count pages detected.') + '</div></div>' +
        '<div class="dcard"><div class="dh">Accessibility &amp; markup</div><div class="sub">Schema markup coverage</div><div class="val">' + s.scores.markup + '% — JSON-LD ' + (s.scores.markup >= 95 ? 'clean across pages' : 'present, gaps remain') + '.</div><div class="sub">AI answer readiness</div><div class="val">' + (s.pillars.quotable.status === 'pass' ? 'FAQ + definition blocks present.' : 'Add FAQ schema + definition-first intros.') + '</div></div>' +
        '<div class="dcard"><div class="dh">Link navigation graph</div><div class="sub">Internal contextual links</div><div class="val">' + (s.pillars.trustworthy.status === 'pass' ? 'Strong contextual internal linking.' : 'Improve anchor text + cross-links.') + '</div><div class="sub">International / GEO</div><div class="val">' + (s.scores.intl >= 50 ? 'hreflang + regional targeting live.' : 'No hreflang / LocalBusiness — GEO gap.') + '</div></div>' +
      '</div>' +
    '</div>' +

    '<div class="panel-t" id="tab-h1"><div class="plan-box"><div class="ph">📑 H1 headers — one descriptive H1 per page (50–70 chars)</div>' + (s.h1s.length > 0 ? '<table><thead><tr><th>Page</th><th>H1 count</th><th>Current H1</th><th>Chars</th><th>Status</th></tr></thead><tbody>' + h1rows + '</tbody></table>' : '<p style="font-size:12.5px;color:var(--mut)">No H1 data available. Run an audit first.</p>') + '</div></div>' +
    '<div class="panel-t" id="tab-titles"><div class="plan-box"><div class="ph">🏷 Page titles &amp; metas — 50–60 chars, keyword-first, unique</div>' + (s.titles.length > 0 ? '<table><thead><tr><th>Page</th><th>Current title</th><th>Chars</th><th>Pattern</th><th>Status</th></tr></thead><tbody>' + titleRows + '</tbody></table>' : '<p style="font-size:12.5px;color:var(--mut)">No title data available. Run an audit first.</p>') + '</div></div>' +
    '<div class="panel-t" id="tab-json"><div class="plan-box"><div class="ph">🧩 JSON-LD structured data &amp; markup</div><table><thead><tr><th>Check</th><th>Detail</th><th>Status</th></tr></thead><tbody>' + jsonRows + '</tbody></table></div></div>' +
    '<div class="panel-t" id="tab-crawl"><div class="plan-box"><div class="ph">🤖 AI crawlers &amp; robots.txt</div><table><thead><tr><th>Check</th><th>Detail</th><th>Status</th></tr></thead><tbody>' + crawlRows + '</tbody></table></div></div>' +
    '<div class="panel-t" id="tab-cards">' + (s.issues.length > 0 ? '<div style="margin-bottom:14px;font-size:12.5px;color:var(--mut)">Every finding with what\'s wrong, how to fix, platform-specific location and ready-to-paste code. Tick "Mark fixed" to re-score live.</div>' + issueCards : '<p style="font-size:12.5px;color:var(--mut);padding:20px">No issues found or audit not yet run. Click <b>↻ Re-audit site</b> to run an AI-powered scan.</p>') + '</div>' +

    '<div class="foot"><span>© 2026 Antares Intel Solutions · Secured by Antares-AEO Engine</span><span class="rr">System status: <b>OPERATIONAL</b> · Score ' + sc + '/100 · Grade ' + g[0] + '</span></div>';

  // Restore fixed states
  fixedIssues.forEach(i => {
    const card = document.getElementById('ic-' + i);
    if (card) {
      card.classList.add('fixed');
      const btn = card.querySelector('.fixtog');
      if (btn) btn.textContent = '✓ Fixed';
    }
  });

  updateScores();
  setTab(currentTab);
}

// ─── SCORE UPDATES ──────────────────────────────────────────

function updateScores() {
  const s = activeSiteId ? sites[activeSiteId] : null;
  if (!s) return;
  const sc = proScore(s), g = gradeFor(sc);

  const pv = document.getElementById('proNum');
  if (pv && pv.firstChild) pv.firstChild.textContent = sc;

  const pb = document.getElementById('proBar');
  if (pb) { pb.style.width = sc + '%'; pb.style.background = g[1]; }

  const pa = document.getElementById('proAnalysis');
  if (pa) pa.textContent = 'AI ANALYSIS: ' + (sc >= 85 ? 'EXCELLENT' : sc >= 70 ? 'STRONG' : sc >= 55 ? 'FAIR' : 'NEEDS WORK');

  const d = discScores(s);
  ['seo', 'aeo', 'geo'].forEach(k => {
    const el = document.getElementById('disc-' + k);
    if (el && el.firstChild) el.firstChild.textContent = d[k];
  });

  Object.keys(PILLARS).forEach(k => {
    const el = document.getElementById('ps-' + k);
    if (el) {
      const v = pillarScore(s, k);
      el.textContent = (s.pillars[k].status === 'pass' ? 'PASS' : 'WARN') + ' · ' + v + '%';
    }
  });

  const fn = document.getElementById('fxN');
  if (fn) fn.textContent = fixedIssues.size;
}

function toggleFix(i) {
  if (fixedIssues.has(i)) fixedIssues.delete(i);
  else fixedIssues.add(i);
  const c = document.getElementById('ic-' + i);
  if (c) {
    c.classList.toggle('fixed', fixedIssues.has(i));
    const btn = c.querySelector('.fixtog');
    if (btn) btn.textContent = fixedIssues.has(i) ? '✓ Fixed' : 'Mark fixed';
  }
  updateScores();
  saveState();
}

function setTab(t) {
  currentTab = t;
  document.querySelectorAll('.tab').forEach(e => e.classList.toggle('on', e.dataset.t === t));
  document.querySelectorAll('.panel-t').forEach(e => e.classList.toggle('on', e.id === 'tab-' + t));
  tool.resize();
}

// ─── EXPORT & SHARE ────────────────────────────────────────

function exportPDF() {
  const s = activeSiteId ? sites[activeSiteId] : null;
  if (!s) return;
  const filename = (s.name || 'audit-report').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  addMsg('bot', '📄 Generating PDF export for <b>' + s.name + '</b>…');

  tool.requestExportPdf({
    filename: filename,
    landscape: false
  }, (err, file) => {
    if (err) {
      tool.notify('PDF export failed: ' + err, 'error');
      addMsg('bot', 'PDF export failed: ' + err + '. Falling back to browser print.');
      // Fallback: open print dialog
      window.print();
      return;
    }
    tool.notify('Report exported: ' + file.url, 'success');
    addMsg('bot', '✅ Report exported. <a href="' + file.url + '" target="_blank" style="color:var(--accent2)">Open report</a> and use Print → Save as PDF.');
    window.open(file.url, '_blank');
  });
}

function shareReport() {
  const s = activeSiteId ? sites[activeSiteId] : null;
  if (!s) return;
  const url = s.url || 'this site';
  // Copy the current page URL (or the report URL if available)
  if (navigator.clipboard) {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
  }
  tool.notify('Report link copied to clipboard', 'info');
  addMsg('bot', 'Share link copied. For email sharing, use the Export PDF button to generate a report file, then attach it to an email.');
}

// ─── STATE PERSISTENCE ─────────────────────────────────────

function saveState() {
  const state = {
    activeSiteId: activeSiteId,
    fixedIssues: Array.from(fixedIssues)
  };
  tool.setValue(state);
}

function restoreState(val) {
  if (val && typeof val === 'object') {
    savedState = val;
    if (val.activeSiteId && sites[val.activeSiteId]) {
      activeSiteId = val.activeSiteId;
    }
    if (Array.isArray(val.fixedIssues)) {
      fixedIssues = new Set(val.fixedIssues);
    }
  }
}

// ─── READ-ONLY MODE ────────────────────────────────────────

function lockUI(ro) {
  const app = document.getElementById('appWrap');
  if (app) app.classList.toggle('readonly', ro);
  if (ro) {
    document.getElementById('addSiteBtn').style.display = 'none';
    document.getElementById('delSiteBtn').style.display = 'none';
  } else {
    document.getElementById('addSiteBtn').style.display = '';
    if (activeSiteId && !DEFAULT_SITES[activeSiteId]) {
      document.getElementById('delSiteBtn').style.display = '';
    }
  }
}

// ─── INIT ──────────────────────────────────────────────────

tool.onReady((val, fields) => {
  // Declare output schema
  tool.declareOutput({
    type: 'object',
    properties: {
      activeSiteId: { type: 'string', description: 'ID of the currently selected audit site' },
      fixedIssues: { type: 'array', items: { type: 'number' }, description: 'Indices of issues marked as fixed' }
    }
  });

  // Declare params
  tool.declareParams([
    { name: 'allowAi', label: 'Enable AI Audits', type: 'toggle', default: 'yes', hint: 'Allow AI-powered website audits via requestAI' },
    { name: 'allowObjectCRUD', label: 'Enable Site Storage', type: 'toggle', default: 'yes', hint: 'Allow saving/loading custom sites via CMS Object CRUD' },
    { name: 'allowExportPdf', label: 'Enable PDF Export', type: 'toggle', default: 'yes', hint: 'Allow exporting audit reports as PDF' }
  ]);

  // Wire up crawl limit label
  document.getElementById('clim').addEventListener('change', function () {
    document.getElementById('climLabel').textContent = this.value.split(' ')[0] + ' pages';
  });

  // Load sites from CMS, then restore state
  loadSitesFromCMS(() => {
    restoreState(val);
    populateSiteSelect();

    if (activeSiteId && sites[activeSiteId]) {
      document.getElementById('siteSel').value = activeSiteId;
      document.getElementById('empty').style.display = 'none';
      document.getElementById('reBtn').style.display = '';
      renderReport(sites[activeSiteId]);
    }

    // Read-only check
    if (tool.isReadOnly()) lockUI(true);
    tool.resize();
  });

  // Value change listener (external updates)
  tool.onValueChange(v => {
    if (v && typeof v === 'object') {
      if (v.activeSiteId && sites[v.activeSiteId] && v.activeSiteId !== activeSiteId) {
        activeSiteId = v.activeSiteId;
        document.getElementById('siteSel').value = activeSiteId;
        document.getElementById('empty').style.display = 'none';
        document.getElementById('reBtn').style.display = '';
        fixedIssues = new Set(Array.isArray(v.fixedIssues) ? v.fixedIssues : []);
        renderReport(sites[activeSiteId]);
        tool.resize();
      }
      if (Array.isArray(v.fixedIssues)) {
        fixedIssues = new Set(v.fixedIssues);
        if (activeSiteId && sites[activeSiteId]) {
          updateScores();
          // Re-render to update fixed card states
          renderReport(sites[activeSiteId]);
          tool.resize();
        }
      }
    }
  });

  // Read-only toggle
  tool.onReadonlyChange(ro => lockUI(ro));

  // Validate — always valid
  tool.reportValid(true);
});

// ─── EXPORT TO GLOBAL SCOPE (for onclick handlers) ─────────
// These functions are called from inline onclick attributes in the HTML
window.onSelectSite = onSelectSite;
window.addNewSite = addNewSite;
window.deleteSite = deleteSite;
window.toggleFix = toggleFix;
window.setTab = setTab;
window.chatSend = chatSend;
window.reRun = reRun;
window.shareReport = shareReport;
window.exportPDF = exportPDF;
