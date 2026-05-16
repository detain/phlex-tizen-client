---
name: jest-unit-test
description: Adds a Jest jsdom unit test at tests/unit/<layer>/<File>.test.js mirroring the source layout under app/js/<layer>/, importing the class (not the singleton) for fresh beforeEach instances. Follows the describe/describe/it('should …') pattern from tests/unit/api/ApiClient.test.js, tests/unit/utils/Helpers.test.js, and tests/unit/remote/KeyMapping.test.js. Use when user says 'write a test', 'add unit test', 'test this', 'jest test', or after adding new code to app/js/. Do NOT use for integration tests under tests/integration/ (directory does not exist yet — the npm script passes empty), Tizen widget signing tests, or non-Jest test runners.
paths:
  - tests/unit/**/*.test.js
  - app/js/**/*.js
---
# Jest Unit Test (phlex-tizen)

## Critical

- **File location MUST mirror source:** for `app/js/<layer>/<File>.js` write `tests/unit/<layer>/<File>.test.js`. Never put unit tests under `tests/integration/` — that directory does not exist and is a separate script.
- **Import the class, not the singleton.** For classes (e.g. `ApiClient`), use a named import and instantiate fresh in `beforeEach`. For object-literal/singleton modules (e.g. `Helpers`, `KeyMapping`) use the default import and call statically — these have no constructor state to reset.
- **Relative import depth is exactly three `../` levels** from `tests/unit/<layer>/<File>.test.js` to `app/js/<layer>/<File>.js`. Always include the trailing `.js` extension (ESM under `"type": "module"`).
- **No new dev dependencies.** Jest 29 + `jest-environment-jsdom` + `babel-jest` are already configured inline in `package.json`. Do not add `@testing-library/*`, `ts-jest`, or any helper unless the user asks.
- **ESLint ignores `*.test.js`** (per `.eslintrc.json`), but still write 4-space indent, single quotes, semicolons, `===`, and braces always — to match neighboring tests.
- **No mocking of `fetch` unless the test specifically exercises HTTP.** The existing `ApiClient` test only covers constructor + setters and never touches the network. Match that scope unless asked otherwise.

## Instructions

### Step 1 — Locate the source file and pick a layer

Identify the file under test. Layers and the matching test directories:

| Source | Test |
|---|---|
| `app/js/api/<X>.js` | `tests/unit/api/<X>.test.js` |
| `app/js/ui/<X>.js` | `tests/unit/ui/<X>.test.js` |
| `app/js/player/<X>.js` | `tests/unit/player/<X>.test.js` |
| `app/js/remote/<X>.js` | `tests/unit/remote/<X>.test.js` |
| `app/js/utils/<X>.js` | `tests/unit/utils/<X>.test.js` |
| `app/js/config/<X>.js` | `tests/unit/config/<X>.test.js` |

Verify the directory exists: `ls tests/unit/<layer>/`. Create it if missing. Verify before Step 2.

### Step 2 — Determine the export shape

Open the source file and check the export:

- **Named class export** (`export { ApiClient, ApiError }` or `export class Foo`) → use `import { Foo } from '...'` and create instances with `new Foo(...)`.
- **Default export of a class** (`export default class Bar`) → use `import Bar from '...'`.
- **Default export of a plain object/singleton** (`export default Helpers`, `export default KeyMapping`) → use `import Helpers from '...'` and call methods statically. Do **not** instantiate.

Verify the import form matches the export before writing the test body.

### Step 3 — Scaffold the file with the project header

Every test file starts with the JSDoc header used by existing tests. Replace `<ClassName>`:

```js
/**
 * <ClassName> Unit Tests
 */

import { <ClassName> } from '../../../app/js/<layer>/<ClassName>.js';

describe('<ClassName>', () => {
    // tests go here
});
```

For singleton modules, use the default-import form (mirrors `tests/unit/utils/Helpers.test.js:5` and `tests/unit/remote/KeyMapping.test.js:5`):

```js
import <Singleton> from '../../../app/js/<layer>/<Singleton>.js';
```

### Step 4 — Add `beforeEach` for class instances

For class-under-test only. Mirrors `tests/unit/api/ApiClient.test.js:7-12`:

```js
describe('<ClassName>', () => {
    let instance;

    beforeEach(() => {
        instance = new <ClassName>(/* constructor args from the real signature */);
    });

    // nested describes
});
```

Use realistic but minimal constructor args (e.g. `'http://localhost:8096'`, `'test-device'`, `'Test TV'`). Do NOT use `null`/`undefined` placeholders unless you are specifically testing default-value behavior.

Skip `beforeEach` for singleton modules — call methods directly like `KeyMapping.mapKeyCode(37)`.

### Step 5 — Group with nested `describe`, name tests `it('should …')`

One nested `describe` per logical grouping — usually one per method, but related setters can share a group (see `describe('Authentication', ...)` in `ApiClient.test.js:38`). Test names always start with `should`:

```js
describe('Constructor', () => {
    it('should create instance with correct base URL', () => {
        expect(instance.baseUrl).toBe('http://localhost:8096');
    });
});

describe('<methodName>', () => {
    it('should <expected behavior>', () => {
        expect(instance.<methodName>(input)).toBe(expectedOutput);
    });
});
```

Use `toBe` for primitives, `toEqual` for objects/arrays, `toBeNull()` / `toBeDefined()` / `toBeGreaterThan(0)` where appropriate (see lines 29, 33, 68 of `ApiClient.test.js`).

### Step 6 — Handle async / timer code with `done` callback

`Helpers.test.js:81-95` and `:99-113` are the canonical pattern for debounce/throttle and any `setTimeout`-driven code. Use the `done` callback, NOT `jest.useFakeTimers()` (the existing suite does not configure fake timers and relies on real ones):

```js
it('should delay function execution', (done) => {
    let count = 0;
    const fn = Helpers.debounce(() => { count++; }, 100);
    fn(); fn(); fn();
    expect(count).toBe(0);
    setTimeout(() => {
        expect(count).toBe(1);
        done();
    }, 150);
});
```

For promise-returning APIs (e.g. anything in `ApiClient` that calls `fetch`), use `async/await` and mock `global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({...}) })` inside the `it`. Restore with `delete global.fetch` or `jest.restoreAllMocks()` in `afterEach` if you set spies.

### Step 7 — Add a sibling `describe` for related exports

If the module exports multiple symbols (e.g. `ApiClient` + `ApiError`), add a second top-level `describe` rather than nesting. Mirrors `ApiClient.test.js:77-90`:

```js
describe('ApiError', () => {
    it('should create error with status and message', () => {
        const error = new ApiError(404, 'Not found');
        expect(error.status).toBe(404);
        expect(error.message).toBe('Not found');
        expect(error.name).toBe('ApiError');
    });
});
```

### Step 8 — Verify the test runs and passes

Run the new file directly — do not run the whole suite first:

```bash
npx jest tests/unit/<layer>/<File>.test.js
```

Then run a single named test if narrowing:

```bash
npx jest -t "should <fragment>"
```

Finally run the unit suite to confirm no collateral breakage:

```bash
npm run test:unit
```

Do NOT run `npm run test:integration` — that points at an empty directory and will report "no tests found." Verify all three commands exit 0 before reporting done.

## Examples

**User says:** "Add a unit test for `SessionManager`."

**Actions:**
1. `ls app/js/api/SessionManager.js` to confirm it exists and inspect exports.
2. `ls tests/unit/api/` to confirm the directory.
3. Create `tests/unit/api/SessionManager.test.js`:

```js
/**
 * SessionManager Unit Tests
 */

import { SessionManager } from '../../../app/js/api/SessionManager.js';

describe('SessionManager', () => {
    let sessionManager;

    beforeEach(() => {
        sessionManager = new SessionManager();
    });

    describe('Constructor', () => {
        it('should initialize with no active session', () => {
            expect(sessionManager.currentSession).toBeNull();
        });
    });

    describe('start', () => {
        it('should set currentSession when start is called', () => {
            sessionManager.start({ id: 'sess-1' });
            expect(sessionManager.currentSession).toEqual({ id: 'sess-1' });
        });
    });
});
```

4. Run `npx jest tests/unit/api/SessionManager.test.js` → green. Run `npm run test:unit` → all green.

**Result:** New file under `tests/unit/api/`, three-level relative import, class instantiated in `beforeEach`, `should …` names — visually identical to `tests/unit/api/ApiClient.test.js`.

## Common Issues

**`SyntaxError: Cannot use import statement outside a module`** — Babel is not transforming the test file. Confirm `package.json` still has the `jest.transform` block `"^.+\\.js$": "babel-jest"` (lines 28-30) and that `babel.config.js` exists with `@babel/preset-env`. Do not add `"type": "commonjs"` to fix this — the project is ESM.

**`Cannot find module '../../../app/js/...'`** — wrong relative depth. From `tests/unit/<layer>/<File>.test.js`, you go up three: `../` (out of `<layer>`) → `../../` (out of `unit`) → `../../../` (out of `tests`). Always include the `.js` extension.

**`ReferenceError: window is not defined`** — Jest is running in `node` instead of `jsdom`. The inline config sets `"testEnvironment": "jsdom"` globally; do not override with a `/** @jest-environment node */` pragma unless the test specifically needs Node.

**`ReferenceError: fetch is not defined`** — jsdom in Jest 29 does not polyfill `fetch`. If the code-under-test calls `fetch`, mock it in the test: `global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });`. Restore in `afterEach` with `delete global.fetch`.

**Test passes solo but fails in the suite** — usually a singleton sharing state across files (e.g. `RemoteManager`, `AuthManager`). Either reset the singleton in `beforeEach` via its public API, or import the underlying class (if exported) and construct fresh. Never mutate private fields directly.

**`npm test` reports 0 tests for the new file** — `testMatch` only picks up `**/tests/**/*.test.js`. Confirm the path contains `tests/` and the file ends in `.test.js` (not `.spec.js`).

**Timer-based test times out** — using `setTimeout` without calling `done()`. Either accept the `done` arg and call it from inside the inner `setTimeout` (matching `Helpers.test.js:81-95`), or convert the test to `async` with `await new Promise(r => setTimeout(r, 150))`.

**`npm run test:integration` returns "No tests found"** — expected. `tests/integration/` is referenced by the script but does not exist yet. Do not create unit tests there to silence the warning; that's the wrong directory.