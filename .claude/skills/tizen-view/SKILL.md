---
name: tizen-view
description: Creates a new view class under app/js/ui/ following the show()/hide()/load(params) lifecycle, registers it in App.js view map, and wires a hash route via Router.addRoute('/path', handler). Handles manual focus with .focusable + .selected classes and Enter keydown (no pointer/mouse events). Use when user says 'add view', 'add screen', 'new page', 'add route', or creates files under app/js/ui/. Do NOT use for player overlay controls (extend PlayerView.js methods like toggleInfoPanel/cycleSubtitles instead), for non-routed reusable components, or for API/manager classes (those live under app/js/api/).
paths:
  - app/js/ui/**/*.js
  - tests/unit/ui/**/*.js
---
# Tizen View Skill

Creates a new routed screen in the Phlex Tizen TV client following the exact pattern used by `HomeView.js`, `LibraryView.js`, and `DetailView.js`.

## Critical

- **Views never call `fetch` directly.** They go through a manager singleton (`libraryManager`, `sessionManager`, etc.) which goes through `app/js/api/ApiClient.js`. If the data your view needs has no manager method, add the endpoint to `ApiClient.js` and expose it via the appropriate manager FIRST, then write the view.
- **No pointer/mouse events.** TV runtime has keydown/keyup only. Use `.focusable` class + `tabindex="0"` and listen for `click` (fires on Enter/OK) plus `keydown` with `e.key === 'Enter'` as a fallback — exactly as `LibraryView.js:131-135` does.
- **Always escape user/server strings** with `Helpers.escapeHtml(...)` from `app/js/utils/Helpers.js` when interpolating into template strings. Never inject raw API fields into `innerHTML`.
- **Back navigation goes through `window.app?.navigateBack()`**, not `history.back()`. The Samsung BACK key (10009) is routed through `RemoteManager`.
- **No framework, no JSX, no virtual DOM.** Use template-literal strings assigned to `this.container.innerHTML` — the project is vanilla ES2022 modules.
- **4-space indent, single quotes, semicolons, `===` only, braces always.** ESLint is CI-enforced; `npm run lint` must pass.

## Instructions

### Step 1 — Confirm the data path exists

Before writing the view, check whether the data it needs is already exposed through a manager:

```bash
grep -n "async \|^class" app/js/api/LibraryManager.js app/js/api/SessionManager.js app/js/api/PlayerManager.js app/js/api/AuthManager.js
```

If the needed call is missing, stop and add it: method on `ApiClient.js`, then a thin wrapper on the appropriate manager. **Verify** the manager method exists and is exported as a default singleton instance (e.g. `export default new LibraryManager();`) before proceeding.

### Step 2 — Create the view file

Create `app/js/ui/<Name>View.js` (PascalCase, suffix `View`). Use this exact skeleton — it mirrors `HomeView.js` / `LibraryView.js`:

```javascript
/**
 * <Name> View
 * <one-line purpose>
 */

import libraryManager from '../api/LibraryManager.js'; // or whichever manager
import Logger from '../utils/Logger.js';
import Helpers from '../utils/Helpers.js';

class <Name>View {
    constructor(container) {
        this.container = container;
        // view-specific state
        this.data = null;
        this.selectedIndex = 0;
    }

    /**
     * Load data and render
     */
    async load(params) {
        try {
            this.data = await libraryManager.<methodFromStep1>(params);
            this.render();
            this.setupNavigation();
        } catch (error) {
            Logger.error('Failed to load <name> view', error);
            this.renderError(error.message);
        }
    }

    render() {
        const html = `
            <div class="<name>-view">
                <div class="<name>-header">
                    <button class="back-btn focusable" id="backBtn">
                        <span class="icon-back"></span>
                        <span>Back</span>
                    </button>
                    <h1 class="<name>-title">${Helpers.escapeHtml(this.data?.Name || '')}</h1>
                </div>
                <!-- view content; every interactive element must have class="focusable" and tabindex="0" -->
            </div>
        `;
        this.container.innerHTML = html;
    }

    setupNavigation() {
        const backBtn = this.container.querySelector('#backBtn');
        backBtn?.addEventListener('click', () => {
            window.app?.navigateBack();
        });

        const items = this.container.querySelectorAll('.focusable');
        items.forEach((el) => {
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    el.click();
                }
            });
        });

        // Focus first focusable element
        const first = this.container.querySelector('.focusable');
        if (first) {
            first.classList.add('selected');
            first.focus();
        }
    }

    renderError(message) {
        this.container.innerHTML = `
            <div class="error-view">
                <button class="back-btn focusable" id="backBtn">Back</button>
                <h2>Error</h2>
                <p>${Helpers.escapeHtml(message)}</p>
            </div>
        `;
        this.container.querySelector('#backBtn')?.addEventListener('click', () => {
            window.app?.navigateBack();
        });
    }

    show() {
        this.container.style.display = 'block';
    }

    hide() {
        this.container.style.display = 'none';
    }
}

export default <Name>View;
```

Note: `HomeView.show()` calls `this.load()` because it takes no params; views that take params (like `LibraryView`, `DetailView`) leave `show()` as just the display toggle and rely on `App.js` calling `view.load(params)` before `showView()`.

**Verify** before proceeding: `npm run lint -- app/js/ui/<Name>View.js` passes.

### Step 3 — Register the view in App.js

Edit `app/js/ui/App.js`:

1. Add the import next to the others (top of file, alphabetical-ish — see lines 7–10):
   ```javascript
   import <Name>View from './<Name>View.js';
   ```
2. Register in `createViews()` (around line 52–59):
   ```javascript
   this.views.set('<name>', new <Name>View(container));
   ```
   Key is lowercase, matches the route segment.

### Step 4 — Add the route and navigation helper

In `App.js` `setupRoutes()` (around line 64–72), add the route. Match existing patterns:

- No params: `this.router.addRoute('/<name>', () => this.showView('<name>'));`
- With param: `this.router.addRoute('/<name>/:id', (params) => this.show<Name>(params.id));`

For param routes, also add a navigation helper method on `App` (mirroring `showLibrary`, `showItem`, `playItem` at lines 177–199):

```javascript
async show<Name>(id) {
    const view = this.views.get('<name>');
    await view.load(id);
    this.showView('<name>');
}
```

**Important**: load data BEFORE `showView()` so the view is visible only once populated.

### Step 5 — Wire the entry point

Figure out where users navigate INTO this view from. Existing pattern: the originating view calls `window.app?.show<Name>(id)` in its click handler (see `HomeView.js:114` → `selectLibrary`, `LibraryView.js:149` → `selectItem`). Add the same call wherever this new view should be reachable from.

### Step 6 — Add unit test

Create `tests/unit/ui/<Name>View.test.js` (mirrors source structure under `tests/unit/`). Use `jsdom` (Jest's default for this project) and import via relative paths from `app/js/`. Mock the manager(s) with `jest.unstable_mockModule` or by setting up a `__mocks__` shim — see `tests/unit/api/ApiClient.test.js` for the existing testing style.

Minimum coverage: constructor, `load()` success, `load()` error path, `show()`/`hide()` toggling `container.style.display`.

### Step 7 — Verify

Run the full gate, in this order, and confirm each is green before declaring done:

```bash
npm run lint
npx jest tests/unit/ui/<Name>View.test.js
npm test
npm run build:dev
```

Manually smoke-test in the dev server if the change is UI-visible:

```bash
npm run serve   # open http://localhost:8080, navigate via keyboard (Arrow keys + Enter, no mouse)
```

## Examples

### Example 1 — Add a "Search" view with no route param

**User says**: "Add a search screen at /search"

**Actions**:
1. Confirm `libraryManager.searchItems(query)` exists — it doesn't. Add `searchItems()` on `ApiClient.js` (e.g. `GET /Items?searchTerm=...`), wrap on `LibraryManager.js`.
2. Create `app/js/ui/SearchView.js` using the skeleton. State is `{ query: '', results: [] }`. `render()` includes an `<input class="focusable" id="searchInput">` and a results grid.
3. `App.js`: `import SearchView from './SearchView.js';` + `this.views.set('search', new SearchView(container));`
4. `App.js` `setupRoutes()`: `this.router.addRoute('/search', () => this.showView('search'));`
5. Add a search affordance to `HomeView.js` that calls `window.location.hash = '#/search';` (or a helper on `app`).
6. `tests/unit/ui/SearchView.test.js` + run the full Step 7 gate.

**Result**: New routed view that fetches and renders search results, fully keyboard-navigable, lint+test+build clean.

### Example 2 — Add a "Settings" view without a backing API

**User says**: "Add a settings screen with toggles for log level and server URL"

**Actions**:
1. No manager call needed — use `Storage` (`app/js/utils/Storage.js`) for persistence directly inside the view's handlers.
2. Create `app/js/ui/SettingsView.js`. `load()` reads current values from `Storage`, `render()` builds form, `setupNavigation()` wires `change` + `keydown` Enter handlers.
3. Register + route as Steps 3–4 (`'/settings'`, no params).
4. Add a "Settings" button to `HomeView`'s footer (next to the existing logout button at line 59).
5. Test + run Step 7 gate.

## Common Issues

- **Lint error `Unexpected token` or `Parsing error`**: You probably used JSX or a non-ES2022 feature. Project is vanilla template-literal HTML — no JSX, no decorators. Re-run `npm run lint -- app/js/ui/<Name>View.js`.
- **`window.app?.show<Name> is not a function`**: You forgot the navigation helper from Step 4, or the helper name doesn't match the call site. Helper must be a method on the `App` class (not on the view), defined alongside `showLibrary`/`showItem` (App.js:177–199).
- **View renders blank**: Check that `App.js` is calling `await view.load(params)` BEFORE `this.showView('<name>')`. If you call `showView` first, the container is visible but empty until `load()` resolves.
- **`Cannot read properties of null (reading 'addEventListener')`**: `this.container.querySelector('#backBtn')` returned null. The element ID in `render()` and `setupNavigation()` don't match, or `render()` wasn't called before `setupNavigation()`.
- **Old view content flashes during navigation**: You're calling `view.show()` (which sets `display: block`) before `load()` completes. Either follow Step 4's pattern (load → show) or have the view's `render()` show a loading skeleton first.
- **Keyboard navigation skips an element**: Element is missing `class="focusable"` or `tabindex="0"`. The remote handler walks `.focusable` elements; anything else is invisible to navigation.
- **`SyntaxError: Cannot use import statement outside a module`** running a script from `scripts/`: Don't run `node scripts/*.js` directly — those files are CommonJS but `package.json` declares `"type": "module"`. Use the npm scripts (`npm run build:dev`, etc.).
- **Tests fail with `ReferenceError: document is not defined`**: Confirm the Jest config in `package.json` is using `jsdom` env (it is, project-wide). For your view test, you may need `document.body.innerHTML = '<div id="app"></div>';` in `beforeEach`.
- **`npm ci` fails in CI**: Don't "fix" this — `package-lock.json` is intentionally gitignored and CI uses `npm install`. See the project CLAUDE.md "Quirks" section.