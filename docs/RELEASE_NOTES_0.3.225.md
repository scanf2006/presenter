# 0.3.225

- Version: 0.3.225
- Build date: 2026-11-08
- Installer: not yet built

## Highlights

Last of the three large components. `SongManager`'s editor and on-screen
selection become two tested state machines. Unlike the previous two, the live
bugs here are mild — this one is mostly about making an invariant hold by
construction instead of by discipline.

## What was actually wrong

Every path that **opened** the editor or **selected** a song already set all of
its fields. What was incomplete was the **closing**:

- `setEditingSong(null)` on its own — the Cancel button and two other sites —
  left `formTitle`, `formAuthor` and `formLyrics` populated.
- `setSelectedSong(null)` on its own — the back button, the delete path and two
  others — left `selectedSectionIndex` pointing at a section of a song that is
  no longer open.

Nothing visibly broke, because the editor and the section list only render when
their subject exists, and every re-entry overwrote the fields. But the invariant
held only as long as all eight call sites remembered the full set, which is the
kind of thing that holds until someone adds a ninth.

One claim from the review did **not** survive checking, and is worth recording:
switching songs was reported as keeping the previous song's section index. It
does not. The two sites that looked like song switches (`setSelectedSong` at the
style-save and background-picker paths) re-emit the *same* song, where keeping
the section is correct, and the real song-switch path already reset the index.
The reducer now distinguishes the two explicitly — `selectSong` resets,
`updateSong` keeps — so the difference is in the type rather than in a comment.

## Stability / Reliability

- `src/utils/songWorkspace.js` holds both machines as pure reducers with **19
  unit tests**.
- The editor's rule: closing drops the text along with the subject.
- The selection's rule: a section number only means something inside the song it
  came from, so a different song always starts with none chosen. A song arriving
  through `updateSong` that is *not* the one on screen is treated as a selection
  rather than silently inheriting the index.
- `songRemoved` makes the "is this the song being shown?" check itself, so the
  delete path no longer reads `selectedSong` to decide — which also drops
  `selectedSong` from that callback's dependency list.
- Section index validation lives in one place: integers only, and nothing below
  the blank-card sentinel. `BLANK_SECTION_INDEX` is now that shared constant
  rather than a second copy of `-2`.
- No-op actions return the identical state object, so React skips the re-render.
- `useState` in `SongManager` went from 18 to 12. Every read site is unchanged —
  the values are destructured under their old names — and
  `setSelectedSectionIndex` is kept as a setter-shaped wrapper so
  `useSongSectionNavigation` needed no change at all.
- All 10 reducer actions are used; none is dead.

## The three components, done

| Component | `useState` before | after | Reducer tests |
| --- | --- | --- | --- |
| `BibleBrowser` | 19 | 14 | 19 |
| `MediaManager` | 17 | 12 | 13 |
| `SongManager` | 18 | 12 | 19 |

Still separate in each: the appearance/style cluster (font, colour, background),
which travels together as a projection payload, and the search cluster. Those
are cohesive but have no inconsistent combinations to fix, so consolidating them
would be churn without a defect behind it. The PDF cluster in `MediaManager` is
the one real remaining candidate, and it is held back deliberately — see
0.3.224.

## Breaking Changes

- None intended.

## Known Issues

- **Not exercised in a running app.** The reducers are unit tested, but
  `SongManager` has no component tests. **Creating a song, editing one,
  cancelling an edit and reopening the editor, deleting the song on screen,
  switching between songs, projecting sections with the arrow keys, and
  importing from the web are the checks this needs.**
- Unchanged from earlier releases: the text fit has not been seen working in the
  app, the overflow warning is not displayed anywhere, the installer is
  unsigned, and the single-instance guard and panic hook are unverified in a
  build.

## Validation Evidence

- `npm test`: 126 pass (was 107)
- `npm run test:components`: 27 pass
- `npm run lint`: clean · `npx prettier --check` on the touched files: clean
- `npm run build`: succeeds
- `npm run -s commercial:gate`: pass
- Diff audited line by line: every change is the rewiring, the new comment, the
  destructuring, or Prettier rewrapping one long import.
- Installer not built for this version.

## Rollback

- Previous version: 0.3.224
- Reverting `SongManager.jsx` and `src/utils/songWorkspace.js` together restores
  the six separate values.
