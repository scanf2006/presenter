# 0.3.213

- Version: 0.3.213
- Build date: 2026-10-21
- Installer: not yet built

## Highlights

Internal restructuring only. No command, payload, stored file or user-visible
behavior changed.

## Stability / Reliability

- `src-tauri/src/lib.rs` held 37 commands in 1,988 lines (64 KB) while the rest
  of the backend was already split into modules. It is now 584 lines (17.5 KB)
  and keeps what is genuinely cross-cutting: display and projector commands, the
  queue and license command wrappers, the window controls, setup import/export
  and `run()`. Six modules were extracted:

  | Module      | Holds                                                      |
  | ----------- | ---------------------------------------------------------- |
  | `bible.rs`  | bundled databases, book/verse/search queries               |
  | `media.rs`  | managed library import, listing, deletion, path and type rules |
  | `songs.rs`  | schema migration, list/save/delete, web import commands    |
  | `youtube.rs`| URL parsing, bundled tool lookup, cache download           |
  | `ppt.rs`    | conversion script lookup, running it, collecting slides     |
  | `health.rs` | the startup health report                                   |

  The move was mechanical: items were relocated whole, with visibility widened
  to `pub(crate)` only where another module needs them. The compiler verifies
  completeness, and the build is clean with no warnings.

- Test guards no longer name the file a thing lives in. Three guards broke
  during this split although nothing they guard had changed, because they read
  `src-tauri/src/lib.rs` directly. They now go through
  `tests/helpers/rust-sources.js`, which searches the Rust sources and, where a
  guard needs the code around a match, returns the file that actually contains
  it. The same brittleness would have returned on the next module move.

## Breaking Changes

- None.

## Known Issues

- `.git` is still about 496 MB because the media blobs removed from tracking in
  0.3.212 remain in history. Shrinking it requires rewriting history, which
  rewrites every commit id.
- `SongManager.jsx` (45 KB), `MediaManager.jsx` (41 KB) and `BibleBrowser.jsx`
  (34 KB) remain large. Unlike the Rust split, a React split cannot be verified
  by the compiler or by any test in this project — there are no component tests
  — so it is deliberately left for separate work that can be reviewed on its
  own.
- `license_store.rs` is now the largest backend file at 28 KB. It is cohesive,
  so it was left alone.

## Validation Evidence

- `cargo check`: pass, no warnings
- `cargo test` (35), `cargo fmt --check`: pass
- `npm test` (47), `npm run lint`: pass
- `npm run -s commercial:gate`: pass
- Installer not built for this version. Because this release only moves code,
  a build and an install smoke test are the main remaining checks before
  shipping it.

## Rollback

- Previous version: 0.3.212
- Revert this change set. It is a single mechanical move and does not interact
  with the fixes in 0.3.212.
