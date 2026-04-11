import { useEffect, useRef } from 'react';

export default function useActiveTextQueueAutosave({
  activeSection,
  activeQueueIndex,
  projectorQueue,
  textContent,
  buildCurrentTextPayload,
  updateSelectedQueueItem,
}) {
  // H3-R2: Use a ref to read projectorQueue inside the effect without depending
  // on the array reference itself, which would cause an infinite loop because
  // updateSelectedQueueItem mutates the queue.
  const queueRef = useRef(projectorQueue);
  useEffect(() => {
    queueRef.current = projectorQueue;
  }, [projectorQueue]);

  useEffect(() => {
    if (activeSection !== 'text') return;
    if (activeQueueIndex < 0 || activeQueueIndex >= queueRef.current.length) return;
    const selected = queueRef.current[activeQueueIndex];
    if (!selected || selected.section !== 'text' || selected.payload?.type !== 'text') return;
    const payload = buildCurrentTextPayload(textContent);
    updateSelectedQueueItem(payload, selected.title, 'text', { silent: true });
  }, [
    activeSection,
    activeQueueIndex,
    textContent,
    buildCurrentTextPayload,
    updateSelectedQueueItem,
  ]);
}
