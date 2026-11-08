# 0.3.224

- Version: 0.3.224
- Build date: 2026-11-08
- Installer: not yet built

## Highlights

Second of the three large components. `MediaManager` kept the PowerPoint
conversion and slide view in five independent `useState` values that could
disagree; they are now one tested state machine, which fixes three stale-state
bugs in the PPT view.

## Fixed Issues

- **Converting a second deck showed the first one's slides.** Starting a
  conversion set the new source path and the converting flag but left the
  previous deck's `pptSlides` and `currentSlideIndex` in place. So while
  document B converted, the view showed A's slides under B's name — and
  clicking one projected a slide from the wrong document. Starting a conversion
  now clears everything belonging to the last one.
- **A failed conversion's error could sit on screen while viewing a PDF.**
  Opening a PDF cleared `pptSlides` but not `pptError`, `pptSourcePath` or
  `currentSlideIndex`. Opening a PDF now puts the deck away completely.
- **The slide index was unbounded.** Nothing clamped it, so after switching from
  a long deck to a shorter one it could point past the end. It is now clamped to
  the deck that is actually open.
- **A `null` slide index would have projected slide 1.** `Number(null)` is `0`,
  so a null index read as "project the first slide" rather than as nonsense.
  Caught by a test while writing the reducer, and now rejected.
- **A conversion that reported success with zero slides** is treated as a
  failure by the reducer rather than as an empty deck. The component already
  took its error path for this, so this is defence in depth.

## Stability / Reliability

- `src/utils/pptViewer.js` holds the transitions as a pure reducer with **13
  unit tests**. The rule: only one document is open at a time, so every entry
  point clears what belonged to the last one.
- `status` replaces the separate converting flag, so "converting" and "has
  slides" can no longer both be true.
- No-op actions return the identical state object, so React skips the re-render.
- `useState` in `MediaManager` went from 17 to 12. Every read site is unchanged
  — the values are destructured from the reducer state under their old names —
  so the diff is confined to the places that used to set them.
- All 5 reducer actions are used by the component; none is dead.

## Deliberately out of scope

The PDF side (`pdfLoading`, `activePdf`, `currentPdfPage`) was **left alone**.
`activePdf` holds a live PDF.js document handle alongside its render data, so
consolidating it means moving a worker handle between state and a ref. A leaked
PDF worker is exactly the bug fixed in 0.3.222, and it is not worth risking in
the same change as unrelated cleanup. It needs its own release and its own
verification.

Reassuringly, no cross-kind inconsistency needed the PDF side to change: opening
a PPT already cleared the PDF state completely. Only the reverse direction was
incomplete, and that is fixed here.

## Breaking Changes

- None intended. The behavior changes above are the bug fixes.

## Known Issues

- **Not exercised in a running app.** The reducer is unit tested, but
  `MediaManager` has no component tests — it is coupled to Tauri calls, PDF.js
  and three contexts. **Converting a PPT, converting a second one straight
  after, switching between a PPT and a PDF, and paging a deck with the arrow
  keys are the checks this needs.**
- `SongManager.jsx` (18 `useState`) is unchanged and follows next.
- Unchanged from earlier releases: the text fit has not been seen working in the
  app, the overflow warning is not displayed anywhere, the installer is
  unsigned, and the single-instance guard and panic hook are unverified in a
  build.

## Validation Evidence

- `npm test`: 107 pass (was 94)
- `npm run test:components`: 27 pass
- `npm run lint`: clean · `npx prettier --check` on the touched files: clean
- `npm run build`: succeeds
- `npm run -s commercial:gate`: pass
- Diff audited line by line: every change is the rewiring, the new comment, or
  Prettier rewrapping three pre-existing long lines.
- Installer not built for this version.

## Rollback

- Previous version: 0.3.223
- Reverting `MediaManager.jsx` and `src/utils/pptViewer.js` together restores
  the five separate values and the inconsistencies above.
