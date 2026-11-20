# Studio — the design

Goal: the web interface becomes the place where html tools are **found, seen,
tested, changed by AI and published**, so VS Code is no longer required for
routine work on this repository. Reading and editing code stays available, but
it is not the main way work happens.

This file is the design. `ssot.html` (same folder) §8.12 is the binding rule;
this file explains the reasoning and the phases.

---

## 1. The one fact that shapes everything

A page served by the CMS runs in a **sandboxed iframe**. It can call the object
API and the fetch relay. It cannot read `D:\PROJECTS\...`, list a folder, or
write a file — and it never will, because that sandbox is the platform's
security boundary.

A page served by `npm start` at `http://127.0.0.1:4173` is a normal page talking
to a **Node process running as you**, which has your full disk rights.

So the repository is reachable — but only from the local surface. That produces
the architecture:

| Surface | Address | Can touch | Its job |
| --- | --- | --- | --- |
| **Factory** | `http://127.0.0.1:4173/` | the repository + AI providers | plan, build, validate, diff, review, restart |
| **Studio** | `http://127.0.0.1:4173/studio/` | the repository (read; AI-proposed writes in P2) | browse, preview, read the backlog, chat with AI, run checks, publish |
| **CMS tools** | inside `applicationstore.uniconhub.com` | only the store API | edit one store record: `HtmlToolLibraryItem`, `ApplicationStoreItem` |

One server, one code base, three surfaces, one `config.local.json`, one store
map, one publish ledger. No second source of truth anywhere.

---

## 2. Decisions taken (2026-11-18)

| # | Question | Decision |
| --- | --- | --- |
| 1 | Editor depth | **No code editor.** AI writes the code. Studio shows code read-only, exactly as it does now. |
| 2 | What "Tasks" means | **The tool's own SSOT task list** (section 15) — aggregated, filtered and readable in Studio. Not a shell. |
| 3 | Worker concurrency | **A. serial — one worker.** Parallel stays on the table, off by default; the options are kept in §6 for when the queue has history (D-HTF-52). |
| 4 | Queue home | See §5 — recommended: record is the truth, one-way snapshot in the repo. |
| 5 | Backups | See §7 — recommended: `.studio/backups/` with retention, not `.bak` beside the file. |
| 6 | First VS Code habit to replace | **AI chat → see the result → test it.** Reading and editing code are lower priority but remain. |
| 7 | Tree | **Tool-first**: tool folders are visually distinct (accent colour, bold, left rule, `tool` tag). |
| 8 | Previews | **Every `.html` opens in a preview by default** (including `ssot.html`, `test-harness.html`, documents). Code is one click away. |
| 9 | Layout | **Three columns, one job each:** projects + folder tree (left), chat (middle), results (right: file, tasks, search). Tools and tree live together as two views of the same panel, because the tree is the VS Code habit and the tool cards carry the numbers. |

---

## 3. What exists today (P0, P1, P2 read side)

- `src/workspace.js` — the entire disk side, bounded: paths resolve **inside**
  the repository or are refused before any IO; listings stop at 500 entries,
  reads at 1 MB, search at 200 hits over 3000 files.
- **Read routes**: `GET /api/workspace/tree`, `/file`, `/search`, `/tools`,
  `/tasks`.
- **`/repo/<path>`** — serves a repository file to the preview iframe with its
  real content type, so a document renders with its own CSS, JS and images.
  Jailed to the repository; `config.local.json`, `.env*`, `.git`, `node_modules`,
  `runs`, `selftest-output` and `.vscode` are refused (403).
- **`src/studio/chat.js` + `POST /api/studio/chat`** — the chat context is built
  server side: the tool SSOT (trimmed so its task list survives), the three code
  files, the open file and a focus task, inside `studio.chatContextChars`. The
  answer comes from the configured provider. **Nothing is written.**
- **The page** — three columns: projects + folder tree on the left, chat in the
  middle, file (preview/download/Code/Test/Docs), tasks and search on the right.
  A project selected anywhere is the selected project everywhere.
- **URL state** — `#tool/<path>`, `#file/<path>`, `#tasks/<path>`,
  `#search/<query>`. A refresh reopens the tree, the view and the item.
- **Stale server guard** — the page carries its build, asks the server for its
  own and shows a warning chip when they differ.

That covers: find a project, read its state, see its documents rendered, read
its real backlog, and ask about it with its code and SSOT in context.

---

## 4. Panels

| Panel | Replaces | Content | State |
| --- | --- | --- | --- |
| **Explorer** | the file tree | folders load on demand, tool folders marked and styled; the whole panel is a drawer (one icon to collapse, one to close) | done |
| **Projects** | "which tool am I working on" | the registry as cards: status, package and publish meters, `open` and `tasks`; clicking a card selects the project | done |
| **Registry** | "where is that tool, does it have docs, is it published" | one row per tool, filters, 8-subject meters, `tasks` and `open` actions; the selected project's row is highlighted | done |
| **Preview / Code** | opening a file to look at it | preview first for html (and images, pdf, md, txt), code one click away | done |
| **Tool tabs** | hunting for the html, css, js, harness and seven documents of one tool | opening any file inside a tool selects that project and shows **Code** (HTML / CSS / JS), **Test** (harness) and **Docs** (webpage, help, presentation, updates, social, SSOT, index) built only from files that exist | done |
| **Tasks** | scrolling a 200 KB SSOT to find the backlog | the SSOT task list of the selected project: state, id, title, group, points, priority, filters, counts, and a `chat` button that puts the task into the conversation | done |
| **Chat** | asking an AI in a side window, then pasting code | per-project conversation with the SSOT, the code and the open file in context; answers and plans only | **read side done**, proposals next |
| **Test** | opening the harness manually | run the harness and per-tool checks, show the result next to the preview | P3 |
| **Release** | manual publishing | per tool: plan → confirm → write → read-back, with the ledger beside it | P5 |

---

## 5. Queue home (decision 4) — recommended

| Option | Pros | Cons |
| --- | --- | --- |
| **A. Only in the application record** (today) | one truth; publishes with the app; visible in the CMS | no git history; scripts cannot read it without the store |
| **B. Only a repo file** | history, diffs, scripts | the CMS loses it; two surfaces can disagree |
| **C. Record is the truth + one-way snapshot file** | the CMS stays authoritative *and* every queue change leaves a diffable file | one extra write, and the snapshot must never be read back as truth |

**Recommended: C.** `ApplicationStoreItem.tools[]` stays the truth; Studio
writes `UNICON-TOOLS/tools-catalog/tool-queue-<appSlug>.json` after every change,
marked `"mirror": true`. Workers read the **record**; the file exists for history
and reviewers.

---

## 6. Worker concurrency (decision 3) — serial now

**Decided 2026-11-18: option A, one worker.** `studio.workers` defaults to `1`,
is clamped to 1..8 and can never be `0` (D-HTF-52). The queue executor in P4
starts one tool at a time. Switching to B later is a settings change and a
review of this table, not a rewrite — the per-folder lock and the failure
isolation are required from the first line of the executor, serial or not.

The options stay here so the later change is a comparison, not a guess:

| Option | Throughput | Cost shape | Risk | Best for |
| --- | --- | --- | --- | --- |
| **A. 1 worker (serial)** ← current | baseline | flat and predictable | none new; slow feedback | first real batches, creative builds you want to watch |
| **B. 2–3 workers** | ~2–3× | same per tool, higher per minute | provider rate limits; interleaved logs | the first parallel step |
| **C. 4–8 workers** | 4–8× | highest per minute | rate-limit storms, failure attribution gets hard, machine contention | mechanical jobs only (docs regeneration), never creative builds |
| **D. Adaptive (queue-driven)** | variable | unpredictable | needs a controller and history to tune | last, once there is real throughput data |

Non-negotiable in every option: **one worker per tool folder**, a lock file that
fails loudly if two ever meet, and a failure that stops only its own tool.

**Cost ceiling** (recommended shape, not a number): a per-tool token ceiling and
a batch ceiling = `workers × per-tool ceiling`. A tool that hits its ceiling is
parked with the reason, not killed silently. The number belongs in
`config.local.json` (`studio.workerTokenCeiling`), so it can be tuned without a
code change.

---

## 7. Backups (decision 5) — recommended

| Option | Pros | Cons |
| --- | --- | --- |
| **A. `<file>.bak-<stamp>` beside the file** | obvious, no restore tool needed | pollutes every tool folder; gets scanned, listed and shipped by the repo scripts; breaks the "3 code files" shape |
| **B. `.studio/backups/<tool>/<file>.<stamp>` with retention** | repo stays clean; one retention rule; easy to audit | needs a restore action in Studio and a gitignore entry |

**Recommended: B**, retention 20 per file, `.studio/` gitignored. The rule "no
garbage in the folders" decides it.

---

## 8. The write spine (P2 and later)

Writes now come from **AI proposals**, not from typing. The gate is the one the
factory already uses:

1. the AI (or a task edit) produces a **proposal**: relative path, the hash it
   read, and the new content;
2. a stale hash is refused — two windows can never silently overwrite;
3. the diff is shown and must be confirmed;
4. the old file is copied into `.studio/backups/`, then written;
5. the file is read back and compared; anything else is a failure, never "saved".

No route writes on a single click, no route deletes, no route runs a shell.

---

## 9. Test (P3)

The tool's own harness is the test. Studio already previews `test-harness.html`
with its relative scripts; P3 adds:

- run the harness (`?inlinejs=1` where supported) in a headed iframe and capture
  its log;
- run the per-tool repository checks (syntax, build stamps, docs count) and show
  pass/fail next to the preview;
- keep the last result per tool so the registry can show "last tested".

---

## 10. Parallel auto-development (P4)

The queue (ApplicationStoreItem → Tools tab) becomes the input. Studio:

- takes the queue in order, then `high` priority;
- starts at most `studio.workers` tools (default 2);
- gives each worker its own run directory and lock;
- writes the outcome back into the queue entry (`status`, `notes`/`lastError`);
- never publishes.

---

## 11. Deploy (P5)

Store map as data, dry-run plan, confirm, write, read-back, ledger. Blocked
targets keep their block reason and question id. Nothing is reported published
without a matching read-back.

---

## 12. Security posture (non-negotiable)

- the server binds `127.0.0.1` only;
- single-user machine: no login; if that changes, the first thing added is a
  token, not a user table;
- one path jail (`resolveInsideRepository`) for reads, tasks and previews;
- the preview route denies the token file, `.env*`, `.git`, `runs`,
  `selftest-output`, `node_modules`, `.vscode` — and the text reader denies the
  same names, so a script inside a preview cannot read them either;
- no shell surface at all: commands are declared and run by the server, never
  typed into a browser;
- store keys live outside the repository and never enter a page.

---

## 13. Phases and gates

| Phase | Delivers | Gate |
| --- | --- | --- |
| **P0** ✅ | tree, file, search, tool registry | path jail, caps and registry join proven by the self test |
| **P1** ✅ | preview-first viewer for every html/image/pdf/md, tool-styled tree, SSOT task list per tool | preview serves the real file with relative assets; the token file is 403; the task parser proven on fixtures and on a real SSOT |
| P2 | AI chat per tool with diff proposals | a proposal is refused on a stale hash; a confirmed write leaves a backup and a read-back |
| P3 | test runner (harness + per-tool checks) | a failing harness is visible as a failure, not as "done" |
| P4 | parallel queue executor | two workers never touch one folder; one failure leaves the rest running |
| P5 | release surface | nothing published without a read-back |

---

## 14. Non-goals

- No general purpose IDE: no extensions, no language server, no remote access,
  no terminal.
- No hand code editor: the AI writes, Studio shows and approves.
- It does not replace the CMS record editors.
- It never holds secrets and never listens beyond loopback.
- It never auto-publishes.

---

## 15. Still open

1. Queue home: accept **record + one-way snapshot** (§5)?
2. Backups: accept **`.studio/backups/` with retention 20** (§7)?
3. Token ceiling per tool: what number should `studio.workerTokenCeiling` start at?
4. When to revisit parallel workers: after how many finished queue batches?

---

## 16. Chat sessions on disk

Every conversation is a file in the project it belongs to:

```
<tool>/Chats/<chat-id>.json                 name, model, createdAt, updatedAt, messages[]
<tool>/Chats/attachments/<chat-id>/<file>   uploads, deleted with their chat
```

- A chat is Studio's own artifact, not part of the tool package. This is the one
  place Studio writes, and it never writes outside that folder.
- Several chats can run at once, in one project or across projects: each send is
  its own request, the answer lands in the chat that asked, and switching
  sessions never cancels another one.
- `+` new, `✎` rename, `×` delete (deletes the file and its attachments).
- The session list, the open session and the drawer state survive a refresh.

## 17. Connecting the Unicon AI gateway

The chat uses whatever provider the factory is configured with, and asks for
`studio.chatModel` (default `deepseek-flash`). Point it at the Unicon gateway
with these settings in `config.local.json` (gitignored) or the environment:

| Setting | Environment | Meaning |
| --- | --- | --- |
| `provider` | `APP_FACTORY_PROVIDER` | `unicon-gateway` |
| `uniconGateway.baseUrl` | `APP_FACTORY_GATEWAY_BASE_URL` / `UNICON_AI_GATEWAY_BASE_URL` | gateway origin, **no** `/v1` |
| `uniconGateway.apiKey` | `APP_FACTORY_GATEWAY_API_KEY` / `UNICON_AI_GATEWAY_API_KEY` | the key. It is never typed into the chat and never returned by the API |
| `uniconGateway.tenantHost` | `APP_FACTORY_GATEWAY_TENANT` / `UNICON_AI_GATEWAY_HOST` | tenant header, when the gateway needs one |
| `uniconGateway.defaultProvider` | — | the `provider` field of the request, e.g. `deepseek` |
| `studio.chatModel` | — | the `model` field, default `deepseek-flash` |

What the client already sends (it is the same call the build loop uses):

```
POST {baseUrl}/v1/chat/complete
headers: Content-Type, X-Unicon-Source: html-tool-factory,
         X-Api-Key + Authorization: Bearer (when a key is set),
         X-Unicon-Host (when a tenant is set)
body:    { messages: [{role, content}], provider, model }
answer:  outputText | output_text | text | answer | message | content
         | choices[0].message.content | result.assistant.markdown | result.message
```

The **●** button in the chat header calls `POST /api/studio/chat/ping`, which
sends one minimal message and reports the provider, the model, the latency, or
the exact error. That is the fastest way to prove a gateway setting without
spending a real answer.

### What I still need to know to finish the gateway integration

1. The gateway base URL (is it the same one `scripts/releaseContext.js` uses?).
2. Are the header names above the real ones, or does it expect something else?
3. Is a tenant host header required, and what value?
4. The exact `model` id and the `provider` id the gateway expects for
   `deepseek-flash`.
5. Which response key holds the answer text (we accept several; confirming one
   removes the guessing).
6. Context limit, rate limit, and whether streaming is supported.
7. **Vision**: does the gateway expose an image-capable model, and what is the
   content-part shape for an image? `deepseek-flash` is text only, so a
   screenshot cannot be read by it. Attachments are stored and named in the
   prompt today; reading their pixels needs that model.

## 18. What the chat still cannot do

- Write a file. It explains, plans and shows exact code; applying is the write
  spine (proposal → diff → confirm → backup → read-back) and is the next phase.
- Use tools on its own (read another file, run a check, search the repo). Today
  the **server** decides the context; the model cannot ask for more.
- Read an image. See §17.7.
