# Publish & Push Checklist

The canonical, step-by-step publish protocol now lives in **`publish-rules.txt`**
(repo root) - same style as `html-tool-rules.txt` and auto-attached to the
chat context. Follow that file on every publish; the sections below remain as
a quick reference.

- **Chat-driven mode (default)**: say "publish" / "push" and Copilot follows
  `publish-rules.txt` end to end - writes the AI documents itself in chat and
  runs every command in the file. No AI gateway needed.

---

## Mode B - the checklist Copilot follows when you say publish/push

1. **State check**
   - Run `npm run tools:changed` - the list of tools changed since the last push.
   - Run `git status --short` to see every pending change.

2. **SSOT updates** (for each changed tool)
   - Read the tool's code diff and its `docs/ssot.html`.
   - Update the SSOT in the same change as the code: capabilities
     (section 3), decisions (section 11, append-only, `[CODE]-NN`),
     tasks (section 15), risks (section 18), bump the document version +
     "Last updated" date.
   - Confirm the doc status chip is correct (`status-active` /
     `status-implemented` / `status-proposal`).

3. **Satellite regeneration** (for each changed tool, all 5)
   - `docs/webpage.html`, `docs/help.html`, `docs/presentation.html`,
     `docs/social.html`, and the Highlights part of `docs/updates.html` -
     regenerated from the code + SSOT + update history + ideas catalog +
     this project's AI chat, following `_docs/templates/` (structure and
     class names of the templates, content between the GENERATED markers).
   - Copilot writes these files itself in Mode B. The SSOT is never
     overwritten by generation.

4. **Release rows** (for each changed tool)
   - `docs/updates.html`: append a row before the `<!-- UPDATES-ROWS` marker
     (date, version, what changed, for whom).
   - `docs/ssot.html`: append a row before the `<!-- RELEASE-LOG-ROWS` marker
     (date, version, commit, what shipped).
   - Version = `package.json` version after the bump; commit = the short hash.

5. **Pre-push checks**
   - Open risks: every changed tool's SSOT has no open `critical`/`high`
     risks (or they are accepted with a date + reason).
   - Every tool docs folder has all 6 files (`npm run docs:init` is idempotent).
   - No `[PLACEHOLDER]` left unintentionally in touched documents; hyphen,
     never em dash; no emoji icons in document headers/CSS.
   - `npm run ssot:index` - the control tower (`_docs/index.html`) is rebuilt.

6. **Commit and push** (only because the user said push)
   - `git add -A`
   - Commit with a one-line conventional-commit message
     (feat/fix/chore/docs/...) - ask the user for the message or propose one.
   - `npm version patch` (bumps package.json, commits + tags)
   - `git push --follow-tags`
   - If the docs were updated in a second pass, commit
     `docs: update tool documentation` and push again.
   - Never push if any step above failed.

7. **Report**
   - List the changed tools, what shipped, the version, and the new/updated
     documents.

---

## Mode A - the automated equivalent (`npm run rel`)

`npm run rel` performs steps 2-7 automatically (AI commit message, SSOT gate,
release rows, task stamping with `RELEASE_SSOT_GROUPS`, satellite generation,
index rebuild, two commits + pushes). Preview the plan first with:

- `npm run rel -- --dry-run`

Env switches:

- `RELEASE_COMMIT_MESSAGE="..."` - fixed commit message (skip AI)
- `RELEASE_SSOT_GATE=strict|warn|off` - push gate (default strict)
- `RELEASE_SSOT_GATE_LEVEL=critical|high|medium|low` - blocking level (default high)
- `RELEASE_SSOT_GROUPS=all|key1,key2` - stamp shipped SSOT tasks

---

## AI backend configuration (Mode A only)

The scripts read `.env.local` (then `.env`) from this repo's root - built-in
loader, no npm install needed, values never printed:

```
UNICON_AI_GATEWAY_BASE_URL=<gateway base url>     required
UNICON_AI_GATEWAY_API_KEY=<key>                   optional
UNICON_AI_GATEWAY_CHAT_COMPLETE_PATH=/v1/chat/complete   optional
RELEASE_AI_PROVIDER=deepseek                      optional (default)
RELEASE_AI_MODEL=deepseek-v4-pro                  optional (default)
```

Fallbacks, in order: the gateway above, then `RELEASE_AI_BASE_URL` +
`RELEASE_AI_API_KEY` (OpenAI-compatible), then local Ollama. Verify with:

- `npm run ai:test`

Mode B needs none of this - Copilot's own AI writes the content.
