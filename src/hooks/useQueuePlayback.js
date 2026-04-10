import { useCallback } from 'react';

export default function useQueuePlayback({
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
  onQueueItemSelected,
  onMediaQueueItemPlayed,
}) {
  const playQueueItem = useCallback(async (index) => {
    if (index < 0 || index >= projectorQueue.length) return;

    const item = projectorQueue[index];
    if (typeof onQueueItemSelected === 'function') {
      onQueueItemSelected(item);
    }
    setActiveQueueIndex(index);
    if (item.section) {
      setActiveSection(item.section);
    }
    if (item.section === 'media' && typeof onMediaQueueItemPlayed === 'function') {
      onMediaQueueItemPlayed(item);
    }

    if (item.payload?.type === 'text') {
      applyTextPayloadToEditor(item.payload);
    }

    if (item.section === 'media' && (item.payload?.type === 'ppt' || item.payload?.type === 'pdf')) {
      setActivePreloadItem({
        type: item.payload.type,
        payload: {
          type: item.payload.type,
          path: item.payload.path,
          name: item.payload.name || item.title,
          deferProject: item.payload.type === 'ppt' || item.payload.type === 'pdf',
        },
        token: Date.now(),
      });
      return;
    }

    if (item.section === 'songs' && item.payload?.type === 'song') {
      setActivePreloadItem({
        type: 'song',
        payload: {
          songId: item.payload.songId,
          songTitle: item.payload.songTitle || item.title,
        },
        token: Date.now(),
      });
      return;
    }

    if (item.section === 'bible' && item.payload?.type === 'bible') {
      setActivePreloadItem({
        type: 'bible',
        payload: {
          ...item.payload,
          title: item.title,
        },
        token: Date.now(),
      });
      return;
    } else {
      setActivePreloadItem(null);
    }

    try {
      const playableData = item.payload?.type === 'youtube'
        ? await resolveYouTubePayload({
            ...item.payload,
            videoId: item.payload.videoId || getYouTubeVideoId(item.payload),
            url: normalizeYouTubeUrl(item.payload),
            name: item.payload.name || item.title || 'YouTube',
          })
        : item.payload;
      pushToProjector(playableData);
    } catch (err) {
      alert(`YouTube play failed: ${err.message || 'Unknown error'}`);
    }
  }, [
    projectorQueue,
    setActiveQueueIndex,
    setActiveSection,
    applyTextPayloadToEditor,
    setActivePreloadItem,
    resolveYouTubePayload,
    getYouTubeVideoId,
    normalizeYouTubeUrl,
    pushToProjector,
    onQueueItemSelected,
    onMediaQueueItemPlayed,
  ]);

  const playPrev = useCallback(() => {
    if (projectorQueue.length === 0) return;
    const nextIndex = activeQueueIndex <= 0 ? 0 : activeQueueIndex - 1;
    playQueueItem(nextIndex);
  }, [activeQueueIndex, projectorQueue.length, playQueueItem]);

  const playNext = useCallback(() => {
    if (projectorQueue.length === 0) return;
    const nextIndex = activeQueueIndex < 0 ? 0 : Math.min(activeQueueIndex + 1, projectorQueue.length - 1);
    playQueueItem(nextIndex);
  }, [activeQueueIndex, projectorQueue.length, playQueueItem]);

  return {
    playQueueItem,
    playPrev,
    playNext,
  };
}
