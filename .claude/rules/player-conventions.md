---
paths:
  - app/js/player/**
---

# Player Conventions

- `VideoPlayer` (`app/js/player/VideoPlayer.js`) is the facade — UI talks to it, not to `<video>` directly.
- HLS path: dynamic `import('./HlsPlayer.js')` inside `loadHLS()` keeps `hls.js` out of the direct-play bundle path.
- **Always `this.hlsPlayer.destroy()` before instantiating a new one** — TV memory pressure causes hard crashes otherwise (see `loadHLS()` and `stop()`).
- Player emits via internal `listeners` Map: `ready`, `play`, `pause`, `ended`, `error`, `waiting`, `canplay`, `loadedmetadata`, `timeupdate`, `progress`, `qualityChanged`. New events go through `emit(event, data)`.
- Time conversion: server uses ticks (`positionTicks / 10000000` = seconds). `getCurrentTimeTicks()` / `seekToTicks()` handle conversion.
- Quality `-1` = auto in `setQuality()`.
- Tizen-specific video attrs (`buffered-smooth`, `seeking-smooth`, `setBufferSettings`) live in `configureForTizen()` — wrap unknown TV APIs in `try/catch` (see existing pattern).
