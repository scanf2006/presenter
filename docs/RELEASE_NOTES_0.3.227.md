# 0.3.227

- Version: 0.3.227
- Build date: 2026-11-09
- Installer: `churchdisplay-pro_0.3.227_x64-setup.exe` (zh-CN, x64 NSIS)

## Highlights

Follow-up to the text fitting, after a report that a long passage was cut off at
**both the top and the bottom**. That symmetry was the clue: the container
centres its content, so clipping at both ends means no scaling was applied at
all, rather than too little.

## How this was diagnosed

jsdom performs no layout, so no test in this project can exercise the
measurement — which is how both earlier attempts shipped with the bug intact.
Instead the exact DOM nesting, CSS and arithmetic were reproduced in a real
browser engine and measured directly.

That confirmed the good news: **the scaling arithmetic is correct.** At
1920×1080 with a deliberately oversized block, it chose a scale of 0.188 and the
rendered text came out at exactly the available height. The approach is sound.

It also surfaced two real defects, one of which produces precisely the reported
symptom.

## Fixed Issues

### A squeezed container disabled scaling entirely

`computeFitScale` treated a non-positive available height as "not measured
yet" and answered "render unscaled". But a non-positive height has two very
different causes:

- there is no layout yet, where rendering unscaled for one frame is right;
- the box is real, but its padding plus the reserved strip add up to more than
  its own height, where rendering unscaled is the worst possible answer.

In the second case the full-size text was centred and spilled off both ends —
the reported symptom exactly. The probe hit it for real: a container of 48px
with 48px of padding and a 96px reserved strip produced an available height of
**−96**, and the text was left at full size.

`usableHeight()` now separates the two. With no layout it reports *unmeasured*
and the hook retries on the next animation frame instead of settling. With a
real box whose reservations do not fit, it falls back to the box's own height —
fitting the whole box beats fitting nothing.

### Text sat lower than the band it was fitted into

The flex container centres on its own middle, but the space the text may use is
shorter than that by whatever is reserved at the bottom. The text was therefore
centred about 24px below the centre of its actual band, and could still run
under the reference line it was supposed to clear. It is now shifted up by half
the reserved height. The translate is listed before the scale so it moves by
screen pixels rather than scaled ones.

## Stability / Reliability

- The retry moved out of `measure()` and into the effect, so the measuring
  function no longer calls itself. That also satisfies the
  `react-hooks/immutability` rule, which rejected the first version — caught by
  the lint step added to CI in 0.3.212, not by hand.
- `measure()` now returns whether it committed, which is what lets the caller
  decide to retry.
- Four new tests for `usableHeight`: no layout, the ordinary band, reservations
  larger than the box, and a band of exactly zero.

## Breaking Changes

- None.

## Known Issues

- **The measurement is still only verifiable in a built app.** The arithmetic
  and the band logic are unit tested, and the rendering was verified in a real
  browser engine against a faithful copy of the DOM — but not against the
  running projector window. If a passage still does not fit, the two useful
  details are whether it is *unscaled* or *scaled but not enough*, and whether
  plain projected text behaves the same way; those point at different causes.
- The `tight` flag is reported but still not displayed anywhere.
- Splitting a long passage across several slides — what dedicated worship
  software does — remains unimplemented; very long passages become small
  instead.
- Unchanged: the installer is unsigned, there is no updater, and the
  single-instance guard and panic hook are unverified in a built app.

## Validation Evidence

- `npm test`: 133 pass (was 129)
- `npm run test:components`: 27 pass
- `npm run lint`: clean · `npx prettier --check` on the touched files: clean
- `npm run build`: succeeds
- `npm run -s commercial:gate`: pass
- Measured in a real browser engine at 1920×1080: a 5472px block fitted into a
  1031px band at scale 0.188, rendering at exactly 1031px.

## Rollback

- Previous version: 0.3.226
- Reverting `src/utils/textFit.js` and `src/hooks/useFitText.js` together
  restores the previous behavior, including the unscaled fallback.
