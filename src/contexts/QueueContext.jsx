import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import useProjectorQueue from '../hooks/useProjectorQueue';
import useQueueCrudActions from '../hooks/useQueueCrudActions';
import useQueuePlayback from '../hooks/useQueuePlayback';
import { useAppContext } from './AppContext';
import { useProjectorContext } from './ProjectorContext';

const QueueContext = createContext(null);

export function useQueueContext() {
  const ctx = useContext(QueueContext);
  if (!ctx) throw new Error('useQueueContext must be used within QueueProvider');
  return ctx;
}

/**
 * QueueProvider manages the projector queue state, CRUD operations, and playback.
 *
 * It requires `applyTextPayloadToEditor` to be supplied via props because the
 * text editor state lives outside this context to avoid circular dependencies.
 */
export function QueueProvider({ applyTextPayloadToEditor, children }) {
  const { isElectron, setActiveSection, showToast, showConfirm } = useAppContext();
  const {
    pushToProjector,
    resolveYouTubePayload,
    getYouTubeVideoId,
    normalizeYouTubeUrl,
    transitionEnabled,
    setTransitionEnabled,
  } = useProjectorContext();

  const [activePreloadItem, setActivePreloadItem] = useState(null);
  const [mediaQueueHomeToken, setMediaQueueHomeToken] = useState(0);
  const [showQueueTypeTags, setShowQueueTypeTags] = useState(() => {
    try {
      return window.localStorage.getItem('churchdisplay.ui.queueTypeTagsVisible.v2') !== '0';
    } catch (_) {
      return true;
    }
  });

  // Persist queue type tags preference
  const setShowQueueTypeTagsAndPersist = useCallback((valueOrUpdater) => {
    setShowQueueTypeTags((prev) => {
      const next = typeof valueOrUpdater === 'function' ? valueOrUpdater(prev) : valueOrUpdater;
      try {
        window.localStorage.setItem('churchdisplay.ui.queueTypeTagsVisible.v2', next ? '1' : '0');
      } catch (_) {
        // ignore persist failures
      }
      return next;
    });
  }, []);

  const {
    projectorQueue,
    activeQueueIndex,
    setActiveQueueIndex,
    draggingQueueId,
    setDraggingQueueId,
    editingQueueId,
    editingQueueTitle,
    setEditingQueueTitle,
    getQueueItemTitle,
    addOrUpdateQueueItem,
    updateActiveQueueItem,
    moveQueueItem,
    removeActiveQueueItem,
    startRenameQueueItem,
    commitRenameQueueItem,
    cancelRenameQueueItem,
    clearQueue,
  } = useProjectorQueue({
    isElectron,
    showToast,
  });

  const {
    addSongQueueItem,
    addBibleQueueItem,
    updateSelectedQueueItem,
    moveQueueItemByIndex,
    removeSelectedQueueItem,
    startRenameSelectedQueueItem,
    commitRenameSelectedQueueItem,
    cancelRenameSelectedQueueItem,
    clearAllQueueItems,
  } = useQueueCrudActions({
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
  });

  const handleMediaQueueItemPlayed = useCallback(() => {
    setMediaQueueHomeToken(Date.now());
  }, []);

  const handleQueueItemSelected = useCallback(
    (item) => {
      const isSongQueueItem = item?.section === 'songs';
      if (isSongQueueItem && transitionEnabled) {
        setTransitionEnabled(false);
      }
    },
    [transitionEnabled, setTransitionEnabled]
  );

  const { playQueueItem, playPrev, playNext } = useQueuePlayback({
    projectorQueue,
    activeQueueIndex,
    setActiveQueueIndex,
    setActiveSection,
    setActivePreloadItem,
    applyTextPayloadToEditor,
    resolveYouTubePayload,
    getYouTubeVideoId,
    normalizeYouTubeUrl,
    pushToProjector,
    showToast,
    onMediaQueueItemPlayed: handleMediaQueueItemPlayed,
    onQueueItemSelected: handleQueueItemSelected,
  });

  const value = useMemo(
    () => ({
      // Queue state
      projectorQueue,
      activeQueueIndex,
      setActiveQueueIndex,
      draggingQueueId,
      setDraggingQueueId,
      editingQueueId,
      editingQueueTitle,
      setEditingQueueTitle,
      getQueueItemTitle,
      // Queue CRUD
      addOrUpdateQueueItem,
      updateActiveQueueItem,
      addSongQueueItem,
      addBibleQueueItem,
      updateSelectedQueueItem,
      moveQueueItemByIndex,
      removeSelectedQueueItem,
      startRenameSelectedQueueItem,
      commitRenameSelectedQueueItem,
      cancelRenameSelectedQueueItem,
      clearAllQueueItems,
      // Playback
      playQueueItem,
      playPrev,
      playNext,
      // Preload
      activePreloadItem,
      setActivePreloadItem,
      // Queue type tags
      showQueueTypeTags,
      setShowQueueTypeTags: setShowQueueTypeTagsAndPersist,
      // Media queue home token
      mediaQueueHomeToken,
    }),
    [
      projectorQueue,
      activeQueueIndex,
      setActiveQueueIndex,
      draggingQueueId,
      setDraggingQueueId,
      editingQueueId,
      editingQueueTitle,
      setEditingQueueTitle,
      getQueueItemTitle,
      addOrUpdateQueueItem,
      updateActiveQueueItem,
      addSongQueueItem,
      addBibleQueueItem,
      updateSelectedQueueItem,
      moveQueueItemByIndex,
      removeSelectedQueueItem,
      startRenameSelectedQueueItem,
      commitRenameSelectedQueueItem,
      cancelRenameSelectedQueueItem,
      clearAllQueueItems,
      playQueueItem,
      playPrev,
      playNext,
      activePreloadItem,
      showQueueTypeTags,
      setShowQueueTypeTagsAndPersist,
      mediaQueueHomeToken,
    ]
  );

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}

export default QueueContext;
