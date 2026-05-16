---
paths:
  - tests/**
---

# Test Conventions

- Tests mirror `app/js/` under `tests/unit/<layer>/<File>.test.js`. Examples: `tests/unit/api/ApiClient.test.js`, `tests/unit/remote/KeyMapping.test.js`, `tests/unit/utils/Helpers.test.js`.
- Import from the source by relative path: `import { ApiClient, ApiError } from '../../../app/js/api/ApiClient.js';`.
- Jest env is `jsdom` (set in `package.json`); `babel-jest` transforms via `babel.config.js`.
- Structure: outer `describe(ClassName)` → nested `describe(method/feature)` → `it('should …')`. See `ApiClient.test.js` for the canonical layout.
- For singletons, prefer importing the named class export (e.g. `import { ApiClient }` not the default `api` instance) so each test gets a fresh `beforeEach` instance.
- ESLint ignores `*.test.js` — don't fight lint inside tests, but keep formatting consistent.
- `tests/integration/` is wired in `package.json` but the directory does not exist yet; new integration tests should go there.
- Run single file: `npx jest tests/unit/api/ApiClient.test.js`; single test: `npx jest -t "…"`.
