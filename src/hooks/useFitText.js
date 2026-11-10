import { useCallback, useEffect, useRef, useState } from 'react';
import { computeFitScale, quantizeFitScale } from '../utils/textFit';

/**
 * Scales a block of text down so it fits the box around it.
 *
 * Measures the content against its container and returns a transform scale.
 * Remeasures when the container resizes (the projector window moving to another
 * display) and whenever `deps` change (new slide, new font size).
 *
 * Returns `{ containerRef, contentRef, reserveRef, scale, tight, overflowing }`.
 * `tight` means it fits only by going below a comfortable reading size;
 * `overflowing` means it did not fit even at the absolute bound.
 *
 * Attach `reserveRef` to anything overlaid inside the container that the text
 * must not run under — the Bible reference line is positioned absolutely at the
 * bottom, so without this the passage could be scaled to "fit" and still end up
 * underneath it.
 */
export default function useFitText(deps = []) {
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const reserveRef = useRef(null);
  const [fit, setFit] = useState({ scale: 1, tight: false, overflowing: false });

  const measure = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    // Measure the content at its natural size: reading scrollHeight while a
    // scale transform is applied would compound with the previous result and
    // shrink the text a little further on every pass.
    const previous = content.style.transform;
    content.style.transform = 'none';
    const contentHeight = content.scrollHeight;
    content.style.transform = previous;

    // The container is padded away from the screen edges, so the space the text
    // may use is its content box, not its client box.
    const style = typeof window !== 'undefined' ? window.getComputedStyle(container) : null;
    const padding =
      (Number.parseFloat(style?.paddingTop) || 0) + (Number.parseFloat(style?.paddingBottom) || 0);
    // Anything overlaid at the bottom takes space the text cannot use.
    const reserved = reserveRef.current?.offsetHeight || 0;
    const availableHeight = container.clientHeight - padding - reserved;

    const next = computeFitScale({ contentHeight, availableHeight });
    const scale = quantizeFitScale(next.scale);
    setFit((current) =>
      current.scale === scale &&
      current.tight === next.tight &&
      current.overflowing === next.overflowing
        ? current
        : { scale, tight: next.tight, overflowing: next.overflowing }
    );
  }, []);

  // Serialize deps so a new array identity on every render does not retrigger.
  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    measure();
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => measure());
    observer.observe(container);
    if (contentRef.current) observer.observe(contentRef.current);
    return () => observer.disconnect();
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
    measure,
  };
}
