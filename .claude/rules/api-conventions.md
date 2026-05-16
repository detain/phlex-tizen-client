---
paths:
  - app/js/api/**
  - tests/unit/api/**
---

# API Conventions

- All HTTP goes through `ApiClient.request(method, path, body, options)` in `app/js/api/ApiClient.js`. New endpoints = new method on `ApiClient`.
- Path is appended to `${baseUrl}/api/v1` — pass the path without the version prefix (e.g. `/Items`, not `/api/v1/Items`).
- Use `URLSearchParams` for query strings (see `getLibraryItems`, `search`, `getItemPlaybackInfo`).
- Errors throw `ApiError(status, message, data)` — callers can `instanceof ApiError` and read `.status`.
- 401 responses must trigger `restoreSession()` flow; do not silently swallow.
- Auth/session state writes through `setToken()` / `setSession()` so `Storage` stays in sync.
- Manager classes (`AuthManager`, `SessionManager`, `LibraryManager`, `PlayerManager`) are exported as singletons (`export default new X()`) plus the class (`export { X }`) for testability — match this pattern.
- Views must NOT import `ApiClient` for new feature paths; go through a manager. `HomeView.js` and `PlayerView.js` import `api` directly for legacy reasons — don't expand that surface.
- Device profile lives on `ApiClient` (`deviceProfile`) — server uses it for direct-play decisions. Bitrate/codec changes also belong in `app/js/config/constants.js`.
