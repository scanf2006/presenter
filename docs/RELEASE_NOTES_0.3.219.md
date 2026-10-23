# 0.3.219

- Version: 0.3.219
- Build date: 2026-10-23
- Installer: not yet built

## Highlights

The project can now test a React component. That was the missing piece behind
three deferred jobs: splitting the large components, moving to React 19, and
checking a render at all.

## Stability / Reliability

- **Component testing exists.** There was no renderer, no jsdom and no testing
  library, so a broken render could not be caught by anything in the project —
  only by opening the app and looking. Added vitest with
  `@testing-library/react`, `@testing-library/user-event` and jsdom.
- **It runs alongside the existing suite rather than replacing it.** The 62
  `node:test` tests cover pure logic and need no DOM; migrating them would be
  churn for its own sake. The two are separated by extension: `*.test.js`
  belongs to node:test, `*.test.jsx` to vitest, so neither runner sees the
  other's files.
- **Testing Library's automatic cleanup is wired up explicitly**
  (`tests/setup/component-tests.js`). It only registers itself when the test
  framework exposes `afterEach` as a global, which this setup deliberately does
  not, so without that file each test would render into a DOM still holding the
  previous test's markup and queries would match the wrong element.
- **`npm run test:components` runs in CI**, after the existing frontend tests.

## First component covered: LegalModal

`LegalModal` was chosen because it reads from two contexts and touches no Tauri
API, which proves the pattern the large components will need without pulling in
a backend mock. 16 tests, covering behavior that had nothing guarding it:

- **The paid boundary in the UI**: activation is refused until the EULA is
  accepted — the button is disabled, it carries an explanatory title, and the
  hint is shown; once accepted the button works and the hint disappears.
- Clicking the backdrop closes the dialog, while clicking inside the card does
  not. That second one rests on a `stopPropagation` call that would be easy to
  drop, and losing it would close the dialog whenever someone clicked a field.
- The dialog renders nothing at all while closed.
- Licensed and unlicensed states, the acceptance date, and the error and message
  from the last action.
- The device id is read-only, copies to the clipboard, and its button is
  disabled when there is no id to copy.
- The EULA body shows its text, or a placeholder while still loading.

## Breaking Changes

- None.

## Known Issues

- Only one component is covered. The three large components
  (`SongManager.jsx`, `MediaManager.jsx`, `BibleBrowser.jsx`) are still
  untested and unsplit — but splitting them is now verifiable, which it was not
  before.
- React 19 and `@vitejs/plugin-react` 6 are still open. They are no longer
  blocked for lack of tooling, only for lack of coverage on the components that
  would be affected.
- jsdom is not a WebView: it can catch a broken render, not a
  WebView-specific failure. Opening a PDF in an installed build is still a
  manual check.
- Unchanged: the installer is unsigned, there is no updater, and the
  single-instance guard and panic hook from 0.3.218 have not been exercised in a
  running build. GitHub still serves the pre-rewrite objects.

## Validation Evidence

- `npm run test:components`: 16 pass, 1 file
- `npm test`: 62 pass, unchanged, no overlap between the runners
- `npm run lint`: clean
- `npm run build`: succeeds
- `npm audit`: clean at high and above after adding the tooling
- `quality-gate.yml` parses as valid YAML; the new CI step has not run on GitHub
  yet.
- Installer not built for this version.

## Rollback

- Previous version: 0.3.218
- Reverting removes the tooling, the config, the setup file, the LegalModal
  tests and the CI step. Nothing in `src/` was changed for this release.
