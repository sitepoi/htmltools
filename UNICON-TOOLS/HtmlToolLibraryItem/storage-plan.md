# HtmlToolLibraryItem - Multi-Object Storage Plan

Status: PROPOSED - no code changes yet. Prepared 2026-09-25.

Target: applicationstore.uniconhub.com CMS. One tool record = one html-tool
definition. This plan covers where each piece of a tool package lives.

## 1. User requirements (fixed, not negotiable)

| # | Requirement | Where it lands |
|---|---|---|
| 1 | Screenshots upload to CMS storage - only URLs are used, never bytes inside a Firestore document | storage bucket via tool.requestUpload |
| 2 | The code (html/css/js) stays in THIS application | the tool's own record (unchanged from today) |
| 3 | test-harness is NOT uploaded for now | nothing - skipped |
| 4 | webpage, help, updates, presentation are publishable web documents - they go to the WEBSITE app as WebpageBuilder pages (fragment + SEO); social is NOT website content - it goes to its own social application | separate CMS objects, one per doc type |
| 5 | This tool holds and edits everything, but saves content into those related apps/tools | drafts in tool value + explicit push to targets |

Note: index.html and ssot.html stay repo-internal documents (the docs/
folder). They are NOT part of this tool - matches the existing SHIP-CMS-PLAN.

## 2. Storage architecture

```
One tool record (HtmlToolLibraryItem instance)
 +-- tool value (setValue) ............ tool definition + code + doc drafts + shot URLs
 |     (saved back to sibling fields as today)
 +-- CMS storage bucket ............... screenshot files (PNG), referenced by URL only
 |
 +-- Target objects (tool.requestObjects)
      +-- website application page objects (WebpageBuilder shape, fragment + SEO)
      |     webpage doc      ->  data.htmlPage.code.{html,css,js} + seo
      |     help doc         ->  data.htmlPage.code.{html,css,js} + seo
      |     updates doc      ->  data.htmlPage.code.{html,css,js} + seo
      |     presentation doc ->  data.htmlPage.code.{html,css,js} + seo
      +-- social application objects .... structured social content (NOT a page)
      +-- tool-code-versions objects .... code snapshots, max 20 per tool
```

Every target object carries a stable identification so a re-push UPDATES
instead of duplicating:

- name: "<Tool Name> - Webpage" / "... - Help" / etc.
- slug: "<toolSlug>-webpage" / "<toolSlug>-help" / ... (same convention the
  SHIP-CMS-PLAN proposes)
- the tool stores the returned object id in its value per doc after the
  first successful push; later pushes use requestObjects('update').

## 3. What the tool's own value holds (new shape)

Current draft (definition + code) plus:

- draft.docs = {
    webpage:      { html, css, js, seo, updatedAt },
    help:         { html, css, js, seo, updatedAt },
    updates:      { html, css, js, seo, updatedAt },
    presentation: { html, css, js, seo, updatedAt },
    social:       { contentHtml, updatedAt }
  }
- draft.docs.<key>.target = { objectType, objectId, name, slug, pushedAt,
  pushedSignature } - filled after each push; dirty = pushedSignature
  differs from current content signature.
- draft.shots = [ { id, name, url, size, uploadedAt } ] - metadata only,
  never file bytes.

Drafts live in the tool value so work survives reloads and the dirty flag
is computable. Size check against the measured report: code 182-292 KB +
5 doc drafts about 50-60 KB + shot metadata negligible = about 240-350 KB,
23-33% of the 1 MB limit. Safe. A live size meter (warn 800 KB / block
950 KB) goes in regardless.

## 4. Target object shapes (exact payloads)

### 4a. Publishable docs (webpage, help, updates, presentation) - WebpageBuilder objects

The website app is `website-builder-uniconbaseapps` and its objects carry ONE
html-tool field named `webpageContentWithBuilder` whose value is EXACTLY the
saved value of the WebpageBuilder tool (verified read-only from its code - the
`_slimValue()` shape). The tool writes that field:

{
  webpageContentWithBuilder: {
    code: { html: "...", css: "...", js: "..." },
    seo: { metaTitle: "...", metaDesc: "..." },
    pageMeta: {
      name: "Personal Tax Preparation - Webpage",
      slug: "personal-tax-preparation-webpage",
      meta: { language: "en" },
      data: { status: "published" }
    },
    version: "1.0.0",
    activeSessionId: "",
    chatCache: { sessionId: "", messages: [] }
  }
}

- ALL FOUR are body FRAGMENTS: no <!DOCTYPE>, <html>, <head> or <body>;
  the whole content sits under ONE root <div> with a unique class.
  css scoped, js idempotent - WebpageBuilder's PAGE GENERATOR RULES apply.
- ALL FOUR carry SEO data: the editors get SEO inputs (metaTitle,
  metaDesc, metaKeywords, metaRobots, ogTitle, ogDesc, ogImage) and the
  push writes them into the seo object inside the builder value.
- Slugs: <toolSlug>-webpage / <toolSlug>-help / <toolSlug>-updates /
  <toolSlug>-presentation (also stored in pageMeta.slug for lookup).
- The FOLDER to write into is the tool record's OWN leaf folder: the CMS
  hierarchy is imported from folder-hierarchy-import.json (never edited
  manually) and every tool record sits in its leaf subcategory. The tool
  reads its own folder id from the object document (typeId) and creates
  every document + version snapshot in that SAME leaf folder
  (requestObjects create with typeId; queries scoped by typeId).
  Param docsFolderTypeId overrides the folder when needed. The folder
  placement strategy for the website-builder app is under discussion -
  see cms-apps-todo.md section 7.
- create: requestObjects('create', { mainObjectType, name, productData:
  { data_categoriesBased: { webpageContentWithBuilder: <value above> } } }).
- update: requestObjects('update', { mainObjectType, objectId,
  productData: { data_categoriesBased: { same partial field } } }).
- Pull: requestObjects('get') -> parse the webpageContentWithBuilder value
  into the editor.

### 4b. social - its own application, NOT a page

Social content is prepared for social media integrations (WhatsApp, X,
LinkedIn, Instagram, Facebook) and is NOT website-publishable content:

productData.data_categoriesBased = {
  name: "<Tool Name> - Social",
  slug: "<toolSlug>-social",
  toolSlug: "<toolSlug>",
  platform: "whatsapp | x | linkedin | instagram | facebook",
  message: "...", linkUrl: "...", imageUrl: "<screenshot storage URL>",
  hashtags: "...", status: "ready", postedAt: "", updatedAt: "<iso>",
  contentHtml: "<full internal share-kit document>"
}

### 4c. Code version backups - separate object type, max 20 per tool

Every Push creates ONE version object in a SEPARATE cmsObjectType (never
inside the tool's own 1 MB object):

{
  name: "<Tool Name> - v12",
  slug: "<toolSlug>-v12",
  toolSlug: "<toolSlug>",
  versionNumber: 12,
  htmlCode: "...", cssCode: "...", jsCode: "...",
  note: "what changed",
  pushedAt: "<iso>", pushedBy: "<userId/name>"
}

- After each push: query versions of this toolSlug, keep the NEWEST 20,
  delete the rest (auto-prune).
- Return to version: load a snapshot into the code editors; the next push
  creates a new version (history is never rewritten).

## 5. Tool parameters (new)

- allowObjectCRUD is a CMS field setting, not a param - the tool guards
  every requestObjects call with typeof checks and reports status.
- New params (all optional severity, empty = that target is not configured
  yet and its tab works standalone):
  - pageTargetType          - website app page object type (used by
                              webpage, help, updates, presentation)
  - pageTargetFieldMap      - JSON override for the page dcb field id,
                              default: { "webpageContentWithBuilder":
                              "webpageContentWithBuilder" }
  - socialTargetType        - social app object type
  - socialTargetFieldMap    - JSON override for the social dcb field ids
  - versionsTargetType      - code version object type
  - pageStatus              - "published" | "draft" for page targets
  - docLanguage             - meta.language for page targets (default "en")
- CMS field settings the admin must set:
  settings.allowObjectCRUD: 'yes'
  settings.allowedObjectTypes: [
    { mainObjectType: "<website page type>", role: 'editor', scope: 'shared', targetCollection: 'public' },
    { mainObjectType: "<social type>",       role: 'editor', scope: 'shared', targetCollection: 'public' },
    { mainObjectType: "<versions type>",     role: 'editor', scope: 'shared', targetCollection: 'public' }
  ]
  settings.allowUpload: 'yes'   (for screenshots)

## 6. Decisions made (2026-09-23, user answers)

1. FRAGMENT FORM everywhere publishable: webpage, help, updates and
   presentation are all fragments - no html/head/body tags, everything
   under ONE root <div>.
2. The WEBSITE app (WebpageBuilder) hosts EVERY publishable web document:
   webpage, help, monthly updates, presentation - each with SEO data.
3. SOCIAL is not a website page - it gets its own application; social
   media integrations come later.
4. Code versioning: push updates the tool record in place AND snapshots
   the code into a separate cmsObjectType (tool-code-versions); return to
   any older version; auto-delete everything older than the newest 20.
5. Auto generation + auto push from the repo: the repo docs pipeline
   (docs:generate) produces the content and the push goes through the
   configured targets - the CMS applications must be created first
   (cms-apps-todo.md). Repo-to-CMS auto-push needs the CMS import API.

Still open: exact object type strings + field ids (the user will provide
per application - cms-apps-todo.md section 5) and the import API for
repo auto-push.

## 7. Build phases

- Phase 1 - Docs tab: 5 sub-tabs (Webpage / Help / Updates / Presentation /
  Social). The 4 publishable docs are fragment editors (html under one
  root div / css / js) with SEO inputs and a WebpageBuilder-style preview
  shell; social uses a full-document editor. Drafts persisted in tool
  value + normalize migration + size meter. No CMS calls yet.
- Phase 2 - Push/Pull: target config params, query existing by slug,
  create-or-update logic, per-doc status line (object id, pushed time,
  dirty flag), Pull (load target content back into the editor), two-step
  confirm before overwriting a target that changed elsewhere, diagnostics
  logging in the existing debug panel.
- Phase 3 - Code versions: on Push, snapshot code into the versions type,
  auto-prune to newest 20, "Return to version" loads a snapshot into the
  code editors.
- Phase 4 - Screenshots: upload via requestUpload('image/*'), shots list
  (name/url/size/time), copy URL, "Insert into doc", per-shot usedIn hints.
  Never any base64 - URLs only.
- Phase 5 (later, if wanted): test-harness field - skipped for now per
  requirement 3.

## 8. Guardrails

- Screenshots: only file.url strings are persisted anywhere. No base64.
- The ONLY delete calls allowed are the version prune (versions-type
  objects older than the newest 20). Target docs/pages/social objects are
  never deleted from this tool.
- Pushes never touch the tool's own record fields except the tool value
  (the existing auto-commit stays exactly as today).
- The existing diagnostics panel logs every requestObjects call
  (action, type, objectId, ok/error) so CMS-side issues stay debuggable.
