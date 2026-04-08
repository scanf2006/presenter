import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import appPkg from '../../package.json';
import useProjectorQueue from '../hooks/useProjectorQueue';
import useQueuePlayback from '../hooks/useQueuePlayback';
import useProjectionSettings from '../hooks/useProjectionSettings';
import useWindowProjectorControls from '../hooks/useWindowProjectorControls';
import useSetupBundleActions from '../hooks/useSetupBundleActions';
import useLicenseActions from '../hooks/useLicenseActions';
import useCameraPreview from '../hooks/useCameraPreview';
import useDisplayProjectorStatus from '../hooks/useDisplayProjectorStatus';
import useToastMessage from '../hooks/useToastMessage';
import useObservedWidth from '../hooks/useObservedWidth';
import useBackgroundPickerFlow from '../hooks/useBackgroundPickerFlow';
import useTextCanvasTransform from '../hooks/useTextCanvasTransform';
import usePreviewVideoControls from '../hooks/usePreviewVideoControls';
import useProjectorPreviewDispatch from '../hooks/useProjectorPreviewDispatch';
import useSectionNavigation from '../hooks/useSectionNavigation';
import useTextEditorState from '../hooks/useTextEditorState';
import useYouTubeProjection from '../hooks/useYouTubeProjection';
import useQueueCrudActions from '../hooks/useQueueCrudActions';
import useActiveTextQueueAutosave from '../hooks/useActiveTextQueueAutosave';
import { PREVIEW, SCENE, TEXT_EDITOR } from '../constants/ui';
import TopBar from './control-panel/TopBar';
import SidebarQueue from './control-panel/SidebarQueue';
import MainContentArea from './control-panel/MainContentArea';
import PreviewPanel from './control-panel/PreviewPanel';
import LegalModal from './control-panel/LegalModal';
import ToastOverlay from './control-panel/ToastOverlay';

const APP_VERSION = appPkg.version;

/**
 */
function ControlPanel() {
  const [activeSection, setActiveSection] = useState('text');
  const textCanvasRef = useRef(null);
  const textLayerRef = useRef(null);
  const textEditableRef = useRef(null);
  const [activePreloadItem, setActivePreloadItem] = useState(null);
  const previewStageRef = useRef(null);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [setupTransferBusy, setSetupTransferBusy] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState({
    isLicensed: false,
    summary: 'Unlicensed',
    hasAcceptedEula: false,
    acceptedEulaAt: null,
  });
  const [licenseInput, setLicenseInput] = useState('');
  const [licenseActionMsg, setLicenseActionMsg] = useState('');
  const [licenseActionError, setLicenseActionError] = useState('');
  const [eulaText, setEulaText] = useState('');
  const { toast, showToast } = useToastMessage();

  const isElectron = typeof window.churchDisplay !== 'undefined';
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

  const {
    displays,
    projectorActive,
    projectorDisplayId,
    setProjectorActive,
    setProjectorDisplayId,
  } = useDisplayProjectorStatus({ isElectron });
  const previewSplitEnabled = false;
  const activeProjectorDisplay = displays.find((d) => d.id === projectorDisplayId) || null;
  const clamp = useCallback((v, min, max) => Math.max(min, Math.min(max, v)), []);

  const {
    startTextDrag,
    startTextResize,
    resetTextTransformState,
  } = useTextCanvasTransform({
    textCanvasRef,
    textLayerRef,
    textLayout,
    setTextLayout,
    textSizePx,
    setTextSizePx,
    clamp,
    setTextSnapGuide,
  });
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
    transitionEnabled,
    setTransitionEnabled,
    transitionDelayMs,
    setTransitionDelayMs,
    transitionDurationMs,
    setTransitionDurationMs,
    sceneConfig,
    setSceneConfig,
  } = useProjectionSettings({
    isElectron,
  });
  const previewRightPanePercent = Math.max(
    SCENE.CAMERA_PANE_MIN_PERCENT,
    Math.min(SCENE.CAMERA_PANE_MAX_PERCENT, sceneConfig.cameraPanePercent || SCENE.CAMERA_PANE_DEFAULT_PERCENT),
  );
  const previewContentPanePercent = 100 - previewRightPanePercent;
  const previewCameraScale = Math.max(1, Number(sceneConfig.cameraCenterCropPercent || SCENE.CAMERA_CROP_DEFAULT_PERCENT) / SCENE.CAMERA_CROP_DEFAULT_PERCENT);

  const {
    currentSlide,
    previewSlide,
    previewMaskVisible,
    pushToProjector,
    blackout: handleBlackout,
  } = useProjectorPreviewDispatch({
    isElectron,
    transitionEnabled,
    transitionDelayMs,
    transitionDurationMs,
  });
  const {
    normalizeYouTubeUrl,
    getYouTubeVideoId,
    getYouTubeEmbedUrl,
    resolveYouTubePayload,
  } = useYouTubeProjection({ isElectron });

  const {
    cameraDevices,
    cameraStatus,
    previewTestNow,
    cameraPreviewRef,
  } = useCameraPreview({
    sceneConfig,
    setSceneConfig,
  });

  const {
    startProjector: handleStartProjector,
    stopProjector: handleStopProjector,
    minimizeWindow: handleMinimizeWindow,
    toggleMaximizeWindow: handleToggleMaximizeWindow,
    closeWindow: handleCloseWindow,
  } = useWindowProjectorControls({
    isElectron,
    setProjectorActive,
    setProjectorDisplayId,
  });

  const {
    exportSetupBundle: handleExportSetupBundle,
    importSetupBundle: handleImportSetupBundle,
  } = useSetupBundleActions({
    isElectron,
    setSetupTransferBusy,
  });

  const {
    openLegal: handleOpenLegal,
    activateLicense: handleActivateLicense,
    clearLicense: handleClearLicense,
    acceptEula: handleAcceptEula,
  } = useLicenseActions({
    isElectron,
    setShowLegalModal,
    setLicenseActionError,
    setLicenseActionMsg,
    setEulaText,
    setLicenseStatus,
    licenseStatus,
    licenseInput,
  });

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

  const {
    previewVideoRef,
    previewVideoCurrent,
    previewVideoDuration,
    previewVideoPaused,
    previewVideoMuted,
    handleLoadedMetadata,
    handleTimeUpdate,
    handlePlay,
    handlePause,
    handleVolumeChange,
    togglePauseResume,
    stopPlayback,
    toggleMute,
  } = usePreviewVideoControls();

  const previewStageWidth = useObservedWidth(previewStageRef, []);
  const textCanvasWidth = useObservedWidth(textCanvasRef, [activeSection]);

  useEffect(() => {
    if (!isElectron) return;
    if (sceneConfig.mode !== 'normal') return;
    if (!currentSlide) return;
    if (typeof window.churchDisplay?.sendProjectorScene === 'function') {
      window.churchDisplay.sendProjectorScene(sceneConfig);
    }
    window.churchDisplay.sendToProjector(currentSlide);
    if (typeof window.churchDisplay?.sendToProjectorBackground === 'function') {
      window.churchDisplay.sendToProjectorBackground(currentSlide?.background || null);
    }
  }, [sceneConfig.mode, sceneConfig, currentSlide, isElectron]);

  const previewAspectRatio = (() => {
    const w = activeProjectorDisplay?.bounds?.width || activeProjectorDisplay?.size?.width;
    const h = activeProjectorDisplay?.bounds?.height || activeProjectorDisplay?.size?.height;
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
      const ratio = w / h;
      // Keep preview panel visually usable; avoid over-wide "thin strip" preview.
      if (ratio >= 1.45 && ratio <= 1.9) {
        return `${w} / ${h}`;
      }
    }
    return PREVIEW.ASPECT_RATIO_16_9;
  })();

  useEffect(() => {
    const hydrateLicenseStatus = async () => {
      if (!isElectron || typeof window.churchDisplay?.licenseGetStatus !== 'function') return;
      try {
        const status = await window.churchDisplay.licenseGetStatus();
        if (status) setLicenseStatus(status);
      } catch (err) {
        console.warn('[License] load status failed:', err);
      }
    };
    hydrateLicenseStatus();
  }, [isElectron]);

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

  const textCanvasWidthRatio = Math.max(PREVIEW.MIN_WIDTH_RATIO, (textCanvasWidth || PREVIEW.STAGE_FALLBACK_WIDTH_PX * 2.5) / PREVIEW.STAGE_BASE_WIDTH_PX);
  const textCanvasDisplayFontPx = Math.max(12, Math.min(TEXT_EDITOR.SIZE_CLAMP_MAX_PX, Math.round(textSizePx * textCanvasWidthRatio)));
  const nextQueueTitle = useMemo(() => {
    if (projectorQueue.length === 0) return 'No content';
    const nextIndex = (activeQueueIndex >= 0 ? activeQueueIndex + 1 : 0) >= projectorQueue.length
      ? projectorQueue.length - 1
      : (activeQueueIndex >= 0 ? activeQueueIndex + 1 : 0);
    return projectorQueue[nextIndex]?.title || 'No content';
  }, [projectorQueue, activeQueueIndex]);

  const handleSendToProjector = useCallback((content) => {
    const data = buildCurrentTextPayload(content || textContent);
    pushToProjector(data);
  }, [textContent, buildCurrentTextPayload, pushToProjector]);

  const handleAddTextToQueue = useCallback(() => {
    if (!textContent.trim()) return;
    const payload = buildCurrentTextPayload(textContent);
    addOrUpdateQueueItem(payload, getQueueItemTitle(payload), 'text');
  }, [
    textContent,
    buildCurrentTextPayload,
    addOrUpdateQueueItem,
    getQueueItemTitle,
  ]);

  useEffect(() => {
    if (activeSection === 'text' && textContent.trim() && currentSlide?.type === 'text') {
      handleSendToProjector();
    }
  }, [textBackground]);

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

  const handleProjectMedia = useCallback(async (mediaData) => {
    try {
      const playableData = mediaData?.type === 'youtube'
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
  }, [pushToProjector, normalizeYouTubeUrl, getYouTubeVideoId, resolveYouTubePayload]);

  const handleAddPlaylistItem = useCallback((item) => {
    const payload = item?.payload || null;
    if (!payload) return;
    const title = item?.name || getQueueItemTitle(payload);
    addOrUpdateQueueItem(payload, title, 'media');
  }, [addOrUpdateQueueItem, getQueueItemTitle]);

  const {
    addSongQueueItem: handleAddSongQueueItem,
    addBibleQueueItem: handleAddBibleQueueItem,
    updateSelectedQueueItem: handleUpdateActiveQueueItem,
    moveQueueItemByIndex: handleMoveQueueItem,
    removeSelectedQueueItem: handleRemoveActiveQueueItem,
    startRenameSelectedQueueItem: handleStartRenameQueueItem,
    commitRenameSelectedQueueItem: handleCommitRenameQueueItem,
    cancelRenameSelectedQueueItem: handleCancelRenameQueueItem,
    clearAllQueueItems: handleClearQueue,
  } = useQueueCrudActions({
    addOrUpdateQueueItem,
    getQueueItemTitle,
    updateActiveQueueItem,
    moveQueueItem,
    removeActiveQueueItem,
    startRenameQueueItem,
    commitRenameQueueItem,
    cancelRenameQueueItem,
    clearQueue,
  });

  useActiveTextQueueAutosave({
    activeSection,
    activeQueueIndex,
    projectorQueue,
    textContent,
    buildCurrentTextPayload,
    updateSelectedQueueItem: handleUpdateActiveQueueItem,
  });

  const {
    playQueueItem: handlePlayQueueItem,
  } = useQueuePlayback({
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
    onQueueItemSelected: (item) => {
      const isSongQueueItem = item?.section === 'songs';
      setTransitionEnabled(!isSongQueueItem);
    },
  });

  return (
    <div className="app-container">
      <TopBar
        appVersion={APP_VERSION}
        projectorActive={projectorActive}
        onOpenLegal={handleOpenLegal}
        onClear={() => handleSendToProjector(' ')}
        onBlackout={handleBlackout}
        onMinimize={handleMinimizeWindow}
        onToggleMaximize={handleToggleMaximizeWindow}
        onClose={handleCloseWindow}
      />

      <SidebarQueue
        activeSection={activeSection}
        openDisplays={openDisplays}
        openText={openText}
        openSongs={openSongs}
        openBible={openBible}
        openMedia={openMedia}
        projectorQueue={projectorQueue}
        draggingQueueId={draggingQueueId}
        setDraggingQueueId={setDraggingQueueId}
        activeQueueIndex={activeQueueIndex}
        handleMoveQueueItem={handleMoveQueueItem}
        editingQueueId={editingQueueId}
        editingQueueTitle={editingQueueTitle}
        setEditingQueueTitle={setEditingQueueTitle}
        handleCommitRenameQueueItem={handleCommitRenameQueueItem}
        handleCancelRenameQueueItem={handleCancelRenameQueueItem}
        handlePlayQueueItem={handlePlayQueueItem}
        handleStartRenameQueueItem={handleStartRenameQueueItem}
        handleRemoveActiveQueueItem={handleRemoveActiveQueueItem}
        handleClearQueue={handleClearQueue}
      />

      <MainContentArea
        activeSection={activeSection}
        displays={displays}
        projectorDisplayId={projectorDisplayId}
        projectorActive={projectorActive}
        handleStartProjector={handleStartProjector}
        handleStopProjector={handleStopProjector}
        textCanvasRef={textCanvasRef}
        previewAspectRatio={previewAspectRatio}
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
        handleAddBibleQueueItem={handleAddBibleQueueItem}
        handleUpdateActiveQueueItem={handleUpdateActiveQueueItem}
        activePreloadItem={activePreloadItem}
        bibleCatalogOpenToken={bibleCatalogOpenToken}
        biblePickedBackground={biblePickedBackground}
        handleAddSongQueueItem={handleAddSongQueueItem}
        songPickedBackground={songPickedBackground}
        songsListOpenToken={songsListOpenToken}
        handleAddPlaylistItem={handleAddPlaylistItem}
        mediaHomeOpenToken={mediaHomeOpenToken}
        backgroundPickerTarget={backgroundPickerTarget}
        handlePickBackgroundFromMedia={handlePickBackgroundFromMedia}
        handleCancelBackgroundPicker={handleCancelBackgroundPicker}
      />

      <PreviewPanel
        previewStageRef={previewStageRef}
        previewSlide={previewSlide}
        previewSplitEnabled={previewSplitEnabled}
        previewContentPanePercent={previewContentPanePercent}
        previewRightPanePercent={previewRightPanePercent}
        previewCameraScale={previewCameraScale}
        previewStageWidth={previewStageWidth}
        previewVideoRef={previewVideoRef}
        handleLoadedMetadata={handleLoadedMetadata}
        handleTimeUpdate={handleTimeUpdate}
        handlePlay={handlePlay}
        handlePause={handlePause}
        handleVolumeChange={handleVolumeChange}
        togglePauseResume={togglePauseResume}
        stopPlayback={stopPlayback}
        toggleMute={toggleMute}
        previewVideoPaused={previewVideoPaused}
        previewVideoMuted={previewVideoMuted}
        previewVideoCurrent={previewVideoCurrent}
        previewVideoDuration={previewVideoDuration}
        getYouTubeEmbedUrl={getYouTubeEmbedUrl}
        sceneConfig={sceneConfig}
        previewTestNow={previewTestNow}
        cameraPreviewRef={cameraPreviewRef}
        cameraStatus={cameraStatus}
        previewMaskVisible={previewMaskVisible}
        transitionDurationMs={transitionDurationMs}
        projectorQueue={projectorQueue}
        nextQueueTitle={nextQueueTitle}
        transitionEnabled={transitionEnabled}
        setTransitionEnabled={setTransitionEnabled}
        transitionDelayMs={transitionDelayMs}
        setTransitionDelayMs={setTransitionDelayMs}
        setTransitionDurationMs={setTransitionDurationMs}
        setSceneConfig={setSceneConfig}
        cameraDevices={cameraDevices}
        displays={displays}
        projectorActive={projectorActive}
        isElectron={isElectron}
        handleExportSetupBundle={handleExportSetupBundle}
        handleImportSetupBundle={handleImportSetupBundle}
        setupTransferBusy={setupTransferBusy}
      />

      <LegalModal
        show={showLegalModal}
        onClose={() => setShowLegalModal(false)}
        licenseStatus={licenseStatus}
        licenseInput={licenseInput}
        setLicenseInput={setLicenseInput}
        handleActivateLicense={handleActivateLicense}
        handleClearLicense={handleClearLicense}
        handleAcceptEula={handleAcceptEula}
        licenseActionError={licenseActionError}
        licenseActionMsg={licenseActionMsg}
        eulaText={eulaText}
      />

      <ToastOverlay toast={toast} />
    </div>
  );
}

export default ControlPanel;








