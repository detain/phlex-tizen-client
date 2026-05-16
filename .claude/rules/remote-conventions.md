---
paths:
  - app/js/remote/**
  - tests/unit/remote/**
---

# Remote Control Conventions

- All key codes live in `KeyMapping.KEY_MAP` in `app/js/remote/KeyMapping.js`. Samsung-specific codes worth remembering: `10009` BACK, `415` PLAY, `413` STOP, `19` PAUSE, `417`/`412` FF/REW, `403`-`406` RED/GREEN/YELLOW/BLUE.
- New action requires updates in three places: `KEY_MAP`, classify in `isRepeatable` or `isImmediate`, and add `getDisplayName` entry.
- `RemoteManager` (`app/js/remote/RemoteManager.js`) is the singleton dispatcher; do not attach raw `keydown` listeners elsewhere.
- During playback, `PlayerRemoteHandler.activate()` swaps handlers — it calls `remoteManager.setEnabled(false)` to suppress global navigation. `deactivate()` restores. Always pair them.
- Handler actions return early when state doesn't allow (see `handlePlay` checking `state?.isPlaying`).
- Held keys: `repeat` boolean is passed in action data — accelerate seek/volume when repeating (see `handleSeekForward` using `repeat ? 30 : this.seekStep`).
