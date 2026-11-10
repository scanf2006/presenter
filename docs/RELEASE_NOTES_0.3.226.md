# 0.3.226

- Version: 0.3.226
- Build date: 2026-11-09
- Installer: `churchdisplay-pro_0.3.226_x64-setup.exe` (zh-CN, x64 NSIS)

## Highlights

Fixes the text fitting added in 0.3.222, which did not actually prevent overflow
in the case it was most needed for. Reported from testing: a Bible passage at a
large font with several verses still ran off the screen.

## Fixed Issues

### Long passages were still cut off

The fit had a **hard floor of 0.5**: text more than twice too tall was scaled to
50% and then left to overflow. The reasoning was that smaller than half would be
unreadable from a pew, and the layer reported an `overflowing` flag so the UI
could advise instead — but nothing ever displayed that flag, which 0.3.222
recorded as a known issue.

That was the wrong trade, and the arithmetic shows why it was not an edge case.
The large Bible font is 72px with a line height of 1.9, so a line costs about
137px. On a 1080p projector, after padding, roughly six lines fit. Several verses
easily run to 15–25 lines — two to four times the available height — so the
floor was reached in ordinary use, every time.

**Text you cannot see at all is worse than text that is small.** The floor is
now only a flag:

- Text always shrinks as far as it needs to in order to fit.
- `tight` reports that it fitted only by going below a comfortable reading size,
  so the operator can choose fewer verses or a smaller font.
- `overflowing` is now reserved for the absolute sanity bound of 0.1 — twenty
  times too tall — which no real passage reaches.

### The Bible reference line was not accounted for

The reference in the bottom corner is positioned absolutely and was not part of
the measurement, so a passage could be scaled to "fit" the container and still
end up underneath it. The line is now measured and its height reserved, so the
text is fitted into the space that is actually free.

## Stability / Reliability

- The test that encoded the wrong decision — asserting that shrinking *stops* at
  the floor and overflows — has been replaced by one asserting that a four-times
  oversized passage fits and is flagged. Three further tests cover the comfort
  threshold, the absolute bound, and that quantizing a heavy reduction does not
  round it to zero and hide the text entirely.
- `useFitText` now exposes a `reserveRef` for anything overlaid inside the
  container that text must not run under.

## Breaking Changes

- None. Text that previously overflowed is now smaller instead; text that
  already fitted is unaffected.

## Known Issues

- **The `tight` flag is still not displayed anywhere.** It is reported through
  `onFitChange` and the `shortcuts.overflowWarning` message exists in both
  locales, but the preview does not consume it yet. Carried over from 0.3.222,
  and now the only part of this feature left undone — the overflow itself is
  fixed, so this is advice rather than a defect.
- Very long passages will now be noticeably small rather than clipped. Splitting
  a passage across several slides, which is how dedicated worship software
  handles this, is a larger feature and is not attempted here.
- Unchanged: the installer is unsigned, there is no updater, and the
  single-instance guard and panic hook are still unverified in a built app.

## Validation Evidence

- `npm test`: 129 pass (was 126)
- `npm run test:components`: 27 pass
- `npm run lint`: clean · `npx prettier --check` on the touched files: clean
- `npm run build`: succeeds
- `npm run -s commercial:gate`: pass
- The fitting arithmetic is unit tested, but jsdom performs no layout, so the
  measurement itself is still only verifiable by projecting a long passage in a
  built app. **That is the check this release needs.**

## Rollback

- Previous version: 0.3.225
- Reverting `src/utils/textFit.js` restores the 0.5 floor and with it the
  overflow.
