import { useEffect, useState } from 'react';
/* eslint-disable react-hooks/exhaustive-deps */

export default function useObservedWidth(ref, deps = []) {
  const [width, setWidth] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = ref?.current;
    if (!el) return;
    const applySize = () => setWidth(el.clientWidth || 0);
    applySize();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', applySize);
      return () => window.removeEventListener('resize', applySize);
    }
    const observer = new ResizeObserver(() => applySize());
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, ...deps]);

  return width;
}
