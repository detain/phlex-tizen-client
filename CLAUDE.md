# CLAUDE.md

Samsung Tizen TV client for Phlix Media Server. Vanilla JS (ES2022 modules) → webpack → Babel (Chrome 100 target) → Tizen 2.3+ Chromium TV browser. Optional HLS via `hls.js`; everything else hand-rolled.

## Commands

```bash
npm install              # package-lock.json is gitignored — CI uses `npm install`, not `npm ci`
npm run serve            # webpack dev server at :8080
npm run build:dev        # development bundle → dist/
npm run build            # production bundle → dist/
npm run watch            # rebuild on change
npm test                 # full Jest run (jsdom)
npm run test:unit        # tests/unit/** only
npm run test:integration # tests/integration/** (directory not yet present — passes empty)
npx jest tests/unit/api/ApiClient.test.js     # single file
npx jest -t "should create instance"          # single test by name
npm run lint             # ESLint over app/js
npm run lint -- --fix    # auto-fix
node scripts/package.js  # wrap dist/ into package/ for Tizen Studio signing
```

Tizen `.wgt` signing happens in Tizen Studio (or `tizen` CLI) against `scripts/package.js` output — no npm script produces a signed widget.

## Architecture

**Entry**: `app/js/main.js` → singleton `App` (`app/js/ui/App.js`) → `window.app`.

- **`app/js/ui/`** — view classes (`HomeView.js`, `LibraryView.js`, `DetailView.js`, `PlayerView.js`) + `Router.js`. `App.js` owns view registry. Views are plain ES classes with `show()`/`hide()`/`load(params)`; no framework. Manual focus management — no pointer/mouse events.
- **`app/js/api/`** — `ApiClient.js` is the single HTTP entry point, owns the device-profile that drives direct-play vs transcode. `AuthManager.js`, `SessionManager.js`, `LibraryManager.js`, `PlayerManager.js` are thin singleton coordinators. 401 → `restoreSession()`; errors surface as `ApiError`.
- **`app/js/player/`** — `VideoPlayer.js` facade. Direct-play uses `<video>`; HLS uses `HlsPlayer.js` (extends `hls.js`). **Old HLS instance must `.destroy()` before creating new one** (TV memory). Events: `ready` `play` `pause` `ended` `error` `qualityChanged` `timeupdate`.
- **`app/js/remote/`** — `RemoteManager.js` singleton key capture; `KeyMapping.js` maps Samsung codes (10009 `BACK`, 415 `PLAY`, color keys 403–406) to semantic actions. `PlayerRemoteHandler.js` swaps active handler during playback via `activate()`/`deactivate()`.
- **`app/js/utils/`** — `Logger.js`, `Storage.js` (localStorage wrapper — TV storage is limited), `Helpers.js`. Use these, not browser APIs directly.
- **`app/js/config/constants.js`** — bitrates, codecs, intervals, focus class names.

**Rule**: views never call `fetch` — they go through a manager → `ApiClient`. New endpoints: add method to `ApiClient.js`, expose via the right manager.

@./DEVELOPER.md

## Tizen runtime constraints

- No Web Audio API — use HTML5 `<video>` for audio.
- No pointer/mouse events — `keydown`/`keyup` only, routed through `RemoteManager`.
- `app/config.xml` declares Tizen privileges (`internet`, `tv.inputdevice`, `tv.window`, `tv.audio`, `network.get`, `application.launch`, `filesystem.read`) and is copied to `dist/` by `CopyWebpackPlugin`. New TV capability usually means editing this file.
- Viewport is fixed `1920x1080` (see `app/index.html`, `app/css/style.css`).

## Code style

`.eslintrc.json` is strict and CI-enforced:

- 4-space indent, single quotes, semicolons, `===` only, braces always.
- ESM only (`"type": "module"` in `package.json`); `app/js/**` is import/export.
- `no-unused-vars` is error — prefix intentionally-unused args with `_` (e.g. `loadDirect(url, _playbackInfo)`).
- Ignores `dist/`, `node_modules/`, `coverage/`, `*.test.js`.

## Tests

Jest + `jsdom`; config inline in `package.json`. Tests mirror source at `tests/unit/<layer>/<File>.test.js` (see `tests/unit/api/ApiClient.test.js`, `tests/unit/remote/KeyMapping.test.js`, `tests/unit/utils/Helpers.test.js`). Imports relative from `app/js/`. `babel-jest` transforms. `app/js/main.js` excluded from coverage.

## Quirks

- **`package-lock.json` gitignored** — CI uses `npm install`. Don't switch back to `npm ci` without coordinating.
- **Mixed module systems in tooling**: `webpack.config.js` is ESM but `scripts/build.js`, `scripts/debug.js`, `scripts/package.js` use CommonJS `require()`. They will fail under `"type": "module"` if run directly — invoke via npm scripts. If you touch a `scripts/*.js`, rename to `.cjs` or convert to ESM.
- **`tests/integration/` is referenced but does not exist** — `npm run test:integration` passes with "no tests found."
- **Tizen app id mismatch**: `app/config.xml` uses `phlix.app.phlixtizen` while `README.md` deployment example uses `org.phlix.phlixtv`. `config.xml` is authoritative.
- `.github/workflows/test.yml` and `.github/workflows/lint.yml` run on push — keep them green.

<!-- caliber:managed:pre-commit -->
## Before Committing

**IMPORTANT:** Before every git commit, you MUST ensure Caliber syncs agent configs with the latest code changes.

First, check if the pre-commit hook is already installed:
```bash
grep -q "caliber" .git/hooks/pre-commit 2>/dev/null && echo "hook-active" || echo "no-hook"
```

- If **hook-active**: the hook handles sync automatically — just commit normally. Tell the user: "Caliber will sync your agent configs automatically via the pre-commit hook."
- If **no-hook**: run Caliber manually before committing:
  1. Tell the user: "Caliber: Syncing agent configs with your latest changes..."
  2. Run: `caliber refresh && git add CALIBER_LEARNINGS.md CLAUDE.md .claude/ .opencode/ 2>/dev/null`
  3. After it completes, briefly tell the user what Caliber updated. Then proceed with the commit.

**Valid `caliber refresh` options:** `--quiet` (suppress output) and `--dry-run` (preview without writing). Do not pass any other flags — options like `--auto-approve`, `--debug`, or `--force` do not exist and will cause errors.

**`caliber config`** takes no flags — it runs an interactive provider setup. Do not pass `--provider`, `--api-key`, or `--endpoint`.

If `caliber` is not found, tell the user: "This project uses Caliber for agent config sync. Run /setup-caliber to get set up."
<!-- /caliber:managed:pre-commit -->

<!-- caliber:managed:learnings -->
## Session Learnings

Read `CALIBER_LEARNINGS.md` for patterns and anti-patterns learned from previous sessions.
These are auto-extracted from real tool usage — treat them as project-specific rules.
<!-- /caliber:managed:learnings -->

<!-- caliber:managed:model-config -->
## Model Configuration

Recommended default: `claude-sonnet-4-6` with high effort (stronger reasoning; higher cost and latency than smaller models).
Smaller/faster models trade quality for speed and cost — pick what fits the task.
Pin your choice (`/model` in Claude Code, or `CALIBER_MODEL` when using Caliber with an API provider) so upstream default changes do not silently change behavior.

<!-- /caliber:managed:model-config -->

<!-- caliber:managed:sync -->
## Context Sync

This project uses [Caliber](https://github.com/caliber-ai-org/ai-setup) to keep AI agent configs in sync across Claude Code, Cursor, Copilot, and Codex.
Configs update automatically before each commit via `caliber refresh`.
If the pre-commit hook is not set up, run `/setup-caliber` to configure everything automatically.
<!-- /caliber:managed:sync -->
