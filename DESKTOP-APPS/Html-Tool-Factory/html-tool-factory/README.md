# HTML Tool Factory

An autonomous html tool builder: it picks an idea, writes the SSOT, reviews and
answers its own risks, builds the tool, tests it, invents the next improvements,
and repeats. Local desktop app, zero dependencies, plain JavaScript.

It builds **html tools** - the three file format this repository uses everywhere
(`html-tool-rules.txt`), not generic apps. The tool is written straight into the
real repository folder that the ideas catalog points at.

The single source of truth for decisions, tasks and open questions is
`docs/ssot.html`. Read it before changing anything, and update it in the same change.

## The idea list

Ideas come from **`UNICON-TOOLS/tools-catalog/tool-ideas-catalog.json`** and that file is the
idea SSOT: every idea has a taxonomy code in `folder` (for example `B-G-01-a`), an id
(`B-G-01-a-4` for later ideas in the same subcategory), market data and licensing.
When a run finishes, the factory writes a `development` block onto that one idea
(status, tool folder, run id, iterations, tasks done, checks passed) and leaves every
other entry untouched. Disable it with `catalog.writeBack: false` or
`APP_FACTORY_CATALOG_WRITEBACK=no`.

Note: in this repository `npm run catalog:build` regenerates that JSON from
`catalog-data.js`, so a rebuild replaces the `development` blocks.

## What one run produces

The deliverable goes to the repository folder that the idea's taxonomy code names:

```
BUSINESS/<GENERAL|VERTICAL>/<category-slug>/<subcategory-slug>/<Tool>/
  app/<Tool>.html        body markup only, first line <!-- html build YYYY-MM-DD-N -->
  app/<Tool>.css         rules only,      first line /* css build YYYY-MM-DD-N */
  app/<Tool>.js          logic only,      first line /* js build YYYY-MM-DD-N */
  app/test-harness.html  local preview with a mock tool SDK (requestAI included)
  docs/ssot.html         standard SSOT from _docs/templates
  docs/index.html webpage.html help.html presentation.html updates.html social.html
```

`<Tool>` is the PascalCase idea name, for example `ContractClauseFinder`, with a short
class prefix like `ccf-`. The folder chain comes from
`UNICON-TOOLS/tools-catalog/folder-hierarchy-import.json`; an idea with `folder: B-G-01-a`
becomes `BUSINESS/GENERAL/ai-automation/ai-chat-assistants/<Tool>`.

The run folder keeps only the run state:

```
runs/<runId>/
  run.json        status, idea, counters, the resolved target
  ssot.json       the living specification (machine readable)
  events.jsonl    append only event stream
  .backup/        pre-patch copies, plus catalog backups
```

Set `target.mode: "run"` in `config.local.json` if you want the tool written inside the
run folder instead (useful for experiments and for the self test).

The html tool contract is enforced, not suggested: a task that answers with
`app/index.html`, `app/src/**`, `.jsx`, `.tsx`, `.ts`, a CDN link, `localStorage`,
`fetch`, `alert` or a `<script>` tag inside the tool html is rejected before a single
byte is written. Every file needs its build stamp line, and the tool script needs
`var TOOL_BUILD`, the `[TOOL:BOOT]` log line and a `tool.onReady` entry point.

The standard documentation is produced by the repository generator
(`node scripts/init-docs.js --tool <Tool>`), never by a private layout. The factory only
fills the SSOT sections it owns (task list, ideas, risks, build record) between
`<!-- AF:TASKS:START -->` style markers, so the rest of the file stays hand editable.

The loop:

1. **Select idea** - reads `UNICON-TOOLS/tools-catalog/tool-ideas-catalog.json`, matches the
   requested idea (or takes the first unbuilt one), names the tool, resolves its folder
   from the taxonomy, and creates the three contract files, the test harness and the
   seven standard documents.
2. **Research and write the SSOT** - one AI call, reviewing how the best products in
   the industry handle the problem.
3. Repeat until the iteration budget is spent:
   - **3a Plan the task list** in the SSOT (bounded batch, de-duplicated)
   - **3b Review the SSOT** and define risks and real open questions
   - **3c Solve them** with common sense and security defaults; anything left open is
     closed with its recorded assumption so the loop cannot stall
   - **3d Apply the tasks** as atomic patches, validated after every task
   - **3e Test the application** with deterministic checks (no AI, no cost)
   - **3e2 Usability and persona review** - is it understandable, what is redundant,
     what can be removed, and where does a persona get stuck
   - **3f Create new ideas**, promote the two strongest, close the iteration

### The usability review, every iteration

| Question | What the stage produces |
| --- | --- |
| How can it be more understandable and easier to use? | `understandability` findings naming the exact control |
| What is redundant and not necessary? | `redundant` findings |
| What can be removed to simplify it? | `removable` findings that name what to delete |
| Where does a persona get stuck? | a persona, up to three scenarios with per step observations, `unclear-step` findings |

The stage writes its own follow up tasks. A high severity finding without a task gets one
created deterministically, so a real problem cannot be reported and then ignored.

## Why the generated tool is deep

An interactive coding session feels more capable because it has four things a
naive pipeline does not. Each one is now built in.

| Lever | Interactive session | This factory |
| --- | --- | --- |
| Context | reads the repo rules, sibling tools, docs conventions before writing | `src/knowledge/contextPack.js` injects `html-tool-rules.txt`, `PUBLISH-CHECKLIST.md` and the lessons of earlier runs into the research and planning prompts |
| Definition of done | keeps going until the whole job works | a 10 item depth checklist is seeded per tool; every open item becomes a task, and the run is not finished while one is open |
| Throughput | writes many files in one turn | 5 tasks per iteration, 5 iterations, 3 attempts per task, 2 retries per blocked task (all configurable) |
| Feedback | sees real errors and fixes them | blocked tasks return to the queue instead of being parked, and the failure text is stored as a lesson for the next run |

A run that stops with work left is now reported as **paused**, with the exact
number of open tasks and depth items, instead of claiming success.

## One prompt worth of work (100 points)

Every task carries a score out of 100 that estimates its cost: base by kind,
plus the files it touches, plus its acceptance lines, plus what the title asks
for (a rewrite scores higher than a rename). The score is visible in the Tasks
tab, in the timeline and in the generated SSOT.

Small tasks are packed into one batch that adds up to about 100 points, so one
AI call is neither a single rename nor twenty tasks. A task that already scores
100 gets a prompt of its own. Hard caps: 130 points and 6 tasks per batch.
The batch is applied and validated as one atomic patch, so the tool never sits
half written between two tiny tasks.

Tune it in `config.local.json`:

```json
"apply": { "pointsPerPrompt": 100, "maxBatchPoints": 130, "maxTasksPerBatch": 6 }
```

While the apply stage runs, the Timeline lists the batches with their tasks and
points (`B1: T-01 (60) + T-02 (58) = 118 pts - done`), so you can see exactly
which tasks are being coded.

`knowledge/lessons.json` is the factory's memory between runs: one line per
distinct failure. Delete the file to forget everything, or read it to see what
the model keeps getting wrong.

## Definition first, then the plan

An idea in the catalog is a title and one line, which is why a naive build stays
shallow. The first AI call now writes a **tool definition** into the SSOT before
any task exists:

- `summary` - what the tool is, in plain language
- `jobs` - the concrete jobs the user hires it for (4 to 8)
- `screens` - the areas of the single screen
- `data` - the records and fields it owns, with type
- `rules` - validation, defaults, calculations, ordering
- `outOfScope` - what version 1 explicitly does not do
- `success` - how a reviewer checks it in one minute

It is rendered at the top of the generated SSOT, it is part of every prompt
digest, and a thin feature list is expanded from `jobs` instead of shipping two
features and calling it done.

## Chat per tool (SSOT only)

Every run has its own **Chat** tab. Write an idea, a refinement or a bug report;
the partner answers and writes operations that change only the SSOT: definition,
features, ideas, risks, questions, decisions and tasks (with points). The chat
never edits a file and never starts a build - the normal planning stage picks the
new tasks up. History is stored in `runs/<id>/chat.jsonl`.

## What the agent may run

No shell and no free form script execution. Three fixed probes, all bounded and
logged:

| Probe | What it does | Default |
|---|---|---|
| `syntax` | `node --check` one file inside the tool folder | on |
| `dom_smoke` | boots the tool script in a fake DOM and prints its `[TOOL:...]` log | on |
| `web_get` | reads one https page from an allowlisted host | off |

`web_get` needs both switches:

```json
"agent": { "probes": ["syntax", "dom_smoke"],
  "web": { "enabled": true, "allowHosts": ["uniconhub.com"], "maxBytes": 200000, "timeoutMs": 6000 } }
```

Never available: database access, deleting files, writing outside the tool folder,
arbitrary hosts, non https urls, credentials. Every call is recorded in the run's
`toolLog` and appears in the Live log.

## Visibility and cost

Every stage writes a step into `ssot.json` (`steps`): iteration, stage, status, duration,
AI calls, characters, and the tokens. The dashboard **Timeline** tab groups them per
iteration with a progress bar, and the generated `docs/ssot.html` has the same table.
**Run one stage** walks the loop manually.

### Real tokens, or an honest estimate

A token count the provider reports is kept as it is; the character estimate is only the
fallback. The client asks for `stream_options.include_usage` on a streamed answer, reads
`usage` from a plain JSON answer, and maps Ollama's `prompt_eval_count` / `eval_count`.
A provider that rejects `stream_options` is retried once without it instead of failing.

- `counters.apiPromptTokens` and `counters.apiCompletionTokens` accumulate what was reported
- every step and every batch stores `tokens` **and** `tokensMeasured`
- the Tasks tab has a **What each batch cost** table: points next to tokens, with a
  `reported` or `est.` chip; the run header shows the reported total when there is one

### The shape of the iteration, before it costs anything

The planner computes the same batches the apply stage will run (same queue slice, same
`apply` targets) and writes them into `ssot.plan`. The Tasks tab renders them as
**Planned batches** above the task table:

```
Planned batches        iteration 2 - 145 points in 2 batch(es) - target 100 points per call
B1   95 pts   T-03 Rebuild the quote panel (95)
B2   50 pts   T-04 Print layout (25) + T-05 Empty state copy (25)
```

When the batches finish, the same tab shows what each one really cost, so the point
estimate can be compared with the measured tokens.

### What is running right now

While a run is active the dashboard shows one line above the tabs:

```
Apply the tasks - iteration 2 - batch B1 of 2, attempt 1 of 3: T-03 Add the quote list + T-04 Print layout   [Watch the AI]
```

It comes from `run.now` (`stage`, `batchId`, `taskIds`, `attempt`, `detail`), which the
pipeline creates for every stage and the apply stage narrows down for every batch and
attempt. Each change is also pushed as a `now` event, so the line updates without waiting
for a poll. The **Tasks** tab repeats it as a banner and marks the tasks of the running
batch as `doing`, so the list itself answers "which one is it on".

### Watching the model write

The **AI stream** tab shows the model answer as it arrives, not after it is finished:

| What you see | Where it comes from |
|---|---|
| the running call, its stage, model, attempt, characters and seconds | `src/live.js` (`current`) |
| the text, appended piece by piece | `stream: true` on the openai compatible and Ollama providers |
| a note when an attempt failed and is being retried | `live.note` |
| the last twelve finished calls, clickable to read the whole answer | `live.snapshot().history` |

The deltas travel over the same event stream as the live log (`/api/runs/<id>/events`),
they are kept **in memory only**, capped at 200 000 characters per call, and are never
appended to `events.jsonl`: a token by token log on disk would grow the run folder without
adding evidence. After a page reload the view is rebuilt from
`GET /api/runs/<id>/live`. Set `stream.enabled` to `false` in `config.local.json` to fall
back to one request per answer with no live text.

A provider that ignores `stream: true` still works: the client checks the content type and
treats a plain JSON answer as a single delta. While a stream is open the timeout is an
**idle** timeout, so a call that keeps producing text is never aborted in the middle.

## How files are edited

The tool folder is the only writable root, and every task is an agent loop:

- the model gets a code map plus the inline content of files under 6KB
- bigger files are not pasted; the model calls the read only tools
  (`list_files`, `read_file`, `search_text`) at most twice, then answers
- it answers with operations (`create`, `replace` with a unique anchor, `append`,
  and `overwrite` for a large batch) which are applied atomically and validated
- the resulting change is stored as a unified diff (`task.diff`) with added and
  removed line counts, shown under Tasks in the dashboard

There is no write tool, no shell tool and no network tool available to the model.

### A whole file rewrite needs 80 points

Anchor based replaces are the right tool for a small change and the wrong one for a
file the model is rebuilding. So `overwrite` exists as its own operation, allowed only
when the batch reaches `apply.overwriteMinPoints` (default 80):

```
Apply the tasks - batch B1 of 2, attempt 1 of 3: T-03 Rebuild the quote panel (85 points)
```

A smaller batch gets a refusal that names the threshold instead of a vague error, and the
prompt is told which of the two rules is in force, so the model never guesses. A rewrite
still passes the prospective validation and the boot probe like any other patch.

### Nothing is written before it is computed

Every batch is now three steps instead of one:

1. **compute** the patch with `applyOps(..., { dryRun: true })`, which returns the new
   content of each file without touching disk
2. **validate** that prospective content (JavaScript through `node --check` on a
   temporary file, HTML tag balance, CSS braces, the html tool contract, secret scan) and
   build the unified diff
3. **write** it, then run the DOM smoke probe

With **Review each batch: on** (a per run option, also available as *Hold each batch for
my approval* when the run is created) the factory stops between step 2 and step 3 and
shows the diff with Approve and Reject:

| Button | What happens |
|---|---|
| Approve and write | the batch is written exactly as it was computed, then validated and probed |
| Reject (+ a note) | nothing is written, the tasks return to the queue, the batch is recorded as `rejected`, and the remaining batches are not attempted |

The wait is bounded (`review.timeoutMs`, 15 minutes) and ends immediately on Stop or Pause.
A rejection is a decision, not a failure: it does not consume the task's retry budget, and
the reason travels with the task as its `lastProblems`.

## Run

```
node src/server.js          (or: npm start)
```

The control panel opens at `http://127.0.0.1:4173`. Nothing to install: there is no
dependency and no build step. On Windows you can also double click `start.bat`.

Pick an idea from the list (it is the JSON catalog, searchable), set the iterations, and
press **Create and start**. **Run one stage** walks the loop slowly, **Preview app** opens
the generated test harness in a tab and **Open docs** opens the generated documentation.

## Providers

Choose one in Settings:

| Provider | Use |
| --- | --- |
| `mock` | Dry run. Deterministic answers for every stage, no network, no tokens. |
| `unicon-gateway` | The Unicon gateway protocol (`/v1/chat/complete`, provider plus model in the body). |
| `openai-compatible` | Any `POST /chat/completions` endpoint. |
| `ollama` | Local models. |

Settings are written to `config.local.json` (gitignored). The API never returns a key,
only a masked form. The application never reads the repository `.env` files on its own;
export variables or type values into Settings instead.

### There are two places a model name lives

This is the one setting that surprises people, so it is worth stating plainly:

| Setting | What it does |
| --- | --- |
| `openaiCompatible.model` (or `uniconGateway.model`, `ollama.model`) | the **provider default**, used by any call that names no model |
| `models.planner` | overrides it for research, plan, risk review, risk resolution, usability and product improvement |
| `models.coder` | overrides it for the apply stage, the only stage that writes code |

The client resolves `request.model || providerDefault`, so **an override wins silently**.
A configuration with `"openaiCompatible": { "model": "deepseek-flash" }` and
`"models": { "coder": "deepseek-v4-pro" }` really calls `deepseek-v4-pro` for every patch
while the endpoint default stays `deepseek-flash`. That is a useful setup (plan cheap,
code strong), which is why it exists, but it must never be a mystery:

- the provider chip shows both: `OpenAI compatible - deepseek-flash (planner: deepseek-v4-pro, coder: deepseek-v4-pro)`
- **Settings** has a *Model per stage* section: leave the fields blank to use the provider model
- every AI log line names the model that answered: `OpenAI compatible answered apply-tasks with deepseek-v4-pro (attempt 1, 3 210 tokens reported)`
- the start of every run logs the resolved models once: `Models in use: deepseek-flash (coder: deepseek-v4-pro) - the stage override wins over the provider default`

`GET /api/state` exposes the same information as `provider.models`
(`endpointModel`, `planner`, `coder`, `overrides`).

### Adding a DeepSeek key

Two ways, both end up in the same place.

**In the app (recommended):** open **Settings**, click the **DeepSeek** preset (it fills
`https://api.deepseek.com/v1` and `deepseek-chat`), paste the key into **API key**, press
**Save settings**. The provider switches to `openai-compatible` automatically when the
preset is used. The modal shows the exact file it saved to.

**By hand:** create `config.local.json` next to `package.json`:

```json
{
  "provider": "openai-compatible",
  "openaiCompatible": {
    "baseUrl": "https://api.deepseek.com/v1",
    "apiKey": "sk-your-deepseek-key",
    "model": "deepseek-chat"
  }
}
```

**With an environment variable:** if `DEEPSEEK_API_KEY` is set and no other endpoint is
configured, the factory fills in `https://api.deepseek.com/v1` and `deepseek-chat` itself
and switches the provider. `APP_FACTORY_OPENAI_BASE_URL`,
`APP_FACTORY_OPENAI_API_KEY`, `APP_FACTORY_OPENAI_MODEL` and `APP_FACTORY_PROVIDER`
override it when you need a different endpoint.

Notes: the endpoint must be the base URL (the client appends `/chat/completions`);
`deepseek-reasoner` also works as the model. Leaving the key field blank in Settings keeps
the saved key. To rotate a key, type the new one and save.

Environment variables: `APP_FACTORY_PROVIDER`, `APP_FACTORY_PORT`,
`APP_FACTORY_GATEWAY_BASE_URL`, `APP_FACTORY_GATEWAY_API_KEY`,
`APP_FACTORY_GATEWAY_TENANT`, `APP_FACTORY_OPENAI_BASE_URL`,
`APP_FACTORY_OPENAI_API_KEY`, `APP_FACTORY_OLLAMA_HOST`,
`APP_FACTORY_MAX_ITERATIONS`, `APP_FACTORY_CATALOG_WRITEBACK=no`,
`APP_FACTORY_NO_BROWSER=yes`.

## Token and cost control

Designed so a run costs a few thousand tokens per iteration, not hundreds of thousands:

- structured state instead of chat history (each call gets a compact digest)
- every JSON contract caps its arrays (8 features, 5 risks, 4 questions, 4 tasks, 3 ideas)
- patches instead of file rewrites (output scales with the change)
- a compact code map instead of dumping source into planning prompts
- deterministic tests, so only real failures reach the model
- de-duplication of tasks, risks, questions and ideas
- hard budgets per run: AI calls and characters, checked before every call
- optional cheaper model for planning, via `models.planner` and `models.coder`

A run pauses (does not fail) when a budget is reached, so the budget can be raised
and the run resumed.

## Safety

- Every write is path guarded to `runs/<runId>/tool/`. Traversal is refused, not sanitised,
  and run ids are validated before they are joined into a path (a crafted API url answers 400).
- Build tasks **cannot delete files**. Deletion is off unless the operator sets
  `tool.allowDelete: true` in the config file.
- `docs/ssot.html` is generated and cannot be patched by a task.
- Patches are atomic: a missing or ambiguous anchor writes nothing.
- After the configured attempts a failed task is rolled back and parked as blocked.
- Generated code is rejected if it contains a private key block, an AWS key id or an
  API style secret.
- Shell commands for the test stage cannot be set over HTTP; they come from the operator
  edited config file only.
- No `git commit` and no `git push` anywhere in this application.
- A run only ever touches its own folder. Other tools in the repository are not in scope.
- Generated applications get security defaults as decisions: deny by default,
  validate at the boundary, no client side authorisation, escape output, bound sizes,
  confirm destructive actions.

## Commands

```
npm start          run the control panel
npm run selftest   offline end to end test with the mock provider (no network)
npm run check      syntax of every module, balanced CSS, dashboard ids vs page ids
```

`selftest` writes into `selftest-output/` (gitignored) and prints a sample SSOT page path.

## Layout

```
src/server.js            HTTP API, event stream, static panel
src/pipeline.js          stage machine, single writer lock, loop control
src/state.js             run folders, run.json, ssot.json, stale lock handling
src/config.js            defaults, config.local.json, environment, masked view
src/log.js               event hub plus append only JSONL log
src/ai/client.js         four providers, retries, timeouts, budget
src/ai/prompts.js        every prompt and its JSON contract
src/ai/parse.js          tolerant JSON extraction
src/ai/mock.js           deterministic provider used by the self test
src/idea/catalog.js      reads tool-ideas-catalog.json (the idea SSOT)
src/idea/writeBack.js    writes the development block back onto the idea
src/tool/naming.js       tool folder name and class prefix
src/tool/scaffold.js     app files, test harness and the seven docs
src/ssot/model.js        specification shape, ids, duplicates, digest
src/ssot/render.js       specification to readable HTML
src/stages/*.js          one file per stage
src/code/workspace.js    root guarded file access
src/code/diff.js         unified diff for every applied change
src/ai/tools.js          read only tools the model may call before patching
src/code/patch.js        atomic patch application and rollback
src/code/validate.js     syntax, structure, secrets, document style
src/code/codemap.js      compact file map with top level symbols
src/test/runner.js       deterministic check execution
ui/                      control panel (plain HTML, CSS, JavaScript)
docs/ssot.html           the source of truth for this application
test/                    self test and source check
```

## Adding a stage

Each stage exports `{ id, title, run(context) }` and returns `{ summary, ssot }`.
Register it in `src/pipeline.js` (the array defines the order) and add a title in the
panel if needed. Keep one stage to one AI call and cap the output arrays.
