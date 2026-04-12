import React, { useEffect, useCallback, useRef, useMemo } from 'react';
import appPkg from '../../package.json';
import { AppProvider, useAppContext } from '../contexts/AppContext';
import { LicenseProvider } from '../contexts/LicenseContext';
import { ProjectorProvider, useProjectorContext } from '../contexts/ProjectorContext';
import { QueueProvider, useQueueContext } from '../contexts/QueueContext';
import useTextEditorState from '../hooks/useTextEditorState';
import useTextCanvasTransform from '../hooks/useTextCanvasTransform';
import useBackgroundPickerFlow from '../hooks/useBackgroundPickerFlow';
import useSectionNavigation from '../hooks/useSectionNavigation';
import useActiveTextQueueAutosave from '../hooks/useActiveTextQueueAutosave';
import useObservedWidth from '../hooks/useObservedWidth';
import { PREVIEW, TEXT_EDITOR } from '../constants/ui';
import TopBar from './control-panel/TopBar';
import SidebarQueue from './control-panel/SidebarQueue';
import MainContentArea from './control-panel/MainContentArea';
import PreviewPanel from './control-panel/PreviewPanel';
import LegalModal from './control-panel/LegalModal';
import ToastOverlay from './control-panel/ToastOverlay';

const APP_VERSION = appPkg.version;

/**
 * Inner component that consumes all contexts and provides the remaining
 * text-editor / background-picker / section-navigation orchestration.
 */
function ControlPanelInner({ applyTextPayloadRef }) {
  const { activeSection, setActiveSection, toast } = useAppContext();
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
    setActiveQueueIndex,
    getQueueItemTitle,
    addOrUpdateQueueItem,
    addSongQueueItem,
    addBibleQueueItem,
    updateSelectedQueueItem,
    mediaQueueHomeToken,
  } = useQueueContext();

  // ── Text editor state ──
  const textCanvasRef = useRef(null);
  const textLayerRef = useRef(null);
  const textEditableRef = useRef(null);

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

  // Keep the ref in sync so QueueProvider can call applyTextPayloadToEditor
  useEffect(() => {
    if (applyTextPayloadRef) applyTextPayloadRef.current = applyTextPayloadToEditor;
  }, [applyTextPayloadRef, applyTextPayloadToEditor]);

  // ── Background picker ──
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

  // ── Section navigation ──
  const resetFreeTextEditor = useCallback(() => {
    resetTextEditorState();
    resetTextTransformState();
  }, [resetTextEditorState, resetTextTransformState]);

  const {
    songsListOpenToken,
    bibleCatalogOpenToken,
    mediaHomeOpenToken,
    openDisplays,
    openText,
    openSongs,
    openBible,
    openMedia,
  } = useSectionNavigation({
    setActiveQueueIndex,
    setActiveSection,
    resetFreeTextEditor,
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
        alert(`YouTube play failed: ${err.message || 'Unknown error'}`);
      }
    },
    [pushToProjector, normalizeYouTubeUrl, getYouTubeVideoId, resolveYouTubePayload]
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

  // ── Next queue title for preview ──
  const nextQueueTitle = useMemo(() => {
    if (projectorQueue.length === 0) return 'No content';
    const nextIndex =
      (activeQueueIndex >= 0 ? activeQueueIndex + 1 : 0) >= projectorQueue.length
        ? projectorQueue.length - 1
        : activeQueueIndex >= 0
          ? activeQueueIndex + 1
          : 0;
    return projectorQueue[nextIndex]?.title || 'No content';
  }, [projectorQueue, activeQueueIndex]);

  return (
    <div className="app-container">
      <TopBar appVersion={APP_VERSION} onClear={handleClearProjector} />
      <SidebarQueue
        openDisplays={openDisplays}
        openText={openText}
        openSongs={openSongs}
        openBible={openBible}
        openMedia={openMedia}
      />
      <MainContentArea
        textCanvasRef={textCanvasRef}
        textBackground={textBackground}
        textSnapGuide={textSnapGuide}
        textLayerRef={textLayerRef}
        textLayout={textLayout}
        startTextDrag={startTextDrag}
        textEditableRef={textEditableRef}
        setTextContent={setTextContent}
        textFontFamily={textFontFamily}
        textColor={textColor}
        textCanvasDisplayFontPx={textCanvasDisplayFontPx}
        textContent={textContent}
        startTextResize={startTextResize}
        handleOpenBackgroundPicker={handleOpenBackgroundPicker}
        setTextBackground={setTextBackground}
        fontSize={fontSize}
        setFontSize={setFontSize}
        setTextSizePx={setTextSizePx}
        textSizePx={textSizePx}
        setTextFontFamily={setTextFontFamily}
        setTextColor={setTextColor}
        handleSendToProjector={handleSendToProjector}
        handleAddTextToQueue={handleAddTextToQueue}
        handleProjectMedia={handleProjectMedia}
        handleAddBibleQueueItem={addBibleQueueItem}
        handleUpdateActiveQueueItem={updateSelectedQueueItem}
        handleAddSongQueueItem={addSongQueueItem}
        songPickedBackground={songPickedBackground}
        songsListOpenToken={songsListOpenToken}
        bibleCatalogOpenToken={bibleCatalogOpenToken}
        biblePickedBackground={biblePickedBackground}
        handleAddPlaylistItem={handleAddPlaylistItem}
        mediaHomeOpenToken={Math.max(mediaHomeOpenToken || 0, mediaQueueHomeToken || 0)}
        backgroundPickerTarget={backgroundPickerTarget}
        handlePickBackgroundFromMedia={handlePickBackgroundFromMedia}
        handleCancelBackgroundPicker={handleCancelBackgroundPicker}
      />
      <PreviewPanel nextQueueTitle={nextQueueTitle} />
      <LegalModal />
      <ToastOverlay toast={toast} />
    </div>
  );
}

/**
 * ControlPanel is now a thin shell that sets up context providers.
 * All shared state lives in the four contexts; ControlPanelInner handles
 * only the text-editor / background-picker orchestration that bridges them.
 */
function ControlPanel() {
  return (
    <AppProvider>
      <ControlPanelProviders />
    </AppProvider>
  );
}

/**
 * Intermediate component that accesses AppContext to supply applyTextPayloadToEditor
 * to QueueProvider (which needs it for queue playback of text items).
 */
function ControlPanelProviders() {
  // We need the text editor hook at this level so QueueProvider can receive
  // applyTextPayloadToEditor. However, the full text editor state is owned by
  // ControlPanelInner. To break the circular dependency, we use a ref-based
  // callback that ControlPanelInner will update.
  const applyTextRef = useRef(() => {});
  const stableApplyText = useCallback((payload) => applyTextRef.current(payload), []);

  return (
    <LicenseProvider>
      <ProjectorProvider>
        <QueueProvider applyTextPayloadToEditor={stableApplyText}>
          <ControlPanelInner applyTextPayloadRef={applyTextRef} />
        </QueueProvider>
      </ProjectorProvider>
    </LicenseProvider>
  );
}

export default ControlPanel;
