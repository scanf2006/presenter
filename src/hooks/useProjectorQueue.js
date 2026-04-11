import { useCallback, useEffect, useState } from 'react';

const DEFAULT_QUEUE_STORAGE_KEY = 'churchdisplay.projectorQueue.v1';

export default function useProjectorQueue({
  isElectron,
  showToast,
  storageKey = DEFAULT_QUEUE_STORAGE_KEY,
}) {
  const resolveSectionForPayload = useCallback((payload) => {
    if (!payload?.type) return 'media';
    if (payload.type === 'text') return 'text';
    if (payload.type === 'bible') return 'bible';
    if (payload.type === 'lyrics') return 'songs';
    if (payload.type === 'song') return 'songs';
    return 'media';
  }, []);

  const buildQueueItem = useCallback(
    (payload, title, section) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: title || payload?.name || payload?.reference || payload?.type || 'Untitled Content',
      type: payload?.type || 'text',
      payload,
      section: section || resolveSectionForPayload(payload),
      createdAt: Date.now(),
    }),
    [resolveSectionForPayload]
  );

  const getQueueItemTitle = useCallback((payload) => {
    if (!payload) return 'Untitled Content';
    if (payload.type === 'text') return payload.text?.split('\n')?.[0]?.slice(0, 24) || 'Free Text';
    if (payload.type === 'lyrics')
      return payload.text?.split('\n')?.[0]?.slice(0, 24) || 'Lyrics Section';
    if (payload.type === 'bible') return payload.reference || 'Bible';
    if (payload.type === 'song') return payload.songTitle || 'Song';
    if (payload.type === 'image' || payload.type === 'video' || payload.type === 'pdf')
      return payload.name || 'Media';
    return payload.name || payload.type || 'Untitled Content';
  }, []);

  const [projectorQueue, setProjectorQueue] = useState([]);
  const [queueHydrated, setQueueHydrated] = useState(false);
  const [activeQueueIndex, setActiveQueueIndex] = useState(-1);
  const [draggingQueueId, setDraggingQueueId] = useState(null);
  const [editingQueueId, setEditingQueueId] = useState(null);
  const [editingQueueTitle, setEditingQueueTitle] = useState('');

  useEffect(() => {
    const restoreQueue = async () => {
      try {
        if (isElectron && typeof window.churchDisplay?.queueLoad === 'function') {
          const parsed = await window.churchDisplay.queueLoad();
          if (Array.isArray(parsed)) {
            setProjectorQueue(parsed);
          }
          return;
        }
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setProjectorQueue(parsed);
        }
      } catch (err) {
        console.warn('[Queue] restore failed:', err);
      } finally {
        setQueueHydrated(true);
      }
    };
    restoreQueue();
  }, [isElectron, storageKey]);

  useEffect(() => {
    if (!queueHydrated) return;
    const persistQueue = async () => {
      try {
        if (isElectron && typeof window.churchDisplay?.queueSave === 'function') {
          await window.churchDisplay.queueSave(projectorQueue);
          return;
        }
        window.localStorage.setItem(storageKey, JSON.stringify(projectorQueue));
      } catch (err) {
        console.warn('[Queue] persist failed:', err);
      }
    };
    persistQueue();
  }, [projectorQueue, isElectron, queueHydrated, storageKey]);

  const addOrUpdateQueueItem = useCallback(
    (payload, title, section, options = {}) => {
      if (!payload) return;
      const forceAppend = Boolean(options?.forceAppend);
      const nextTitle = title || getQueueItemTitle(payload);
      setProjectorQueue((prev) => {
        if (!forceAppend && activeQueueIndex >= 0 && activeQueueIndex < prev.length) {
          const existing = prev[activeQueueIndex];
          const next = [...prev];
          next[activeQueueIndex] = {
            ...existing,
            title: nextTitle,
            type: payload.type || existing?.type || 'text',
            payload,
            section: section || existing?.section || resolveSectionForPayload(payload),
            updatedAt: Date.now(),
          };
          return next;
        }
        return [...prev, buildQueueItem(payload, nextTitle, section)];
      });
    },
    [activeQueueIndex, buildQueueItem, getQueueItemTitle, resolveSectionForPayload]
  );

  const updateActiveQueueItem = useCallback(
    (payload, title, expectedSection = null, options = {}) => {
      if (!payload) return;
      const silent = Boolean(options?.silent);
      // H4-R2: Use a ref instead of a local object so the toast decision
      // is reliable even when React 18 batches or defers the updater.
      const updateFlagRef = { current: false };
      setProjectorQueue((prev) => {
        if (activeQueueIndex < 0 || activeQueueIndex >= prev.length) {
          updateFlagRef.current = false;
          return prev;
        }
        const existing = prev[activeQueueIndex];
        if (expectedSection && existing?.section && existing.section !== expectedSection) {
          updateFlagRef.current = false;
          return prev;
        }
        const resolvedTitle = title || existing?.title || getQueueItemTitle(payload);
        const resolvedType = payload.type || existing?.type || 'text';
        const resolvedSection =
          expectedSection || existing?.section || resolveSectionForPayload(payload);
        const samePayload =
          JSON.stringify(existing?.payload ?? null) === JSON.stringify(payload ?? null);
        const sameTitle = (existing?.title || '') === resolvedTitle;
        const sameType = (existing?.type || '') === resolvedType;
        const sameSection = (existing?.section || '') === resolvedSection;
        if (samePayload && sameTitle && sameType && sameSection) {
          updateFlagRef.current = false;
          return prev;
        }
        const next = [...prev];
        next[activeQueueIndex] = {
          ...existing,
          title: resolvedTitle,
          type: resolvedType,
          payload,
          section: resolvedSection,
          updatedAt: Date.now(),
        };
        updateFlagRef.current = true;
        return next;
      });
      // In React 18 batched mode the updater runs synchronously within setState,
      // so updateFlagRef.current is set by the time we reach here.
      if (updateFlagRef.current && !silent && typeof showToast === 'function') {
        showToast('Auto-saved to selected queue card');
      }
    },
    [activeQueueIndex, getQueueItemTitle, resolveSectionForPayload, showToast]
  );

  const moveQueueItem = useCallback((fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || toIndex < 0) return;
    setProjectorQueue((prev) => {
      if (fromIndex >= prev.length || toIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setActiveQueueIndex((prev) => {
      if (prev === fromIndex) return toIndex;
      if (fromIndex < prev && toIndex >= prev) return prev - 1;
      if (fromIndex > prev && toIndex <= prev) return prev + 1;
      return prev;
    });
  }, []);

  const removeQueueItem = useCallback((index) => {
    setProjectorQueue((prev) => prev.filter((_, i) => i !== index));
    setActiveQueueIndex((prev) => {
      if (prev === index) return -1;
      if (prev > index) return prev - 1;
      return prev;
    });
  }, []);

  const removeActiveQueueItem = useCallback(() => {
    if (activeQueueIndex < 0 || activeQueueIndex >= projectorQueue.length) return;
    removeQueueItem(activeQueueIndex);
  }, [activeQueueIndex, projectorQueue.length, removeQueueItem]);

  const startRenameQueueItem = useCallback((item) => {
    if (!item?.id) return;
    setEditingQueueId(item.id);
    setEditingQueueTitle(item.title || '');
  }, []);

  const commitRenameQueueItem = useCallback(() => {
    if (!editingQueueId) return;
    const nextTitle = editingQueueTitle.trim();
    if (nextTitle) {
      setProjectorQueue((prev) =>
        prev.map((item) => (item.id === editingQueueId ? { ...item, title: nextTitle } : item))
      );
    }
    setEditingQueueId(null);
    setEditingQueueTitle('');
  }, [editingQueueId, editingQueueTitle]);

  const cancelRenameQueueItem = useCallback(() => {
    setEditingQueueId(null);
    setEditingQueueTitle('');
  }, []);

  const clearQueue = useCallback(() => {
    setProjectorQueue([]);
    setActiveQueueIndex(-1);
  }, []);

  return {
    projectorQueue,
    setProjectorQueue,
    activeQueueIndex,
    setActiveQueueIndex,
    draggingQueueId,
    setDraggingQueueId,
    editingQueueId,
    editingQueueTitle,
    setEditingQueueTitle,
    resolveSectionForPayload,
    getQueueItemTitle,
    addOrUpdateQueueItem,
    updateActiveQueueItem,
    moveQueueItem,
    removeActiveQueueItem,
    startRenameQueueItem,
    commitRenameQueueItem,
    cancelRenameQueueItem,
    clearQueue,
  };
}
