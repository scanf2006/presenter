import { useEffect } from 'react';

export default function useActiveTextQueueAutosave({
  activeSection,
  activeQueueIndex,
  projectorQueue,
  textContent,
  buildCurrentTextPayload,
  updateSelectedQueueItem,
}) {
  useEffect(() => {
    if (activeSection !== 'text') return;
    if (activeQueueIndex < 0 || activeQueueIndex >= projectorQueue.length) return;
    const selected = projectorQueue[activeQueueIndex];
    if (!selected || selected.section !== 'text' || selected.payload?.type !== 'text') return;
    const payload = buildCurrentTextPayload(textContent);
    updateSelectedQueueItem(payload, selected.title, 'text', { silent: true });
  }, [
    activeSection,
    activeQueueIndex,
    projectorQueue,
    textContent,
    buildCurrentTextPayload,
    updateSelectedQueueItem,
  ]);
}
