# 0.3.223

- Version: 0.3.223
- Build date: 2026-11-08
- Installer: not yet built

## Highlights

First of the three large components gets its state consolidated. `BibleBrowser`
kept where the reader is in six independent `useState` values that were set
separately and did not always agree; they are now one tested state machine.
Three real inconsistencies fall out of that, plus a silently swallowed error.

## Fixed Issues

These were all reachable, though none was reliably visible — the effects that
follow a navigation change usually reload and overwrite the stale parts. That
was the fragility: correctness depended on effect ordering rather than on the
transition itself.

- **Switching translation reset nothing.** Going from Chinese CUV to English KJV
  left the other translation's verses and the verse selection in place until an
  effect happened to replace them. The reader's position is kept (so the same
  reference reloads in the new translation) and everything loaded for the old
  one is dropped.
- **Picking a different book kept the previous chapter's verse selection.** The
  verses were cleared but `selectedVerses` was not, so the new book could open
  with verses from the old chapter still marked — and those are what the
  projection payload is built from.
- **Picking a new chapter kept the selection too**, and going back to the
  catalogue left the chapter, verses and selection behind.
- **A failed verse read was swallowed.** `getTauriBibleVerses(...)` had a
  `.then()` and no `.catch()`, so a failed read left the chapter blank with
  nothing logged and the context stamp unset — which the queue-preload effect
  then waited on forever. It now logs and dispatches a failure, which clears the
  stamp consistently.

## Stability / Reliability

- `src/utils/bibleNavigation.js` holds the transitions as a pure reducer with
  **19 unit tests**. The rule it encodes: a verse selection, the loaded verses
  and the context stamp only mean something inside one chapter of one
  translation, so anything that changes the translation, book or chapter drops
  all three. Being a pure function, it is verified independently of the
  component, which is what made the rewiring low-risk.
- Verse toggling moved in with it, so the add/remove/sort logic is tested too.
  Order is not cosmetic: the projected reference is built from the first and
  last entries, so an out-of-order selection would read as the wrong range.
- No-op actions return the identical state object, so React skips the re-render
  rather than reconciling an equal-but-new object.
- `useState` in `BibleBrowser` went from 19 to 14. Every read site is unchanged
  — the values are destructured from the reducer state — so the diff is confined
  to the ~25 places that used to set them.
- All 13 reducer actions are used by the component; none is dead.

## Breaking Changes

- None intended. The behavior changes above are the bug fixes: a selection no
  longer survives a change of translation, book or chapter.

## Known Issues

- **This has not been exercised in a running app.** The reducer is unit tested,
  but `BibleBrowser` itself has no component tests — it is heavily coupled to
  Tauri calls and four contexts, so covering it needs mocking that has not been
  written. **Browsing books, chapters and verses, switching translation, and
  projecting a range from the queue are the checks this needs.**
- `MediaManager.jsx` (17 `useState`) and `SongManager.jsx` (18) are unchanged.
  They follow next, one per release, the same way.
- Unchanged from 0.3.222: the text fit has not been seen working in the app, the
  overflow warning is not displayed anywhere yet, the installer is unsigned,
  and the single-instance guard and panic hook are still unverified in a build.

## Validation Evidence

- `npm test`: 94 pass (was 75)
- `npm run test:components`: 27 pass
- `npm run lint`: clean · `npx prettier --check` on the touched files: clean
- `npm run build`: succeeds
- `npm run -s commercial:gate`: pass
- `cargo test`: pass (Rust untouched)
- Diff audited line by line: every change is the rewiring, a replaced comment,
  or Prettier rewrapping.
- Installer not built for this version.

## Rollback

- Previous version: 0.3.222
- Reverting `BibleBrowser.jsx` and `src/utils/bibleNavigation.js` together
  restores the six separate state values, and with them the inconsistencies
  listed above.
