# Feature Request: Multi-Tenant Public Website (publicwebsite)

Use this document as the prompt for the CMS AI. Everything below is one
feature: the publicwebsite application collects content from MANY
tenants, MANY applications and MANY folders through configured API
calls, then renders the assembled pages.

## 1. Purpose

Replace the old generalwebsite with the new publicwebsite platform.
publicwebsite is a content AGGREGATOR and RENDERER:

- It does not own any content. It reads content from other tenants,
  applications and folders through a configured public read API.
- All data about tools and applications - their web contents included -
  stays together in the applicationstore.uniconhub.com tenant.
- General website pages (non-tool pages) keep coming from
  cms.uniconhub.com.
- The rendered site is served at www.uniconhub.com.

## 2. Core capability

publicwebsite reaches many tenants, many applications (cmsObjectType)
and many folders (om_object_types) based on per-source API call
configurations. Each configured source answers three questions:

1. WHERE to read: tenant + public API base URL + service token.
2. WHAT to read: application (mainObjectType) + folder ids + filters.
3. HOW to render: fragment-page (verbatim html/css/js body) or
   collection (structured fields into listing/category/detail pages).

## 3. Content-source registry (required, config-driven)

publicwebsite stores a registry of content sources. Adding a new tenant,
application or folder must be a CONFIGURATION change, never a code
change. Registry entry schema:

{
  "id": "tool-webpages",
  "label": "Tool webpages (applicationstore)",
  "enabled": true,
  "tenant": {
    "name": "applicationstore",
    "publicApiBaseUrl": "https://applicationstore.uniconhub.com/api/public"
  },
  "auth": {
    "type": "serviceToken",
    "tokenId": "pw-read-appstore-toolpages"
  },
  "source": {
    "mainObjectType": "<website page type>",
    "folderIds": ["tool-pages-root"],
    "recursive": true,
    "filters": { "status": "published" }
  },
  "mapping": {
    "slugField": "slug",
    "statusField": "status",
    "titleField": "name",
    "bodyField": "webpageContentWithBuilder",
    "rendererKind": "fragment-page",
    "listTemplateId": "tool-page-list",
    "detailTemplateId": "fragment-shell"
  },
  "cache": { "ttlSeconds": 300 },
  "updatedAt": "2026-09-24"
}

Rules:

- One entry per (tenant, mainObjectType, folder set) combination.
- Multiple entries may point at the same tenant.
- Entries may point at different tenants at the same time - this is the
  multi-tenant capability.
- The same renderer kinds apply everywhere: fragment-page for objects
  whose body field carries html/css/js (the webpageContentWithBuilder
  saved-value contract), collection for structured data rendered through
  listing, category and detail templates.

## 4. Public read API (required, per tenant)

Every tenant that publicwebsite may consume exposes a read-only public
API:

GET {publicApiBaseUrl}/objects
  query params: mainObjectType, typeId (repeatable), status,
  q (text search), sort, page, limit (max 200), fields (projection)
  response: { items: [ ... ], total, page, hasMore, cursor }

GET {publicApiBaseUrl}/objects/{objectId}
  query params: mainObjectType, fields
  response: the object with its fields under a stable shape

Requirements:

- Serves ONLY objects from the table om_objects. The table
  om_private_objects is NEVER served by this API - not in listings, not
  by id, not through any fallback or projection. This is an absolute
  security rule.
- Authentication: per-source service token with viewer (read-only)
  scope. A token grants access to exactly the registered sources it was
  created for, nothing else.
- CORS: allows the publicwebsite origin (and www.uniconhub.com) only.
- Pagination is cursor-based and stable while new objects are published.
- Every response includes the objects' typeId and mainObjectType so the
  website can route renderer decisions.
- Rate limiting and per-token request logging are required.

## 5. Routing and slug resolution (required)

- publicwebsite resolves a URL (for example /tools/brand-set-generator)
  to one registered source and one object using the slug field defined
  in the source mapping.
- When the same slug exists in two sources, resolution order is the
  registry order; source entries are ordered by priority.
- Collection sources support category pages: a URL like
  /products/{category} maps to a folder (typeId) within the source and
  renders the collection template for that folder.

## 6. Rendering (required)

- fragment-page: the site shell (header/nav/footer, design tokens)
  comes from the publicwebsite platform itself. The object's body field
  is emitted as the page content body - the body is a FRAGMENT: one
  root div, scoped css, idempotent js, no html/head/body tags. The
  object's seo fields fill the page head (metaTitle, metaDesc,
  metaKeywords, metaRobots, ogTitle, ogDesc, ogImage).
- collection: listing template = paginated cards from the source
  filters; category template = grouped by folder; detail template =
  field layout per source mapping. Product/blog apps use this kind.
- Status handling: only objects whose status field equals the source
  filter (published) are rendered. A 404 page is served for unpublished
  or missing slugs.

## 7. Source management UI (required)

Inside the publicwebsite application, an admin-only screen lets the
team:

- Add / edit / disable / remove registry entries.
- Test connection: run the configured query against the tenant API and
  show the first results or the exact error.
- View per-source health: last success, object count, error message.
- Clear the cache of one source.

All changes take effect without redeploying the website.

## 8. Caching and performance (required)

- Per-source TTL from the registry entry (default 300 seconds).
- Cache keyed by source id + query params.
- Optional but recommended: a publish webhook per tenant
  (POST {tenantPublicApiBaseUrl}/hooks/publish with the object id) that
  invalidates the affected source cache entries so published pages
  appear immediately.

## 9. What does NOT change

- Tool writes stay tenant-scoped. No html-tool ever writes objects to
  another tenant. HtmlToolLibraryItem and WebpageBuilder keep writing
  inside the applicationstore tenant.
- All tools, applications and their web contents stay together in
  applicationstore.uniconhub.com - one tenant of record for the tool
  ecosystem.
- cms.uniconhub.com keeps serving the general (non-tool) webpages as a
  configured source; no data is copied or moved.
- om_private_objects stays private forever. Raw tool code, chat
  sessions, version snapshots and internal records are never reachable
  through this feature.

## 10. Example configurations (what we will register on day one)

1. Tool pages
   - tenant: applicationstore.uniconhub.com
   - mainObjectType: <website page type> (website-builder application)
   - folderIds: "tool pages" root, recursive
   - rendererKind: fragment-page
   - bodyField: webpageContentWithBuilder
   - filters: status = published
2. General website pages
   - tenant: cms.uniconhub.com
   - mainObjectType: <website page type of that tenant>
   - folderIds: the general pages folders
   - rendererKind: fragment-page
3. Products (future)
   - tenant: applicationstore.uniconhub.com
   - mainObjectType: <products type>
   - rendererKind: collection
4. Blog posts (future)
   - tenant: applicationstore.uniconhub.com
   - mainObjectType: <blog type>
   - rendererKind: collection

## 11. Acceptance criteria

1. A page published in the applicationstore tenant appears on
   www.uniconhub.com under its slug within the cache TTL, without any
   code deployment.
2. A page published in cms.uniconhub.com appears on www.uniconhub.com
   under its slug the same way - both tenants serve the same site at
   the same time.
3. Adding a third tenant requires only a new registry entry plus a
   service token - no code change.
4. Requesting an object id that belongs to om_private_objects returns
   404 in every tenant, for every endpoint, under every projection.
5. A service token created for the tool-pages source cannot read any
   other object type, folder or tenant.
6. Disabling a source removes its pages from the site immediately
   (404 for its slugs).
7. A slug collision between two sources resolves by registry order, and
   the losing source's page stays reachable under its tenant-prefixed
   fallback path.

## 12. Questions for the CMS team to answer while implementing

1. What is the exact service token mechanism (token per source, per
   tenant, expiry, rotation)?
2. What query operators does the public API support (filters: equals,
   in, text search)? Is that enough for category and listing pages?
3. Does the publish webhook exist or should cache invalidation rely on
   TTL only for now?
4. Response size limits and field projection rules for the API.
