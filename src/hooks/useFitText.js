import { useCallback, useEffect, useRef, useState } from 'react';
import { computeFitScale, quantizeFitScale, usableHeight } from '../utils/textFit';

/**
 * Scales a block of text down so it fits the box around it.
 *
 * Measures the content against its container and returns a transform scale.
 * Remeasures when the container resizes (the projector window moving to another
 * display) and whenever `deps` change (new slide, new font size).
 *
 * Returns `{ containerRef, contentRef, reserveRef, scale, tight, overflowing,
 * reserveHeight }`. `tight` means it fits only by going below a comfortable
 * reading size; `overflowing` means it did not fit even at the absolute bound.
 *
 * Attach `reserveRef` to anything overlaid inside the container that the text
 * must not run under — the Bible reference line is positioned absolutely at the
 * bottom, so without this the passage could be scaled to "fit" and still end up
 * underneath it. `reserveHeight` is that measured height, so the caller can
 * re-centre the text on the band it was fitted into.
 */
export default function useFitText(deps = []) {
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const reserveRef = useRef(null);
  const [fit, setFit] = useState({ scale: 1, tight: false, overflowing: false, reserveHeight: 0 });
  // TEMPORARY: the raw figures, so a diagnostic build can show why a passage
  // was or was not scaled. Remove with the overlay in ProjectorTextLayer.
  const [debug, setDebug] = useState(null);

  /**
   * Measures and commits. Returns false when the box has no layout yet, so the
   * caller can try again rather than settling for "unscaled" — which is what
   * left text spilling off both the top and the bottom of the screen.
   */
  const measure = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return false;

    // Measure the content at its natural size. A transform does not affect
    // layout, so this is belt and braces rather than strictly required.
    const previous = content.style.transform;
    content.style.transform = 'none';
    const contentHeight = content.scrollHeight;
    content.style.transform = previous;

    // The container is padded away from the screen edges, and anything overlaid
    // at the bottom takes space the text cannot use.
    const style = typeof window !== 'undefined' ? window.getComputedStyle(container) : null;
    const padding =
      (Number.parseFloat(style?.paddingTop) || 0) + (Number.parseFloat(style?.paddingBottom) || 0);
    const reserved = reserveRef.current?.offsetHeight || 0;
    const { available, measured } = usableHeight({
      clientHeight: container.clientHeight,
      padding,
      reserved,
    });
    const next = computeFitScale({ contentHeight, availableHeight: available });
    const scale = quantizeFitScale(next.scale);
    // TEMPORARY: recorded even when unmeasured, so a build can show that case.
    setDebug({
      clientHeight: container.clientHeight,
      padding: Math.round(padding),
      reserved,
      contentHeight,
      available: Math.round(available),
      measured,
      scale,
    });
    if (!measured) return false;

    setFit((current) =>
      current.scale === scale &&
      current.tight === next.tight &&
      current.overflowing === next.overflowing &&
      current.reserveHeight === reserved
        ? current
        : { scale, tight: next.tight, overflowing: next.overflowing, reserveHeight: reserved }
    );
    return true;
  }, []);

  // Serialize deps so a new array identity on every render does not retrigger.
  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    let frame = 0;
    // The projector window can mount before it has been given a size. Keep
    // asking until there is a layout to measure against.
    const attempt = () => {
      if (measure()) return;
      if (typeof requestAnimationFrame !== 'function') return;
      frame = requestAnimationFrame(attempt);
    };
    attempt();

    const container = containerRef.current;
    const observer =
      container && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => measure())
        : null;
    if (observer) {
      observer.observe(container);
      if (contentRef.current) observer.observe(contentRef.current);
    }

    return () => {
      if (frame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [measure, depsKey]);

  // Fonts load after first paint, and text measured with a fallback font can be
  // a different height, so measure again once the real fonts are ready.
  useEffect(() => {
    const fonts = typeof document !== 'undefined' ? document.fonts : null;
    if (!fonts?.ready?.then) return;
    let cancelled = false;
    fonts.ready.then(() => {
      if (!cancelled) measure();
    });
    return () => {
      cancelled = true;
    };
  }, [measure, depsKey]);

  return {
    containerRef,
    contentRef,
    reserveRef,
    scale: fit.scale,
    tight: fit.tight,
    overflowing: fit.overflowing,
    reserveHeight: fit.reserveHeight,
    measure,
    debug,
  };
}
