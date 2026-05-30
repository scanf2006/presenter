import { useCallback } from 'react';
import { useI18n } from '../contexts/I18nContext';

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
  const { locale } = useI18n();
  const isZh = String(locale || 'en').toLowerCase().startsWith('zh');
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
      isZh ? '删除选中队列卡片' : 'Delete Selected Queue Card',
      isZh ? '确定要删除当前选中的队列卡片吗？' : 'Are you sure you want to delete the selected queue card?'
    );
    if (!ok) return;
    removeActiveQueueItem();
  }, [isZh, removeActiveQueueItem, showConfirm]);

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
        isZh ? '清空队列' : 'Clear Queue',
        isZh ? '确定要清空所有队列项目吗？' : 'Are you sure you want to clear all queue items?'
      );
      if (!ok) return;
      clearQueue();
    };
    run();
  }, [clearQueue, isZh, showConfirm]);

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
