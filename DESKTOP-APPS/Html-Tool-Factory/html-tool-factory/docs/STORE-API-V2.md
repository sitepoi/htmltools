# Store API v2 - contract extract

The write contract the release engine will use (SSOT `14.2`, `14.3`, D-HTF-54).
Source: `PROJECTS/UNICONHUB/CODE/sitepoicms/_docs/rules/desktop-first-party-api-v2-integration.html`
(updated 2026-11-18). That document is the authority; this file is the subset the
factory needs, copied so the rules can be checked without leaving the repository.

Nothing here is assumed. Where the source is silent it says so, and the matching
question id is named.

## 1. Base

```
https://<tenant-host>/api/v2
```

The store host is `applicationstore.uniconhub.com` (`store-map.json` `meta.host`).
The tenant is resolved from the request **host**. There is no tenant header, so a
credential for one host is useless against another.

First-party service tokens are **v2 only**. v1 does not accept them.

## 2. Credentials

| Model | Header | Notes |
| --- | --- | --- |
| Managed tenant API key | `x-api-key` | Small or headless tool without a backend. This is what the read side of this factory already uses. |
| First-party service token | `x-unicon-service-token` | Compact JWT, `ES256` or `RS256`, verified against the enrolled public key for `kid` + `alg`. |

Service token claims: `iss` (must equal the enrolled app issuer, no trailing
slash), `aud` (`uniconhub-cms-api` by default), `sub` (`service:<appId>`), `app`,
`tenantId` (must match the host tenant), optional `deploymentId`, `iat`, `exp`,
`jti` (fresh random per attempt, max 256 chars).

Rules that bite:

- `exp - iat` must not exceed `maxTokenAgeSeconds` (default 300, max 900). Use
  60 to 300 seconds.
- A replayed `jti` on the same instance returns `REPLAYED_SERVICE_TOKEN`. Never
  reuse a token after a failure.
- Disabling an app or removing a key takes effect within the 30 second config
  cache.
- The private key for a service token must **never** live in a desktop bundle.
  That is why a local tool uses the managed key (Q-38).

## 3. Endpoints

| Method | Path | Scope | Permission |
| --- | --- | --- | --- |
| GET | `/objects/{cmsObjectType}` | `objects:read` | viewer |
| POST | `/objects/{cmsObjectType}` | `objects:write` | editor |
| GET | `/objects/{cmsObjectType}/{objectId}` | `objects:read` | viewer |
| PATCH | `/objects/{cmsObjectType}/{objectId}` | `objects:write` | editor |
| PUT | `/objects/{cmsObjectType}/{objectId}` | `objects:write` | editor |
| POST | `/objects/{cmsObjectType}/query` | `objects:read` | viewer |
| POST | `/objects/{cmsObjectType}/bulk` | `objects:bulk-upsert` | editor |
| GET | `/health` | none | none |

`{cmsObjectType}` is the id from `cms-settings.objectTypes`. It is not a folder
id, a field group id or a display name.

Not available to a service token: delete, bulk delete, API key lookups, usage,
object type or field group management, media.

## 4. Envelope

```json
{ "success": true, "...": "endpoint-specific fields" }
```

```json
{ "success": false, "error": { "code": "OBJECT_TYPE_NOT_ALLOWED", "message": "...", "details": null } }
```

## 5. Create

```
POST /api/v2/objects/{cmsObjectType}
x-api-key: <managed key>            (or x-unicon-service-token: <jwt>)
Idempotency-Key: <unique per create attempt>
Content-Type: application/json
```

```json
{
  "object": {
    "name": "Order 1234 - Jane Doe",
    "typeId": "<folder-document-id>",
    "slug": "order-1234-jane-doe",
    "categories": ["<category-id>"],
    "productData": { "data_categoriesBased": { "order_number": "1234" } },
    "meta": { "language": "en", "status": "enabled" }
  }
}
```

Rules:

- `object.name` is required and must be a non-empty string. A number, object,
  `null`, `undefined` or an empty string is 400 `MISSING_NAME`.
- `typeId` is the **folder document id**, not the object type id. Send it on
  every create, or the object is unfiled and easy to lose.
- `productData.data_categoriesBased` must have **exactly one layer**. Field ids
  must match the folder's field groups.
- Do not send `id` or `_id` unless a client-supplied id is deliberate.
- `Idempotency-Key` is strongly recommended: a retry with the same key returns
  the stored original result instead of a duplicate.
- Never send `x-unicon-write-source: public-website`. That enables the public
  website sanitizer and is only for the published website relay.

`201` returns `{ success, mainObjectType, object: { id, name, cmsObjectType, typeId, productData, version } }`.

## 6. Update

```
PATCH /api/v2/objects/{cmsObjectType}/{objectId}
If-Match: <current-version>
```

```json
{ "object": { "productData": { "data_categoriesBased": { "order_status": "confirmed" } } } }
```

- `PATCH` **merges** over the current object. `PUT` replaces the top-level
  content while keeping `id` and `cmsObjectType` fixed.
- The write is compare-and-swap on `version`. Send the base as `If-Match` or as
  `body.version`. A **missing** base is 409 `CAS_CONFLICT` and never writes. A
  **stale** base is 409 `CAS_CONFLICT` with `details.serverVersion`. Re-read, then
  retry with the new version - never with the old one.
- This is why the engine patches instead of replacing (D-HTF-51) and why a
  conflict is a stop, not a retry loop (Q-40).

## 7. Query and bulk

```
POST /api/v2/objects/{cmsObjectType}/query
{ "queryItems": [ { "field": "productData.data_categoriesBased.order_number", "operator": "==", "value": "1234" } ], "limit": 50 }
```

Operators: `==`, `!=`, `<`, `<=`, `>`, `>=`, `array-contains`, `in`,
`array-contains-any`, `not-in`. At most one `in`-family operator per query.

```
POST /api/v2/objects/{cmsObjectType}/bulk
{ "upserts": [ { "object": { } } ], "deletes": [] }
```

Maximum 500 operations. Service tokens may upsert but may never send `deletes`.

## 8. Limits and errors

Response headers: `x-ratelimit-limit-minute`, `x-ratelimit-remaining-minute`,
`x-quota-limit-month`, `x-quota-remaining-month`.

`429 RATE_LIMIT_EXCEEDED` is per minute per instance, `429 MONTHLY_QUOTA_EXCEEDED`
is the monthly quota. Honour `Retry-After` when present, otherwise back off
exponentially and never tight-loop.

| Status | Code | Action |
| --- | --- | --- |
| 400 | `MISSING_NAME` | Send a non-empty string `object.name` |
| 400 | `INVALID_BODY` | Body must have `object` |
| 401 | `MISSING_SERVICE_TOKEN` | Add the credential header |
| 401 | `INVALID_SERVICE_TOKEN` | Check `details.reason` |
| 401 | `SERVICE_NOT_CONFIGURED` | App missing, disabled or invalid for the tenant |
| 401 | `REPLAYED_SERVICE_TOKEN` | Mint a new token with a new `jti` |
| 403 | `OBJECT_TYPE_NOT_ALLOWED` | Add the exact `cmsObjectType` to app permissions |
| 403 | `PERMISSION_DENIED` | Raise the permission to `editor` for writes |
| 403 | `PRIVATE_OBJECT_TYPE_BLOCKED` | Enable `allowPrivateAccess` on the app |
| 403 | `FOLDER_NOT_ALLOWED` | Use a folder id from the app allowlist |
| 404 | `OBJECT_TYPE_NOT_FOUND` | The type id is not in `cms-settings.objectTypes` |
| 409 | `CAS_CONFLICT` | Re-read the object, retry with the new version |
| 429 | `RATE_LIMIT_EXCEEDED` | Back off |
| 429 | `MONTHLY_QUOTA_EXCEEDED` | Stop until the quota resets |
| 500 | `OBJECT_CREATE_FAILED` | Inspect the server message |

## 9. What this contract does not answer

These stay open in SSOT `14.2` and still block a write:

- **Q-35** the store object export (folders and objects with id, type, name,
  slug, version) that the id matching needs.
- **Q-43** whether a first create may supply `id` equal to the slug, or the store
  generates it and the export must be refreshed first.
- **Q-36** which field holds the display name and the slug on a
  `tools-applicationstore` record.
- **Q-37** whether `toolHtmlCode`, `toolCssCode`, `toolJsCode` sit inside
  `productData.data_categoriesBased` or as siblings.
- **Q-38** which credential the factory uses for writes, and whether the managed
  key is accepted in `x-api-key` for `POST` and `PATCH` as it is for reads.
- **Q-09 / Q-10** the folder `typeId` per record type.
- **Q-39** whether documents publish in the same click (update modes 2 and 3).
- **Q-40** the conflict policy on `CAS_CONFLICT`.
- **Q-41** whether the export or list exposes `version` per object.
- **Q-42** what the ledger stores as proof of a write.
- **Q-27** where screenshots upload, given that service tokens cannot reach media.
