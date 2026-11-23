# AI Vision Picture Finder - Gateway and CMS requirements

Purpose: let an html-tool send document page images to the AI gateway and get back the exact
rectangles of the pictures on the page. The tool then crops those rectangles from the page it has
already rendered. This removes every layout dependency of the current pixel/vector detection
(photos without borders, pictures inside text columns, collages, scans, charts, screenshots).

Status: the tool cannot do this today. `tool.requestAI(prompt, context)` is text-only - no image
input, no vision model, no `allowVision` setting. `tool.requestGenerateImage` only generates images.

---

## 1. What the gateway must be able to do

One vision request answers: "here is one rendered page image, return the bounding boxes of all
pictures on it".

Requirements:

- Accept 1 to 4 images per request (page images, JPEG or PNG, as data URLs or storage URLs).
- Accept a text prompt and return text; optionally return parsed JSON (structured output).
- Vision-capable model, able to follow a strict JSON-only instruction.
- Per request: max 2048 px on the long side, max 8 MB decoded image, 120 s timeout.
- Deterministic output format (see section 4), so the tool can parse it without guessing.

Recommended models (any vision model works; pick by cost/accuracy):

| Use | Model | Note |
| --- | --- | --- |
| Default, high volume | gpt-4o-mini / gemini-2.5-flash | cheap, good at large pictures |
| Hard layouts, small figures | gpt-4o / claude-sonnet-4.5 / gemini-2.5-pro | better at small diagrams, overlapping text |

---

## 2. CMS relay to expose to html-tools (recommended shape)

New field setting: `allowVision: 'yes'` (same pattern as `allowAi`, `allowOcr`, `allowPdfRender`).

New SDK method:

```js
tool.requestVision({
  prompt: 'string, required',
  images: [
    { dataUrl: 'data:image/jpeg;base64,...', detail: 'low' | 'high' }   // 1..4 items
  ],
  jsonSchema: { /* optional JSON schema for the response */ },
  maxTokens: 2000,                 // optional
  model: 'gpt-4o-mini'             // optional, gateway default otherwise
}, function (error, result) {
  // error  : null on success, otherwise a short string code + message
  // result : { text: string, json: object | null, model: string, usage: {...} }
})
```

Rules:

- Image input may also be a CMS storage URL (`{ url: 'https://...' }`) - the gateway fetches it
  server-side. Data URLs are simpler and keep the flow client-driven.
- 1 concurrent request per tool frame (same queue behaviour as `requestAI`), 120 s timeout.
- If the model does not support native structured output, the gateway must still fill `json` by
  parsing the model text (and fail with `invalid_json` when it cannot).
- Never log image payloads. Log only: tenant, tool id, model, token usage, duration, error code.
- Per-tenant rate limit and a monthly image budget (a page image call is one request).

Error codes to return in `error`:

`not_configured` (allowVision off), `no_images`, `image_too_large`, `unsupported_image_type`,
`model_unavailable`, `rate_limited`, `timeout`, `invalid_json`, `provider_error`.

---

## 3. Optional server-side endpoint (alternative shape)

If you prefer not to change the html-tool SDK, expose an HTTP endpoint and a thin relay:

```
POST /api/ai/vision/find-pictures
Authorization: Bearer <tool JWT>
Content-Type: application/json

{
  "prompt": "...",                          // optional, default = the prompt in section 4
  "images": [ { "dataUrl": "data:image/jpeg;base64,...", "page": 1 } ],
  "jsonSchema": { ... },
  "model": "gpt-4o-mini"
}

200 OK
{
  "results": [
    {
      "page": 1,
      "pictures": [
        { "box": [0.12, 0.35, 0.46, 0.28], "kind": "photo", "label": "horse in a field", "confidence": 0.93 }
      ]
    }
  ],
  "model": "gpt-4o-mini",
  "usage": { "inputTokens": 1200, "outputTokens": 180 }
}
```

`box` is `[x, y, width, height]` in normalized coordinates, origin top-left, relative to the whole
page image (0..1). The tool multiplies by the rendered page size, so no pixel size is needed.

A server-side `POST /api/ai/vision/find-pictures-pdf` variant (`{ pdfUrl, pages: "1-40" }`) is
optional. It must render pages with pdfium/poppler at 150 DPI and then return the same per-page
boxes. It needs the server to be able to fetch the PDF URL (the same restriction the file mirror
already has). Client-side page images are cheaper and avoid that dependency.

---

## 4. Prompt to send to the vision model (use verbatim)

System message:

```
You are a precise image-region detector for document pages. You only answer with JSON.
```

User message (the tool passes the page image with this text):

```
Look at this page and find every PICTURE on it.

A PICTURE is: a photo, illustration, drawing, cartoon, diagram, flowchart, chart, graph, map,
screenshot, or a scanned image. Include the picture's own labels, legend, axis text and caption
that belong to it. Include pictures that are partly cut by the page edge.

Do NOT return: paragraphs, headings, bullet lists, tables made of text, formulas, page numbers,
headers/footers, page borders, background colours or patterns, horizontal rules, or empty space.

Rules:
- Return a tight box around the FULL visible picture. Never cut into the picture.
- If a picture is made of several parts that clearly belong together (image + its legend, a
  collage, a figure with sub-figures a/b/c), return ONE box that contains all of them.
- Do not merge two separate pictures into one box.
- If several pictures touch each other, return separate boxes whenever a gap is visible.
- If the page is a single full-page scan, return exactly one box: [0, 0, 1, 1].
- Box coordinates are normalized 0..1 with the origin at the TOP-LEFT: [x, y, width, height].
- Do not invent pictures. If there is no picture, return an empty list.
- Confidence is 0..1. Use below 0.5 when unsure.

Answer with JSON only, no markdown, no comments:
{"pictures":[{"box":[0.12,0.35,0.46,0.28],"kind":"photo|illustration|diagram|chart|map|screenshot|scan","label":"short description","confidence":0.93}]}
```

JSON schema for `jsonSchema`:

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["pictures"],
  "properties": {
    "pictures": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["box", "kind", "confidence"],
        "properties": {
          "box": {
            "type": "array",
            "minItems": 4,
            "maxItems": 4,
            "items": { "type": "number", "minimum": 0, "maximum": 1 }
          },
          "kind": { "type": "string", "enum": ["photo", "illustration", "diagram", "chart", "map", "screenshot", "scan"] },
          "label": { "type": "string" },
          "confidence": { "type": "number", "minimum": 0, "maximum": 1 }
        }
      }
    }
  }
}
```

Validation the gateway should apply before returning:

- Drop boxes with `width < 0.02` or `height < 0.02` (tiny noise).
- Clamp boxes to 0..1 and fix negative width/height.
- Drop boxes with `confidence < 0.35` unless no other box was returned.
- Drop a box that contains more than 85% of the page only if another box also exists (it is
  usually the page background).
- Merge two boxes when the intersection over union is above 0.85.
- Return an empty list (not an error) when the model found nothing.

---

## 5. Cost and speed guidance

- Send the page at 150 DPI (about 1240 x 1750 px for A4) and JPEG quality 0.8. That is enough for
  a vision model and keeps each call small.
- Two-pass option: first pass with `detail: "low"` (cheap) for pages that clearly have a large
  picture; second pass with `detail: "high"` only for pages where the first pass returned nothing
  or a box that looks wrong.
- Batch up to 4 pages per request and ask for `{"pages":[{"page":1,"pictures":[...]}, ...]}` to cut
  request count by 4. Keep one page per request when accuracy matters most.
- Cache by `documentUrl + pageNumber + pageImageHash` in the lesson document, so pressing
  "Get Pictures" again costs nothing.
- A 50 page PDF with pictures on 20 pages is about 20 requests at 150 DPI.

## 6. Privacy and security

- The page image contains the document content - treat it like the document itself. No logging,
  no retention beyond the request, no provider training opt-in.
- Strip EXIF and any embedded metadata before sending.
- Keep the existing CSP model: the thumbnail page image never leaves the browser except through
  this relay; no direct third-party calls from the tool.

## 7. How the tool will use it (implementation on my side)

1. Render each page once with PDF.js (already done for preview and for the vector analyser).
2. Send the page JPEG to `tool.requestVision` with the prompt in section 4.
3. Crop every returned box from the rendered page, add a 3 px margin, and save it as a gallery
   picture (same pipeline as today, so upload/roles/generated versions keep working).
4. Merge with the current structural results (PDF image objects + vector regions):
   - a structural box that overlaps an AI box is dropped (the AI box wins, it is never cut);
   - a structural box that does not overlap any AI box is kept (the AI may miss a small figure);
   - AI boxes that overlap each other above 0.85 are merged.
5. On any vision error, fall back to the current structural capture and show the error code in the
   status line, never a dead end.

## 8. Acceptance test the gateway must pass

Give it a page with: one photo without a border, one chart with axis labels, one two-column text
block, one table of text, one small logo, and one picture touching the page edge.

Expected: photo, chart (including axis labels), edge picture and logo are returned as separate
boxes; the two text columns and the table are not returned; no box cuts into a picture.
