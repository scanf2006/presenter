# 0.3.222

- Version: 0.3.222
- Build date: 2026-11-08
- Installer: not yet built

## Highlights

Three things aimed at the moment a service is actually running: blackout is now
a keypress and it can be undone, long text no longer runs off the screen, and
the shortcuts that already existed are finally visible.

## Fixed Issues

### Blackout had no shortcut, and could not be undone

Blackout is the one action that has to be instant — something wrong is on the
screen in front of a congregation and reaching for the mouse is too slow. It was
a toolbar button only.

- **`B` now blacks the screen**, from anywhere in the app.
- **Pressing it again brings back what was on screen.** It used to be one-way:
  `currentSlide` was discarded, so after killing the screen the operator had to
  find and re-send the slide by hand, under exactly the pressure that makes that
  hard. The slide showing at blackout is now remembered and restored.
- The button behaves the same way, so the two cannot disagree.
- Sending anything new ends the blackout, so a later press cannot resurrect a
  slide the operator has moved on from.

Starting and stopping projection is **deliberately not** bound to a key. A
mis-keyed projector stop mid-service costs far more than the seconds a shortcut
saves, and the button is right there.

### Projected text could run off the screen

Font size is chosen per queue item, and the projector text layer had no
`overflow`, no `max-height` and no scaling. A long passage at a large size was
simply cut off at the bottom of the projection, with nothing to warn anyone.

- Text is now **scaled down to fit** its box.
- The scale is applied as a CSS transform, not by lowering the font size. A
  transform is linear in the rendered box, so a single measurement gives the
  exact factor; changing the font size reflows the text and changes the line
  count, which needs iterating to converge.
- Shrinking stops at 50%. Below that it is not readable from a pew, so instead
  of shrinking further the layer reports that it is still overflowing, and the
  `shortcuts.overflowWarning` message is available for the UI to say so.
- Remeasures on container resize (the projector window moving to another
  display), on content change, and once web fonts have loaded — text measured
  in a fallback font is a different height.

### Shortcuts were undiscoverable

Arrow keys, `PageUp`/`PageDown`, `Home` and `End` all worked. Nothing said so,
so in practice only whoever wrote them knew.

- **`?` opens a shortcut list**, and a `?` button sits in the top bar next to
  blackout.
- The list is generated from `src/constants/shortcuts.js`, the same definition
  the key handler reads for the shortcuts it binds, so the help and the
  bindings cannot drift. A test asserts every documented shortcut appears.
- The blackout button's tooltip now names its key.

### Other

- Removed a debug `console.log` from `src/main.jsx` that printed
  `[DIAGNOSTIC] main.jsx Loaded` in red at 20px on every launch, in release
  builds included.

## Stability / Reliability

- **The typing guard is no longer written out three times.** Every global key
  handler has to ask "is the operator typing?" first — without it, searching for
  a hymn advances slides while the letters are entered. That check was duplicated
  in `useSongSectionNavigation`, `MediaManager` and would have been a third copy
  here. It now lives in `src/utils/keyboard.js` with 6 tests, and is also
  slightly more robust: it no longer relies on `instanceof HTMLElement`, which
  fails for an element from another document.
- Single-letter shortcuts ignore events carrying Ctrl, Cmd or Alt, so `Ctrl+B`
  does not reach blackout. Shift is allowed, since `?` needs it.
- 13 new unit tests for the fit maths and the keyboard helpers; 11 new component
  tests for the help panel.

## Breaking Changes

- **Blackout is now a toggle.** Pressing it twice used to leave the screen
  black; it now restores what was showing. This is the intended change — it
  matches how presentation software behaves — but it is a behavior change for
  anyone used to pressing the button twice.

## Known Issues

- **The fit has not been seen working in the real app.** The maths is unit
  tested, but jsdom performs no layout, so `scrollHeight` and `clientHeight` are
  always 0 there and the component tests cannot exercise the measurement at all.
  With a zero measurement the code deliberately renders unscaled, so the
  failure mode is safe, but **projecting a deliberately over-long passage in a
  built app is the check this needs.**
- The overflow message exists in both locales but nothing displays it yet; the
  layer reports the state through `onFitChange` and the preview does not consume
  it. Wiring that into the preview is a follow-up.
- Scaled text and the bible reference line in the bottom corner could still
  overlap in principle; the reference is positioned absolutely and is not part
  of the fit measurement.
- Unchanged: the installer is unsigned, there is no updater, the single-instance
  guard and panic hook from 0.3.218 are still unverified in a running build, and
  the three large components still hold 17-19 `useState` each.

## Validation Evidence

- `npm test`: 75 pass (was 62)
- `npm run test:components`: 27 pass (was 16)
- `npm run lint`: clean
- `npm run build`: succeeds
- `npm run -s commercial:gate`: pass
- `cargo test`: pass (Rust untouched this release)
- i18n parity holds: both locales gained all 14 new keys
- Installer not built for this version.

## Rollback

- Previous version: 0.3.221
- The three changes are independent. Reverting the blackout toggle restores
  one-way blackout; reverting the fit restores clipped overflow; reverting the
  help panel leaves the shortcuts working but undocumented.
