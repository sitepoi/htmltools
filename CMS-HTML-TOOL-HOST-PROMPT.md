# PROMPT - Html Tool host component: support separate HTML / CSS / JS files

Paste everything below this line into the agent or developer working on the
UniconHub CMS Html Tool host component.

---

## Mission

Update the **Html Tool host component** (Tool Builder + runtime renderer) so a
tool is stored and served as **three independent, versioned files** - one HTML
body file, one CSS file, one JS file - instead of one record that is
concatenated and inlined at render time.

The three-file authoring model is the contract the tools are already built
against. The host must support it explicitly, atomically and with per-file
versioning, validation and error attribution.

---

## 1. How the system works today (verified behaviour, do not break)

1. One html-tool = one tool definition with three code blocks:
   `[HTML]` (body fragment), `[CSS]`, `[JS]`.
2. At render time the host wraps the three blocks into a full HTML page inside
   a sandboxed iframe and **inlines** them: CSS into `<style>`, JS into
   `<script>`. The `window.tool` SDK is injected **before** the tool JS runs.
3. Tool JS must not use `DOMContentLoaded` / `window.onload`; it starts from
   `tool.onReady(...)`. Any change to injection order breaks every tool.
4. Tools may not reference external hosts (`<script src>`, `<link>`, fetches).
   Everything arrives through the parent CMS (`requestObjects`,
   `requestFileBinary`, AI relays, ...).
5. Authors keep exactly three files (`<Tool>.html`, `<Tool>.css`, `<Tool>.js`)
   and re-upload only the file that changed.
6. Every file starts with a per-file build stamp comment, and the JS carries
   the single `TOOL_BUILD` value:

   ```html
   <!-- html build 2026-10-04-1 -->
   ```
   ```css
   /* css build 2026-10-04-1 */
   ```
   ```js
   /* js build 2026-10-04-1 */
   var TOOL_BUILD = '2026-10-04-1';
   ```

   These stamps are currently the ONLY way to prove which file version the
   CMS is serving.
7. A build must print `[TOOL:BOOT] build <TOOL_BUILD> ...` as its first
   console line.

`window.tool` SDK surface, iframe sandboxing, the parent-CMS-only network rule
and the three files themselves must all stay unchanged.

---

## 2. Why the current single-record / inline model fails

These are real production failures, not hypotheticals:

1. **The HTML tokenizer executes inside inline JS.** A raw `</script>`
   anywhere in the JS - even inside a string or a comment - closes the script
   element. The whole tool dies with a generic `Uncaught SyntaxError`, the UI
   still renders (HTML + CSS are fine), no boot line appears, and there is no
   indication which file caused it.
   *Incident 1:* a compliance regex containing `/^<!-- v[\d.]+/` put the
   tokenizer into escaped state and killed WebpageBuilder for days.
   *Incident 2:* the text `</script` inside two JS comments terminated the
   inline script immediately (2026-10-10).
2. **Unclosed `<!--` corrupts everything after it.** A later literal
   `<script` moves the tokenizer into double-escaped state where `</script>`
   is treated as text.
3. **CSS has the same class of bug.** `</style>` inside a CSS string or
   comment closes the style element and the rest of the stylesheet becomes
   page text.
4. **No per-file identity.** All three files live in one record, so a JS-only
   fix rewrites the whole record. There is no way to diff, version, roll back
   or lock one file independently, and two authors editing different files
   collide.
5. **No atomic publish.** A half-saved record can serve new JS with old HTML
   or old CSS. Nothing prevents mixing files from two builds.
6. **No error attribution.** A syntax error is reported against the assembled
   page, never against `app.js:1234`, so the author cannot tell which file is
   stale or broken.
7. **No cache correctness.** Because files are inlined into the page, there is
   nothing to cache by content hash, and "is the CMS serving my latest JS?"
   is answered only by reading the build stamp in the Tool Builder.
8. **Separate file objects are not supported at all today.** Uploading or
   storing HTML, CSS and JS as separate objects has no defined linkage, no
   defined load order, no manifest and no runtime assembly.

### 2.1 - Verify the gap in five minutes

Run these checks against the current host code before changing anything; each
one should show the missing piece:

1. Search the renderer for `srcdoc` / string concatenation of the three
   blocks. If the only path builds one string, separate file objects cannot
   work.
2. Search for any manifest/link record connecting three code objects. If the
   three blocks exist only as fields of one record, there is no linkage.
3. Check what an update to one block writes. If it rewrites the whole record,
   a JS-only fix can carry stale HTML/CSS and two editors can overwrite each
   other.
4. Check the reported error for a deliberate syntax error in the JS block. If
   it points at a line in the assembled page rather than in the file, error
   attribution is missing.
5. Check whether the CSS is injected with `innerHTML`/`<style>` string
   concatenation. If yes, `</style>` in a comment breaks the page.

---

## 3. Required behaviour

### R1 - Data model: one manifest + three file objects

- `html-tool-manifest` (one per tool): pointer to the **live build**, the
  draft build, the tool identity and permissions. Small, hot, never holds
  code.
- `html-tool-file` (one per file per build): `toolId`, `buildId`, `kind`
  (`html` | `css` | `js`), `content`, `byteLength`, `sha256`, `mimeType`,
  `stamp` (first-line build stamp), `updatedAt`, `updatedBy`.
- A file object is immutable once its build is published. Publishing creates
  **new file objects for all three kinds** (unchanged ones may be referenced
  by copy, never mutated in place).
- File objects live in the same library folder as the tool manifest (same
  `typeId`), so folder-based library browsing, roles and permissions keep
  working unchanged. This also answers the open question in
  `SHIP-CMS-PLAN.md` ("separate objects or one object with three fields?") in
  favour of separate file objects plus a manifest.
- Optional: keep the current three-field shape as a **compatibility view**
  for old tools; it must be generated from the manifest, never edited
  directly once migrated.

### R2 - Rendering: serve files as same-origin immutable assets

Default rendering must **not inline**:

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="/t/{toolId}/{buildId}/app.css">
</head>
<body>
  <!-- tool HTML body fragment goes here -->
  <script src="/t/{toolId}/{buildId}/sdk.js"></script>
  <script src="/t/{toolId}/{buildId}/app.js" defer></script>
</body>
</html>
```

- `{buildId}` must contain the content hash (or be derived from all three
  hashes) so a build is immutable and cacheable forever.
- Serve with `Cache-Control: public, max-age=31536000, immutable` and the
  manifest with `no-store`.
- Correct `Content-Type` and `X-Content-Type-Options: nosniff`.
- CSP for the iframe: `script-src 'self'`, `style-src 'self' 'unsafe-inline'`
  only if tool styles require it, `connect-src 'none'`, `frame-src` per
  existing rules.
- The SDK script tag must precede the tool JS tag, always.

### R3 - Assembly order is guaranteed by the host

The host guarantees, for every build:

1. CSS is applied before first paint (blocking `<link>` in `<head>`).
2. `window.tool` (and every injected helper the field enables) exists before
   `app.js` executes.
3. `app.js` executes once, after the DOM body fragment is parsed.
4. No other script runs between the SDK and the tool JS.

The host must not depend on authors adding `defer`, IIFEs or load listeners.

### R4 - Safe inline mode (only for the legacy/compat path)

If a tool still has to be inlined (for example a preview inside the Tool
Builder), the renderer MUST:

- replace `</script` with `<\/script` and escape `<!--` as `\u003C!--` in JS;
- replace `</style` with `<\/style` in CSS;
- escape `</textarea`, `</title` and other tokenizer-sensitive sequences;
- never rely on comments as protection - comments do NOT protect against the
  tokenizer;
- show a warning naming the exact file and line that needed escaping.

### R5 - Validation before save and before publish

The Tool Builder must validate all three files and refuse to publish a build
that fails:

| Check | html | css | js |
| --- | --- | --- | --- |
| Balanced markup / braces | yes | yes | yes |
| Raw `</script` sequence | yes (inline script) | - | hard error |
| Unclosed `<!--` | yes | - | hard error |
| Raw `</style` | - | hard error | - |
| External `<script src>` / `<link href>` | hard error | hard error | - |
| `new Function()` / parser syntax check | - | - | hard error |
| First-line build stamp present | warn | warn | error |
| `TOOL_BUILD` defined in JS | - | - | error |

Every validation message must identify **file + line + column** in terms of
the author's file, not the assembled page.

### R6 - Atomic publish, rollback, no mixed builds

- "Publish" creates one new `buildId` from exactly three file hashes and
  switches the manifest pointer in a single write.
- A partially uploaded build is never live.
- The previous N builds (default 20) stay readable.
- "Roll back to build X" is one click and switches all three files together.
- The Tool Builder must show the **live build id** and, per file, whether the
  live file hash equals the draft file hash.

### R7 - Per-file editing and upload

- Three separate editors, each bound to its own file object.
- Per-file save state (saved / unsaved / saving / error) and per-file
  "replace file" upload.
- Replacing the JS alone must not touch the HTML or CSS file objects,
  versions or hashes.
- Show the first-line stamp of each file in the editor header and in the
  file list, plus a mismatch badge when the live stamp differs from the
  draft stamp.
- Never silently repair, trim or re-indent file content.

### R8 - Runtime error attribution

- Install a first script (before `app.js`) that captures `window.onerror`
  and `unhandledrejection` and maps the stack to the file served for that
  build.
- Show "app.js line 1234" instead of "page line 18911".
- If a file fails to load (404, CSP, MIME), show an explicit host-level error
  naming the missing file and the build id - do not leave a blank iframe.
- Expose the loaded file versions for debugging, for example
  `window.tool.files = { html: '<sha>', css: '<sha>', js: '<sha>', build: '<buildId>' }`.
  This is additive; existing SDK keys must not change.

### R9 - Migration (mandatory, non-destructive)

1. Read every existing tool definition with the three code fields.
2. Create `html-tool-file` objects for the three blocks and one manifest
   pointing at a new build id.
3. Keep the old fields untouched and read-only as a backup until the tool has
   loaded successfully from the new files at least once.
4. Provide a dry-run report: tool id, byte sizes, stamps, detected tokenizer
   hazards, and which tools will fail validation.
5. Old inline rendering stays available behind a per-tool flag during the
   transition.

### R10 - Compatibility

- Every existing tool must render identically after migration.
- `window.tool` API, `tool.onReady` semantics, iframe permissions, field
  parameters and the parent-only network rule are unchanged.
- Old tools with only the three legacy fields keep working (inline fallback
  or on-the-fly asset generation).

### R11 - Security and limits

- Assets are readable only inside the tenant; write access follows the
  tool-edit permission.
- Per-file size limits (suggest 2 MB per file, 4 MB per build) with a clear
  error, not a silent truncation.
- Reject non-text MIME types and binary content.
- Never execute a file whose hash does not match the manifest.

---

## 4. Acceptance criteria (host-level tests)

1. **Separate objects load**: a tool whose three blocks are stored as three
   file objects renders, boots (`[TOOL:BOOT]`), and exposes
   `window.tool.files` with all three hashes.
2. **JS-only update**: replacing only the JS object and publishing changes
   the served `app.js` hash, leaves `app.html` / `app.css` hashes unchanged,
   and the browser gets the new JS without a hard refresh.
3. **Atomic publish**: publishing with one file upload missing leaves the
   previous build live and reports the missing file.
4. **Tokenizer safety**: a JS file containing the literal `</script>` inside
   a string either fails validation at publish time (default) or is escaped
   correctly in inline mode - it never produces a dead tool with no message.
5. **Error attribution**: a deliberate `SyntaxError` on line 40 of `app.js`
   is reported as `app.js:40`, not as a page line.
6. **CSS isolation**: a CSS file containing `</style>` in a comment is
   rejected or escaped; the rest of the stylesheet and page text stay intact.
7. **Rollback**: rolling back to the previous build serves the exact three
   file hashes of that build.
8. **Legacy**: a pre-migration tool renders unchanged through the fallback
   path.
9. **Build stamps**: the Tool Builder shows the per-file stamps, and a
   mismatch between the live stamp and the draft stamp is visible per file.
10. **No mixed builds**: the three served files always come from the same
    `buildId`.

---

## 5. Out of scope

- Changing the tool authoring rules (three files, build stamps, SDK usage).
- Moving tool data or AI calls to new channels.
- A public CDN for tool assets.
- Any change to the `window.tool` SDK surface.

---

## 6. Definition of done

- Data model, renderer, Tool Builder editors, validation, atomic publish,
  rollback and migration shipped behind a feature flag.
- Migration dry-run report reviewed for every existing tool.
- The 10 acceptance tests above exist as automated host tests.
- The rendering contract is documented for tool authors (file names, load
  order, asset URLs, per-file stamps, what the host validates).

---

## 7. Short version (if only one paragraph is read)

The Html Tool system must stop treating a tool as one blob of HTML + CSS + JS
that is concatenated and inlined at render time. Store the three files as
separate, immutable, versioned objects behind one small manifest; serve them
as same-origin, content-hashed assets with the SDK guaranteed to load before
the tool JS; validate each file on save and publish; publish and roll back all
three files atomically; and report runtime errors against the author's file
and line. Until that exists, every JS or CSS edit is an all-or-nothing rewrite
of one record, and a single `</script>` or `</style>` in the wrong place
silently kills the whole tool with no usable diagnostic.
