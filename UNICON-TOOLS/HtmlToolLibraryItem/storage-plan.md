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
      +-- tool-code-versions-uniconbaseapps objects .... code snapshots, max 20 per tool
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
- FOLDER PLACEMENT (2026-10-26, user-confirmed): folders are per
  application and NOT shared across apps, so the record's own leaf folder
  (tools-applicationstore) must NOT be used for page documents. Page docs
  use the docsFolderTypeMap param - defaults: webpage/updates/presentation
  -> www.uniconhub.com, help -> help.uniconhub.com. A key
  with no map entry falls back to the single docsFolderTypeId override,
  then to the target app's default folder. Version snapshots keep using
  the record's own leaf folder (typeId) unless overridden.
  RE-HOME: each doc target remembers the folder it was created in
  (target.folderTypeId). When the configured folder changes, the next
  Save creates the document in the new folder and deletes the old object
  (logged in the Logs tab). See cms-apps-todo.md section 7 for the
  placement history.
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
  - pageStatus              - optional; empty = the CMS Publish action owns the page status
  - docLanguage             - meta.language for page targets (default "en")
- CMS field settings the admin must set:
  settings.allowObjectCRUD: 'yes'
  settings.allowedObjectTypes: [
    { mainObjectType: "website-builder-uniconbaseapps", role: 'editor', scope: 'shared', targetCollection: 'public' },
    { mainObjectType: "tool-social-content-uniconbaseapps",       role: 'editor', scope: 'shared', targetCollection: 'public' },
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
   the code into a separate cmsObjectType (tool-code-versions-uniconbaseapps); return to
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

## 9. V2 - Documents FULLY external (2026-10-26, pending user go-ahead)

User decision: tool code can approach 1 MB, so NO document content may
live in the tool record. Every document must be its own Firestore
document in another cmsObjectType. This section replaces the "drafts in
tool value" part of sections 2 and 3.

### 9.1 New storage model

Tool record value (the ONLY 1 MB budget for code):
  { version, draft: { toolName, toolIcon, ..., toolHtmlCode, toolCssCode,
    toolJsCode, toolParams, toolOutputSchema, ..., toolCategories,
    toolTags, shots (URL metadata only),
    docs: {
      webpage:      { target: {objectType, objectId, slug, pushedAt, pushedSignature} },
      help:         { target: ... },
      updates:      { target: ... },
      presentation: { target: ... },
      social:       { target: ... }
    } } }
  NO html/css/js/seo/contentHtml for docs anymore. Only the small
  target reference per doc.

Separate Firestore documents (one object each, each with its own 1 MB):
  - webpage      -> website-builder page object (website-builder-uniconbaseapps)
  - help         -> website-builder page object
  - updates      -> website-builder page object
  - presentation -> website-builder page object
  - social       -> social object (tool-social-content-uniconbaseapps)
  - code snapshots -> versions objects (already separate, newest 20)

### 9.2 Editor behavior

- Doc content is IN-MEMORY only (module variable). It is loaded from
  the target object when the doc tab opens (one get), edited in memory,
  and written back by Save (create on first save, update afterwards).
- Save = the existing push flow (create/update + external-change arm
  guard). Buttons renamed: "Save document" and "Reload from object".
- Doc status chip: "New - not saved yet" / "Saved <time>" /
  "modified - not saved" / "object changed outside".
- Unsaved edits are NOT persisted anywhere until Save (no draft buffer
  in the record - that is the whole point). A dirty flag warns on doc
  switch and unload.
- Preview + SEO inputs keep working from memory.

### 9.3 Size meter

Now measures code + metadata only. Documents no longer affect the
record budget; each doc can grow toward its own 1 MB object.

### 9.4 Migration of existing records (one-time, in normalize)

- Doc has a target and content equals pushedSignature: content is
  already in the object - drop it from the record value on next save.
- Doc has a target and content differs: keep it as the in-memory
  "modified" state until Save (writes object) or Reload (discards),
  then drop from the value.
- Doc has no target: keep content until the first Save creates the
  object, then drop it.
After one Save per doc the record shrinks to code + metadata only.

### 9.5 Verification plan

- Smoke suite rewrite for the doc flows (load-from-object, save creates,
  save updates, external-change arm, no doc content in setValue).
- Harness: seed the 5 doc objects in the object store; the sample value
  carries only targets.
- node --check, htl-check, headless screenshots of the Docs tab.

### 9.6 Open decisions (answer before implementation)

1. No draft buffer at all (strict) - typing a doc and reloading before
   Save loses it. OK?
2. Rename Push/Pull to Save/Reload - OK?
3. Auto-load the doc from its object when the doc tab opens - OK?
