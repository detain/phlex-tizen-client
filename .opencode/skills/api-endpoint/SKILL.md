---
name: api-endpoint
description: Adds a new server endpoint as a method on `app/js/api/ApiClient.js` and exposes it via the matching singleton manager (`AuthManager`, `SessionManager`, `LibraryManager`, `PlayerManager`). Use when the user says 'add endpoint', 'new API method', 'wrap /Items/...', 'call the server for X', or adds code under `app/js/api/`. Capabilities: writes the `ApiClient` method using `this.request(method, path, body, options)`, builds query strings with `URLSearchParams`, throws `ApiError` on failure, exposes a thin manager wrapper that logs via `Logger.error`, and adds matching Jest tests under `tests/unit/api/`. Do NOT use for direct `fetch` calls from views/components, for HLS `.m3u8` stream URLs (those go through `app/js/player/HlsPlayer.js`), for new auth flows that change token/session storage shape, or for changes to the device-profile payload itself.
---

# API Endpoint

Add a new Phlix server endpoint by writing a method on `ApiClient`, then surfacing it through the right manager. Views must never call `fetch` directly — they go view → manager → `ApiClient.request()`.

## Critical

- **All HTTP must go through `ApiClient.request(method, path, body, options)`** in `app/js/api/ApiClient.js`. Never add a raw `fetch()` anywhere in `app/js/`.
- **`path` is appended to `${baseUrl}/api/v1`** — pass `'/Items/123'`, NOT `'/api/v1/Items/123'` and NOT a full URL.
- **Build query strings with `URLSearchParams`**, then interpolate with backticks: `` `/Items?${params}` ``. Do NOT hand-concatenate query strings or call `encodeURIComponent` yourself.
- **`body` is only serialized for `POST` / `PUT` / `PATCH`.** For `GET` / `DELETE`, put parameters in the path or query string. Passing a `body` to `GET` is silently dropped by `request()`.
- **Failures throw `ApiError`** (already handled inside `request()`). In managers, catch and `Logger.error('<context>', error)` then re-throw — see `LibraryManager.getLibraries()`. Do not swallow.
- **401 handling is centralized.** `restoreSession()` already deals with expired tokens. Do not add per-method 401 retry logic.
- **Views never import `ApiClient` directly.** They import the singleton manager (e.g. `import library from '../api/LibraryManager.js'`).
- **Default `import api from './ApiClient.js';`** inside managers — that is the shared singleton. Use the named `{ ApiClient, ApiError }` export only in tests.

## Instructions

1. **Identify the manager.** Pick the existing singleton that owns this domain:
   - Auth / login / register / token → `AuthManager.js`
   - Session lifecycle, device registration → `SessionManager.js`
   - Libraries, items, search, user-data on items → `LibraryManager.js`
   - Playback transport (`/Sessions/Play`, `/Playstate`, progress) → `PlayerManager.js`
   If none fit, ask the user before creating a new manager file. Verify the file exists with `Glob app/js/api/*Manager.js` before proceeding.

2. **Add the method on `ApiClient`** in `app/js/api/ApiClient.js`. Place it under the matching block-comment section (`/** Library browsing */`, `/** Playback control */`, etc.). Match the existing style exactly:

   ```javascript
   // GET with query params — model after getLibraryItems / search
   async getCollections(options = {}) {
       const params = new URLSearchParams({
           limit: options.limit || 50,
           startIndex: options.startIndex || 0,
       });
       return this.request('GET', `/Collections?${params}`);
   }

   // GET by id — model after getItem
   async getCollection(collectionId) {
       return this.request('GET', `/Collections/${collectionId}`);
   }

   // POST with body — model after updateUserData / playItem
   async createCollection(name, itemIds) {
       return this.request('POST', '/Collections', {
           name,
           item_ids: itemIds,
       });
   }

   // DELETE — model after the inline call inside logout()
   async deleteCollection(collectionId) {
       return this.request('DELETE', `/Collections/${collectionId}`);
   }
   ```

   Naming: lowerCamelCase, verb-first (`get*`, `create*`, `update*`, `delete*`, `mark*`, `toggle*`, `report*`). Body keys are `snake_case` to match the Phlix server (see `playItem`, `reportPlaybackProgress`).

   Verify before proceeding: re-open `ApiClient.js` and confirm the new method sits inside the `class ApiClient { … }` block and uses `this.request(...)`.

3. **Expose it on the manager.** Open the manager file from Step 1 and add a thin wrapper that calls the method from Step 2. Match the existing try/catch pattern from `LibraryManager`:

   ```javascript
   async getCollections(options = {}) {
       try {
           return await api.getCollections(options);
       } catch (error) {
           Logger.error('Failed to get collections', error);
           throw error;
       }
   }
   ```

   - Use `import api from './ApiClient.js';` and `import Logger from '../utils/Logger.js';` (already at the top of every manager).
   - Add caching ONLY if the manager already caches that domain (LibraryManager does; the others do not). Mirror the `cacheKey` / `cacheTimeout` shape from `LibraryManager.getLibraryItems`.
   - Re-throw after logging — never return `null` to swallow failures. The view decides what to render on error.

   Verify: the manager file still ends with `export default new <Name>Manager();` plus a named `export { <Name>Manager };` — both are required because tests import the class.

4. **Add unit tests.** Create or extend `tests/unit/api/<File>.test.js`, mirroring `tests/unit/api/ApiClient.test.js`. Import the named class, not the singleton:

   ```javascript
   import { ApiClient, ApiError } from '../../../app/js/api/ApiClient.js';

   describe('ApiClient.getCollections', () => {
       let apiClient;
       beforeEach(() => {
           apiClient = new ApiClient('http://localhost:8096', 'test-device', 'Test TV');
       });

       it('builds the correct query string', () => {
           // assert against the URL passed to a stubbed global.fetch
       });
   });
   ```

   Stub `global.fetch` per test with `jest.fn().mockResolvedValue({ ok: true, text: async () => '{"id":1}' })`. This mirrors how `request()` parses responses (text → `JSON.parse`, empty → `null`).

5. **Run the gates** — all three must pass before reporting done:

   ```bash
   npm run lint
   npx jest tests/unit/api/
   npm run build:dev
   ```

   If lint fails on indent or quotes, run `npm run lint -- --fix`. The repo enforces 4-space indent, single quotes, semicolons, `===`, and braces always (`.eslintrc.json`).

6. **Wire it into a view only when asked.** Views call the manager, never `ApiClient`:

   ```javascript
   import library from '../api/LibraryManager.js';
   const collections = await library.getCollections({ limit: 20 });
   ```

   If the user only asked for the endpoint, stop after Step 5 and surface the new manager method name to them.

## Examples

**User**: "Add an endpoint to fetch the next-up episodes for a series — `GET /Shows/{id}/NextUp`."

Actions:
1. Domain is library/items → `LibraryManager`.
2. In `ApiClient.js`, under `/** Library browsing */`, add:
   ```javascript
   async getNextUp(seriesId, options = {}) {
       const params = new URLSearchParams({
           limit: options.limit || 10,
           userId: options.userId || '',
       });
       return this.request('GET', `/Shows/${seriesId}/NextUp?${params}`);
   }
   ```
3. In `LibraryManager.js`, add:
   ```javascript
   async getNextUp(seriesId, options = {}) {
       try {
           return await api.getNextUp(seriesId, options);
       } catch (error) {
           Logger.error('Failed to get next-up episodes', error);
           throw error;
       }
   }
   ```
4. Add a test in `tests/unit/api/ApiClient.test.js` asserting the fetch URL contains `/api/v1/Shows/abc/NextUp?limit=5`.
5. `npm run lint && npx jest tests/unit/api/ && npm run build:dev` — all green.

Result: View code can call `library.getNextUp(seriesId, { limit: 5 })`; failures bubble up as `ApiError` with `status` set.

## Common Issues

- **`TypeError: this.request is not a function`** — your method is defined outside the `class ApiClient { … }` block (often after the closing brace, near `class ApiError`). Move it back inside the class body.
- **`SyntaxError: Unexpected token in JSON`** at the `JSON.parse(text)` line in `request()` — server returned HTML (often a 502 from a misconfigured proxy) but with a 2xx status. Confirm the path begins with `/` and does not double the `/api/v1` prefix.
- **Request hangs ~30s then throws `ApiError(408, 'Request timeout')`** — server URL is wrong or CORS preflight is failing silently. Check that `app/config.xml` lists the server origin under `<access origin="..." />` and that the Phlix server CORS allowlist includes the TV.
- **`ApiError(401, ...)` on every call after login** — token was set but session was not. Confirm the login response shape is `{ token, session_id, user }`; if the field name differs, update the destructuring inside `ApiClient.login()` rather than papering over it in the new method.
- **ESLint: `'_options' is defined but never used`** — intentional unused params must be `_`-prefixed (see `getItemPlaybackInfo(itemId, _options)`). Either prefix the arg or actually use it.
- **Jest: `ReferenceError: fetch is not defined`** — jsdom does not provide `fetch`. Stub it per test: `global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => '{}' });` and clear it in `afterEach`.
- **Manager test imports break with `Cannot use import statement outside a module`** — you imported the default singleton in a unit test. Switch to the named class export (`import { LibraryManager } from '...'`) and `new` it, so each test gets a clean instance with no cached state.
- **New endpoint works in dev but 404s in the packaged `.wgt`** — webpack only re-bundles on `npm run build` / `build:dev`. Re-run the build before `node scripts/package.js`; the script does NOT trigger a rebuild.