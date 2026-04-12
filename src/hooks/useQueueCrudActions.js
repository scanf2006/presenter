import { useCallback } from 'react';

export default function useQueueCrudActions({
  addOrUpdateQueueItem,
  getQueueItemTitle,
  updateActiveQueueItem,
  moveQueueItem,
  removeActiveQueueItem,
  showConfirm,
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

  const removeSelectedQueueItem = useCallback(async () => {
    const ok = await showConfirm(
      'Delete Selected Queue Card',
      'Are you sure you want to delete the selected queue card?'
    );
    if (!ok) return;
    removeActiveQueueItem();
  }, [removeActiveQueueItem, showConfirm]);

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
    const run = async () => {
      const ok = await showConfirm(
        'Clear Queue',
        'Are you sure you want to clear all queue items?'
      );
      if (!ok) return;
      clearQueue();
    };
    run();
  }, [clearQueue, showConfirm]);

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
