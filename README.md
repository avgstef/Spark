# Spark

**Turn your ideas into perfect AI prompts.**

A local-first desktop app (Electron + React + TypeScript). Describe an idea, pick a capability level,
and Spark writes a structured, paste-ready prompt — role, constraints, output format and quality bar
included. Library, history, templates and a quality analyzer ship with it.

**Design:** obsidian black, warm gold. Every surface is outlined with a thin, slightly translucent
gold hairline rather than a heavy border, so the interface reads as premium without shouting. Two
themes ship: `obsidian` (default) and `ember` (a warmer charcoal variant). The wallpaper is a bespoke
golden neural-lattice artwork bundled into the app, so it works offline and inside the packaged exe.

---

## Table of contents

1. [What it does](#1-what-it-does)
2. [This is a desktop app](#2-this-is-a-desktop-app)
3. [Quick start](#3-quick-start)
4. [Build your own Windows .exe](#4-build-your-own-windows-exe)
5. [How the credential is protected](#5-how-the-credential-is-protected)
6. [Capability levels](#6-capability-levels)
7. [Project structure](#7-project-structure)
8. [How the engine works](#8-how-the-engine-works)
9. [Troubleshooting](#9-troubleshooting)
10. [Before you publish](#10-before-you-publish)

---

## 1. What it does

| Feature | Description |
| --- | --- |
| **Studio** | Describe an idea, choose a category and capability level. Spark writes a full prompt with role, context, constraints, output format and quality bar. |
| **Smart clarification** | Before generating, Spark can ask up to 3 high-leverage questions. Skip them and it records every assumption instead. |
| **Prompt Lab** | Paste any prompt and run Improve / Expand / Simplify / Change tone / Fix ambiguity / Adapt — each with a written change log. |
| **Quality Analyzer** | Scores a prompt 0–100 across clarity, completeness, specificity, structure and constraints, lists weaknesses and offers a rewrite. |
| **Library** | Save, tag, favourite, search, sort and export as Markdown. Local only. |
| **History** | Every generation is recorded so you can restore an idea or promote it to the library. |
| **Templates** | 16 curated seed ideas across eight categories. |
| **Local fallback engine** | With no credential configured the app still works using a deterministic heuristic engine, clearly labelled so results are never passed off as model output. |

---

## 2. This is a desktop app

| | Browser preview (`npm run dev`) | The built app (`npm run dist:win`) |
| --- | --- | --- |
| Runs in | Chrome/Edge at `localhost:5173` | Its own native window, no browser |
| Launch | you start a dev server | desktop / Start-menu shortcut |
| Icon | none | Spark icon in taskbar, Alt-Tab, Start menu |
| Credential | browser localStorage | sealed in the build + OS keystore for your own |
| Data | browser localStorage | `%APPDATA%\Spark` |
| Window | browser chrome | frameless, custom title bar, remembers size and position |

Only the *preview* is a web page. The deliverable is a normal Windows program.

---

## 3. Quick start

Requirements: **Node.js 22.12 or newer** (24 LTS ideal) — <https://nodejs.org>

```bash
npm install
npm start          # builds, then opens the real desktop window
```

Browser preview only (no desktop shell):

```bash
npm run dev        # http://localhost:5173
```

The build ships with a sealed credential, so it works immediately. To use your own, open
**Settings → Access key** and paste it.

---

## 4. Build your own Windows .exe

On Windows, in the project folder:

```bat
build-windows.bat
```

That runs `scripts/build-win.mjs`, which checks your Node version, type-checks, bundles, packages,
writes everything to `build-log.txt`, and keeps the window open so failures are readable.

Equivalent manual steps:

```bat
npm install
npm run build:win
```

Artifacts land in `release/`:

| File | What it is |
| --- | --- |
| `Spark-Setup-1.0.0.exe` | NSIS installer — Start-menu + desktop shortcut, choose folder |
| `Spark-1.0.0-x64.exe` | Portable build, runs without installing |

Also available: `npm run pack:dir` (unpacked, fastest sanity check), `npm run dist:linux` (AppImage).

---

## 5. How the credential is protected

Spark is built so the credential is not readable from the UI or the shipped web bundle.

```
React UI  ──IPC──▶  Electron main process  ──HTTPS──▶  generation service
(no key)            (owns the credential)
```

**What is protected**

1. **The key never enters the renderer.** The preload bridge exposes only `engine(kind, payload)`.
   There is no API to read a key — by design, not by convention.
2. **Provider identity is masked.** The endpoint, auth header and upstream model identifiers are
   stored base64-encoded in `electron/engine.cjs` and assembled at runtime, so grepping the source
   or the packaged app finds no provider name.
3. **The key is sealed.** `electron/vault.dat` holds it masked with a rotating keystream
   (`scripts/seal-key.mjs`). No plaintext key exists in the repo.
4. **The web bundle is clean.** The dev-only network path is guarded by `import.meta.env.DEV`, which
   the bundler folds to `false` in production. Verified: the shipped `dist/` contains no endpoint,
   no auth header, no model id, no key, and a CSP with `connect-src 'self'`.
5. **Your own key** (if you add one in Settings) is encrypted with the OS keystore — DPAPI on
   Windows, Keychain on macOS, libsecret on Linux.

**Sealing a different key**

```bash
node scripts/seal-key.mjs "YOUR_KEY"
node scripts/seal-key.mjs --from-file spark.key    # then delete spark.key
```

**What this is not.** This is obfuscation, not encryption. A determined person running the app can
recover the key it uses, because the app must be able to use it. It stops casual copying — reading
the source, unzipping the installer, grepping the bundle — not reverse engineering. Section 10
covers what to do before distributing widely.

---

## 6. Capability levels

The UI exposes three levels only. The mapping to upstream models is internal.

| Level | Behaviour |
| --- | --- |
| **Low** | Fastest responses, lightest reasoning |
| **Medium** | Balanced depth and speed — default |
| **High** | Deepest reasoning, slower and more thorough |

Set the default in **Settings → Capability**, override per prompt in **Studio**.

Each level is a **chain of models**, not a single model. The engine walks the chain: if one is out of
daily capacity or unavailable, the next one answers instead of failing. That is why a level keeps
working after its first-choice model hits a limit.

| Level | Chain (in order) | Typical answer |
| --- | --- | --- |
| Low | lightest → fast → light | ~2 s |
| Medium | balanced → deep → light | ~4 s |
| High | deep (extra reasoning) → deep → balanced → light | ~5 s |

Measured on the shipped prompt and schema, one prompt, first attempt: **2.0 s / 4.1 s / 4.9 s**.
See §8 for what makes it fast.

---

## 7. Project structure

```
spark/
├── electron/
│   ├── main.cjs          # window, IPC, security lockdown, window-state persistence
│   ├── preload.cjs       # the only UI↔OS bridge; no credential access
│   ├── engine.cjs        # masked config, tier mapping, vault unsealing, transport
│   ├── store.cjs         # encrypted settings + credential source resolution
│   └── vault.dat         # sealed credential
├── scripts/
│   ├── build-win.mjs     # guarded build runner with full logging
│   └── seal-key.mjs      # writes vault.dat
├── src/
│   ├── App.tsx           # shell: wallpaper, titlebar, sidebar, views, toasts
│   ├── styles.css        # design system, glass surfaces, animations, themes
│   ├── assets/
│   │   └── spark-bg.jpg  # bundled wallpaper
│   ├── components/
│   │   ├── Icon.tsx      # inline SVG icon set + brand mark
│   │   ├── Sidebar.tsx   # grouped nav, animated states
│   │   ├── TitleBar.tsx  # frameless window chrome
│   │   └── ui.tsx        # Card, Button, Field, Ring, Meter, Modal…
│   ├── views/            # Studio, PromptLab, Analyzer, Library, History, Templates, Settings
│   └── lib/
│       ├── api.ts        # single API surface (IPC in app, dev shim in browser)
│       ├── devTransport.ts # dev-only constants; dropped from production builds
│       ├── appState.tsx  # settings, library, history, toasts, routing
│       ├── localEngine.ts# heuristic fallback
│       ├── partial.ts    # reads half-written streamed JSON for the live view
│       ├── templates.ts  # template catalogue
│       ├── storage.ts    # local persistence, export, view handoff
│       └── types.ts      # domain types
├── resources/icon.png    # 1024² app icon (kept out of build/ on purpose)
├── build-windows.bat     # one-click build (CRLF — do not convert)
└── README.md
```

---

## 8. How the engine works

Four operations, all returning **structured JSON** via `responseSchema` so the UI never parses prose:

| Kind | Returns |
| --- | --- |
| `generate` | `title, category, objective, brief, prompt, assumptions[], tips[], quality{}` |
| `clarify` | `needsClarification, reason, questions[]` (max 3) |
| `lab` | `prompt, changes[], notes` |
| `analyze` | `overall, scores{5}, strengths[], weaknesses[], fixes[], rewritten` |

The shared system instruction enforces a paste-ready prompt with no meta commentary, measurable
constraints instead of adjectives, explicit assumptions instead of silent guesses, and a defined
output format plus quality bar. Per-category strategies live in `CATEGORY_GUIDANCE`.

### Why it is fast

Four things, in order of impact:

1. **Right-sized work per level.** The heavy model with a large output ceiling and no reasoning cap
   answered the same prompt in **69 s**; it spent most of that time thinking and writing far more
   tokens than the schema needs. The output ceiling is now 3072 tokens, reasoning is bounded per
   level, and each level starts on the cheapest model that still produces a full-quality prompt.
2. **Streaming, end to end.** Answers arrive over SSE and are painted while they are written. The
   first line is visible in **0.7–1.6 s**, so perceived speed is far better than the totals above.
3. **Watchdogs instead of long waits.** A stalled request is abandoned after 8 s without a first
   token and the next model in the chain takes over, under a 32 s budget for the whole call. There is
   no two-minute hang.
4. **Capacity-aware retries.** A "daily capacity used up" reply is never retried on the same model —
   it is remembered for the rest of the day and the chain moves on. Transient overloads get exactly
   one retry.

Clarification runs on the fastest level on purpose: it is a small routing decision that sits in front
of the real work, so a deep model there would add seconds to every generation.

Failure handling: bounded timeouts, per-model capacity tracking, retries on 429/503/500, HTTP status
→ human-readable messages (with provider internals scrubbed from the text), partial-JSON salvage for
the live view, malformed-JSON recovery, and a clean path to the local engine when no credential
exists.

---

## 9. Troubleshooting

| Symptom | Fix |
| --- | --- |
| Build window closes instantly | Re-download — the `.bat` had LF endings in an early copy. Also requires Node 22.12+. |
| "The service rejected the credential" | Settings → *Test connection*. Confirm the key is enabled with the provider. |
| "Rate limit reached" | Wait ~30 s; the engine already retries once. Try the Low level meanwhile. |
| "Daily capacity for this level is used up" | The free tier allows 20 requests per day per model. Switch level — each level starts on a different model, and the chain moves on automatically. |
| "That took too long" | The engine abandons stalled requests after 8 s and moves on. If it persists, use Medium or Low. |
| Blank window after `npm start` | Run `npm run build` first — the window loads `dist/index.html`. |
| Styles missing in the app | Keep `base: './'` in `vite.config.ts` — absolute paths break under `file://`. |

---

## 10. Before you publish

The app ships with a working credential so it runs out of the box. That also means **anyone who has
the installer can extract and use it.** Before publishing or sharing widely:

- **Rotate the key** with your provider and seal a new one: `node scripts/seal-key.mjs "NEW_KEY"`.
- **Best option:** remove the sealed credential (`rm electron/vault.dat`) and let each user paste
  their own in Settings. That keeps quota and billing isolated per user and is the flow the UI is
  designed around.
- **For a hosted or multi-user product:** proxy generation through a backend you control, with
  per-user auth and rate limits. Never ship a shared key to many users.
- Never commit `spark.key` — it is already in `.gitignore`.

Other safeguards in place: `contextIsolation` and `sandbox` on, `nodeIntegration` off, CSP
restricting the renderer to `'self'`, navigation locked so external links open in the browser,
key-shaped input validated before saving, and a one-click local data wipe.

---

MIT licensed. Built from the original product blueprint, shipped as Spark.
