# Unicon Studio

Visual-first desktop studio for web projects (static HTML/CSS/JS and
Next.js) with AI chat, an AI agent, a terminal, and a live preview.
Electron application, plain JavaScript only.

Feature management: `../code-devtool-ssot.html` is the single source of
truth (SSOT) for every decision. Read it before changing code; update it in
the same change.

## Run

```
npm install     # first time only (downloads Electron)
npm start       # starts the app
```

## Smoke test

```
CODEDEVTOOL_SMOKE_TEST=1 npx electron .
```

Starts the app, lets the window load, then quits automatically. Exit code 0
means the skeleton is healthy.

## Structure

```
main/            Electron main process (Node.js power lives here)
  main.js        window creation, security settings, IPC hub
  app-state.js   project root and recent projects as JSON under userData
preload.js       contextBridge allowlist - the only bridge to Node.js power
renderer/        plain HTML/CSS/JS UI, zero Node.js access
vendor/          local third-party bundles (Monaco arrives with T-05)
build/           electron-builder output (gitignored)
```

Security baseline (SSOT CODE-07): contextIsolation on, nodeIntegration off,
sandbox on, allowlisted IPC channels, content security policy in the
renderer, secrets in safeStorage once providers arrive.
