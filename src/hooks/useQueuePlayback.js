import { useCallback, useRef } from 'react';
import { getPayloadTypeFromItem, resolveSectionForQueueItem } from '../utils/queueItemMeta';

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
  showToast,
  onQueueItemSelected,
  onMediaQueueItemPlayed,
}) {
  const pendingBibleClickIdRef = useRef(null);

  const playQueueItem = useCallback(
    async (index) => {
      if (index < 0 || index >= projectorQueue.length) return;

      const item = projectorQueue[index];
      const payloadType = getPayloadTypeFromItem(item);
      const resolvedSection = resolveSectionForQueueItem(item);
      if (typeof onQueueItemSelected === 'function') {
        onQueueItemSelected(item);
      }
      setActiveQueueIndex(index);
      setActiveSection(resolvedSection);
      if (resolvedSection === 'media' && typeof onMediaQueueItemPlayed === 'function') {
        onMediaQueueItemPlayed(item);
      }

      if (item.payload?.type === 'text') {
        applyTextPayloadToEditor(item.payload);
      }

      if (
        resolvedSection === 'media' &&
        (payloadType === 'ppt' || payloadType === 'pdf')
      ) {
        pendingBibleClickIdRef.current = null;
        setActivePreloadItem({
          type: item.payload.type,
          payload: {
            type: payloadType,
            path: item.payload.path,
            name: item.payload.name || item.title,
            deferProject: payloadType === 'ppt' || payloadType === 'pdf',
          },
          token: Date.now(),
        });
        return;
      }

      if (resolvedSection === 'songs' && payloadType === 'song') {
        pendingBibleClickIdRef.current = null;
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

      if (resolvedSection === 'bible' && payloadType === 'bible') {
        const isSecondClickSameItem = pendingBibleClickIdRef.current === item.id;
        pendingBibleClickIdRef.current = isSecondClickSameItem ? null : item.id;

        // Bible queue uses strict two-step behavior:
        // first click always preload/show selection only, second click on same item projects.
        setActivePreloadItem({
          type: 'bible',
          payload: {
            ...item.payload,
            title: item.title,
            deferProject: !isSecondClickSameItem,
          },
          token: `${Date.now()}-${index}-${item.id || ''}`,
        });
        // Bible playback is resolved/projected by BibleBrowser preload flow.
        return;
      } else {
        pendingBibleClickIdRef.current = null;
        setActivePreloadItem(null);
      }

      try {
        const playableData =
          item.payload?.type === 'youtube'
            ? await resolveYouTubePayload({
                ...item.payload,
                videoId: item.payload.videoId || getYouTubeVideoId(item.payload),
                url: normalizeYouTubeUrl(item.payload),
                name: item.payload.name || item.title || 'YouTube',
              })
            : item.payload;
        pushToProjector(playableData);
      } catch (err) {
        showToast(`YouTube play failed: ${err.message || 'Unknown error'}`, 'error');
      }
    },
    [
      projectorQueue,
      setActiveQueueIndex,
      setActiveSection,
      applyTextPayloadToEditor,
      setActivePreloadItem,
      resolveYouTubePayload,
      getYouTubeVideoId,
      normalizeYouTubeUrl,
      pushToProjector,
      showToast,
      onQueueItemSelected,
      onMediaQueueItemPlayed,
    ]
  );

  const playPrev = useCallback(() => {
    if (projectorQueue.length === 0) return;
    const nextIndex = activeQueueIndex <= 0 ? 0 : activeQueueIndex - 1;
    playQueueItem(nextIndex);
  }, [activeQueueIndex, projectorQueue.length, playQueueItem]);

  const playNext = useCallback(() => {
    if (projectorQueue.length === 0) return;
    const nextIndex =
      activeQueueIndex < 0 ? 0 : Math.min(activeQueueIndex + 1, projectorQueue.length - 1);
    playQueueItem(nextIndex);
  }, [activeQueueIndex, projectorQueue.length, playQueueItem]);

  return {
    playQueueItem,
    playPrev,
    playNext,
  };
}
