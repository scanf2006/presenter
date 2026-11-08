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

/** Below this the text is too small to read from a pew, so it stops shrinking. */
export const MIN_FIT_SCALE = 0.5;

/**
 * How much to scale text that measures `contentHeight` to fit `availableHeight`.
 *
 * Returns `{ scale, overflowing }`. `overflowing` is true when the content does
 * not fit even at `minScale`, so the UI can tell the operator rather than
 * silently cutting the text off.
 */
export function computeFitScale({ contentHeight, availableHeight, minScale = MIN_FIT_SCALE }) {
  const content = Number(contentHeight);
  const available = Number(availableHeight);
  const floor = Number.isFinite(minScale) ? Math.min(Math.max(minScale, 0.05), 1) : MIN_FIT_SCALE;

  // Before the first measurement, or in a zero-sized box, render unscaled: a
  // guess here would show the wrong size for one frame.
  if (!Number.isFinite(content) || !Number.isFinite(available)) {
    return { scale: 1, overflowing: false };
  }
  if (content <= 0 || available <= 0) return { scale: 1, overflowing: false };
  if (content <= available) return { scale: 1, overflowing: false };

  const exact = available / content;
  if (exact < floor) return { scale: floor, overflowing: true };
  return { scale: exact, overflowing: false };
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
