---
name: remote-key
description: Wires a new Samsung Tizen remote action by updating `KEY_MAP`, `isRepeatable`/`isImmediate` classification, and `getDisplayName` in `app/js/remote/KeyMapping.js`, then handles it in `PlayerRemoteHandler.js` or the global navigation handler. Use when user says 'add remote key', 'handle MediaPlayPause', 'map color button', 'wire a new remote action', or modifies anything under `app/js/remote/`. Capabilities: keycode-to-action mapping, repeat vs immediate classification, display-name registration, handler wiring during playback vs navigation, KeyMapping unit-test updates. Do NOT use for raw `document.addEventListener('keydown')` outside `RemoteManager` (forbidden — all remote input flows through the singleton), for adding browser/mouse/pointer events (TV has none), or for editing `hls.js` quality keys (use the player skill instead).
paths:
  - app/js/remote/**
  - tests/unit/remote/**
---
# Remote Key Wiring

## Critical

- **All Tizen key input flows through `app/js/remote/RemoteManager.js`.** Never add `document.addEventListener('keydown'|'keyup')` anywhere else — `RemoteManager` is the singleton capture layer and `PlayerRemoteHandler` swaps the handler during playback. If you need a new behavior, route it through these classes, not through a fresh listener on a view.
- **Every new action must be classified in exactly one of `isRepeatable` or `isImmediate` in `KeyMapping.js`.** Repeatable keys (navigation, seek, volume) trigger `setInterval`-based key-repeat after `keyRepeatDelay` (500 ms); immediate keys fire once on keydown. Missing both → key is logged but never dispatched as an `action` event. Choosing the wrong category produces either runaway repeats (e.g. PLAY firing 10×/sec) or unresponsive navigation.
- **`KEY_MAP` keys are numeric Tizen `event.keyCode` values, not string `event.key` values.** Samsung remote codes are non-standard (e.g. BACK is `10009`, color keys are `403`–`406`, MediaPlayPause is `10252`). Look up the official Samsung Tizen TV Keycode table — never guess.
- **Action names are SCREAMING_SNAKE_CASE strings** matching the convention in `KEY_MAP` (`LEFT`, `PLAY_PAUSE`, `FAST_FORWARD`). The string flows verbatim into the `switch (key)` in `PlayerRemoteHandler.handleAction` — case-sensitive.
- **Update the Jest test in `tests/unit/remote/KeyMapping.test.js`** in the same change. CI runs `npm test` and the existing test file asserts the exact mapping table; an unmapped addition will not break anything but will leave the new key untested. Add an assertion in the matching `describe` block.

## Instructions

### Step 1 — Add the keycode → action mapping

Edit `app/js/remote/KeyMapping.js`. Inside the `KEY_MAP` object, append the new entry in the comment group that fits its purpose (Navigation, Playback control, Color buttons, Volume, Menu, Misc, Tizen specific). Match the existing style: 4-space indent, single-quoted action, trailing comma. Example shape:

```javascript
// Playback control
415: 'PLAY',
10252: 'MEDIA_PLAY_PAUSE',   // ← new entry
```

Verify: open the file and confirm the new keycode is unique (grep the file for the integer — duplicates silently overwrite). Run `npx jest tests/unit/remote/KeyMapping.test.js` and confirm existing tests still pass.

### Step 2 — Classify the action (repeatable vs immediate)

Still in `KeyMapping.js`, add the new action string to **exactly one** of these arrays:

- `isRepeatable` — for keys the user holds down for continuous effect (navigation, seek, volume). Triggers `setInterval` after 500 ms.
- `isImmediate` — for single-fire keys (transport controls, color buttons, menu, info). Fires once on keydown.

Both arrays live in the same file and are checked by `RemoteManager.onKeyDown` (`app/js/remote/RemoteManager.js:48` and `:58`). Adding to neither means the key is logged but **no `action` event is emitted** — the handler in Step 4 will never run.

Verify: re-read the arrays to confirm the new action appears in exactly one. Do not add it to both — `isImmediate` and `isRepeatable` are mutually exclusive by design.

### Step 3 — Add a display name

In `KeyMapping.getDisplayName`'s `displayNames` map, add a human-readable label following the existing Title Case pattern (`'MEDIA_PLAY_PAUSE': 'Play/Pause'`). Used by Logger/debug overlays. Skip only if the action is purely internal and never surfaced to UI — but err on the side of adding it for consistency with `KEY_MAP`.

### Step 4 — Wire the handler

Decide the scope:

**A. Active during playback** → edit `app/js/remote/PlayerRemoteHandler.js`. Add a `case 'YOUR_ACTION':` branch to the `switch (key)` in `handleAction({ key, repeat })` (around line 51), calling a new `this.handleX()` method. Follow the existing `handlePlay`/`handlePause`/`handleSeekForward` pattern:

```javascript
case 'MEDIA_PLAY_PAUSE':
    this.handlePlayPause();
    break;
```

And add the method:

```javascript
async handleX() {
    try {
        // call sessionManager / videoPlayer
    } catch (error) {
        Logger.error('X failed', error);
    }
}
```

For async ops, always `await sessionManager.<call>` BEFORE `videoPlayer.<call>` (the server-side ack drives session state — see `handleSeekForward` at line 165 for the canonical order). Use `repeat` argument to differentiate held vs single press where relevant (compare `handleVolumeUp` lines 198–203).

**B. Global / navigation context** → wire in `app/js/ui/App.js` via `remoteManager.onAction(({ key }) => { ... })` or extend whichever view subscribes to remote events. Views never call `document.addEventListener` directly — they listen on the singleton `remoteManager` imported from `app/js/remote/RemoteManager.js`. Confirm the binding exists; if not, follow the `remoteManager.onAction(...)` pattern from `PlayerRemoteHandler.activate()` (line 29).

Verify: search for the new action string with Grep `'YOUR_ACTION'` and confirm there is exactly one switch case (or onAction branch) for it.

### Step 5 — Update the Jest test

Edit `tests/unit/remote/KeyMapping.test.js`. Add one assertion in each relevant `describe`:

- `describe('mapKeyCode')` — `expect(KeyMapping.mapKeyCode(10252)).toBe('MEDIA_PLAY_PAUSE');` inside the most appropriate `it(...)` group, or add a new one.
- `describe('isRepeatable')` OR `describe('isImmediate')` — assert the new action returns `true` for its category and (optionally) `false` for the other.
- `describe('getDisplayName')` — assert the display name.

Follow the exact style: arrow-function `it(...)`, single quotes, semicolons, 4-space indent, `expect(...).toBe(...)`.

Run `npx jest tests/unit/remote/KeyMapping.test.js` and confirm green.

### Step 6 — Lint and full test

Run, in order:

```bash
npm run lint
npm test
```

Both must pass. ESLint enforces 4-space indent, single quotes, semicolons, `===`, braces always, and `no-unused-vars` as errors. If the lint fails, run `npm run lint -- --fix` and re-inspect.

## Examples

**User says:** "Add the Samsung MediaPlayPause button (keycode 10252) and toggle playback when pressed."

**Actions taken:**

1. In `app/js/remote/KeyMapping.js` `KEY_MAP`, added `10252: 'MEDIA_PLAY_PAUSE',` in the Playback control group.
2. Added `'MEDIA_PLAY_PAUSE'` to the `isImmediate` array (single-press, not held).
3. Added `'MEDIA_PLAY_PAUSE': 'Play/Pause'` to `displayNames`.
4. In `PlayerRemoteHandler.handleAction`, added `case 'MEDIA_PLAY_PAUSE': this.handlePlayPause(); break;` — reusing the existing `handlePlayPause` method that already cycles `sessionManager.playbackState.isPlaying`.
5. In `tests/unit/remote/KeyMapping.test.js`, added `expect(KeyMapping.mapKeyCode(10252)).toBe('MEDIA_PLAY_PAUSE');` under playback control, `expect(KeyMapping.isImmediate('MEDIA_PLAY_PAUSE')).toBe(true);`, and `expect(KeyMapping.getDisplayName('MEDIA_PLAY_PAUSE')).toBe('Play/Pause');`.
6. `npm run lint && npm test` → green.

**Result:** Pressing the dedicated MediaPlayPause remote button during playback now toggles play/pause, going through `sessionManager` so the server stays in sync.

## Common Issues

- **"Key down" log appears in console but my handler never fires.** The action is mapped in `KEY_MAP` but missing from both `isRepeatable` and `isImmediate`. `RemoteManager.onKeyDown` only emits the `action` event when one of those returns `true` (see `RemoteManager.js:48` and `:58`). Add it to the correct array.

- **Action fires hundreds of times per second when the user holds the button.** The action is in `isRepeatable` but should be in `isImmediate` (e.g. PLAY, STOP, color buttons). Move it. Repeatable is only for navigation, seek, and volume.

- **Action fires once correctly but UI feels unresponsive when holding the key.** Opposite of the above: the action is in `isImmediate` but should be `isRepeatable` (e.g. arrow keys, FAST_FORWARD). Move it.

- **`KeyMapping.mapKeyCode(X)` returns `'UNKNOWN_X'`.** The integer is not in `KEY_MAP`. Either the wrong keycode (check the Samsung Tizen TV Keycode reference — `event.keyCode`, not `event.key`), or the entry was added under a typo. Grep the file for the integer.

- **Both PlayerRemoteHandler and the global app are reacting to the same key.** Forgot `remoteManager.setEnabled(false)` in `PlayerRemoteHandler.activate()` — it's already there (line 27) but if you added a parallel listener somewhere it won't be silenced. Route through `remoteManager.onAction` only.

- **Lint fails: `'X' is defined but never used  no-unused-vars`.** You added a handler arg you don't use (commonly `repeat`). Either use it (`this.handleX(repeat)`) or prefix with `_` (`_repeat`).

- **Tests fail with `Cannot find module '../../../app/js/remote/KeyMapping.js'`.** The test imports the module; check the path matches your edits and `app/js/remote/KeyMapping.js` still has `export default KeyMapping;` at the bottom (it does — don't remove it).

- **Adding `document.addEventListener('keydown', ...)` in a view "worked locally" but breaks playback navigation.** Forbidden pattern — during playback `RemoteManager.setEnabled(false)` disables the singleton path, but your rogue listener keeps firing, causing dual handling. Remove it and use `remoteManager.on('action', ...)` or extend `PlayerRemoteHandler`.