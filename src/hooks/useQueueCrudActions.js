import { useCallback } from 'react';

export default function useQueueCrudActions({
  addOrUpdateQueueItem,
  getQueueItemTitle,
  updateActiveQueueItem,
  moveQueueItem,
  removeActiveQueueItem,
  startRenameQueueItem,
  commitRenameQueueItem,
  cancelRenameQueueItem,
  clearQueue,
}) {
  const addSongQueueItem = useCallback((payload, title) => {
    if (!payload) return;
    const nextTitle = title || getQueueItemTitle(payload);
    addOrUpdateQueueItem(payload, nextTitle, 'songs');
  }, [addOrUpdateQueueItem, getQueueItemTitle]);

  const addBibleQueueItem = useCallback((payload, title) => {
    if (!payload) return;
    const nextTitle = title || getQueueItemTitle(payload);
    addOrUpdateQueueItem(payload, nextTitle, 'bible');
  }, [addOrUpdateQueueItem, getQueueItemTitle]);

  const updateSelectedQueueItem = useCallback((payload, title, expectedSection = null, options = {}) => {
    updateActiveQueueItem(payload, title, expectedSection, options);
  }, [updateActiveQueueItem]);

  const moveQueueItemByIndex = useCallback((fromIndex, toIndex) => {
    moveQueueItem(fromIndex, toIndex);
  }, [moveQueueItem]);

  const removeSelectedQueueItem = useCallback(() => {
    removeActiveQueueItem();
  }, [removeActiveQueueItem]);

  const startRenameSelectedQueueItem = useCallback((item) => {
    startRenameQueueItem(item);
  }, [startRenameQueueItem]);

  const commitRenameSelectedQueueItem = useCallback(() => {
    commitRenameQueueItem();
  }, [commitRenameQueueItem]);

  const cancelRenameSelectedQueueItem = useCallback(() => {
    cancelRenameQueueItem();
  }, [cancelRenameQueueItem]);

  const clearAllQueueItems = useCallback(() => {
    clearQueue();
  }, [clearQueue]);

  return {
    addSongQueueItem,
    addBibleQueueItem,
    updateSelectedQueueItem,
    moveQueueItemByIndex,
    removeSelectedQueueItem,
    startRenameSelectedQueueItem,
    commitRenameSelectedQueueItem,
    cancelRenameSelectedQueueItem,
    clearAllQueueItems,
  };
}
