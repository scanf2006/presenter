import React, { createContext, useContext, useRef, useEffect, useCallback, useMemo } from 'react';
import useTextEditorState from '../hooks/useTextEditorState';
import useTextCanvasTransform from '../hooks/useTextCanvasTransform';
import useBackgroundPickerFlow from '../hooks/useBackgroundPickerFlow';
import useActiveTextQueueAutosave from '../hooks/useActiveTextQueueAutosave';
import useObservedWidth from '../hooks/useObservedWidth';
import { useAppContext } from './AppContext';
import { useProjectorContext } from './ProjectorContext';
import { useQueueContext } from './QueueContext';
import { PREVIEW, TEXT_EDITOR } from '../constants/ui';

const TextEditorContext = createContext(null);

export function useTextEditorContext() {
  const ctx = useContext(TextEditorContext);
  if (!ctx) throw new Error('useTextEditorContext must be used within TextEditorProvider');
  return ctx;
}

/**
 * TextEditorProvider owns all free-text editor state, canvas transform,
 * background picker flow, auto-save, and send-to-projector orchestration.
 *
 * It sits below QueueProvider so it can call queue CRUD actions directly.
 * The `applyTextPayloadToEditor` function is exposed via the context so the
 * parent ref-bridge can feed it to QueueProvider (which needs it for queue
 * playback of text items).
 */
export function TextEditorProvider({ children }) {
  const { activeSection, setActiveSection, showToast } = useAppContext();
  const {
    currentSlide,
    pushToProjector,
    normalizeYouTubeUrl,
    getYouTubeVideoId,
    resolveYouTubePayload,
  } = useProjectorContext();
  const {
    projectorQueue,
    activeQueueIndex,
    getQueueItemTitle,
    addOrUpdateQueueItem,
    updateSelectedQueueItem,
  } = useQueueContext();

  // ── DOM refs ──
  const textCanvasRef = useRef(null);
  const textLayerRef = useRef(null);
  const textEditableRef = useRef(null);

  // ── Core text editor state ──
  const {
    textContent,
    setTextContent,
    fontSize,
    setFontSize,
    textFontFamily,
    setTextFontFamily,
    textColor,
    setTextColor,
    textSizePx,
    setTextSizePx,
    textBackground,
    setTextBackground,
    textLayout,
    setTextLayout,
    textSnapGuide,
    setTextSnapGuide,
    buildCurrentTextPayload,
    resetTextEditorState,
    applyTextPayloadToEditor,
  } = useTextEditorState();

  // ── Canvas transform (drag / resize) ──
  const clamp = useCallback((v, min, max) => Math.max(min, Math.min(max, v)), []);

  const { startTextDrag, startTextResize, resetTextTransformState } = useTextCanvasTransform({
    textCanvasRef,
    textLayerRef,
    textLayout,
    setTextLayout,
    textSizePx,
    setTextSizePx,
    clamp,
    setTextSnapGuide,
  });

  // ── Background picker flow ──
  const {
    backgroundPickerTarget,
    songPickedBackground,
    biblePickedBackground,
    openBackgroundPicker: handleOpenBackgroundPicker,
    pickBackgroundFromMedia: handlePickBackgroundFromMedia,
    cancelBackgroundPicker: handleCancelBackgroundPicker,
  } = useBackgroundPickerFlow({
    setActiveSection,
    setTextBackground,
  });

  // ── Text canvas dimensions ──
  const textCanvasWidth = useObservedWidth(textCanvasRef, [activeSection]);
  const textCanvasWidthRatio = Math.max(
    PREVIEW.MIN_WIDTH_RATIO,
    (textCanvasWidth || PREVIEW.STAGE_FALLBACK_WIDTH_PX * 2.5) / PREVIEW.STAGE_BASE_WIDTH_PX
  );
  const textCanvasDisplayFontPx = Math.max(
    12,
    Math.min(TEXT_EDITOR.SIZE_CLAMP_MAX_PX, Math.round(textSizePx * textCanvasWidthRatio))
  );

  // ── Sync contentEditable with textContent state ──
  useEffect(() => {
    const el = textEditableRef.current;
    if (!el) return;
    if (document.activeElement === el) return;
    const current = (el.innerText || '').replace(/\r/g, '');
    const next = (textContent || '').replace(/\r/g, '');
    if (current !== next) {
      el.innerText = next;
    }
  }, [textContent, activeSection]);

  // ── Send text to projector ──
  const handleSendToProjector = useCallback(
    (content) => {
      const data = buildCurrentTextPayload(content || textContent);
      pushToProjector(data);
    },
    [textContent, buildCurrentTextPayload, pushToProjector]
  );

  const handleAddTextToQueue = useCallback(() => {
    if (!textContent.trim()) return;
    const payload = buildCurrentTextPayload(textContent);
    addOrUpdateQueueItem(payload, getQueueItemTitle(payload), 'text');
  }, [textContent, buildCurrentTextPayload, addOrUpdateQueueItem, getQueueItemTitle]);

  const handleClearProjector = useCallback(
    () => handleSendToProjector(' '),
    [handleSendToProjector]
  );

  // ── Background change auto-project ──
  const sendToProjectorRef = useRef(handleSendToProjector);
  const activeSectionRef = useRef(activeSection);
  const textContentRef = useRef(textContent);
  const currentSlideRef = useRef(currentSlide);
  useEffect(() => {
    sendToProjectorRef.current = handleSendToProjector;
  }, [handleSendToProjector]);
  useEffect(() => {
    activeSectionRef.current = activeSection;
  }, [activeSection]);
  useEffect(() => {
    textContentRef.current = textContent;
  }, [textContent]);
  useEffect(() => {
    currentSlideRef.current = currentSlide;
  }, [currentSlide]);

  useEffect(() => {
    if (
      activeSectionRef.current === 'text' &&
      textContentRef.current.trim() &&
      currentSlideRef.current?.type === 'text'
    ) {
      sendToProjectorRef.current();
    }
  }, [textBackground]);

  // ── Media projection (YouTube resolve) ──
  const handleProjectMedia = useCallback(
    async (mediaData) => {
      try {
        const playableData =
          mediaData?.type === 'youtube'
            ? await resolveYouTubePayload({
                ...mediaData,
                videoId: mediaData.videoId || getYouTubeVideoId(mediaData),
                url: normalizeYouTubeUrl(mediaData),
                name: mediaData.name || 'YouTube',
              })
            : mediaData;
        pushToProjector(playableData);
      } catch (err) {
        showToast(`YouTube play failed: ${err.message || 'Unknown error'}`, 'error');
      }
    },
    [pushToProjector, normalizeYouTubeUrl, getYouTubeVideoId, resolveYouTubePayload, showToast]
  );

  // ── Playlist item handler ──
  const handleAddPlaylistItem = useCallback(
    (item) => {
      const payload = item?.payload || null;
      if (!payload) return;
      const title = item?.name || getQueueItemTitle(payload);
      addOrUpdateQueueItem(payload, title, 'media', { forceAppend: true });
    },
    [addOrUpdateQueueItem, getQueueItemTitle]
  );

  // ── Auto-save text queue item ──
  useActiveTextQueueAutosave({
    activeSection,
    activeQueueIndex,
    projectorQueue,
    textContent,
    buildCurrentTextPayload,
    updateSelectedQueueItem,
  });

  // ── Combined reset ──
  const resetFreeTextEditor = useCallback(() => {
    resetTextEditorState();
    resetTextTransformState();
  }, [resetTextEditorState, resetTextTransformState]);

  const value = useMemo(
    () => ({
      // DOM refs
      textCanvasRef,
      textLayerRef,
      textEditableRef,
      // Text editor state
      textContent,
      setTextContent,
      fontSize,
      setFontSize,
      textFontFamily,
      setTextFontFamily,
      textColor,
      setTextColor,
      textSizePx,
      setTextSizePx,
      textBackground,
      setTextBackground,
      textLayout,
      textSnapGuide,
      textCanvasDisplayFontPx,
      // Canvas transform
      startTextDrag,
      startTextResize,
      // Background picker
      backgroundPickerTarget,
      songPickedBackground,
      biblePickedBackground,
      handleOpenBackgroundPicker,
      handlePickBackgroundFromMedia,
      handleCancelBackgroundPicker,
      // Actions
      handleSendToProjector,
      handleAddTextToQueue,
      handleClearProjector,
      handleProjectMedia,
      handleAddPlaylistItem,
      // Reset
      resetFreeTextEditor,
      // For the ref bridge (QueueProvider needs this)
      applyTextPayloadToEditor,
    }),
    [
      textContent,
      setTextContent,
      fontSize,
      setFontSize,
      textFontFamily,
      setTextFontFamily,
      textColor,
      setTextColor,
      textSizePx,
      setTextSizePx,
      textBackground,
      setTextBackground,
      textLayout,
      textSnapGuide,
      textCanvasDisplayFontPx,
      startTextDrag,
      startTextResize,
      backgroundPickerTarget,
      songPickedBackground,
      biblePickedBackground,
      handleOpenBackgroundPicker,
      handlePickBackgroundFromMedia,
      handleCancelBackgroundPicker,
      handleSendToProjector,
      handleAddTextToQueue,
      handleClearProjector,
      handleProjectMedia,
      handleAddPlaylistItem,
      resetFreeTextEditor,
      applyTextPayloadToEditor,
    ]
  );

  return <TextEditorContext.Provider value={value}>{children}</TextEditorContext.Provider>;
}

export default TextEditorContext;
