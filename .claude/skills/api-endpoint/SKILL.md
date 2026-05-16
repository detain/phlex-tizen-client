---
name: api-endpoint
description: Adds a new server endpoint as a method on `app/js/api/ApiClient.js` and exposes it via the appropriate manager (`AuthManager`, `SessionManager`, `LibraryManager`, `PlayerManager`). Uses `this.request(method, path, body, options)` with `URLSearchParams` for query strings and `ApiError` for failures. Use when user says 'add endpoint', 'new API method', 'call /Items/...', or adds code under `app/js/api/`. Do NOT use for direct `fetch` calls from views, for HLS streaming URLs (those go through `getItemPlaybackInfo`), or for editing the `deviceProfile` shape.
paths:
  - app/js/api/*.js
  - tests/unit/api/*.test.js
---
# Phlex Tizen API Endpoint

## Critical

- **Views NEVER call `fetch` directly.** The data path is always `View → Manager → ApiClient.request() → fetch`. If you're adding a `fetch` outside `app/js/api/ApiClient.js`, stop — wrap it as an `ApiClient` method instead.
- **All requests go through `this.request(method, path, body, options)`** at `app/js/api/ApiClient.js:97`. Never call `fetch` from a new method. `request` already handles: base URL prefix `${baseUrl}/api/v1`, `Content-Type`, `Authorization: Bearer`, `X-Phlex-Device-ID`, `X-Phlex-Device-Name`, `X-Phlex-Device-Type`, `X-Phlex-Session-ID`, 30s `AbortController` timeout, JSON body serialization, JSON response parsing, and `ApiError` wrapping.
- **Path is appended to `/api/v1`** — pass `'/Items/123'`, not `'/api/v1/Items/123'` and not a full URL.
- **Failures throw `ApiError`** (`app/js/api/ApiClient.js:357`) with `.status`, `.message`, `.data`. Do NOT catch-and-swallow in `ApiClient` methods — let the manager log + rethrow.
- **Query strings use `URLSearchParams`**, never manual string concatenation. See `getLibraryItems` (line 231) and `search` (line 260) for the exact shape.
- **Body is only attached for POST/PUT/PATCH** (line 120). Passing a body to GET is silently dropped.
- **snake_case for body keys, PascalCase for paths.** Server convention: paths are `/Items/{id}/UserData`, body keys are `item_id`, `start_position_ticks`, `is_paused`, `session_id`. Match the existing methods exactly.
- **Do NOT touch `restoreSession` / `login` / `logout` / `setToken` / `setSession`** when adding a new endpoint — auth flow is centralized and a new endpoint just inherits it via `this.token`.
- **Singleton export pattern is fixed**: the default export is a pre-instantiated `api`, named exports are `{ ApiClient, ApiError }`. Tests import the class via the named export (see `tests/unit/api/ApiClient.test.js:5`).

## Instructions

### Step 1 — Locate the right section in `ApiClient.js`

Open `app/js/api/ApiClient.js`. Methods are grouped under JSDoc banner comments: `Authentication`, `Session management`, `Library browsing`, `Search`, `User data`, `Playback control`, `Server info`. Pick the matching section; add new methods alphabetically-adjacent to siblings. If no section fits, add a new banner comment block above the new method.

Verify before proceeding: the section banner exists or you've added a new one with the same JSDoc style (`/** ... */` followed by an `async` method).

### Step 2 — Add the method to `ApiClient.js`

Use one of the three canonical shapes — pick by HTTP verb:

**A. GET with no params** (model: `getLibraries`, line 227):
```javascript
async getThing(id) {
    return this.request('GET', `/Things/${id}`);
}
```

**B. GET with query string** (model: `getLibraryItems`, line 231):
```javascript
async listThings(options = {}) {
    const params = new URLSearchParams({
        limit: options.limit || 50,
        startIndex: options.startIndex || 0,
        sortBy: options.sortBy || 'SortName',
    });
    return this.request('GET', `/Things?${params}`);
}
```
Notes: defaults inline in the `URLSearchParams` literal — do NOT build a separate options object first. Cast all values to primitives (numbers are fine, `URLSearchParams` stringifies them).

**C. POST/PUT/PATCH/DELETE with body** (model: `playItem`, line 292):
```javascript
async createThing(name, options = {}) {
    return this.request('POST', '/Things', {
        name,
        device_id: this.deviceId,
        media_source_id: options.mediaSourceId,
    });
}
```
Notes: body keys are snake_case. `this.deviceId`, `this.sessionId`, `this.user` are available if the server needs them. Don't add the auth header — `request()` already does.

Verify before proceeding: the method is `async`, uses template literals for path interpolation, and returns the awaited `this.request(...)` (or `await`s it then returns the result if you need to post-process).

### Step 3 — Expose via the right manager

Managers are thin singletons in `app/js/api/` that wrap `api.<method>()` with logging + optional caching. Pick by domain:

| Domain | Manager file | Pattern |
|--------|--------------|---------|
| login/register/logout/session restore | `AuthManager.js` | direct passthrough |
| `/Sessions/*` lifecycle | `SessionManager.js` | direct passthrough |
| `/Library/*`, `/Items/*`, `/Search/*`, user data | `LibraryManager.js` | with `Map`-based cache, 5 min TTL |
| `/Playstate/*`, `/Sessions/Play` | `PlayerManager.js` | direct passthrough |

Add a method mirroring the `ApiClient` name. Model (cache variant, `LibraryManager.js:36`):
```javascript
async listThings(options = {}) {
    const cacheKey = `things-${JSON.stringify(options)}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
    }
    try {
        const data = await api.listThings(options);
        this.cache.set(cacheKey, { data, timestamp: Date.now() });
        return data;
    } catch (error) {
        Logger.error('Failed to list things', error);
        throw error;
    }
}
```

Model (passthrough variant, `LibraryManager.js:96`):
```javascript
async search(query, options = {}) {
    try {
        return await api.search(query, options);
    } catch (error) {
        Logger.error('Search failed', error);
        throw error;
    }
}
```

Use cache only for GETs whose response is stable for ~5 min. Never cache POST/PUT/DELETE or anything that mutates state. After a mutation that invalidates cached state, call `this.cache.clear()` (or delete specific keys) in the same method.

Verify before proceeding: `import api from './ApiClient.js'` and `import Logger from '../utils/Logger.js'` are already at the top — no new imports needed. The manager's default export remains `new ManagerClass()`.

### Step 4 — Add unit tests

Create or extend `tests/unit/api/ApiClient.test.js` (or a sibling for the manager). Tests use Jest + `jsdom`, import via the named class export, and never hit the network — they exercise constructor/state/profile shape. Mock `fetch` only if you genuinely need to test the request-building behavior. Pattern (existing file, line 7):
```javascript
import { ApiClient, ApiError } from '../../../app/js/api/ApiClient.js';

describe('ApiClient', () => {
    let apiClient;
    beforeEach(() => {
        apiClient = new ApiClient('http://localhost:8096', 'test-device', 'Test TV');
    });

    describe('listThings', () => {
        it('should be defined', () => {
            expect(typeof apiClient.listThings).toBe('function');
        });
    });
});
```

Run: `npx jest tests/unit/api/ApiClient.test.js`. Verify all tests pass before proceeding.

### Step 5 — Lint and full test sweep

```bash
npm run lint
npm test
```

ESLint is strict: 4-space indent, single quotes, semicolons, `===`, braces always, `no-unused-vars` is an error (prefix unused args with `_`, as `getItemPlaybackInfo(itemId, _options)` does at line 248). Fix any violations before claiming done.

## Examples

**User:** "Add an endpoint to fetch recently added items for a library."

**Actions:**
1. Read `app/js/api/ApiClient.js` — find the `Library browsing` banner (~line 226).
2. Add to `ApiClient.js` under that banner:
   ```javascript
   async getRecentlyAdded(libraryId, options = {}) {
       const params = new URLSearchParams({
           parentId: libraryId,
           limit: options.limit || 20,
           sortBy: 'DateCreated',
           sortOrder: 'Descending',
       });
       return this.request('GET', `/Items?${params}`);
   }
   ```
3. Add to `app/js/api/LibraryManager.js` after `getLibraryItems` with the 5-minute cache wrapper:
   ```javascript
   async getRecentlyAdded(libraryId, options = {}) {
       const cacheKey = `recent-${libraryId}-${JSON.stringify(options)}`;
       const cached = this.cache.get(cacheKey);
       if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
           return cached.data;
       }
       try {
           const data = await api.getRecentlyAdded(libraryId, options);
           this.cache.set(cacheKey, { data, timestamp: Date.now() });
           return data;
       } catch (error) {
           Logger.error('Failed to get recently added', error);
           throw error;
       }
   }
   ```
4. Add a sanity test in `tests/unit/api/ApiClient.test.js` confirming `apiClient.getRecentlyAdded` is a function.
5. `npm run lint && npm test`.

**Result:** A view (e.g. `HomeView.js`) can now call `libraryManager.getRecentlyAdded(libId)` — no `fetch`, no manual headers, with automatic 401 → `restoreSession` behavior (handled by callers via `AuthManager`), `ApiError` propagation, and 5-minute cache reuse.

## Common Issues

- **`ReferenceError: fetch is not defined` in Jest** — you're testing the live request path. Don't. Test the method exists and the URL/body shape it would build; mock `global.fetch` with `jest.fn()` if you must.
- **Lint error `Strings must use singlequote`** — you used double quotes in a template literal or string. Switch to `'...'`; backticks are fine for template literals.
- **Lint error `'options' is defined but never used`** — rename to `_options` like `getItemPlaybackInfo(itemId, _options)` does at `app/js/api/ApiClient.js:248`.
- **Response is `null` for an empty 204** — that's expected. `request()` returns `null` for empty responses (line 142). Don't add `if (!result) throw ...` in your caller; treat `null` as success.
- **`ApiError: Request timeout` (status 408)** — the request hit the 30s default. Pass `{ timeout: 60000 }` as the 4th arg: `this.request('GET', '/Slow', null, { timeout: 60000 })`.
- **401 leaks into a view** — the view is calling `ApiClient` directly instead of going through a manager. Move the call into the right manager (Step 3) and let `AuthManager.restoreSession()` be invoked at the app level on 401.
- **`Cannot read properties of undefined (reading 'sessionId')` when posting to `/Playstate`** — playback methods require `this.sessionId` to be set first. Confirm `createSession()` has been called or the session was restored from storage.
- **CORS error in the dev server at :8080** — the Phlex server must whitelist the TV's origin. This is a server config issue, not a client fix; do not try to work around it with `mode: 'no-cors'` (it breaks JSON responses).
- **New method works locally but 404s on the TV** — `app/js/api/ApiClient.js` prepends `/api/v1`. If the server route is at a different prefix (e.g. `/api/v2/...`), you must change the constructor's URL construction, not hardcode the prefix in your path.