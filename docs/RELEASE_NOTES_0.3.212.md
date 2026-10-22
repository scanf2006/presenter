# 0.3.212

- Version: 0.3.212
- Build date: 2026-10-21
- Installer: not yet built

## Highlights

Maintenance release from a project review. Closes a real gap in CI, keeps hymn
verses separated on import, removes the remaining panic paths from production
Rust, and replaces tests that asserted on source text with tests that assert on
behavior.

## Fixed Issues

- **CI did not run the frontend checks.** `quality-gate.yml` ran the commercial
  gate and the Rust checks only, so the frontend test suite and ESLint never ran
  on push or pull request — a frontend regression would have left CI green. Both
  now run, before the Rust steps.
- **Imported hymns lost their verse breaks.** All blank lines were stripped, so
  stanzas arrived as one block and had to be split by hand. Line breaks are now
  derived from the page's break tags rather than from newlines in the markup
  (which are only formatting on these pages), so a double break is recognized as
  a verse separator and kept as a single blank line. Leading, trailing and
  repeated blank lines are still collapsed.
- **Panic paths in production Rust.** Five `unwrap()` calls outside test code
  are gone:
  - `lib.rs` resolved the installed-tools path, then rebuilt it with two
    `unwrap()`s; it now computes the path once and returns it only if it exists.
  - `license_store.rs` unwrapped the serialized defaults while migrating legacy
    Electron settings; a non-object now reports damaged data instead of
    aborting.
  - `license_store.rs` unwrapped a spawned child's piped stdout; an absent pipe
    now returns an empty reading.
  - `license_store.rs` unwrapped `max_version` to build its own error message;
    the value is now bound by the check that produced it.

## Stability / Reliability

- **Display topology comparison.** The periodic display refresh compared the old
  and new lists with `JSON.stringify`, which reports a change when the backend
  emits the same fields in a different order — re-rendering every consumer of
  `displays` every five seconds. The comparison moved to
  `src/utils/displayTopology.js`, compares the fields that define a topology,
  and has behavior tests for an unchanged refresh, reordered fields, added,
  removed, moved and resized displays, and malformed input.
- **Tests now assert behavior, not source text.** `tauri-startup-health`,
  `tauri-license` and `tauri-hymn-import` asserted that certain strings appeared
  in source files. Those assertions passed while the code was broken — the hymn
  parser bug fixed in 0.3.211 is exactly that case: the test asserted
  `safe_url` and `HYMN_PREFIX` existed and stayed green while parsing failed.
  The logic they covered is now tested behaviorally (35 Rust tests, 47 frontend
  tests); what remains in those files is a small set of deliberate guards,
  labelled as such, for things no unit test can see: that the commands stay
  wired to the UI, that every projector command still checks projection access,
  and that the import stays restricted to its allowed host.
- Hymn page parsing gained tests for double-break verse separation, newline
  handling, and blank-line collapsing at the edges.

## Repository

- `data/seed/media/` (555 MB across 221 files, including cached videos and
  third-party video content) is no longer tracked and is now ignored. Nothing in
  the app, the build or the installer resources referenced it. The files are
  untouched on disk and remain in git history, so this does not shrink an
  existing clone; removing them from history is a separate, destructive step
  that has not been taken.
- Release notes for 0.3.210 and 0.3.211 were written retroactively; both
  versions shipped installers without notes.

## Breaking Changes

- None.

## Known Issues

- `.git` is still about 496 MB because the media blobs remain in history.
  Shrinking it requires rewriting history, which rewrites every commit id and
  must be coordinated with any other clone.
- `src-tauri/src/lib.rs` is still about 64 KB with 37 commands in one file.
- `SongManager.jsx` (45 KB), `MediaManager.jsx` (41 KB) and `BibleBrowser.jsx`
  (34 KB) remain large. There are no component tests, so splitting them cannot
  be verified automatically and is deliberately left for separate work.
- Song import still supports `christianstudy.com` only. Widening it would change
  a deliberate security boundary.

## Validation Evidence

- `cargo check`, `cargo test` (35), `cargo fmt --check`: pass
- `npm test` (47), `npm run lint`: pass
- Hymn parsing verified against six live pages (c0001, c0100, c0300, c0513,
  c0514, c0600): each returns a title and lyrics, with verse separators present
  where the page has them and no blank lines at the edges.
- `npm run -s commercial:gate`: not run separately; it runs in CI.
- Installer not built for this version; no clean-machine smoke install.
- Physical acceptance (HDMI disconnect/reconnect, sleep/wake, installed
  PowerPoint conversion, in-place upgrade) not performed.

## Rollback

- Previous version: 0.3.211
- Revert this change set. The CI steps, the display comparison helper and the
  verse separation are independent of each other and can be reverted
  individually.
