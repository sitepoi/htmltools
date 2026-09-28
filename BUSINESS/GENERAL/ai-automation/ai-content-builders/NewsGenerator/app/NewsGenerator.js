/* ═══════════════════════════════════════════════════════════════════════
   NewsGenerator — AI chat-driven news page generator (UniconHub html-tool)
   ───────────────────────────────────────────────────────────────────────
   • ONE news page per tool instance. The AI composes a JSON plan from a
     pre-defined component catalog; THIS tool renders the HTML/CSS/JS.
   • Generated code follows the embedded PAGE GENERATOR RULES (platform
     public website contract) — the rules text is embedded at build time.
   • Chat history persists in ai-chat-sessions-uniconbaseapps.
   ═══════════════════════════════════════════════════════════════════════ */

/* ── Embedded platform rules (injected by build script: JSON string with
      every "<" escaped as \u003c so the file is safe as an inline script) ── */
var PAGE_RULES = JSON.parse("\"PAGE GENERATOR RULES\\n====================\\nThese are the complete, active rules for generating pages for this\\nplatform. Every rule below is binding — generated HTML, CSS and JS must\\nrun exactly as described, through the page object schema, the window.gw\\nSDK and the platform APIs.\\n\\n----------------------------------------------------------------------------\\n0. WHAT YOU PRODUCE\\n----------------------------------------------------------------------------\\nProduce EXACTLY three code parts plus optional metadata, in this layout:\\n\\n    === HTML ===\\n    \u003csection class=\\\"shop-home\\\"> ... body fragment ... \u003c/section>\\n    === CSS ===\\n    .shop-home { ... }\\n    === JS ===\\n    (function () { ... })();\\n    === SEO ===\\n    { \\\"metaTitle\\\": \\\"...\\\", \\\"metaDesc\\\": \\\"...\\\", \\\"schemaItems\\\": [ ... ] }\\n    === PAGE META ===\\n    { \\\"name\\\": \\\"Shop\\\", \\\"slug\\\": \\\"shop\\\", \\\"meta\\\": { \\\"language\\\": \\\"en\\\" },\\n      \\\"data\\\": { \\\"status\\\": \\\"published\\\", \\\"requireAuth\\\": false } }\\n\\nMapping to the CMS page object (Section 2):\\n- HTML -> data.htmlPage.code.html\\n- CSS  -> data.htmlPage.code.css\\n- JS   -> data.htmlPage.code.js\\n- SEO  -> the object `seo` section (Section 14)\\n- PAGE META -> object fields `name`, `slug`, `meta.language`,\\n               `data.status`, `data.requireAuth`\\n\\nYou may also be asked to produce OTHER artifacts. The same HTML/CSS/JS\\ncontract applies everywhere except where noted:\\n- === CHROME ===         default-header / default-footer objects\\n                         (Section 12.4) — rendered on EVERY page.\\n- === TEMPLATE ===       a template page + its content objects\\n                         (Section 12.1) — routed at /t/\u003cT>/\u003ccontentId>.\\n- === EMAIL TEMPLATE === object with data.templateId for email hooks\\n                         (Section 12.2) — a full HTML document is allowed.\\n\\nCAPABILITY MAP (how to reach every platform feature):\\n  Static content      -> htmlPage.code html/css on any page object\\n  Site chrome         -> default-header / default-footer objects\\n  Reusable blocks     -> data.sections referencing shared objects\\n  Templates           -> template page + data.templateContentType\\n                         -> /t/\u003cT>/\u003ccontentId>\\n  Object detail pages -> object's own htmlPage -> /\u003ctype>/\u003cid>\\n  App pages           -> page with slug app-\u003cappId> -> /app/\u003cappId>/...\\n  Forms               -> \u003cform data-gw-form> + gw.forms.bind()\\n                         -> POST /api/forms/submit\\n  Reads               -> gw.db.query / gw.db.get / gw.db.subscribe\\n  Writes              -> gw.db.operation -> POST /api/data/op\\n                         (CMS-defined operations ONLY)\\n  Multi-step flows    -> checkout-flow widget / POST /api/flow/[flowId]\\n  Cart                -> POST|GET /api/cart (+ menu/cart widgets)\\n  Search              -> GET /api/search (+ search-box widget)\\n  Account data        -> GET /api/account/{profile|orders|tickets|bookings}\\n  Payment             -> POST /api/pay/stripe/* (amount always server-side)\\n  Email               -> POST /api/email/send + data.templateId templates\\n  Realtime updates    -> gw.db.subscribe (SSE + polling fallback)\\n  Auth & gating       -> data.requireAuth + gw.getUser/login/logout\\n  Languages           -> meta.language + contentId siblings; gw.language\\n  Theme               -> --gw-color-* CSS vars + sharedCss (admin-owned)\\n  SEO / discovery     -> seo section; /sitemap.xml, /robots.txt, /llms.txt\\n  Analytics           -> site plugins (admin-owned); gw.track in pages\\n\\nIf the page needs an operation, a flow or an email template that the user\\nhas not confirmed exists, still generate the page but append:\\n\\n    === CMS CONFIG NEEDED ===\\n    { description of the operation/flow/template the CMS author must create }\\n\\n----------------------------------------------------------------------------\\n1. THE PAGE MODEL\\n----------------------------------------------------------------------------\\n- A tenant has apps; each app can host folders (sites). A site is a folder\\n  that contains an object with slug `default-settings` (Section 15).\\n- A PAGE is an object of the site's app type inside the website folder,\\n  routed by its object-level `slug`:\\n\\n    slug `home-page`            -> `/`\\n    any other slug `\u003cslug>`     -> `/\u003cslug>`\\n    any object of a registered\\n    object type                 -> `/\u003ccmsObjectType>/\u003cid>`   (object detail)\\n    template page with slug T   -> `/t/\u003cT>/\u003ccontentId>`\\n    page with slug `app-\u003cappId>`-> `/app/\u003cappId>/...`       (capability page)\\n\\n- Language comes from `meta.language`. There are NO locale path prefixes.\\n- Sibling pages = same `contentId`, other languages (hreflang + language\\n  switcher are handled by the platform).\\n- Reserved slugs that are NOT pages: `default-settings`, `default-header`,\\n  `default-footer`. Never generate pages with these slugs.\\n- The site chrome (header/footer) is rendered by the platform from the\\n  `default-header` / `default-footer` objects. Do NOT build your own global\\n  nav/header/footer unless the request explicitly says so.\\n- Object detail pages and template pages: full contracts in Section 12.1\\n  (object pages render their own htmlPage at `/\u003ctype>/\u003cid>`; templates\\n  route content objects through `/t/\u003cT>/\u003ccontentId>`).\\n- Reusable sections: `data.sections` composes shared objects into the page\\n  before the page's own content (full contract in Section 12.3).\\n\\n----------------------------------------------------------------------------\\n2. PAGE OBJECT SCHEMA\\n----------------------------------------------------------------------------\\n{\\n  \\\"id\\\": \\\"obj-123\\\", \\\"name\\\": \\\"About Us\\\", \\\"slug\\\": \\\"about\\\",\\n  \\\"meta\\\": { \\\"language\\\": \\\"en\\\" },\\n  \\\"data\\\": {\\n    \\\"status\\\": \\\"published\\\",        // OPTIONAL; absent = published.\\n                                  // Anything else = draft (hidden without\\n                                  // preview: ?gw-preview=\u003cpreviewSecret>).\\n    \\\"requireAuth\\\": true,          // OPTIONAL. Anonymous visitors are\\n                                  // redirected to /p/user/login?returnUrl=...\\n    \\\"templateContentType\\\": \\\"trips\\\", // TEMPLATE PAGES ONLY\\n    \\\"sections\\\": [                 // OPTIONAL. Reusable sections —\\n      { \\\"cmsObjectType\\\": \\\"shared-sections\\\", \\\"objectId\\\": \\\"obj-cta\\\" }\\n    ],                            // ordered, flat only, max 20 entries.\\n    \\\"htmlPage\\\": {                  // FIXED field name of the html tool\\n      \\\"code\\\": { \\\"html\\\": \\\"...\\\", \\\"css\\\": \\\"...\\\", \\\"js\\\": \\\"...\\\" }\\n    }\\n  },\\n  \\\"seo\\\": { ... }                   // Section 14\\n}\\n\\n- DATA NORMALIZATION: the platform reads `data` first and falls back to\\n  `productData.data_categoriesBased`. You always output `data`.\\n- CONTENT IS ONLY `data.htmlPage.code.{html,css,js}`. There is NO block\\n  rendering, NO template languages (Nunjucks), no cssClassNames/settingsJSON.\\n- `data.css` / `data.js` are tolerated as embedded style/script blocks but\\n  the canonical fields are `htmlPage.code.css` / `.js`. Always use the\\n  canonical fields.\\n\\n----------------------------------------------------------------------------\\n3. EMBEDDING CONTRACT (HOW YOUR CODE RUNS) — MOST IMPORTANT SECTION\\n----------------------------------------------------------------------------\\n3.1 No document tags\\n- NEVER emit `\u003c!DOCTYPE>`, `\u003chtml>`, `\u003chead>` or `\u003cbody>` tags. Your HTML is\\n  a PURE BODY FRAGMENT injected into a page container\\n  (`\u003cdiv class=\\\"gw-page-content\\\">`) that sits between the site header and\\n  footer. A full document is a hard error.\\n\\n3.2 Lifecycle on every load and every SPA navigation\\n  1. DOMPurify script + gw bootstrap run first (`window.gw` is guaranteed\\n     to exist when your scripts run).\\n  2. Your `html` is injected into the container.\\n  3. Your `css` is appended to \u003chead> as `\u003cstyle data-gw-css>`, deduped per\\n     page, and removed again on unmount.\\n  4. Your `js` runs AFTER injection and after a double requestAnimationFrame,\\n     inside an IIFE executed via a Blob URL. Embedded \u003cscript> tags found in\\n     the html are extracted and run first; `code.js` runs last.\\n  5. The platform then auto-mounts all `[data-gw-app]` islands (idempotent)\\n     and dispatches `gw:content-ready`.\\n\\n3.3 Your JS re-runs on every visit AND every SPA navigation\\n- Scripts MUST be idempotent:\\n  * Prefer listeners attached to elements inside YOUR html (they die with\\n    the DOM on unmount).\\n  * If you must use window/document-level listeners, guard them:\\n      if (window.__myPageInit) return; window.__myPageInit = true;\\n    or remove them via the cleanup you can register (gw.onRouteChange\\n    listeners, gw.db.subscribe unsubscribes, widget cleanup functions).\\n  * Loop closures: use let/const per iteration. `var` in a loop makes every\\n    button act on the LAST item (classic bug).\\n- Top-level `function name(...)` declarations are automatically hoisted to\\n  `window.name` by the platform. Everything else stays inside the IIFE.\\n- Attach page-level helpers to `gw.ns` (a FRESH object per page visit,\\n  re-created on every SPA navigation) — never rely on hoisted window\\n  functions for page logic.\\n- NO top-level `await` (your code is wrapped in a non-async function).\\n  Use async functions, promises, or `gw.authReady`.\\n- A failing script is isolated (reported as `gw:script-error`) and never\\n  breaks the app shell — but write defensive code anyway.\\n\\n3.4 Scripts and styles placement rules\\n- Put ALL styling in `css`, ALL behavior in `js`. Embedded `\u003cstyle>` /\\n  `\u003cscript>` inside the html are tolerated (see Section 3.2) but avoid\\n  them.\\n- EXTERNAL scripts (`\u003cscript src=\\\"...\\\">`) in the html are NOT supported.\\n  Never load frameworks/CDN JS (no jQuery, no React, no lodash). Plain\\n  vanilla JavaScript only. External images/fonts by absolute URL are fine.\\n- Your `css` is injected GLOBALLY into the page (header, footer and other\\n  pages share \u003chead> while yours is mounted). Scope everything:\\n  * give your root element a unique class (e.g. `.shop-home`) and prefix\\n    every selector with it;\\n  * never style bare `html`, `body`, `*`, `a`, `button`, `h1` globally;\\n  * avoid generic class names that could collide (`button`, `.row`, `.card`).\\n- The `gw-` prefix is RESERVED for the platform shell, built-in widgets and\\n  the site's `sharedCss`. Page authors must NEVER define `gw-*` class\\n  selectors of their own (your CSS may USE --gw-color-* variables and\\n  gw-shared-* classes, just not define gw-* rules).\\n\\n3.5 SPA navigation\\n- Deep links: `\u003ca data-ic-nav-href=\\\"/shop\\\" href=\\\"/shop\\\">Shop\u003c/a>`. The\\n  click is intercepted by the SPA router; keep the plain `href` for\\n  fallback/SEO. Or call `gw.navigate('/shop')` in JS.\\n- After SPA navigation to another page, your DOM and styles are removed and\\n  your scripts re-run (idempotency rules of Section 3.3 apply).\\n\\n3.6 Content trust rules\\n- Your generated HTML is ADMIN content (trusted, injected raw). Anything\\n  that comes from DATA or USER INPUT must be escaped: build DOM with\\n  `textContent`, never `innerHTML` with interpolated values. Use\\n  `gw.sanitize(html)` (DOMPurify) when you must inject HTML strings.\\n- Never put secrets, passwords, API keys, tokens, admin URLs or preview\\n  secrets into html/css/js.\\n\\n----------------------------------------------------------------------------\\n4. HARD GUARDRAILS (violating any of these = invalid output)\\n----------------------------------------------------------------------------\\n 1. No \u003chtml>, \u003chead>, \u003cbody>, \u003c!DOCTYPE> tags. Body fragment only.\\n 2. No raw client writes. Every write is a CMS-defined operation, a flow,\\n    a form submit, or a cart call. No direct database/REST/API writes.\\n 3. No secrets in generated code.\\n 4. No reliance on removed features: blocks, cssClassNames/settingsJSON,\\n    JSON renderers, template languages (Nunjucks).\\n 5. No external JS libraries or CDN scripts; vanilla JS.\\n 6. No global (unscoped) CSS and no styling of the shell (html/body).\\n 7. Scripts must be idempotent (SPA re-runs) and must not use top-level\\n    await.\\n 8. No duplicate/leaking window-level listeners without guards.\\n 9. Field names `gw_hp`, `website`, `company` are RESERVED for honeypots.\\n    Never use them for real inputs.\\n10. `data-gw-config` must be VALID JSON (no comments, no trailing commas,\\n    no single-quoted strings).\\n11. Drafts are hidden: set `\\\"status\\\": \\\"published\\\"` (or omit it) unless the\\n    user asked for a draft.\\n12. Keep ids unique per page and prefixed (the header/footer coexist in the\\n    same document): `id=\\\"shop-cart-btn\\\"`, not `id=\\\"btn\\\"`.\\n13. Never auto-submit forms on load (the server rejects submissions faster\\n    than 2 s after page load — honeypot timing guard).\\n14. Do not use `document.write`, inline `eval` on user data, or\\n    `window.open` popups for navigation (use gw.navigate / openUrl).\\n\\n----------------------------------------------------------------------------\\n5. window.gw SDK REFERENCE (the ONLY integration surface)\\n----------------------------------------------------------------------------\\nContext properties: gw.pageId, gw.siteId, gw.folderId, gw.language,\\ngw.host, gw.currency.\\ngw.ns — a FRESH per-page namespace object (re-created on every SPA\\nnavigation). Attach page helpers here; never rely on hoisted window\\nfunctions.\\n\\nRouting\\n- gw.getPageParams() -> object merging live URL query params + context\\n  query + pathParams. pathParams by route kind:\\n    slug page      -> { slug }\\n    object detail  -> { cmsObjectType, id }\\n    template page  -> { template, contentId }\\n    app page       -> { appId, rest }\\n- gw.navigate(path)          SPA navigation to an internal path\\n- gw.openUrl(url)            new tab (noopener)\\n- gw.onRouteChange(cb)       -> returns unsubscribe function\\n\\nAuth\\n- gw.getUser() -> { id, email?, roles: string[] } | null\\n- gw.isAuthenticated() -> boolean\\n- gw.authReady -> Promise (resolves after the initial session load)\\n- gw.refreshAuth() -> Promise\u003cuser | null>\\n- gw.login(returnUrl?) -> full-page redirect to /p/user/login?returnUrl=...\\n- gw.logout() -> POST /api/auth/session {action:'logout'}, then '/'\\n\\nStorage (host-scoped; failures ignored e.g. private mode)\\n- gw.storage.get(key) / .set(key, value) / .remove(key)   (localStorage)\\n- gw.storage.session.get/set/remove                        (sessionStorage)\\n\\nFormatting / UI\\n- gw.formatCurrency(amount, currency?)   uses the site currency config\\n- gw.formatDate(value, locale?)\\n- gw.notify(message, { severity: 'info'|'success'|'warning'|'error',\\n                       duration?, title? })   toast; message shown as TEXT\\n- gw.showModal(html, { title?, closeable? }) -> returns close function\\n  (html here is admin-authored, trusted)\\n- gw.setLoading(bool)                     overlay spinner\\n- gw.sanitize(html)                       DOMPurify wrapper (safe fallback)\\n- gw.track(event, data?) / gw.trackPageView()   guarded analytics no-ops\\n  when the site has no gtag/pixel\\n\\nForms\\n- gw.forms.bind(root?)   attaches submit handling to form[data-gw-form]\\n                         and form.gw-form. IDEMPOTENT. NOT automatic — call\\n                         it once from your js (Section 6).\\n- gw.forms.submit(form, { formTypeId? })  programmatic submit\\n\\nData (read-only; server enforces public access)\\n- gw.db.query(params) -> POST /api/data/query. STRICT params:\\n    { cmsObjectType (required), folder?, filters?, search?, orderBy?,\\n      orderDir?: 'asc'|'desc', page?, pageSize? (\u003c=200), language?,\\n      relations?, facets? }\\n    filters: [ { field, op: '=='|'!='|'>'|'>='|'\u003c'|'\u003c='|'in'|'contains',\\n                 value } ]\\n    relations: [ { field, targetType, targetField? } ]\\n    -> { items: ObjectRecord[], total, page, pageSize, facets, relations }\\n- gw.db.get({ cmsObjectType, objectId }) -> GET /api/data/\u003ctype>/\u003cid>\\n    404 -> null\\n- gw.db.operation(operationId, payload, { idempotencyKey? })\\n    -> POST /api/data/op    (the ONLY set path, Section 8)\\n- gw.db.subscribe({ cmsObjectType?, folder? }, onChange) -> unsubscribe\\n    SSE-first with 5 s polling fallback.\\n    onChange receives { type: 'added'|'modified'|'removed', object }\\n    or { type: 'gw-event', event }.\\n\\nApps (island embedding, Section 11)\\n- gw.apps.register(name, factory)   idempotent; factory receives\\n    { el, config, gw } and may return a cleanup function.\\n- gw.apps.mount(root?) / gw.apps.unmount(root?)\\n- The platform auto-mounts [data-gw-app] elements after your scripts on\\n  every (re)mount; you normally never call mount yourself.\\n- Builtin widget names lazy-load /gw-widgets.js on first use.\\n- gw.service(name) -> NOT AVAILABLE (always rejects). Do not use.\\n\\nEvents (window CustomEvents you may listen for)\\n- 'gw:ready'            bootstrap installed; detail = page context\\n- 'gw:content-ready'    page scripts ran; detail { contentId }\\n- 'gw:script-error'     a blob script failed; detail { message, filename }\\n- 'gw:form-success' {form, data} · 'gw:form-error' {form, error, status?}\\n  · 'gw:form-invalid' {form, errors}        (all BUBBLE)\\n- 'gw:app-error' { name, message | error }\\n- 'gw:cart-changed'     cart contents changed\\n- 'gw:slot-picked' { slotId, slot }   (slot-picker without bookOperationId)\\n- 'ic-navigate' { detail: { href } }  -> SPA router\\n\\nObjectRecord shape (what query/get return): { id, slug?, name?,\\ncmsObjectType?, typeId?, data?, meta?, seo?, rules?, created?,\\nlastUpdated?, ... }. Field values live under `data.*`; access nested values\\nwith dotted paths, e.g. item.data.price (widgets use a `pick(obj,path)`\\nstyle, e.g. 'data.rows').\\n\\nAccess limits: only object types registered in the site app's\\n`cms-settings.objectTypes[]` with rules.publicAccess != 'no' are queryable;\\nprivate/unregistered types -> 403/404. The folder's fieldAllowlist /\\npublicFields projects fields (id is always kept). Read data with\\n`language` filter to match gw.language when available.\\n\\nService endpoints (for hand-rolled UI beyond the built-in widgets)\\n- Search: GET /api/search?type=\u003ccmsObjectType>&folder?=&q=\u003ctext>&lang?=&\\n  limit?= (int 1..100, default 24) -> { items, total }.\\n  fuse.js ranking over PUBLIC records only (private records excluded,\\n  language-filtered by `lang`). Debounce >= 300 ms; 60 req/min/IP.\\n- Account: GET /api/account/\u003cresource> with resource = profile | orders |\\n  tickets | bookings. 401 when logged out. Scope is ALWAYS the session\\n  user (server forces customerId === uid) — you can never widen it.\\n  profile -> { ok, profile: { user, ... } };\\n  others  -> { ok, resource, items }.\\n- Email: POST /api/email/send { to, templateId, subject?, data?,\\n  gw_hp? }. Template is selected SERVER-side (Section 12.2); values are\\n  HTML-escaped; raw client html is NEVER accepted. 20 req/min/IP.\\n- Payment: POST /api/pay/stripe/intent { flowStateId } — amount ALWAYS\\n  computed server-side from the flow's amountFormula (never from the\\n  client). Returns the Stripe clientSecret. POST /api/pay/stripe/confirm\\n  { paymentIntentId }. The webhook is server-only (never call it).\\n\\n----------------------------------------------------------------------------\\n6. FORMS (data-gw-form protocol)\\n----------------------------------------------------------------------------\\n\u003cform data-gw-form class=\\\"shop-contact\\\">\\n  \u003clabel>Name \u003cinput type=\\\"text\\\" name=\\\"name\\\" required>\u003c/label>\\n  \u003clabel>Email \u003cinput type=\\\"email\\\" name=\\\"email\\\" required>\u003c/label>\\n  \u003ctextarea name=\\\"message\\\" required>\u003c/textarea>\\n  \u003c!-- honeypot: hidden via CSS, never a real field -->\\n  \u003cinput type=\\\"text\\\" name=\\\"website\\\" class=\\\"shop-hp\\\" tabindex=\\\"-1\\\"\\n         autocomplete=\\\"off\\\" aria-hidden=\\\"true\\\">\\n  \u003cbutton type=\\\"submit\\\">Send\u003c/button>\\n  \u003cdiv data-gw-form-status role=\\\"status\\\">\u003c/div>\\n\u003c/form>\\n\\n- Bind with: gw.forms.bind();  (idempotent; call once in your js).\\n- Honeypot: field named `gw_hp`, `website` or `company`, OR any field with\\n  attribute `data-gw-honeypot`. Hide with CSS (.shop-hp { position:\\n  absolute; left: -9999px; }). Filled honeypots are silently dropped.\\n- Status element `[data-gw-form-status]` shows busy text (\\\"Submitting…\\\")\\n  automatically; the form gets class .gw-busy while submitting.\\n- Submit payload (JSON): { formTypeId?, submittedAt, gw_hp,\\n  values: {\u003cname>: \u003cvalue string>} }. Files present -> multipart FormData.\\n- Events: gw:form-success / gw:form-error / gw:form-invalid (bubble —\\n  listen on the form or window).\\n- Server guardrails (design for them): origin check, hashed-IP rate limit,\\n  JSON body \u003c= 256 KB, multipart \u003c= 10 MB, honeypot, min fill time 2 s,\\n  optional reCAPTCHA (site setting).\\n- formTypeId links to a CMS `form-type-definition` object that defines the\\n  destination table + server hooks. The page can never set destination\\n  table or hooks. If the form must land somewhere specific, emit a\\n  `=== CMS CONFIG NEEDED ===` note for the CMS author.\\n- Do not put honeypot-looking names on real fields.\\n\\n----------------------------------------------------------------------------\\n7. DATA READS — static content with data\\n----------------------------------------------------------------------------\\nUse gw.db.query / gw.db.get / gw.db.subscribe. Example:\\n\\n  gw.db.query({ cmsObjectType: 'menu-items', folder: 'menu',\\n                orderBy: 'name', orderDir: 'asc', pageSize: 50,\\n                language: gw.language })\\n    .then(function (res) { /* render res.items with textContent */ })\\n    .catch(function () { /* show a quiet error state */ });\\n\\nRules:\\n- Always render in a .then/catch; never block on reads; show loading and\\n  empty states.\\n- Respect pageSize \u003c= 200 (server cap).\\n- Reads are rate-limited (Section 16) and cached server-side; do not poll\\n  in a loop — use gw.db.subscribe for live updates.\\n- NEVER write via gw.db. There is no write API except operations (Section 8).\\n\\n----------------------------------------------------------------------------\\n8. WRITES THROUGH OPERATIONS (gw.db.operation)\\n----------------------------------------------------------------------------\\nOperations are CMS-authored config objects of the site app type with\\n`data.operationId`:\\n\\n{\\n  \\\"operationId\\\": \\\"create-order\\\",\\n  \\\"validation\\\": { \\\"required\\\": [\\\"items\\\"],\\n                  \\\"properties\\\": { \\\"email\\\": { \\\"type\\\": \\\"string\\\" } } },\\n  \\\"permission\\\": { \\\"roles\\\": [\\\"customer\\\"], \\\"ownerField\\\": \\\"customerId\\\" },\\n  \\\"formulas\\\": [ { \\\"out\\\": \\\"total\\\",\\n                  \\\"code\\\": \\\"sum(payload.items, price * qty)\\\" } ],\\n  \\\"writes\\\": [\\n    { \\\"targetType\\\": \\\"orders\\\", \\\"mode\\\": \\\"create\\\",\\n      \\\"with\\\": { \\\"customerId\\\": \\\"user.id\\\", \\\"total\\\": \\\"payload.total\\\" } },\\n    { \\\"targetType\\\": \\\"products\\\", \\\"mode\\\": \\\"update\\\",\\n      \\\"by\\\": { \\\"id\\\": \\\"payload.productId\\\" },\\n      \\\"fields\\\": { \\\"stock\\\": \\\"decrement\\\" } }\\n  ],\\n  \\\"hooks\\\": [ { \\\"type\\\": \\\"email\\\" }, { \\\"type\\\": \\\"contextFunction\\\",\\n                                      \\\"codeId\\\": \\\"...\\\" } ],\\n  \\\"transaction\\\": true\\n}\\n\\nCall: gw.db.operation('create-order', payload, { idempotencyKey: '...' })\\n      -> POST /api/data/op { operation, payload, idempotencyKey? }\\nResponse: { ok: true, result, idempotent? }\\n\\n- Value templates in `with`: `payload.x.y`, `user.id`.\\n- Formula DSL (safe subset): + - * / %, parentheses,\\n  sum/count/avg/min/max/round/floor/ceil/abs/str, dotted property paths;\\n  inside list functions the per-item scope is the ITEM OBJECT itself, e.g.\\n  sum(payload.items, price * qty).\\n- Permission: roles checked against the session-derived caller\\n  (anonymous -> roles: []). ownerField restricts to own records.\\n- Idempotency: pass a stable idempotencyKey per logical action so retries\\n  replay instead of duplicating (e.g. key = 'order-' + cartId).\\n- The page NEVER defines operations. Reference existing operationIds only.\\n  If a needed operation is missing, emit `=== CMS CONFIG NEEDED ===`.\\n\\n----------------------------------------------------------------------------\\n9. FLOWS (multi-step processes: checkout, booking, registration)\\n----------------------------------------------------------------------------\\nFlows are CMS-authored objects of the site app type with `data.flowId`:\\n\\n{\\n  \\\"flowId\\\": \\\"restaurant-checkout\\\",\\n  \\\"steps\\\": [\\n    { \\\"id\\\": \\\"cart\\\", \\\"dataDefinitions\\\": [\\n        { \\\"field\\\": \\\"notes\\\", \\\"type\\\": \\\"text\\\", \\\"label\\\": \\\"Notes\\\",\\n          \\\"required\\\": false } ] },\\n    { \\\"id\\\": \\\"delivery\\\", \\\"dataDefinitions\\\": [\\n        { \\\"field\\\": \\\"address\\\", \\\"type\\\": \\\"text\\\", \\\"label\\\": \\\"Address\\\",\\n          \\\"required\\\": true } ],\\n      \\\"validationRules\\\": [\\n        { \\\"field\\\": \\\"address\\\", \\\"rule\\\": \\\"minLength\\\", \\\"value\\\": 5,\\n          \\\"message\\\": \\\"Address too short\\\" } ] },\\n    { \\\"id\\\": \\\"payment\\\", \\\"paymentProvider\\\": \\\"stripe-test\\\",\\n      \\\"amountFormula\\\": \\\"cart.total + delivery.fee\\\" },\\n    { \\\"id\\\": \\\"done\\\", \\\"hooks\\\": [\\n        { \\\"type\\\": \\\"operation\\\", \\\"operationId\\\": \\\"create-order\\\",\\n          \\\"payload\\\": { \\\"customerId\\\": \\\"user.id\\\" } } ] }\\n  ]\\n}\\n\\nRules:\\n- The LAST step MUST have id \\\"done\\\" and carries the hooks.\\n- dataDefinitions types: text | number | boolean | array | object.\\n- Validation rule subset (server-enforced): required, email, min, max,\\n  minLength, maxLength, regex, integer. Unknown rules fail loud — use only\\n  this subset.\\n- amountFormula is evaluated over the accumulated per-step values:\\n  `state.steps.\u003cstepId>.\u003cfield>` — e.g. 'seats.count * 25',\\n  'cart.total + delivery.fee'.\\n- Hook payload templates resolve `steps.\u003cstepId>.\u003cfield>` and `user.id`.\\n- API:\\n    POST /api/flow/[flowId] { action: 'start' }\\n      -> { ok, flowStateId, step }\\n    POST /api/flow/[flowId] { action: 'step', values }\\n      -> { ok, flowStateId, nextStep } | 400 { errors }\\n    POST /api/flow/[flowId] { action: 'complete' }\\n      -> { ok, result: { operations, paymentIntent } }\\n- Flow state is SERVER-side in an httpOnly cookie (gw-flow-\u003csessionKey>).\\n  The client sends NO state and cannot forge steps.\\n- Payment: a step with paymentProvider + amountFormula produces a\\n  paymentIntent on completion. In test setups the intent is a STUB\\n  (pi_stub_*).\\n  Production checkout: POST /api/pay/stripe/intent { flowStateId } returns\\n  the Stripe clientSecret — the amount ALWAYS comes from the flow's\\n  amountFormula server-side. Pages must NEVER hard-code amounts or\\n  construct intents themselves; prefer the checkout-flow widget, which\\n  drives start/step/complete for you.\\n- The checkout-flow widget shows a \\\"Completed\\\" element (data-testid\\n  \\\"gw-flow-done\\\") after a successful completion — you may watch for it to\\n  trigger follow-ups (e.g. mounting an order-status island).\\n\\n----------------------------------------------------------------------------\\n10. CART API\\n----------------------------------------------------------------------------\\n- GET /api/cart\\n    -> { items: [{ cmsObjectType, objectId, name, price, qty }],\\n         total, count, cartId }\\n- POST /api/cart { action: 'add'|'update'|'remove'|'clear',\\n                   item: { cmsObjectType, objectId, qty? } }\\n  'remove' and 'clear' take NO qty.\\n- Totals are ALWAYS computed server-side from the stored product price.\\n  Never calculate money client-side.\\n- Identity is automatic (anon gw-cart cookie or logged-in user).\\n- The platform dispatches 'gw:cart-changed' after changes; the built-in\\n  cart widget refreshes itself on it.\\n\\n----------------------------------------------------------------------------\\n11. WIDGETS — READY-MADE ISLANDS (prefer over hand-coding)\\n----------------------------------------------------------------------------\\nEmbed a widget as a div island; config comes from data-gw-config JSON:\\n\\n    \u003cdiv data-gw-app=\\\"menu\\\"\\n         data-gw-config='{\\\"cmsObjectType\\\":\\\"menu-items\\\",\\n                           \\\"folder\\\":\\\"menu\\\",\\\"priceField\\\":\\\"price\\\"}'>\u003c/div>\\n\\n- Attribute quoting: prefer a single-quoted attribute containing JSON with\\n  double-quoted strings (as above). If the config must contain apostrophes,\\n  use a double-quoted attribute and escape inner quotes as &quot;.\\n- Config MUST be valid JSON. No comments, no trailing commas.\\n- The platform mounts islands automatically after your scripts; mounting is\\n  idempotent (no double mounts on SPA re-navigation).\\n- Never nest [data-gw-app] islands inside each other.\\n\\nBuiltin widgets (register as data-gw-app names):\\n  menu             { cmsObjectType (req), folder?, fields?:\\n                     [{field,label}], titleField?='name', priceField?='price',\\n                     addToCart?=true, limit?=50 }\\n                   Lists items via gw.db.query; Add buttons POST /api/cart.\\n  cart             {}   Shows GET /api/cart; refreshes on 'gw:cart-changed'.\\n  checkout-flow    { flowId (req) }  Renders the flow's dataDefinitions\\n                   inputs step by step; Start / Next / \\\"Complete order\\\".\\n  slot-picker      { cmsObjectType (req), folder?, labelField?='label',\\n                     bookedField?='booked', slotField?='id',\\n                     bookOperationId?, limit?=100 }\\n                   With bookOperationId: books via gw.db.operation.\\n                   Without: dispatches 'gw:slot-picked' { slotId, slot }.\\n  seat-map         { cmsObjectType (req), objectId (req),\\n                     rowsField?='rows', seatsField?='seats',\\n                     bookedField?='booked', seatIdField?='id' }\\n                   Loads the object via gw.db.get; renders seat buttons.\\n                   NOTE: seat data must sit at the top level of the object's\\n                   data (the widget has no data-fallback in pick()).\\n  account-dashboard {}   Shows /api/account/profile + /api/account/orders;\\n                   sign-in prompt -> gw.login().\\n  rewards          { cmsObjectType?='rewards', customerField?='customerId',\\n                     pointsField?='points', limit?=50 }\\n                   Requires a logged-in user; filters by user.id.\\n  order-status     { orderId (req), statusField?='status' }\\n                   Reads /api/account/orders + live-updates via\\n                   gw.db.subscribe.\\n  search-box       { cmsObjectType (req), placeholder?, lang?,\\n                     titleField?='name' }\\n                   Debounced GET /api/search?type=...&q=...&lang=...\\n  list             { cmsObjectType (req), folder?, filters?,\\n                     orderBy?, orderDir?: 'asc'|'desc', pageSize? (\u003c=200),\\n                     language?: 'auto'|code, fields?: [{field,label,\\n                     format?: 'date'|'currency'}], emptyText? }\\n                   No-code read list: renders via gw.db.query, every\\n                   value as inert TEXT (textContent — XSS-safe by\\n                   construction), loading/empty/error states, live refresh\\n                   via gw.db.subscribe when pageSize \u003c= 50.\\n\\nCustom islands: in your js, BEFORE or independent of auto-mount:\\n  gw.apps.register('my-gallery', function (ctx) {\\n    var el = ctx.el, config = ctx.config, gw = ctx.gw;\\n    // build UI with textContent / createElement\\n    return function cleanup() { /* remove listeners */ };\\n  });\\n\\n----------------------------------------------------------------------------\\n12. TEMPLATES AND REUSABLE CONTENT (build flexible pages)\\n----------------------------------------------------------------------------\\n12.1 Template pages — /t/\u003ctemplateSlug>/\u003ccontentId>\\n- A template page is a page object whose slug is the template slug and\\n  whose `data.templateContentType` declares the object type supplying the\\n  CONTENT objects. Fallback when missing: the template slug itself is the\\n  content type.\\n- At /t/\u003cT>/\u003ccontentId> the platform fetches the content object:\\n  * content object has its own data.htmlPage.code -> THAT object renders\\n    (its html/css/js AND its SEO section are used);\\n  * otherwise -> the template page's htmlPage renders.\\n- In JS, gw.getPageParams() returns { template, contentId } (plus live\\n  query params). Fetch content fields with\\n  gw.db.get({ cmsObjectType: \u003ccontentType>, objectId: contentId }).\\n- Best practice: LAYOUT lives in the template page (hero, sections, widget\\n  islands); DATA lives in the content objects (fields read via gw.db, e.g.\\n  data.title, data.price). Give a content object its own htmlPage only\\n  when it needs a fully custom layout.\\n- Per-content SEO: put it on the content object's seo section (used only\\n  when the content object renders its own htmlPage); otherwise the\\n  template page's SEO applies.\\n\\n12.2 Email templates (for operation/flow \\\"email\\\" hooks)\\n- An email template is an object in the site app with `data.templateId`\\n  (e.g. \\\"order-confirmation\\\"), html in `data.html` OR\\n  `data.htmlPage.code.html`, optional `data.subject`.\\n- Placeholders use double curly braces {{key}}; the server HTML-ESCAPES\\n  every substituted value — never expect raw html injection.\\n- Emails are REAL emails: a full HTML document is allowed HERE (the\\n  no-document rule applies to page fragments only).\\n- Sent via POST /api/email/send (Section 5) — normally triggered by a CMS\\n  operation/flow hook, not by the page directly. When your\\n  === CMS CONFIG NEEDED === asks for an email hook, also output\\n  === EMAIL TEMPLATE === { templateId, subject, html }.\\n\\n12.3 Reusable sections (data.sections)\\n- A page may carry `data.sections`: an ordered, FLAT list (max 20) of\\n  { cmsObjectType, objectId } references to shared objects whose own\\n  htmlPage.code is composed into the page BEFORE the page's own content.\\n- Sections inside sections are ignored; missing, private or draft section\\n  objects are skipped silently.\\n- Sections contribute html/css/js ONLY — no SEO, no chrome. Editing a\\n  section object updates every page referencing it.\\n- Use for shared strips: promo bars, CTAs, social proof, disclaimer\\n  blocks. Scope each section's CSS under its own wrapper class.\\n\\n12.4 Site chrome (default-header / default-footer)\\n- Same htmlPage.code contract; rendered by the platform on EVERY page,\\n  above/below the page content.\\n- MUST be: pure fragment (no document tags), scoped CSS (own wrapper\\n  class), idempotent + guarded JS, and LIGHT (runs site-wide).\\n- Nav links MUST use \u003ca data-ic-nav-href=\\\"/path\\\" href=\\\"/path\\\"> for SPA\\n  navigation. Keep href for SEO/fallback.\\n- Islands ([data-gw-app]) are allowed but remember they mount on every\\n  page — keep them lightweight (cart icon, search-box).\\n- Language variants: sibling chrome objects by contentId with\\n  meta.language; the platform picks the matching language.\\n\\n12.5 Multi-language pages\\n- In code: branch static text on gw.language, or fetch language-filtered\\n  data (gw.db.query { language: gw.language }; /api/search lang=...).\\n- Generate one page object per language when text differs; all variants\\n  share the same contentId (siblings — see Section 1).\\n\\n----------------------------------------------------------------------------\\n13. PAGE STRUCTURE + COOKBOOK (compose, don't invent)\\n----------------------------------------------------------------------------\\nA) Catalog + cart (no checkout yet):\\n   search-box or the list widget (or gw.db.query list) + menu islands +\\n   cart island.\\n\\nB) Full shop checkout:\\n   menu (addToCart) + cart + checkout-flow {flowId: 'shop-checkout'}.\\n   The flow's done-step operation hook creates the order; after the widget\\n   shows \\\"Completed\\\" you may re-fetch or show order-status.\\n\\nC) Booking / tickets:\\n   slot-picker or seat-map (islands) -> a checkout-flow whose amountFormula\\n   references the chosen values (e.g. 'seats.count * 25') -> done-step\\n   operation hook writes the booking. Page JS may collect\\n   'gw:slot-picked' events into gw.storage and start the flow with them.\\n\\nD) Account area:\\n   Page with data.requireAuth: true + account-dashboard + order-status\\n   islands. Anonymous visitors are redirected to login automatically.\\n\\nE) Static content:\\n   Pure HTML + CSS (+ minimal JS). Still respect Section 3/4 (fragment,\\n   scoped CSS, idempotent JS, no document tags).\\n\\nF) Page structure standards (every generated page):\\n   - one unique root wrapper class on the FIRST element of the fragment;\\n   - semantic landmarks (\u003csection>/\u003carticle>/\u003cnav>); exactly ONE \u003ch1>;\\n     the site-wide header/footer are platform chrome — never duplicate;\\n   - heading order h1 > h2 > h3 with no skips;\\n   - vertical rhythm + colors from theme variables (--gw-color-*);\\n   - mobile-first responsive (flex/grid), no fixed viewport widths;\\n   - buttons as \u003cbutton>, links as \u003ca>; visible focus states;\\n   - images: alt text, width/height, loading=\\\"lazy\\\";\\n   - EVERY data-driven island needs loading / empty / error states.\\n\\nG) Custom search UI (instead of the search-box widget):\\n   Debounce >= 300 ms and call GET /api/search (Section 5); render titles\\n   with textContent; show a \\\"no results\\\" state.\\n\\nH) Custom account UI (instead of account-dashboard):\\n   Call GET /api/account/\u003cresource> (Section 5). On 401 show a sign-in\\n   button calling gw.login().\\n\\nVertical logic (pricing rules, seat layouts, reward math) lives in CMS\\nCONFIG (operations, flows, object data) — the page is UI + configuration.\\nNever hard-code business rules into the page beyond presentation.\\n\\n----------------------------------------------------------------------------\\n14. SEO SECTION (=== SEO ===)\\n----------------------------------------------------------------------------\\nAll fields optional:\\n{\\n  \\\"metaTitle\\\": \\\"...\\\", \\\"metaDesc\\\": \\\"...\\\", \\\"metaRobots\\\": \\\"index, follow\\\",\\n  \\\"canonicalUrl\\\": \\\"https://...\\\", \\\"metaImage\\\": \\\"...\\\", \\\"metaAuthor\\\": \\\"...\\\",\\n  \\\"metaKeywords\\\": \\\"comma, separated\\\",\\n  \\\"ogTitle\\\": \\\"...\\\", \\\"ogDesc\\\": \\\"...\\\", \\\"ogImage\\\": \\\"...\\\", \\\"ogType\\\": \\\"...\\\",\\n  \\\"ogUrl\\\": \\\"...\\\",\\n  \\\"twitterCard\\\": \\\"...\\\", \\\"twitterSite\\\": \\\"...\\\", \\\"twitterTitle\\\": \\\"...\\\",\\n  \\\"twitterCreator\\\": \\\"...\\\", \\\"twitterImage\\\": \\\"...\\\",\\n  \\\"sitemapPriority\\\": \\\"0.8\\\", \\\"sitemapChangefreq\\\": \\\"weekly\\\",\\n  \\\"schemaItems\\\": [\\n    { \\\"id\\\": \\\"opt\\\", \\\"type\\\": \\\"FAQPage\\\",\\n      \\\"json\\\": \\\"{\\\\\\\"@type\\\\\\\":\\\\\\\"FAQPage\\\\\\\",\\\\\\\"mainEntity\\\\\\\":[ ... ]}\\\" }\\n  ],\\n  \\\"aiDescription\\\": \\\"...\\\", \\\"aiEntityType\\\": \\\"...\\\", \\\"aiIntent\\\": \\\"...\\\",\\n  \\\"aiKeyTopics\\\": \\\"...\\\", \\\"aiAudience\\\": \\\"...\\\"\\n}\\n\\nRules:\\n- ogType: only 'website' or 'article' are honored by the metadata layer;\\n  other values are ignored. twitterCard: only 'summary' or\\n  'summary_large_image'.\\n- schemaItems produce JSON-LD. `json` is a JSON STRING of the full\\n  {\\\"@type\\\": ...} payload (never wrap it in \u003cscript>). Missing json ->\\n  bare {\\\"@type\\\": \\\"\u003ctype>\\\"} entry. No schemaItems -> default WebPage.\\n- Use sensible types: WebPage, Product, FAQPage, Organization,\\n  BlogPosting, Event, BreadcrumbList, ...\\n- metaKeywords is a comma-separated string.\\n- metaRobots 'noindex, follow' for gated/requireAuth pages is recommended.\\n- sitemapPriority / sitemapChangefreq feed /sitemap.xml. Keep title\\n  ~60 chars and description ~155 chars (best practice, not enforced).\\n- Canonical/hreflang origin = settings.primaryHost, else request host —\\n  do not hard-code a host unless the user confirms it.\\n\\n----------------------------------------------------------------------------\\n15. THEME / SITE CONTEXT AVAILABLE TO PAGES\\n----------------------------------------------------------------------------\\n- Theme colors from default-settings.theme.colors are exposed as CSS\\n  variables: --gw-color-\u003ckey> (e.g. --gw-color-primary). Custom\\n  theme.cssVariables are exposed as-is. Use them in your CSS instead of\\n  hard-coding brand colors.\\n- default-settings.sharedCss is a site-level stylesheet injected BEFORE\\n  page css (ADMIN-owned). Pages may use its classes.\\n- The platform prepends an auto trace comment to the page container\\n  (\u003c!-- gw-page: ... -->) — platform-owned, never emit your own\\n  GW-PAGE-ID-style comments.\\n- theme.cssClasses are applied to the page shell wrapper — do not style\\n  them blindly; scope your own selectors.\\n- Currency: use gw.formatCurrency (never format money yourself).\\n- Language: gw.language; prefer data-driven text or gw.language checks\\n  over hard-coded locales. Static text should match the page's language.\\n- headCode / bodyStartCode / bodyEndCode / plugins (analytics) are\\n  ADMIN-owned site settings — the generator NEVER emits them.\\n\\n----------------------------------------------------------------------------\\n16. PERFORMANCE, QUALITY AND LIMITS SUMMARY\\n----------------------------------------------------------------------------\\n- Keep css/js small (a few KB to low tens of KB). No heavy dependencies.\\n- Lazy-load images (loading=\\\"lazy\\\", width/height to avoid CLS); use\\n  absolute URLs or site-relative paths for assets.\\n- Reads are rate-limited and cached — batch queries, use pageSize sensibly,\\n  use gw.db.subscribe for live views.\\n- Server rate limits (per IP): data reads 120/min · flows 60/min ·\\n  search 60/min · cart 60/min · email 20/min · pay 20/min · auth 10/min.\\n  Debounce user input, cache in gw.storage, prefer gw.db.subscribe over\\n  polling.\\n- Accessibility and responsiveness follow Section 13 F — both are hard\\n  quality standards.\\n- Forms: required attributes for client checks; server rules may differ —\\n  design for the server error events.\\n- No console noise: never log secrets; keep console output minimal.\\n\\n----------------------------------------------------------------------------\\n17. SELF-CHECK BEFORE RETURNING OUTPUT\\n----------------------------------------------------------------------------\\n[ ] Every HARD GUARDRAIL in Section 4 passes (body fragment only, scoped\\n    CSS, idempotent vanilla JS, no secrets, valid data-gw-config JSON,\\n    honeypots, published status).\\n[ ] Page helpers live on gw.ns, not hoisted window functions.\\n[ ] All writes go through operations/flows/forms/cart; gw.db is read-only.\\n[ ] data.sections (if used) is flat, ordered, and tolerates skipped objects.\\n[ ] gw.forms.bind() called if the page has data-gw-form forms.\\n[ ] User/data content rendered with textContent or gw.sanitize.\\n[ ] SEO section filled (title/description/schema at minimum).\\n[ ] No global nav/header/footer (platform chrome exists).\\n[ ] Missing operation/flow/email-template called out in CMS CONFIG NEEDED.\\n[ ] Template pages declare data.templateContentType; layout vs data split.\\n[ ] Chrome (header/footer) is light, scoped, idempotent, SPA-nav links.\\n[ ] Email templates use {{key}} placeholders (full document allowed there).\\n[ ] Language variants share contentId; text branched on gw.language.\\n\"")

/* ═══════════════════════════════════════════════════════════════════
   CONSTANTS + STATE
   ═══════════════════════════════════════════════════════════════════ */
var SESSION_TYPE = 'ai-chat-sessions-uniconbaseapps';
var CACHE_MSG_LIMIT = 20;          // messages kept in the slim value cache
var SESSION_MSG_LIMIT = 500;       // messages per session document
var APP_CLASS = 'ng-app';

var WRITE_ROLES = ['developer', 'owner', 'admin', 'user-manager', 'editor'];

var DB = null;                     // slim saved value
var _chat = { messages: [], sessionId: '', sessionObj: null, crudOk: null };
var _user = null;
var _readOnly = false;
var _pollTries = 0;
var _pollTimer = null;
var _staged = '';                  // JSON of the last value we staged (echo guard)
var _persistTimer = null;
var _saving = false;
var _currentTab = 'preview';
var _codeTab = 'html';
var _device = 'desktop';
var _genBusy = false;
var _chatBusy = false;
var _stream = null;                // active streaming message state
var _uidCtr = 0;
var _consoleLines = [];
var _briefTimer = null;
var _lastPlanNotes = '';
var _interviewMode = false;

/* ── Color sets (newsroom palettes) — applied to the gallery AND the page ── */
var COLOR_SETS = [
  { id: 'newsprint', label: 'Classic Newsprint', primary: '#1f4e8c', accent: '#b91c1c' },
  { id: 'midnight', label: 'Midnight Desk', primary: '#0f172a', accent: '#e11d48' },
  { id: 'crimson', label: 'Crimson Extra', primary: '#7f1d1d', accent: '#1d4ed8' },
  { id: 'forest', label: 'Forest Edition', primary: '#14532d', accent: '#b45309' },
  { id: 'royal', label: 'Royal Broadsheet', primary: '#312e81', accent: '#d97706' },
  { id: 'ocean', label: 'Ocean Wire', primary: '#0e7490', accent: '#be123c' },
  { id: 'mono', label: 'Monochrome Press', primary: '#111827', accent: '#6b7280' }
];
function colorSetById(id) {
  for (var i = 0; i < COLOR_SETS.length; i++) if (COLOR_SETS[i].id === id) return COLOR_SETS[i];
  return COLOR_SETS[0];
}

/* ── Story archetypes (detected client-side, fed to the AI) ── */
var ARCHETYPES = {
  breaking:      { label: 'Breaking news',   hero: 'breaking',   recipe: 'hero "breaking" + breaking strip + liveblog + ticker + keypoints + faq + share + sources' },
  feature:       { label: 'Feature / longform', hero: 'broadsheet', recipe: 'hero "broadsheet" + byline + standfirst + lead + article + photostory + pull quotes + personcard + related' },
  data:          { label: 'Data story',      hero: 'split',      recipe: 'hero "split" + keyfacts + chart + table + keypoints + infoboxes + sources' },
  sports:        { label: 'Sports report',   hero: 'cover',      recipe: 'hero "cover" or "split" + scorecard + liveblog or timeline + keyfacts + reactions' },
  investigative: { label: 'Investigative',   hero: 'broadsheet', recipe: 'hero "broadsheet" + byline + standfirst + article + factcheck + timeline + keypoints + sources + corrections' },
  event:         { label: 'Event / announcement', hero: 'gradient', recipe: 'hero "gradient" or "cover" + keypoints + countdown + steps + mapcard + cta + share' },
  opinion:       { label: 'Opinion / analysis', hero: 'minimal',  recipe: 'hero "minimal" or "broadsheet" + byline + standfirst + article + poll + reactions + quote' }
};

/* ── One-click starter templates (Phase 1 · B2) ── */
var TEMPLATES = [
  { id: 'breaking', emoji: '🚨', label: 'Breaking live page', hint: 'urgent strip · liveblog · ticker', text: 'JSON REQUIRED. Build a BREAKING live page (archetype: breaking). Use hero "breaking", a breaking strip, liveblog, ticker, keypoints and faq. Keep entries short and timestamps real.' },
  { id: 'feature', emoji: '📰', label: 'Feature longform', hint: 'broadsheet hero · byline · standfirst', text: 'JSON REQUIRED. Build a FEATURE longform page (archetype: feature). Use hero "broadsheet", byline, standfirst, lead, article with subheads and quotes, photostory, personcard and related.' },
  { id: 'data', emoji: '📊', label: 'Data story', hint: 'facts grid · charts · table', text: 'JSON REQUIRED. Build a DATA story page (archetype: data). Use hero "split", keyfacts, chart, table, keypoints and infoboxes driven by the numbers in the brief.' },
  { id: 'sports', emoji: '🏟️', label: 'Sports report', hint: 'scorecard · liveblog · reactions', text: 'JSON REQUIRED. Build a SPORTS report page (archetype: sports). Use hero "cover", scorecard, liveblog or timeline, keyfacts and reactions.' },
  { id: 'investigative', emoji: '🕵️', label: 'Investigative', hint: 'factcheck · timeline · sources', text: 'JSON REQUIRED. Build an INVESTIGATIVE page (archetype: investigative). Use hero "broadsheet", byline, standfirst, article, factcheck, timeline, keypoints, sources and corrections.' },
  { id: 'event', emoji: '🎟️', label: 'Event / announcement', hint: 'countdown · steps · mapcard', text: 'JSON REQUIRED. Build an EVENT page (archetype: event). Use hero "gradient", keypoints, countdown, steps, mapcard and cta.' },
  { id: 'opinion', emoji: '💬', label: 'Opinion / analysis', hint: 'minimal hero · poll · reactions', text: 'JSON REQUIRED. Build an OPINION page (archetype: opinion). Use hero "minimal", byline, standfirst, article, poll and reactions.' }
];

/* ── Pre-flight checklist (Phase 1 · E2) ── */
var CHECKLIST_ITEMS = [
  { id: 'guards', label: 'All guardrail checks pass' },
  { id: 'seo', label: 'SEO score ≥ 80% (scorecard below)' },
  { id: 'credits', label: 'Photos carry captions / credits' },
  { id: 'sources', label: 'Sources & links are listed' },
  { id: 'corrections', label: 'Corrections note added (if amended)' },
  { id: 'review', label: 'Editorial review signed off' }
];

/* ═══════════════════════════════════════════════════════════════════
   SMALL UTILITIES
   ═══════════════════════════════════════════════════════════════════ */
function el(id) { return document.getElementById(id); }

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtTime(iso) {
  try {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var hh = ('0' + d.getHours()).slice(-2);
    var mm = ('0' + d.getMinutes()).slice(-2);
    return hh + ':' + mm;
  } catch (e) { return ''; }
}

function slugify(s) {
  var t = String(s == null ? '' : s);
  try {
    t = t.normalize('NFKD');                      // decompose before stripping marks
    t = t.replace(/[\u0300-\u036f]/g, '');        // remove combining marks FIRST
  } catch (e) {}
  var map = {
    'ı': 'i', 'İ': 'i', 'i': 'i', 'ş': 's', 'Ş': 's', 'ğ': 'g', 'Ğ': 'g',
    'ü': 'u', 'Ü': 'u', 'ö': 'o', 'Ö': 'o', 'ç': 'c', 'Ç': 'c', 'ə': 'e'
  };
  t = t.toLowerCase().replace(/[ışğüöçİŞĞÜÖÇə]/g, function (c) { return map[c] || c; });
  t = t.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!t) t = 'news-story';
  if (t === 'default-settings' || t === 'default-header' || t === 'default-footer') t = 'news-' + t;
  return t;
}

function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }

function safeUrl(u) {
  var s = String(u == null ? '' : u).trim();
  if (!s) return '';
  if (/^(https?:\/\/)/i.test(s)) return s;
  if (s.charAt(0) === '/' || s.charAt(0) === '#') return s;
  return '';
}

function imgSrc(u) {
  var s = String(u == null ? '' : u).trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s) && s.length < 1500) return s;
  return '';
}

function num(v, dflt) {
  var n = parseFloat(v);
  return isFinite(n) ? n : (dflt == null ? 0 : dflt);
}

function str(v, dflt) {
  var s = String(v == null ? '' : v);
  if (s !== '' && s !== 'undefined' && s !== 'null') return s;
  return dflt == null ? '' : dflt;
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function stripSuggests(text) {
  var sugg = [];
  var t = String(text == null ? '' : text);
  var re = /\[\[suggest_[^\]]*\]\]([^\n]*)/g;
  t = t.replace(re, function (m, tail) {
    var label = (tail || '').trim();
    if (label) sugg.push(label);
    return '';
  });
  t = t.replace(/\n{3,}/g, '\n\n').trim();
  return { text: t, suggests: sugg };
}

/* Lenient AI JSON: cut prose/fences around the outermost { … } */
function parseAiJson(text) {
  var s = String(text == null ? '' : text).trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  var a = s.indexOf('{');          // FIRST opening brace
  var b = s.lastIndexOf('}');      // LAST closing brace
  if (a === -1 || b === -1 || b < a) {
    return { ok: false, error: 'No JSON object found in the AI response.' };
  }
  var slice = s.substring(a, b + 1);
  slice = slice.replace(/,\s*([}\]])/g, '$1');          // trailing commas
  slice = slice.replace(/\/\*[\s\S]*?\*\//g, '');       // block comments
  slice = slice.replace(/(^|[^:"\\])\/\/[^\n]*/g, '$1'); // line comments
  try {
    var data = JSON.parse(slice);
    return { ok: true, data: data };
  } catch (e) {
    return { ok: false, error: 'JSON parse error: ' + e.message };
  }
}

/* Allow-list rich text sanitizer (used for AI-supplied article HTML).
   Uses DOMParser when available; falls back to full escaping. */
var SANITIZE_TAGS = {
  P: 1, H2: 1, H3: 1, H4: 1, STRONG: 1, B: 1, EM: 1, I: 1, U: 1, S: 1,
  BR: 1, UL: 1, OL: 1, LI: 1, BLOCKQUOTE: 1, CODE: 1, PRE: 1, SUB: 1, SUP: 1,
  A: 1, IMG: 1, HR: 1, FIGURE: 1, FIGCAPTION: 1, SPAN: 1
};
var SANITIZE_ATTRS = {
  A: { href: 1, title: 1, target: 1, rel: 1 },
  IMG: { src: 1, alt: 1, width: 1, height: 1, loading: 1 },
  FIGCAPTION: {}, SPAN: {}
};
function sanitizeRich(html) {
  var s = String(html == null ? '' : html);
  if (!s) return '';
  var parser = null;
  try { if (typeof DOMParser !== 'undefined') parser = new DOMParser(); } catch (e) {}
  if (!parser) return esc(s);
  var doc;
  try {
    doc = parser.parseFromString('<div>' + s + '</div>', 'text/html');
  } catch (e) { return esc(s); }
  function clean(node, out) {
    var kids = node.childNodes;
    for (var i = 0; i < kids.length; i++) {
      var n = kids[i];
      if (n.nodeType === 3) { out.push(esc(n.nodeValue)); continue; }
      if (n.nodeType !== 1) continue;
      var tag = (n.tagName || '').toUpperCase();
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'IFRAME' ||
          tag === 'OBJECT' || tag === 'EMBED' || tag === 'LINK' || tag === 'META') continue;
      if (tag === 'BR') { out.push('<br>'); continue; }
      if (tag === 'HR') { out.push('<hr>'); continue; }
      if (!SANITIZE_TAGS[tag]) { clean(n, out); continue; }   // unwrap unknown
      var attrs = SANITIZE_ATTRS[tag] || {};
      var astr = '';
      var atts = n.attributes;
      for (var j = 0; atts && j < atts.length; j++) {
        var an = (atts[j].name || '').toLowerCase();
        var av = atts[j].value || '';
        if (an.indexOf('on') === 0 || an === 'style' || an === 'class' || an === 'id') continue;
        if (attrs[an]) {
          if (an === 'href' || an === 'src') {
            var v = safeUrl(av);
            if (!v) continue;
            av = v;
          }
          astr += ' ' + an + '="' + esc(av) + '"';
        }
      }
      if (tag === 'A') {
        var href = (n.getAttribute('href') || '');
        if (!/^(https?:|\/|#)/i.test(href)) continue;
        if (!n.getAttribute('rel')) astr += ' rel="noopener"';
        if (!/^https?:/i.test(href) && n.getAttribute('target') !== '_self') astr = astr.replace(' target="_blank"', '');
      }
      out.push('<' + tag.toLowerCase() + astr + '>');
      clean(n, out);
      out.push('</' + tag.toLowerCase() + '>');
    }
  }
  var out = [];
  clean(doc.body, out);
  return out.join('');
}

function uid(prefix) {
  _uidCtr++;
  return (prefix || 'ng') + '-' + _uidCtr + '-' + Date.now().toString(36);
}

/* ═══════════════════════════════════════════════════════════════════
   COMPONENT LIBRARY
   Each entry: { ai: catalog description, render(data,ctx)->html,
                 css: scoped css string, js: runtime js string (optional) }
   ctx = { esc, slug, uid, lang, srich }
   ═══════════════════════════════════════════════════════════════════ */

function makeCtx(slug) {
  return {
    slug: slug,
    esc: esc,
    uid: function (p) { return uid(p); },
    srich: sanitizeRich,
    link: function (url, inner, extraCls) {
      var u = safeUrl(url);
      if (!u) return '<span class="n-link-dead">' + inner + '</span>';
      var cls = extraCls ? ' class="' + extraCls + '"' : '';
      if (u.charAt(0) === '/') {
        return '<a' + cls + ' data-ic-nav-href="' + esc(u) + '" href="' + esc(u) + '">' + inner + '</a>';
      }
      if (u.charAt(0) === '#') return '<a' + cls + ' href="' + esc(u) + '">' + inner + '</a>';
      return '<a' + cls + ' href="' + esc(u) + '" target="_blank" rel="noopener">' + inner + '</a>';
    },
    img: function (u, alt, extra) {
      var s = imgSrc(u);
      if (!s) return '';
      var a = alt ? ' alt="' + esc(alt) + '"' : ' alt=""';
      var ex = extra ? ' ' + extra : '';
      return '<img src="' + esc(s) + '"' + a + ' loading="lazy"' + ex + '>';
    }
  };
}

var NG_COMPONENTS = {

  /* ── HERO (required, exactly one, the ONLY h1) ── */
  hero: {
    ai: 'REQUIRED — exactly one, placed first. Carries the only <h1>. style: "broadsheet" (classic newspaper: centered serif headline between double rules), "breaking" (urgent banner with pulsing BREAKING badge), "split" (headline left, photo right), "cover" (photo background), "gradient" (bold color wash), "minimal" (centered, no image). Pick by story type: breaking news→"breaking", features/analysis→"broadsheet", photo-led→"cover".',
    render: function (d, c) {
      var style = str(d.style, 'broadsheet');
      if (['split', 'cover', 'gradient', 'minimal', 'broadsheet', 'breaking'].indexOf(style) === -1) style = 'broadsheet';
      var title = str(d.title, '').trim();
      var kicker = str(d.kicker, '');
      var sub = str(d.subtitle, '');
      var img = imgSrc(d.image);
      var alt = str(d.imageAlt, title || 'story image');
      var meta = isObj(d.meta) ? d.meta : {};
      var metaBits = [];
      if (str(meta.date, '')) metaBits.push('<span class="n-hero-m">🕒 ' + esc(str(meta.date)) + '</span>');
      if (str(meta.author, '')) metaBits.push('<span class="n-hero-m">✍️ ' + esc(str(meta.author)) + '</span>');
      if (str(meta.location, '')) metaBits.push('<span class="n-hero-m">📍 ' + esc(str(meta.location)) + '</span>');
      if (str(meta.readingTime, '')) metaBits.push('<span class="n-hero-m">⏱ ' + esc(str(meta.readingTime)) + '</span>');
      if (str(meta.updated, '')) metaBits.push('<span class="n-hero-m">Updated ' + esc(str(meta.updated)) + '</span>');
      var ctas = '';
      if (Array.isArray(d.ctas) && d.ctas.length) {
        ctas = '<div class="n-hero-ctas">' + d.ctas.map(function (b) {
          if (!isObj(b)) return '';
          var cls = b.primary === false ? 'n-btn n-btn-ghost2' : 'n-btn n-btn-primary';
          return c.link(b.url, esc(str(b.label, 'Read more')), cls);
        }).join('') + '</div>';
      }
      var kick = kicker ? '<span class="n-hero-kicker">' + esc(kicker) + '</span>' : '';
      var subEl = sub ? '<p class="n-hero-sub">' + esc(sub) + '</p>' : '';
      var metaEl = metaBits.length ? '<div class="n-hero-meta">' + metaBits.join('') + '</div>' : '';
      var copy = '<div class="n-hero-copy n-reveal">' + kick + '<h1 class="n-hero-title">' + esc(title || 'Untitled story') + '</h1>' + subEl + metaEl + ctas + '</div>';

      /* classic broadsheet — centered serif masthead headline between rules */
      if (style === 'broadsheet') {
        var fig = img
          ? '<figure class="n-hero-media n-hero-media-sheet"><img src="' + esc(img) + '" alt="' + esc(alt) + '" loading="eager" width="1200" height="675">'
            + (str(d.caption, '') ? '<figcaption>' + esc(str(d.caption)) + '</figcaption>' : '') + '</figure>'
          : '';
        return '<section class="n-sec n-hero n-hero-sheet" id="' + c.uid('sec') + '" data-n-anchor data-n-title="' + esc(title) + '"><div class="n-hero-inner">'
          + '<div class="n-hero-rules" aria-hidden="true"></div>'
          + copy + fig
          + '<div class="n-hero-rules" aria-hidden="true"></div></div></section>';
      }

      /* breaking news banner — urgent, dark with pulsing badge */
      if (style === 'breaking') {
        var bg = img
          ? '<div class="n-hero-bg" style="background-image:url(\'' + esc(img).replace(/&#39;/g, '\\&#39;') + '\')" role="img" aria-label="' + esc(alt) + '"></div>'
          : '';
        var badge = '<span class="n-hero-breaking-badge"><i class="n-live-dot" aria-hidden="true"></i>' + esc(str(d.badge, 'BREAKING')) + '</span>';
        return '<section class="n-sec n-hero n-hero-breaking" id="' + c.uid('sec') + '" data-n-anchor data-n-title="' + esc(title) + '">' + bg
          + '<div class="n-hero-inner">' + badge + copy + '</div></section>';
      }

      var media = '';
      if (img && (style === 'split' || style === 'cover')) {
        if (style === 'cover') {
          media = '<div class="n-hero-bg" style="background-image:url(\'' + esc(img).replace(/&#39;/g, '\\&#39;') + '\')" role="img" aria-label="' + esc(alt) + '"></div>';
        } else {
          media = '<figure class="n-hero-media"><img src="' + esc(img) + '" alt="' + esc(alt) + '" loading="eager">'
            + (d.caption ? '<figcaption>' + esc(str(d.caption)) + '</figcaption>' : '') + '</figure>';
        }
      }
      if (style === 'cover') {
        return '<section class="n-sec n-hero n-hero-cover" id="' + c.uid('sec') + '" data-n-anchor data-n-title="' + esc(title) + '">' + media
          + '<div class="n-hero-inner">' + copy + '</div></section>';
      }
      if (style === 'gradient') {
        return '<section class="n-sec n-hero n-hero-grad" id="' + c.uid('sec') + '" data-n-anchor data-n-title="' + esc(title) + '"><div class="n-hero-inner">'
          + '<div class="n-hero-deco n-hero-deco-a"></div><div class="n-hero-deco n-hero-deco-b"></div>' + copy + '</div></section>';
      }
      if (style === 'minimal') {
        return '<section class="n-sec n-hero n-hero-min" id="' + c.uid('sec') + '" data-n-anchor data-n-title="' + esc(title) + '"><div class="n-hero-inner">' + copy + '</div></section>';
      }
      return '<section class="n-sec n-hero n-hero-split" id="' + c.uid('sec') + '" data-n-anchor data-n-title="' + esc(title) + '"><div class="n-hero-inner">'
        + copy + media + '</div></section>';
    },
    css: ''
  },

  /* ── LEAD ── */
  lead: {
    ai: 'A bold intro paragraph with a drop cap. content: { text }. Use right after the hero.',
    render: function (d, c) {
      var t = str(d.text, '').trim();
      if (!t) return '';
      return '<section class="n-sec n-lead" id="' + c.uid('sec') + '"><div class="n-inner"><p class="n-lead-p n-reveal">' + esc(t) + '</p></div></section>';
    },
    css: ''
  },

  /* ── ARTICLE (rich body) ── */
  article: {
    ai: 'The main story body as ordered blocks. block t values: "p" {text}, "h2"/"h3" {text} (auto-anchored for the TOC), "quote" {text,by}, "img" {src,alt,caption}, "ul"/"ol" {items:[..]}, "note" {kind:"info"|"warning"|"success"|"danger",text}, "code" {text}, "html" {html: allow-listed markup}, "divider" {}.',
    render: function (d, c) {
      var blocks = Array.isArray(d.blocks) ? d.blocks : [];
      if (!blocks.length) return '';
      var out = [];
      for (var i = 0; i < blocks.length; i++) {
        var b = blocks[i] || {};
        var t = str(b.t, 'p').toLowerCase();
        if (t === 'p') {
          var pt = sanitizeRich(str(b.text, ''));
          if (pt) out.push('<p class="n-p n-reveal">' + pt + '</p>');
        } else if (t === 'h2') {
          out.push('<h2 class="n-h2 n-reveal" id="' + c.uid('h') + '" data-n-anchor data-n-title="' + esc(str(b.text, '')) + '">' + esc(str(b.text, '')) + '</h2>');
        } else if (t === 'h3') {
          out.push('<h3 class="n-h3 n-reveal" id="' + c.uid('h') + '" data-n-anchor data-n-title="' + esc(str(b.text, '')) + '">' + esc(str(b.text, '')) + '</h3>');
        } else if (t === 'quote') {
          out.push('<blockquote class="n-bq n-reveal"><p>' + esc(str(b.text, '')) + '</p>'
            + (str(b.by, '') ? '<cite>— ' + esc(str(b.by)) + '</cite>' : '') + '</blockquote>');
        } else if (t === 'img') {
          var im = c.img(b.src, str(b.alt, ''), 'width="1200" height="675"');
          if (im) {
            out.push('<figure class="n-fig n-reveal">' + im
              + (str(b.caption, '') ? '<figcaption>' + esc(str(b.caption)) + '</figcaption>' : '') + '</figure>');
          }
        } else if (t === 'ul' || t === 'ol') {
          var items = Array.isArray(b.items) ? b.items : [];
          if (items.length) {
            var tag = t === 'ol' ? 'ol' : 'ul';
            out.push('<' + tag + ' class="n-list n-reveal">' + items.map(function (it) {
              return '<li>' + sanitizeRich(String(it == null ? '' : it)) + '</li>';
            }).join('') + '</' + tag + '>');
          }
        } else if (t === 'note') {
          var k = ['info', 'warning', 'success', 'danger'].indexOf(str(b.kind, 'info')) !== -1 ? str(b.kind, 'info') : 'info';
          out.push('<aside class="n-note n-note-' + k + ' n-reveal" role="note"><span class="n-note-ico">'
            + ({ info: 'ℹ️', warning: '⚠️', success: '✅', danger: '🚨' })[k] + '</span><div>' + sanitizeRich(str(b.text, '')) + '</div></aside>');
        } else if (t === 'code') {
          out.push('<pre class="n-code n-reveal"><code>' + esc(str(b.text, '')) + '</code></pre>');
        } else if (t === 'html') {
          var h = sanitizeRich(str(b.html, ''));
          if (h) out.push('<div class="n-richtext n-reveal">' + h + '</div>');
        } else if (t === 'divider') {
          out.push('<hr class="n-hr">');
        }
      }
      if (!out.length) return '';
      return '<section class="n-sec n-article" id="' + c.uid('sec') + '"><div class="n-inner n-inner-narrow">' + out.join('\n') + '</div></section>';
    },
    css: ''
  },

  /* ── KEY FACTS ── */
  keyfacts: {
    ai: 'Headline numbers as animated stat cards. content: { title, stats: [{ value:number, prefix?, suffix?, label, icon? (emoji) }] }.',
    render: function (d, c) {
      var stats = Array.isArray(d.stats) ? d.stats : [];
      if (!stats.length) return '';
      var head = str(d.title, '') ? '<h2 class="n-sec-title n-reveal">' + esc(str(d.title)) + '</h2>' : '';
      var cards = stats.map(function (s, i) {
        var v = num(s.value, 0);
        var dec = (String(s.value).indexOf('.') !== -1) ? 1 : 0;
        return '<div class="n-stat n-reveal"><div class="n-stat-value-wrap">'
          + '<span class="n-stat-prefix">' + esc(str(s.prefix, '')) + '</span>'
          + '<span class="n-stat-value" data-count="' + v + '" data-dec="' + dec + '">0</span>'
          + '<span class="n-stat-suffix">' + esc(str(s.suffix, '')) + '</span></div>'
          + '<div class="n-stat-label">' + (str(s.icon, '') ? '<span class="n-stat-ico">' + esc(str(s.icon)) + '</span>' : '') + esc(str(s.label, '')) + '</div></div>';
      }).join('');
      return '<section class="n-sec n-facts" id="' + c.uid('sec') + '"><div class="n-inner">' + head + '<div class="n-facts-grid">' + cards + '</div></div></section>';
    },
    css: '',
    js: ''
  },

  /* ── TIMELINE ── */
  timeline: {
    ai: 'Chronological "as it happened" events. content: { title, items: [{ time, title, text, kind:"milestone"|"update"|"quote" }] }. Great for evolving stories.',
    render: function (d, c) {
      var items = Array.isArray(d.items) ? d.items : [];
      if (!items.length) return '';
      var head = str(d.title, '') ? '<h2 class="n-sec-title n-reveal">' + esc(str(d.title)) + '</h2>' : '';
      var rows = items.map(function (it, i) {
        var kind = ['milestone', 'update', 'quote'].indexOf(str(it.kind, 'update')) !== -1 ? str(it.kind) : 'update';
        return '<li class="n-tl-item n-tl-' + kind + ' n-reveal"><span class="n-tl-dot"></span>'
          + '<div class="n-tl-card"><time class="n-tl-time">' + esc(str(it.time, '')) + '</time>'
          + '<h3 class="n-tl-title">' + esc(str(it.title, '')) + '</h3>'
          + (str(it.text, '') ? '<p class="n-tl-text">' + esc(str(it.text)) + '</p>' : '')
          + '</div></li>';
      }).join('');
      return '<section class="n-sec n-timeline" id="' + c.uid('sec') + '"><div class="n-inner n-inner-narrow">' + head + '<ol class="n-tl">' + rows + '</ol></div></section>';
    },
    css: ''
  },

  /* ── QUOTE ── */
  quote: {
    ai: 'A dramatic pull quote. content: { text, by, role?, image? (portrait URL) }.',
    render: function (d, c) {
      var t = str(d.text, '').trim();
      if (!t) return '';
      var img = imgSrc(d.image);
      var media = img ? '<div class="n-quote-avatar"><img src="' + esc(img) + '" alt="' + esc(str(d.by, 'quote author')) + '" loading="lazy"></div>' : '';
      return '<section class="n-sec n-quote" id="' + c.uid('sec') + '"><div class="n-inner n-inner-narrow"><figure class="n-quote-fig n-reveal">'
        + '<div class="n-quote-mark">“</div><blockquote class="n-quote-txt">' + esc(t) + '</blockquote>'
        + (str(d.by, '') ? '<figcaption class="n-quote-by">' + media + '<div><strong>' + esc(str(d.by)) + '</strong>'
          + (str(d.role, '') ? '<span>' + esc(str(d.role)) + '</span>' : '') + '</div></figcaption>' : '')
        + '</figure></div></section>';
    },
    css: ''
  },

  /* ── GALLERY ── */
  gallery: {
    ai: 'Visual story grid with a lightbox. content: { title, cols: 2|3|4, images: [{ src, alt, caption }] }.',
    render: function (d, c) {
      var imgs = Array.isArray(d.images) ? d.images : [];
      if (!imgs.length) return '';
      var cols = [2, 3, 4].indexOf(num(d.cols, 3)) !== -1 ? num(d.cols, 3) : 3;
      var head = str(d.title, '') ? '<h2 class="n-sec-title n-reveal">' + esc(str(d.title)) + '</h2>' : '';
      var items = imgs.map(function (g, i) {
        var src = imgSrc(g.src);
        if (!src) return '';
        return '<button class="n-gal-item n-reveal" type="button" data-gal="' + i + '">'
          + '<img src="' + esc(src) + '" alt="' + esc(str(g.alt, 'gallery image')) + '" loading="lazy" width="800" height="600">'
          + (str(g.caption, '') ? '<span class="n-gal-cap">' + esc(str(g.caption)) + '</span>' : '')
          + '</button>';
      }).join('');
      if (!items) return '';
      return '<section class="n-sec n-gallery" id="' + c.uid('sec') + '"><div class="n-inner">' + head
        + '<div class="n-gal-grid n-gal-cols-' + cols + '">' + items + '</div></div></section>';
    },
    css: '',
    js: ''
  },

  /* ── FAQ ── */
  faq: {
    ai: 'Accordion Q&A (native details, styled). content: { title, items: [{ q, a }] }. Good for "what we know so far".',
    render: function (d, c) {
      var items = Array.isArray(d.items) ? d.items : [];
      if (!items.length) return '';
      var head = str(d.title, '') ? '<h2 class="n-sec-title n-reveal">' + esc(str(d.title)) + '</h2>' : '';
      var rows = items.map(function (it) {
        return '<details class="n-faq-item n-reveal"><summary>' + esc(str(it.q, ''))
          + '<span class="n-faq-caret" aria-hidden="true">▾</span></summary>'
          + '<div class="n-faq-a">' + sanitizeRich(str(it.a, '')) + '</div></details>';
      }).join('');
      return '<section class="n-sec n-faq" id="' + c.uid('sec') + '"><div class="n-inner n-inner-narrow">' + head + '<div class="n-faq-list">' + rows + '</div></div></section>';
    },
    css: ''
  },

  /* ── POLL ── */
  poll: {
    ai: 'Interactive opinion poll (votes stored in the visitor browser via gw.storage — presentation only). content: { question, options: [..], note? }.',
    render: function (d, c) {
      var opts = Array.isArray(d.options) ? d.options : [];
      if (!opts.length) return '';
      var key = 'ng-poll-' + c.slug + '-' + c.uid('p');
      var btns = opts.map(function (o, i) {
        return '<button class="n-poll-opt" type="button" data-poll-opt="' + i + '"><span class="n-poll-bar"></span>'
          + '<span class="n-poll-label">' + esc(String(o)) + '</span><span class="n-poll-pct"></span></button>';
      }).join('');
      return '<section class="n-sec n-poll" id="' + c.uid('sec') + '"><div class="n-inner n-inner-narrow">'
        + '<div class="n-poll-card n-reveal" data-poll-key="' + key + '">'
        + '<h2 class="n-poll-q">📊 ' + esc(str(d.question, 'What do you think?')) + '</h2>'
        + '<div class="n-poll-opts">' + btns + '</div>'
        + '<p class="n-poll-note">' + esc(str(d.note, 'Votes are saved in your browser for this demo.')) + '</p>'
        + '</div></div></section>';
    },
    css: '',
    js: ''
  },

  /* ── REACTIONS ── */
  reactions: {
    ai: 'Emoji reaction row. content: { title?, emojis: [..], operationId?, aggregate? } — default emojis ["👍","❤️","🔥","😮","😢","👏"]. With operationId, clicks run a CMS operation (id + {emoji}) and totals are aggregated server-side instead of per-visitor storage.',
    render: function (d, c) {
      var ems = Array.isArray(d.emojis) && d.emojis.length ? d.emojis : ['👍', '❤️', '🔥', '😮', '😢', '👏'];
      var key = 'ng-react-' + c.slug;
      var op = str(d.operationId, '');
      var btns = ems.map(function (e) {
        return '<button class="n-react-btn" type="button" data-react="' + esc(String(e)) + '"><span class="n-react-emoji">' + esc(String(e)) + '</span><span class="n-react-count">0</span></button>';
      }).join('');
      return '<section class="n-sec n-reactions" id="' + c.uid('sec') + '"><div class="n-inner n-inner-narrow">'
        + '<div class="n-react-card n-reveal" data-react-key="' + key + '"' + (op ? ' data-react-op="' + esc(op) + '"' : '') + '>'
        + (str(d.title, '') ? '<span class="n-react-title">' + esc(str(d.title)) + '</span>' : '<span class="n-react-title">How does this story make you feel?</span>')
        + '<div class="n-react-row">' + btns + '</div></div></div></section>';
    },
    css: '',
    js: ''
  },

  /* ── SHARE ── */
  share: {
    ai: 'Social share buttons. content: { title?, text? (share text) }. Share URLs are built at runtime from the page URL.',
    render: function (d, c) {
      var text = str(d.text, '');
      return '<section class="n-sec n-share" id="' + c.uid('sec') + '"><div class="n-inner n-inner-narrow">'
        + '<div class="n-share-card n-reveal" data-share-text="' + esc(text) + '">'
        + '<span class="n-share-title">' + esc(str(d.title, 'Share this story')) + '</span>'
        + '<div class="n-share-row">'
        + '<a class="n-share-btn" data-share="x" href="#" role="button" aria-label="Share on X">𝕏</a>'
        + '<a class="n-share-btn" data-share="facebook" href="#" role="button" aria-label="Share on Facebook">f</a>'
        + '<a class="n-share-btn" data-share="linkedin" href="#" role="button" aria-label="Share on LinkedIn">in</a>'
        + '<a class="n-share-btn" data-share="whatsapp" href="#" role="button" aria-label="Share on WhatsApp">✆</a>'
        + '<button class="n-share-btn n-share-copy" type="button" data-share="copy" aria-label="Copy link">🔗</button>'
        + '</div></div></div></section>';
    },
    css: '',
    js: ''
  },

  /* ── READING PROGRESS ── */
  progress: {
    ai: 'Reading progress bar pinned to the top of the page. content: {} (no fields). Use once.',
    render: function (d, c) {
      return '<div class="n-progress" aria-hidden="true"><span class="n-progress-bar"></span></div>';
    },
    css: '',
    js: ''
  },

  /* ── TOC ── */
  toc: {
    ai: 'Auto-generated table of contents from the story headings (h2/h3), with scroll-spy highlighting. content: { title? }. Place after the hero.',
    render: function (d, c) {
      return '<section class="n-sec n-toc" id="' + c.uid('sec') + '"><div class="n-inner n-inner-narrow">'
        + '<nav class="n-toc-card n-reveal" aria-label="Table of contents">'
        + '<span class="n-toc-title">' + esc(str(d.title, 'In this story')) + '</span>'
        + '<ul class="n-toc-list"></ul></nav></div></section>';
    },
    css: '',
    js: ''
  },

  /* ── TICKER ── */
  ticker: {
    ai: 'Scrolling breaking-news ticker (CSS animation, respects reduced motion). content: { label?, items: [..] }.',
    render: function (d, c) {
      var items = Array.isArray(d.items) ? d.items : [];
      if (!items.length) return '';
      var content = items.map(function (t) { return '<span class="n-ticker-item">' + esc(String(t)) + '</span>'; }).join('<span class="n-ticker-sep">✦</span>');
      return '<div class="n-ticker" aria-label="Breaking news ticker">'
        + '<span class="n-ticker-label">' + esc(str(d.label, 'LIVE')) + '</span>'
        + '<div class="n-ticker-viewport"><div class="n-ticker-track">' + content + '</div>'
        + '<div class="n-ticker-track n-ticker-dupe" aria-hidden="true">' + content + '</div></div></div>';
    },
    css: ''
  },

  /* ── RELATED ── */
  related: {
    ai: 'Related / follow-up story cards. content: { title, items: [{ title, url, image?, tag? }] }. Use internal paths like "/city" for SPA navigation or full URLs.',
    render: function (d, c) {
      var items = Array.isArray(d.items) ? d.items : [];
      if (!items.length) return '';
      var head = str(d.title, '') ? '<h2 class="n-sec-title n-reveal">' + esc(str(d.title)) + '</h2>' : '';
      var cards = items.map(function (it) {
        var img = imgSrc(it.image);
        return '<a class="n-rel-card n-reveal" ' + linkHrefAttrs(it.url) + '>'
          + (img ? '<span class="n-rel-media"><img src="' + esc(img) + '" alt="" loading="lazy" width="400" height="260"></span>' : '')
          + '<span class="n-rel-body">' + (str(it.tag, '') ? '<span class="n-rel-tag">' + esc(str(it.tag)) + '</span>' : '')
          + '<span class="n-rel-title">' + esc(str(it.title, 'Related story')) + '</span><span class="n-rel-arrow">→</span></span></a>';
      }).join('');
      return '<section class="n-sec n-related" id="' + c.uid('sec') + '"><div class="n-inner">' + head + '<div class="n-rel-grid">' + cards + '</div></div></section>';
    },
    css: ''
  },

  /* ── SOURCES ── */
  sources: {
    ai: 'Transparency box listing sources and links. content: { title?, items: [{ name, url, note? }] }.',
    render: function (d, c) {
      var items = Array.isArray(d.items) ? d.items : [];
      if (!items.length) return '';
      var rows = items.map(function (it) {
        var u = safeUrl(it.url);
        var inner = '<strong>' + esc(str(it.name, 'Source')) + '</strong>' + (str(it.note, '') ? ' — ' + esc(str(it.note)) : '');
        return '<li>' + (u ? c.link(u, inner) : '<span>' + inner + '</span>') + '</li>';
      }).join('');
      return '<section class="n-sec n-sources" id="' + c.uid('sec') + '"><div class="n-inner n-inner-narrow">'
        + '<div class="n-sources-card n-reveal"><h2 class="n-sources-title">' + esc(str(d.title, 'Sources & further reading')) + '</h2>'
        + '<ul class="n-sources-list">' + rows + '</ul></div></div></section>';
    },
    css: ''
  },

  /* ── CTA ── */
  cta: {
    ai: 'Action banner. content: { title, text, button: { label, url }, kind: "subscribe"|"donate"|"event"|"contact"|"default" }.',
    render: function (d, c) {
      var t = str(d.title, '').trim();
      var b = isObj(d.button) ? d.button : {};
      var btn = str(b.label, '') ? c.link(b.url, esc(str(b.label)), 'n-btn n-btn-accent') : '';
      var kind = str(d.kind, 'default');
      var ico = { subscribe: '📬', donate: '💛', event: '📅', contact: '✉️', default: '📣' }[kind] || '📣';
      return '<section class="n-sec n-cta" id="' + c.uid('sec') + '"><div class="n-inner">'
        + '<div class="n-cta-card n-cta-' + esc(kind) + ' n-reveal"><span class="n-cta-ico">' + ico + '</span>'
        + '<div class="n-cta-copy"><h2 class="n-cta-title">' + esc(t || 'Stay informed') + '</h2>'
        + (str(d.text, '') ? '<p class="n-cta-text">' + esc(str(d.text)) + '</p>' : '') + '</div>'
        + (btn ? '<div class="n-cta-btn-wrap">' + btn + '</div>' : '')
        + '</div></div></section>';
    },
    css: ''
  },

  /* ── CHART ── */
  chart: {
    ai: 'Canvas chart drawn in vanilla JS (no libraries). content: { title, type: "bar"|"line"|"donut", labels: [..], series: [{ label, data: [..], color? }], unit?, source? }. Perfect for data-driven news.',
    render: function (d, c) {
      var labels = Array.isArray(d.labels) ? d.labels : [];
      var series = Array.isArray(d.series) ? d.series : [];
      if (!labels.length || !series.length) return '';
      var cfg = {
        type: ['bar', 'line', 'donut'].indexOf(str(d.type, 'bar')) !== -1 ? str(d.type) : 'bar',
        labels: labels, series: series, unit: str(d.unit, ''), source: str(d.source, '')
      };
      return '<section class="n-sec n-chart" id="' + c.uid('sec') + '"><div class="n-inner">'
        + '<div class="n-chart-card n-reveal"><h2 class="n-chart-title">' + esc(str(d.title, '')) + '</h2>'
        + (isObj(d.compare) && str(d.compare.label, '') ? '<button class="n-chart-toggle" type="button" data-chart-toggle data-chart-next="' + esc(str(d.compare.label)) + '">' + esc(str(d.title, 'Compare')) + '</button>' : '')
        + '<div class="n-chart-canvas-wrap"><canvas class="n-chart-canvas" data-chart="' + esc(JSON.stringify(cfg)) + '"' + (isObj(d.compare) ? ' data-chart2="' + esc(JSON.stringify({ type: cfg.type, labels: d.compare.labels || labels, series: d.compare.series || series, unit: cfg.unit, source: cfg.source })) + '"' : '') + ' role="img" aria-label="' + esc(str(d.title, 'chart')) + '"></canvas></div>'
        + (str(d.source, '') ? '<p class="n-chart-source">Source: ' + esc(str(d.source)) + '</p>' : '')
        + '</div></div></section>';
    },
    css: '',
    js: ''
  },

  /* ── COMPARE (before/after) ── */
  compare: {
    ai: 'Before/after image comparison slider. content: { title?, before: { src, alt, label }, after: { src, alt, label } }.',
    render: function (d, c) {
      var b = isObj(d.before) ? d.before : {};
      var a = isObj(d.after) ? d.after : {};
      var bs = imgSrc(b.src);
      var as = imgSrc(a.src);
      if (!bs || !as) return '';
      return '<section class="n-sec n-compare" id="' + c.uid('sec') + '"><div class="n-inner n-inner-narrow">'
        + (str(d.title, '') ? '<h2 class="n-sec-title n-reveal">' + esc(str(d.title)) + '</h2>' : '')
        + '<figure class="n-cmp n-reveal" data-cmp>'
        + '<div class="n-cmp-stage">'
        + '<img class="n-cmp-after" src="' + esc(as) + '" alt="' + esc(str(a.alt, 'after')) + '" loading="lazy" width="1200" height="750">'
        + '<div class="n-cmp-before-wrap"><img class="n-cmp-before" src="' + esc(bs) + '" alt="' + esc(str(b.alt, 'before')) + '" loading="lazy" width="1200" height="750"></div>'
        + '<div class="n-cmp-handle" role="slider" tabindex="0" aria-label="Drag to compare before and after" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50"><span class="n-cmp-grip">⇔</span></div>'
        + '<span class="n-cmp-tag n-cmp-tag-b">' + esc(str(b.label, 'Before')) + '</span>'
        + '<span class="n-cmp-tag n-cmp-tag-a">' + esc(str(a.label, 'After')) + '</span>'
        + '</div><figcaption class="n-cmp-cap">' + esc(str(d.caption, '')) + '</figcaption></figure>'
        + '</div></section>';
    },
    css: '',
    js: ''
  },

  /* ── COUNTDOWN ── */
  countdown: {
    ai: 'Live countdown to an event moment. content: { title, target: "2026-12-31T20:00:00Z", labels?: {d,h,m,s}, note?, ended? }.',
    render: function (d, c) {
      var target = str(d.target, '');
      if (!target) return '';
      var L = isObj(d.labels) ? d.labels : {};
      var cells = [['d', str(L.d, 'Days')], ['h', str(L.h, 'Hours')], ['m', str(L.m, 'Minutes')], ['s', str(L.s, 'Seconds')]];
      var boxes = cells.map(function (p) {
        return '<div class="n-cd-cell"><span class="n-cd-num" data-cd="' + p[0] + '">00</span><span class="n-cd-label">' + esc(p[1]) + '</span></div>';
      }).join('');
      return '<section class="n-sec n-countdown" id="' + c.uid('sec') + '"><div class="n-inner n-inner-narrow">'
        + '<div class="n-cd-card n-reveal" data-cd-target="' + esc(target) + '" data-cd-ended="' + esc(str(d.ended, '')) + '">'
        + '<h2 class="n-cd-title">' + esc(str(d.title, 'Counting down')) + '</h2><div class="n-cd-row">' + boxes + '</div>'
        + (str(d.note, '') ? '<p class="n-cd-note">' + esc(str(d.note)) + '</p>' : '')
        + '<p class="n-cd-ended" hidden>' + esc(str(d.ended, 'It happened — read the story above.')) + '</p>'
        + '</div></div></section>';
    },
    css: '',
    js: ''
  },

  /* ── TABS ── */
  tabs: {
    ai: 'Tabbed panels, each holding article blocks. content: { title?, tabs: [{ title, blocks: [same as article blocks] }] }.',
    render: function (d, c) {
      var tabs = Array.isArray(d.tabs) ? d.tabs : [];
      if (!tabs.length) return '';
      var head = str(d.title, '') ? '<h2 class="n-sec-title n-reveal">' + esc(str(d.title)) + '</h2>' : '';
      var btns = tabs.map(function (t, i) {
        return '<button class="n-tabs-btn' + (i === 0 ? ' active' : '') + '" type="button" data-tab-idx="' + i + '" role="tab" aria-selected="' + (i === 0 ? 'true' : 'false') + '">' + esc(str(t.title, 'Tab ' + (i + 1))) + '</button>';
      }).join('');
      var panels = tabs.map(function (t, i) {
        var inner = renderArticleBlocks(t.blocks || [], c);
        return '<div class="n-tabs-panel' + (i === 0 ? ' active' : '') + '" data-panel-idx="' + i + '" role="tabpanel">' + inner + '</div>';
      }).join('');
      return '<section class="n-sec n-tabssec" id="' + c.uid('sec') + '"><div class="n-inner">' + head
        + '<div class="n-tabs" role="tablist">' + btns + '</div><div class="n-tabs-panels">' + panels + '</div></div></section>';
    },
    css: ''
  },

  /* ── TABLE ── */
  table: {
    ai: 'Responsive data table. content: { title?, caption?, head: [..], rows: [[..],..], source? }.',
    render: function (d, c) {
      var rows = Array.isArray(d.rows) ? d.rows : [];
      if (!rows.length) return '';
      var head = Array.isArray(d.head) && d.head.length
        ? '<thead><tr>' + d.head.map(function (h) { return '<th scope="col">' + esc(String(h)) + '</th>'; }).join('') + '</tr></thead>' : '';
      var body = '<tbody>' + rows.map(function (r) {
        return '<tr>' + (Array.isArray(r) ? r : []).map(function (cell) { return '<td>' + esc(String(cell)) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody>';
      return '<section class="n-sec n-table" id="' + c.uid('sec') + '"><div class="n-inner n-inner-narrow">'
        + (str(d.title, '') ? '<h2 class="n-sec-title n-reveal">' + esc(str(d.title)) + '</h2>' : '')
        + '<figure class="n-table-card n-reveal"><div class="n-table-scroll"><table class="n-table-el">'
        + (str(d.caption, '') ? '<caption>' + esc(str(d.caption)) + '</caption>' : '')
        + head + body + '</table></div>'
        + (str(d.source, '') ? '<figcaption class="n-chart-source">Source: ' + esc(str(d.source)) + '</figcaption>' : '')
        + '</figure></div></section>';
    },
    css: ''
  },

  /* ── VIDEO ── */
  video: {
    ai: 'Native HTML5 video player. content: { title?, src (mp4 URL), poster?, caption? }.',
    render: function (d, c) {
      var src = imgSrc(d.src);   // http(s) only
      if (!src) return '';
      return '<section class="n-sec n-video" id="' + c.uid('sec') + '"><div class="n-inner n-inner-narrow">'
        + (str(d.title, '') ? '<h2 class="n-sec-title n-reveal">' + esc(str(d.title)) + '</h2>' : '')
        + '<figure class="n-video-fig n-reveal"><video class="n-video-el" controls preload="metadata"'
        + (imgSrc(d.poster) ? ' poster="' + esc(imgSrc(d.poster)) + '"' : '')
        + '><source src="' + esc(src) + '" type="video/mp4">Your browser does not support video playback.</video>'
        + (str(d.caption, '') ? '<figcaption>' + esc(str(d.caption)) + '</figcaption>' : '')
        + '</figure></div></section>';
    },
    css: ''
  },

  /* ── AUDIO ── */
  audio: {
    ai: 'Native audio player (interviews, statements). content: { title?, src (mp3 URL), caption? }.',
    render: function (d, c) {
      var src = imgSrc(d.src);
      if (!src) return '';
      return '<section class="n-sec n-audio" id="' + c.uid('sec') + '"><div class="n-inner n-inner-narrow">'
        + '<figure class="n-audio-fig n-reveal">'
        + (str(d.title, '') ? '<figcaption class="n-audio-title">🎧 ' + esc(str(d.title)) + '</figcaption>' : '')
        + '<audio class="n-audio-el" controls preload="metadata"><source src="' + esc(src) + '" type="audio/mpeg">Your browser does not support audio playback.</audio>'
        + (str(d.caption, '') ? '<figcaption class="n-audio-cap">' + esc(str(d.caption)) + '</figcaption>' : '')
        + '</figure></div></section>';
    },
    css: ''
  },

  /* ── INFOBOX ── */
  infobox: {
    ai: 'Highlighted callout box. content: { kind: "info"|"warning"|"success"|"danger", title?, text }.',
    render: function (d, c) {
      var k = ['info', 'warning', 'success', 'danger'].indexOf(str(d.kind, 'info')) !== -1 ? str(d.kind) : 'info';
      return '<section class="n-sec n-infobox" id="' + c.uid('sec') + '"><div class="n-inner n-inner-narrow">'
        + '<aside class="n-ibox n-ibox-' + k + ' n-reveal" role="note">'
        + (str(d.title, '') ? '<strong class="n-ibox-title">' + esc(str(d.title)) + '</strong>' : '')
        + '<div class="n-ibox-text">' + sanitizeRich(str(d.text, '')) + '</div></aside></div></section>';
    },
    css: ''
  },

  /* ── STEPS ── */
  steps: {
    ai: 'Numbered "how it happened / what happens next" steps. content: { title?, items: [{ title, text, icon? (emoji) }] }.',
    render: function (d, c) {
      var items = Array.isArray(d.items) ? d.items : [];
      if (!items.length) return '';
      var head = str(d.title, '') ? '<h2 class="n-sec-title n-reveal">' + esc(str(d.title)) + '</h2>' : '';
      var rows = items.map(function (it, i) {
        return '<li class="n-step n-reveal"><span class="n-step-num">' + (i + 1) + '</span>'
          + '<div class="n-step-body"><h3 class="n-step-title">' + (str(it.icon, '') ? esc(str(it.icon)) + ' ' : '') + esc(str(it.title, '')) + '</h3>'
          + (str(it.text, '') ? '<p class="n-step-text">' + esc(str(it.text)) + '</p>' : '') + '</div></li>';
      }).join('');
      return '<section class="n-sec n-steps" id="' + c.uid('sec') + '"><div class="n-inner n-inner-narrow">' + head + '<ol class="n-steps-list">' + rows + '</ol></div></section>';
    },
    css: ''
  },

  /* ── MAPCARD (stylized location) ── */
  mapcard: {
    ai: 'Stylized location card (no external map embeds). content: { title?, place, address, region?, note?, image? }.',
    render: function (d, c) {
      var img = imgSrc(d.image);
      return '<section class="n-sec n-map" id="' + c.uid('sec') + '"><div class="n-inner n-inner-narrow">'
        + '<div class="n-map-card n-reveal">'
        + (img ? '<div class="n-map-media"><img src="' + esc(img) + '" alt="' + esc(str(d.place, 'map')) + '" loading="lazy" width="640" height="400"></div>' : '')
        + '<div class="n-map-body"><span class="n-map-pin">📍</span>'
        + (str(d.title, '') ? '<span class="n-map-kicker">' + esc(str(d.title)) + '</span>' : '')
        + '<h2 class="n-map-place">' + esc(str(d.place, '')) + '</h2>'
        + (str(d.address, '') ? '<p class="n-map-address">' + esc(str(d.address)) + '</p>' : '')
        + (str(d.region, '') ? '<p class="n-map-region">' + esc(str(d.region)) + '</p>' : '')
        + (str(d.note, '') ? '<p class="n-map-note">' + esc(str(d.note)) + '</p>' : '')
        + '</div></div></div></section>';
    },
    css: ''
  },

  /* ── TAGS ── */
  tags: {
    ai: 'Topic tag chips. content: { title?, tags: [..] }.',
    render: function (d, c) {
      var tags = Array.isArray(d.tags) ? d.tags : [];
      if (!tags.length) return '';
      var chips = tags.map(function (t) { return '<span class="n-tag">#' + esc(String(t).replace(/^#/, '')) + '</span>'; }).join('');
      return '<section class="n-sec n-tagssec" id="' + c.uid('sec') + '"><div class="n-inner n-inner-narrow">'
        + '<div class="n-tags-row n-reveal">' + (str(d.title, '') ? '<span class="n-tags-title">' + esc(str(d.title)) + '</span>' : '') + chips + '</div></div></section>';
    },
    css: ''
  },

  /* ── AUTHOR CARD ── */
  authorcard: {
    ai: 'Author / editor bio card. content: { name, role?, bio?, avatar? (URL), links?: [{ label, url }] }.',
    render: function (d, c) {
      var av = imgSrc(d.avatar);
      var links = Array.isArray(d.links) ? d.links.map(function (l) {
        return c.link(l.url, esc(str(l.label, 'link')), 'n-author-link');
      }).join('') : '';
      return '<section class="n-sec n-author" id="' + c.uid('sec') + '"><div class="n-inner n-inner-narrow">'
        + '<div class="n-author-card n-reveal">'
        + (av ? '<img class="n-author-avatar" src="' + esc(av) + '" alt="' + esc(str(d.name, 'author')) + '" loading="lazy" width="96" height="96">'
          : '<span class="n-author-avatar n-author-avatar-txt">' + esc(String(str(d.name, 'A')).charAt(0).toUpperCase()) + '</span>')
        + '<div class="n-author-body"><strong class="n-author-name">' + esc(str(d.name, 'Newsroom')) + '</strong>'
        + (str(d.role, '') ? '<span class="n-author-role">' + esc(str(d.role)) + '</span>' : '')
        + (str(d.bio, '') ? '<p class="n-author-bio">' + esc(str(d.bio)) + '</p>' : '')
        + (links ? '<div class="n-author-links">' + links + '</div>' : '')
        + '</div></div></div></section>';
    },
    css: ''
  },

  /* ── DIVIDER ── */
  divider: {
    ai: 'Decorative section divider. content: { icon? (emoji), label? }.',
    render: function (d, c) {
      var inner = (str(d.icon, '') || str(d.label, ''))
        ? (str(d.icon, '') ? '<span class="n-div-ico">' + esc(str(d.icon)) + '</span>' : '')
          + (str(d.label, '') ? '<span class="n-div-label">' + esc(str(d.label)) + '</span>' : '')
        : '';
      return '<div class="n-divider" aria-hidden="true"><span class="n-div-line"></span>' + inner + '<span class="n-div-line"></span></div>';
    },
    css: ''
  },

  /* ── WIDGET ISLAND ── */
  widget: {
    ai: 'Platform widget island (data-gw-app). Builtin names: menu, cart, checkout-flow, slot-picker, seat-map, account-dashboard, rewards, order-status, search-box, list. content: { name, config: {} (valid JSON per widget docs), note? }. Use for listings, bookings, live data. Needs CMS-side config if widgets require it (see === CMS CONFIG NEEDED === note).',
    render: function (d, c) {
      var name = str(d.name, '');
      if (!name || !/^[a-z0-9-]+$/.test(name)) return '';
      var cfg = isObj(d.config) ? d.config : {};
      var cfgJson;
      try { cfgJson = JSON.stringify(cfg); } catch (e) { cfgJson = '{}'; }
      return '<section class="n-sec n-widget" id="' + c.uid('sec') + '"><div class="n-inner">'
        + '<div data-gw-app="' + esc(name) + '" data-gw-config=\'' + esc(cfgJson).replace(/'/g, '&#39;') + '\'>'
        + '<div class="n-widget-note">' + esc(str(d.note, 'Loading ' + name + '…')) + '</div>'
        + '</div></div></section>';
    },
    css: ''
  },

  /* ── BYLINE (newsroom signature) ── */
  byline: {
    ai: 'Newsroom byline + dateline row, right after the hero. content: { name, role?, avatar?, location?, date?, updated?, readingTime? }. Renders "By NAME · ROLE" and "LOCATION — date · updated · X min read" in classic news style.',
    render: function (d, c) {
      var av = imgSrc(d.avatar);
      var metaBits = [];
      if (str(d.location, '')) metaBits.push('<span class="n-byline-dateline">' + esc(str(d.location)).toUpperCase() + ' —</span>');
      if (str(d.date, '')) metaBits.push('<span>' + esc(str(d.date)) + '</span>');
      if (str(d.updated, '')) metaBits.push('<span>Updated ' + esc(str(d.updated)) + '</span>');
      if (str(d.readingTime, '')) metaBits.push('<span>' + esc(str(d.readingTime)) + '</span>');
      return '<section class="n-sec n-byline" id="' + c.uid('sec') + '"><div class="n-inner n-inner-narrow">'
        + '<div class="n-byline-row n-reveal">'
        + (av ? '<img class="n-byline-avatar" src="' + esc(av) + '" alt="' + esc(str(d.name, 'author')) + '" loading="lazy" width="56" height="56">'
          : '<span class="n-byline-avatar n-byline-avatar-txt">' + esc(String(str(d.name, 'N')).charAt(0).toUpperCase()) + '</span>')
        + '<div class="n-byline-info">'
        + '<span class="n-byline-by">By <strong>' + esc(str(d.name, 'Newsroom')) + '</strong>'
        + (str(d.role, '') ? '<span class="n-byline-role">' + esc(str(d.role)) + '</span>' : '') + '</span>'
        + '<span class="n-byline-meta">' + metaBits.join('<i class="n-meta-sep">·</i>') + '</span>'
        + '</div>'
        + (d.listen !== false ? '<button class="n-listen-btn" type="button" data-listen aria-label="Listen to this story">🔊 Listen</button>' : '')
        + '</div></div></section>';
    },
    css: ''
  },

  /* ── STANDFIRST (news deck) ── */
  standfirst: {
    ai: 'The standfirst/deck — 1-2 sentences under the headline that sell the story before the lede. content: { text }. Use after the hero (or after byline).',
    render: function (d, c) {
      var t = str(d.text, '').trim();
      if (!t) return '';
      return '<section class="n-sec n-standfirst" id="' + c.uid('sec') + '"><div class="n-inner n-inner-narrow"><p class="n-standfirst-p n-reveal">' + esc(t) + '</p></div></section>';
    },
    css: ''
  },

  /* ── BREAKING STRIP ── */
  breaking: {
    ai: 'Urgent breaking strip (dark/red with pulsing dot) for flash updates. content: { label?, text, time? }. Use at the very top for developing stories.',
    render: function (d, c) {
      var t = str(d.text, '').trim();
      if (!t) return '';
      return '<div class="n-breaking n-reveal" role="alert"><span class="n-breaking-badge"><i class="n-live-dot" aria-hidden="true"></i>' + esc(str(d.label, 'BREAKING')) + '</span>'
        + '<span class="n-breaking-text">' + esc(t) + '</span>'
        + (str(d.time, '') ? '<time class="n-breaking-time">' + esc(str(d.time)) + '</time>' : '')
        + '</div>';
    },
    css: ''
  },

  /* ── LIVE BLOG ── */
  liveblog: {
    ai: 'Live coverage feed, newest first, with a pulsing LIVE badge. content: { title?, entries: [{ time, text, tag? ("update"|"quote"|"fact"|"milestone") }] }. The newsroom way to cover developing stories.',
    render: function (d, c) {
      var entries = Array.isArray(d.entries) ? d.entries : [];
      if (!entries.length) return '';
      var head = str(d.title, '') ? '<h2 class="n-sec-title n-reveal">' + esc(str(d.title)) + '</h2>' : '';
      var rows = entries.map(function (it) {
        var tag = str(it.tag, 'update');
        return '<li class="n-live-entry n-reveal"><time class="n-live-time">' + esc(str(it.time, '')) + '</time>'
          + '<div class="n-live-body">'
          + (tag ? '<span class="n-live-tag n-live-tag-' + esc(tag) + '">' + esc(tag).toUpperCase() + '</span>' : '')
          + '<p class="n-live-text">' + esc(str(it.text, '')) + '</p></div></li>';
      }).join('');
      return '<section class="n-sec n-liveblog" id="' + c.uid('sec') + '"><div class="n-inner n-inner-narrow">'
        + '<div class="n-live-head n-reveal"><i class="n-live-dot" aria-hidden="true"></i><span class="n-live-label">LIVE</span></div>'
        + head + '<ol class="n-live-list">' + rows + '</ol></div></section>';
    },
    css: ''
  },

  /* ── KEY POINTS (at a glance) ── */
  keypoints: {
    ai: '"At a glance" fact box — the 3-6 things readers must know. content: { title?, points: [..] }.',
    render: function (d, c) {
      var points = Array.isArray(d.points) ? d.points : [];
      if (!points.length) return '';
      var rows = points.map(function (p) { return '<li>' + esc(String(p)) + '</li>'; }).join('');
      return '<section class="n-sec n-keypoints" id="' + c.uid('sec') + '"><div class="n-inner n-inner-narrow">'
        + '<div class="n-keypoints-card n-reveal"><h2 class="n-keypoints-title">' + esc(str(d.title, 'At a glance')) + '</h2>'
        + '<ul class="n-keypoints-list">' + rows + '</ul></div></div></section>';
    },
    css: ''
  },

  /* ── FACT CHECK ── */
  factcheck: {
    ai: 'Newsroom fact-check panel. content: { claim, verdict: "true"|"mostly-true"|"half-true"|"mostly-false"|"false"|"unverified", by?, explanation }. Builds trust — use for contested claims.',
    render: function (d, c) {
      var claim = str(d.claim, '').trim();
      if (!claim) return '';
      var verdict = str(d.verdict, 'unverified');
      var vlabels = { 'true': 'TRUE', 'mostly-true': 'MOSTLY TRUE', 'half-true': 'HALF TRUE', 'mostly-false': 'MOSTLY FALSE', 'false': 'FALSE', 'unverified': 'UNVERIFIED' };
      if (!vlabels[verdict]) verdict = 'unverified';
      return '<section class="n-sec n-factcheck" id="' + c.uid('sec') + '"><div class="n-inner n-inner-narrow">'
        + '<div class="n-fc-card n-fc-' + verdict + ' n-reveal">'
        + '<span class="n-fc-label">Fact check</span>'
        + '<p class="n-fc-claim">“' + esc(claim) + '”</p>'
        + '<span class="n-fc-verdict">' + vlabels[verdict] + '</span>'
        + (str(d.by, '') ? '<span class="n-fc-by">— ' + esc(str(d.by)) + '</span>' : '')
        + (str(d.explanation, '') ? '<p class="n-fc-expl">' + sanitizeRich(str(d.explanation)) + '</p>' : '')
        + '</div></div></section>';
    },
    css: ''
  },

  /* ── SCORECARD (sports) ── */
  scorecard: {
    ai: 'Sports scoreboard. content: { sport?, status? ("FT"|"LIVE"|time), venue?, home: { name, score }, away: { name, score }, note? }. Dark board with big numbers.',
    render: function (d, c) {
      var home = isObj(d.home) ? d.home : {};
      var away = isObj(d.away) ? d.away : {};
      if (!str(home.name, '') && !str(away.name, '')) return '';
      return '<section class="n-sec n-scorecard" id="' + c.uid('sec') + '"><div class="n-inner n-inner-narrow">'
        + '<div class="n-score-card n-reveal">'
        + '<span class="n-score-sport">' + esc(str(d.sport, 'MATCH')) + '</span>'
        + '<span class="n-score-status">' + esc(str(d.status, 'FT')) + '</span>'
        + '<div class="n-score-row"><span class="n-score-team">' + esc(str(home.name, 'Home')) + '</span>'
        + '<span class="n-score-num">' + esc(String(home.score == null ? 0 : home.score)) + '</span>'
        + '<span class="n-score-div">–</span>'
        + '<span class="n-score-num">' + esc(String(away.score == null ? 0 : away.score)) + '</span>'
        + '<span class="n-score-team">' + esc(str(away.name, 'Away')) + '</span></div>'
        + (str(d.venue, '') ? '<span class="n-score-venue">' + esc(str(d.venue)) + '</span>' : '')
        + (str(d.note, '') ? '<p class="n-score-note">' + esc(str(d.note)) + '</p>' : '')
        + '</div></div></section>';
    },
    css: ''
  },

  /* ── PHOTO STORY ── */
  photostory: {
    ai: 'Full-bleed photo essay image with caption and credit line. content: { image, alt, caption?, credit?, kicker?, title? }. Use for the defining photo of the story.',
    render: function (d, c) {
      var src = imgSrc(d.image);
      if (!src) return '';
      return '<section class="n-sec n-photostory" id="' + c.uid('sec') + '"><div class="n-inner">'
        + (str(d.kicker, '') || str(d.title, '') ? '<div class="n-ps-head n-reveal">'
          + (str(d.kicker, '') ? '<span class="n-hero-kicker">' + esc(str(d.kicker)) + '</span>' : '')
          + (str(d.title, '') ? '<h2 class="n-ps-title">' + esc(str(d.title)) + '</h2>' : '') + '</div>' : '')
        + '<figure class="n-ps-fig n-reveal"><img class="n-ps-img" src="' + esc(src) + '" alt="' + esc(str(d.alt, 'photo')) + '" loading="lazy" width="1600" height="1000">'
        + '<figcaption class="n-ps-cap">'
        + (str(d.caption, '') ? '<span class="n-ps-caption">' + esc(str(d.caption)) + '</span>' : '')
        + (str(d.credit, '') ? '<span class="n-ps-credit">' + esc(str(d.credit)) + '</span>' : '')
        + '</figcaption></figure></div></section>';
    },
    css: ''
  },

  /* ── PERSON CARD (who's who) ── */
  personcard: {
    ai: '"Who is" profile card for a person in the story. content: { name, role?, photo?, bio?, quote?, connection? ("Why they matter") }.',
    render: function (d, c) {
      var photo = imgSrc(d.photo);
      return '<section class="n-sec n-person" id="' + c.uid('sec') + '"><div class="n-inner n-inner-narrow">'
        + '<div class="n-person-card n-reveal">'
        + (photo ? '<img class="n-person-photo" src="' + esc(photo) + '" alt="' + esc(str(d.name, 'person')) + '" loading="lazy" width="160" height="160">'
          : '<span class="n-person-photo n-person-photo-txt">' + esc(String(str(d.name, '?')).charAt(0).toUpperCase()) + '</span>')
        + '<div class="n-person-body"><span class="n-person-kicker">Who is this</span>'
        + '<h2 class="n-person-name">' + esc(str(d.name, '')) + '</h2>'
        + (str(d.role, '') ? '<span class="n-person-role">' + esc(str(d.role)) + '</span>' : '')
        + (str(d.bio, '') ? '<p class="n-person-bio">' + esc(str(d.bio)) + '</p>' : '')
        + (str(d.quote, '') ? '<p class="n-person-quote">“' + esc(str(d.quote)) + '”</p>' : '')
        + (str(d.connection, '') ? '<p class="n-person-connection"><strong>Why it matters:</strong> ' + esc(str(d.connection)) + '</p>' : '')
        + '</div></div></div></section>';
    },
    css: ''
  },

  /* ── EDITOR'S NOTE ── */
  editorsnote: {
    ai: 'Italic editor\'s note box explaining methodology, sensitivity or context. content: { text }.',
    render: function (d, c) {
      var t = str(d.text, '').trim();
      if (!t) return '';
      return '<section class="n-sec n-ednote" id="' + c.uid('sec') + '"><div class="n-inner n-inner-narrow">'
        + '<aside class="n-ednote-box n-reveal"><strong>Editor’s note:</strong> ' + esc(t) + '</aside></div></section>';
    },
    css: ''
  },

  /* ── CORRECTIONS ── */
  corrections: {
    ai: 'Newsroom-standard "Corrections & clarifications" small print. content: { note }. Builds trust — add when a story was amended.',
    render: function (d, c) {
      var t = str(d.note, '').trim();
      if (!t) return '';
      return '<section class="n-sec n-corrections" id="' + c.uid('sec') + '"><div class="n-inner n-inner-narrow">'
        + '<p class="n-corrections-p n-reveal"><strong>Corrections & clarifications:</strong> ' + esc(t) + '</p></div></section>';
    },
    css: ''
  },

  /* ── STORY QUIZ (graded, shareable result) ── */
  quiz: {
    ai: 'Graded story quiz with a shareable result card. content: { title?, questions: [{ q, options: [..], correct: index }], note? }. 3-5 questions; scores and result text are copied with a link.',
    render: function (d, c) {
      var qs = Array.isArray(d.questions) ? d.questions : [];
      if (!qs.length) return '';
      var key = 'ng-quiz-' + c.slug + '-' + c.uid('q');
      var out = qs.map(function (q, qi) {
        var opts = Array.isArray(q.options) ? q.options : [];
        if (!opts.length) return '';
        return '<div class="n-quiz-q"><h3 class="n-quiz-q-title">' + (qi + 1) + '. ' + esc(str(q.q, '')) + '</h3>'
          + '<div class="n-quiz-opts">' + opts.map(function (o, oi) {
            return '<button class="n-quiz-opt" type="button" data-quiz-q="' + qi + '" data-quiz-a="' + oi + '">' + esc(String(o)) + '</button>';
          }).join('') + '</div></div>';
      }).join('');
      return '<section class="n-sec n-quiz" id="' + c.uid('sec') + '"><div class="n-inner n-inner-narrow">'
        + '<div class="n-quiz-card n-reveal" data-quiz-key="' + key + '">'
        + '<h2 class="n-quiz-title">🧠 ' + esc(str(d.title, 'How well did you follow the story?')) + '</h2>'
        + out
        + '<div class="n-quiz-actions"><button class="n-btn n-btn-primary n-quiz-submit" type="button">Check my score</button></div>'
        + '<div class="n-quiz-result" hidden><p class="n-quiz-score"></p><div class="n-quiz-result-actions">'
        + '<button class="n-quiz-share" type="button">📋 Share my result</button>'
        + '<button class="n-quiz-retry" type="button">↺ Try again</button></div></div>'
        + (str(d.note, '') ? '<p class="n-quiz-note">' + esc(str(d.note)) + '</p>' : '')
        + '</div></div></section>';
    },
    css: ''
  },

  /* ── HEAT STRIP (data visual) ── */
  heatstrip: {
    ai: 'Heat-strip data visual — a row of cells colored by value. content: { title?, items: [{ label, value }], unit?, note? }. Great for rankings, temperatures, budgets.',
    render: function (d, c) {
      var items = Array.isArray(d.items) ? d.items : [];
      if (!items.length) return '';
      var maxV = 1;
      items.forEach(function (it) { maxV = Math.max(maxV, num(it.value, 0)); });
      var cells = items.map(function (it) {
        var v = num(it.value, 0);
        var pct = maxV > 0 ? Math.round((v / maxV) * 100) : 0;
        return '<div class="n-heat-cell"><span class="n-heat-bar" style="height:' + Math.max(6, pct) + '%"></span>'
          + '<span class="n-heat-val">' + esc(String(it.value)) + (str(d.unit, '') ? '<small>' + esc(str(d.unit)) + '</small>' : '') + '</span>'
          + '<span class="n-heat-label">' + esc(str(it.label, '')) + '</span></div>';
      }).join('');
      return '<section class="n-sec n-heatstrip" id="' + c.uid('sec') + '"><div class="n-inner">'
        + (str(d.title, '') ? '<h2 class="n-sec-title n-reveal">' + esc(str(d.title)) + '</h2>' : '')
        + '<div class="n-heat n-reveal">' + cells + '</div>'
        + (str(d.note, '') ? '<p class="n-chart-source">' + esc(str(d.note)) + '</p>' : '')
        + '</div></section>';
    },
    css: ''
  },

  /* ── ANNOTATED SVG MAP ── */
  annotatedmap: {
    ai: 'Annotated SVG map — points plotted by percentage coordinates with labels (no external embeds). content: { title?, image? (background URL), points: [{ x: 0-100, y: 0-100, label, note? }], note? }.',
    render: function (d, c) {
      var points = Array.isArray(d.points) ? d.points : [];
      if (!points.length) return '';
      var img = imgSrc(d.image);
      var marks = points.map(function (p) {
        var x = clamp(num(p.x, 50), 2, 98);
        var y = clamp(num(p.y, 50), 4, 96);
        var label = str(p.label, '');
        return '<g class="n-amap-point">'
          + '<circle cx="' + x + '" cy="' + y + '" r="2.6">' + (str(p.note, '') ? '<title>' + esc(label + ': ' + str(p.note)) + '</title>' : '<title>' + esc(label) + '</title>') + '</circle>'
          + '<text x="' + x + '" y="' + (y - 6) + '" class="n-amap-label">' + esc(label) + '</text></g>';
      }).join('');
      return '<section class="n-sec n-amap" id="' + c.uid('sec') + '"><div class="n-inner">'
        + (str(d.title, '') ? '<h2 class="n-sec-title n-reveal">' + esc(str(d.title)) + '</h2>' : '')
        + '<figure class="n-amap-fig n-reveal"><svg class="n-amap-svg" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="' + esc(str(d.title, 'annotated map')) + '">'
        + (img ? '<image href="' + esc(img) + '" x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice"></image>' : '<rect x="0" y="0" width="100" height="100" fill="#eef1f6"></rect>')
        + marks + '</svg>'
        + (str(d.note, '') ? '<figcaption class="n-chart-source">' + esc(str(d.note)) + '</figcaption>' : '')
        + '</figure></div></section>';
    },
    css: ''
  },

  /* ── CLICKABLE ORG CHART ── */
  orgchart: {
    ai: 'Clickable org chart (native details, expandable branches). content: { title?, root: { label, role?, note?, children?: [ same shape ] } }. For "who is who" structures.',
    render: function (d, c) {
      function node(n) {
        if (!isObj(n)) return '';
        var kids = Array.isArray(n.children) ? n.children.map(node).join('') : '';
        var inner = '<summary><b>' + esc(str(n.label, '')) + '</b>'
          + (str(n.role, '') ? '<small>' + esc(str(n.role)) + '</small>' : '') + '</summary>'
          + (str(n.note, '') ? '<p class="n-org-note">' + esc(str(n.note)) + '</p>' : '')
          + (kids ? '<ul>' + kids + '</ul>' : '');
        return '<li><details' + (kids ? ' open' : '') + '>' + inner + '</details></li>';
      }
      var tree = node(d.root);
      if (!tree) return '';
      return '<section class="n-sec n-orgchart" id="' + c.uid('sec') + '"><div class="n-inner n-inner-narrow">'
        + (str(d.title, '') ? '<h2 class="n-sec-title n-reveal">' + esc(str(d.title)) + '</h2>' : '')
        + '<div class="n-org n-reveal"><ul>' + tree + '</ul></div></div></section>';
    },
    css: ''
  },

  /* ── VIDEO BEFORE/AFTER COMPARE ── */
  videocompare: {
    ai: 'Before/after VIDEO comparison slider (two muted looping videos, drag the handle). content: { title?, before: { src, label? }, after: { src, label? }, note? }.',
    render: function (d, c) {
      var b = isObj(d.before) ? d.before : {};
      var a = isObj(d.after) ? d.after : {};
      var bs = imgSrc(b.src);
      var as = imgSrc(a.src);
      if (!bs || !as) return '';
      return '<section class="n-sec n-vcmp" id="' + c.uid('sec') + '"><div class="n-inner n-inner-narrow">'
        + (str(d.title, '') ? '<h2 class="n-sec-title n-reveal">' + esc(str(d.title)) + '</h2>' : '')
        + '<figure class="n-vcmp n-reveal" data-vcmp>'
        + '<div class="n-vcmp-stage">'
        + '<video class="n-vcmp-after" src="' + esc(as) + '" muted loop playsinline preload="metadata"></video>'
        + '<div class="n-vcmp-before-wrap"><video class="n-vcmp-before" src="' + esc(bs) + '" muted loop playsinline preload="metadata"></video></div>'
        + '<div class="n-vcmp-handle" role="slider" tabindex="0" aria-label="Drag to compare videos" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50"><span class="n-vcmp-grip">⇔</span></div>'
        + '<button class="n-vcmp-play" type="button">▶ Play</button>'
        + '<span class="n-cmp-tag n-cmp-tag-b">' + esc(str(b.label, 'Before')) + '</span>'
        + '<span class="n-cmp-tag n-cmp-tag-a">' + esc(str(a.label, 'After')) + '</span>'
        + '</div>'
        + (str(d.note, '') ? '<figcaption class="n-cmp-cap">' + esc(str(d.note)) + '</figcaption>' : '')
        + '</figure></div></section>';
    },
    css: ''
  },

  /* ── SCROLLYTELLING CHAPTERS ── */
  scrolly: {
    ai: 'Scrollytelling chapters: a sticky full-bleed image stage that crossfades as readers scroll past chapter cards. content: { title?, chapters: [{ title, text, image, alt? }] }. Longform magic.',
    render: function (d, c) {
      var chs = Array.isArray(d.chapters) ? d.chapters : [];
      if (!chs.length) return '';
      var frames = chs.map(function (ch, i) {
        var img = imgSrc(ch.image);
        return '<div class="n-scrolly-frame' + (i === 0 ? ' active' : '') + '">'
          + (img ? '<img src="' + esc(img) + '" alt="' + esc(str(ch.alt, str(ch.title, 'chapter'))) + '" loading="lazy" width="1600" height="1000">' : '<div class="n-scrolly-frame-empty"></div>')
          + '<span class="n-scrolly-cap">' + esc(str(ch.title, '')) + '</span></div>';
      }).join('');
      var cards = chs.map(function (ch, i) {
        return '<div class="n-scrolly-chapter" data-scrolly="' + i + '"><h3 class="n-scrolly-ch-title">' + esc(str(ch.title, '')) + '</h3>'
          + (str(ch.text, '') ? '<p class="n-scrolly-ch-text">' + esc(str(ch.text)) + '</p>' : '') + '</div>';
      }).join('');
      return '<section class="n-sec n-scrolly" id="' + c.uid('sec') + '">'
        + (str(d.title, '') ? '<h2 class="n-sec-title n-reveal">' + esc(str(d.title)) + '</h2>' : '')
        + '<div class="n-scrolly-wrap"><div class="n-scrolly-stage" aria-hidden="true">' + frames + '</div>'
        + '<div class="n-scrolly-chapters">' + cards + '</div></div></section>';
    },
    css: ''
  },

  /* ── COMMENTS / DISCUSSION HOOK ── */
  comments: {
    ai: 'Comments hook. content: { formTypeId?, title?, note? }. With formTypeId, renders a data-gw-form discussion form (comment + honeypot) bound via gw.forms; without it, a placeholder is shown and the tool adds a === CMS CONFIG NEEDED === note to create the form-type-definition.',
    render: function (d, c) {
      var ft = str(d.formTypeId, '');
      var title = esc(str(d.title, 'Join the discussion'));
      if (ft) {
        return '<section class="n-sec n-comments" id="' + c.uid('sec') + '"><div class="n-inner n-inner-narrow">'
          + '<div class="n-comments-box n-reveal"><h2 class="n-comments-title">' + title + '</h2>'
          + '<form data-gw-form class="n-comments-form">'
          + '<textarea name="comment" rows="3" required placeholder="Share your view — be respectful."></textarea>'
          + '<input type="text" name="website" class="n-comments-hp" tabindex="-1" autocomplete="off" aria-hidden="true">'
          + '<button class="n-btn n-btn-primary" type="submit">Post comment</button>'
          + '<div data-gw-form-status role="status"></div>'
          + '</form>'
          + (str(d.note, '') ? '<p class="n-quiz-note">' + esc(str(d.note)) + '</p>' : '')
          + '</div></div></section>';
      }
      return '<section class="n-sec n-comments" id="' + c.uid('sec') + '"><div class="n-inner n-inner-narrow">'
        + '<div class="n-comments-box n-comments-placeholder n-reveal"><h2 class="n-comments-title">' + title + '</h2>'
        + '<p class="n-quiz-note">' + esc(str(d.note, 'Discussion opens when the CMS form is configured.')) + '</p>'
        + '</div></div></section>';
    },
    css: ''
  }
};

/* article block renderer shared by article + tabs */
function renderArticleBlocks(blocks, c) {
  var fake = { blocks: blocks };
  var html = NG_COMPONENTS.article.render(fake, c);
  // article.render wraps in section + inner; extract only the blocks
  var m = html.match(/<div class="n-inner n-inner-narrow">([\s\S]*)<\/div><\/section>$/);
  return m ? m[1] : '';
}

/* link attributes for related cards */
function linkHrefAttrs(url) {
  var u = safeUrl(url);
  if (!u) return 'href="#"';
  if (u.charAt(0) === '/') return 'data-ic-nav-href="' + esc(u) + '" href="' + esc(u) + '"';
  return 'href="' + esc(u) + '" target="_blank" rel="noopener"';
}

/* ═══════════════════════════════════════════════════════════════════
   AI CATALOG — what the model sees about the components
   ═══════════════════════════════════════════════════════════════════ */
function buildCatalogText() {
  var lines = [];
  for (var id in NG_COMPONENTS) {
    if (!Object.prototype.hasOwnProperty.call(NG_COMPONENTS, id)) continue;
    lines.push('- ' + id + ': ' + NG_COMPONENTS[id].ai);
  }
  return 'COMPONENT CATALOG (use these ids as "component" values):\n' + lines.join('\n');
}

/* ═══════════════════════════════════════════════════════════════════
   GENERATED PAGE CSS — base + component css
   ═══════════════════════════════════════════════════════════════════ */
function baseCss(slug, accent, primary) {
  var acc = accent ? '--npg-accent:' + accent + ';' : '';
  var pri = primary ? '--npg-primary:' + primary + ';' : '';
  var S = '.news-' + slug;
  return [
    '/* News page — generated by NewsGenerator. Scoped to .' + S + ' */',
    S + '{',
    '  --npg-bg:var(--gw-color-surface,#ffffff);',
    '  --npg-ink:var(--gw-color-ink,#16181f);',
    '  --npg-dim:#5b6170;',
    '  --npg-line:#d9dce4;',
    '  --npg-rule:#16181f;',
    '  --npg-primary:var(--gw-color-primary,#1f4e8c);' + pri,
    '  --npg-accent:var(--gw-color-accent,#b91c1c);' + acc,
    '  --npg-serif:var(--gw-font-body,Georgia,"Source Serif 4","Iowan Old Style","Times New Roman",serif);',
    '  --npg-sans:var(--gw-font-head,"Segoe UI","Helvetica Neue",Arial,sans-serif);',
    '  font-family:var(--npg-serif);',
    '  color:var(--npg-ink);',
    '  background:var(--npg-bg);',
    '  line-height:1.75;',
    '  font-size:17px;',
    '  overflow-wrap:break-word;',
    '}',
    S + ' *, ' + S + ' *::before, ' + S + ' *::after { box-sizing:border-box; margin:0; padding:0; }',
    S + ' img { max-width:100%; height:auto; display:block; }',
    S + ' a { color:var(--npg-primary); text-decoration-color:color-mix(in srgb,var(--npg-primary) 45%,transparent); }',
    S + ' a:hover { color:var(--npg-accent); }',
    S + ' :focus-visible { outline:3px solid var(--npg-accent); outline-offset:2px; }',
    S + ' .n-sec { padding:clamp(30px,4.5vw,56px) 20px; }',
    S + ' .n-inner { max-width:1080px; margin:0 auto; }',
    S + ' .n-inner-narrow { max-width:680px; }',
    '/* section headers — newspaper style with double rule */',
    S + ' .n-sec-title { font-family:var(--npg-serif); font-size:clamp(22px,2.6vw,30px); font-weight:800; line-height:1.2; letter-spacing:-.01em; margin-bottom:24px; padding-bottom:10px; border-bottom:3px double var(--npg-rule); }',
    S + ' .n-h2 { font-family:var(--npg-sans); font-size:1.06em; font-weight:800; letter-spacing:.01em; line-height:1.35; margin:2.2em 0 .7em; }',
    S + ' .n-h3 { font-family:var(--npg-serif); font-size:1.06em; font-style:italic; font-weight:700; margin:1.8em 0 .5em; }',
    S + ' .n-p { margin:0 0 1.3em; font-size:1.06em; }',
    S + ' .n-list { margin:0 0 1.4em 1.4em; font-size:1.02em; }',
    S + ' .n-list li { margin:.4em 0; }',
    S + ' .n-bq { border-left:3px solid var(--npg-rule); padding:4px 0 4px 20px; margin:1.8em 0; font-size:1.14em; font-style:italic; }',
    S + ' .n-bq cite { display:block; font-style:normal; font-family:var(--npg-sans); font-size:.76em; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:var(--npg-dim); margin-top:8px; }',
    S + ' .n-fig { margin:2em 0; }',
    S + ' .n-fig figcaption, .n-fig-caption { font-family:var(--npg-sans); font-size:.76em; color:var(--npg-dim); margin-top:8px; }',
    S + ' .n-code { background:#12141c; color:#e2e8f0; border-radius:6px; padding:16px 18px; overflow-x:auto; margin:1.6em 0; font-size:.85em; font-family:Consolas,monospace; }',
    S + ' .n-hr { border:none; border-top:1px solid var(--npg-line); margin:2.4em 0; }',
    S + ' .n-note { display:flex; gap:12px; padding:14px 16px; border-radius:6px; margin:1.6em 0; font-size:.95em; }',
    S + ' .n-note-info { background:color-mix(in srgb,var(--npg-primary) 7%,var(--npg-bg)); border-left:4px solid var(--npg-primary); }',
    S + ' .n-note-warning { background:color-mix(in srgb,var(--npg-accent) 9%,var(--npg-bg)); border-left:4px solid var(--npg-accent); }',
    S + ' .n-note-success { background:color-mix(in srgb,#15803d 8%,var(--npg-bg)); border-left:4px solid #15803d; }',
    S + ' .n-note-danger { background:color-mix(in srgb,#b91c1c 8%,var(--npg-bg)); border-left:4px solid #b91c1c; }',
    S + ' .n-note-ico { font-size:1.15em; }',
    S + ' .n-btn { display:inline-block; font-family:var(--npg-sans); font-weight:700; font-size:.88em; letter-spacing:.03em; padding:12px 22px; border-radius:3px; text-decoration:none; transition:transform .15s,box-shadow .15s; }',
    S + ' .n-btn:hover { transform:translateY(-1px); }',
    S + ' .n-btn-primary { background:var(--npg-primary); color:#fff; }',
    S + ' .n-btn-accent { background:var(--npg-accent); color:#fff; }',
    S + ' .n-btn-ghost2 { border:2px solid var(--npg-primary); color:var(--npg-primary); background:transparent; }',
    S + ' .n-link-dead { color:var(--npg-dim); }',
    '/* reveal animation */',
    S + ' .n-reveal { opacity:0; transform:translateY(16px); transition:opacity .6s ease,transform .6s ease; }',
    S + ' .n-reveal.n-in { opacity:1; transform:none; }',
    '/* live pulse dot (breaking/live badges) */',
    S + ' .n-live-dot { display:inline-block; width:9px; height:9px; border-radius:50%; background:#ef4444; animation:n-live-pulse 1.2s ease-in-out infinite; }',
    '@keyframes n-live-pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:.35; transform:scale(.8); } }',
    '@media (prefers-reduced-motion:reduce) {',
    '  ' + S + ' .n-reveal { opacity:1; transform:none; transition:none; }',
    '  ' + S + ' .n-ticker-track { animation:none !important; }',
    '  ' + S + ' .n-live-dot { animation:none; }',
    '}',
    '/* ── hero ── */',
    S + ' .n-hero { padding:0; overflow:hidden; }',
    S + ' .n-hero .n-hero-inner { max-width:1200px; margin:0 auto; padding:clamp(36px,6vw,80px) 20px; }',
    S + ' .n-hero-kicker { display:inline-block; font-family:var(--npg-sans); font-size:.72em; font-weight:800; letter-spacing:.18em; text-transform:uppercase; color:var(--npg-accent); margin-bottom:16px; }',
    S + ' .n-hero-kicker::before { content:""; display:block; width:44px; height:3px; background:var(--npg-accent); margin:0 0 10px; }',
    S + ' .n-hero-title { font-family:var(--npg-serif); font-size:clamp(30px,4.8vw,56px); font-weight:800; line-height:1.1; letter-spacing:-.015em; margin-bottom:18px; text-wrap:balance; }',
    S + ' .n-hero-sub { font-family:var(--npg-serif); font-size:clamp(17px,2vw,22px); color:color-mix(in srgb,var(--npg-ink) 66%,var(--npg-bg)); margin-bottom:20px; max-width:62ch; }',
    S + ' .n-hero-meta { display:flex; flex-wrap:wrap; gap:6px 0; font-family:var(--npg-sans); font-size:.8em; color:var(--npg-dim); margin-bottom:24px; }',
    S + ' .n-hero-meta .n-hero-m:not(:last-child)::after { content:"·"; margin:0 10px; color:#b6b9c4; }',
    S + ' .n-hero-ctas { display:flex; gap:12px; flex-wrap:wrap; }',
    S + ' .n-hero-media { border-radius:4px; overflow:hidden; }',
    S + ' .n-hero-media img { width:100%; height:auto; aspect-ratio:16/10; object-fit:cover; }',
    S + ' .n-hero-media figcaption { font-family:var(--npg-sans); font-size:.74em; color:var(--npg-dim); padding:8px 2px 0; }',
    S + ' .n-hero-split .n-hero-inner { display:grid; grid-template-columns:1.05fr .95fr; gap:clamp(24px,4vw,56px); align-items:center; }',
    '/* broadsheet hero — the classic newspaper front */',
    S + ' .n-hero-sheet .n-hero-inner { max-width:880px; text-align:center; }',
    S + ' .n-hero-sheet .n-hero-title { font-size:clamp(32px,5.4vw,62px); }',
    S + ' .n-hero-sheet .n-hero-kicker::before { margin-left:auto; margin-right:auto; }',
    S + ' .n-hero-sheet .n-hero-meta, .n-hero-sheet .n-hero-ctas { justify-content:center; }',
    S + ' .n-hero-rules { border-top:3px double var(--npg-rule); margin:26px 0; }',
    S + ' .n-hero-media-sheet { max-width:760px; margin:6px auto 0; }',
    S + ' .n-hero-media-sheet figcaption { text-align:center; }',
    '/* breaking hero — urgent banner */',
    S + ' .n-hero-breaking { position:relative; background:#14161d; color:#fff; }',
    S + ' .n-hero-breaking .n-hero-inner { position:relative; z-index:1; max-width:980px; }',
    S + ' .n-hero-bg { position:absolute; inset:0; background-size:cover; background-position:center; opacity:.28; }',
    S + ' .n-hero-breaking-badge { display:inline-flex; align-items:center; gap:8px; font-family:var(--npg-sans); font-size:.72em; font-weight:800; letter-spacing:.18em; text-transform:uppercase; background:#b91c1c; color:#fff; padding:7px 14px; border-radius:3px; margin-bottom:16px; }',
    S + ' .n-hero-breaking-badge .n-live-dot { background:#fff; }',
    S + ' .n-hero-breaking .n-hero-title { color:#fff; }',
    S + ' .n-hero-breaking .n-hero-sub { color:#c6c9d6; }',
    S + ' .n-hero-breaking .n-hero-meta { color:#9aa0b4; }',
    '/* cover / gradient / minimal */',
    S + ' .n-hero-cover { position:relative; color:#fff; background:#101828; }',
    S + ' .n-hero-cover .n-hero-inner { position:relative; z-index:1; max-width:900px; }',
    S + ' .n-hero-cover .n-hero-bg { opacity:.5; }',
    S + ' .n-hero-cover .n-hero-sub, .n-hero-cover .n-hero-meta { color:#d7dcea; }',
    S + ' .n-hero-cover .n-hero-kicker { color:#fff; }',
    S + ' .n-hero-cover .n-hero-kicker::before { background:var(--npg-accent); }',
    S + ' .n-hero-grad { position:relative; overflow:hidden; background:linear-gradient(120deg,var(--npg-primary),#4c1d95 60%,var(--npg-accent)); color:#fff; }',
    S + ' .n-hero-grad .n-hero-inner { position:relative; z-index:1; max-width:980px; text-align:center; }',
    S + ' .n-hero-grad .n-hero-sub, .n-hero-grad .n-hero-meta { color:#eef1fb; }',
    S + ' .n-hero-grad .n-hero-meta, .n-hero-grad .n-hero-ctas { justify-content:center; }',
    S + ' .n-hero-grad .n-hero-kicker { color:#fff; }',
    S + ' .n-hero-grad .n-hero-kicker::before { background:#fff; margin-left:auto; margin-right:auto; }',
    S + ' .n-hero-deco { position:absolute; border-radius:50%; filter:blur(2px); opacity:.25; }',
    S + ' .n-hero-deco-a { width:380px; height:380px; background:#fff; top:-140px; right:-80px; }',
    S + ' .n-hero-deco-b { width:260px; height:260px; background:#fff; bottom:-110px; left:-60px; }',
    S + ' .n-hero-min .n-hero-inner { max-width:780px; text-align:center; }',
    S + ' .n-hero-min .n-hero-kicker::before { margin-left:auto; margin-right:auto; }',
    S + ' .n-hero-min .n-hero-meta, .n-hero-min .n-hero-ctas { justify-content:center; }',
    '/* ── byline + dateline ── */',
    S + ' .n-byline { padding-top:clamp(18px,3vw,30px); padding-bottom:clamp(18px,3vw,30px); border-bottom:1px solid var(--npg-line); }',
    S + ' .n-byline-row { display:flex; align-items:center; gap:14px; }',
    S + ' .n-byline-avatar { width:52px; height:52px; border-radius:50%; object-fit:cover; flex:0 0 auto; }',
    S + ' .n-byline-avatar-txt { display:flex; align-items:center; justify-content:center; background:var(--npg-rule); color:#fff; font-family:var(--npg-serif); font-size:22px; font-weight:800; flex:0 0 auto; }',
    S + ' .n-byline-info { display:flex; flex-direction:column; gap:2px; }',
    S + ' .n-byline-by { font-family:var(--npg-sans); font-size:.9em; }',
    S + ' .n-byline-by strong { font-weight:800; }',
    S + ' .n-byline-role { font-size:.9em; color:var(--npg-dim); }',
    S + ' .n-byline-meta { font-family:var(--npg-sans); font-size:.76em; letter-spacing:.03em; color:var(--npg-dim); text-transform:uppercase; }',
    S + ' .n-byline-dateline { color:var(--npg-ink); font-weight:800; }',
    S + ' .n-meta-sep { font-style:normal; margin:0 8px; color:#b6b9c4; }',
    '/* ── standfirst ── */',
    S + ' .n-standfirst { padding-top:clamp(18px,3vw,28px); padding-bottom:0; }',
    S + ' .n-standfirst-p { font-family:var(--npg-serif); font-size:clamp(19px,2.2vw,24px); line-height:1.5; color:color-mix(in srgb,var(--npg-ink) 78%,var(--npg-bg)); border-left:3px solid var(--npg-accent); padding-left:20px; }',
    '/* ── lead ── */',
    S + ' .n-lead { padding-top:clamp(22px,3.5vw,40px); }',
    S + ' .n-lead-p { font-size:clamp(18px,2.2vw,23px); line-height:1.65; }',
    S + ' .n-lead-p::first-letter { font-family:var(--npg-serif); font-size:3.6em; float:left; line-height:.82; padding:8px 12px 0 0; font-weight:800; color:var(--npg-ink); }',
    '/* ── key facts / by the numbers ── */',
    S + ' .n-facts { border-top:1px solid var(--npg-rule); border-bottom:1px solid var(--npg-rule); background:var(--npg-bg); }',
    S + ' .n-facts-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:0; border-left:1px solid var(--npg-line); }',
    S + ' .n-stat { padding:20px 18px; text-align:left; border-right:1px solid var(--npg-line); border-bottom:1px solid var(--npg-line); }',
    S + ' .n-stat-value-wrap { font-family:var(--npg-serif); font-size:clamp(28px,3.2vw,42px); font-weight:800; color:var(--npg-ink); font-variant-numeric:tabular-nums; }',
    S + ' .n-stat-label { font-family:var(--npg-sans); font-size:.72em; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--npg-dim); margin-top:6px; }',
    S + ' .n-stat-ico { margin-right:4px; }',
    '/* ── timeline ── */',
    S + ' .n-tl { list-style:none; position:relative; padding-left:26px; }',
    S + ' .n-tl::before { content:""; position:absolute; left:8px; top:6px; bottom:6px; width:2px; background:var(--npg-rule); }',
    S + ' .n-tl-item { position:relative; margin-bottom:24px; }',
    S + ' .n-tl-dot { position:absolute; left:-26px; top:6px; width:17px; height:17px; border-radius:50%; background:var(--npg-bg); border:4px solid var(--npg-rule); }',
    S + ' .n-tl-milestone .n-tl-dot { border-color:var(--npg-accent); background:var(--npg-accent); }',
    S + ' .n-tl-quote .n-tl-dot { border-radius:4px; border-color:var(--npg-primary); background:var(--npg-primary); }',
    S + ' .n-tl-card { background:var(--npg-bg); padding:2px 0 4px; }',
    S + ' .n-tl-time { font-family:var(--npg-sans); font-size:.72em; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:var(--npg-accent); }',
    S + ' .n-tl-title { font-family:var(--npg-serif); font-size:1.14em; font-weight:800; margin:2px 0 4px; }',
    S + ' .n-tl-text { font-size:.95em; color:var(--npg-dim); }',
    '/* ── quote ── */',
    S + ' .n-quote-fig { text-align:center; border-top:3px double var(--npg-rule); border-bottom:3px double var(--npg-rule); padding:34px 8px; }',
    S + ' .n-quote-mark { font-family:Georgia,serif; font-size:64px; line-height:.7; color:var(--npg-accent); margin-bottom:10px; }',
    S + ' .n-quote-txt { font-family:var(--npg-serif); font-size:clamp(21px,2.6vw,30px); line-height:1.4; font-style:italic; max-width:620px; margin:0 auto; }',
    S + ' .n-quote-by { display:flex; align-items:center; justify-content:center; gap:10px; margin-top:18px; font-style:normal; font-family:var(--npg-sans); font-size:.9em; }',
    S + ' .n-quote-by span { display:block; font-size:.82em; color:var(--npg-dim); font-weight:400; }',
    S + ' .n-quote-avatar img { width:52px; height:52px; border-radius:50%; object-fit:cover; border:2px solid var(--npg-accent); }',
    '/* ── gallery ── */',
    S + ' .n-gal-grid { display:grid; gap:6px; }',
    S + ' .n-gal-cols-2 { grid-template-columns:repeat(2,1fr); }',
    S + ' .n-gal-cols-3 { grid-template-columns:repeat(3,1fr); }',
    S + ' .n-gal-cols-4 { grid-template-columns:repeat(4,1fr); }',
    S + ' .n-gal-item { position:relative; border:none; background:none; padding:0; cursor:zoom-in; overflow:hidden; }',
    S + ' .n-gal-item img { width:100%; height:100%; aspect-ratio:4/3; object-fit:cover; filter:grayscale(12%); transition:transform .35s ease,filter .35s ease; }',
    S + ' .n-gal-item:hover img { transform:scale(1.04); filter:none; }',
    S + ' .n-gal-cap { position:absolute; inset:auto 0 0 0; padding:22px 12px 8px; font-family:var(--npg-sans); font-size:.74em; color:#fff; text-align:left; background:linear-gradient(transparent,rgba(0,0,0,.75)); }',
    S + ' .n-lightbox { position:fixed; inset:0; z-index:9999; background:rgba(8,10,20,.95); display:flex; align-items:center; justify-content:center; flex-direction:column; }',
    S + ' .n-lightbox img { max-width:92vw; max-height:80vh; }',
    S + ' .n-lightbox-cap { color:#d7dcea; margin-top:12px; font-size:.9em; }',
    S + ' .n-lightbox-btn { position:absolute; top:50%; transform:translateY(-50%); background:rgba(255,255,255,.12); border:none; color:#fff; font-size:26px; width:52px; height:52px; border-radius:50%; cursor:pointer; }',
    S + ' .n-lightbox-btn:hover { background:rgba(255,255,255,.25); }',
    S + ' .n-lightbox-prev { left:16px; } .n-lightbox-next { right:16px; }',
    S + ' .n-lightbox-close { position:absolute; top:16px; right:18px; background:rgba(255,255,255,.12); border:none; color:#fff; font-size:20px; width:46px; height:46px; border-radius:50%; cursor:pointer; }',
    '/* ── faq ── */',
    S + ' .n-faq-list { display:flex; flex-direction:column; }',
    S + ' .n-faq-item { border-bottom:1px solid var(--npg-line); background:var(--npg-bg); }',
    S + ' .n-faq-item:first-child { border-top:1px solid var(--npg-line); }',
    S + ' .n-faq-item summary { list-style:none; cursor:pointer; padding:14px 4px; font-family:var(--npg-serif); font-size:1.05em; font-weight:800; display:flex; justify-content:space-between; gap:12px; align-items:center; }',
    S + ' .n-faq-item summary::-webkit-details-marker { display:none; }',
    S + ' .n-faq-caret { transition:transform .2s; color:var(--npg-accent); font-family:var(--npg-sans); }',
    S + ' .n-faq-item[open] .n-faq-caret { transform:rotate(180deg); }',
    S + ' .n-faq-a { padding:0 4px 16px; color:var(--npg-dim); }',
    '/* ── poll ── */',
    S + ' .n-poll-card { border:1px solid var(--npg-rule); border-radius:0; padding:24px; background:var(--npg-bg); }',
    S + ' .n-poll-q { font-family:var(--npg-serif); font-size:1.25em; font-weight:800; margin-bottom:16px; }',
    S + ' .n-poll-opts { display:flex; flex-direction:column; gap:8px; }',
    S + ' .n-poll-opt { position:relative; overflow:hidden; border:1px solid var(--npg-line); background:var(--npg-bg); border-radius:2px; padding:12px 16px; cursor:pointer; text-align:left; font-size:.95em; font-family:inherit; color:inherit; }',
    S + ' .n-poll-opt:hover { border-color:var(--npg-rule); }',
    S + ' .n-poll-bar { position:absolute; inset:0 auto 0 0; width:0; background:color-mix(in srgb,var(--npg-primary) 14%,transparent); transition:width .5s ease; }',
    S + ' .n-poll-label, .n-poll-pct { position:relative; z-index:1; }',
    S + ' .n-poll-pct { float:right; font-weight:800; color:var(--npg-primary); font-family:var(--npg-sans); }',
    S + ' .n-poll-card.n-poll-done .n-poll-opt { cursor:default; }',
    S + ' .n-poll-note { margin-top:12px; font-family:var(--npg-sans); font-size:.72em; letter-spacing:.02em; color:var(--npg-dim); }',
    '/* ── reactions ── */',
    S + ' .n-react-card { display:flex; flex-direction:column; gap:12px; align-items:center; padding:22px 0; border-top:1px solid var(--npg-rule); border-bottom:1px solid var(--npg-rule); }',
    S + ' .n-react-title { font-family:var(--npg-sans); font-weight:800; font-size:.8em; letter-spacing:.1em; text-transform:uppercase; }',
    S + ' .n-react-row { display:flex; gap:10px; flex-wrap:wrap; justify-content:center; }',
    S + ' .n-react-btn { border:1px solid var(--npg-line); background:var(--npg-bg); border-radius:3px; padding:8px 14px; cursor:pointer; display:flex; gap:8px; align-items:center; font-size:1.05em; transition:transform .12s,border-color .12s; }',
    S + ' .n-react-btn:hover { transform:scale(1.06); border-color:var(--npg-rule); }',
    S + ' .n-react-btn.n-react-on { border-color:var(--npg-rule); background:color-mix(in srgb,var(--npg-ink) 6%,var(--npg-bg)); }',
    S + ' .n-react-count { font-family:var(--npg-sans); font-weight:700; font-size:.85em; color:var(--npg-dim); }',
    '/* ── share ── */',
    S + ' .n-share-card { display:flex; flex-direction:column; gap:12px; align-items:center; padding:22px 0; }',
    S + ' .n-share-title { font-family:var(--npg-sans); font-weight:800; font-size:.8em; letter-spacing:.1em; text-transform:uppercase; }',
    S + ' .n-share-row { display:flex; gap:10px; flex-wrap:wrap; }',
    S + ' .n-share-btn { display:inline-flex; align-items:center; justify-content:center; width:44px; height:44px; border-radius:50%; border:1px solid var(--npg-line); background:var(--npg-bg); color:var(--npg-ink); font-weight:800; font-size:1.05em; text-decoration:none; cursor:pointer; transition:transform .12s,background .12s,color .12s; font-family:var(--npg-sans); }',
    S + ' .n-share-btn:hover { transform:translateY(-3px); background:var(--npg-ink); color:#fff; border-color:var(--npg-ink); }',
    '/* ── progress ── */',
    S + ' .n-progress { position:fixed; top:0; left:0; right:0; height:3px; z-index:9998; background:transparent; pointer-events:none; }',
    S + ' .n-progress-bar { display:block; height:100%; width:0; background:linear-gradient(90deg,var(--npg-ink),var(--npg-accent)); }',
    S + ' .n-listen-btn { margin-left:auto; font-family:var(--npg-sans); font-size:.78em; font-weight:700; letter-spacing:.04em; background:var(--npg-bg); border:1px solid var(--npg-line); color:var(--npg-ink); border-radius:99px; padding:7px 14px; cursor:pointer; }',
    S + ' .n-listen-btn:hover { border-color:var(--npg-rule); }',
    S + ' .n-chart-toggle { font-family:var(--npg-sans); font-size:.78em; font-weight:800; letter-spacing:.06em; text-transform:uppercase; background:var(--npg-bg); border:1px solid var(--npg-rule); color:var(--npg-ink); border-radius:3px; padding:6px 12px; cursor:pointer; margin:0 0 12px; }',
    S + ' .n-chart-toggle:hover { background:var(--npg-ink); color:var(--npg-bg); }',
    S + ' .n-progress-tip { position:fixed; top:10px; right:14px; z-index:9998; background:var(--npg-ink); color:var(--npg-bg); font-family:var(--npg-sans); font-size:11px; font-weight:700; padding:5px 12px; border-radius:99px; opacity:.92; pointer-events:none; display:none; max-width:60vw; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }',
    S + ' .n-progress-bar { display:block; height:100%; width:0; background:linear-gradient(90deg,var(--npg-ink),var(--npg-accent)); }',
    '/* ── toc ── */',
    S + ' .n-toc-card { border-left:3px solid var(--npg-rule); padding:6px 0 6px 20px; background:var(--npg-bg); }',
    S + ' .n-toc-title { font-family:var(--npg-sans); font-weight:800; font-size:.78em; letter-spacing:.14em; text-transform:uppercase; color:var(--npg-dim); }',
    S + ' .n-toc-list { list-style:none; margin-top:10px; display:flex; flex-direction:column; gap:6px; }',
    S + ' .n-toc-list a { text-decoration:none; color:var(--npg-ink); font-family:var(--npg-serif); font-size:1.02em; font-weight:700; padding:2px 0; border-left:3px solid transparent; padding-left:10px; display:inline-block; }',
    S + ' .n-toc-list a.n-toc-h3 { margin-left:18px; font-size:.9em; color:var(--npg-dim); font-weight:400; }',
    S + ' .n-toc-list a.n-toc-active { border-left-color:var(--npg-accent); color:var(--npg-accent); }',
    '/* ── ticker ── */',
    S + ' .n-ticker { display:flex; align-items:stretch; background:#12141c; color:#fff; overflow:hidden; }',
    S + ' .n-ticker-label { flex:0 0 auto; display:flex; align-items:center; gap:8px; padding:10px 16px; background:var(--npg-accent); color:#fff; font-family:var(--npg-sans); font-weight:800; font-size:.74em; letter-spacing:.16em; }',
    S + ' .n-ticker-viewport { flex:1 1 auto; overflow:hidden; display:flex; }',
    S + ' .n-ticker-track { display:flex; align-items:center; gap:26px; padding:10px 0; white-space:nowrap; animation:n-ticker-scroll 30s linear infinite; min-width:100%; }',
    S + ' .n-ticker-dupe { margin-left:26px; }',
    S + ' .n-ticker-sep { color:var(--npg-accent); }',
    S + ' .n-ticker-item { font-family:var(--npg-sans); font-size:.9em; }',
    '@keyframes n-ticker-scroll { from { transform:translateX(0); } to { transform:translateX(-100%); } }',
    '/* ── related (news list style) ── */',
    S + ' .n-rel-grid { display:flex; flex-direction:column; border-top:1px solid var(--npg-rule); }',
    S + ' .n-rel-card { display:flex; gap:16px; align-items:center; border-bottom:1px solid var(--npg-line); padding:14px 0; text-decoration:none; color:inherit; background:var(--npg-bg); transition:padding-left .15s; }',
    S + ' .n-rel-card:hover { padding-left:10px; }',
    S + ' .n-rel-media { flex:0 0 118px; }',
    S + ' .n-rel-media img { width:118px; aspect-ratio:16/10; object-fit:cover; filter:grayscale(15%); }',
    S + ' .n-rel-body { display:flex; flex-direction:column; gap:4px; }',
    S + ' .n-rel-tag { align-self:flex-start; font-family:var(--npg-sans); font-size:.68em; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:var(--npg-accent); }',
    S + ' .n-rel-title { font-family:var(--npg-serif); font-size:1.08em; font-weight:800; line-height:1.35; }',
    S + ' .n-rel-arrow { margin-left:auto; color:var(--npg-primary); font-weight:800; font-family:var(--npg-sans); }',
    '/* ── sources ── */',
    S + ' .n-sources-card { border-top:3px solid var(--npg-rule); padding:20px 0 4px; background:var(--npg-bg); }',
    S + ' .n-sources-title { font-family:var(--npg-sans); font-size:.82em; font-weight:800; letter-spacing:.14em; text-transform:uppercase; margin-bottom:12px; }',
    S + ' .n-sources-list { list-style:none; display:flex; flex-direction:column; gap:8px; font-size:.95em; }',
    S + ' .n-sources-list li::before { content:"🔗 "; }',
    '/* ── cta ── */',
    S + ' .n-cta-card { display:flex; align-items:center; gap:20px; flex-wrap:wrap; padding:28px; color:#fff; background:linear-gradient(120deg,var(--npg-ink),#3b3f52); border-left:6px solid var(--npg-accent); }',
    S + ' .n-cta-ico { font-size:40px; }',
    S + ' .n-cta-copy { flex:1 1 260px; }',
    S + ' .n-cta-title { font-family:var(--npg-serif); font-size:1.5em; font-weight:800; margin-bottom:4px; }',
    S + ' .n-cta-text { color:#cfd2de; }',
    S + ' .n-cta-btn-wrap .n-btn-accent { background:var(--npg-accent); color:#fff; }',
    '/* ── chart ── */',
    S + ' .n-chart-card { border:1px solid var(--npg-line); padding:22px; background:var(--npg-bg); }',
    S + ' .n-chart-title { font-family:var(--npg-serif); font-size:1.2em; font-weight:800; margin-bottom:14px; }',
    S + ' .n-chart-canvas-wrap { position:relative; }',
    S + ' .n-chart-canvas { width:100%; height:340px; display:block; }',
    S + ' .n-chart-source { font-family:var(--npg-sans); font-size:.74em; color:var(--npg-dim); margin-top:10px; }',
    '/* ── compare ── */',
    S + ' .n-cmp-stage { position:relative; overflow:hidden; user-select:none; touch-action:none; border:1px solid var(--npg-rule); }',
    S + ' .n-cmp-after { width:100%; display:block; aspect-ratio:16/10; object-fit:cover; }',
    S + ' .n-cmp-before-wrap { position:absolute; inset:0; overflow:hidden; clip-path:inset(0 calc(100% - 50%) 0 0); }',
    S + ' .n-cmp-before { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; max-width:none; }',
    S + ' .n-cmp-handle { position:absolute; top:0; bottom:0; left:50%; width:3px; background:#fff; cursor:ew-resize; transform:translateX(-50%); box-shadow:0 0 0 1px rgba(0,0,0,.25); }',
    S + ' .n-cmp-handle::after { content:""; position:absolute; inset:-14px -9px; }',
    S + ' .n-cmp-grip { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:44px; height:44px; border-radius:50%; background:#fff; box-shadow:0 4px 14px rgba(0,0,0,.35); display:flex; align-items:center; justify-content:center; font-weight:800; color:#101828; }',
    S + ' .n-cmp-tag { position:absolute; top:14px; font-family:var(--npg-sans); font-size:.72em; font-weight:800; letter-spacing:.08em; text-transform:uppercase; padding:6px 12px; background:rgba(10,15,30,.75); color:#fff; }',
    S + ' .n-cmp-tag-b { left:14px; } .n-cmp-tag-a { right:14px; }',
    S + ' .n-cmp-cap { font-family:var(--npg-sans); font-size:.76em; color:var(--npg-dim); margin-top:10px; }',
    '/* ── countdown ── */',
    S + ' .n-cd-card { text-align:center; border:1px solid var(--npg-rule); padding:28px; background:var(--npg-bg); }',
    S + ' .n-cd-title { font-family:var(--npg-serif); font-size:1.3em; font-weight:800; margin-bottom:18px; }',
    S + ' .n-cd-row { display:flex; gap:12px; justify-content:center; flex-wrap:wrap; }',
    S + ' .n-cd-cell { min-width:86px; background:var(--npg-bg); border:1px solid var(--npg-line); padding:12px 10px; }',
    S + ' .n-cd-num { display:block; font-family:var(--npg-serif); font-size:clamp(26px,4vw,40px); font-weight:800; color:var(--npg-ink); font-variant-numeric:tabular-nums; }',
    S + ' .n-cd-label { font-family:var(--npg-sans); font-size:.7em; letter-spacing:.12em; text-transform:uppercase; color:var(--npg-dim); }',
    S + ' .n-cd-note { margin-top:14px; font-family:var(--npg-sans); font-size:.78em; color:var(--npg-dim); }',
    S + ' .n-cd-ended { margin-top:14px; font-family:var(--npg-sans); font-weight:800; color:var(--npg-accent); }',
    '/* ── tabs ── */',
    S + ' .n-tabs { display:flex; gap:2px; flex-wrap:wrap; border-bottom:1px solid var(--npg-rule); margin-bottom:20px; }',
    S + ' .n-tabs-btn { font-family:var(--npg-sans); font-weight:800; font-size:.84em; border:none; background:none; padding:10px 16px; cursor:pointer; color:var(--npg-dim); border-bottom:3px solid transparent; margin-bottom:-1px; text-transform:uppercase; letter-spacing:.06em; }',
    S + ' .n-tabs-btn.active { color:var(--npg-ink); border-bottom-color:var(--npg-accent); }',
    S + ' .n-tabs-panel { display:none; }',
    S + ' .n-tabs-panel.active { display:block; }',
    '/* ── table ── */',
    S + ' .n-table-scroll { overflow-x:auto; border-top:1px solid var(--npg-rule); }',
    S + ' .n-table-el { width:100%; border-collapse:collapse; font-size:.92em; min-width:420px; }',
    S + ' .n-table-el caption { text-align:left; font-family:var(--npg-serif); font-weight:800; padding-bottom:10px; caption-side:top; }',
    S + ' .n-table-el th, .n-table-el td { border-bottom:1px solid var(--npg-line); padding:10px 12px; text-align:left; }',
    S + ' .n-table-el th { font-family:var(--npg-sans); font-size:.8em; text-transform:uppercase; letter-spacing:.06em; background:var(--npg-bg); }',
    S + ' .n-table-el tr:hover td { background:color-mix(in srgb,var(--npg-ink) 4%,var(--npg-bg)); }',
    '/* ── video / audio ── */',
    S + ' .n-video-el { width:100%; aspect-ratio:16/9; background:#000; }',
    S + ' .n-video-fig figcaption { font-family:var(--npg-sans); font-size:.76em; color:var(--npg-dim); margin-top:8px; }',
    S + ' .n-audio-el { width:100%; }',
    S + ' .n-audio-title { font-family:var(--npg-sans); font-weight:800; font-size:.82em; letter-spacing:.08em; text-transform:uppercase; margin-bottom:8px; }',
    S + ' .n-audio-cap { font-family:var(--npg-sans); font-size:.74em; color:var(--npg-dim); margin-top:6px; }',
    '/* ── infobox ── */',
    S + ' .n-ibox { padding:16px 18px; margin:1.4em 0; font-size:.95em; }',
    S + ' .n-ibox-info { background:#eef3fa; border-left:4px solid var(--npg-primary); }',
    S + ' .n-ibox-warning { background:#faf4e8; border-left:4px solid var(--npg-accent); }',
    S + ' .n-ibox-success { background:#e9f6ee; border-left:4px solid #15803d; }',
    S + ' .n-ibox-danger { background:#faecec; border-left:4px solid #b91c1c; }',
    S + ' .n-ibox-title { display:block; margin-bottom:4px; }',
    '/* ── steps ── */',
    S + ' .n-steps-list { list-style:none; display:flex; flex-direction:column; }',
    S + ' .n-step { display:flex; gap:16px; border-bottom:1px solid var(--npg-line); padding:14px 0; }',
    S + ' .n-step:last-child { border-bottom:none; }',
    S + ' .n-step-num { flex:0 0 auto; width:38px; height:38px; border:2px solid var(--npg-rule); color:var(--npg-ink); background:var(--npg-bg); display:flex; align-items:center; justify-content:center; font-family:var(--npg-serif); font-weight:800; }',
    S + ' .n-step-title { font-family:var(--npg-serif); font-size:1.08em; font-weight:800; }',
    S + ' .n-step-text { color:var(--npg-dim); font-size:.95em; margin-top:2px; }',
    '/* ── mapcard ── */',
    S + ' .n-map-card { display:flex; gap:20px; flex-wrap:wrap; border:1px solid var(--npg-rule); overflow:hidden; background:var(--npg-bg); }',
    S + ' .n-map-media { flex:1 1 280px; }',
    S + ' .n-map-media img { width:100%; height:100%; object-fit:cover; min-height:200px; filter:grayscale(20%); }',
    S + ' .n-map-body { flex:1 1 280px; padding:22px; position:relative; }',
    S + ' .n-map-body::before { content:""; position:absolute; inset:0; background:radial-gradient(circle at 85% 15%,color-mix(in srgb,var(--npg-accent) 14%,transparent),transparent 60%); }',
    S + ' .n-map-body > * { position:relative; }',
    S + ' .n-map-pin { font-size:34px; display:block; margin-bottom:8px; }',
    S + ' .n-map-kicker { font-family:var(--npg-sans); font-size:.72em; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:var(--npg-accent); }',
    S + ' .n-map-place { font-family:var(--npg-serif); font-size:1.4em; font-weight:800; margin:2px 0 6px; }',
    S + ' .n-map-address, .n-map-region, .n-map-note { color:var(--npg-dim); font-size:.92em; }',
    S + ' .n-map-note { margin-top:10px; }',
    '/* ── tags ── */',
    S + ' .n-tags-row { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }',
    S + ' .n-tags-title { font-family:var(--npg-sans); font-weight:800; font-size:.78em; text-transform:uppercase; letter-spacing:.1em; color:var(--npg-dim); margin-right:6px; }',
    S + ' .n-tag { font-family:var(--npg-sans); font-size:.8em; padding:6px 14px; border:1px solid var(--npg-line); color:var(--npg-ink); font-weight:700; }',
    S + ' .n-tag:hover { border-color:var(--npg-rule); }',
    '/* ── author card ── */',
    S + ' .n-author-card { display:flex; gap:16px; align-items:flex-start; border-top:1px solid var(--npg-rule); border-bottom:1px solid var(--npg-rule); padding:22px 0; background:var(--npg-bg); }',
    S + ' .n-author-avatar { width:74px; height:74px; border-radius:50%; object-fit:cover; flex:0 0 auto; filter:grayscale(25%); }',
    S + ' .n-author-avatar-txt { display:flex; align-items:center; justify-content:center; background:var(--npg-ink); color:#fff; font-family:var(--npg-serif); font-size:26px; font-weight:800; }',
    S + ' .n-author-name { font-family:var(--npg-serif); font-size:1.1em; font-weight:800; display:block; }',
    S + ' .n-author-role { font-family:var(--npg-sans); font-size:.74em; color:var(--npg-accent); font-weight:800; letter-spacing:.08em; text-transform:uppercase; }',
    S + ' .n-author-bio { font-size:.92em; color:var(--npg-dim); margin-top:6px; }',
    S + ' .n-author-links { display:flex; gap:12px; margin-top:8px; font-family:var(--npg-sans); font-size:.85em; }',
    '/* ── divider ── */',
    S + ' .n-divider { display:flex; align-items:center; gap:14px; max-width:1080px; margin:0 auto; padding:8px 20px; color:var(--npg-dim); font-family:var(--npg-sans); font-size:.85em; }',
    S + ' .n-div-line { flex:1 1 auto; height:1px; background:var(--npg-line); }',
    '/* ── widget ── */',
    S + ' .n-widget .n-widget-note { border:1px dashed var(--npg-line); padding:14px; text-align:center; color:var(--npg-dim); font-family:var(--npg-sans); font-size:.82em; }',
    '/* ── breaking strip ── */',
    S + ' .n-breaking { display:flex; align-items:center; gap:14px; flex-wrap:wrap; background:#7f1d1d; color:#fff; padding:12px 20px; }',
    S + ' .n-breaking-badge { display:inline-flex; align-items:center; gap:8px; font-family:var(--npg-sans); font-size:.72em; font-weight:800; letter-spacing:.16em; text-transform:uppercase; background:rgba(255,255,255,.16); padding:6px 12px; }',
    S + ' .n-breaking-badge .n-live-dot { background:#fff; }',
    S + ' .n-breaking-text { font-family:var(--npg-serif); font-weight:700; font-size:1.02em; flex:1 1 240px; }',
    S + ' .n-breaking-time { font-family:var(--npg-sans); font-size:.74em; letter-spacing:.08em; color:#f3c9c9; }',
    '/* ── liveblog ── */',
    S + ' .n-live-head { display:flex; align-items:center; gap:10px; margin-bottom:18px; }',
    S + ' .n-live-label { font-family:var(--npg-sans); font-size:.8em; font-weight:800; letter-spacing:.2em; text-transform:uppercase; color:var(--npg-accent); }',
    S + ' .n-live-list { list-style:none; position:relative; padding-left:26px; }',
    S + ' .n-live-list::before { content:""; position:absolute; left:6px; top:8px; bottom:8px; width:2px; background:var(--npg-line); }',
    S + ' .n-live-entry { position:relative; margin-bottom:22px; }',
    S + ' .n-live-entry::before { content:""; position:absolute; left:-24px; top:6px; width:10px; height:10px; border-radius:50%; background:var(--npg-accent); box-shadow:0 0 0 3px var(--npg-bg); }',
    S + ' .n-live-time { font-family:var(--npg-sans); font-size:.74em; font-weight:800; letter-spacing:.1em; color:var(--npg-accent); }',
    S + ' .n-live-tag { display:inline-block; font-family:var(--npg-sans); font-size:.66em; font-weight:800; letter-spacing:.14em; text-transform:uppercase; padding:2px 8px; border:1px solid var(--npg-line); color:var(--npg-dim); margin:2px 0 6px; }',
    S + ' .n-live-tag-quote { color:#6d28d9; border-color:#d6c9f2; }',
    S + ' .n-live-tag-fact { color:#15803d; border-color:#bfe3cd; }',
    S + ' .n-live-tag-milestone { color:var(--npg-accent); border-color:#f0c4c4; }',
    S + ' .n-live-text { font-size:1.02em; }',
    '/* ── key points ── */',
    S + ' .n-keypoints-card { border-top:3px solid var(--npg-rule); border-bottom:1px solid var(--npg-line); padding:20px 0; }',
    S + ' .n-keypoints-title { font-family:var(--npg-sans); font-size:.82em; font-weight:800; letter-spacing:.14em; text-transform:uppercase; margin-bottom:12px; }',
    S + ' .n-keypoints-list { list-style:none; display:flex; flex-direction:column; gap:8px; }',
    S + ' .n-keypoints-list li { padding-left:26px; position:relative; font-size:1.02em; }',
    S + ' .n-keypoints-list li::before { content:"✓"; position:absolute; left:0; top:0; color:var(--npg-accent); font-weight:800; }',
    '/* ── fact check ── */',
    S + ' .n-fc-card { border:1px solid var(--npg-line); border-left:6px solid #9ca3af; padding:22px; background:var(--npg-bg); }',
    S + ' .n-fc-label { display:block; font-family:var(--npg-sans); font-size:.74em; font-weight:800; letter-spacing:.16em; text-transform:uppercase; color:var(--npg-dim); margin-bottom:10px; }',
    S + ' .n-fc-claim { font-family:var(--npg-serif); font-size:1.3em; font-style:italic; font-weight:700; line-height:1.4; margin-bottom:12px; }',
    S + ' .n-fc-verdict { display:inline-block; font-family:var(--npg-sans); font-size:.78em; font-weight:800; letter-spacing:.12em; text-transform:uppercase; padding:5px 12px; color:#fff; background:#9ca3af; margin-bottom:8px; }',
    S + ' .n-fc-by { font-family:var(--npg-sans); font-size:.8em; color:var(--npg-dim); margin-left:8px; }',
    S + ' .n-fc-expl { margin-top:10px; font-size:.98em; color:color-mix(in srgb,var(--npg-ink) 78%,var(--npg-bg)); }',
    S + ' .n-fc-true { border-left-color:#15803d; } .n-fc-true .n-fc-verdict { background:#15803d; }',
    S + ' .n-fc-mostly-true { border-left-color:#65a30d; } .n-fc-mostly-true .n-fc-verdict { background:#65a30d; }',
    S + ' .n-fc-half-true { border-left-color:#d97706; } .n-fc-half-true .n-fc-verdict { background:#d97706; }',
    S + ' .n-fc-mostly-false { border-left-color:#ea580c; } .n-fc-mostly-false .n-fc-verdict { background:#ea580c; }',
    S + ' .n-fc-false { border-left-color:#b91c1c; } .n-fc-false .n-fc-verdict { background:#b91c1c; }',
    '/* ── scorecard ── */',
    S + ' .n-score-card { position:relative; background:#12141c; color:#fff; padding:26px 22px; text-align:center; }',
    S + ' .n-score-sport { display:block; font-family:var(--npg-sans); font-size:.72em; font-weight:800; letter-spacing:.2em; text-transform:uppercase; color:#9aa0b4; }',
    S + ' .n-score-status { display:inline-block; font-family:var(--npg-sans); font-size:.72em; font-weight:800; letter-spacing:.14em; text-transform:uppercase; background:var(--npg-accent); color:#fff; padding:4px 12px; margin:10px 0 14px; }',
    S + ' .n-score-row { display:flex; align-items:baseline; justify-content:center; gap:18px; flex-wrap:wrap; }',
    S + ' .n-score-team { font-family:var(--npg-sans); font-weight:800; font-size:1.02em; }',
    S + ' .n-score-num { font-family:var(--npg-serif); font-size:clamp(40px,6vw,64px); font-weight:800; line-height:1; font-variant-numeric:tabular-nums; }',
    S + ' .n-score-div { color:#9aa0b4; }',
    S + ' .n-score-venue { display:block; font-family:var(--npg-sans); font-size:.74em; color:#9aa0b4; margin-top:12px; }',
    S + ' .n-score-note { font-family:var(--npg-sans); font-size:.8em; color:#c6c9d6; margin-top:8px; }',
    '/* ── photo story ── */',
    S + ' .n-ps-head { margin-bottom:16px; }',
    S + ' .n-ps-title { font-family:var(--npg-serif); font-size:clamp(20px,2.4vw,28px); font-weight:800; }',
    S + ' .n-ps-fig { border-bottom:1px solid var(--npg-rule); padding-bottom:10px; }',
    S + ' .n-ps-img { width:100%; aspect-ratio:16/9; object-fit:cover; }',
    S + ' .n-ps-cap { display:flex; justify-content:space-between; gap:14px; flex-wrap:wrap; padding-top:8px; }',
    S + ' .n-ps-caption { font-family:var(--npg-serif); font-style:italic; font-size:.95em; color:color-mix(in srgb,var(--npg-ink) 78%,var(--npg-bg)); }',
    S + ' .n-ps-credit { font-family:var(--npg-sans); font-size:.72em; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--npg-dim); }',
    '/* ── person card ── */',
    S + ' .n-person-card { display:flex; gap:20px; align-items:flex-start; border-top:1px solid var(--npg-rule); border-bottom:1px solid var(--npg-line); padding:22px 0; }',
    S + ' .n-person-photo { width:110px; height:110px; border-radius:50%; object-fit:cover; flex:0 0 auto; filter:grayscale(25%); }',
    S + ' .n-person-photo-txt { display:flex; align-items:center; justify-content:center; background:var(--npg-ink); color:#fff; font-family:var(--npg-serif); font-size:34px; font-weight:800; }',
    S + ' .n-person-kicker { display:block; font-family:var(--npg-sans); font-size:.7em; font-weight:800; letter-spacing:.16em; text-transform:uppercase; color:var(--npg-accent); }',
    S + ' .n-person-name { font-family:var(--npg-serif); font-size:1.3em; font-weight:800; margin:2px 0; }',
    S + ' .n-person-role { font-family:var(--npg-sans); font-size:.84em; font-weight:700; color:var(--npg-dim); }',
    S + ' .n-person-bio { font-size:.95em; color:var(--npg-dim); margin-top:8px; }',
    S + ' .n-person-quote { font-family:var(--npg-serif); font-style:italic; font-size:1.05em; border-left:3px solid var(--npg-accent); padding-left:14px; margin-top:10px; }',
    S + ' .n-person-connection { font-size:.88em; margin-top:10px; }',
    '/* ── editor note / corrections ── */',
    S + ' .n-ednote-box { font-family:var(--npg-serif); font-style:italic; font-size:.98em; color:color-mix(in srgb,var(--npg-ink) 78%,var(--npg-bg)); border-top:1px solid var(--npg-line); border-bottom:1px solid var(--npg-line); padding:14px 0; }',
    S + ' .n-ednote-box strong { font-family:var(--npg-sans); font-style:normal; font-size:.8em; letter-spacing:.1em; text-transform:uppercase; color:var(--npg-dim); margin-right:8px; }',
    S + ' .n-corrections-p { font-family:var(--npg-sans); font-size:.78em; color:var(--npg-dim); border-top:1px solid var(--npg-line); padding-top:12px; }',
    '/* ── quiz ── */',
    S + ' .n-quiz-card { border:1px solid var(--npg-rule); padding:24px; background:var(--npg-bg); }',
    S + ' .n-quiz-title { font-family:var(--npg-serif); font-size:1.3em; font-weight:800; margin-bottom:16px; }',
    S + ' .n-quiz-q { margin-bottom:16px; }',
    S + ' .n-quiz-q-title { font-family:var(--npg-serif); font-size:1.05em; font-weight:800; margin-bottom:8px; }',
    S + ' .n-quiz-opts { display:flex; flex-direction:column; gap:6px; }',
    S + ' .n-quiz-opt { text-align:left; font:inherit; font-size:.95em; border:1px solid var(--npg-line); background:var(--npg-bg); color:inherit; border-radius:3px; padding:9px 14px; cursor:pointer; }',
    S + ' .n-quiz-opt:hover { border-color:var(--npg-rule); }',
    S + ' .n-quiz-opt.n-quiz-picked { border-color:var(--npg-primary); background:color-mix(in srgb,var(--npg-primary) 8%,var(--npg-bg)); }',
    S + ' .n-quiz-opt.n-quiz-right { border-color:#15803d; background:color-mix(in srgb,#15803d 10%,var(--npg-bg)); }',
    S + ' .n-quiz-opt.n-quiz-wrong { border-color:#b91c1c; background:color-mix(in srgb,#b91c1c 10%,var(--npg-bg)); }',
    S + ' .n-quiz-actions { margin-top:12px; }',
    S + ' .n-quiz-result { margin-top:14px; border-top:1px solid var(--npg-line); padding-top:12px; }',
    S + ' .n-quiz-score { font-family:var(--npg-serif); font-size:1.15em; font-weight:800; }',
    S + ' .n-quiz-result-actions { display:flex; gap:8px; margin-top:8px; flex-wrap:wrap; }',
    S + ' .n-quiz-share, .n-quiz-retry { font-family:var(--npg-sans); font-size:.82em; font-weight:700; border:1px solid var(--npg-line); background:var(--npg-bg); color:var(--npg-ink); border-radius:3px; padding:7px 12px; cursor:pointer; }',
    S + ' .n-quiz-share:hover, .n-quiz-retry:hover { border-color:var(--npg-rule); }',
    S + ' .n-quiz-note { font-family:var(--npg-sans); font-size:.74em; color:var(--npg-dim); margin-top:10px; }',
    '/* ── heat strip ── */',
    S + ' .n-heat { display:flex; align-items:stretch; gap:2px; height:230px; border-bottom:1px solid var(--npg-rule); }',
    S + ' .n-heat-cell { flex:1 1 0; display:flex; flex-direction:column; justify-content:flex-end; align-items:center; gap:6px; min-width:0; }',
    S + ' .n-heat-bar { width:100%; max-width:64px; background:linear-gradient(180deg,var(--npg-accent),var(--npg-primary)); border-radius:2px 2px 0 0; }',
    S + ' .n-heat-val { font-family:var(--npg-serif); font-weight:800; font-size:1.05em; }',
    S + ' .n-heat-val small { font-size:.7em; color:var(--npg-dim); margin-left:2px; }',
    S + ' .n-heat-label { font-family:var(--npg-sans); font-size:.68em; letter-spacing:.04em; text-transform:uppercase; color:var(--npg-dim); text-align:center; padding:0 4px; }',
    '/* ── annotated map ── */',
    S + ' .n-amap-fig { border:1px solid var(--npg-line); }',
    S + ' .n-amap-svg { width:100%; height:auto; min-height:240px; display:block; }',
    S + ' .n-amap-point circle { fill:var(--npg-accent); stroke:var(--npg-bg); stroke-width:.8; }',
    S + ' .n-amap-point:hover circle { fill:var(--npg-primary); }',
    S + ' .n-amap-label { font-family:var(--npg-sans); font-size:3px; font-weight:800; fill:var(--npg-ink); paint-order:stroke; stroke:var(--npg-bg); stroke-width:.7px; }',
    S + ' .n-amap-fig figcaption { padding:8px 10px; font-family:var(--npg-sans); }',
    '/* ── org chart ── */',
    S + ' .n-org ul { list-style:none; padding-left:22px; border-left:1px solid var(--npg-line); margin-left:8px; }',
    S + ' .n-org > ul { border-left:none; margin-left:0; padding-left:0; }',
    S + ' .n-org details { margin:6px 0; }',
    S + ' .n-org summary { cursor:pointer; display:flex; align-items:baseline; gap:8px; font-family:var(--npg-sans); }',
    S + ' .n-org summary b { font-size:.95em; }',
    S + ' .n-org summary small { color:var(--npg-accent); font-size:.72em; font-weight:800; letter-spacing:.06em; text-transform:uppercase; }',
    S + ' .n-org summary::marker { color:var(--npg-accent); }',
    S + ' .n-org-note { font-family:var(--npg-sans); font-size:.78em; color:var(--npg-dim); margin:4px 0 2px; }',
    '/* ── video compare ── */',
    S + ' .n-vcmp-stage { position:relative; overflow:hidden; user-select:none; touch-action:none; border:1px solid var(--npg-rule); }',
    S + ' .n-vcmp-after, .n-vcmp-before { width:100%; display:block; aspect-ratio:16/9; object-fit:cover; background:#000; }',
    S + ' .n-vcmp-before-wrap { position:absolute; inset:0; overflow:hidden; clip-path:inset(0 calc(100% - 50%) 0 0); }',
    S + ' .n-vcmp-before { position:absolute; inset:0; width:100%; height:100%; max-width:none; }',
    S + ' .n-vcmp-handle { position:absolute; top:0; bottom:0; left:50%; width:3px; background:#fff; cursor:ew-resize; transform:translateX(-50%); box-shadow:0 0 0 1px rgba(0,0,0,.25); }',
    S + ' .n-vcmp-grip { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:44px; height:44px; border-radius:50%; background:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; color:#101828; box-shadow:0 4px 14px rgba(0,0,0,.35); }',
    S + ' .n-vcmp-play { position:absolute; bottom:14px; left:50%; transform:translateX(-50%); font-family:var(--npg-sans); font-size:.8em; font-weight:800; background:rgba(10,15,30,.75); color:#fff; border:none; border-radius:99px; padding:7px 16px; cursor:pointer; }',
    '/* ── scrollytelling ── */',
    S + ' .n-scrolly-wrap { display:grid; grid-template-columns:1fr 1fr; gap:clamp(18px,4vw,48px); align-items:start; }',
    S + ' .n-scrolly-stage { position:sticky; top:14px; aspect-ratio:16/10; border:1px solid var(--npg-rule); overflow:hidden; background:#10141d; }',
    S + ' .n-scrolly-frame { position:absolute; inset:0; opacity:0; transition:opacity .6s ease; }',
    S + ' .n-scrolly-frame.active { opacity:1; }',
    S + ' .n-scrolly-frame img { width:100%; height:100%; object-fit:cover; }',
    S + ' .n-scrolly-frame-empty { width:100%; height:100%; background:linear-gradient(135deg,var(--npg-primary),var(--npg-accent)); }',
    S + ' .n-scrolly-cap { position:absolute; inset:auto 0 0 0; padding:26px 14px 10px; font-family:var(--npg-serif); font-weight:800; color:#fff; background:linear-gradient(transparent,rgba(0,0,0,.75)); }',
    S + ' .n-scrolly-chapter { padding:24px 18px; border-left:3px solid var(--npg-line); margin-bottom:14px; background:var(--npg-bg); transition:border-color .3s; }',
    S + ' .n-scrolly-chapter.n-scrolly-on { border-left-color:var(--npg-accent); background:color-mix(in srgb,var(--npg-accent) 4%,var(--npg-bg)); }',
    S + ' .n-scrolly-ch-title { font-family:var(--npg-serif); font-size:1.2em; font-weight:800; }',
    S + ' .n-scrolly-ch-text { font-size:.95em; color:var(--npg-dim); margin-top:6px; }',
    '@media (max-width:860px) { ' + S + ' .n-scrolly-wrap { grid-template-columns:1fr; } ' + S + ' .n-scrolly-stage { position:static; } }',
    '/* ── comments ── */',
    S + ' .n-comments-box { border-top:3px solid var(--npg-rule); padding:20px 0; }',
    S + ' .n-comments-title { font-family:var(--npg-serif); font-size:1.2em; font-weight:800; margin-bottom:12px; }',
    S + ' .n-comments-form { display:flex; flex-direction:column; gap:10px; }',
    S + ' .n-comments-form textarea { font:inherit; font-size:.95em; padding:10px 12px; border:1px solid var(--npg-line); border-radius:3px; resize:vertical; min-height:80px; }',
    S + ' .n-comments-form textarea:focus { border-color:var(--npg-primary); outline:none; }',
    S + ' .n-comments-hp { position:absolute; left:-9999px; }',
    S + ' .n-comments-form [data-gw-form-status] { font-family:var(--npg-sans); font-size:.8em; color:var(--npg-dim); }',
    S + ' .n-comments-placeholder { border-top-style:dashed; }',
    '/* ── responsive ── */',
    '@media (max-width:900px) {',
    '  ' + S + ' .n-hero-split .n-hero-inner { grid-template-columns:1fr; }',
    '  ' + S + ' .n-gal-cols-3, ' + S + ' .n-gal-cols-4 { grid-template-columns:repeat(2,1fr); }',
    '}',
    '@media (max-width:560px) {',
    '  ' + S + ' .n-gal-cols-2, ' + S + ' .n-gal-cols-3, ' + S + ' .n-gal-cols-4 { grid-template-columns:1fr; }',
    '  ' + S + ' .n-cta-card { flex-direction:column; text-align:center; }',
    '  ' + S + ' .n-author-card, ' + S + ' .n-person-card { flex-direction:column; align-items:center; text-align:center; }',
    '  ' + S + ' .n-author-links { justify-content:center; }',
    '  ' + S + ' .n-rel-card { flex-direction:column; align-items:flex-start; }',
    '  ' + S + ' .n-rel-media { flex:none; }',
    '  ' + S + ' .n-rel-media img { width:100%; }',
    '  ' + S + ' .n-rel-arrow { display:none; }',
    '  ' + S + ' .n-person-quote { border-left:none; padding-left:0; }',
    '}',
    '/* ── newsprint print stylesheet (Phase 2 · B4) ── */',
    '@media print {',
    '  ' + S + ' { background:#fff !important; color:#000 !important; font-size:12pt; }',
    '  ' + S + ' .n-progress, ' + S + ' .n-ticker, ' + S + ' .n-share, ' + S + ' .n-reactions, ' + S + ' .n-lightbox { display:none !important; }',
    '  ' + S + ' .n-reveal { opacity:1 !important; transform:none !important; }',
    '  ' + S + ' .n-sec { page-break-inside:auto; padding:14px 0; }',
    '  ' + S + ' .n-hero, ' + S + ' .n-facts, ' + S + ' .n-quote, ' + S + ' .n-fig, ' + S + ' .n-person-card, ' + S + ' .n-author-card, ' + S + ' .n-score-card, ' + S + ' .n-cta-card { page-break-inside:avoid; }',
    '  ' + S + ' .n-hero-title { font-size:26pt; }',
    '  ' + S + ' a { color:#000 !important; text-decoration:underline; }',
    '  ' + S + ' .n-cta-card, ' + S + ' .n-score-card { background:#fff !important; color:#000 !important; border:1px solid #000; }',
    '  ' + S + ' .n-cta-text, ' + S + ' .n-score-venue, ' + S + ' .n-score-note { color:#222 !important; }',
    '}'
  ].join('\n');
}

function buildPageJs(slug, used) {
  var h = [];
  h.push('(function () {');
  h.push('"use strict";');
  h.push('var ROOT = document.querySelector(".news-' + slug + '");');
  h.push('if (!ROOT) return;');
  h.push('if (ROOT.getAttribute("data-ng-init") === "1") return;');
  h.push('ROOT.setAttribute("data-ng-init", "1");');
  h.push('var gw = (typeof window !== "undefined" && window.gw) ? window.gw : null;');
  h.push('function q(s){ return ROOT.querySelector(s); }');
  h.push('function qa(s){ return Array.prototype.slice.call(ROOT.querySelectorAll(s)); }');
  h.push('function storeGet(k){ try { return (gw && gw.storage && gw.storage.get) ? gw.storage.get(k) : null; } catch(e){ return null; } }');
  h.push('function storeSet(k,v){ try { if (gw && gw.storage && gw.storage.set) gw.storage.set(k, String(v)); } catch(e){} }');
  h.push('function routeCleanup(fn){ if (gw && gw.onRouteChange) { var off = gw.onRouteChange(function(){ try{ fn(); }catch(e){} if (off) off(); }); } }');
  h.push('function addWin(evt, fn, opts){ window.addEventListener(evt, fn, opts || false); routeCleanup(function(){ window.removeEventListener(evt, fn); }); }');
  h.push('function notify(m){ try { if (gw && gw.notify) gw.notify(m, { severity: "info" }); } catch(e){} }');

  /* reveal-on-scroll (always) */
  h.push('(function(){try{');
  h.push('var rev = qa(".n-reveal");');
  h.push('if (rev.length && "IntersectionObserver" in window) {');
  h.push('var io = new IntersectionObserver(function(es){');
  h.push('es.forEach(function(e){ if (e.isIntersecting) { e.target.classList.add("n-in"); io.unobserve(e.target); } });');
  h.push('}, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });');
  h.push('rev.forEach(function(elr){ io.observe(elr); });');
  h.push('} else { rev.forEach(function(elr){ elr.classList.add("n-in"); }); }');
  h.push('}catch(e){ if (window.gw && window.gw.notify) { try { window.gw.notify("Script error: " + e.message, { severity: "warning" }); } catch(_e){} } }})();');

  /* keyfacts — count up */
  if (used.keyfacts) {
    h.push('(function(){try{');
    h.push('var vals = qa(".n-stat-value");');
    h.push('if (!vals.length) return;');
    h.push('function animate(elm){');
    h.push('var target = parseFloat(elm.getAttribute("data-count")) || 0;');
    h.push('var dec = parseInt(elm.getAttribute("data-dec"), 10) || 0;');
    h.push('var t0 = null, D = 1400;');
    h.push('function step(ts){ if (!t0) t0 = ts; var p = Math.min(1, (ts - t0) / D);');
    h.push('p = 1 - Math.pow(1 - p, 3);');
    h.push('var v = target * p;');
    h.push('elm.textContent = dec ? v.toFixed(dec) : Math.round(v).toLocaleString();');
    h.push('if (p < 1) requestAnimationFrame(step); }');
    h.push('requestAnimationFrame(step); }');
    h.push('if ("IntersectionObserver" in window) {');
    h.push('var io2 = new IntersectionObserver(function(es){ es.forEach(function(e){ if (e.isIntersecting) { animate(e.target); io2.unobserve(e.target); } }); }, { threshold: .4 });');
    h.push('vals.forEach(function(v){ io2.observe(v); });');
    h.push('} else { vals.forEach(animate); }');
    h.push('}catch(e){ if (window.gw && window.gw.notify) { try { window.gw.notify("Script error: " + e.message, { severity: "warning" }); } catch(_e){} } }})();');
  }

  /* gallery — lightbox */
  if (used.gallery) {
    h.push('(function(){try{');
    h.push('var grids = qa(".n-gal-grid");');
    h.push('if (!grids.length) return;');
    h.push('var lb = null, imgs = [], idx = 0;');
    h.push('function close(){ if (lb) { document.body.removeChild(lb); lb = null; } }');
    h.push('function show(i){ if (lb) close(); idx = (i + imgs.length) % imgs.length;');
    h.push('var it = imgs[idx];');
    h.push('lb = document.createElement("div"); lb.className = "n-lightbox";');
    h.push('var img = document.createElement("img"); img.src = it.src; img.alt = it.alt || "";');
    h.push('var cap = document.createElement("div"); cap.className = "n-lightbox-cap"; cap.textContent = it.caption || "";');
    h.push('var prev = document.createElement("button"); prev.className = "n-lightbox-btn n-lightbox-prev"; prev.textContent = "‹"; prev.setAttribute("aria-label", "Previous image");');
    h.push('var next = document.createElement("button"); next.className = "n-lightbox-btn n-lightbox-next"; next.textContent = "›"; next.setAttribute("aria-label", "Next image");');
    h.push('var cls = document.createElement("button"); cls.className = "n-lightbox-close"; cls.textContent = "✕"; cls.setAttribute("aria-label", "Close");');
    h.push('prev.onclick = function(){ show(idx - 1); }; next.onclick = function(){ show(idx + 1); }; cls.onclick = close;');
    h.push('lb.onclick = function(e){ if (e.target === lb) close(); };');
    h.push('lb.appendChild(prev); lb.appendChild(img); lb.appendChild(next); lb.appendChild(cap); lb.appendChild(cls);');
    h.push('document.body.appendChild(lb);');
    h.push('function onKey(e){ if (!lb) return; if (e.key === "Escape") close(); if (e.key === "ArrowLeft") show(idx - 1); if (e.key === "ArrowRight") show(idx + 1); }');
    h.push('addWin("keydown", onKey);');
    h.push('}');
    h.push('grids.forEach(function(grid){');
    h.push('Array.prototype.forEach.call(grid.querySelectorAll(".n-gal-item"), function(btn){');
    h.push('var im = btn.querySelector("img");');
    h.push('var capEl = btn.querySelector(".n-gal-cap");');
    h.push('imgs.push({ src: im ? im.src : "", alt: im ? im.alt : "", caption: capEl ? capEl.textContent : "" });');
    h.push('btn.addEventListener("click", function(){ show(imgs.length ? imgs.indexOf(imgs.filter(function(x){ return x.src === (im && im.src); })[0]) : 0); });');
    h.push('});');
    h.push('});');
    h.push('}catch(e){ if (window.gw && window.gw.notify) { try { window.gw.notify("Script error: " + e.message, { severity: "warning" }); } catch(_e){} } }})();');
  }

  /* poll */
  if (used.poll) {
    h.push('(function(){try{');
    h.push('Array.prototype.forEach.call(qa(".n-poll-card"), function(card){');
    h.push('var key = card.getAttribute("data-poll-key") || "poll";');
    h.push('var vote = parseInt(storeGet(key), 10); if (isNaN(vote)) vote = null;');
    h.push('var opts = Array.prototype.slice.call(card.querySelectorAll(".n-poll-opt"));');
    h.push('function render(){');
    h.push('var total = opts.reduce(function(a,o){ var n = parseInt(o.getAttribute("data-votes"), 10) || 0; return a + n; }, 0);');
    h.push('opts.forEach(function(o, i){');
    h.push('var n = parseInt(o.getAttribute("data-votes"), 10) || 0;');
    h.push('var pct = total ? Math.round(n / total * 100) : 0;');
    h.push('o.querySelector(".n-poll-bar").style.width = pct + "%";');
    h.push('var pctEl = o.querySelector(".n-poll-pct");');
    h.push('pctEl.textContent = (vote !== null) ? pct + "%" : "";');
    h.push('if (vote === i) o.classList.add("n-poll-picked");');
    h.push('});');
    h.push('}');
    h.push('if (vote !== null) card.classList.add("n-poll-done");');
    h.push('opts.forEach(function(o, i){');
    h.push('o.addEventListener("click", function(){ if (vote !== null) return;');
    h.push('vote = i; storeSet(key, i); card.classList.add("n-poll-done");');
    h.push('var cur = parseInt(o.getAttribute("data-votes"), 10) || 0; o.setAttribute("data-votes", cur + 1);');
    h.push('render(); notify("Vote recorded (demo)"); });');
    h.push('});');
    h.push('render();');
    h.push('});');
    h.push('}catch(e){ if (window.gw && window.gw.notify) { try { window.gw.notify("Script error: " + e.message, { severity: "warning" }); } catch(_e){} } }})();');
  }

  /* reactions (C2: per-visitor storage or aggregate CMS operation) */
  if (used.reactions) {
    h.push('(function(){try{');
    h.push('Array.prototype.forEach.call(qa(".n-react-card"), function(card){');
    h.push('var key = card.getAttribute("data-react-key") || "react";');
    h.push('var op = card.getAttribute("data-react-op");');
    h.push('var mine = storeGet(key + ":mine");');
    h.push('var btns = Array.prototype.slice.call(card.querySelectorAll(".n-react-btn"));');
    h.push('function setCounts(mineEmoji){');
    h.push('btns.forEach(function(b){');
    h.push('var em = b.getAttribute("data-react");');
    h.push('var n = parseInt(storeGet(key + ":" + em), 10) || 0;');
    h.push('b.querySelector(".n-react-count").textContent = n || "0";');
    h.push('if (mineEmoji === em) b.classList.add("n-react-on"); else b.classList.remove("n-react-on");');
    h.push('});');
    h.push('}');
    h.push('function render(){ setCounts(mine); }');
    h.push('function applyLocal(em){');
    h.push('if (mine === em) return;');
    h.push('if (mine) { var prev = storeGet(key + ":" + mine); storeSet(key + ":" + mine, Math.max(0, (parseInt(prev, 10) || 1) - 1)); }');
    h.push('var n = parseInt(storeGet(key + ":" + em), 10) || 0;');
    h.push('storeSet(key + ":" + em, n + 1); storeSet(key + ":mine", em); mine = em; render();');
    h.push('}');
    h.push('if (op && gw && gw.db && gw.db.operation) {');
    h.push('btns.forEach(function(b){');
    h.push('b.addEventListener("click", function(){');
    h.push('var em = b.getAttribute("data-react");');
    h.push('var btn = b;');
    h.push('btn.disabled = true;');
    h.push('gw.db.operation(op, { emoji: em }).then(function(res){');
    h.push('btn.disabled = false;');
    h.push('if (res && res.ok) { applyLocal(em); notify("Thanks for reacting"); } else { notify("Could not save your reaction"); }');
    h.push('}).catch(function(){ btn.disabled = false; notify("Could not save your reaction"); });');
    h.push('});');
    h.push('});');
    h.push('} else {');
    h.push('btns.forEach(function(b){');
    h.push('b.addEventListener("click", function(){ applyLocal(b.getAttribute("data-react")); });');
    h.push('});');
    h.push('}');
    h.push('render();');
    h.push('});');
    h.push('}catch(e){ if (window.gw && window.gw.notify) { try { window.gw.notify("Script error: " + e.message, { severity: "warning" }); } catch(_e){} } }})();');
  }

  /* share */
  if (used.share) {
    h.push('(function(){try{');
    h.push('var cards = qa(".n-share-card");');
    h.push('if (!cards.length) return;');
    h.push('var url = (typeof location !== "undefined" && location.href) ? location.href : "";');
    h.push('Array.prototype.forEach.call(cards, function(card){');
    h.push('var text = encodeURIComponent(card.getAttribute("data-share-text") || document.title || "");');
    h.push('var u = encodeURIComponent(url);');
    h.push('var map = {');
    h.push('x: "https://twitter.com/intent/tweet?url=" + u + "&text=" + text,');
    h.push('facebook: "https://www.facebook.com/sharer/sharer.php?u=" + u,');
    h.push('linkedin: "https://www.linkedin.com/sharing/share-offsite/?url=" + u,');
    h.push('whatsapp: "https://wa.me/?text=" + text + "%20" + u');
    h.push('};');
    h.push('Array.prototype.forEach.call(card.querySelectorAll("[data-share]"), function(b){');
    h.push('b.addEventListener("click", function(e){');
    h.push('var kind = b.getAttribute("data-share");');
    h.push('if (kind === "copy") {');
    h.push('e.preventDefault();');
    h.push('function done(){ notify("Link copied"); }');
    h.push('try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(url).then(done, function(){ notify("Copy failed"); }); } else { done(); } } catch(err){ done(); }');
    h.push('return;');
    h.push('}');
    h.push('var target = map[kind];');
    h.push('if (!target) return;');
    h.push('if (gw && gw.openUrl) { e.preventDefault(); gw.openUrl(target); }');
    h.push('});');
    h.push('});');
    h.push('});');
    h.push('}catch(e){ if (window.gw && window.gw.notify) { try { window.gw.notify("Script error: " + e.message, { severity: "warning" }); } catch(_e){} } }})();');
  }

  /* progress bar + chapter markers (Phase 2 · C5) */
  if (used.progress) {
    h.push('(function(){try{');
    h.push('var bar = q(".n-progress-bar");');
    h.push('if (!bar) return;');
    h.push('var chapters = [];');
    h.push('qa("[data-n-anchor]").forEach(function(a){ if (a.tagName === "H1" || a.tagName === "H2" || a.tagName === "H3") chapters.push({ el: a, label: (a.getAttribute("data-n-title") || a.textContent || "").trim() }); });');
    h.push('var tip = null;');
    h.push('if (chapters.length > 1) { tip = document.createElement("div"); tip.className = "n-progress-tip"; document.body.appendChild(tip); routeCleanup(function(){ try { tip.remove(); } catch(e){} }); }');
    h.push('function upd(){');
    h.push('var doc = document.documentElement;');
    h.push('var max = (doc.scrollHeight || 1) - (doc.clientHeight || 1);');
    h.push('var p = max > 0 ? (window.pageYOffset || doc.scrollTop || 0) / max : 1;');
    h.push('bar.style.width = (Math.min(1, Math.max(0, p)) * 100) + "%";');
    h.push('if (tip) {');
    h.push('var line = (window.innerHeight || 600) * 0.32, cur = "";');
    h.push('chapters.forEach(function(c){ if (c.el.getBoundingClientRect().top <= line) cur = c.label; });');
    h.push('if (cur) { tip.textContent = cur; tip.style.display = "block"; } else { tip.style.display = "none"; }');
    h.push('}');
    h.push('}');
    h.push('addWin("scroll", upd, { passive: true });');
    h.push('addWin("resize", upd);');
    h.push('upd();');
    h.push('}catch(e){ if (window.gw && window.gw.notify) { try { window.gw.notify("Script error: " + e.message, { severity: "warning" }); } catch(_e){} } }})();');
  }

  /* listen to this story (Phase 2 · C4) */
  if (used.byline) {
    h.push('(function(){try{');
    h.push('var btn = q("[data-listen]");');
    h.push('if (!btn) return;');
    h.push('if (typeof SpeechSynthesisUtterance === "undefined" || !window.speechSynthesis) { btn.style.display = "none"; return; }');
    h.push('var bits = [];');
    h.push('qa(".n-standfirst-p, .n-lead-p, .n-article .n-p, .n-article .n-h2, .n-article .n-h3").forEach(function(x){ var t = (x.textContent || "").trim(); if (t) bits.push(t); });');
    h.push('if (!bits.length) { btn.style.display = "none"; return; }');
    h.push('var utter = new SpeechSynthesisUtterance(bits.join(". "));');
    h.push('utter.lang = (document.documentElement && document.documentElement.lang) || "en";');
    h.push('var playing = false;');
    h.push('btn.addEventListener("click", function(){');
    h.push('if (playing) { try { window.speechSynthesis.cancel(); } catch(e){} playing = false; btn.textContent = "🔊 Listen"; return; }');
    h.push('try { window.speechSynthesis.cancel(); window.speechSynthesis.speak(utter); playing = true; btn.textContent = "⏸ Stop"; } catch(e){}');
    h.push('});');
    h.push('utter.onend = function(){ playing = false; btn.textContent = "🔊 Listen"; };');
    h.push('routeCleanup(function(){ try { window.speechSynthesis.cancel(); } catch(e){} });');
    h.push('}catch(e){ if (window.gw && window.gw.notify) { try { window.gw.notify("Script error: " + e.message, { severity: "warning" }); } catch(_e){} } }})();');
  }

  /* toc */
  if (used.toc) {
    h.push('(function(){try{');
    h.push('var lists = qa(".n-toc-list");');
    h.push('if (!lists.length) return;');
    h.push('var heads = qa("[data-n-anchor]").filter(function(nd){ return nd.tagName === "H1" || nd.tagName === "H2" || nd.tagName === "H3"; });');
    h.push('Array.prototype.forEach.call(lists, function(ul){');
    h.push('heads.forEach(function(hd){');
    h.push('var li = document.createElement("li");');
    h.push('var a = document.createElement("a");');
    h.push('a.textContent = (hd.getAttribute("data-n-title") || hd.textContent || "").trim();');
    h.push('a.href = "#" + (hd.id || "");');
    h.push('if (hd.tagName === "H3") a.className = "n-toc-h3";');
    h.push('a.addEventListener("click", function(e){ e.preventDefault(); try { hd.scrollIntoView({ behavior: "smooth", block: "start" }); } catch(err){ hd.scrollIntoView(); } });');
    h.push('li.appendChild(a); ul.appendChild(li);');
    h.push('});');
    h.push('var links = Array.prototype.slice.call(ul.querySelectorAll("a"));');
    h.push('if ("IntersectionObserver" in window && links.length) {');
    h.push('var io = new IntersectionObserver(function(es){');
    h.push('es.forEach(function(e){ if (e.isIntersecting) {');
    h.push('var hd = e.target;');
    h.push('links.forEach(function(a, i){');
    h.push('a.classList.toggle("n-toc-active", heads[i] === hd);');
    h.push('}); } });');
    h.push('}, { rootMargin: "-20% 0px -70% 0px", threshold: 0 });');
    h.push('heads.forEach(function(hd){ io.observe(hd); });');
    h.push('}');
    h.push('});');
    h.push('}catch(e){ if (window.gw && window.gw.notify) { try { window.gw.notify("Script error: " + e.message, { severity: "warning" }); } catch(_e){} } }})();');
  }

  /* chart */
  if (used.chart) {
    h.push('(function(){try{');
    h.push('function drawChart(canvas){');
    h.push('var raw; try { raw = JSON.parse(canvas.getAttribute("data-chart")); } catch(e){ return; }');
    h.push('if (!raw) return;');
    h.push('var dpr = (window.devicePixelRatio || 1);');
    h.push('var w = canvas.clientWidth || canvas.parentNode.clientWidth || 600;');
    h.push('var hgt = 340;');
    h.push('canvas.width = w * dpr; canvas.height = hgt * dpr;');
    h.push('var ctx = canvas.getContext("2d");');
    h.push('ctx.scale(dpr, dpr);');
    h.push('var ink = getComputedStyle(ROOT).color || "#1a2030";');
    h.push('var line = "#e4e8f1"; var dim = "#5b6478";');
    h.push('var PAD = { l: 44, r: 14, t: 18, b: 40 };');
    h.push('var cw = w - PAD.l - PAD.r, ch = hgt - PAD.t - PAD.b;');
    h.push('var series = raw.series || []; var labels = raw.labels || [];');
    h.push('var type = raw.type === "line" ? "line" : (raw.type === "donut" ? "donut" : "bar");');
    h.push('var ANIM = (typeof canvas.__ngAnim === "number") ? canvas.__ngAnim : 1;');
    h.push('if (type === "donut") {');
    h.push('var total = series.reduce(function(a,s){ return a + (((s.data||[])[0]) || 0); }, 0) || 1;');
    h.push('var cx = w / 2, cy = hgt / 2 - 6, r = Math.min(w, hgt) / 2 - 54;');
    h.push('var ang = -Math.PI / 2;');
    h.push('series.forEach(function(s, i){');
    h.push('var v = (s.data && s.data[0]) || 0;');
    h.push('var sweep = (v / total) * Math.PI * 2 * ANIM;');
    h.push('ctx.beginPath(); ctx.moveTo(cx, cy);');
    h.push('ctx.arc(cx, cy, r, ang, ang + sweep); ctx.closePath();');
    h.push('ctx.fillStyle = s.color || ["#2f6fed","#f59e0b","#16a34a","#dc2626","#7c3aed","#0891b2"][i % 6];');
    h.push('ctx.fill();');
    h.push('var mid = ang + sweep / 2;');
    h.push('ctx.fillStyle = "#fff"; ctx.font = "700 12px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";');
    h.push('var pct = Math.round(v / total * 100);');
    h.push('if (sweep > 0.18) ctx.fillText(pct + "%", cx + Math.cos(mid) * r * 0.66, cy + Math.sin(mid) * r * 0.66);');
    h.push('ang += sweep;');
    h.push('});');
    h.push('ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";');
    h.push('var lx = 14, ly = hgt - 12;');
    h.push('series.forEach(function(s, i){');
    h.push('ctx.fillStyle = s.color || ["#2f6fed","#f59e0b","#16a34a","#dc2626","#7c3aed","#0891b2"][i % 6];');
    h.push('ctx.fillRect(lx, ly - 7, 10, 10); lx += 16;');
    h.push('ctx.fillStyle = dim; ctx.font = "11px system-ui, sans-serif";');
    h.push('ctx.fillText((s.label || "S" + (i + 1)) + " " + (raw.unit || ""), lx, ly + 3);');
    h.push('lx += ctx.measureText((s.label || "S" + (i + 1)) + " " + (raw.unit || "")).width + 18;');
    h.push('});');
    h.push('return; }');
    h.push('var all = []; series.forEach(function(s){ all = all.concat(s.data || []); });');
    h.push('var maxV = Math.max.apply(null, all.concat([1]));');
    h.push('var n = labels.length || 1;');
    h.push('ctx.strokeStyle = line; ctx.lineWidth = 1;');
    h.push('for (var gi = 0; gi <= 4; gi++) {');
    h.push('var gy = PAD.t + ch - (ch * gi / 4);');
    h.push('ctx.beginPath(); ctx.moveTo(PAD.l, gy); ctx.lineTo(w - PAD.r, gy); ctx.stroke();');
    h.push('ctx.fillStyle = dim; ctx.font = "10px system-ui, sans-serif";');
    h.push('ctx.fillText(String(Math.round(maxV * gi / 4)), 4, gy + 3);');
    h.push('}');
    h.push('var bw = cw / n;');
    h.push('var groupW = Math.min(46, bw * 0.7);');
    h.push('var slotW = bw / Math.max(1, series.length);');
    h.push('series.forEach(function(s, si){');
    h.push('var col = s.color || ["#2f6fed","#f59e0b","#16a34a","#dc2626","#7c3aed","#0891b2"][si % 6];');
    h.push('if (type === "bar") {');
    h.push('(s.data || []).forEach(function(v, i){');
    h.push('var bh = (v / maxV) * ch * ANIM;');
    h.push('var bx = PAD.l + i * bw + bw / 2 - groupW / 2 + si * (groupW / Math.max(1, series.length)) + (groupW / Math.max(1, series.length)) * 0.15;');
    h.push('var bw2 = Math.max(3, (groupW / Math.max(1, series.length)) * 0.7);');
    h.push('var by = PAD.t + ch - bh;');
    h.push('ctx.fillStyle = col;');
    h.push('ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx, by, bw2, Math.max(0, bh), 4) : ctx.rect(bx, by, bw2, Math.max(0, bh)); ctx.fill();');
    h.push('});');
    h.push('} else {');
    h.push('ctx.beginPath();');
    h.push('(s.data || []).forEach(function(v, i){');
    h.push('var px = PAD.l + i * bw + bw / 2;');
    h.push('var py = PAD.t + ch - (v / maxV) * ch;');
    h.push('if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);');
    h.push('});');
    h.push('ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.stroke();');
    h.push('ctx.beginPath();');
    h.push('(s.data || []).forEach(function(v, i){');
    h.push('var px = PAD.l + i * bw + bw / 2;');
    h.push('var py = PAD.t + ch - (v / maxV) * ch;');
    h.push('ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); ctx.beginPath();');
    h.push('});');
    h.push('}');
    h.push('});');
    h.push('labels.forEach(function(lb, i){');
    h.push('ctx.fillStyle = dim; ctx.font = "10px system-ui, sans-serif"; ctx.textAlign = "center";');
    h.push('ctx.fillText(String(lb).slice(0, 14), PAD.l + i * bw + bw / 2, PAD.t + ch + 16);');
    h.push('});');
    h.push('ctx.textAlign = "left";');
    h.push('if (series.length > 1) {');
    h.push('var lx2 = PAD.l, ly2 = PAD.t + ch + 30;');
    h.push('series.forEach(function(s, i){');
    h.push('ctx.fillStyle = s.color || ["#2f6fed","#f59e0b","#16a34a","#dc2626","#7c3aed","#0891b2"][i % 6];');
    h.push('ctx.fillRect(lx2, ly2 - 6, 9, 9); lx2 += 14;');
    h.push('ctx.fillStyle = dim; ctx.font = "10px system-ui, sans-serif";');
    h.push('ctx.fillText(s.label || "", lx2, ly2 + 3); lx2 += ctx.measureText(s.label || "").width + 16;');
    h.push('});');
    h.push('}');
    h.push('}');
    h.push('var canvases = qa(".n-chart-canvas");');
    h.push('function animateCv(cv){ if (cv.__ngAnimSet) { drawChart(cv); return; } cv.__ngAnimSet = true; var t0 = null;');
    h.push('function fr(ts){ if (!t0) t0 = ts; var pr = Math.min(1, (ts - t0) / 750); pr = 1 - Math.pow(1 - pr, 3); cv.__ngAnim = pr; drawChart(cv); if (pr < 1) requestAnimationFrame(fr); else { cv.__ngAnim = 1; drawChart(cv); } }');
    h.push('requestAnimationFrame(fr); }');
    h.push('function drawAll(){ Array.prototype.forEach.call(canvases, drawChart); }');
    h.push('if ("IntersectionObserver" in window) {');
    h.push('var io = new IntersectionObserver(function(es){ es.forEach(function(e){ if (e.isIntersecting) { animateCv(e.target); io.unobserve(e.target); } }); }, { threshold: .2 });');
    h.push('Array.prototype.forEach.call(canvases, function(cv){ io.observe(cv); });');
    h.push('} else { Array.prototype.forEach.call(canvases, animateCv); }');
    h.push('Array.prototype.forEach.call(qa("[data-chart-toggle]"), function(btn){');
    h.push('var cv = null, n = btn.parentNode;');
    h.push('while (n && n !== ROOT) { if (n.querySelector && n.querySelector(".n-chart-canvas")) { cv = n.querySelector(".n-chart-canvas"); break; } n = n.parentNode; }');
    h.push('if (!cv || !cv.getAttribute("data-chart2")) return;');
    h.push('btn.addEventListener("click", function(){');
    h.push('var a = cv.getAttribute("data-chart"), b = cv.getAttribute("data-chart2");');
    h.push('cv.setAttribute("data-chart", b); cv.setAttribute("data-chart2", a);');
    h.push('cv.__ngAnimSet = false; cv.__ngAnim = 0; animateCv(cv);');
    h.push('var next = btn.getAttribute("data-chart-next") || ""; btn.setAttribute("data-chart-next", btn.textContent); btn.textContent = next;');
    h.push('});');
    h.push('});');
    h.push('var rT; addWin("resize", function(){ clearTimeout(rT); rT = setTimeout(drawAll, 180); });');
    h.push('}catch(e){ if (window.gw && window.gw.notify) { try { window.gw.notify("Script error: " + e.message, { severity: "warning" }); } catch(_e){} } }})();');
  }

  /* compare slider */
  if (used.compare) {
    h.push('(function(){try{');
    h.push('var cmp = q(".n-cmp-stage");');
    h.push('if (!cmp) return;');
    h.push('var before = cmp.querySelector(".n-cmp-before-wrap");');
    h.push('var handle = cmp.querySelector(".n-cmp-handle");');
    h.push('if (!before || !handle) return;');
    h.push('function setPos(p){');
    h.push('p = Math.max(0, Math.min(100, p));');
    h.push('before.style.clipPath = "inset(0 calc(100% - " + p + "%) 0 0)";');
    h.push('handle.style.left = p + "%";');
    h.push('handle.setAttribute("aria-valuenow", Math.round(p));');
    h.push('}');
    h.push('var drag = false;');
    h.push('function posOf(e){');
    h.push('var r = cmp.getBoundingClientRect();');
    h.push('var x = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;');
    h.push('return ((x - r.left) / r.width) * 100;');
    h.push('}');
    h.push('handle.addEventListener("pointerdown", function(e){ drag = true; e.preventDefault(); });');
    h.push('handle.addEventListener("touchstart", function(e){ drag = true; }, { passive: false });');
    h.push('handle.addEventListener("keydown", function(e){ var v = parseInt(handle.getAttribute("aria-valuenow"), 10) || 50; if (e.key === "ArrowLeft") setPos(v - 5); if (e.key === "ArrowRight") setPos(v + 5); });');
    h.push('function move(e){ if (!drag) return; setPos(posOf(e)); }');
    h.push('function up(){ drag = false; }');
    h.push('addWin("pointermove", move); addWin("pointerup", up);');
    h.push('addWin("touchmove", move, { passive: false }); addWin("touchend", up);');
    h.push('setPos(50);');
    h.push('}catch(e){ if (window.gw && window.gw.notify) { try { window.gw.notify("Script error: " + e.message, { severity: "warning" }); } catch(_e){} } }})();');
  }

  /* countdown */
  if (used.countdown) {
    h.push('(function(){try{');
    h.push('var card = q(".n-cd-card");');
    h.push('if (!card) return;');
    h.push('var target = new Date(card.getAttribute("data-cd-target"));');
    h.push('if (isNaN(target.getTime())) return;');
    h.push('var nums = { d: card.querySelector("[data-cd=\\"d\\"]"), h: card.querySelector("[data-cd=\\"h\\"]"), m: card.querySelector("[data-cd=\\"m\\"]"), s: card.querySelector("[data-cd=\\"s\\"]") };');
    h.push('function pad(n){ return (n < 10 ? "0" : "") + n; }');
    h.push('function tick(){');
    h.push('var ms = target.getTime() - Date.now();');
    h.push('if (ms <= 0) {');
    h.push('var row = card.querySelector(".n-cd-row"); if (row) row.style.display = "none";');
    h.push('var ended = card.querySelector(".n-cd-ended"); if (ended) ended.hidden = false;');
    h.push('clearInterval(timer); return;');
    h.push('}');
    h.push('var d = Math.floor(ms / 86400000);');
    h.push('var hh = Math.floor(ms % 86400000 / 3600000);');
    h.push('var mm = Math.floor(ms % 3600000 / 60000);');
    h.push('var ss = Math.floor(ms % 60000 / 1000);');
    h.push('if (nums.d) nums.d.textContent = pad(d); if (nums.h) nums.h.textContent = pad(hh);');
    h.push('if (nums.m) nums.m.textContent = pad(mm); if (nums.s) nums.s.textContent = pad(ss);');
    h.push('}');
    h.push('var timer = setInterval(tick, 1000); tick();');
    h.push('routeCleanup(function(){ clearInterval(timer); });');
    h.push('}catch(e){ if (window.gw && window.gw.notify) { try { window.gw.notify("Script error: " + e.message, { severity: "warning" }); } catch(_e){} } }})();');
  }

  /* tabs */
  if (used.tabs) {
    h.push('(function(){try{');
    h.push('Array.prototype.forEach.call(qa(".n-tabs"), function(tabbar){');
    h.push('var sec = tabbar.parentNode;');
    h.push('var panels = sec.querySelectorAll(".n-tabs-panel");');
    h.push('var btns = tabbar.querySelectorAll(".n-tabs-btn");');
    h.push('Array.prototype.forEach.call(btns, function(b){');
    h.push('b.addEventListener("click", function(){');
    h.push('var i = parseInt(b.getAttribute("data-tab-idx"), 10) || 0;');
    h.push('Array.prototype.forEach.call(btns, function(x, xi){ x.classList.toggle("active", xi === i); x.setAttribute("aria-selected", xi === i ? "true" : "false"); });');
    h.push('Array.prototype.forEach.call(panels, function(p, pi){ p.classList.toggle("active", pi === i); });');
    h.push('});');
    h.push('});');
    h.push('});');
    h.push('}catch(e){ if (window.gw && window.gw.notify) { try { window.gw.notify("Script error: " + e.message, { severity: "warning" }); } catch(_e){} } }})();');
  }

  /* story quiz (C7: graded + shareable result) */
  if (used.quiz) {
    h.push('(function(){try{');
    h.push('qa(".n-quiz-card").forEach(function(card){');
    h.push('var key = card.getAttribute("data-quiz-key") || "quiz";');
    h.push('var submitBtn = card.querySelector(".n-quiz-submit");');
    h.push('var resultBox = card.querySelector(".n-quiz-result");');
    h.push('var scoreEl = card.querySelector(".n-quiz-score");');
    h.push('var shareBtn = card.querySelector(".n-quiz-share");');
    h.push('var retryBtn = card.querySelector(".n-quiz-retry");');
    h.push('var done = storeGet(key + ":done") === "1";');
    h.push('function lastResult(){ return storeGet(key + ":result") || ""; }');
    h.push('function showResult(){');
    h.push('if (!resultBox || !scoreEl) return;');
    h.push('var res = lastResult();');
    h.push('if (!res) return;');
    h.push('resultBox.hidden = false;');
    h.push('scoreEl.textContent = res;');
    h.push('if (submitBtn) submitBtn.hidden = true;');
    h.push('}');
    h.push('Array.prototype.forEach.call(card.querySelectorAll(".n-quiz-opt"), function(btn){');
    h.push('btn.addEventListener("click", function(){');
    h.push('var qi = btn.getAttribute("data-quiz-q");');
    h.push('var oi = btn.getAttribute("data-quiz-a");');
    h.push('Array.prototype.forEach.call(card.querySelectorAll(".n-quiz-opt[data-quiz-q=\\"" + qi + "\\"]"), function(x){ x.classList.remove("n-quiz-picked", "n-quiz-right", "n-quiz-wrong"); });');
    h.push('btn.classList.add("n-quiz-picked");');
    h.push('});');
    h.push('});');
    h.push('if (submitBtn) submitBtn.addEventListener("click", function(){');
    h.push('var right = 0, total = 0;');
    h.push('Array.prototype.forEach.call(card.querySelectorAll(".n-quiz-q"), function(q){');
    h.push('var btns = q.querySelectorAll(".n-quiz-opt");');
    h.push('if (!btns.length) return;');
    h.push('total++;');
    h.push('var picked = q.querySelector(".n-quiz-picked");');
    h.push('Array.prototype.forEach.call(btns, function(b){ b.disabled = true; b.classList.remove("n-quiz-picked"); });');
    h.push('if (picked) {');
    h.push('var idx = parseInt(picked.getAttribute("data-quiz-a"), 10);');
    h.push('if (idx === 0) { right++; picked.classList.add("n-quiz-right"); } else { picked.classList.add("n-quiz-wrong"); btns[0].classList.add("n-quiz-right"); }');
    h.push('} else { btns[0].classList.add("n-quiz-right"); }');
    h.push('});');
    h.push('var pct = total ? Math.round(right / total * 100) : 0;');
    h.push('var msg = pct === 100 ? "Perfect score — newsroom material!" : pct >= 60 ? "Solid grasp of the story." : "Time for a re-read? The details are worth it.";');
    h.push('var res = "I scored " + right + "/" + total + " (" + pct + "%) on this story quiz. " + msg;');
    h.push('storeSet(key + ":done", "1"); storeSet(key + ":result", res);');
    h.push('scoreEl.textContent = res;');
    h.push('resultBox.hidden = false;');
    h.push('submitBtn.hidden = true;');
    h.push('});');
    h.push('if (retryBtn) retryBtn.addEventListener("click", function(){');
    h.push('storeSet(key + ":done", ""); storeSet(key + ":result", "");');
    h.push('resultBox.hidden = true;');
    h.push('if (submitBtn) submitBtn.hidden = false;');
    h.push('Array.prototype.forEach.call(card.querySelectorAll(".n-quiz-opt"), function(b){ b.disabled = false; b.classList.remove("n-quiz-picked", "n-quiz-right", "n-quiz-wrong"); });');
    h.push('});');
    h.push('if (shareBtn) shareBtn.addEventListener("click", function(){');
    h.push('var res = lastResult() || "I just took this story quiz.";');
    h.push('var url = (typeof location !== "undefined" && location.href) ? location.href : "";');
    h.push('var txt = res + " " + url;');
    h.push('function done(){ notify("Result copied — paste it anywhere"); }');
    h.push('try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(txt).then(done, function(){ notify("Copy failed"); }); } else { done(); } } catch(err){ done(); }');
    h.push('});');
    h.push('showResult();');
    h.push('});');
    h.push('}catch(e){ if (window.gw && window.gw.notify) { try { window.gw.notify("Script error: " + e.message, { severity: "warning" }); } catch(_e){} } }})();');
  }

  /* video before/after compare (B6) */
  if (used.videocompare) {
    h.push('(function(){try{');
    h.push('qa("[data-vcmp]").forEach(function(fig){');
    h.push('var stage = fig.querySelector(".n-vcmp-stage");');
    h.push('var handle = fig.querySelector(".n-vcmp-handle");');
    h.push('var beforeWrap = fig.querySelector(".n-vcmp-before-wrap");');
    h.push('var playBtn = fig.querySelector(".n-vcmp-play");');
    h.push('var vids = Array.prototype.slice.call(fig.querySelectorAll("video"));');
    h.push('if (!stage || !handle || !beforeWrap) return;');
    h.push('function setPct(pct){');
    h.push('pct = Math.min(100, Math.max(0, pct));');
    h.push('beforeWrap.style.clipPath = "inset(0 " + (100 - pct) + "% 0 0)";');
    h.push('handle.style.left = pct + "%";');
    h.push('handle.setAttribute("aria-valuenow", String(Math.round(pct)));');
    h.push('}');
    h.push('function drag(e){');
    h.push('var r = stage.getBoundingClientRect();');
    h.push('var cx = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;');
    h.push('setPct((cx - r.left) / r.width * 100);');
    h.push('}');
    h.push('var dragging = false;');
    h.push('stage.addEventListener("pointerdown", function(e){ if (e.target === handle || handle.contains(e.target)) { dragging = true; stage.setPointerCapture && stage.setPointerCapture(e.pointerId); drag(e); } });');
    h.push('stage.addEventListener("pointermove", function(e){ if (dragging) drag(e); });');
    h.push('stage.addEventListener("pointerup", function(){ dragging = false; });');
    h.push('stage.addEventListener("pointercancel", function(){ dragging = false; });');
    h.push('handle.addEventListener("keydown", function(e){');
    h.push('var p = parseInt(handle.getAttribute("aria-valuenow"), 10) || 50;');
    h.push('if (e.key === "ArrowLeft") setPct(p - 5);');
    h.push('if (e.key === "ArrowRight") setPct(p + 5);');
    h.push('});');
    h.push('if (playBtn) playBtn.addEventListener("click", function(){');
    h.push('var anyPlaying = vids.some(function(v){ return !v.paused; });');
    h.push('vids.forEach(function(v){ if (anyPlaying) { v.pause(); } else { v.play().catch(function(){}); } });');
    h.push('playBtn.textContent = anyPlaying ? "▶ Play" : "⏸ Pause";');
    h.push('});');
    h.push('vids.forEach(function(v){ v.addEventListener("play", function(){ playBtn.textContent = "⏸ Pause"; }); v.addEventListener("pause", function(){ playBtn.textContent = "▶ Play"; }); });');
    h.push('routeCleanup(function(){ vids.forEach(function(v){ try { v.pause(); } catch(e){} }); });');
    h.push('setPct(50);');
    h.push('});');
    h.push('}catch(e){ if (window.gw && window.gw.notify) { try { window.gw.notify("Script error: " + e.message, { severity: "warning" }); } catch(_e){} } }})();');
  }

  /* scrollytelling (B7) */
  if (used.scrolly) {
    h.push('(function(){try{');
    h.push('qa(".n-scrolly").forEach(function(sec){');
    h.push('var stage = sec.querySelector(".n-scrolly-stage");');
    h.push('var frames = sec.querySelectorAll(".n-scrolly-frame");');
    h.push('var chapters = sec.querySelectorAll(".n-scrolly-chapter");');
    h.push('if (!frames.length || !chapters.length) return;');
    h.push('function activate(i){');
    h.push('Array.prototype.forEach.call(frames, function(f, fi){ f.classList.toggle("active", fi === i); });');
    h.push('Array.prototype.forEach.call(chapters, function(ch, ci){ ch.classList.toggle("n-scrolly-on", ci === i); });');
    h.push('}');
    h.push('var pref = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;');
    h.push('if (pref || typeof IntersectionObserver === "undefined") { activate(0); return; }');
    h.push('var io = new IntersectionObserver(function(entries){');
    h.push('entries.forEach(function(en){');
    h.push('if (en.isIntersecting) {');
    h.push('var i = parseInt(en.target.getAttribute("data-scrolly"), 10) || 0;');
    h.push('activate(i);');
    h.push('}');
    h.push('});');
    h.push('}, { rootMargin: "-40% 0px -40% 0px", threshold: 0 });');
    h.push('Array.prototype.forEach.call(chapters, function(c){ io.observe(c); });');
    h.push('routeCleanup(function(){ io.disconnect(); });');
    h.push('activate(0);');
    h.push('});');
    h.push('}catch(e){ if (window.gw && window.gw.notify) { try { window.gw.notify("Script error: " + e.message, { severity: "warning" }); } catch(_e){} } }})();');
  }

  /* comments hook (C3): bind gw.forms once per form */
  if (used.comments) {
    h.push('(function(){try{');
    h.push('var forms = qa(".n-comments-form");');
    h.push('if (forms.length && gw && gw.forms && gw.forms.bind) {');
    h.push('Array.prototype.forEach.call(forms, function(f){ gw.forms.bind(f); });');
    h.push('}');
    h.push('}catch(e){ if (window.gw && window.gw.notify) { try { window.gw.notify("Script error: " + e.message, { severity: "warning" }); } catch(_e){} } }})();');
  }

  h.push('})();');
  return h.join('\n');
}

/* ═══════════════════════════════════════════════════════════════════
   COMPILER — AI JSON plan → { html, css, js }
   ═══════════════════════════════════════════════════════════════════ */
function compilePlan(plan, brief) {
  var slug = slugify((brief && brief.slug) || (plan.pageMeta && plan.pageMeta.slug) || (brief && brief.title) || 'news-story');
  var c = makeCtx(slug);
  _uidCtr = 0;

  var comps = Array.isArray(plan.components) ? plan.components : [];
  // hero always first — guarantees the single h1 opens the page
  var heroIdx = -1, others = [], heroes = 0;
  comps.forEach(function (cp, i) {
    if (isObj(cp) && str(cp.component, '').toLowerCase() === 'hero') { heroes++; if (heroIdx === -1) heroIdx = i; }
  });
  if (heroIdx !== -1) {
    var heroC = comps[heroIdx];
    others = comps.filter(function (_, i) { return i !== heroIdx; });
    comps = [heroC].concat(others);
  }

  var used = {};
  var html = [];
  comps.forEach(function (cp) {
    if (!isObj(cp)) return;
    var id = str(cp.component, '').toLowerCase();
    var comp = NG_COMPONENTS[id];
    if (!comp) return;
    var out = '';
    try { out = comp.render(isObj(cp.content) ? cp.content : {}, c); } catch (e) { out = ''; }
    if (out) { used[id] = true; html.push(out); }
  });

  if (!html.length) {
    throw new Error('No valid components — the plan must include at least a hero.');
  }
  if (!used.hero) {
    throw new Error('The plan must contain exactly one "hero" component (it holds the only h1).');
  }

  // custom CSS (AI-provided) — strip dangerous bits, keep it scoped
  var customCss = String(plan.customCss == null ? '' : plan.customCss)
    .replace(/<\/?style[^>]*>/gi, '')
    .replace(/@import[^;]+;/gi, '')
    .replace(/position\s*:\s*fixed/gi, 'position: sticky');

  // honor the readingProgress flag: auto-mount the progress component
  var flags = isObj(plan.flags) ? plan.flags : {};
  if (flags.readingProgress && !used.progress) {
    try {
      html.unshift(NG_COMPONENTS.progress.render({}, c));
      used.progress = true;
    } catch (e) {}
  }
  var customJs = String(plan.customJs == null ? '' : plan.customJs);
  var jsScan = scanCustomJs(customJs);
  if (!jsScan.ok) {
    throw new Error('customJs was rejected: ' + jsScan.reason);
  }
  customJs = jsScan.code;

  var accent = str(plan.design && plan.design.accentColor, '');
  var primary = str(plan.design && plan.design.primaryColor, '');
  var set = colorSetById(str(plan.design && plan.design.colorSet, (DB && DB.design && DB.design.colorSet) || 'newsprint'));
  if (!/^#[0-9a-f]{3,8}$/i.test(accent)) accent = set.accent;
  if (!/^#[0-9a-f]{3,8}$/i.test(primary)) primary = set.primary;
  var css = baseCss(slug, accent, primary) + '\n';
  if (customCss.trim()) css += '\n/* custom css — AI provided (scoped by convention) */\n' + customCss.trim() + '\n';

  var rootLabel = esc(str(plan.seo && plan.seo.metaTitle, brief && brief.title, 'News story'));
  var markup = '<section class="news-' + slug + '" id="news-' + slug + '" aria-label="' + rootLabel + '">\n'
    + html.join('\n') + '\n</section>';

  var js = buildPageJs(slug, used);
  if (customJs.trim()) {
    js += '\n/* custom js — AI provided (wrapped, scoped) */\ntry {\n' + customJs.trim() + '\n} catch (e) { if (window.gw && gw) { try { gw.notify("Custom script error: " + e.message, { severity: "warning" }); } catch (e2) {} } }\n';
  }

  return { html: markup, css: css, js: js, slug: slug, used: used, heroes: heroes, colors: { set: set.id, accent: accent, primary: primary }, configNotes: collectAutoConfigNotes(plan, used) };
}

/* Phase 3 · C2/C3 — auto-detect missing CMS wiring for interactive components */
function collectAutoConfigNotes(plan, used) {
  var notes = [];
  var comps = Array.isArray(plan.components) ? plan.components : [];
  comps.forEach(function (cp) {
    if (!isObj(cp)) return;
    var id = str(cp.component, '').toLowerCase();
    var content = isObj(cp.content) ? cp.content : {};
    if (id === 'comments' && !str(content.formTypeId, '')) {
      notes.push('Comments hook: create a form-type-definition with the discussion destination table, then set formTypeId in the comments content (until then the hook shows a placeholder).');
    }
    if (id === 'reactions' && content.aggregate && !str(content.operationId, '')) {
      notes.push('Aggregate reactions: create a CMS operation accepting { emoji } that writes a reaction row, then set operationId in the reactions content (until then reactions are stored per visitor).');
    }
  });
  return notes.length ? notes.join('\n') : '';
}

function joinConfigNeeded(base, auto) {
  var b = String(base == null ? '' : base).trim();
  var a = String(auto == null ? '' : auto).trim();
  if (b && a) return b + '\n' + a;
  return b || a;
}

function scanCustomJs(code) {
  var s = String(code == null ? '' : code);
  if (s.indexOf('<' + '/script') !== -1) return { ok: false, reason: 'contains a script closing tag' };
  if (/document\.write/i.test(s)) return { ok: false, reason: 'document.write is forbidden' };
  if (/\beval\s*\(/i.test(s)) return { ok: false, reason: 'eval is forbidden' };
  if (/new\s+Function\s*\(/i.test(s)) return { ok: false, reason: 'new Function is forbidden' };
  if (/\bfetch\s*\(/i.test(s)) return { ok: false, reason: 'fetch is forbidden in pages' };
  if (/XMLHttpRequest/i.test(s)) return { ok: false, reason: 'XMLHttpRequest is forbidden' };
  if (/postMessage/i.test(s)) return { ok: false, reason: 'postMessage is forbidden' };
  if (/window\.top|window\.parent/i.test(s)) return { ok: false, reason: 'accessing parent frames is forbidden' };
  if (/document\.cookie/i.test(s)) return { ok: false, reason: 'document.cookie is forbidden' };
  if (/localStorage|sessionStorage/i.test(s)) return { ok: false, reason: 'use gw.storage instead of localStorage/sessionStorage' };
  if (/<script/i.test(s)) return { ok: false, reason: 'script tags are not allowed' };
  return { ok: true, code: s };
}

/* validate + normalize an AI plan (lenient) */
function validatePlan(plan) {
  var errs = [];
  if (!isObj(plan)) return { ok: false, error: 'Plan must be a JSON object.' };
  if (!Array.isArray(plan.components)) errs.push('"components" must be an array.');
  else {
    var heroCount = 0;
    var unknown = [];
    plan.components.forEach(function (cp) {
      if (!isObj(cp) || !cp.component) { unknown.push('(missing component id)'); return; }
      if (!NG_COMPONENTS[str(cp.component, '').toLowerCase()]) unknown.push(str(cp.component));
      else if (str(cp.component, '').toLowerCase() === 'hero') heroCount++;
    });
    if (heroCount !== 1) errs.push('Exactly one "hero" component is required (found ' + heroCount + ').');
    if (unknown.length) errs.push('Unknown components: ' + unknown.join(', ') + '. Use only catalog ids.');
  }
  if (errs.length) return { ok: false, error: errs.join(' ') };
  // normalize: ensure content objects
  plan.components = plan.components.map(function (cp) {
    cp.content = isObj(cp.content) ? cp.content : (cp.content == null ? {} : { text: String(cp.content) });
    return cp;
  });
  return { ok: true, plan: plan };
}

/* ═══════════════════════════════════════════════════════════════════
   GUARDRAIL CHECKS (shown on the Publish tab)
   ═══════════════════════════════════════════════════════════════════ */
function runGuardChecks() {
  var out = [];
  var p = DB && DB.page;
  var h = (p && p.html) || '', cs = (p && p.css) || '', js = (p && p.js) || '';
  function add(ok, label) { out.push({ ok: ok, label: label }); }
  if (!p || !h) { add(false, 'No page generated yet.'); return out; }
  var h1 = (h.match(/<h1\b/gi) || []).length;
  add(h1 === 1, 'Exactly one h1 (found ' + h1 + ')');
  add(!/<html|<head|<body|<!DOCTYPE/i.test(h), 'No document tags in HTML');
  add(!/(^|[,{])\s*(html|body)\s*\{/m.test(cs) && !/(^|[,{])\s*\*\s*\{/m.test(cs), 'No bare html/body/* selectors in CSS');
  add(!/\.gw-/.test(cs), 'No custom .gw-* class selectors (reserved prefix)');
  add(!/document\.write|\beval\s*\(|new\s+Function|fetch\s*\(|XMLHttpRequest|postMessage/.test(js), 'JS has no forbidden APIs');
  add(/^\s*\(function\s*\(/.test(js), 'JS wrapped in an IIFE (idempotent)');
  add(!/\bawait\b/.test(js), 'No top-level await');
  add(!/src=["']https?:\/\/[^"']*\.js["']/i.test(h), 'No external JS scripts in HTML');
  var imgs = (h.match(/<img\b/g) || []).length;
  var alts = (h.match(/<img[^>]*alt=["'][^"']*["']/g) || []).length;
  add(imgs === alts, 'Every img has alt text (' + alts + '/' + imgs + ')');
  add(!/(gw_hp|website|company)/i.test(h.replace(/data-gw-config="[^"]*"/g, '')), 'No honeypot names on real fields');
  add(js.indexOf('<' + '/script') === -1 && h.indexOf('<' + '/script') === -1, 'No script close tags inside code');
  add(!/GW-PAGE-ID/i.test(h), 'No platform-owned trace comments');
  var size = ((h.length + cs.length + js.length) / 1024).toFixed(1);
  add(Number(size) < 200, 'Code size ' + size + ' KB (budget ~200 KB)');
  // ── accessibility audit (Phase 1 · F4) ──
  var headSeq = [];
  var headRe = /<(h[1-6])\b[^>]*>/gi, hm;
  while ((hm = headRe.exec(h)) !== null) headSeq.push(parseInt(hm[1].charAt(1), 10));
  var orderOk = true;
  var prevLvl = 0;
  for (var hi = 0; hi < headSeq.length; hi++) {
    var lvl = headSeq[hi];
    if (lvl > prevLvl + 1) { orderOk = false; break; }
    prevLvl = lvl;
  }
  add(orderOk, 'Heading hierarchy has no level skips');
  var idRe = /id="([^"]+)"/g, idm, idMap = {}, dupIds = [];
  while ((idm = idRe.exec(h)) !== null) {
    var idv = idm[1];
    if (idMap[idv]) { if (dupIds.indexOf(idv) === -1) dupIds.push(idv); }
    else idMap[idv] = true;
  }
  add(dupIds.length === 0, dupIds.length ? 'Duplicate ids found: ' + dupIds.join(', ') : 'All element ids are unique');
  add(/focus-visible/.test(cs), 'Visible focus states (:focus-visible)');
  add(/@media \(prefers-reduced-motion/.test(cs), 'Reduced-motion styles present');
  return out;
}

/* ═══════════════════════════════════════════════════════════════════
   AI PROMPTS
   ═══════════════════════════════════════════════════════════════════ */
function toneText() {
  var t = str(_param('newsTone'), '');
  var base = t ? 'Requested tone from admin settings: ' + t + '. ' : '';
  var tone = (DB && isObj(DB.tone)) ? DB.tone : { lively: 0, dense: 0, formal: 0 };
  var parts = [];
  if (tone.lively > 0) parts.push('more lively, vivid verbs');
  if (tone.lively < 0) parts.push('serious, restrained');
  if (tone.dense > 0) parts.push('scannable — short paragraphs, bold subheads');
  if (tone.dense < 0) parts.push('dense, detailed prose');
  if (tone.formal > 0) parts.push('conversational, direct address');
  if (tone.formal < 0) parts.push('formal, neutral register');
  if (!base && !parts.length) return 'Tone: professional newsroom, vivid but factual, strong lede.';
  return base + (parts.length ? 'Tone sliders: ' + parts.join('; ') + '. Honor them in headlines, kickers and component choices.' : 'Tone: professional newsroom, vivid but factual, strong lede.');
}

function buildProtocol() {
  return [
    'You are the AI Newsroom of "News Page Studio" — you compose rich, interactive NEWS pages that read like a real newspaper, not a marketing landing page.',
    '',
    'YOUR TWO MODES:',
    '1) CHAT MODE — reply with short friendly prose plus optional [[suggest_x]] lines for clickable chips (max 3). No JSON in chat mode.',
    '2) COMPOSE MODE — reply with ONE strict JSON object and NOTHING else. The tool renders the page from your JSON; you never write raw page code.',
    '',
    'USE COMPOSE MODE when the message says "JSON REQUIRED", or when the user asks to create/update/change/rebuild the page, or when the message contains new story facts.',
    '',
    'THE JSON:',
    '{',
    '  "components": [ { "component": "<catalog id>", "content": { ... } } ],',
    '  "design": { "accentColor": "#hex (optional)" },',
    '  "customCss": "optional extra CSS (scoped under .news-<slug>; no @import, no fixed positioning of the shell)",',
    '  "customJs": "optional extra JS (vanilla ES5, IIFE-safe, no eval/fetch/postMessage/localStorage/document.write)",',
    '  "seo": { "metaTitle": "…", "metaDesc": "…", "metaKeywords": "…", "ogTitle": "…", "ogDesc": "…", "ogImage": "…", "sitemapPriority": "0.8", "sitemapChangefreq": "daily", "aiDescription": "…", "aiKeyTopics": "…", "schemaItems": [ { "id": "article", "type": "NewsArticle", "json": "{\\"@type\\":\\"NewsArticle\\",\\"headline\\":\\"…\\",\\"datePublished\\":\\"…\\",\\"author\\":{\\"@type\\":\\"Organization\\",\\"name\\":\\"…\\"}}" } ] },',
    '  "pageMeta": { "name": "…", "slug": "…", "meta": { "language": "en" }, "data": { "status": "published", "requireAuth": false } },',
    '  "flags": { "readingProgress": true },',
    '  "notes": "one line: what changed and why"',
    '}',
    '',
    'NEWS EDITORIAL STYLE GUIDE (apply in COMPOSE MODE):',
    '- LOOK & TYPOGRAPHY: classic newsroom. The tool renders serif display headlines (large, tight, weight 800), sans-serif uppercase kickers/labels with wide letter-spacing and a small rule above them, serif body copy at reading size (17px+/1.75 line-height) in a ~680px news column, datelines in "CITY —" style, bylines as "By NAME", double-rule and hairline section dividers, minimal rounded corners, restrained color (ink black + one accent, usually news red). Do NOT fight this with customCss — enhance it.',
    '- CANONICAL NEWS STRUCTURE (follow unless the story type says otherwise): hero → byline → standfirst → lead → story body (subheads, quotes, credited images) → context (keypoints / keyfacts / timeline / factcheck / liveblog) → engagement (poll, reactions, share) → transparency (sources, corrections) → continuity (related, authorcard, cta).',
    '- Always include "byline" (name, role, location, date, updated, reading time) and "standfirst" right after the hero for article stories. For breaking/live coverage the hero meta already carries the dateline — then skip the separate byline.',
    '- HEADLINES: specific and active, concrete numbers when real, 6-12 words, sentence case or headline case per language convention. Never clickbait, never all-caps shouting (except the BREAKING badge itself).',
    '- LEDES: the classic 5W lede (who/what/where/when/why) with a nut graf that tells readers why this matters now.',
    '- QUOTES: attribute every quote to a named, real source from the brief/chat. Never invent quotes, numbers, names or URLs.',
    '- PHOTO CREDITS: if a credit is known put it in the component; otherwise leave it empty rather than fabricate.',
    '- HERO STYLE BY STORY TYPE: breaking news → "breaking"; features/analysis/longform → "broadsheet"; photo-led stories → "cover"; hard news with one strong photo → "split"; quick briefs → "minimal".',
    '- STORY-TYPE RECIPES (choose the closest archetype):',
    '  · BREAKING / developing: hero "breaking" + breaking strip + liveblog + ticker + keypoints + faq ("what we know so far") + share + sources.',
    '  · FEATURE / longform: hero "broadsheet" + byline + standfirst + lead + article + photostory + pull quotes + personcard + related.',
    '  · DATA / numbers-driven: hero "split" + keyfacts + chart + table + keypoints + infoboxes + sources.',
    '  · SPORTS: hero "cover"/"split" + scorecard + liveblog or timeline + keyfacts + reactions.',
    '  · INVESTIGATIVE / accountability: hero "broadsheet" + byline + standfirst + article + factcheck + timeline + keypoints + sources + corrections.',
    '  · EVENT / announcement: hero "gradient"/"cover" + keypoints + countdown + steps + mapcard + cta + share.',
    '  · OPINION / reaction: hero "minimal"/"broadsheet" + byline + standfirst + article + poll + reactions + quote.',
    '- Every page should feel interactive AND journalistic: at least one of (poll, chart, gallery, timeline, liveblog, countdown, compare, reactions) plus the share row.',
    '',
    'COMPOSITION RULES:',
    '- Exactly ONE "hero" component, placed first — it carries the ONLY h1.',
    '- Compose a story-specific sequence — never a bare article. Pick the components that make THIS story sing; the recipes above are the default bones.',
    '- Fill every used field with REAL content derived from the brief/chat. If something is unknown, omit it rather than fabricate.',
    '- All text in the story language.',
    '- Use absolute https image URLs only when given in the brief/chat; otherwise leave images empty — the layout still looks strong with rules, rules, dark panels and charts.',
    '- Keep the plan proportional to the known facts: a thin brief means a tight, elegant page; a rich brief means a rich page.',
    '- If the page needs a CMS operation, flow or email template that may not exist, add: "configNeeded": "description of what the CMS author must create".',
    '- pageMeta.slug: short kebab-case slug (the tool re-derives its own if missing). metaTitle ~60 chars, metaDesc ~155 chars.',
    '',
    toneText()
  ].join('\n');
}

function buildBriefBlock() {
  var b = DB && DB.brief ? DB.brief : {};
  return 'STORY BRIEF (facts of record — trust ONLY these for facts):\n' + JSON.stringify(b, null, 2);
}

function buildCurrentPlanBlock() {
  var p = DB && DB.page;
  if (!p || !p.html) return 'CURRENT PAGE: none yet.';
  var lines = ['CURRENT PAGE (v' + (DB.version || 0) + ', ' + ((p.plan && p.plan.components ? p.plan.components.length : 0)) + ' components):'];
  if (p.plan && Array.isArray(p.plan.components)) {
    p.plan.components.forEach(function (c, i) {
      var t = '';
      try {
        var d = c.content || {};
        t = d.title || d.question || (d.blocks && d.blocks.length ? d.blocks.length + ' blocks' : '') || '';
      } catch (e) {}
      lines.push((i + 1) + '. ' + c.component + (t ? ' — ' + String(t).slice(0, 60) : ''));
    });
  }
  if (p.slug) lines.push('slug: ' + p.slug);
  return lines.join('\n');
}

function buildChatHistoryBlock(maxMsgs) {
  var n = maxMsgs || 8;
  var msgs = _chat.messages.slice(-n);
  if (!msgs.length) return '';
  return 'RECENT CONVERSATION:\n' + msgs.map(function (m) {
    return (m.role === 'user' ? 'USER: ' : 'AI: ') + String(m.text || '').slice(0, 400);
  }).join('\n');
}

/* ── Story archetype detection (Phase 1 · A1) ── */
function detectArchetype() {
  var b = DB && DB.brief ? DB.brief : {};
  var txt = [
    b.title, b.summary, b.category, (b.tags || []).join(' '),
    (b.sources || []).map(function (s) { return s.name; }).join(' '),
    _chat.messages.slice(-4).map(function (m) { return m.text; }).join(' ')
  ].join(' ').toLowerCase();
  if (/(breaking|urgent|developing|just in|live coverage|flash)/.test(txt)) return 'breaking';
  if (/(data|numbers|chart|percent|statistics|survey|report shows|figures)/.test(txt)) return 'data';
  if (/(score|match|team|win|lost|league|championship|transfer|coach|players|goal)/.test(txt)) return 'sports';
  if (/(investigat|documents|emails|leak|exclusive|reveal|secret|corruption|found that)/.test(txt)) return 'investigative';
  if (/(open|opens|opening|launch|festival|ceremony|announced|invites|event|concert|exhibition|celebrates)/.test(txt)) return 'event';
  if (/(opinion|analysis|column|commentary|what it means|why it matters|essay)/.test(txt)) return 'opinion';
  if (txt.trim().length > 600) return 'feature';
  return 'feature';
}
function archetypeBlock() {
  var a = ARCHETYPES[detectArchetype()] || ARCHETYPES.feature;
  return 'STORY ARCHETYPE (detected): ' + a.label + '.\nRecommended: ' + a.recipe + '.\nFollow this recipe unless the user asks otherwise.';
}
function interviewBlock() {
  return 'INTERVIEW MODE IS ON. Act as a reporter conducting an interview:\n'
    + '- Ask exactly ONE sharp question per reply — the most valuable missing fact first (who / what / where / when / why / so-what / numbers / a named quote).\n'
    + '- Acknowledge the answer in one short line, note the fact, then ask the next question.\n'
    + '- When the facts are enough for a full page, say so and offer the chip: [[suggest_x]] ⚡ Compose the page now.\n'
    + '- NEVER return the JSON plan during the interview unless the message says JSON REQUIRED.';
}

function buildAiContext() {
  return [
    '=== PLATFORM PAGE GENERATOR RULES (binding for the generated code) ===',
    PAGE_RULES,
    '',
    '=== ' + buildCatalogText(),
    '',
    '=== ' + buildBriefBlock()
  ].join('\n');
}

function buildComposePrompt(userMsg) {
  return [
    'JSON REQUIRED — COMPOSE MODE.',
    '',
    buildProtocol(),
    '',
    extraPromptLine(),
    '',
    archetypeBlock(),
    '',
    buildCurrentPlanBlock(),
    '',
    buildChatHistoryBlock(8),
    '',
    'USER REQUEST / NEW INFO: ' + userMsg,
    '',
    'Respond with the single JSON object only. No markdown fences, no commentary.'
  ].join('\n');
}

function buildChatPrompt(userMsg) {
  return [
    'CHAT MODE (no JSON).',
    '',
    buildProtocol(),
    '',
    extraPromptLine(),
    '',
    _interviewMode ? interviewBlock() : '',
    _interviewMode ? '' : archetypeBlock(),
    '',
    buildCurrentPlanBlock(),
    '',
    buildBriefBlock(),
    '',
    buildChatHistoryBlock(10),
    '',
    'USER: ' + userMsg,
    '',
    _interviewMode
      ? 'Interview answer received — follow the INTERVIEW MODE protocol above.'
      : 'Reply in friendly prose (2-5 sentences max in the story language), then up to 3 [[suggest_x]] chips for useful next steps. One chip should offer to (re)generate or update the page.'
  ].join('\n');
}

/* ═══════════════════════════════════════════════════════════════════
   PERSISTENCE (slim value)
   ═══════════════════════════════════════════════════════════════════ */
function defaultBrief() {
  return { title: '', slug: '', category: '', author: '', date: '', location: '', heroImage: '', summary: '', tags: [], sources: [], language: _param('defaultLanguage') || 'en' };
}

function defaultDB() {
  return {
    version: 0,
    brief: defaultBrief(),
    page: null,                     // { html, css, js, plan, seo, pageMeta, flags, slug, colors }
    design: { colorSet: 'newsprint' },
    tone: { lively: 0, dense: 0, formal: 0 },
    decks: {},
    status: 'draft',
    reviewNote: '',
    historyLocal: [],
    publishChecklist: {},
    emailTemplate: null,
    abVariants: [],
    extraPrompt: '',
    promptLab: [],
    publishAt: '',
    generatedAt: null,
    generationCount: 0,
    chatSessionId: '',
    chatCache: { sessionId: '', messages: [] },
    _instanceId: '',
    _parentRecordId: ''
  };
}

function normalizeDB(v) {
  var db = defaultDB();
  if (isObj(v)) {
    var b = isObj(v.brief) ? v.brief : {};
    var keys = ['title', 'slug', 'category', 'author', 'date', 'location', 'heroImage', 'summary', 'language'];
    keys.forEach(function (k) { if (b[k] != null) db.brief[k] = b[k]; });
    if (Array.isArray(b.tags)) db.brief.tags = b.tags;
    if (Array.isArray(b.sources)) db.brief.sources = b.sources;
    db.version = num(v.version, 0);
    db.generationCount = num(v.generationCount, 0);
    if (isObj(v.page)) db.page = v.page;
    if (isObj(v.design)) { db.design.colorSet = str(v.design.colorSet, 'newsprint'); }
    if (isObj(v.tone)) { ['lively', 'dense', 'formal'].forEach(function (k) { db.tone[k] = clamp(num(v.tone[k], 0), -2, 2); }); }
    if (isObj(v.decks)) db.decks = v.decks;
    db.status = ['draft', 'review', 'approved'].indexOf(str(v.status, 'draft')) !== -1 ? str(v.status, 'draft') : 'draft';
    db.reviewNote = str(v.reviewNote, '');
    if (Array.isArray(v.historyLocal)) db.historyLocal = v.historyLocal.slice(-10);
    if (isObj(v.publishChecklist)) db.publishChecklist = v.publishChecklist;
    if (isObj(v.emailTemplate)) db.emailTemplate = v.emailTemplate;
    if (Array.isArray(v.abVariants)) db.abVariants = v.abVariants.slice(0, 2);
    db.extraPrompt = str(v.extraPrompt, '');
    if (Array.isArray(v.promptLab)) db.promptLab = v.promptLab.slice(-6);
    db.publishAt = str(v.publishAt, '');
    db.generatedAt = v.generatedAt || null;
    db.chatSessionId = str(v.chatSessionId, '');
    if (isObj(v.chatCache)) db.chatCache = v.chatCache;
    else if (Array.isArray(v.chatCache)) db.chatCache = { sessionId: '', messages: v.chatCache };
    db._instanceId = str(v._instanceId, '');
    db._parentRecordId = str(v._parentRecordId, '');
  }
  return db;
}

function _slimValue() {
  var db = DB || defaultDB();
  return {
    version: db.version,
    brief: db.brief,
    page: db.page,
    design: db.design,
    tone: db.tone,
    decks: db.decks,
    status: db.status,
    reviewNote: db.reviewNote,
    historyLocal: db.historyLocal,
    publishChecklist: db.publishChecklist,
    emailTemplate: db.emailTemplate,
    abVariants: db.abVariants,
    extraPrompt: db.extraPrompt,
    promptLab: db.promptLab,
    publishAt: db.publishAt,
    generatedAt: db.generatedAt,
    generationCount: db.generationCount,
    chatSessionId: _chat.sessionId || db.chatSessionId,
    chatCache: { sessionId: _chat.sessionId || '', messages: _trimCache(_chat.messages) },
    _instanceId: db._instanceId,
    _parentRecordId: db._parentRecordId
  };
}

function _trimCache(messages) {
  var arr = (Array.isArray(messages) ? messages : []).slice(-CACHE_MSG_LIMIT);
  return arr.map(function (m) { return { role: m.role, text: String(m.text || '').slice(0, 2000), time: m.time }; });
}

function persist() {
  if (!DB) return;
  try {
    var val = _slimValue();
    _staged = JSON.stringify(val);
    tool.setValue(val);
  } catch (e) {
    setStatus('Save error: ' + e.message, 'err');
  }
}

function requestSaveNow(msg) {
  if (_readOnly || !_canWrite()) { setStatus('Read-only — changes are staged but the CMS will not save from a viewer session.', 'err'); return; }
  persist();
  if (typeof tool.requestSave === 'function') {
    try {
      tool.requestSave(function (err, ok) {
        if (err || !ok) {
          setStatus('Staged — the parent form Save will commit it. ' + (err ? '(' + err + ')' : '(requestSave denied)'), 'warn');
          tool.notify(msg ? msg + ' (staged)' : 'Staged — press Save in the form.', 'info');
        } else {
          setStatus('Saved to the CMS record ✓', 'good');
          tool.notify(msg || 'Saved ✓', 'success');
        }
      });
    } catch (e) {
      setStatus('Staged — parent Save will commit it.', 'warn');
    }
  } else {
    setStatus('Staged — press Save in the parent form to commit.', 'warn');
  }
}

/* ═══════════════════════════════════════════════════════════════════
   USER / ROLES / READ-ONLY
   ═══════════════════════════════════════════════════════════════════ */
function getUserSafe() {
  try { return tool.getUser ? tool.getUser() : null; } catch (e) { return null; }
}
function getRoles() {
  var u = _user;
  var roles = (u && Array.isArray(u.roles)) ? u.roles : [];
  if (roles.length) return roles;
  if (u && u.effectiveAccess) {
    if (u.effectiveAccess.isManager) roles.push('admin');
    if (u.effectiveAccess.isEditor) roles.push('editor');
    if (u.effectiveAccess.isViewer) roles.push('viewer');
  }
  return roles;
}
function _canWrite() {
  var roles = getRoles();
  for (var i = 0; i < roles.length; i++) if (WRITE_ROLES.indexOf(roles[i]) !== -1) return true;
  var u = _user;
  if (u && u.effectiveAccess && (u.effectiveAccess.isEditor || u.effectiveAccess.isManager)) return true;
  return false;
}
function refreshUser() {
  _user = getUserSafe();
  renderUserChip();
}
function scheduleUserPolling() {
  if (_pollTimer) return;
  var delays = [400, 1200, 2600, 5000];
  function tick() {
    var u = getUserSafe();
    if (u && u.roles && u.roles.length) { _user = u; renderUserChip(); lockUI(); return; }
    _pollTries++;
    if (_pollTries >= delays.length) { _user = u; lockUI(); return; }
    _pollTimer = setTimeout(tick, delays[_pollTries]);
  }
  _pollTimer = setTimeout(tick, delays[0]);
}

function lockUI() {
  var ro = _readOnly || !_canWrite();
  var app = el('ng-app');
  if (app) app.classList.toggle('ng-ro', ro);
  var locks = ['ng-chat-input', 'ng-btn-send', 'ng-btn-generate', 'ng-btn-generate-empty', 'ng-btn-brief-save', 'ng-btn-brief-generate', 'ng-btn-save', 'ng-btn-headline-lab', 'ng-btn-deck-lab', 'ng-btn-draft-url', 'ng-btn-src-extract', 'ng-btn-factcheck', 'ng-btn-history', 'ng-btn-notify', 'ng-btn-comptest', 'ng-btn-translate', 'ng-btn-agentic', 'ng-btn-ab', 'ng-btn-pageobj', 'ng-btn-related', 'ng-btn-email', 'ng-btn-lint', 'ng-btn-style', 'ng-btn-prompt-opt'];
  locks.forEach(function (id) {
    var e = el(id);
    if (e) e.disabled = ro;
  });
  var locks3 = ['ng-draft-url', 'ng-src-urls', 'ng-review-status', 'ng-review-note', 'ng-tone-lively', 'ng-tone-dense', 'ng-tone-formal', 'ng-extra-prompt', 'ng-publish-at', 'ng-ml-lang'];
  locks3.forEach(function (id) {
    var e = el(id);
    if (e) e.disabled = ro;
  });
  var briefIds = ['bf-title', 'bf-slug', 'bf-category', 'bf-author', 'bf-date', 'bf-location', 'bf-heroimage', 'bf-summary', 'bf-tags', 'bf-sources', 'bf-language'];
  briefIds.forEach(function (id) {
    var e = el(id);
    if (e) e.disabled = ro;
  });
  if (ro) setStatus('Read-only — you are viewing this story as a visitor.', 'warn');
}

function renderUserChip() {
  var chip = el('ng-user-chip');
  if (!chip) return;
  var u = _user;
  if (!u || !u.name) { chip.textContent = '👤 CMS session'; return; }
  var roles = getRoles();
  var tag = roles.length ? ' · ' + roles.join(', ') : '';
  chip.textContent = '👤 ' + u.name + tag;
}

/* ═══════════════════════════════════════════════════════════════════
   STATUS + TOASTS
   ═══════════════════════════════════════════════════════════════════ */
function setStatus(msg, kind) {
  var bar = el('ng-status-text');
  if (bar) {
    bar.innerHTML = '<span class="ng-dot ' + (kind === 'good' ? 'ng-dot-good' : kind === 'busy' ? 'ng-dot-busy' : kind === 'err' ? 'ng-dot-err' : '') + '"></span>' + esc(msg);
  }
  var barEl = el('ng-statusbar');
  if (barEl) barEl.title = msg;
}

/* ═══════════════════════════════════════════════════════════════════
   CHAT — render, send, stream
   ═══════════════════════════════════════════════════════════════════ */
function renderChat() {
  var body = el('ng-chat-body');
  var empty = el('ng-chat-empty');
  if (!body) return;
  var user = _user && _user.name ? _user.name : 'You';
  var html = '';
  var msgs = _chat.messages;
  for (var i = 0; i < msgs.length; i++) {
    var m = msgs[i];
    var isUser = m.role === 'user';
    var cls = m.isError ? ' ng-bubble-err' : (m.streaming ? ' ng-bubble-stream' : '');
    var text = esc(m.text || '');
    if (m.streaming && _stream) text += '<span class="ng-caret">▍</span>';
    html += '<div class="ng-msg ' + (isUser ? 'ng-msg-user' : 'ng-msg-ai') + '">'
      + '<div class="ng-bubble' + cls + '">' + text + '</div>';
    if (m.planInfo) {
      html += '<div class="ng-plan-card">' + esc(m.planInfo) + '</div>';
    }
    html += '<div class="ng-msg-meta">' + esc(isUser ? user : 'AI Newsroom') + ' · ' + esc(fmtTime(m.time)) + '</div></div>';
  }
  body.innerHTML = html;
  if (empty) empty.style.display = msgs.length ? 'none' : '';
  body.scrollTop = body.scrollHeight;
  renderChips();
}

function renderChips() {
  var wrap = el('ng-chips');
  if (!wrap) return;
  var has = _chat.suggests && _chat.suggests.length;
  var chips = [];
  if (_interviewMode) {
    chips.push({ label: '✋ Finish interview & compose the page', accent: true, text: 'JSON REQUIRED. End the interview and compose the page from everything gathered so far.' });
  } else if (!_chat.messages.length) {
    chips.push({ label: '⚡ Generate the page from the brief', accent: true, text: 'JSON REQUIRED. Generate the page now from the brief and our conversation.' });
    TEMPLATES.slice(0, 3).forEach(function (t) {
      chips.push({ label: t.emoji + ' ' + t.label, accent: false, text: t.text });
    });
  } else if (DB && DB.page && DB.page.html) {
    chips.push({ label: '⚡ Regenerate / update the page', accent: true, text: 'JSON REQUIRED. Update the page using the latest brief and conversation.' });
  }
  if (has) {
    _chat.suggests.forEach(function (s) {
      chips.push({ label: s, accent: false, text: s });
    });
  }
  if (!chips.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = chips.map(function (c, i) {
    return '<button class="ng-chip-sug' + (c.accent ? ' ng-chip-accent' : '') + '" data-chip="' + i + '" type="button">' + esc(c.label) + '</button>';
  }).join('');
  Array.prototype.forEach.call(wrap.querySelectorAll('[data-chip]'), function (b) {
    b.addEventListener('click', function () {
      var c = chips[parseInt(b.getAttribute('data-chip'), 10) || 0];
      if (!c) return;
      var inp = el('ng-chat-input');
      if (inp) inp.value = c.text;
      sendChatMessage(c.text);
    });
  });
  tool.resize();
}

function addChatMessage(role, text, extra) {
  var m = {
    role: role,
    text: String(text == null ? '' : text),
    time: new Date().toISOString(),
    userId: role === 'user' ? (_user && _user.id ? _user.id : 'anon') : 'ai',
    userName: role === 'user' ? (_user && _user.name ? _user.name : 'User') : 'AI Assistant'
  };
  if (extra) {
    for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) m[k] = extra[k];
  }
  _chat.messages.push(m);
  saveCurrentSession();
  persist();
  renderChat();
  return m;
}

function _shouldRegenerate(msg) {
  if (_interviewMode) return false;   // interview answers never auto-compose
  var p = DB && DB.page;
  if (!p || !p.html) return true;
  var m = String(msg || '').toLowerCase();
  if (m.length >= 60) return true;
  return /\b(update|change|add|remove|replace|edit|revise|modify|adjust|fix|improve|rework|regenerate|rebuild|recreate|build|make|include|exclude|switch|turn|use|rewrite)\b/.test(m);
}

function sendChatMessage(overrideText) {
  if (_chatBusy) { setStatus('The AI is still writing — one moment…', 'warn'); return; }
  var inp = el('ng-chat-input');
  var text = (overrideText != null ? String(overrideText) : inp ? inp.value : '').trim();
  if (!text) return;
  if (_readOnly || !_canWrite()) { setStatus('Read-only — chat is locked for viewers.', 'warn'); return; }
  if (inp && overrideText == null) inp.value = '';
  var forceJson = text.indexOf('JSON REQUIRED') !== -1;
  var wantJson = forceJson || _shouldRegenerate(text);

  _lastUserPrompt = text;
  addChatMessage('user', text);
  _chat.suggests = [];
  _chatBusy = true;
  setStatus(wantJson ? 'Composing the page…' : 'AI is thinking…', 'busy');

  var prompt = wantJson ? buildComposePrompt(text) : buildChatPrompt(text);
  var context = buildAiContext();
  if (!wantJson) context = buildAiContext();   // same context for both modes

  var streamMsg = {
    role: 'ai', text: '', time: new Date().toISOString(),
    userId: 'ai', userName: 'AI Assistant', streaming: true
  };
  _chat.messages.push(streamMsg);
  _stream = streamMsg;
  renderChat();

  var done = false;
  function finish(full, isErr) {
    if (done) return; done = true;
    _chatBusy = false;
    _stream = null;
    streamMsg.streaming = false;
    if (isErr) {
      streamMsg.isError = true;
      streamMsg.text = String(full || 'AI request failed.');
      renderChat();
      setStatus('AI error — try again.', 'err');
      return;
    }
    processAiReply(String(full || ''), wantJson, streamMsg);
  }

  function useStream() {
    if (typeof tool.requestAIStream !== 'function') return false;
    try {
      tool.requestAIStream(prompt, context, {
        onToken: function (tok) {
          streamMsg.text += tok;
          var body = el('ng-chat-body');
          if (body) body.scrollTop = body.scrollHeight;
          renderStreamText();
        },
        onComplete: function (full) { finish(full, false); },
        onError: function (err) { finish(err, true); }
      });
      return true;
    } catch (e) { return false; }
  }
  function useBatch() {
    try {
      tool.requestAI(prompt, context, function (err, resp) {
        if (err && !resp) { finish(err || 'AI error', true); return; }
        finish(resp || '', false);
      });
      return true;
    } catch (e) { return false; }
  }
  if (!useStream()) if (!useBatch()) finish('AI channel is not available — check the field settings (allowAi: yes).', true);
}

function renderStreamText() {
  // update only the last bubble text to avoid re-rendering the whole list
  var body = el('ng-chat-body');
  if (!body) return;
  var bubbles = body.querySelectorAll('.ng-msg-ai .ng-bubble');
  var last = bubbles[bubbles.length - 1];
  if (last && _stream) {
    last.textContent = _stream.text;
    var caret = document.createElement('span');
    caret.className = 'ng-caret';
    caret.textContent = '▍';
    last.appendChild(caret);
    body.scrollTop = body.scrollHeight;
  }
}

function processAiReply(raw, wantJson, streamMsg) {
  var t = String(raw == null ? '' : raw).trim();
  if (wantJson) {
    var parsed = parseAiJson(t);
    if (!parsed.ok) {
      streamMsg.isError = true;
      streamMsg.text = t ? ('⚠ The AI did not return valid JSON.\n\n' + t.slice(0, 500)) : '⚠ Empty AI response.';
      renderChat();
      setStatus('Generation failed — invalid JSON from AI.', 'err');
      return;
    }
    var v = validatePlan(parsed.data);
    if (!v.ok) {
      streamMsg.isError = true;
      streamMsg.text = '⚠ Plan rejected: ' + v.error + '\n\nThe AI was told to fix this on the next try — press ⚡ Generate Page again.';
      renderChat();
      setStatus('Plan rejected — ' + v.error, 'err');
      return;
    }
      var brief = DB.brief;
    try {
      var compiled = compilePlan(v.plan, brief);
      DB.page = {
        html: compiled.html, css: compiled.css, js: compiled.js,
        slug: compiled.slug, used: compiled.used, colors: compiled.colors,
        plan: v.plan,
        seo: isObj(v.plan.seo) ? v.plan.seo : {},
        pageMeta: isObj(v.plan.pageMeta) ? v.plan.pageMeta : {},
        flags: isObj(v.plan.flags) ? v.plan.flags : {},
        configNeeded: joinConfigNeeded(str(v.plan.configNeeded, ''), compiled.configNotes)
      };
      recordPromptLab(_lastUserPrompt);
      if (_interviewMode) { _interviewMode = false; syncInterviewButton(); }
      DB.version++;
      DB.generationCount++;
      DB.generatedAt = new Date().toISOString();
      _lastPlanNotes = str(v.plan.notes, '');
      _snapshotHistory('AI compose');
      streamMsg.text = _lastPlanNotes || 'Page composed.';
      var comps = v.plan.components.length;
      streamMsg.planInfo = '✅ Page rebuilt — v' + DB.version + ' · ' + comps + ' components · ' + ((compiled.html.length + compiled.css.length + compiled.js.length) / 1024).toFixed(1) + ' KB';
      persist();
      updatePreview();
      updateAllViews();
      renderChat();
      requestSaveNow('Page v' + DB.version + ' saved');
      setStatus('Page v' + DB.version + ' composed — ' + comps + ' components.', 'good');
    } catch (e) {
      streamMsg.isError = true;
      streamMsg.text = '⚠ Compile error: ' + e.message;
      renderChat();
      setStatus('Compile error — ' + e.message, 'err');
    }
    return;
  }
  // chat mode
  var st = stripSuggests(t);
  streamMsg.text = st.text || '…';
  _chat.suggests = st.suggests.slice(0, 4);
  renderChat();
  setStatus('Ready.', 'good');
}

/* ═══════════════════════════════════════════════════════════════════
   CHAT SESSION PERSISTENCE (ai-chat-sessions-uniconbaseapps)
   ═══════════════════════════════════════════════════════════════════ */
function _resolveInstanceId() {
  if (DB._instanceId) return DB._instanceId;
  var parentId = DB._parentRecordId || '';
  if (!parentId) {
    try {
      var m = (window.location.search || '').match(/[?&](?:objectId|recordId|id)=([^&?#]+)/);
      if (m) parentId = decodeURIComponent(m[1]);
    } catch (e) {}
  }
  if (!parentId) {
    try { var f = tool.getFields(); if (f && (f._id || f.id)) parentId = String(f._id || f.id); } catch (e) {}
  }
  if (!parentId) { try { var p1 = _param('objectId'); if (p1) parentId = String(p1); } catch (e) {} }
  if (!parentId) { try { var p2 = _param('recordId'); if (p2) parentId = String(p2); } catch (e) {} }
  if (parentId) { DB._parentRecordId = parentId; DB._instanceId = 'news_' + parentId; }
  else DB._instanceId = 'news_' + Date.now().toString(36);
  return DB._instanceId;
}

function sessionDcb(obj) {
  try {
    var pd = obj && obj.productData;
    if (pd && pd.data_categoriesBased) return pd.data_categoriesBased;
    if (isObj(obj)) return obj;
  } catch (e) {}
  return null;
}

function chatCrudOk() {
  if (_chat.crudOk !== null) return _chat.crudOk;
  _chat.crudOk = true;   // optimistic — flips to false on a hard channel error
  return true;
}

function loadChatFromServer(cb) {
  if (typeof tool.requestObjects !== 'function') {
    _chat.crudOk = false;
    restoreCache();
    if (cb) cb(false);
    return;
  }
  try {
    tool.requestObjects('query', { mainObjectType: SESSION_TYPE }, function (err, result) {
      if (err) {
        _chat.crudOk = false;
        if (!_chat.warned) {
          _chat.warned = true;
          tool.notify('Chat history channel unavailable (' + err + '). Transcript is kept in this record instead.', 'warning');
          setStatus('Chat persistence degraded — history stays in this record.', 'warn');
        }
        restoreCache();
        if (cb) cb(false);
        return;
      }
      var objs = (result && Array.isArray(result.objects)) ? result.objects : [];
      var mine = _resolveInstanceId();
      var chosen = null;
      for (var i = 0; i < objs.length; i++) {
        var dcb = sessionDcb(objs[i]);
        if (!dcb) continue;
        if (dcb._toolInstanceId === mine || (dcb._toolInstanceId && mine !== 'news_' && String(dcb._toolInstanceId).indexOf(mine) === 0)) { chosen = objs[i]; break; }
        if (!dcb._toolInstanceId && objs[i]._parentObjectId && DB._parentRecordId && objs[i]._parentObjectId === DB._parentRecordId) { chosen = objs[i]; }
      }
      if (!chosen) chosen = objs[0];  // instance scope: any returned session belongs to this record
      if (chosen) {
        _chat.sessionId = chosen.id;
        _chat.sessionObj = chosen;
        DB.chatSessionId = chosen.id;
        var dcb = sessionDcb(chosen);
        if (dcb && Array.isArray(dcb.messages)) {
          _chat.messages = dcb.messages.map(function (m) {
            return { role: m.role, text: m.text, time: m.time, userId: m.userId, userName: m.userName, isError: !!m.isError, planInfo: m.planInfo };
          });
          if (dcb._toolInstanceId) DB._instanceId = dcb._toolInstanceId;
          if (chosen._parentObjectId) DB._parentRecordId = chosen._parentObjectId;
          persist();
        }
        renderChat();
      } else {
        restoreCache();
      }
      if (cb) cb(true);
    });
  } catch (e) {
    _chat.crudOk = false;
    restoreCache();
    if (cb) cb(false);
  }
}

function restoreCache() {
  var cc = DB.chatCache;
  if (cc && cc.messages && Array.isArray(cc.messages) && cc.messages.length && !_chat.messages.length) {
    _chat.messages = cc.messages.map(function (m) { return { role: m.role, text: m.text, time: m.time, userId: m.userId, userName: m.userName, isError: m.isError, planInfo: m.planInfo }; });
    _chat.sessionId = cc.sessionId || '';
    renderChat();
  }
}

function saveCurrentSession() {
  var myId = _resolveInstanceId();
  var msgs = _chat.messages.map(function (m) {
    return {
      role: m.role, text: String(m.text || '').slice(0, 8000), time: m.time,
      userId: m.userId || 'anon', userName: m.userName || (m.role === 'ai' ? 'AI Assistant' : 'User'),
      isError: !!m.isError, planInfo: m.planInfo || ''
    };
  }).slice(-SESSION_MSG_LIMIT);

  if (_chat.sessionId && _chat.sessionObj) {
    var oldDcb = sessionDcb(_chat.sessionObj) || {};
    var newDcb = {};
    for (var k in oldDcb) if (Object.prototype.hasOwnProperty.call(oldDcb, k)) newDcb[k] = oldDcb[k];
    newDcb.messages = msgs;
    newDcb.updatedAt = new Date().toISOString();
    if (!newDcb._toolInstanceId) newDcb._toolInstanceId = myId;
    if (!newDcb.createdBy) {
      var u = _user || {};
      newDcb.createdBy = { userId: u.id || 'anon', userName: u.name || 'User' };
    }
    if (typeof tool.requestObjects === 'function') {
      try {
        tool.requestObjects('update', {
          mainObjectType: SESSION_TYPE,
          objectId: _chat.sessionId,
          name: autoSessionName().slice(0, 60),
          productData: { data_categoriesBased: newDcb }
        }, function () {});
      } catch (e) { _chat.crudOk = false; }
    }
    return;
  }

  if (_chat.messages.length) {
    if (typeof tool.requestObjects !== 'function') { _chat.crudOk = false; return; }
    try {
      tool.requestObjects('create', {
        mainObjectType: SESSION_TYPE,
        name: autoSessionName().slice(0, 60),
        productData: {
          data_categoriesBased: {
            messages: msgs,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: { userId: (_user && _user.id) || 'anon', userName: (_user && _user.name) || 'User' },
            _toolInstanceId: myId
          }
        }
      }, function (err, result) {
        if (err) {
          _chat.crudOk = false;
          if (!_chat.warned) {
            _chat.warned = true;
            tool.notify('Chat session storage unavailable — transcript kept in this record.', 'warning');
          }
          return;
        }
        if (result && result.object) {
          _chat.sessionId = result.object.id;
          _chat.sessionObj = result.object;
          DB.chatSessionId = result.object.id;
          if (result.object._parentObjectId) { DB._parentRecordId = result.object._parentObjectId; DB._instanceId = 'news_' + result.object._parentObjectId; }
          persist();
        }
      });
    } catch (e) { _chat.crudOk = false; }
  }
}

function autoSessionName() {
  var title = (DB.brief && DB.brief.title) || (DB.page && DB.page.pageMeta && DB.page.pageMeta.name) || 'Untitled news story';
  return ('News: ' + title).slice(0, 60);
}

function clearChat() {
  if (_chat.sessionId && typeof tool.requestObjects === 'function') {
    try {
      tool.requestObjects('delete', { mainObjectType: SESSION_TYPE, objectId: _chat.sessionId }, function () {});
    } catch (e) {}
  }
  _chat.sessionId = '';
  _chat.sessionObj = null;
  _chat.messages = [];
  _chat.suggests = [];
  DB.chatSessionId = '';
  DB.chatCache = { sessionId: '', messages: [] };
  persist();
  renderChat();
  setStatus('Conversation cleared — the page is kept.', 'good');
  tool.notify('Chat cleared. Page untouched.', 'info');
}

/* ═══════════════════════════════════════════════════════════════════
   PREVIEW
   ═══════════════════════════════════════════════════════════════════ */
function _gwPreviewMockScript(lang) {
  return '<script>\n(function(){'
    + 'var L=' + JSON.stringify(lang || 'en') + ';'
    + 'var mem={};'
    + 'function mget(k){ try { return mem[k] == null ? null : mem[k]; } catch(e){ return null; } }'
    + 'function mset(k,v){ try { mem[k]=String(v); } catch(e){} }'
    + 'var gw={'
    + 'pageId:"preview",siteId:"preview",folderId:"preview",language:L,host:"preview",currency:"USD",ns:{},'
    + 'getPageParams:function(){return {slug:"preview"};},'
    + 'navigate:function(p){ notify("SPA navigation to "+p+" (preview only)","info"); return false; },'
    + 'openUrl:function(u){ try { window.open(u,"_blank","noopener"); } catch(e){} },'
    + 'onRouteChange:function(cb){ var fns=[cb]; return function(){ fns=[]; }; },'
    + 'getUser:function(){return null;},'
    + 'isAuthenticated:function(){return false;},'
    + 'authReady:Promise.resolve(null),'
    + 'refreshAuth:function(){return Promise.resolve(null);},'
    + 'login:function(){return false;},'
    + 'logout:function(){return false;},'
    + 'storage:{get:mget,set:mset,remove:function(k){ try { delete mem[k]; } catch(e){} }},'
    + 'formatCurrency:function(n){return "$"+Number(n||0).toFixed(2);},'
    + 'formatDate:function(d){try{var x=new Date(d);if(isNaN(x.getTime()))return String(d||"");return x.toISOString().slice(0,10);}catch(e){return String(d||"");}},'
    + 'notify:notify,'
    + 'setLoading:function(){},'
    + 'showModal:function(html){var m=document.createElement("div");m.style.cssText="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);z-index:99999";m.innerHTML=String(html||"");m.onclick=function(e){if(e.target===m)m.remove();};document.body.appendChild(m);return function(){m.remove();};},'
    + 'sanitize:function(s){var d=document.createElement("div");d.textContent=String(s||"");return d.innerHTML;},'
    + 'track:function(){},trackPageView:function(){},'
    + 'forms:{bind:function(){},submit:function(){return Promise.resolve({ok:true});}},'
    + 'db:{query:function(){return Promise.resolve({items:[],total:0,page:1,pageSize:0,facets:{},relations:{}});},get:function(){return Promise.resolve(null);},operation:function(){return Promise.resolve({ok:true,result:{}});},subscribe:function(){return function(){};}},'
    + 'apps:{register:function(){},mount:function(){},unmount:function(){}},'
    + 'service:function(){return Promise.reject(new Error("gw.service not available"));}'
    + '};'
    + 'function notify(m,o){ var t=document.createElement("div");'
    + 't.style.cssText="position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:rgba(15,18,32,.94);color:#fff;padding:10px 16px;border-radius:10px;font:13px system-ui,sans-serif;z-index:99999;max-width:80vw;box-shadow:0 8px 24px rgba(0,0,0,.4)";'
    + 't.textContent=m;document.body.appendChild(t);setTimeout(function(){try{t.remove();}catch(e){}},2600);}'
    + 'if(!window.gw){window.gw=gw;}'
    + 'window.__gwPreviewMock=true;'
    + 'setTimeout(function(){try{window.dispatchEvent(new CustomEvent("gw:ready",{detail:{pageId:"preview"}}));window.dispatchEvent(new CustomEvent("gw:content-ready",{detail:{contentId:"preview"}}));}catch(e){}},0);'
    + '})();\n<' + '/script>';
}

function _previewConsoleRelay() {
  return '<script>\n(function(){'
    + 'function send(kind,args){'
    + 'var parts=[];'
    + 'for(var i=0;i<args.length;i++){try{parts.push(typeof args[i]==="object"?JSON.stringify(args[i]):String(args[i]));}catch(e){parts.push(String(args[i]));}}'
    + 'try{parent.postMessage({__ng:true,kind:kind,text:parts.join(" ").slice(0,2000)},"*");}catch(e){}'
    + '}'
    + 'window.addEventListener("error",function(e){try{send("err",[e.message+" @ "+(e.filename||"")+":"+(e.lineno||"")]);}catch(x){}});'
    + 'var cl=window.console||{};'
    + '["log","warn","error"].forEach(function(m){'
    + 'var orig=cl[m]?cl[m].bind(cl):function(){};'
    + 'cl[m]=function(){try{send(m,arguments);}catch(e){}orig.apply(null,arguments);};'
    + '});'
    + '})();\n<' + '/script>';
}

/* ── Quote-highlight sharing (Phase 1 · C1): selection toolbar in the preview ── */
function _selectionToolbarScript() {
  var path = '/' + ((DB.page && DB.page.slug) || 'story');
  return '<script>\n(function(){'
    + 'var PAGE_PATH=' + JSON.stringify(path) + ';'
    + 'var bar=document.createElement("div");'
    + 'bar.style.cssText="position:fixed;display:none;z-index:99997;background:#16181f;color:#fff;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.35);font:12px system-ui,sans-serif;overflow:hidden";'
    + 'function mk(label){var b=document.createElement("button");b.type="button";b.textContent=label;b.style.cssText="background:transparent;border:none;color:#fff;padding:8px 12px;cursor:pointer;font:inherit";'
    + 'b.addEventListener("mouseenter",function(){b.style.background="rgba(255,255,255,.12)"});'
    + 'b.addEventListener("mouseleave",function(){b.style.background="transparent"});return b;}'
    + 'var copyBtn=mk("📋 Copy");var linkBtn=mk("🔗 Copy link");'
    + 'bar.appendChild(copyBtn);bar.appendChild(linkBtn);'
    + 'document.body.appendChild(bar);'
    + 'var lastSec="";'
    + 'function hide(){bar.style.display="none";}'
    + 'function findSecId(node){var n=node;while(n&&n.nodeType!==1)n=n.parentNode;'
    + 'while(n){if(n.id&&n.tagName!=="BODY")return n.id;n=n.parentElement||n.parentNode;}return "";}'
    + 'document.addEventListener("mouseup",function(){setTimeout(function(){'
    + 'var sel=window.getSelection();if(!sel||sel.isCollapsed){hide();return;}'
    + 'var t=sel.toString().trim();if(t.length<4){hide();return;}'
    + 'var r=sel.getRangeAt(0).getBoundingClientRect();'
    + 'lastSec=findSecId(sel.anchorNode);'
    + 'bar.style.display="flex";'
    + 'bar.style.left=Math.max(8,Math.min(window.innerWidth-bar.offsetWidth-8,r.left+r.width/2-bar.offsetWidth/2))+"px";'
    + 'bar.style.top=(r.bottom+8)+"px";'
    + '},0);});'
    + 'document.addEventListener("mousedown",function(e){if(!bar.contains(e.target))hide();});'
    + 'window.addEventListener("scroll",hide);'
    + 'function copy(txt,done){try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(done,function(){done()});}'
    + 'else{var ta=document.createElement("textarea");ta.value=txt;document.body.appendChild(ta);ta.select();try{document.execCommand("copy");}catch(e){}document.body.removeChild(ta);done();}}catch(e){done();}}'
    + 'copyBtn.addEventListener("click",function(){var s=window.getSelection();copy(s?s.toString().trim():"",function(){copyBtn.textContent="✓ Copied";setTimeout(function(){copyBtn.textContent="📋 Copy";hide();},900);});});'
    + 'linkBtn.addEventListener("click",function(){copy(PAGE_PATH+(lastSec?"#"+lastSec:""),function(){linkBtn.textContent="✓ Link copied";setTimeout(function(){linkBtn.textContent="🔗 Copy link";hide();},900);});});'
    + '})();\n<' + '/script>';
}

function buildPreviewDoc() {
  var p = DB.page;
  var lang = (DB.brief && DB.brief.language) || 'en';
  var title = esc((p && p.seo && p.seo.metaTitle) || (DB.brief && DB.brief.title) || 'News story');
  var html = '<!DOCTYPE html>\n<html lang="' + esc(lang) + '">\n<head>\n<meta charset="UTF-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
    + '<title>' + title + '</title>\n'
    + '<style>\nbody{margin:0;padding:0;background:#fff}\n' + (p.css || '') + '\n</style>\n</head>\n<body>\n'
    + (p.html || '') + '\n'
    + _gwPreviewMockScript(lang) + '\n'
    + _previewConsoleRelay() + '\n'
    + _selectionToolbarScript() + '\n'
    + '<script>\n' + (p.js || '') + '\n<' + '/script>\n</body>\n</html>';
  return html;
}

function updatePreview() {
  var p = DB.page;
  var empty = el('ng-empty-prev');
  var viewport = el('ng-prev-viewport');
  var meta = el('ng-prev-meta');
  if (!viewport) return;
  viewport.innerHTML = '';
  viewport.classList.remove('ng-prev-lab');
  if (!p || !p.html) {
    if (empty) empty.style.display = '';
    if (meta) meta.textContent = '—';
    setCodeMeta();
    return;
  }
  if (empty) empty.style.display = 'none';
  var doc = buildPreviewDoc();
  function makeFrame(cls, devAttr) {
    var w = document.createElement('div');
    w.className = cls;
    if (devAttr) w.setAttribute('data-dev', devAttr);
    var f = document.createElement('iframe');
    f.className = 'ng-preview';
    f.setAttribute('sandbox', 'allow-scripts allow-forms allow-downloads');
    f.setAttribute('title', 'Generated news page preview');
    f.srcdoc = doc;
    w.appendChild(f);
    viewport.appendChild(w);
  }
  if (_device === 'all') {
    viewport.classList.add('ng-prev-lab');
    makeFrame('ng-prev-frame ng-lab-frame-m');
    makeFrame('ng-prev-frame ng-lab-frame-t');
    makeFrame('ng-prev-frame ng-lab-frame-d');
  } else {
    makeFrame('ng-prev-frame', _device);
  }
  if (meta) {
    var p1 = DB.page;
    meta.textContent = (p1.html.length + p1.css.length + p1.js.length) / 1024 >= 1
      ? ((p1.html.length + p1.css.length + p1.js.length) / 1024).toFixed(1) + ' KB · ' + (p1.used ? Object.keys(p1.used).length : '') + ' components'
      : '—';
  }
  setCodeMeta();
  tool.resize();
}

function setCodeMeta() {
  var m = el('ng-code-meta');
  if (!m) return;
  var p = DB.page;
  if (!p) { m.textContent = ''; return; }
  var totals = (p.html ? p.html.length : 0) + (p.css ? p.css.length : 0) + (p.js ? p.js.length : 0);
  m.textContent = 'v' + (DB.version || 0) + ' · ' + (totals / 1024).toFixed(1) + ' KB';
}

function addConsoleLine(text, kind) {
  var out = el('ng-console-out');
  if (!out) return;
  _consoleLines.push({ text: text, kind: kind });
  if (_consoleLines.length > 200) _consoleLines.shift();
  var dim = out.querySelector('.ng-console-dim');
  out.innerHTML = _consoleLines.map(function (l) {
    return '<div class="ng-console-line ng-console-' + (l.kind === 'err' ? 'err' : l.kind === 'warn' ? 'warn' : '') + '">' + esc(l.text) + '</div>';
  }).join('');
  if (dim) out.appendChild(dim);
  out.scrollTop = out.scrollHeight;
  var count = el('ng-console-count');
  if (count) count.textContent = _consoleLines.filter(function (l) { return l.kind !== 'log'; }).length || '';
}

/* ═══════════════════════════════════════════════════════════════════
   TABS / CODE / BRIEF / PUBLISH VIEWS
   ═══════════════════════════════════════════════════════════════════ */
function switchTab(tab) {
  _currentTab = tab;
  var tabs = el('ng-tabs');
  if (tabs) {
    Array.prototype.forEach.call(tabs.querySelectorAll('.ng-tab'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === tab);
    });
  }
  ['preview', 'gallery', 'story', 'code', 'publish'].forEach(function (t) {
    var pane = el('pane-' + t);
    if (pane) pane.classList.toggle('active', t === tab);
  });
  if (tab === 'code') updateCodeView();
  if (tab === 'publish') updatePublishView();
  if (tab === 'preview') updatePreview();
  if (tab === 'gallery') renderGallery();
  if (tab === 'story') renderArchetypeBar();
  tool.resize();
}

var CODE_SECTIONS = ['html', 'css', 'js', 'seo', 'meta', 'config'];
function codeSectionText(tab) {
  var p = DB.page;
  if (!p) return '';
  if (tab === 'html') return p.html || '';
  if (tab === 'css') return p.css || '';
  if (tab === 'js') return p.js || '';
  if (tab === 'seo') return p.seo ? JSON.stringify(p.seo, null, 2) : '{}';
  if (tab === 'meta') return p.pageMeta ? JSON.stringify(p.pageMeta, null, 2) : '{}';
  if (tab === 'config') return (p.configNeeded && p.configNeeded.trim()) ? '=== CMS CONFIG NEEDED ===\n' + p.configNeeded : '(none — this page needs no extra CMS operations, flows or email templates.)';
  return '';
}

function updateCodeView() {
  var ta = el('ng-code-out');
  var tabs = el('ng-code-tabs');
  if (tabs) {
    Array.prototype.forEach.call(tabs.querySelectorAll('.ng-codetab'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-code') === _codeTab);
    });
  }
  if (ta) ta.value = codeSectionText(_codeTab);
}

function updateStoryForm() {
  var b = DB.brief;
  setFieldVal('bf-title', b.title);
  setFieldVal('bf-slug', b.slug);
  setFieldVal('bf-category', b.category);
  setFieldVal('bf-author', b.author);
  setFieldVal('bf-date', b.date);
  setFieldVal('bf-location', b.location);
  setFieldVal('bf-heroimage', b.heroImage);
  setFieldVal('bf-summary', b.summary);
  setFieldVal('bf-tags', (b.tags || []).join(', '));
  setFieldVal('bf-sources', (b.sources || []).map(function (s) { return s.name + (s.url ? ' | ' + s.url : ''); }).join('\n'));
  setFieldVal('bf-language', b.language || 'en');
}

function setFieldVal(id, v) {
  var e = el(id);
  if (e) e.value = v == null ? '' : String(v);
}

function readBriefForm() {
  var b = DB.brief;
  b.title = el('bf-title').value.trim();
  var slugInput = el('bf-slug').value.trim();
  b.slug = slugInput || slugify(b.title);
  if (el('bf-slug').value.trim() === '') el('bf-slug').placeholder = b.slug;
  b.category = el('bf-category').value.trim();
  b.author = el('bf-author').value.trim();
  b.date = el('bf-date').value.trim();
  b.location = el('bf-location').value.trim();
  b.heroImage = el('bf-heroimage').value.trim();
  b.summary = el('bf-summary').value.trim();
  b.language = el('bf-language').value || 'en';
  b.tags = el('bf-tags').value.split(',').map(function (t) { return t.trim(); }).filter(Boolean).slice(0, 12);
  b.sources = el('bf-sources').value.split('\n').map(function (line) {
    var parts = line.split('|');
    var name = (parts[0] || '').trim();
    var url = (parts[1] || '').trim();
    if (!name && !url) return null;
    return { name: name || url, url: url };
  }).filter(Boolean).slice(0, 20);
  return b;
}

function scheduleBriefPersist() {
  if (_briefTimer) clearTimeout(_briefTimer);
  _briefTimer = setTimeout(function () {
    readBriefForm();
    persist();
    renderStoryTitle();
    setStatus('Brief auto-staged.', 'good');
  }, 300);
}

/* ── Interview mode (Phase 1 · D1) ── */
function syncInterviewButton() {
  var btn = el('ng-btn-interview');
  if (!btn) return;
  btn.classList.toggle('ng-on', _interviewMode);
  btn.textContent = _interviewMode ? '🎙 Interview: ON' : '🎙 Interview';
}
function toggleInterview() {
  if (_readOnly || !_canWrite()) { setStatus('Read-only — interview is locked for viewers.', 'warn'); return; }
  _interviewMode = !_interviewMode;
  syncInterviewButton();
  renderChips();
  if (_interviewMode) {
    setStatus('Interview mode on — answer the questions and the AI will gather the facts.', 'busy');
    sendChatMessage('Start the interview: ask me your first question about the story. One question at a time.');
  } else {
    setStatus('Interview mode off.', 'good');
  }
}

function renderStoryTitle() {
  var t = el('ng-story-title');
  if (!t) return;
  var title = (DB.brief && DB.brief.title) || (DB.page && DB.page.pageMeta && DB.page.pageMeta.name) || 'No story yet — describe the event in the AI Newsroom';
  t.textContent = title;
  var chip = el('ng-page-chip');
  if (chip) {
    if (DB.page && DB.page.html) {
      chip.textContent = '📄 v' + DB.version + ' ready';
      chip.className = 'ng-chip ng-chip-good';
    } else {
      chip.textContent = '📄 No page';
      chip.className = 'ng-chip';
    }
  }
  var ver = el('ng-ver-chip');
  if (ver) ver.textContent = 'v' + (DB.version || 0);
}

function updatePublishView() {
  var pre = el('ng-pub-json');
  if (pre) {
    pre.textContent = DB.page && DB.page.html ? buildPageObjectJson() : 'No page generated yet — press ⚡ Generate Page.';
  }
  var list = el('ng-pub-checks');
  var score = el('ng-check-score');
  if (list) {
    var checks = runGuardChecks();
    var pass = 0;
    checks.forEach(function (c) { if (c.ok) pass++; });
    list.innerHTML = checks.map(function (c) {
      return '<li><span class="' + (c.ok ? 'ng-ok' : 'ng-fail') + '">' + (c.ok ? '✔' : '✘') + '</span>' + esc(c.label) + '</li>';
    }).join('');
    if (score) {
      score.textContent = pass + '/' + checks.length;
      score.className = 'ng-pub-json-head';
      score.style.color = pass === checks.length ? 'var(--ng-good)' : 'var(--ng-warn)';
    }
  }
  renderSeoScorecard();
  renderChecklist();
  renderPerf();
  renderSocialPreview();
  renderCredits();
  renderReview();
  renderEmailEdition();
  renderPromptLab();
  renderPublishAt();
  var hc = el('ng-history-count');
  if (hc) hc.textContent = ((DB.historyLocal && DB.historyLocal.length) || 0) + ' local snapshots';
}

function renderPublishAt() {
  var inp = el('ng-publish-at');
  if (!inp) return;
  if (!_readOnly && _canWrite()) inp.value = DB.publishAt || '';
  var hint = el('ng-publish-at-hint');
  if (hint) hint.textContent = DB.publishAt ? ('⏰ Scheduled: ' + DB.publishAt + ' — included in the page object JSON.') : 'Set a publish time — it rides along when you create the CMS page object.';
}

function renderExtraPrompt() {
  var ta = el('ng-extra-prompt');
  if (ta) ta.value = DB.extraPrompt || '';
}

/* ═══════════════════════════════════════════════════════════════════
   GALLERY + COLOR SETS (visual component browser)
   ═══════════════════════════════════════════════════════════════════ */
var GALLERY_SAMPLES = {
  hero: { label: 'Hero', data: { style: 'broadsheet', kicker: 'POLITICS', title: 'Council Approves Waterfront Master Plan', subtitle: 'The 12-hectare harbour district will open in phases, beginning in 2027.', image: 'https://loremflickr.com/1200/675/waterfront,city', imageAlt: 'Harbour waterfront', meta: { date: 'August 19, 2026', location: 'Kordon', readingTime: '4 min' } } },
  byline: { label: 'Byline', data: { name: 'Deniz Aydin', role: 'City desk', location: 'Izmir', date: 'August 19, 2026', updated: '12:40', readingTime: '4 min read' } },
  standfirst: { label: 'Standfirst', data: { text: 'After six years of consultation, the harbour plan passes unanimously — and the first cranes arrive next spring.' } },
  breaking: { label: 'Breaking strip', data: { label: 'BREAKING', text: 'The vote passed 41–0 at the city council meeting this morning.', time: '09:22' } },
  liveblog: { label: 'Live blog', data: { title: 'As it happened', entries: [{ time: '12:40', text: 'Mayor confirms phase one funding is secured.', tag: 'milestone' }, { time: '11:05', text: 'Opposition leader: "We support the plan, with amendments."', tag: 'quote' }, { time: '09:00', text: 'Session opens at city hall.', tag: 'update' }] } },
  lead: { label: 'Lead', data: { text: 'The council chamber fell quiet as the final tally appeared on the screen: forty-one in favour, none against.' } },
  article: { label: 'Article', data: { blocks: [{ t: 'h2', text: 'What the plan includes' }, { t: 'p', text: 'The master plan divides the waterfront into four districts — a civic square, a market quarter, a maritime museum and 8 hectares of parkland.' }, { t: 'quote', text: 'This is the biggest single investment in our coastline in a generation.', by: 'Mayor Elif Kaya' }, { t: 'note', kind: 'info', text: 'Public exhibition runs at the city gallery until September 30.' }] } },
  keyfacts: { label: 'Key facts', data: { title: 'By the numbers', stats: [{ value: 12, suffix: ' ha', label: 'District size', icon: '📐' }, { value: 8, suffix: ' ha', label: 'New parkland', icon: '🌳' }, { value: 41, label: 'Votes in favour', icon: '🗳️' }, { value: 2027, label: 'First phase opens', icon: '🏗️' }] } },
  keypoints: { label: 'At a glance', data: { title: 'At a glance', points: ['Plan passed unanimously on August 19, 2026.', 'Four districts, 8 hectares of parkland.', 'Construction begins spring 2027.', 'Public exhibition open until September 30.'] } },
  factcheck: { label: 'Fact check', data: { claim: 'The project is funded entirely from the city budget.', verdict: 'half-true', by: 'City desk', explanation: 'Two thirds comes from the city; the remainder is a national infrastructure grant.' } },
  timeline: { label: 'Timeline', data: { title: 'How we got here', items: [{ time: '2020', title: 'First consultation', text: 'Six public workshops.', kind: 'milestone' }, { time: '2023', title: 'Draft plan', text: 'Published for comment.', kind: 'update' }, { time: '2026', title: 'Approved', text: 'Unanimous vote.', kind: 'quote' }] } },
  quote: { label: 'Pull quote', data: { text: 'We did not wait for someone else to decide our coastline’s future. We decided it together.', by: 'Elif Kaya', role: 'Mayor' } },
  faq: { label: 'FAQ', data: { title: 'What we know so far', items: [{ q: 'When does construction start?', a: 'Spring 2027.' }, { q: 'How is it funded?', a: 'Two thirds city, one third national grant.' }] } },
  related: { label: 'Related stories', data: { title: 'Keep reading', items: [{ title: 'Metro line 4 opens next month', url: '/metro', tag: 'CITY' }, { title: 'Harbour museum wins design award', url: '/museum', tag: 'CULTURE' }] } },
  sources: { label: 'Sources', data: { title: 'Sources & further reading', items: [{ name: 'City planning office', url: 'https://example.com/plan' }, { name: 'Council minutes — August 19', url: 'https://example.com/minutes', note: 'PDF' }] } },
  cta: { label: 'Call to action', data: { title: 'Follow the waterfront build', text: 'Monthly updates from the planning desk, straight to your inbox.', button: { label: 'Get updates', url: '/newsletter' }, kind: 'subscribe' } },
  gallery: { label: 'Gallery', data: { title: 'Opening day', cols: 3, images: [{ src: 'https://loremflickr.com/900/700/city,waterfront', alt: 'Waterfront', caption: 'The harbour at dawn' }, { src: 'https://loremflickr.com/900/700/council,hall', alt: 'Council hall', caption: 'The vote' }, { src: 'https://loremflickr.com/900/700/park,trees', alt: 'Parkland', caption: 'Planned parkland' }] } },
  photostory: { label: 'Photo story', data: { kicker: 'THE MOMENT', title: 'Forty-one hands', image: 'https://loremflickr.com/1600/900/cityhall,vote', alt: 'The vote on screen', caption: 'The final tally appears as the chamber erupts in applause.', credit: 'Photo: D. Aydin / Newsroom' } },
  scorecard: { label: 'Scorecard', data: { sport: 'LEAGUE ROUND 21', status: 'FT', venue: 'City Stadium', home: { name: 'Kordon SK', score: 2 }, away: { name: 'Harbour FC', score: 1 }, note: 'Kordon move to second place.' } },
  poll: { label: 'Poll', data: { question: 'Would you visit the new waterfront in its first month?', options: ['Definitely', 'Maybe', 'No'], note: 'Demo poll — votes stay in your browser.' } },
  reactions: { label: 'Reactions', data: { title: 'How does this story make you feel?' } },
  share: { label: 'Share', data: { title: 'Share this story', text: 'Waterfront plan approved' } },
  progress: { label: 'Reading progress', data: {} },
  toc: { label: 'Table of contents', data: { title: 'In this story' } },
  ticker: { label: 'Ticker', data: { label: 'LATEST', items: ['Waterfront plan approved 41–0', 'Construction begins spring 2027', 'Public exhibition open until Sept 30'] } },
  chart: { label: 'Chart', data: { title: 'Visitors to the waterfront (millions)', type: 'bar', labels: ['2022', '2023', '2024', '2025', '2026'], series: [{ label: 'Visitors', data: [1.2, 1.4, 1.9, 2.3, 3.1], color: '#1f4e8c' }], unit: 'M', source: 'City tourism office' } },
  compare: { label: 'Before / after', data: { title: 'The harbour, then and now', before: { src: 'https://loremflickr.com/1200/750/harbour,old', alt: 'Old harbour', label: '2019' }, after: { src: 'https://loremflickr.com/1200/750/harbour,new', alt: 'New harbour', label: '2026' } } },
  countdown: { label: 'Countdown', data: { title: 'Ground-breaking ceremony', target: '2027-03-01T09:00:00Z', note: 'Phase one begins next spring.' } },
  tabs: { label: 'Tabs', data: { title: 'Explore', tabs: [{ title: 'The plan', blocks: [{ t: 'p', text: 'Four districts along 2.4 km of coastline.' }] }, { title: 'The money', blocks: [{ t: 'p', text: 'Two thirds city, one third national grant.' }] }] } },
  table: { label: 'Table', data: { title: 'Phase timeline', head: ['Phase', 'District', 'Opens'], rows: [['1', 'Civic square', '2027'], ['2', 'Market quarter', '2028'], ['3', 'Maritime museum', '2029']], source: 'City planning office' } },
  video: { label: 'Video', data: { title: 'Watch: the chamber vote', src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', caption: 'Sample video' } },
  audio: { label: 'Audio', data: { title: 'Listen: the mayor’s statement', src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3' } },
  infobox: { label: 'Infobox', data: { kind: 'info', title: 'Public exhibition', text: 'Models and drawings are on display at the city gallery until September 30.' } },
  steps: { label: 'Steps', data: { title: 'What happens next', items: [{ title: 'Detailed design', text: 'Architects appointed by November.', icon: '✍️' }, { title: 'Tender', text: 'Works packages go out in January.', icon: '📋' }, { title: 'Construction', text: 'First cranes arrive in March 2027.', icon: '🏗️' }] } },
  mapcard: { label: 'Map card', data: { title: 'On location', place: 'Kordon Waterfront', address: '2.4 km of coastline, Kordon district', region: 'Izmir, Türkiye', note: 'Public exhibition at the city gallery.' } },
  personcard: { label: 'Person card', data: { name: 'Elif Kaya', role: 'Mayor', bio: 'Elected 2024 on a platform of civic renewal.', quote: 'The coastline belongs to everyone.', connection: 'Championed the plan through six years of consultation.' } },
  tags: { label: 'Tags', data: { title: 'Topics', tags: ['city', 'waterfront', 'planning'] } },
  authorcard: { label: 'Author card', data: { name: 'Deniz Aydin', role: 'City desk', bio: 'Covers municipal affairs for the newsroom since 2021.' } },
  divider: { label: 'Divider', data: { icon: '✦' } },
  editorsnote: { label: 'Editor’s note', data: { text: 'This article was updated after the council meeting with the final tally.' } },
  corrections: { label: 'Corrections', data: { note: 'An earlier version said the vote was 40–1; it was 41–0.' } },
  quiz: { label: 'Story quiz', data: { title: 'How well did you follow the story?', questions: [{ q: 'When was the plan approved?', options: ['August 19, 2026', 'June 2025', 'Spring 2027'], correct: 0 }, { q: 'How many hectares of parkland?', options: ['4', '8', '12'], correct: 1 }], note: 'Scores are computed in your browser.' } },
  heatstrip: { label: 'Heat strip', data: { title: 'Neighbourhood support (%)', unit: '%', items: [{ label: 'Kordon', value: 88 }, { label: 'Alsancak', value: 74 }, { label: 'Bostanli', value: 63 }, { label: 'Karsiyaka', value: 51 }, { label: 'Bornova', value: 44 }] } },
  annotatedmap: { label: 'Annotated map', data: { title: 'The four districts', image: 'https://loremflickr.com/800/500/map,city', points: [{ x: 30, y: 40, label: 'Civic square' }, { x: 55, y: 30, label: 'Market quarter' }, { x: 72, y: 58, label: 'Maritime museum' }, { x: 40, y: 70, label: 'Parkland' }] } },
  orgchart: { label: 'Org chart', data: { title: 'Who runs the project', root: { label: 'Project board', role: 'Oversight', children: [{ label: 'Planning desk', role: 'Design', note: 'Master plan owners' }, { label: 'Finance office', role: 'Funding' }, { label: 'Community forum', role: 'Residents', children: [{ label: 'Kordon residents', role: 'District' }] }] } } },
  videocompare: { label: 'Video before/after', data: { title: 'The harbour, in motion', before: { src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', label: '2019' }, after: { src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm', label: '2026' } } },
  scrolly: { label: 'Scrollytelling', data: { title: 'A walk through the plan', chapters: [{ title: 'The civic square', text: 'A 2-hectare plaza where the old customs house once stood.', image: 'https://loremflickr.com/1600/900/plaza,city' }, { title: 'The market quarter', text: 'Shaded arcades and 120 stalls under a green roof.', image: 'https://loremflickr.com/1600/900/market,arcade' }, { title: 'The maritime museum', text: 'A timber pavilion facing the water.', image: 'https://loremflickr.com/1600/900/museum,water' }] } },
  comments: { label: 'Comments hook', data: { title: 'Join the discussion', note: 'Comments open once the CMS form-type is configured.' } },
  widget: { label: 'Widget island', data: { name: 'list', config: { cmsObjectType: 'city-news', orderBy: 'created', orderDir: 'desc', pageSize: 3, fields: [{ field: 'title', label: 'Latest' }] }, note: 'Loading the latest updates…' } }
};

function gallerySampleFor(id) {
  var s = GALLERY_SAMPLES[id];
  if (!s) return {};
  try { return JSON.parse(JSON.stringify(s.data)); } catch (e) { return {}; }
}
function galleryLabel(id) {
  var s = GALLERY_SAMPLES[id];
  return s ? s.label : id;
}

function galleryCss(set) {
  return baseCss('gallery', set.accent, set.primary)
    + '\n.news-gallery{max-width:100%}\n'
    + '.news-gallery .n-sec{padding:14px 12px}\n'
    + '.news-gallery .n-inner{max-width:100%}\n'
    + '.news-gallery .n-inner-narrow{max-width:100%}\n'
    + '.news-gallery .n-reveal{opacity:1;transform:none}\n'
    + '.news-gallery .n-hero-rules{margin:12px 0}\n'
    + '.news-gallery .n-hero .n-hero-inner{padding:18px 12px}\n'
    + '.news-gallery .n-hero-title{font-size:clamp(20px,2.6vw,30px)}\n'
    + '.news-gallery .n-progress{display:none}\n'
    + '.news-gallery .n-lightbox{display:none}\n'
    + '.news-gallery .n-ticker-track{animation:none}\n'
    + '.news-gallery .n-chart-canvas{height:220px}\n'
    + '.news-gallery .n-gal-grid{grid-template-columns:repeat(2,1fr)}\n';
}

function renderGallery() {
  var set = colorSetById(DB.design && DB.design.colorSet ? DB.design.colorSet : 'newsprint');
  // color set buttons
  var setsEl = el('ng-colorsets');
  if (setsEl) {
    setsEl.innerHTML = COLOR_SETS.map(function (cs) {
      return '<button class="ng-cset' + (cs.id === set.id ? ' active' : '') + '" type="button" data-cset="' + cs.id + '" role="radio" aria-checked="' + (cs.id === set.id ? 'true' : 'false') + '">'
        + '<span class="ng-cset-dots"><span class="ng-cset-dot" style="background:' + cs.primary + '"></span><span class="ng-cset-dot" style="background:' + cs.accent + '"></span></span>'
        + esc(cs.label) + '</button>';
    }).join('');
    Array.prototype.forEach.call(setsEl.querySelectorAll('[data-cset]'), function (b) {
      b.addEventListener('click', function () { applyColorSet(b.getAttribute('data-cset')); });
    });
  }
  // archetype chip
  var arch = ARCHETYPES[detectArchetype()] || ARCHETYPES.feature;
  var archChip = el('ng-archetype-chip');
  if (archChip) archChip.textContent = '🧭 archetype: ' + arch.label;
  // starter templates
  var twrap = el('ng-templates-wrap');
  if (twrap) {
    twrap.innerHTML = '<span class="ng-templates-title">🚀 Starter templates — click to send the recipe to the AI</span><div class="ng-templates" id="ng-templates">'
      + TEMPLATES.map(function (t) {
        return '<button class="ng-tpl-btn" type="button" data-tpl="' + t.id + '">' + t.emoji + ' ' + esc(t.label) + '<small>' + esc(t.hint) + '</small></button>';
      }).join('') + '</div>';
    Array.prototype.forEach.call(twrap.querySelectorAll('[data-tpl]'), function (b) {
      b.addEventListener('click', function () {
        var t = null;
        for (var i = 0; i < TEMPLATES.length; i++) if (TEMPLATES[i].id === b.getAttribute('data-tpl')) { t = TEMPLATES[i]; break; }
        if (!t) return;
        var inp = el('ng-chat-input');
        if (inp) inp.value = t.text;
        sendChatMessage(t.text);
      });
    });
  }
  // gallery cards
  var grid = el('ng-gallery-grid');
  if (grid) {
    var ctx = makeCtx('gallery');
    _uidCtr = 0;
    var cards = '';
    for (var id in NG_COMPONENTS) {
      if (!Object.prototype.hasOwnProperty.call(NG_COMPONENTS, id)) continue;
      var sample = gallerySampleFor(id);
      var rendered = '';
      try { rendered = NG_COMPONENTS[id].render(sample, ctx); } catch (e) { rendered = ''; }
      if (!rendered) rendered = '<div class="n-sec"><div class="n-inner"><p style="color:#888;font:12px sans-serif">(needs data — insert with your own content)</p></div></div>';
      cards += '<div class="ng-gcard">'
        + '<div class="ng-gcard-head"><b>' + esc(galleryLabel(id)) + '</b><small>' + esc(id) + '</small></div>'
        + '<div class="ng-gcard-prev">' + rendered + '</div>'
        + '<div class="ng-gcard-actions">'
        + '<button class="ng-btn ng-btn-sm" type="button" data-gcomp="' + esc(id) + '">＋ Insert into plan</button>'
        + '</div></div>';
    }
    grid.innerHTML = cards;
    Array.prototype.forEach.call(grid.querySelectorAll('[data-gcomp]'), function (b) {
      b.addEventListener('click', function () { insertComponentIntoPlan(b.getAttribute('data-gcomp')); });
    });
  }
  // gallery style (scoped to .news-gallery)
  var styleEl = el('ng-gallery-style');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'ng-gallery-style';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = galleryCss(set);
  tool.resize();
}

function applyColorSet(id) {
  if (!colorSetById(id)) return;
  if (_readOnly || !_canWrite()) { setStatus('Read-only — color set cannot be changed by viewers.', 'warn'); return; }
  DB.design.colorSet = id;
  persist();
  renderGallery();
  // recompile the EXISTING page with the new colors (no AI call needed)
  if (DB.page && DB.page.plan) {
    var v = validatePlan(DB.page.plan);
    if (v.ok) {
      try {
        var compiled = compilePlan(v.plan, DB.brief);
        DB.page.html = compiled.html;
        DB.page.css = compiled.css;
        DB.page.js = compiled.js;
        DB.page.slug = compiled.slug;
        DB.page.used = compiled.used;
        DB.page.colors = compiled.colors;
        DB.version++;
        persist();
        updatePreview();
        updateCodeView();
        setStatus('Color set applied — page re-styled instantly ✓', 'good');
        tool.notify('Color set "' + colorSetById(id).label + '" applied to the page ✓', 'success');
        return;
      } catch (e) {
        setStatus('Color set applied to the gallery; page re-style failed: ' + e.message, 'warn');
      }
    }
  }
  setStatus('Color set "' + colorSetById(id).label + '" selected — applies to the gallery and the next composition.', 'good');
  tool.notify('Color set applied ✓', 'success');
}

function insertComponentIntoPlan(id) {
  if (_readOnly || !_canWrite()) { setStatus('Read-only — components cannot be inserted by viewers.', 'warn'); return; }
  var sample = gallerySampleFor(id);
  var plan = (DB.page && DB.page.plan) ? JSON.parse(JSON.stringify(DB.page.plan)) : { components: [], seo: {}, pageMeta: {}, flags: { readingProgress: true } };
  if (!Array.isArray(plan.components)) plan.components = [];
  if (id === 'hero') {
    plan.components = plan.components.filter(function (cp) { return str(cp.component, '') !== 'hero'; });
    plan.components.unshift({ component: 'hero', content: sample });
  } else {
    plan.components.push({ component: id, content: sample });
    var hasHero = plan.components.some(function (cp) { return str(cp.component, '') === 'hero'; });
    if (!hasHero) plan.components.unshift({ component: 'hero', content: gallerySampleFor('hero') });
  }
  var v = validatePlan(plan);
  if (!v.ok) { tool.notify('Insert failed: ' + v.error, 'error'); return; }
  try {
    var compiled = compilePlan(v.plan, DB.brief);
    DB.page = {
      html: compiled.html, css: compiled.css, js: compiled.js,
      slug: compiled.slug, used: compiled.used, colors: compiled.colors,
      plan: v.plan,
      seo: (DB.page && DB.page.seo) || {},
      pageMeta: (DB.page && DB.page.pageMeta) || {},
      flags: isObj(v.plan.flags) ? v.plan.flags : {},
      configNeeded: joinConfigNeeded((DB.page && DB.page.configNeeded) || '', compiled.configNotes)
    };
    DB.version++;
    DB.generatedAt = new Date().toISOString();
    _snapshotHistory('Insert ' + galleryLabel(id));
    persist();
    updatePreview();
    updateAllViews();
    setStatus('＋ ' + galleryLabel(id) + ' inserted — page updated.', 'good');
    tool.notify('＋ ' + galleryLabel(id) + ' inserted into the page ✓', 'success');
  } catch (e) {
    setStatus('Insert failed: ' + e.message, 'err');
    tool.notify('Insert failed: ' + e.message, 'error');
  }
}

/* ── Archetype bar (Story tab) ── */
function renderArchetypeBar() {
  var bar = el('ng-archetype-bar');
  if (!bar) return;
  var a = ARCHETYPES[detectArchetype()] || ARCHETYPES.feature;
  var tpl = null;
  for (var i = 0; i < TEMPLATES.length; i++) if (TEMPLATES[i].id === detectArchetype()) { tpl = TEMPLATES[i]; break; }
  bar.innerHTML = '<span class="ng-archetype-label">Detected archetype: <b>' + esc(a.label) + '</b> · recommended hero: <b>' + esc(a.hero) + '</b> · ' + esc(a.recipe) + '</span>'
    + (tpl ? '<button class="ng-btn ng-btn-sm" type="button" id="ng-btn-archetype-tpl">' + tpl.emoji + ' Compose as ' + esc(tpl.label) + '</button>' : '');
  var btn = el('ng-btn-archetype-tpl');
  if (btn && tpl) {
    btn.addEventListener('click', function () { sendChatMessage(tpl.text); });
  }
}

/* ═══════════════════════════════════════════════════════════════════
   SEO SCORECARD (Phase 1 · A4) + PRE-FLIGHT CHECKLIST (E2)
   ═══════════════════════════════════════════════════════════════════ */
function seoChecks() {
  var out = [];
  function add(ok, label) { out.push({ ok: ok, label: label }); }
  var p = DB && DB.page;
  var seo = (p && isObj(p.seo)) ? p.seo : {};
  var brief = (DB && DB.brief) || {};
  if (!p || !p.html) { add(false, 'No page generated yet.'); return out; }
  var title = str(seo.metaTitle, brief.title);
  add(title.length >= 20 && title.length <= 70, 'metaTitle ' + title.length + '/20–70 chars');
  var desc = str(seo.metaDesc, '');
  add(desc.length >= 70 && desc.length <= 170, 'metaDesc ' + desc.length + '/70–170 chars');
  add(!!str(seo.metaKeywords, ''), 'metaKeywords present');
  add(!!imgSrc(seo.ogImage), 'ogImage is a valid URL');
  add(!!str(seo.aiDescription, ''), 'aiDescription present');
  add(!!str(seo.aiKeyTopics, ''), 'aiKeyTopics present');
  var schemaOk = true, schemaN = 0;
  if (Array.isArray(seo.schemaItems)) {
    seo.schemaItems.forEach(function (s) {
      schemaN++;
      if (s && s.json) { try { JSON.parse(s.json); } catch (e) { schemaOk = false; } }
    });
  }
  add(schemaN > 0 && schemaOk, schemaN + ' JSON-LD schema item(s) valid');
  var slug = str((p.pageMeta && p.pageMeta.slug) || p.slug, '');
  add(slug.length > 0 && slug.length <= 60, 'slug ' + (slug.length || 'missing') + '/1–60 chars');
  return out;
}
function renderSeoScorecard() {
  var list = el('ng-seo-list');
  var score = el('ng-seo-score');
  if (!list) return;
  var checks = seoChecks();
  var pass = checks.filter(function (c) { return c.ok; }).length;
  list.innerHTML = checks.map(function (c) {
    return '<li><span class="' + (c.ok ? 'ng-ok' : 'ng-fail') + '">' + (c.ok ? '✔' : '✘') + '</span>' + esc(c.label) + '</li>';
  }).join('');
  if (score) {
    var pct = checks.length ? Math.round(pass / checks.length * 100) : 0;
    score.textContent = pass + '/' + checks.length + ' · ' + pct + '%';
    score.style.color = pct >= 80 ? 'var(--ng-good)' : 'var(--ng-warn)';
  }
}
function renderChecklist() {
  var wrap = el('ng-checklist-list');
  if (!wrap) return;
  DB.publishChecklist = isObj(DB.publishChecklist) ? DB.publishChecklist : {};
  wrap.innerHTML = CHECKLIST_ITEMS.map(function (it) {
    var done = !!DB.publishChecklist[it.id];
    return '<label class="ng-checklist-item' + (done ? ' done' : '') + '"><input type="checkbox" data-chk="' + it.id + '"' + (done ? ' checked' : '') + '><span class="ng-checklist-label">' + esc(it.label) + '</span></label>';
  }).join('');
  Array.prototype.forEach.call(wrap.querySelectorAll('[data-chk]'), function (cb) {
    cb.addEventListener('change', function () {
      if (_readOnly || !_canWrite()) { cb.checked = !cb.checked; setStatus('Read-only — checklist is locked for viewers.', 'warn'); return; }
      DB.publishChecklist[cb.getAttribute('data-chk')] = cb.checked;
      persist();
      renderChecklist();
    });
  });
  var score = el('ng-checklist-score');
  if (score) {
    var done = CHECKLIST_ITEMS.filter(function (it) { return DB.publishChecklist[it.id]; }).length;
    score.textContent = done + '/' + CHECKLIST_ITEMS.length;
    score.style.color = done === CHECKLIST_ITEMS.length ? 'var(--ng-good)' : 'var(--ng-dim)';
  }
}

/* ═══════════════════════════════════════════════════════════════════
   PHASE 2 — labs, sources, fact-check, history, review, credits, perf
   ═══════════════════════════════════════════════════════════════════ */
var HISTORY_TYPE = 'newsgenerator-history-uniconbaseapps';

/* recompile the current plan (shared by color sets, restores, credits, labs) */
function recompilePage(noVersionBump) {
  if (!DB.page || !DB.page.plan) return false;
  var v = validatePlan(DB.page.plan);
  if (!v.ok) { tool.notify('Plan invalid: ' + v.error, 'error'); return false; }
  try {
    var compiled = compilePlan(v.plan, DB.brief);
    DB.page.html = compiled.html;
    DB.page.css = compiled.css;
    DB.page.js = compiled.js;
    DB.page.slug = compiled.slug;
    DB.page.used = compiled.used;
    DB.page.colors = compiled.colors;
    DB.page.plan = v.plan;
    DB.page.configNeeded = joinConfigNeeded(str(v.plan.configNeeded, ''), compiled.configNotes);
    if (!noVersionBump) DB.version++;
    persist();
    updatePreview();
    updateCodeView();
    return true;
  } catch (e) {
    tool.notify('Recompile failed: ' + e.message, 'error');
    return false;
  }
}

function clonePlan() {
  return (DB.page && DB.page.plan) ? JSON.parse(JSON.stringify(DB.page.plan)) : { components: [], seo: {}, pageMeta: {}, flags: { readingProgress: true } };
}

/* ── A2 Headline lab ── */
function runHeadlineLab() {
  if (_readOnly || !_canWrite()) { setStatus('Read-only — labs are locked for viewers.', 'warn'); return; }
  if (_chatBusy) { setStatus('The AI is busy — wait a moment.', 'warn'); return; }
  var results = el('ng-headline-results');
  if (results) results.innerHTML = '<div class="ng-lab-result"><small>Asking the desk for five headlines…</small></div>';
  setStatus('Headline lab: writing 5 variants…', 'busy');
  var prompt = [
    'HEADLINE LAB — write FIVE headline variants for this story.',
    'Styles: "straight" (hard news), "feature" (magazine), "seo" (search-friendly), "social" (shareable), "short" (≤6 words).',
    'Return strict JSON ONLY: {"variants":[{"style":"straight","headline":"…"}, …]}',
    'Facts: title, brief summary, category and recent chat above. Never invent facts.'
  ].join('\n');
  try {
    tool.requestAI(prompt, buildAiContext(), function (err, resp) {
      if (err && !resp) { if (results) results.innerHTML = '<div class="ng-lab-result"><small>✖ ' + esc(err || 'AI error') + '</small></div>'; setStatus('Headline lab failed.', 'err'); return; }
      var parsed = parseAiJson(String(resp || ''));
      if (!parsed.ok || !Array.isArray(parsed.data.variants)) {
        if (results) results.innerHTML = '<div class="ng-lab-result"><small>✖ AI returned no usable variants — try again.</small></div>';
        setStatus('Headline lab: no usable result.', 'err');
        return;
      }
      var variants = parsed.data.variants.slice(0, 5);
      if (results) {
        results.innerHTML = variants.map(function (vv, i) {
          return '<button class="ng-lab-result" type="button" data-hl="' + i + '"><small>' + esc(str(vv.style, 'variant')) + '</small>' + esc(str(vv.headline, '')) + '</button>';
        }).join('');
        Array.prototype.forEach.call(results.querySelectorAll('[data-hl]'), function (b) {
          b.addEventListener('click', function () { applyHeadline(variants[parseInt(b.getAttribute('data-hl'), 10)]); });
        });
      }
      setStatus('Headline lab: pick one to apply ✓', 'good');
    });
  } catch (e) {
    if (results) results.innerHTML = '<div class="ng-lab-result"><small>✖ AI channel unavailable.</small></div>';
    setStatus('Headline lab unavailable.', 'err');
  }
}
function applyHeadline(variant) {
  var headline = str(variant && variant.headline, '').trim();
  if (!headline) return;
  if (!DB.page || !DB.page.plan) {
    DB.brief.title = headline;
    persist(); renderStoryTitle(); updateStoryForm();
    setStatus('Headline applied to the brief (no page yet).', 'good');
    return;
  }
  var plan = clonePlan();
  plan.components.forEach(function (cp) {
    if (str(cp.component, '').toLowerCase() === 'hero' && isObj(cp.content)) cp.content.title = headline;
  });
  if (!plan.seo) plan.seo = {};
  plan.seo.metaTitle = headline;
  if (!plan.pageMeta) plan.pageMeta = {};
  plan.pageMeta.name = headline;
  DB.page.plan = plan;
  if (recompilePage()) {
    setStatus('Headline applied: “' + headline + '” ✓', 'good');
    tool.notify('Headline applied ✓', 'success');
  }
}

/* ── A3 Standfirst & social deck lab ── */
function runDeckLab() {
  if (_readOnly || !_canWrite()) { setStatus('Read-only — labs are locked for viewers.', 'warn'); return; }
  if (_chatBusy) { setStatus('The AI is busy — wait a moment.', 'warn'); return; }
  var results = el('ng-deck-results');
  if (results) results.innerHTML = '<div class="ng-lab-result"><small>Writing the standfirst + share decks…</small></div>';
  setStatus('Deck lab: writing standfirst + decks…', 'busy');
  var prompt = [
    'STANDFIRST & DECK LAB — write the story deck.',
    'Return strict JSON ONLY: {"standfirst":"1-2 sentences","decks":{"x":"…≤240 chars","facebook":"…","whatsapp":"…"}}',
    'Facts come only from the brief and chat above.'
  ].join('\n');
  try {
    tool.requestAI(prompt, buildAiContext(), function (err, resp) {
      if (err && !resp) { if (results) results.innerHTML = '<div class="ng-lab-result"><small>✖ ' + esc(err || 'AI error') + '</small></div>'; setStatus('Deck lab failed.', 'err'); return; }
      var parsed = parseAiJson(String(resp || ''));
      if (!parsed.ok || !isObj(parsed.data)) {
        if (results) results.innerHTML = '<div class="ng-lab-result"><small>✖ AI returned no usable deck — try again.</small></div>';
        setStatus('Deck lab: no usable result.', 'err');
        return;
      }
      DB.decks = isObj(parsed.data.decks) ? parsed.data.decks : {};
      if (results) {
        results.innerHTML = '<div class="ng-lab-result"><small>standfirst</small>' + esc(str(parsed.data.standfirst, '')) + '</div>'
          + '<button class="ng-lab-result" type="button" id="ng-btn-apply-deck"><small>Apply standfirst to the page</small>Click to write it into the page</button>';
        var ab = el('ng-btn-apply-deck');
        if (ab) ab.addEventListener('click', function () { applyStandfirst(str(parsed.data.standfirst, '')); });
      }
      persist();
      setStatus('Deck lab done ✓', 'good');
    });
  } catch (e) {
    if (results) results.innerHTML = '<div class="ng-lab-result"><small>✖ AI channel unavailable.</small></div>';
    setStatus('Deck lab unavailable.', 'err');
  }
}
function applyStandfirst(text) {
  var t = str(text, '').trim();
  if (!t) return;
  if (!DB.page || !DB.page.plan) {
    tool.notify('No page yet — the deck will be used at composition.', 'info');
    return;
  }
  var plan = clonePlan();
  var found = false;
  plan.components.forEach(function (cp) {
    if (str(cp.component, '').toLowerCase() === 'standfirst' && isObj(cp.content)) { cp.content.text = t; found = true; }
  });
  if (!found) {
    var heroIdx = plan.components.findIndex(function (cp) { return str(cp.component, '').toLowerCase() === 'hero'; });
    plan.components.splice(heroIdx + 1, 0, { component: 'standfirst', content: { text: t } });
  }
  DB.page.plan = plan;
  if (recompilePage()) {
    setStatus('Standfirst applied ✓', 'good');
    tool.notify('Standfirst applied ✓', 'success');
  }
}

/* ── D8 Draft from URL ── */
function draftFromUrl() {
  if (_readOnly || !_canWrite()) { setStatus('Read-only — drafting is locked for viewers.', 'warn'); return; }
  var inp = el('ng-draft-url');
  var url = inp ? inp.value.trim() : '';
  if (!/^https?:\/\//i.test(url)) { tool.notify('Paste a valid https URL first.', 'warning'); return; }
  setStatus('Extracting ' + url.slice(0, 40) + '…', 'busy');
  try {
    tool.requestFileContent(url, function (err, content) {
      if (err || !content) { setStatus('Extraction failed: ' + (err || 'empty'), 'err'); tool.notify('Extraction failed: ' + err, 'error'); return; }
      setStatus('Drafting the brief from the source…', 'busy');
      var prompt = [
        'DRAFT A STORY BRIEF from the source content below.',
        'Return strict JSON ONLY: {"title":"…","summary":"1-3 sentences","category":"KICKER","tags":["…"],"location":"…","date":"…"}',
        'Never invent facts beyond the source. Language: match the source.',
        '',
        'SOURCE CONTENT:',
        String(content).slice(0, 12000)
      ].join('\n');
      try {
        tool.requestAI(prompt, buildAiContext(), function (err2, resp) {
          if (err2 && !resp) { setStatus('Drafting failed: ' + err2, 'err'); return; }
          var parsed = parseAiJson(String(resp || ''));
          if (!parsed.ok) { setStatus('Draft parse failed — paste the text manually.', 'err'); return; }
          var d = parsed.data;
          if (str(d.title, '')) DB.brief.title = str(d.title);
          if (str(d.summary, '')) DB.brief.summary = str(d.summary);
          if (str(d.category, '')) DB.brief.category = str(d.category);
          if (str(d.location, '')) DB.brief.location = str(d.location);
          if (str(d.date, '')) DB.brief.date = str(d.date);
          if (Array.isArray(d.tags)) DB.brief.tags = d.tags.slice(0, 12);
          if (!DB.brief.slug) DB.brief.slug = slugify(DB.brief.title);
          DB.brief.sources.push({ name: 'Drafted from URL', url: url });
          persist();
          renderStoryTitle();
          updateStoryForm();
          setStatus('Brief drafted — composing the page…', 'busy');
          sendChatMessage('JSON REQUIRED. Compose the page from the newly drafted brief.');
        });
      } catch (e2) { setStatus('Drafting unavailable.', 'err'); }
    });
  } catch (e) { setStatus('Extraction unavailable — check allowFileContent.', 'err'); }
}

/* ── D2 Source manager ── */
function extractSources() {
  if (_readOnly || !_canWrite()) { setStatus('Read-only — sources are locked for viewers.', 'warn'); return; }
  var ta = el('ng-src-urls');
  var urls = ta ? ta.value.split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return /^https?:\/\//i.test(l); }) : [];
  if (!urls.length) { tool.notify('Paste at least one https URL.', 'warning'); return; }
  setStatus('Extracting ' + urls.length + ' source(s)…', 'busy');
  var done = 0;
  urls.forEach(function (url) {
    try {
      tool.requestFileContent(url, function (err, content) {
        done++;
        var host = 'source';
        try { host = new URL(url).hostname; } catch (e) {}
        var srcs = DB.brief.sources;
        var existing = null;
        for (var i = 0; i < srcs.length; i++) if (srcs[i].url === url) existing = srcs[i];
        if (!existing) { existing = { name: host, url: url, note: '' }; srcs.push(existing); }
        if (err) { existing.note = '⚠ extraction failed: ' + err; }
        else if (content) { existing.note = String(content).replace(/\s+/g, ' ').slice(0, 400); }
        persist();
        renderSourceResults();
        updateStoryForm();
        if (done >= urls.length) setStatus('Sources extracted ✓ — the AI will cite them.', 'good');
      });
    } catch (e) { done++; }
  });
}
function renderSourceResults() {
  var wrap = el('ng-src-results');
  if (!wrap) return;
  var srcs = (DB.brief && Array.isArray(DB.brief.sources)) ? DB.brief.sources : [];
  if (!srcs.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = srcs.map(function (s, i) {
    return '<div class="ng-lab-result" style="cursor:default"><small>' + esc(str(s.name, s.url)) + ' · ' + esc(s.url || '') + '</small>'
      + (s.note ? '<small>' + esc(String(s.note).slice(0, 160)) + (String(s.note).length > 160 ? '…' : '') + '</small>' : '')
      + '<button class="ng-btn ng-btn-ghost ng-btn-sm" type="button" data-src-del="' + i + '" style="margin-top:4px">Remove</button></div>';
  }).join('');
  Array.prototype.forEach.call(wrap.querySelectorAll('[data-src-del]'), function (b) {
    b.addEventListener('click', function () {
      DB.brief.sources.splice(parseInt(b.getAttribute('data-src-del'), 10), 1);
      persist();
      renderSourceResults();
      updateStoryForm();
    });
  });
}

/* ── D3 Fact-check assistant ── */
function runFactcheck() {
  if (_readOnly || !_canWrite()) { setStatus('Read-only — fact-check is locked for viewers.', 'warn'); return; }
  if (!DB.page || !DB.page.plan) { tool.notify('Generate a page first.', 'warning'); return; }
  var list = el('ng-factcheck-list');
  if (list) list.innerHTML = '<li><span class="ng-ok">…</span>Checking every claim against the sources…</li>';
  setStatus('Fact-checking the draft…', 'busy');
  var text = planText(DB.page.plan).slice(0, 12000);
  var prompt = [
    'FACT-CHECK the story draft against the sources in the brief.',
    'Return strict JSON ONLY: {"checks":[{"claim":"…","verdict":"true|mostly-true|half-true|mostly-false|false|unverified","note":"one sentence why"}]}',
    'Only flag claims you can test against the provided sources. Max 6 checks.',
    '',
    'DRAFT TEXT:',
    text
  ].join('\n');
  try {
    tool.requestAI(prompt, buildAiContext(), function (err, resp) {
      if (err && !resp) { if (list) list.innerHTML = '<li><span class="ng-fail">✘</span>' + esc(err || 'Fact-check failed') + '</li>'; setStatus('Fact-check failed.', 'err'); return; }
      var parsed = parseAiJson(String(resp || ''));
      if (!parsed.ok || !Array.isArray(parsed.data.checks)) {
        if (list) list.innerHTML = '<li><span class="ng-ok">✔</span>No testable claims found against the given sources.</li>';
        setStatus('Fact-check done — nothing to flag.', 'good');
        return;
      }
      var checks = parsed.data.checks.slice(0, 6);
      if (list) {
        list.innerHTML = checks.map(function (cc, i) {
          var v = str(cc.verdict, 'unverified');
          if (['true', 'mostly-true', 'half-true', 'mostly-false', 'false', 'unverified'].indexOf(v) === -1) v = 'unverified';
          return '<li><span class="ng-warnc">🔎</span>' + esc(str(cc.claim, '')) + ' — <b>' + esc(v.toUpperCase()) + '</b><br>'
            + '<small style="color:var(--ng-dim)">' + esc(str(cc.note, '')) + '</small> '
            + '<button class="ng-btn ng-btn-ghost ng-btn-sm" type="button" data-fc-add="' + i + '">＋ Add factcheck box to page</button></li>';
        }).join('');
        Array.prototype.forEach.call(list.querySelectorAll('[data-fc-add]'), function (b) {
          b.addEventListener('click', function () { addFactcheckToPage(checks[parseInt(b.getAttribute('data-fc-add'), 10)]); });
        });
      }
      setStatus('Fact-check complete ✓', 'good');
    });
  } catch (e) {
    if (list) list.innerHTML = '<li><span class="ng-fail">✘</span>Fact-check unavailable.</li>';
    setStatus('Fact-check unavailable.', 'err');
  }
}
function addFactcheckToPage(cc) {
  if (!cc) return;
  var verdict = str(cc.verdict, 'unverified');
  if (['true', 'mostly-true', 'half-true', 'mostly-false', 'false', 'unverified'].indexOf(verdict) === -1) verdict = 'unverified';
  var plan = clonePlan();
  plan.components.push({ component: 'factcheck', content: { claim: str(cc.claim, ''), verdict: verdict, by: 'Fact-check assistant', explanation: str(cc.note, '') } });
  DB.page.plan = plan;
  if (recompilePage()) {
    setStatus('Factcheck box added ✓', 'good');
    tool.notify('Factcheck box added to the page ✓', 'success');
  }
}
function planText(plan) {
  var out = [];
  (Array.isArray(plan.components) ? plan.components : []).forEach(function (cp) {
    try { out.push(JSON.stringify(cp.content || {})); } catch (e) {}
  });
  return out.join('\n');
}

/* ── D5/D6 Version history + visual diff ── */
function _snapshotHistory(label) {
  if (!DB.page || !DB.page.plan) return;
  var entry = { version: DB.version, time: new Date().toISOString(), label: label, plan: JSON.parse(JSON.stringify(DB.page.plan)) };
  DB.historyLocal = Array.isArray(DB.historyLocal) ? DB.historyLocal : [];
  DB.historyLocal.unshift(entry);
  DB.historyLocal = DB.historyLocal.slice(0, 10);
  persist();
  if (typeof tool.requestObjects === 'function') {
    try {
      tool.requestObjects('create', {
        mainObjectType: HISTORY_TYPE,
        name: (label + ' — v' + DB.version).slice(0, 60),
        productData: { data_categoriesBased: { _toolInstanceId: _resolveInstanceId(), version: DB.version, time: entry.time, label: label, plan: entry.plan } }
      }, function () {});
    } catch (e) {}
  }
}
function _historyRowsFromObject(o) {
  try {
    var d = o && o.productData && o.productData.data_categoriesBased;
    if (d && d.plan && typeof d.version === 'number') return { version: d.version, time: d.time, label: d.label || 'snapshot', plan: d.plan };
  } catch (e) {}
  return null;
}
function openHistory() {
  var body = el('ng-modal-body');
  if (!body) return;
  openModal('🕘 Version history', '<div class="ng-history" id="ng-hist-rows">Loading…</div>');
  function show(rows) {
    var seen = {}, dedup = [];
    rows.forEach(function (r) { if (r && !seen[r.version]) { seen[r.version] = true; dedup.push(r); } });
    var box = el('ng-hist-rows');
    if (!box) return;
    if (!dedup.length) { box.innerHTML = '<div class="ng-hist-row">No history yet — history snapshots are saved after every AI compose.</div>'; return; }
    box.innerHTML = dedup.map(function (r, i) {
      var isCur = r.version === DB.version;
      return '<div class="ng-hist-row"><b>v' + r.version + '</b> ' + esc(str(r.label, '')) + ' <small>' + esc(fmtTime(r.time)) + (isCur ? ' · current' : '') + '</small>'
        + '<button class="ng-btn ng-btn-sm" type="button" data-hist-restore="' + i + '">↩ Restore</button>'
        + '<button class="ng-btn ng-btn-ghost ng-btn-sm" type="button" data-hist-diff="' + i + '">⇄ Compare</button></div>';
    }).join('');
    Array.prototype.forEach.call(box.querySelectorAll('[data-hist-restore]'), function (b) {
      b.addEventListener('click', function () { restoreHistory(dedup[parseInt(b.getAttribute('data-hist-restore'), 10)]); });
    });
    Array.prototype.forEach.call(box.querySelectorAll('[data-hist-diff]'), function (b) {
      b.addEventListener('click', function () { diffHistory(dedup[parseInt(b.getAttribute('data-hist-diff'), 10)]); });
    });
  }
  if (typeof tool.requestObjects === 'function') {
    try {
      tool.requestObjects('query', { mainObjectType: HISTORY_TYPE }, function (err, result) {
        var rows = [];
        if (!err && result && Array.isArray(result.objects)) {
          result.objects.forEach(function (o) { var r = _historyRowsFromObject(o); if (r) rows.push(r); });
        }
        rows = rows.concat((DB.historyLocal || []).map(function (e) { return { version: e.version, time: e.time, label: e.label, plan: e.plan }; }));
        rows.sort(function (a, b) { return (b.version || 0) - (a.version || 0); });
        show(rows);
      });
      return;
    } catch (e) {}
  }
  show((DB.historyLocal || []).map(function (e) { return { version: e.version, time: e.time, label: e.label, plan: e.plan }; }));
}
function restoreHistory(entry) {
  if (!entry || !entry.plan) return;
  if (_readOnly || !_canWrite()) { setStatus('Read-only — history is locked for viewers.', 'warn'); return; }
  DB.page.plan = JSON.parse(JSON.stringify(entry.plan));
  if (recompilePage()) {
    closeModal();
    setStatus('Restored v' + entry.version + ' ✓', 'good');
    tool.notify('Restored version v' + entry.version + ' ✓', 'success');
  }
}
function diffHistory(entry) {
  if (!entry || !entry.plan) return;
  var body = el('ng-modal-body');
  if (!body) return;
  var docA = '', docB = '';
  try {
    var ca = compilePlan(JSON.parse(JSON.stringify(entry.plan)), DB.brief);
    var cb = (DB.page && DB.page.plan) ? compilePlan(JSON.parse(JSON.stringify(DB.page.plan)), DB.brief) : { html: '<p style="padding:20px">(no current page)</p>', css: '', js: '' };
    docA = buildStandaloneFromCompiled(ca, 'v' + entry.version);
    docB = buildStandaloneFromCompiled(cb, 'current v' + DB.version);
  } catch (e) {
    openModal('⇄ Compare', '<p style="color:var(--ng-dim)">Could not compile the versions for comparison: ' + esc(e.message) + '</p>');
    return;
  }
  openModal('⇄ Compare — v' + entry.version + ' vs current v' + DB.version,
    '<div class="ng-diff-wrap">'
    + '<div><b style="font-size:12px">v' + entry.version + ' — ' + esc(str(entry.label, '')) + '</b><div class="ng-diff-frame"><iframe sandbox="allow-scripts" srcdoc="' + esc(docA) + '"></iframe></div></div>'
    + '<div><b style="font-size:12px">current v' + DB.version + '</b><div class="ng-diff-frame"><iframe sandbox="allow-scripts" srcdoc="' + esc(docB) + '"></iframe></div></div>'
    + '</div>');
}
function buildStandaloneFromCompiled(compiled, label) {
  var lang = (DB.brief && DB.brief.language) || 'en';
  return '<!DOCTYPE html><html lang="' + esc(lang) + '"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">'
    + '<title>' + esc(label) + '</title><style>body{margin:0;padding:0;background:#fff}' + (compiled.css || '') + '</style></head><body>'
    + (compiled.html || '') + _gwPreviewMockScript(lang) + '<script>' + (compiled.js || '') + '<' + '/script></body></html>';
}

/* ═══════════════════════════════════════════════════════════════════
   PHASE 3 — variants, agentic builds, publish ops, lints, prompt lab
   ═══════════════════════════════════════════════════════════════════ */
function _applyAiPlan(plan, label, opts) {
  var o = opts || {};
  var v = validatePlan(plan);
  if (!v.ok) return v.error;
  var prevMeta = (DB.page && isObj(DB.page.pageMeta)) ? DB.page.pageMeta : {};
  var newMeta = isObj(v.plan.pageMeta) ? v.plan.pageMeta : {};
  if (!str(newMeta.contentId, '') && str(prevMeta.contentId, '')) newMeta.contentId = prevMeta.contentId;
  try {
    var compiled = compilePlan(v.plan, DB.brief);
    DB.page = {
      html: compiled.html, css: compiled.css, js: compiled.js,
      slug: compiled.slug, used: compiled.used, colors: compiled.colors,
      plan: v.plan,
      seo: isObj(v.plan.seo) ? v.plan.seo : ((DB.page && DB.page.seo) || {}),
      pageMeta: newMeta,
      flags: isObj(v.plan.flags) ? v.plan.flags : {},
      configNeeded: joinConfigNeeded(str(v.plan.configNeeded, ''), compiled.configNotes)
    };
    if (!o.noBump) DB.version++;
    DB.generatedAt = new Date().toISOString();
    _snapshotHistory(label);
    persist();
    updatePreview();
    updateAllViews();
    return '';
  } catch (e) {
    return e.message;
  }
}

/* ── A5 multi-language variants ── */
function runTranslate() {
  if (_readOnly || !_canWrite()) { setStatus('Read-only — variants are locked for viewers.', 'warn'); return; }
  if (_chatBusy) { setStatus('The AI is busy — wait a moment.', 'warn'); return; }
  if (!DB.page || !DB.page.plan) { tool.notify('Generate a page first.', 'warning'); return; }
  var sel = el('ng-ml-lang');
  var lang = sel ? sel.value : 'tr';
  var box = el('ng-translate-result');
  if (box) box.innerHTML = '<small>Translating to <b>' + esc(lang) + '</b>…</small>';
  setStatus('Translating page variant → ' + lang + '…', 'busy');
  _chatBusy = true;
  var prompt = [
    'TRANSLATE VARIANT — create a language variant of the current page plan.',
    'Target language code: "' + lang + '".',
    'Rules:',
    '- Keep pageMeta.contentId IDENTICAL (language siblings share one contentId); set pageMeta.meta.language to "' + lang + '".',
    '- Translate ALL visible text: headline, kicker, standfirst, body, captions, alt texts, labels, buttons, chart labels, quiz questions/options, chapter text.',
    '- Update seo (metaTitle/metaDesc/og) into the target language.',
    '- Do NOT change the component list or their order; keep colors, flags and image URLs.',
    '- Return strict JSON ONLY (the full plan).'
  ].join('\n');
  try {
    tool.requestAI(prompt, buildAiContext(), function (err, resp) {
      _chatBusy = false;
      if (err && !resp) { if (box) box.innerHTML = '<small>✖ ' + esc(err || 'AI error') + '</small>'; setStatus('Translation failed.', 'err'); return; }
      var parsed = parseAiJson(String(resp || ''));
      if (!parsed.ok) { if (box) box.innerHTML = '<small>✖ The AI did not return a valid plan.</small>'; setStatus('Translation failed — invalid JSON.', 'err'); return; }
      var e2 = _applyAiPlan(parsed.data, 'Translate → ' + lang);
      if (e2) { if (box) box.innerHTML = '<small>✖ ' + esc(e2) + '</small>'; setStatus('Translation failed — ' + e2, 'err'); return; }
      if (box) box.innerHTML = '<small>✅ Page now in <b>' + esc(lang) + '</b> — contentId shared with the original for language routing.</small>';
      addChatMessage('ai', '✅ Language variant applied (' + lang + '). The page shares contentId ' + esc(str(DB.page.pageMeta && DB.page.pageMeta.contentId, '')) + ' with the original.', { planInfo: '🌐 Variant: ' + lang + ' · v' + DB.version });
      requestSaveNow('Variant saved');
      setStatus('Language variant (' + lang + ') applied ✓', 'good');
      tool.notify('Language variant (' + lang + ') applied ✓', 'success');
    });
  } catch (e) {
    _chatBusy = false;
    setStatus('Translation unavailable: ' + e.message, 'warn');
  }
}

/* ── D4 agentic multi-step builds ── */
var _agenticSteps = [];
var _agenticCursor = 0;
function runAgenticBuild() {
  if (_readOnly || !_canWrite()) { setStatus('Read-only — agentic build is locked for viewers.', 'warn'); return; }
  if (_chatBusy) { setStatus('The AI is busy — wait a moment.', 'warn'); return; }
  var prog = el('ng-agentic-progress');
  if (prog) prog.textContent = 'Planning the build…';
  openModal('🤖 Agentic build', '<div class="ng-agentic-box"><ol class="ng-agentic-steps" id="ng-agentic-steps"><li>Planning…</li></ol><p class="ng-agentic-progress" id="ng-agentic-progress">Planning…</p></div>');
  _chatBusy = true;
  var plannerPrompt = [
    'AGENTIC BUILD PLANNER — plan a multi-step build for this news page.',
    'Read the brief and the current plan, then decide the 2-4 most valuable build steps to make the page excellent.',
    'Return strict JSON ONLY: {"title":"…","steps":[{"do":"what to build/improve (imperative, one sentence)","component":"component id or empty"}]}.',
    'Each step will be executed by a separate AI call that receives the full plan context.'
  ].join('\n');
  try {
    tool.requestAI(plannerPrompt, buildAiContext(), function (err, resp) {
      if (err && !resp) { _chatBusy = false; closeModal(); setStatus('Agentic build failed.', 'err'); return; }
      var parsed = parseAiJson(String(resp || ''));
      if (!parsed.ok || !Array.isArray(parsed.data.steps) || !parsed.data.steps.length) {
        _chatBusy = false; closeModal();
        setStatus('Agentic planner returned no steps.', 'err');
        return;
      }
      _agenticSteps = parsed.data.steps.slice(0, 4);
      _agenticCursor = 0;
      var stepsEl = el('ng-agentic-steps');
      if (stepsEl) stepsEl.innerHTML = _agenticSteps.map(function (s, i) { return '<li data-agentic-li="' + i + '">' + esc(str(s.do, '')) + '</li>'; }).join('');
      var titleEl = el('ng-agentic-progress');
      if (titleEl) titleEl.textContent = 'Plan: ' + str(parsed.data.title, '') + ' — running step 1/' + _agenticSteps.length + '…';
      _runAgenticStep();
    });
  } catch (e) {
    _chatBusy = false; closeModal();
    setStatus('Agentic build unavailable: ' + e.message, 'warn');
  }
}
function _runAgenticStep() {
  var i = _agenticCursor;
  if (i >= _agenticSteps.length) {
    _chatBusy = false;
    closeModal();
    addChatMessage('ai', '✅ Agentic build complete — the page went through ' + _agenticSteps.length + ' automated steps.', { planInfo: '🤖 Agentic build · v' + DB.version });
    requestSaveNow('Agentic build saved');
    setStatus('Agentic build complete — v' + DB.version + ' ✓', 'good');
    tool.notify('Agentic build finished ✓', 'success');
    return;
  }
  var prog = el('ng-agentic-progress');
  if (prog) prog.textContent = 'Step ' + (i + 1) + '/' + _agenticSteps.length + ': ' + _agenticSteps[i].do;
  var li = el('ng-agentic-steps');
  if (li) {
    var items = li.querySelectorAll('[data-agentic-li]');
    Array.prototype.forEach.call(items, function (x, xi) { x.classList.toggle('ng-agentic-on', xi === i); x.classList.toggle('ng-agentic-done', xi < i); });
  }
  var prompt = [
    'AGENTIC BUILD STEP ' + (i + 1) + '/' + _agenticSteps.length + '.',
    'DO THIS NOW: ' + _agenticSteps[i].do,
    '',
    buildProtocol(),
    '',
    buildCurrentPlanBlock(),
    '',
    'Return the COMPLETE updated plan as strict JSON ONLY (all components, in order, including this step\'s change).'
  ].join('\n');
  try {
    tool.requestAI(prompt, buildAiContext(), function (err, resp) {
      if (err && !resp) { _chatBusy = false; closeModal(); setStatus('Agentic step failed: ' + (err || 'AI error'), 'err'); return; }
      var parsed = parseAiJson(String(resp || ''));
      var isLast = (_agenticCursor === _agenticSteps.length - 1);
      if (!parsed.ok) {
        // tolerate one bad step — skip it
        _agenticCursor++;
        _runAgenticStep();
        return;
      }
      var e2 = _applyAiPlan(parsed.data, 'Agentic step ' + (_agenticCursor + 1) + ': ' + _agenticSteps[_agenticCursor].do, { noBump: !isLast });
      if (e2) {
        _agenticCursor++;
        _runAgenticStep();
        return;
      }
      _agenticCursor++;
      _runAgenticStep();
    });
  } catch (e) {
    _chatBusy = false; closeModal();
    setStatus('Agentic step failed: ' + e.message, 'err');
  }
}

/* ── D7 A/B variant composer ── */
function runAbComposer() {
  if (_readOnly || !_canWrite()) { setStatus('Read-only — A/B composer is locked for viewers.', 'warn'); return; }
  if (_chatBusy) { setStatus('The AI is busy — wait a moment.', 'warn'); return; }
  if (!DB.page || !DB.page.plan) { tool.notify('Generate a page first.', 'warning'); return; }
  openModal('⚖ A/B variant composer', '<div class="ng-ab-box"><p class="ng-ab-progress" id="ng-ab-progress">Writing variant A…</p><div class="ng-ab-results" id="ng-ab-results"></div></div>');
  _chatBusy = true;
  function variantPrompt(letter, angle) {
    return [
      'A/B VARIANT ' + letter + ' — compose a full alternative page plan.',
      'Angle: ' + angle,
      '',
      buildProtocol(),
      '',
      buildCurrentPlanBlock(),
      '',
      buildBriefBlock(),
      '',
      'Return the complete alternative plan as strict JSON ONLY.'
    ].join('\n');
  }
  try {
    tool.requestAI(variantPrompt('A', 'more human interest and quotes'), buildAiContext(), function (errA, respA) {
      if (errA && !respA) { _chatBusy = false; closeModal(); setStatus('A/B composer failed (A).', 'err'); return; }
      var pa = parseAiJson(String(respA || ''));
      var prog = el('ng-ab-progress');
      if (prog) prog.textContent = 'Writing variant B…';
      tool.requestAI(variantPrompt('B', 'more data, charts and analysis'), buildAiContext(), function (errB, respB) {
        _chatBusy = false;
        if (errB && !respB) { closeModal(); setStatus('A/B composer failed (B).', 'err'); return; }
        var pb = parseAiJson(String(respB || ''));
        if (!pa.ok || !pb.ok) { closeModal(); setStatus('A/B composer failed — invalid JSON variant.', 'err'); return; }
        DB.abVariants = [{ id: 'A', label: 'Variant A — human interest', plan: pa.data }, { id: 'B', label: 'Variant B — data driven', plan: pb.data }];
        persist();
        var results = el('ng-ab-results');
        var docA = '', docB = '';
        try {
          var ca = compilePlan(JSON.parse(JSON.stringify(pa.data)), DB.brief);
          var cb = compilePlan(JSON.parse(JSON.stringify(pb.data)), DB.brief);
          docA = buildStandaloneFromCompiled(ca, 'Variant A');
          docB = buildStandaloneFromCompiled(cb, 'Variant B');
        } catch (e) {}
        if (results) results.innerHTML = ''
          + '<div class="ng-ab-col"><b>Variant A — human interest</b><div class="ng-diff-frame"><iframe sandbox="allow-scripts" srcdoc="' + esc(docA) + '"></iframe></div>'
          + '<button class="ng-btn ng-btn-sm" type="button" data-ab-use="A">✓ Use A</button></div>'
          + '<div class="ng-ab-col"><b>Variant B — data driven</b><div class="ng-diff-frame"><iframe sandbox="allow-scripts" srcdoc="' + esc(docB) + '"></iframe></div>'
          + '<button class="ng-btn ng-btn-sm" type="button" data-ab-use="B">✓ Use B</button></div>';
        Array.prototype.forEach.call(results.querySelectorAll('[data-ab-use]'), function (b) {
          b.addEventListener('click', function () {
            var pick = DB.abVariants.filter(function (v) { return v.id === b.getAttribute('data-ab-use'); })[0];
            if (!pick) return;
            var e2 = _applyAiPlan(pick.plan, 'A/B → variant ' + pick.id);
            if (e2) { tool.notify('Apply failed: ' + e2, 'error'); return; }
            closeModal();
            addChatMessage('ai', '⚖ Applied ' + pick.label + '.', { planInfo: '⚖ A/B → ' + pick.id + ' · v' + DB.version });
            requestSaveNow('A/B variant saved');
            tool.notify('Applied ' + pick.label + ' ✓', 'success');
          });
        });
      });
    });
  } catch (e) {
    _chatBusy = false; closeModal();
    setStatus('A/B composer unavailable: ' + e.message, 'warn');
  }
}

/* ── E1 one-click CMS page object create ── */
function createPageObject() {
  if (_readOnly || !_canWrite()) { setStatus('Read-only — publishing is locked for viewers.', 'warn'); return; }
  if (!DB.page || !DB.page.html) { tool.notify('No page yet — generate one first.', 'warning'); return; }
  var paramType = str(_param('pageTypeId'), '').trim();
  openModal('📄 Create CMS page object',
    '<div class="ng-pageobj-box">'
    + '<label class="ng-field-label" for="ng-pageobj-type">Page object type (app type id)</label>'
    + '<input class="ng-input" id="ng-pageobj-type" value="' + esc(paramType) + '" placeholder="e.g. news-pages">'
    + '<p class="ng-hint">One click creates the page object below in the CMS, then asks the CMS to open it.</p>'
    + '<pre class="ng-pre ng-pageobj-pre" id="ng-pageobj-preview">' + esc(buildPageObjectJson()) + '</pre>'
    + '<div class="ng-pageobj-actions"><button class="ng-btn ng-btn-primary" type="button" id="ng-pageobj-create">🚀 Create object</button>'
    + '<button class="ng-btn ng-btn-sm" type="button" id="ng-pageobj-copy">📋 Copy JSON instead</button></div>'
    + '<p class="ng-hint" id="ng-pageobj-status"></p></div>');
  var createBtn = el('ng-pageobj-create');
  if (createBtn) createBtn.addEventListener('click', function () {
    var type = (el('ng-pageobj-type') ? el('ng-pageobj-type').value : '').trim() || paramType;
    var st = el('ng-pageobj-status');
    if (!type) { if (st) st.textContent = 'Enter an object type first.'; return; }
    if (typeof tool.requestObjects !== 'function') {
      if (st) st.textContent = 'This host does not expose requestObjects — use 📋 Copy JSON and create the object manually.';
      return;
    }
    createBtn.disabled = true;
    var pm = (DB.page && isObj(DB.page.pageMeta)) ? DB.page.pageMeta : {};
    var lang = (pm.meta && pm.meta.language) || (DB.brief && DB.brief.language) || 'en';
    var payload = {
      mainObjectType: type,
      name: (pm.name || (DB.brief && DB.brief.title) || 'News Story').slice(0, 120),
      productData: {
        data_categoriesBased: {
          slug: pm.slug || (DB.page && DB.page.slug) || 'news-story',
          meta: { language: lang },
          data: {
            status: 'draft',
            htmlPage: { code: { html: DB.page.html, css: DB.page.css, js: DB.page.js } }
          },
          seo: DB.page.seo || {}
        }
      }
    };
    if (DB.publishAt) payload.productData.data_categoriesBased.data.publishAt = DB.publishAt;
    try {
      tool.requestObjects('create', payload, function (err, result) {
        createBtn.disabled = false;
        if (err) { if (st) st.textContent = 'Create failed: ' + err; return; }
        var obj = (result && result.object) || {};
        if (st) st.textContent = '✅ Created object "' + esc(str(obj.name, type)) + '" (id: ' + esc(str(obj.id, '')) + ').';
        tool.notify('Page object created ✓', 'success');
        try { if (tool.openObjectDetail) tool.openObjectDetail(type, obj.id); } catch (e) {}
        _snapshotHistory('CMS object created (' + type + ')');
        setStatus('CMS page object created ✓', 'good');
      });
    } catch (e) {
      createBtn.disabled = false;
      if (st) st.textContent = 'Create unavailable: ' + e.message;
    }
  });
  var copyBtn = el('ng-pageobj-copy');
  if (copyBtn) copyBtn.addEventListener('click', function () { copyToClipboard(buildPageObjectJson(), 'Page object JSON copied!'); });
}

/* ── E3 related stories picker ── */
function openRelatedPicker() {
  if (_readOnly || !_canWrite()) { setStatus('Read-only — related picker is locked for viewers.', 'warn'); return; }
  if (!DB.page || !DB.page.plan) { tool.notify('Generate a page first.', 'warning'); return; }
  var paramType = str(_param('relatedTypeId'), '').trim();
  openModal('🔗 Related stories picker',
    '<div class="ng-related-box">'
    + '<label class="ng-field-label" for="ng-related-type">Source object type</label>'
    + '<input class="ng-input" id="ng-related-type" value="' + esc(paramType) + '" placeholder="e.g. news-pages">'
    + '<div class="ng-related-actions"><button class="ng-btn ng-btn-primary" type="button" id="ng-related-load">🔍 List objects</button></div>'
    + '<div class="ng-related-rows" id="ng-related-rows"><small>Enter a type and list objects to pick related stories.</small></div>'
    + '<div class="ng-related-actions"><button class="ng-btn" type="button" id="ng-related-replace">Replace related block</button>'
    + '<button class="ng-btn" type="button" id="ng-related-append">Append to related block</button>'
    + '<button class="ng-btn ng-btn-sm" type="button" id="ng-related-cancel">Cancel</button></div></div>');
  var loadBtn = el('ng-related-load');
  if (loadBtn) loadBtn.addEventListener('click', function () {
    var type = (el('ng-related-type') ? el('ng-related-type').value : '').trim() || paramType;
    var rows = el('ng-related-rows');
    if (!type) { if (rows) rows.innerHTML = '<small>Enter an object type first.</small>'; return; }
    if (typeof tool.requestObjects !== 'function') { if (rows) rows.innerHTML = '<small>This host does not expose requestObjects — type object URLs manually instead.</small>'; return; }
    if (rows) rows.innerHTML = '<small>Loading…</small>';
    try {
      tool.requestObjects('query', { mainObjectType: type }, function (err, result) {
        if (err) { if (rows) rows.innerHTML = '<small>Query failed: ' + esc(err) + '</small>'; return; }
        var objs = (result && Array.isArray(result.objects)) ? result.objects : [];
        if (!objs.length) { if (rows) rows.innerHTML = '<small>No objects in type "' + esc(type) + '".</small>'; return; }
        rows.innerHTML = objs.slice(0, 30).map(function (o) {
          return '<label class="ng-related-row"><input type="checkbox" data-related-id="' + esc(o.id) + '" data-related-name="' + esc(str(o.name, 'Untitled')) + '">'
            + '<span>' + esc(str(o.name, 'Untitled')) + ' <small>' + esc(type) + '/' + esc(o.id) + '</small></span></label>';
        }).join('');
      });
    } catch (e) {
      if (rows) rows.innerHTML = '<small>Query unavailable: ' + esc(e.message) + '</small>';
    }
  });
  function applyRelated(mode) {
    var type = (el('ng-related-type') ? el('ng-related-type').value : '').trim() || paramType;
    var rows = el('ng-related-rows');
    if (!type || !rows) return;
    var picked = [];
    Array.prototype.forEach.call(rows.querySelectorAll('input:checked'), function (cb) {
      picked.push({ title: cb.getAttribute('data-related-name'), url: '/' + type + '/' + cb.getAttribute('data-related-id'), tag: String(type).toUpperCase().slice(0, 10) });
    });
    if (!picked.length) { tool.notify('Pick at least one object.', 'warning'); return; }
    var plan = clonePlan();
    if (!Array.isArray(plan.components)) plan.components = [];
    var idx = -1;
    plan.components.forEach(function (cp, i) { if (isObj(cp) && str(cp.component, '').toLowerCase() === 'related') idx = i; });
    var block = { component: 'related', content: { title: 'Related stories', items: picked } };
    if (idx !== -1) {
      if (mode === 'replace') { plan.components[idx] = block; }
      else {
        var cur = plan.components[idx];
        var items = (isObj(cur.content) && Array.isArray(cur.content.items)) ? cur.content.items.slice() : [];
        cur.content = cur.content || {};
        cur.content.items = items.concat(picked);
      }
    } else {
      plan.components.push(block);
    }
    var e2 = _applyAiPlan(plan, 'Related picker (' + mode + ')');
    if (e2) { tool.notify('Apply failed: ' + e2, 'error'); return; }
    closeModal();
    setStatus('Related stories updated ✓', 'good');
    tool.notify('Related block updated ✓', 'success');
  }
  var rb = el('ng-related-replace');
  if (rb) rb.addEventListener('click', function () { applyRelated('replace'); });
  var ab2 = el('ng-related-append');
  if (ab2) ab2.addEventListener('click', function () { applyRelated('append'); });
  var cb2 = el('ng-related-cancel');
  if (cb2) cb2.addEventListener('click', closeModal);
}

/* ── E5 email newsletter edition ── */
function runEmailEdition() {
  if (_readOnly || !_canWrite()) { setStatus('Read-only — email edition is locked for viewers.', 'warn'); return; }
  if (_chatBusy) { setStatus('The AI is busy — wait a moment.', 'warn'); return; }
  if (!DB.page || !DB.page.html) { tool.notify('No page yet — generate one first.', 'warning'); return; }
  openModal('✉ Email newsletter edition', '<div class="ng-email-box"><p id="ng-email-progress">Writing the email edition…</p></div>');
  _chatBusy = true;
  var excerpt = '';
  try {
    var div = document.createElement('div');
    div.innerHTML = DB.page.html;
    excerpt = (div.textContent || '').replace(/\s+/g, ' ').slice(0, 1800);
  } catch (e) {}
  var prompt = [
    'EMAIL EDITION — write the newsletter edition of this story.',
    'Return strict JSON ONLY: {"subject":"…","html":"…"}.',
    '- html must be a COMPLETE HTML email document (doctype, head with meta charset, body, inline styles, table-free layout).',
    '- Keep it under ~1200 words: hook subject line, lead, 2-3 highlights, one quote, one data point if available, closing with a link placeholder {{url}}.',
    '- All style inline (no external CSS); mobile friendly (max-width 600px).',
    '',
    buildBriefBlock(),
    '',
    'STORY TEXT EXCERPT:\n' + excerpt
  ].join('\n');
  try {
    tool.requestAI(prompt, buildAiContext(), function (err, resp) {
      _chatBusy = false;
      if (err && !resp) { closeModal(); setStatus('Email edition failed.', 'err'); return; }
      var parsed = parseAiJson(String(resp || ''));
      if (!parsed.ok || !isObj(parsed.data)) { closeModal(); setStatus('Email edition failed — invalid JSON.', 'err'); return; }
      DB.emailTemplate = { subject: str(parsed.data.subject, 'Today\'s story'), html: str(parsed.data.html, '') };
      persist();
      var body = el('ng-modal-body');
      if (body) body.innerHTML = '<div class="ng-email-box">'
        + '<label class="ng-field-label" for="ng-email-subject">Subject</label>'
        + '<input class="ng-input" id="ng-email-subject" value="' + esc(DB.emailTemplate.subject) + '">'
        + '<label class="ng-field-label" for="ng-email-html">Email HTML (full document)</label>'
        + '<textarea class="ng-input ng-email-html" id="ng-email-html" rows="10" spellcheck="false"></textarea>'
        + '<div class="ng-pageobj-actions"><button class="ng-btn ng-btn-primary" type="button" id="ng-email-copy">📋 Copy subject + HTML</button>'
        + '<button class="ng-btn ng-btn-sm" type="button" id="ng-email-save">💾 Keep in record</button></div>'
        + '<p class="ng-hint">Also appended to the generator output as === EMAIL TEMPLATE ===.</p></div>';
      var ta = el('ng-email-html');
      if (ta) ta.value = DB.emailTemplate.html;
      var subj = el('ng-email-subject');
      if (subj) subj.addEventListener('input', function () { DB.emailTemplate.subject = subj.value; });
      var copyBtn = el('ng-email-copy');
      if (copyBtn) copyBtn.addEventListener('click', function () {
        if (ta) DB.emailTemplate.html = ta.value;
        persist();
        copyToClipboard(emailTemplateText(), 'Email edition copied!');
      });
      var saveBtn = el('ng-email-save');
      if (saveBtn) saveBtn.addEventListener('click', function () {
        if (ta) DB.emailTemplate.html = ta.value;
        if (subj) DB.emailTemplate.subject = subj.value;
        persist();
        renderEmailEdition();
        tool.notify('Email edition kept in the record ✓', 'success');
      });
      renderEmailEdition();
      setStatus('Email edition ready ✓', 'good');
      tool.notify('Email edition ready — copy it or keep it in the record.', 'info');
    });
  } catch (e) {
    _chatBusy = false; closeModal();
    setStatus('Email edition unavailable: ' + e.message, 'warn');
  }
}
function emailTemplateText() {
  var t = DB.emailTemplate || {};
  var slug = (DB.page && DB.page.slug) || 'news-story';
  var obj = { templateId: 'news-' + slug, subject: str(t.subject, ''), html: str(t.html, '') };
  return '=== EMAIL TEMPLATE ===\n' + JSON.stringify(obj, null, 2);
}
function renderEmailEdition() {
  var wrap = el('ng-email-edition');
  if (!wrap) return;
  var t = DB.emailTemplate;
  if (!t || !t.subject) { wrap.innerHTML = '<small class="ng-hint">No email edition yet — press “✉ Email edition”.</small>'; return; }
  wrap.innerHTML = '<div class="ng-email-row"><b>✉ ' + esc(t.subject) + '</b><span>' + (String(t.html || '').length / 1024).toFixed(1) + ' KB</span></div>'
    + '<div class="ng-email-actions"><button class="ng-btn ng-btn-sm" type="button" id="ng-email-copy2">📋 Copy</button>'
    + '<button class="ng-btn ng-btn-sm" type="button" id="ng-email-open2">✏ Edit</button></div>';
  var c = el('ng-email-copy2');
  if (c) c.addEventListener('click', function () { copyToClipboard(emailTemplateText(), 'Email edition copied!'); });
  var o = el('ng-email-open2');
  if (o) o.addEventListener('click', runEmailEdition);
}

/* ── F3 style / plagiarism-adjacent lint ── */
var _CLICHES = ['in a nutshell', 'at the end of the day', 'last but not least', 'cutting edge', 'game changer', 'game-changer', 'think outside the box', 'move the needle', 'perfect storm', 'hit the ground running', 'deep dive', 'unprecedented', 'paradigm shift', 'synergy', 'low-hanging fruit', 'level the playing field', 'sea change'];
function lintDraft() {
  var box = el('ng-lint-results');
  if (!box) return;
  if (!DB.page || !DB.page.html) { box.innerHTML = '<small>No page yet.</small>'; return; }
  var text = '';
  try {
    var div = document.createElement('div');
    div.innerHTML = DB.page.html;
    text = (div.textContent || '').replace(/\s+/g, ' ');
  } catch (e) {}
  var rows = [];
  // clichés
  var hits = {};
  var lower = text.toLowerCase();
  _CLICHES.forEach(function (c) {
    var n = lower.split(c).length - 1;
    if (n > 0) hits[c] = n;
  });
  var keys = Object.keys(hits);
  if (keys.length) rows.push('<li><b>Clichés:</b> ' + keys.map(function (k) { return esc(k) + ' ×' + hits[k]; }).join(', ') + ' — replace with concrete language.</li>');
  // repeated 3-grams
  var words = lower.replace(/[^a-z0-9\u00c0-\u024f\s'-]/g, ' ').split(/\s+/).filter(Boolean);
  var grams = {};
  for (var i = 0; i < words.length - 2; i++) {
    var g = words[i] + ' ' + words[i + 1] + ' ' + words[i + 2];
    if (g.length < 60) grams[g] = (grams[g] || 0) + 1;
  }
  var reps = Object.keys(grams).filter(function (g) { return grams[g] > 2; }).slice(0, 5);
  if (reps.length) rows.push('<li><b>Repeated phrases:</b> ' + reps.map(function (r) { return '“' + esc(r) + '” ×' + grams[r]; }).join('; ') + ' — vary the wording.</li>');
  // long sentences
  var sentences = text.replace(/([.!?])\s+/g, '$1\n').split('\n');
  var longN = 0;
  sentences.forEach(function (s) {
    var w = s.trim().split(/\s+/).length;
    if (w > 40) longN++;
  });
  if (longN) rows.push('<li><b>Long sentences:</b> ' + longN + ' sentence(s) over 40 words — split them for mobile readers.</li>');
  if (!rows.length) rows.push('<li><span class="ng-ok">✔</span> Clean draft — no clichés, no repeated phrases, no marathon sentences.</li>');
  box.innerHTML = '<ul class="ng-lint-list">' + rows.join('') + '</ul>';
  var score = el('ng-lint-score');
  if (score) {
    var s = rows.length && rows[0].indexOf('ng-ok') === -1 ? (rows.length === 3 ? '2' : rows.length === 2 ? '1' : '0') : '3';
    score.textContent = 'Lint: ' + s + '/3';
    score.style.color = s === '3' ? 'var(--ng-good)' : 'var(--ng-warn)';
  }
  setStatus('Draft lint complete.', 'good');
}
function runStyleReview() {
  if (_readOnly || !_canWrite()) { setStatus('Read-only — style review is locked for viewers.', 'warn'); return; }
  if (_chatBusy) { setStatus('The AI is busy — wait a moment.', 'warn'); return; }
  if (!DB.page || !DB.page.html) { tool.notify('No page yet.', 'warning'); return; }
  openModal('🖋 Style review', '<p class="ng-hint" id="ng-style-progress">Desk review in progress…</p>');
  _chatBusy = true;
  var excerpt = '';
  try {
    var div = document.createElement('div');
    div.innerHTML = DB.page.html;
    excerpt = (div.textContent || '').replace(/\s+/g, ' ').slice(0, 2500);
  } catch (e) {}
  var prompt = [
    'STYLE REVIEW — act as a ruthless copy desk.',
    'Return strict JSON ONLY: {"issues":[{"type":"tone|accuracy|structure|readability|attribution|clarity","where":"short quote from the draft","why":"one line","fix":"one concrete edit"}]}.',
    'Up to 6 issues, most important first. If clean, return empty issues array.',
    'DRAFT TEXT:\n' + excerpt
  ].join('\n');
  try {
    tool.requestAI(prompt, buildAiContext(), function (err, resp) {
      _chatBusy = false;
      if (err && !resp) { closeModal(); setStatus('Style review failed.', 'err'); return; }
      var parsed = parseAiJson(String(resp || ''));
      var issues = (parsed.ok && Array.isArray(parsed.data.issues)) ? parsed.data.issues : [];
      var body = el('ng-modal-body');
      if (!body) return;
      if (!issues.length) { body.innerHTML = '<p class="ng-ok">✔ Copy desk is happy — no issues found.</p>'; return; }
      body.innerHTML = '<ul class="ng-style-list">' + issues.map(function (it) {
        return '<li><b>' + esc(str(it.type, 'note')) + '</b> — ' + esc(str(it.where, '')) + '<br><small>' + esc(str(it.why, '')) + '</small><br><em>Fix:</em> ' + esc(str(it.fix, '')) + '</li>';
      }).join('') + '</ul><div class="ng-pageobj-actions"><button class="ng-btn ng-btn-sm" type="button" id="ng-style-copy">📋 Copy notes</button></div>';
      var cbtn = el('ng-style-copy');
      if (cbtn) cbtn.addEventListener('click', function () {
        copyToClipboard(issues.map(function (it) { return '[' + str(it.type, 'note') + '] ' + str(it.where, '') + ' → ' + str(it.fix, ''); }).join('\n'), 'Style notes copied!');
      });
    });
  } catch (e) {
    _chatBusy = false; closeModal();
    setStatus('Style review unavailable: ' + e.message, 'warn');
  }
}

/* ── G4 prompt optimizer + prompt lab ── */
var _lastUserPrompt = '';
function recordPromptLab(promptText) {
  var snippet = String(promptText || '').slice(0, 220);
  if (!snippet) return;
  var lab = Array.isArray(DB.promptLab) ? DB.promptLab.slice() : [];
  var existing = lab.filter(function (e) { return e.snippet === snippet; })[0];
  if (existing) {
    existing.version = DB.version;
    existing.used = (num(existing.used, 0) + 1);
  } else {
    lab.push({ snippet: snippet, version: DB.version, used: 1, votes: { up: 0, down: 0 }, hash: 'p' + Math.random().toString(36).slice(2, 8) });
  }
  DB.promptLab = lab.slice(-6);
}
function renderPromptLab() {
  var wrap = el('ng-prompt-lab');
  if (!wrap) return;
  var lab = Array.isArray(DB.promptLab) ? DB.promptLab : [];
  if (!lab.length) { wrap.innerHTML = '<small class="ng-hint">Prompts you used appear here — vote to help the optimizer.</small>'; return; }
  wrap.innerHTML = lab.map(function (e) {
    return '<div class="ng-prompt-row"><span class="ng-prompt-snippet" title="' + esc(e.snippet) + '">' + esc(e.snippet.slice(0, 90)) + (e.snippet.length > 90 ? '…' : '') + '</span>'
      + '<span class="ng-prompt-meta">v' + esc(String(e.version)) + ' · ×' + esc(String(e.used)) + '</span>'
      + '<button class="ng-btn ng-btn-sm" type="button" data-prompt-vote="up" data-prompt-hash="' + esc(e.hash) + '">👍 ' + esc(String(num(e.votes.up, 0))) + '</button>'
      + '<button class="ng-btn ng-btn-sm" type="button" data-prompt-vote="down" data-prompt-hash="' + esc(e.hash) + '">👎 ' + esc(String(num(e.votes.down, 0))) + '</button></div>';
  }).join('');
  Array.prototype.forEach.call(wrap.querySelectorAll('[data-prompt-vote]'), function (b) {
    b.addEventListener('click', function () {
      var hash = b.getAttribute('data-prompt-hash');
      var dir = b.getAttribute('data-prompt-vote');
      DB.promptLab.forEach(function (e) {
        if (e.hash === hash) { e.votes = e.votes || { up: 0, down: 0 }; e.votes[dir] = num(e.votes[dir], 0) + 1; }
      });
      persist();
      renderPromptLab();
    });
  });
}
function runPromptOptimizer() {
  if (_readOnly || !_canWrite()) { setStatus('Read-only — the optimizer is locked for viewers.', 'warn'); return; }
  if (_chatBusy) { setStatus('The AI is busy — wait a moment.', 'warn'); return; }
  var lab = Array.isArray(DB.promptLab) ? DB.promptLab : [];
  if (!lab.length) { tool.notify('Use the AI at least once so there are prompts to optimize.', 'warning'); return; }
  var box = el('ng-prompt-opt-result');
  if (box) box.innerHTML = '<small>Optimizing…</small>';
  _chatBusy = true;
  var prompt = [
    'PROMPT OPTIMIZER — improve the instruction we send to the page-building AI.',
    'Below are recent prompts with usage and votes. Return strict JSON ONLY: {"improved":"the rewritten system-prompt addition, 2-4 sentences, concrete, no fluff"}.',
    'Keep the improved text in the story language of the page.',
    'PROMPTS:\n' + lab.map(function (e) { return '- ×' + e.used + ' 👍' + num(e.votes.up, 0) + ' 👎' + num(e.votes.down, 0) + ': ' + e.snippet; }).join('\n')
  ].join('\n');
  try {
    tool.requestAI(prompt, buildAiContext(), function (err, resp) {
      _chatBusy = false;
      if (err && !resp) { if (box) box.innerHTML = '<small>✖ ' + esc(err || 'AI error') + '</small>'; setStatus('Optimizer failed.', 'err'); return; }
      var parsed = parseAiJson(String(resp || ''));
      if (!parsed.ok || !str(parsed.data.improved, '')) { if (box) box.innerHTML = '<small>✖ No improvement returned.</small>'; setStatus('Optimizer failed.', 'err'); return; }
      DB.extraPrompt = str(parsed.data.improved, '');
      persist();
      var ta = el('ng-extra-prompt');
      if (ta) ta.value = DB.extraPrompt;
      if (box) box.innerHTML = '<small>✅ <b>Improved prompt stored.</b> It is injected into every next AI call. Edit it in the textarea above.</small>';
      setStatus('Prompt improved ✓', 'good');
      tool.notify('Prompt optimizer stored an improvement ✓', 'success');
    });
  } catch (e) {
    _chatBusy = false;
    setStatus('Optimizer unavailable: ' + e.message, 'warn');
  }
}
function extraPromptLine() {
  var t = String(DB && DB.extraPrompt ? DB.extraPrompt : '').trim();
  return t ? ('HOUSE PREFERENCE (learned from your prompt votes — follow unless it conflicts): ' + t) : '';
}

/* ── modal helpers ── */
function openModal(title, html) {
  var ov = el('ng-modal-overlay');
  var t = el('ng-modal-title');
  var b = el('ng-modal-body');
  if (!ov || !b) return;
  if (t) t.textContent = title;
  b.innerHTML = html;
  ov.style.display = 'flex';
}
function closeModal() {
  var ov = el('ng-modal-overlay');
  if (ov) ov.style.display = 'none';
}

/* ── E4 Social card preview ── */
function renderSocialPreview() {
  var wrap = el('ng-social-preview');
  if (!wrap) return;
  var seo = (DB.page && isObj(DB.page.seo)) ? DB.page.seo : {};
  var brief = DB.brief || {};
  var title = str(seo.ogTitle, seo.metaTitle, brief.title, 'News story');
  var desc = str(seo.ogDesc, seo.metaDesc, brief.summary, '');
  var img = imgSrc(seo.ogImage);
  var slug = (DB.page && DB.page.slug) || 'story';
  var domain = 'newsroom.example/' + slug;
  wrap.innerHTML = '<div class="ng-social-card">'
    + (img ? '<img class="ng-social-img" src="' + esc(img) + '" alt="" loading="lazy" style="object-fit:cover">'
      : '<div class="ng-social-img">' + esc(title) + '</div>')
    + '<div class="ng-social-body"><div class="ng-social-domain">' + esc(domain) + '</div>'
    + '<div class="ng-social-title">' + esc(title) + '</div>'
    + '<div class="ng-social-desc">' + esc(String(desc).slice(0, 160)) + '</div></div></div>';
  var meta = el('ng-social-meta');
  if (meta) meta.textContent = img ? 'ogImage ✓' : 'no ogImage — gradient placeholder used';
}

/* ── E6 Notify editors ── */
function notifyEditors() {
  if (_readOnly || !_canWrite()) { setStatus('Read-only — notify is locked for viewers.', 'warn'); return; }
  if (!DB.page || !DB.page.html) { tool.notify('Generate a page first.', 'warning'); return; }
  var to = str(_param('editorEmail'), '');
  if (!to) {
    var u = _user;
    to = u && u.email ? u.email : '';
  }
  if (!to) { tool.notify('Set the admin parameter "editorEmail" to send editor notifications.', 'warning'); return; }
  var title = (DB.brief && DB.brief.title) || (DB.page && DB.page.pageMeta && DB.page.pageMeta.name) || 'Untitled story';
  var guards = runGuardChecks();
  var gPass = guards.filter(function (c) { return c.ok; }).length;
  var seo = seoChecks();
  var sPass = seo.filter(function (c) { return c.ok; }).length;
  var htmlBody = '<h1>' + esc(title) + '</h1>'
    + '<p>Version <b>v' + DB.version + '</b> is <b>' + esc(DB.status || 'draft') + '</b> and ready for editorial review.</p>'
    + '<p>Guardrails ' + gPass + '/' + guards.length + ' · SEO ' + sPass + '/' + seo.length + ' · '
    + ((DB.page.html.length + DB.page.css.length + DB.page.js.length) / 1024).toFixed(1) + ' KB</p>'
    + (DB.reviewNote ? '<p><i>Editor note: ' + esc(DB.reviewNote) + '</i></p>' : '');
  setStatus('Sending notification…', 'busy');
  try {
    tool.requestSendEmail({ to: to, subject: '📰 Story ready for review: ' + title, title: 'News Page Studio', htmlBody: htmlBody }, function (err) {
      if (err) { setStatus('Email failed: ' + err, 'err'); tool.notify('Email failed: ' + err, 'error'); return; }
      setStatus('Editor notified ✓', 'good');
      tool.notify('Editor notification sent ✓', 'success');
    });
  } catch (e) { setStatus('Email channel unavailable.', 'err'); }
}

/* ── F1 Review workflow ── */
function renderReview() {
  var sel = el('ng-review-status');
  var note = el('ng-review-note');
  if (sel) sel.value = DB.status || 'draft';
  if (note) note.value = DB.reviewNote || '';
  var badge = el('ng-review-badge');
  if (badge) {
    badge.textContent = { draft: '✏️ draft', review: '🔍 in review', approved: '✅ approved' }[DB.status || 'draft'];
    badge.style.color = DB.status === 'approved' ? 'var(--ng-good)' : DB.status === 'review' ? 'var(--ng-warn)' : 'var(--ng-dim)';
  }
  var chip = el('ng-page-chip');
  if (chip && DB.page && DB.page.html) {
    chip.textContent = '📄 v' + DB.version + ' · ' + (DB.status || 'draft');
    chip.className = 'ng-chip ng-chip-good';
  }
}

/* ── F2 Image credits ── */
function scanPlanImages() {
  var out = [];
  var plan = (DB.page && DB.page.plan) || { components: [] };
  (Array.isArray(plan.components) ? plan.components : []).forEach(function (cp, ci) {
    var id = str(cp.component, '').toLowerCase();
    var d = isObj(cp.content) ? cp.content : {};
    if (id === 'hero' && imgSrc(d.image)) out.push({ ci: ci, key: 'caption', label: 'Hero image', src: d.image, val: str(d.caption, '') });
    if (id === 'photostory' && imgSrc(d.image)) {
      out.push({ ci: ci, key: 'caption', label: 'Photo story caption', src: d.image, val: str(d.caption, '') });
      out.push({ ci: ci, key: 'credit', label: 'Photo story credit', src: d.image, val: str(d.credit, '') });
    }
    if (id === 'gallery' && Array.isArray(d.images)) {
      d.images.forEach(function (g, gi) {
        if (imgSrc(g.src)) out.push({ ci: ci, key: 'caption', label: 'Gallery #' + (gi + 1) + ' caption', src: g.src, val: str(g.caption, ''), sub: gi, arr: 'images' });
      });
    }
    if (id === 'article' && Array.isArray(d.blocks)) {
      d.blocks.forEach(function (bl, bi) {
        if (str(bl.t, '') === 'img' && imgSrc(bl.src)) out.push({ ci: ci, key: 'caption', label: 'Article image caption', src: bl.src, val: str(bl.caption, ''), sub: bi, arr: 'blocks' });
      });
    }
  });
  return out;
}
function renderCredits() {
  var wrap = el('ng-credits-list');
  if (!wrap) return;
  var imgs = scanPlanImages();
  var score = el('ng-credits-score');
  if (score) {
    var filled = imgs.filter(function (im) { return str(im.val, ''); }).length;
    score.textContent = filled + '/' + imgs.length + ' credited';
    score.style.color = imgs.length === 0 || filled === imgs.length ? 'var(--ng-good)' : 'var(--ng-warn)';
  }
  if (!imgs.length) { wrap.innerHTML = '<p style="color:var(--ng-dim);font-size:12px;margin:0">No images with editable captions/credits in the current plan.</p>'; return; }
  wrap.innerHTML = imgs.map(function (im, i) {
    return '<div class="ng-credit-row"><img src="' + esc(im.src) + '" alt="" loading="lazy">'
      + '<span class="ng-credit-src">' + esc(im.label) + '</span>'
      + '<input type="text" data-credit="' + i + '" value="' + esc(im.val) + '" placeholder="Caption / credit">'
      + '</div>';
  }).join('');
  Array.prototype.forEach.call(wrap.querySelectorAll('[data-credit]'), function (inp) {
    inp.addEventListener('change', function () { applyCredit(parseInt(inp.getAttribute('data-credit'), 10), inp.value); });
  });
}
function applyCredit(idx, val) {
  var imgs = scanPlanImages();
  var im = imgs[idx];
  if (!im) return;
  var plan = clonePlan();
  var cp = plan.components[im.ci];
  if (!cp || !isObj(cp.content)) return;
  if (im.arr === 'images') cp.content.images[im.sub].caption = val;
  else if (im.arr === 'blocks') cp.content.blocks[im.sub].caption = val;
  else cp.content[im.key] = val;
  DB.page.plan = plan;
  if (recompilePage(true)) {
    persist();
    setStatus('Credit saved ✓', 'good');
    renderCredits();
  }
}

/* ── G2 Performance budget meter ── */
function renderPerf() {
  var wrap = el('ng-perf-list');
  if (!wrap) return;
  var p = DB.page;
  if (!p || !p.html) { wrap.innerHTML = '<div class="ng-perf-row"><span>No page yet.</span></div>'; return; }
  var total = p.html.length + p.css.length + p.js.length;
  var kb = total / 1024;
  var imgs = (p.html.match(/<img\b/g) || []).length;
  var media = (p.html.match(/<(video|audio)\b/g) || []).length;
  var ext = (p.html.match(/src="(https?:[^"]+)"/g) || []).map(function (m) { return m.slice(5, -1); });
  var hosts = {};
  ext.forEach(function (u) { try { hosts[new URL(u).hostname] = true; } catch (e) {} });
  var pct = Math.min(100, Math.round((kb / 200) * 100));
  var cls = kb > 180 ? 'bad' : kb > 120 ? 'warn' : '';
  wrap.innerHTML = '<div class="ng-perf-row"><span>Code size</span><b>' + kb.toFixed(1) + ' KB / 200 KB budget</b></div>'
    + '<div class="ng-perf-bar ' + cls + '"><i style="width:' + pct + '%"></i></div>'
    + '<div class="ng-perf-row"><span>Images</span><b>' + imgs + '</b></div>'
    + '<div class="ng-perf-row"><span>Video / audio embeds</span><b>' + media + '</b></div>'
    + '<div class="ng-perf-row"><span>External hosts</span><b>' + Object.keys(hosts).length + (Object.keys(hosts).length ? ' (' + Object.keys(hosts).slice(0, 3).join(', ') + ')' : '') + '</b></div>';
  var score = el('ng-perf-score');
  if (score) {
    score.textContent = kb.toFixed(1) + ' KB';
    score.style.color = cls === 'bad' ? 'var(--ng-bad)' : cls === 'warn' ? 'var(--ng-warn)' : 'var(--ng-good)';
  }
}

/* ── G3 Component unit tests ── */
function runComponentTests() {
  var list = el('ng-comptest-list');
  if (!list) return;
  var ctx = makeCtx('test');
  _uidCtr = 0;
  var pass = 0, fail = 0, rows = [];
  for (var id in NG_COMPONENTS) {
    if (!Object.prototype.hasOwnProperty.call(NG_COMPONENTS, id)) continue;
    var problems = [];
    var html = '';
    try { html = NG_COMPONENTS[id].render(gallerySampleFor(id), ctx); } catch (e) { problems.push('render threw: ' + e.message); }
    if (!html) problems.push('empty output');
    if (html.indexOf('<' + 'script') !== -1 || html.indexOf('<' + '/script') !== -1) problems.push('script tag in output');
    if (html && !/class="n-/.test(html) && html.indexOf('class="ng-') === -1) problems.push('no scoped n- class');
    var idRe = /id="([^"]+)"/g, idm, seen = {};
    while ((idm = idRe.exec(html)) !== null) {
      if (seen[idm[1]]) problems.push('duplicate id ' + idm[1]);
      seen[idm[1]] = true;
    }
    if (problems.length) { fail++; rows.push('<li><span class="ng-fail">✘</span>' + esc(id) + ' — ' + esc(problems.join('; ')) + '</li>'); }
    else { pass++; rows.push('<li><span class="ng-ok">✔</span>' + esc(id) + ' renders cleanly</li>'); }
  }
  list.innerHTML = rows.join('');
  var score = el('ng-comptest-score');
  if (score) {
    score.textContent = pass + '/' + (pass + fail);
    score.style.color = fail ? 'var(--ng-warn)' : 'var(--ng-good)';
  }
  setStatus('Component tests: ' + pass + ' pass, ' + fail + ' fail.', fail ? 'warn' : 'good');
}

/* ═══════════════════════════════════════════════════════════════════
   EXPORTS
   ═══════════════════════════════════════════════════════════════════ */
function buildGeneratorOutputText() {
  var p = DB.page || {};
  var seo = p.seo ? JSON.stringify(p.seo, null, 2) : '{\n  "metaTitle": "",\n  "metaDesc": ""\n}';
  var pm = p.pageMeta ? JSON.stringify(p.pageMeta, null, 2) : '{\n  "name": "News",\n  "slug": "' + (p.slug || 'news-story') + '",\n  "meta": { "language": "en" }\n}';
  var out = '=== HTML ===\n' + (p.html || '') + '\n\n=== CSS ===\n' + (p.css || '') + '\n\n=== JS ===\n' + (p.js || '')
    + '\n\n=== SEO ===\n' + seo + '\n\n=== PAGE META ===\n' + pm;
  if (p.configNeeded && String(p.configNeeded).trim()) out += '\n\n=== CMS CONFIG NEEDED ===\n' + p.configNeeded;
  if (DB.emailTemplate && DB.emailTemplate.subject) out += '\n\n' + emailTemplateText();
  return out;
}

function buildPageObjectJson() {
  var p = DB.page || {};
  var pm = (p.pageMeta && isObj(p.pageMeta)) ? p.pageMeta : {};
  var lang = (pm.meta && pm.meta.language) || (DB.brief && DB.brief.language) || 'en';
  var obj = {
    name: pm.name || (DB.brief && DB.brief.title) || 'News Story',
    slug: pm.slug || p.slug || slugify((DB.brief && DB.brief.title) || 'news-story'),
    meta: { language: lang },
    data: {
      status: (pm.data && pm.data.status) || 'published',
      htmlPage: { code: { html: p.html || '', css: p.css || '', js: p.js || '' } }
    },
    seo: p.seo || {}
  };
  if (pm.data && pm.data.requireAuth) obj.data.requireAuth = pm.data.requireAuth;
  if (pm.data && pm.data.templateContentType) obj.data.templateContentType = pm.data.templateContentType;
  if (DB.publishAt) obj.data.publishAt = DB.publishAt;
  if (pm.data && Array.isArray(pm.data.sections) && pm.data.sections.length) {
    obj.data.sections = pm.data.sections.slice(0, 20);
  }
  return JSON.stringify(obj, null, 2);
}

function buildFullPage() {
  var p = DB.page;
  var lang = (DB.brief && DB.brief.language) || 'en';
  var title = esc((p && p.seo && p.seo.metaTitle) || (DB.brief && DB.brief.title) || 'News story');
  var favSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🗞️</text></svg>';
  return '<!DOCTYPE html>\n<html lang="' + esc(lang) + '">\n<head>\n<meta charset="UTF-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>' + title + '</title>\n'
    + '<link rel="icon" href="data:image/svg+xml,' + encodeURIComponent(favSvg) + '">\n'
    + '<style>\nbody{margin:0;padding:0;background:#fff}\n' + (p.css || '') + '\n</style>\n</head>\n<body>\n'
    + (p.html || '') + '\n'
    + _gwPreviewMockScript(lang) + '\n'
    + '<script>\n' + (p.js || '') + '\n<' + '/script>\n</body>\n</html>';
}

function copyToClipboard(text, label) {
  function done(ok) {
    if (ok) {
      tool.notify(label || 'Copied!', 'success');
      setStatus(label || 'Copied!', 'good');
    } else {
      tool.notify('Copy failed — select the text manually.', 'warning');
    }
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () { done(true); }, function () { fallbackCopy(text, done); });
  } else fallbackCopy(text, done);
}
function fallbackCopy(text, cb) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  var ok = false;
  try { ok = document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(ta);
  cb(ok);
}

function downloadFullPage() {
  if (!DB.page || !DB.page.html) { tool.notify('No page yet — generate one first.', 'warning'); return; }
  var content = buildFullPage();
  var blob = new Blob([content], { type: 'text/html' });
  var u = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = u;
  a.download = (DB.page.slug || 'news-story') + '.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(u); }, 1000);
  tool.notify('Downloaded: ' + a.download, 'success');
}

function exportPdf() {
  if (!DB.page || !DB.page.html) { tool.notify('No page yet — generate one first.', 'warning'); return; }
  setStatus('Preparing PDF export…', 'busy');
  try {
    tool.requestExportPdf({ html: buildFullPage(), filename: (DB.page.slug || 'news-story') }, function (err, file) {
      if (err) { setStatus('PDF export failed: ' + err, 'err'); tool.notify('PDF export failed: ' + err, 'error'); return; }
      setStatus('Export ready — opening…', 'good');
      tool.notify('Export ready ✓', 'success');
      tool.openUrl(file.url);
    });
  } catch (e) {
    setStatus('PDF export unavailable: ' + e.message, 'warn');
    tool.notify('PDF export unavailable — use ⬇ Download instead.', 'warning');
  }
}

/* ═══════════════════════════════════════════════════════════════════
   PARAMS + DECLARATIONS
   ═══════════════════════════════════════════════════════════════════ */
function _param(name) {
  try { return tool.param(name, undefined); } catch (e) { return undefined; }
}

function declare() {
  try {
    tool.declareParams([
      {
        name: 'defaultLanguage', label: 'Default page language', type: 'select',
        default: 'en', hint: 'Language used for the story brief and generated page meta (en/tr/de/fr/es/ar).',
        severity: 'goodToHave'
      },
      {
        name: 'newsTone', label: 'Editorial tone', type: 'select',
        default: '',
        hint: 'Tone the AI applies to headlines, kickers and composition. Leave empty for the AI to choose per story.',
        severity: 'optional'
      },
      {
        name: 'maxChatMessages', label: 'Max cached chat messages', type: 'number',
        default: '20',
        hint: 'How many recent chat messages are kept inside the record value as a fallback cache (the full transcript lives in ai-chat-sessions-uniconbaseapps).',
        severity: 'optional'
      },
      {
        name: 'editorEmail', label: 'Editor notification email', type: 'text',
        default: '',
        hint: 'Recipient for the “story ready for review” email sent from the Publish tab (falls back to the current user’s email).',
        severity: 'goodToHave'
      },
      {
        name: 'pageTypeId', label: 'CMS page object type', type: 'text',
        default: '',
        hint: 'App/object type used by the one-click “Create CMS page object” action on the Publish tab (e.g. news-pages).',
        severity: 'goodToHave'
      },
      {
        name: 'relatedTypeId', label: 'Related stories object type', type: 'text',
        default: '',
        hint: 'Object type queried by the Related stories picker on the Publish tab (e.g. news-pages).',
        severity: 'goodToHave'
      }
    ]);
    tool.declareOutput({
      type: 'object',
      description: 'NewsGenerator saved value: one news page (html/css/js + AI plan + SEO/pageMeta), story brief, version and chat cache.',
      properties: {
        version: { type: 'number' },
        brief: { type: 'object' },
        page: {
          type: 'object',
          properties: {
            html: { type: 'string' }, css: { type: 'string' }, js: { type: 'string' },
            plan: { type: 'object' }, seo: { type: 'object' }, pageMeta: { type: 'object' },
            flags: { type: 'object' }, slug: { type: 'string' }
          }
        },
        generationCount: { type: 'number' },
        chatSessionId: { type: 'string' },
        chatCache: { type: 'object' }
      }
    });
  } catch (e) {}
  try { if (tool.reportValid) tool.reportValid(true); } catch (e) {}
}

/* ═══════════════════════════════════════════════════════════════════
   WIRING
   ═══════════════════════════════════════════════════════════════════ */
function wireEvents() {
  function on(id, evt, fn) { var e = el(id); if (e) e.addEventListener(evt, fn); }

  on('ng-btn-send', 'click', function () { sendChatMessage(); });
  on('ng-chat-input', 'keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
  });
  on('ng-btn-interview', 'click', function () { toggleInterview(); });
  on('ng-btn-headline-lab', 'click', function () { runHeadlineLab(); });
  on('ng-btn-deck-lab', 'click', function () { runDeckLab(); });
  on('ng-btn-draft-url', 'click', function () { draftFromUrl(); });
  on('ng-btn-src-extract', 'click', function () { extractSources(); });
  on('ng-btn-factcheck', 'click', function () { runFactcheck(); });
  on('ng-btn-history', 'click', function () { openHistory(); });
  on('ng-btn-notify', 'click', function () { notifyEditors(); });
  on('ng-btn-comptest', 'click', function () { runComponentTests(); });
  on('ng-btn-translate', 'click', function () { runTranslate(); });
  on('ng-btn-agentic', 'click', function () { runAgenticBuild(); });
  on('ng-btn-ab', 'click', function () { runAbComposer(); });
  on('ng-btn-pageobj', 'click', function () { createPageObject(); });
  on('ng-btn-related', 'click', function () { openRelatedPicker(); });
  on('ng-btn-email', 'click', function () { runEmailEdition(); });
  on('ng-btn-lint', 'click', function () { lintDraft(); });
  on('ng-btn-style', 'click', function () { runStyleReview(); });
  on('ng-btn-prompt-opt', 'click', function () { runPromptOptimizer(); });
  on('ng-extra-prompt', 'change', function () {
    var t = el('ng-extra-prompt');
    DB.extraPrompt = t ? t.value : '';
    persist();
    setStatus('House preference saved — injected into the next AI call.', 'good');
  });
  on('ng-publish-at', 'change', function () {
    var t = el('ng-publish-at');
    DB.publishAt = t ? t.value : '';
    persist();
    renderPublishAt();
    setStatus('Scheduled publish time saved ✓', 'good');
    tool.notify('Publish time saved — it rides along in the page object.', 'info');
  });
  on('ng-modal-close', 'click', function () { closeModal(); });
  on('ng-modal-overlay', 'click', function (e) { if (e.target === el('ng-modal-overlay')) closeModal(); });
  ['ng-tone-lively', 'ng-tone-dense', 'ng-tone-formal'].forEach(function (id) {
    var sl = el(id);
    if (sl) sl.addEventListener('change', function () {
      var map = { 'ng-tone-lively': 'lively', 'ng-tone-dense': 'dense', 'ng-tone-formal': 'formal' };
      DB.tone[map[id]] = parseInt(sl.value, 10) || 0;
      persist();
      setStatus('Tone sliders saved — used by the next AI call.', 'good');
    });
  });
  var revSel = el('ng-review-status');
  if (revSel) revSel.addEventListener('change', function () {
    DB.status = revSel.value;
    persist();
    renderReview();
    setStatus('Review status: ' + DB.status, 'good');
  });
  var revNote = el('ng-review-note');
  if (revNote) revNote.addEventListener('input', function () {
    DB.reviewNote = revNote.value;
    persist();
  });
  on('ng-btn-generate', 'click', function () { sendChatMessage('JSON REQUIRED. Build/refresh the full page from the brief and conversation.'); });
  on('ng-btn-generate-empty', 'click', function () { sendChatMessage('JSON REQUIRED. Build/refresh the full page from the brief and conversation.'); });
  on('ng-btn-save', 'click', function () { requestSaveNow('Saved ✓'); });
  on('ng-btn-newchat', 'click', function () { clearChat(); });
  on('ng-btn-rerun', 'click', function () { if (DB.page) updatePreview(); });

  var tabs = el('ng-tabs');
  if (tabs) {
    Array.prototype.forEach.call(tabs.querySelectorAll('.ng-tab'), function (b) {
      b.addEventListener('click', function () { switchTab(b.getAttribute('data-tab')); });
    });
  }
  var devs = el('ng-device-group');
  if (devs) {
    Array.prototype.forEach.call(devs.querySelectorAll('.ng-device'), function (b) {
      b.addEventListener('click', function () {
        _device = b.getAttribute('data-dev');
        Array.prototype.forEach.call(devs.querySelectorAll('.ng-device'), function (x) { x.classList.toggle('active', x === b); });
        updatePreview();
        tool.resize();
      });
    });
  }
  var codeTabs = el('ng-code-tabs');
  if (codeTabs) {
    Array.prototype.forEach.call(codeTabs.querySelectorAll('.ng-codetab'), function (b) {
      b.addEventListener('click', function () { _codeTab = b.getAttribute('data-code'); updateCodeView(); });
    });
  }

  // exports
  on('ng-btn-copy-current', 'click', function () {
    var t = codeSectionText(_codeTab);
    if (!t.trim()) { tool.notify('This section is empty.', 'warning'); return; }
    copyToClipboard(t, _codeTab.toUpperCase() + ' copied!');
  });
  on('ng-btn-copy-all', 'click', function () {
    if (!DB.page || !DB.page.html) { tool.notify('No page yet.', 'warning'); return; }
    copyToClipboard(buildGeneratorOutputText(), 'Generator output copied (=== sections)!');
  });
  on('ng-btn-download', 'click', downloadFullPage);
  on('ng-btn-download2', 'click', downloadFullPage);
  on('ng-btn-export-pdf', 'click', exportPdf);
  on('ng-btn-export-pdf2', 'click', exportPdf);
  on('ng-btn-copy-pageobj', 'click', function () {
    if (!DB.page || !DB.page.html) { tool.notify('No page yet.', 'warning'); return; }
    copyToClipboard(buildPageObjectJson(), 'Page object JSON copied!');
  });
  on('ng-btn-copy-gen', 'click', function () {
    if (!DB.page || !DB.page.html) { tool.notify('No page yet.', 'warning'); return; }
    copyToClipboard(buildGeneratorOutputText(), 'Generator output copied!');
  });
  on('ng-btn-refresh-pub', 'click', function () { updatePublishView(); });

  // brief
  var briefIds = ['bf-title', 'bf-slug', 'bf-category', 'bf-author', 'bf-date', 'bf-location', 'bf-heroimage', 'bf-summary', 'bf-tags', 'bf-sources', 'bf-language'];
  briefIds.forEach(function (id) {
    var e = el(id);
    if (e) e.addEventListener('input', scheduleBriefPersist);
  });
  on('ng-btn-brief-save', 'click', function () {
    readBriefForm();
    persist();
    renderStoryTitle();
    setStatus('Brief saved.', 'good');
    tool.notify('Story brief saved ✓', 'success');
  });
  on('ng-btn-brief-generate', 'click', function () {
    readBriefForm();
    persist();
    renderStoryTitle();
    sendChatMessage('JSON REQUIRED. Rebuild the page from the updated brief.');
  });

  // preview console relay (message from srcdoc iframe)
  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || typeof d !== 'object' || d.__ng !== true) return;
    addConsoleLine((d.kind === 'err' ? '✖ ' : d.kind === 'warn' ? '⚠ ' : '· ') + d.text, d.kind);
  });

  var chInput = el('ng-chat-input');
  if (chInput) {
    chInput.addEventListener('input', function () {
      chInput.style.height = 'auto';
      chInput.style.height = Math.min(chInput.scrollHeight, 180) + 'px';
    });
  }
}

function updateAllViews() {
  renderStoryTitle();
  updateStoryForm();
  updateCodeView();
  updatePublishView();
  renderChat();
  renderArchetypeBar();
  renderGallery();
  renderToneSliders();
  renderSourceResults();
  renderExtraPrompt();
}

/* ── A6 Tone sliders ── */
function renderToneSliders() {
  var map = { 'ng-tone-lively': 'lively', 'ng-tone-dense': 'dense', 'ng-tone-formal': 'formal' };
  for (var id in map) {
    var inp = el(id);
    if (inp) inp.value = String((DB.tone && DB.tone[map[id]]) || 0);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   BOOTSTRAP
   ═══════════════════════════════════════════════════════════════════ */
function render(v) {
  DB = normalizeDB(v);
  _chat.sessionId = DB.chatSessionId || '';
  if (DB.chatCache && DB.chatCache.sessionId) _chat.sessionId = DB.chatCache.sessionId;
  renderStoryTitle();
  updateStoryForm();
  renderToneSliders();
  renderSourceResults();
  updateCodeView();
  updatePublishView();
  updatePreview();
  renderChat();
  renderExtraPrompt();
  lockUI();
  renderUserChip();
}

tool.onReady(function (val, fields) {
  declare();
  DB = normalizeDB(val);
  _chat.sessionId = DB.chatSessionId || '';
  renderStoryTitle();
  updateStoryForm();
  renderToneSliders();
  renderSourceResults();
  updateCodeView();
  updatePublishView();
  updatePreview();
  renderChat();
  renderExtraPrompt();
  lockUI();
  renderUserChip();

  _readOnly = false;
  try { _readOnly = !!tool.isReadOnly(); } catch (e) {}
  _user = getUserSafe();
  renderUserChip();
  lockUI();
  if (!_user || !_user.roles || !_user.roles.length) scheduleUserPolling();

  // load chat transcript from the shared session type
  loadChatFromServer(function () {});

  wireEvents();

  tool.onValueChange(function (v) {
    if (_saving) return;
    var incoming = JSON.stringify(v);
    if (incoming === _staged) return;   // echo of our own setValue
    if (v == null) { DB = normalizeDB(null); updateAllViews(); updatePreview(); lockUI(); return; }
    DB = normalizeDB(v);
    if (DB.chatCache && DB.chatCache.sessionId && !_chat.sessionId) _chat.sessionId = DB.chatCache.sessionId;
    if (!_chat.messages.length && DB.chatCache && DB.chatCache.messages) {
      _chat.messages = DB.chatCache.messages.map(function (m) { return { role: m.role, text: m.text, time: m.time, isError: m.isError, planInfo: m.planInfo }; });
    }
    updateAllViews();
    updatePreview();
    lockUI();
  });

  tool.onReadonlyChange(function (ro) {
    _readOnly = !!ro;
    lockUI();
  });

  tool.onUserChange(function (u) {
    _user = u || getUserSafe();
    renderUserChip();
    lockUI();
  });

  tool.onFieldsChange(function (f) {
    // the parent record may carry a title we can use when the brief is empty
    if (!DB.brief.title && f && (f.name || f.title)) {
      var t = f.title || f.name;
      if (typeof t === 'string' && t.trim()) {
        DB.brief.title = t.trim();
        if (!DB.brief.slug) DB.brief.slug = slugify(t);
        persist();
        renderStoryTitle();
        updateStoryForm();
      }
    }
  });

  setStatus('Ready — tell the AI Newsroom about the event.', 'good');
});
