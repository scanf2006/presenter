// Keeps projected text inside the screen.
//
// Font size is chosen per queue item by whoever prepared the service, so a long
// passage at a large size used to run off the bottom of the projection with
// nothing to stop it and nothing to warn the operator. The text is scaled down
// to fit instead.
//
// The scale is applied as a CSS transform rather than by lowering the font
// size: a transform is linear in the rendered box, so one measurement gives the
// exact factor, while changing the font size reflows the text and changes the
// line count, which needs iterating to converge.

/**
 * Below this the text is small enough that the operator should be told, but it
 * is NOT a reason to stop shrinking.
 *
 * The first version of this treated it as a hard floor: text more than twice
 * too tall was scaled to 50% and then left to run off the screen, on the
 * reasoning that smaller would be unreadable. That was the wrong trade. A
 * large Bible font with several verses is routinely three or four times too
 * tall, so in practice the passage was still cut off — and text you cannot see
 * at all is worse than text that is small. The floor now only raises a flag.
 */
export const COMFORTABLE_MIN_SCALE = 0.5;

/** A sanity bound, not a design choice: below this a measurement is suspect. */
export const ABSOLUTE_MIN_SCALE = 0.1;

/**
 * How much to scale text that measures `contentHeight` to fit `availableHeight`.
 *
 * Returns `{ scale, tight, overflowing }`:
 *  - `tight` means it fits, but only by going below a comfortable reading size,
 *    so the operator may want fewer verses or a smaller chosen font.
 *  - `overflowing` means it does not fit even at the absolute bound, which
 *    takes an extreme amount of text.
 */
export function computeFitScale({
  contentHeight,
  availableHeight,
  minScale = ABSOLUTE_MIN_SCALE,
  comfortableMinScale = COMFORTABLE_MIN_SCALE,
}) {
  const content = Number(contentHeight);
  const available = Number(availableHeight);
  const floor = Number.isFinite(minScale)
    ? Math.min(Math.max(minScale, 0.01), 1)
    : ABSOLUTE_MIN_SCALE;

  // Before the first measurement, or in a zero-sized box, render unscaled: a
  // guess here would show the wrong size for one frame.
  if (!Number.isFinite(content) || !Number.isFinite(available)) {
    return { scale: 1, tight: false, overflowing: false };
  }
  if (content <= 0 || available <= 0) return { scale: 1, tight: false, overflowing: false };
  if (content <= available) return { scale: 1, tight: false, overflowing: false };

  const exact = available / content;
  const scale = Math.max(floor, exact);
  return {
    scale,
    tight: scale < comfortableMinScale,
    // Only when even the absolute bound could not accommodate it.
    overflowing: scale > exact,
  };
}

/**
 * Rounds a scale for use in a style value. Jitter of a fraction of a percent
 * between measurements would otherwise restart the CSS transition on every
 * resize tick.
 */
export function quantizeFitScale(scale) {
  const value = Number(scale);
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.min(1, Math.round(value * 100) / 100);
}

export default computeFitScale;
