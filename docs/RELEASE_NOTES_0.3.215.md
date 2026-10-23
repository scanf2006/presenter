# 0.3.215

- Version: 0.3.215
- Build date: 2026-10-23
- Installer: not yet built

## Highlights

Closes a high-severity security hole in PDF handling, and takes the project off
two end-of-life toolchains. The PDF fix includes a runtime break that the
upgrade itself introduced, found by a new test rather than by a user.

## Fixed Issues

### PDF.js: arbitrary script execution from a malicious PDF

- The bundled PDF.js was 5.7.284, inside the affected range of
  [GHSA-hq66-cqwq-w95j](https://github.com/advisories/GHSA-hq66-cqwq-w95j)
  (`>=5.6.83 <6.2.108`, high severity): opening a crafted PDF could execute
  arbitrary JavaScript. This was reachable in normal use — `PdfRenderer` and
  `MediaManager` open whatever PDF a user imports, and the library is bundled
  into the shipped app (`dist/assets/pdf.min-*.js`).
- Upgraded to 6.4.299.
- **The upgrade broke document teardown, and would have shipped broken.** PDF.js
  6 removed `destroy()` from the document proxy and left it on the loading task
  that produced it. The app called `pdfDocument.destroy()` in eight places
  across `PdfRenderer.jsx` and `MediaManager.jsx`; every one would have thrown
  `TypeError: pdf.destroy is not a function` at runtime, leaking a PDF worker
  each time a document was closed or replaced. Closing now goes through
  `src/utils/pdfDocument.js`, which accepts either shape, so the same code works
  on 5.x and 6.x and the next major cannot break all eight sites again.
- `pdfjs-dist` was declared in `devDependencies` although it ships in the
  bundle. Moved to `dependencies`.

### Other

- `no-useless-assignment`, a rule new to ESLint 9, caught a dead initializer in
  `decodeLyricsImportBytes` (`src/utils/songMeta.js`): `content` was set to `''`
  and then overwritten on both the success and the failure path.
- Removed three `eslint-disable` directives that no longer suppress anything.
  `eslint-plugin-react-hooks` 7 rewrote its rules, so the `exhaustive-deps`
  directives in `useObservedWidth.js` and the second `set-state-in-effect`
  directive in `PreviewPanel.jsx` were stale. Verified that all 16 react-hooks
  rules are still active afterwards, so this is dead-comment removal and not a
  loss of checking.
- `now_ms()` existed twice, byte-identical, in `lib.rs` and `license_store.rs`.
  One copy remains.
- Two clippy findings: a pair of chained `str::replace` calls in `hymn_import`
  and a comparator-based sort in `media` that is clearer as `sort_by_key`.
- Deleted two stale `build-0.3.202.*` logs from the repository root. `app.log`
  and `build-zh.log` were left alone: the second is rewritten by every build,
  and both are already ignored by git.

## Stability / Reliability

- **New PDF behavior tests** (`tests/pdf-rendering.test.js`, 8 tests). They
  build a minimal PDF in-process, so they need no fixture file, then exercise
  the exact entry point the app imports: the API the components call, page count
  and viewport, text decoding, rejection of a damaged file, and that
  `closePdfDocument` really releases a document from the installed version. It
  was this last test that exposed the `destroy()` removal.
- **Clippy now runs in CI** with `-D warnings`, alongside the existing format,
  compile and test steps. The codebase needed only the two fixes above to pass.
- **Dependency vulnerabilities are now zero.** `npm audit` reported 10 (8 high)
  and reports none. Besides PDF.js, these were Vite dev-server advisories that
  never reached the shipped app; they were cleared within semver by
  `npm audit fix`.
- **ESLint 8 → 9, with flat config.** ESLint 8 is end of life. ESLint 10 was
  deliberately *not* taken: `eslint-plugin-react` still declares support only up
  to `^9.7`, and forcing 10 would have left the React rules unenforced, which is
  worse than trailing a major. `.eslintrc.cjs` is replaced by
  `eslint.config.mjs` with the same rules.
- **Node is pinned.** `.nvmrc` and an `engines` field both say 22, matching what
  CI already used. Divergence between a developer machine and CI is what
  produced the 0.3.210 build failure.
- **Dependabot is configured** for npm, Cargo and Actions, grouped so routine
  bumps arrive as a few reviewable pull requests. Major React bumps are excluded
  on purpose: with no component tests they cannot be verified automatically.

## Packaging

- **A `Release Installer` workflow builds the installer on a clean runner**
  (`workflow_dispatch`, or a `v*` tag). It verifies that the executable's file
  version and the installer's filename both carry the version from
  `package.json`, and records the Authenticode status. Until now every installer
  came from one developer machine; 0.3.210 failed for a reason — local folder
  path casing — that nothing off that machine could reproduce.
- **The installer is still unsigned**, and that cannot be fixed from the
  repository: it needs a code-signing certificate, and since June 2023 the
  private key must sit on approved hardware or in a cloud signing service. The
  steps, the config keys and the verification command are now written down under
  "Code signing" in `docs/COMMERCIAL_RELEASE_CHECKLIST.md`. Customers currently
  see a SmartScreen warning and an "Unknown" publisher on first install.

## Breaking Changes

- None for users. For contributors: ESLint config moved to `eslint.config.mjs`,
  and Node 22 is now declared rather than assumed.

## Known Issues

- **PDF rendering has not been exercised in the running app.** The tests cover
  the library API and the teardown break, but not the desktop WebView. The
  `Uint8Array.prototype.toHex` polyfill in `main.jsx` exists because of a past
  WebView incompatibility with a newer PDF.js, so opening a PDF and checking a
  thumbnail in an installed build is the one check this release still needs.
  A checklist item was added for it.
- `.git` is still about 496 MB; the media blobs untracked in 0.3.212 remain in
  history, and the repository is public, so that third-party video content is
  publicly downloadable. Removing it rewrites every commit id.
- `SongManager.jsx`, `MediaManager.jsx` and `BibleBrowser.jsx` are still large
  and have no component tests.
- Song import still supports `christianstudy.com` only.
- React 18 → 19 and `@vitejs/plugin-react` 4 → 6 are still open, held back for
  the same reason: no component tests.

## Validation Evidence

- `npm audit`: 0 vulnerabilities (was 10, 8 high)
- `npm test`: 55 pass (was 47)
- `npm run lint`: clean, no warnings
- `npm run build`: succeeds, PDF.js 6 bundled
- `npm run -s commercial:gate`: pass
- `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test` (35): pass
- Installer not built; PDF rendering not checked in the app, as noted above.

## Rollback

- Previous version: 0.3.214
- The pieces are independent and can be reverted separately. Reverting the
  PDF.js upgrade alone restores the vulnerability, so prefer reverting a
  specific later change over the whole set.
