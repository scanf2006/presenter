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
  const [mediaQueueHomeToken, setMediaQueueHomeToken] = useState(0);
  const [showQueueTypeTags, setShowQueueTypeTags] = useState(true);
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
    Math.min(
      SCENE.CAMERA_PANE_MAX_PERCENT,
      sceneConfig.cameraPanePercent || SCENE.CAMERA_PANE_DEFAULT_PERCENT
    )
  );
  const previewContentPanePercent = 100 - previewRightPanePercent;
  const previewCameraScale = Math.max(
    1,
    Number(sceneConfig.cameraCenterCropPercent || SCENE.CAMERA_CROP_DEFAULT_PERCENT) /
      SCENE.CAMERA_CROP_DEFAULT_PERCENT
  );

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
  const { normalizeYouTubeUrl, getYouTubeVideoId, getYouTubeEmbedUrl, resolveYouTubePayload } =
    useYouTubeProjection({ isElectron });

  const { cameraDevices, cameraStatus, previewTestNow, cameraPreviewRef } = useCameraPreview({
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

  const { exportSetupBundle: handleExportSetupBundle, importSetupBundle: handleImportSetupBundle } =
    useSetupBundleActions({
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
    try {
      const saved = window.localStorage.getItem('churchdisplay.ui.queueTypeTagsVisible.v2');
      if (saved === '0') setShowQueueTypeTags(false);
    } catch (_) {
      // ignore restore failures
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        'churchdisplay.ui.queueTypeTagsVisible.v2',
        showQueueTypeTags ? '1' : '0'
      );
    } catch (_) {
      // ignore persist failures
    }
  }, [showQueueTypeTags]);

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

  const textCanvasWidthRatio = Math.max(
    PREVIEW.MIN_WIDTH_RATIO,
    (textCanvasWidth || PREVIEW.STAGE_FALLBACK_WIDTH_PX * 2.5) / PREVIEW.STAGE_BASE_WIDTH_PX
  );
  const textCanvasDisplayFontPx = Math.max(
    12,
    Math.min(TEXT_EDITOR.SIZE_CLAMP_MAX_PX, Math.round(textSizePx * textCanvasWidthRatio))
  );
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

  // Keep refs in sync via effects to avoid stale-closure: the background-change
  // effect fires only when textBackground changes, but needs the latest values.
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

  const handleAddPlaylistItem = useCallback(
    (item) => {
      const payload = item?.payload || null;
      if (!payload) return;
      const title = item?.name || getQueueItemTitle(payload);
      addOrUpdateQueueItem(payload, title, 'media', { forceAppend: true });
    },
    [addOrUpdateQueueItem, getQueueItemTitle]
  );

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

  const handleMediaQueueItemPlayed = useCallback(() => {
    setMediaQueueHomeToken(Date.now());
  }, []);

  const handleQueueItemSelected = useCallback(
    (item) => {
      const isSongQueueItem = item?.section === 'songs';
      setTransitionEnabled(!isSongQueueItem);
    },
    [setTransitionEnabled]
  );

  const { playQueueItem: handlePlayQueueItem } = useQueuePlayback({
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
    onMediaQueueItemPlayed: handleMediaQueueItemPlayed,
    onQueueItemSelected: handleQueueItemSelected,
  });

  const handleClearProjector = useCallback(
    () => handleSendToProjector(' '),
    [handleSendToProjector]
  );
  const handleCloseLegalModal = useCallback(() => setShowLegalModal(false), []);

  // ── Grouped prop objects for child components ──
  // These reduce visual clutter in the JSX without changing child APIs.

  const topBarProps = useMemo(
    () => ({
      appVersion: APP_VERSION,
      projectorActive,
      onOpenLegal: handleOpenLegal,
      onClear: handleClearProjector,
      onBlackout: handleBlackout,
      onMinimize: handleMinimizeWindow,
      onToggleMaximize: handleToggleMaximizeWindow,
      onClose: handleCloseWindow,
    }),
    [
      projectorActive,
      handleOpenLegal,
      handleClearProjector,
      handleBlackout,
      handleMinimizeWindow,
      handleToggleMaximizeWindow,
      handleCloseWindow,
    ]
  );

  const sidebarQueueProps = useMemo(
    () => ({
      activeSection,
      openDisplays,
      openText,
      openSongs,
      openBible,
      openMedia,
      projectorQueue,
      draggingQueueId,
      setDraggingQueueId,
      activeQueueIndex,
      handleMoveQueueItem,
      editingQueueId,
      editingQueueTitle,
      setEditingQueueTitle,
      handleCommitRenameQueueItem,
      handleCancelRenameQueueItem,
      handlePlayQueueItem,
      handleStartRenameQueueItem,
      handleRemoveActiveQueueItem,
      handleClearQueue,
      showQueueTypeTags,
      setShowQueueTypeTags,
    }),
    [
      activeSection,
      openDisplays,
      openText,
      openSongs,
      openBible,
      openMedia,
      projectorQueue,
      draggingQueueId,
      setDraggingQueueId,
      activeQueueIndex,
      handleMoveQueueItem,
      editingQueueId,
      editingQueueTitle,
      setEditingQueueTitle,
      handleCommitRenameQueueItem,
      handleCancelRenameQueueItem,
      handlePlayQueueItem,
      handleStartRenameQueueItem,
      handleRemoveActiveQueueItem,
      handleClearQueue,
      showQueueTypeTags,
      setShowQueueTypeTags,
    ]
  );

  const mainContentProps = useMemo(
    () => ({
      activeSection,
      displays,
      projectorDisplayId,
      projectorActive,
      handleStartProjector,
      handleStopProjector,
      textCanvasRef,
      previewAspectRatio,
      textBackground,
      textSnapGuide,
      textLayerRef,
      textLayout,
      startTextDrag,
      textEditableRef,
      setTextContent,
      textFontFamily,
      textColor,
      textCanvasDisplayFontPx,
      textContent,
      startTextResize,
      handleOpenBackgroundPicker,
      setTextBackground,
      fontSize,
      setFontSize,
      setTextSizePx,
      textSizePx,
      setTextFontFamily,
      setTextColor,
      handleSendToProjector,
      handleAddTextToQueue,
      handleProjectMedia,
      handleAddBibleQueueItem,
      handleUpdateActiveQueueItem,
      activePreloadItem,
      bibleCatalogOpenToken,
      biblePickedBackground,
      handleAddSongQueueItem,
      songPickedBackground,
      songsListOpenToken,
      handleAddPlaylistItem,
      mediaHomeOpenToken: Math.max(mediaHomeOpenToken || 0, mediaQueueHomeToken || 0),
      backgroundPickerTarget,
      handlePickBackgroundFromMedia,
      handleCancelBackgroundPicker,
    }),
    [
      activeSection,
      displays,
      projectorDisplayId,
      projectorActive,
      handleStartProjector,
      handleStopProjector,
      previewAspectRatio,
      textBackground,
      textSnapGuide,
      textLayout,
      startTextDrag,
      textFontFamily,
      textColor,
      textCanvasDisplayFontPx,
      textContent,
      startTextResize,
      handleOpenBackgroundPicker,
      setTextContent,
      setTextBackground,
      fontSize,
      setFontSize,
      setTextSizePx,
      textSizePx,
      setTextFontFamily,
      setTextColor,
      handleSendToProjector,
      handleAddTextToQueue,
      handleProjectMedia,
      handleAddBibleQueueItem,
      handleUpdateActiveQueueItem,
      activePreloadItem,
      bibleCatalogOpenToken,
      biblePickedBackground,
      handleAddSongQueueItem,
      songPickedBackground,
      songsListOpenToken,
      handleAddPlaylistItem,
      mediaHomeOpenToken,
      mediaQueueHomeToken,
      backgroundPickerTarget,
      handlePickBackgroundFromMedia,
      handleCancelBackgroundPicker,
    ]
  );

  const previewPanelProps = useMemo(
    () => ({
      previewStageRef,
      previewSlide,
      previewSplitEnabled,
      previewContentPanePercent,
      previewRightPanePercent,
      previewCameraScale,
      previewStageWidth,
      previewVideoRef,
      handleLoadedMetadata,
      handleTimeUpdate,
      handlePlay,
      handlePause,
      handleVolumeChange,
      togglePauseResume,
      stopPlayback,
      toggleMute,
      previewVideoPaused,
      previewVideoMuted,
      previewVideoCurrent,
      previewVideoDuration,
      getYouTubeEmbedUrl,
      sceneConfig,
      previewTestNow,
      cameraPreviewRef,
      cameraStatus,
      previewMaskVisible,
      transitionDurationMs,
      projectorQueue,
      nextQueueTitle,
      transitionEnabled,
      setTransitionEnabled,
      transitionDelayMs,
      setTransitionDelayMs,
      setTransitionDurationMs,
      setSceneConfig,
      cameraDevices,
      displays,
      projectorActive,
      isElectron,
      handleExportSetupBundle,
      handleImportSetupBundle,
      setupTransferBusy,
    }),
    [
      previewSlide,
      previewSplitEnabled,
      previewContentPanePercent,
      previewRightPanePercent,
      previewCameraScale,
      previewStageWidth,
      previewVideoRef,
      handleLoadedMetadata,
      handleTimeUpdate,
      handlePlay,
      handlePause,
      handleVolumeChange,
      togglePauseResume,
      stopPlayback,
      toggleMute,
      previewVideoPaused,
      previewVideoMuted,
      previewVideoCurrent,
      previewVideoDuration,
      getYouTubeEmbedUrl,
      sceneConfig,
      previewTestNow,
      cameraPreviewRef,
      cameraStatus,
      previewMaskVisible,
      transitionDurationMs,
      projectorQueue,
      nextQueueTitle,
      transitionEnabled,
      setTransitionEnabled,
      transitionDelayMs,
      setTransitionDelayMs,
      setTransitionDurationMs,
      setSceneConfig,
      cameraDevices,
      displays,
      projectorActive,
      isElectron,
      handleExportSetupBundle,
      handleImportSetupBundle,
      setupTransferBusy,
    ]
  );

  const legalModalProps = useMemo(
    () => ({
      show: showLegalModal,
      onClose: handleCloseLegalModal,
      licenseStatus,
      licenseInput,
      setLicenseInput,
      handleActivateLicense,
      handleClearLicense,
      handleAcceptEula,
      licenseActionError,
      licenseActionMsg,
      eulaText,
    }),
    [
      showLegalModal,
      handleCloseLegalModal,
      licenseStatus,
      licenseInput,
      handleActivateLicense,
      handleClearLicense,
      handleAcceptEula,
      licenseActionError,
      licenseActionMsg,
      eulaText,
    ]
  );

  return (
    <div className="app-container">
      <TopBar {...topBarProps} />
      <SidebarQueue {...sidebarQueueProps} />
      <MainContentArea {...mainContentProps} />
      <PreviewPanel {...previewPanelProps} />
      <LegalModal {...legalModalProps} />
      <ToastOverlay toast={toast} />
    </div>
  );
}

export default ControlPanel;
