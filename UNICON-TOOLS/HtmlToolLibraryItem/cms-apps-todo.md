# CMS Applications To-Do - applicationstore.uniconhub.com

Goal: the CMS-side work needed so HtmlToolLibraryItem (plus the repo's
automated document generation) can manage a complete tool package:
code, publishable documents with SEO, social content, screenshots and
code version backups.

Prepared 2026-09-23. Companion documents: storage-plan.md (storage design),
size-report.html (1 MB budget proof), SHIP-CMS-PLAN.md (root).

## 0. Blockers - CMS team (answer these first)

- B1 Repo auto-push needs an import/upsert API: REST endpoint with a
  service token, create-or-update BY SLUG. Alternative: the Ship Console
  app approach from SHIP-CMS-PLAN section 2.5. Until this exists, the
  repo side only EMITS payloads and HtmlToolLibraryItem pushes them from
  inside the CMS with one click per doc.
- B2 Confirm tool.requestUpload works from the tools application and
  returns permanent public storage URLs for screenshots.
- B3 Confirm a tool in tools-applicationstore can create/update objects
  of the WEBSITE application's page type and of the new types below
  (allowedObjectTypes with editor role, shared scope).
- B4 Public website integration (see section 8): confirm the CMS can
  register any application's object types as read-only content sources
  served from om_objects over a public API - and guarantees that
  om_private_objects is NEVER exposed by that API.

## 1. Tool Library application (tools-applicationstore - EXISTS, extend)

- T1 Update HtmlToolLibraryItem (this tool) - per storage-plan.md phases:
  - Docs tab with 5 sub-tabs: Webpage / Help / Updates / Presentation /
    Social. The 4 publishable docs are FRAGMENT editors (html under one
    root div / css / js) with SEO inputs; social is its own content type.
  - Push/Pull per doc to the configured targets (create on first push,
    update afterwards, status line with object id + pushed time + dirty).
  - Code versioning: every push also snapshots the code into the
    versions type below; auto-prune to the newest 20; Return to Version
    loads an old snapshot back into the editors.
  - Screenshots tab: upload, list (name/url/size/time), copy URL,
    Insert into doc (img with the storage URL at the cursor).
  - Live size meter (warn 800 KB, block 950 KB).
- T2 Create object type `tool-code-versions` in tools-applicationstore
  (exact fields in section 4).
- T3 Set the HtmlToolLibraryItem field settings:
  - allowObjectCRUD: 'yes'
  - allowUpload: 'yes'
  - allowedObjectTypes:
    { mainObjectType: "<website page type>", role: 'editor', scope: 'shared', targetCollection: 'public' }
    { mainObjectType: "<social content type>", role: 'editor', scope: 'shared', targetCollection: 'public' }
    { mainObjectType: "tool-code-versions", role: 'editor', scope: 'shared', targetCollection: 'public' }
- T4 (later) AppStoreItem update: every tool card links to its published
  pages (webpage / help / updates / presentation) and shows social status.

## 2. Website application (website-builder-uniconbaseapps - EXISTS - configure)

- W1 The object type (folder) where tool pages live: the FULL taxonomy
  hierarchy from folder-hierarchy-import.json is imported and used as-is
  (no manual folders ever). Each tool record lives in its leaf
  subcategory folder; HtmlToolLibraryItem creates every document in the
  SAME leaf folder (reads the record's typeId, overridable via the
  docsFolderTypeId param).
- W2 Field contract (confirmed by the user): every object carries the
  html-tool field `webpageContentWithBuilder` whose value is the saved
  value of the WebpageBuilder tool ({ code:{html,css,js}, seo, pageMeta,
  version, activeSessionId, chatCache } - WebpageBuilder _slimValue shape).
  HtmlToolLibraryItem writes exactly that field.
- W3 Help documents: OPEN QUESTION - same app in another folder (generic
  publishable pages) vs a custom help application (see section 7).
- W4 Reserved slugs per tool: <toolSlug>-webpage, <toolSlug>-help,
  <toolSlug>-updates, <toolSlug>-presentation (in pageMeta.slug).
- W5 SEO contract: metaTitle, metaDesc, metaKeywords, metaRobots, ogTitle,
  ogDesc, ogImage inside the seo object of the builder value.
- W6 Content contract (WebpageBuilder PAGE GENERATOR RULES): body fragment
  under ONE root <div>, no html/head/body tags, scoped css, idempotent js.

## 3. Social application (NEW - create)

- S1 Create the application (suggested name: "Tool Social").
- S2 Create object type `social-content` (exact fields in section 4).
- S3 (later) social media connectors (WhatsApp, X, LinkedIn, Instagram,
  Facebook) consume objects with status "ready" and write postedAt when
  published. No website page involved.
- S4 (later) an html-listing-tool to browse social content per tool.

## 4. New object type fields (exact lists for the CMS team)

tool-code-versions (inside tools-applicationstore):
  toolSlug (text), toolName (text), versionNumber (number),
  htmlCode (text), cssCode (text), jsCode (text), note (text),
  pushedAt (text), pushedBy (text)
  Usage: ONE object per push; the tool keeps the newest 20 per toolSlug
  and deletes the rest. The tool's own 1 MB object never holds history.

social-content (inside the Social application):
  name (text), slug (text), toolSlug (text),
  platform (select: whatsapp | x | linkedin | instagram | facebook),
  message (text), linkUrl (text), imageUrl (text), hashtags (text),
  status (text: ready | posted), postedAt (text), updatedAt (text),
  contentHtml (text - the internal share kit document)

## 5. Parameters the user will provide (fill when available)

- Website page: mainObjectType + real field ids (name, slug, meta,
  status, htmlPage, seo) + folder/typeId for tool pages.
- Social: mainObjectType + real field ids + folder/typeId.
- Versions: mainObjectType (or confirm "tool-code-versions") + field ids
  + folder/typeId.
- Per type: role / scope / targetCollection entries for
  allowedObjectTypes.
- Default page status: published or draft.

## 6. Repo side (after the applications exist)

- R1 generate-docs: emit the 4 publishable docs as FRAGMENTS (one root
  div) plus a SEO sidecar; social as structured per-platform content.
- R2 ship-cms.js: emit page-object payloads (name/slug/meta/data/seo) and
  version snapshot payloads into the ship-out manifest.
- R3 Wire the auto-push once blocker B1 (import API) is resolved.
- R4 Screenshots: uploaded via the import API or tool.requestUpload -
  only storage URLs ever land in documents or objects.

## 7. Document folder placement - DECISION LOG

- Option c (shared hierarchy across apps): REJECTED by the CMS - sharing
  folders across applications is not possible without new features with
  too many side effects.
- Option a (one hierarchy copy per doc type): rejected - about 880 extra
  folders and 4x maintenance.
- Option b (ONE hierarchy copy under a single root in
  website-builder-uniconbaseapps, leaf holds all 5 docs of every tool):
  CHOSEN (2026-09-24).
- Option d (all documents as separate object types + html-tools INSIDE
  tools-applicationstore, same leaf folder as the tool record): REJECTED
  under the current platform. Resolved by splitting the question into
  READS and WRITES:
  - Cross-app READ: the public website consumes any app's objects
    read-only (section 8) - rendering is NOT the blocker.
  - Cross-app WRITE: stays allowlisted per tool (editor role). The
    webpage docs must remain editable by WebpageBuilder, which lives in
    website-builder-uniconbaseapps - so the docs stay there (b). Moving
    to d would require cross-app writes for WebpageBuilder; if that ever
    exists, d becomes a config/data move, no rebuild.
  - Non-publishable items (social, versions) already follow the d
    pattern in the current plan.
- FINAL RULE (2026-09-24): data lives in its owning app with its own
  editor (products, blog, tools); the public website consumes it
  READ-ONLY through content-source registration (section 8). Webpage
  documents stay in website-builder-uniconbaseapps (option b) because
  their editor is WebpageBuilder.

All publishable documents live in website-builder-uniconbaseapps. Where
inside its folder tree: under one root folder (e.g. "tool pages") that
contains ONE copy of the taxonomy; each copied leaf holds the 5
documents of every tool in that leaf. Per-type listings filter by the
slug suffix convention (<toolSlug>-webpage/-help/...).

## 8. Public website integration - NEW CMS feature (confirmed 2026-09-24)

The public website project must communicate with ANY application's
cmsObjectType, not just website-builder-uniconbaseapps. Model: a
content-source registry (config, not code) - one entry per source:

  { application, objectType (cmsObjectType), folder(s), status field,
    slug field, renderer kind }

Renderer kinds:
- fragment-page: object carries html/css/js (webpageContentWithBuilder
  contract) - the site emits it nearly verbatim (webpages, help,
  updates, presentation).
- collection: structured fields - the site builds dynamic listing,
  category and detail pages (products, blog, and future apps).

CMS-side requirements:
- P1 Objects saved in the table om_objects are the ONLY publishable
  objects. The CMS exposes a public read API that serves om_objects for
  registered content sources (read-only, public scope, queryable from
  the live site - not only inside a tool iframe).
- P2 The public website never WRITES to source apps; writes stay
  allowlisted per tool with editor role as today (HtmlToolLibraryItem
  pushing webpage docs is the configured exception).
- P3 SECURITY RULE - ABSOLUTE: the table om_private_objects is never
  published. The public API must never serve om_private_objects the way
  it serves om_objects - not in listings, not by id, not via any
  fallback. Private objects stay tool/app internal only.
- P4 No data copies: products, blog and other apps stay in their own
  apps; the website reads them in place (same principle that rejected
  the folder-copy options).

## 9. CMS DATA MODEL - the full picture (2026-09-24)

One source of truth for everything an html-tool owns: its code, its
documents and its published presence. Three applications, five object
types, two tables.

### 9.1 Applications (cmsObjectType = mainObjectType namespace)

- tools-applicationstore (EXISTS): the store. Owns tool records, code
  snapshots and published listing cards. Nothing here is a web page.
- website-builder-uniconbaseapps (EXISTS): owns every publishable page
  object (tool webpages, help, updates, presentation - alongside the
  user-built pages from WebpageBuilder). The only app whose objects the
  public website renders as fragment pages.
- Tool Social (NEW, name suggested): owns social content objects that
  the posting connectors consume.

### 9.2 Object types (exact list)

| mainObjectType | app | table | folder (om_object_types) | purpose |
| --- | --- | --- | --- | --- |
| html-tool-library-item-uniconbaseapps | tools-applicationstore | om_private_objects | taxonomy leaf (the tool's own leaf) | ONE record per tool: code (html/css/js), doc drafts, screenshot URLs, schema, targets |
| tool-code-versions | tools-applicationstore | om_private_objects | single "code versions" folder | ONE object per push; newest 20 per tool |
| tool-published-listing | tools-applicationstore | om_objects | single "published listings" folder | ONE card per PUBLISHED tool for the public site catalog: name, slug, shortDesc, tags, screenshotUrl, page links, version, publishedAt (NO code) - optional until the public site shows a tools catalog |
| <website page type> | website-builder-uniconbaseapps | om_objects | tool-pages root > taxonomy copy > leaf | FOUR objects per tool: webpage / help / updates / presentation - each carrying webpageContentWithBuilder |
| social-content | Tool Social | om_private_objects (until the site shows feeds) | single "social content" folder | per-platform posts (whatsapp / x / linkedin / instagram / facebook), status ready-posted |

Platform-owned types already used by tools stay as they are
(ai-chat-sessions-uniconbaseapps, webpagebuilder-history-uniconbaseapps)
and belong in om_private_objects.

### 9.3 Table split rule (confirmed 2026-09-24)

- om_objects = content the PUBLIC WEBSITE serves through the public API.
  The CMS may publish these (fragment-page and collection sources).
  Current members: <website page type>, tool-published-listing.
- om_private_objects = everything else (raw code, snapshots, chats,
  social until needed). The public API must NEVER serve this table.
- The STORE UI (applicationstore.uniconhub.com) shows private tool
  records because the store platform reads its own database directly -
  platform-internal reading is NOT the same as public API publishing.
- Code protection: raw code never reaches om_objects. The public site
  shows screenshots, descriptions and links only.

### 9.4 Folders (om_object_types)

    tools-applicationstore
      <imported taxonomy from folder-hierarchy-import.json>
        leaf subcategory (one per tool)  -> the tool record
      code versions                      -> tool-code-versions objects
      published listings                 -> tool-published-listing objects

    website-builder-uniconbaseapps
      tool pages                         (single root)
        <one copy of the taxonomy>
          leaf subcategory               -> 4 doc objects per tool

    Tool Social
      social content                     -> social-content objects (filter by toolSlug)

Rules: taxonomy folders are created ONLY by importing
folder-hierarchy-import.json (the CMS rule). code versions / published
listings / social content are single fixed folders, NOT taxonomy copies.

### 9.5 Object counts per leaf folder

- tools-applicationstore leaf: 1 object (the record). Snapshots and
  listing cards live OUTSIDE the taxonomy so leaf counts stay small.
- website-builder leaf: 4 objects per tool (webpage / help / updates /
  presentation). With the slug suffix convention (<toolSlug>-webpage,
  -help, -updates, -presentation) plus a docKind field, listings filter
  per type without extra folders.

### 9.6 Access matrix (who may read or write each type)

| actor | type | role | scope |
| --- | --- | --- | --- |
| HtmlToolLibraryItem | html-tool-library-item | instance (own record) | - |
| HtmlToolLibraryItem | <website page type> | editor | shared, targetCollection public |
| HtmlToolLibraryItem | tool-code-versions | editor | shared |
| HtmlToolLibraryItem | tool-published-listing | editor | shared, public |
| HtmlToolLibraryItem | social-content | editor | shared |
| WebpageBuilder | <website page type> | editor (own app) | - |
| public website | <website page type> + registered collections | viewer (READ ONLY) | public |
| social connectors | social-content | viewer/editor | internal |
| store UI | everything in tools-applicationstore | platform | internal |

### 9.7 Doc object contract (add to the <website page type> field list)

name (text), slug (text - also mirrored in pageMeta.slug), status
(draft | published), docKind (webpage | help | updates | presentation),
sourceToolSlug (text), updatedAt (text), webpageContentWithBuilder
(html-tool field - the WebpageBuilder _slimValue shape), seo object
(metaTitle, metaDesc, metaKeywords, metaRobots, ogTitle, ogDesc,
ogImage), publishAt (text, optional).

Reserved slugs per tool: <toolSlug>-webpage, <toolSlug>-help,
<toolSlug>-updates, <toolSlug>-presentation.

### 9.8 Why this shape

- One tool = one record in its taxonomy leaf (the CMS rule "one tool =
  one folder" holds). Everything the tool needs to edit lives in that
  record; nothing else is stored in the leaf.
- Code stays private forever: records and snapshots are
  om_private_objects; only marketing fields reach om_objects via
  tool-published-listing.
- Documents are website-builder objects (option b from section 7), so
  WebpageBuilder can open any tool page without cross-app writes, and
  the public website renders them through the same content-source
  registry as any other app (section 8).
- Social and versions already follow the per-type pattern; they are not
  pages and never enter the taxonomy or the public API.
