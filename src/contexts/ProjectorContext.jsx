import React, { createContext, useContext, useRef, useState, useMemo, useEffect, useCallback } from 'react';
import useDisplayProjectorStatus from '../hooks/useDisplayProjectorStatus';
import useProjectionSettings from '../hooks/useProjectionSettings';
import useProjectorPreviewDispatch from '../hooks/useProjectorPreviewDispatch';
import useWindowProjectorControls from '../hooks/useWindowProjectorControls';
import useCameraPreview from '../hooks/useCameraPreview';
import usePreviewVideoControls from '../hooks/usePreviewVideoControls';
import useYouTubeProjection from '../hooks/useYouTubeProjection';
import useObservedWidth from '../hooks/useObservedWidth';
import useSetupBundleActions from '../hooks/useSetupBundleActions';
import { useAppContext } from './AppContext';
import { PREVIEW, SCENE } from '../constants/ui';

const ProjectorContext = createContext(null);

export function useProjectorContext() {
  const ctx = useContext(ProjectorContext);
  if (!ctx) throw new Error('useProjectorContext must be used within ProjectorProvider');
  return ctx;
}

export function ProjectorProvider({ children }) {
  const { isElectron, showToast, showAlert, showConfirm } = useAppContext();

  const previewStageRef = useRef(null);
  const [setupTransferBusy, setSetupTransferBusy] = useState(false);
  const [startupHealthBusy, setStartupHealthBusy] = useState(false);
  const [startupHealthReport, setStartupHealthReport] = useState(null);

  const {
    displays,
    projectorActive,
    projectorDisplayId,
    setProjectorActive,
    setProjectorDisplayId,
  } = useDisplayProjectorStatus({ isElectron });

  const {
    transitionEnabled,
    setTransitionEnabled,
    transitionDelayMs,
    setTransitionDelayMs,
    transitionDurationMs,
    setTransitionDurationMs,
    sceneConfig,
    setSceneConfig,
    obsModeEnabled,
    setObsModeEnabled,
  } = useProjectionSettings({ isElectron });

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
    showToast,
    suppressDeliveryWarnings: obsModeEnabled,
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
    showConfirm,
  });

  const { exportSetupBundle: handleExportSetupBundle, importSetupBundle: handleImportSetupBundle } =
    useSetupBundleActions({
      isElectron,
      setSetupTransferBusy,
      showToast,
      showAlert,
      showConfirm,
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

  const previewSplitEnabled = false;
  const activeProjectorDisplay = displays.find((d) => d.id === projectorDisplayId) || null;

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

  const previewAspectRatio = useMemo(() => {
    const w = activeProjectorDisplay?.bounds?.width || activeProjectorDisplay?.size?.width;
    const h = activeProjectorDisplay?.bounds?.height || activeProjectorDisplay?.size?.height;
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
      const ratio = w / h;
      if (ratio >= 1.45 && ratio <= 1.9) {
        return `${w} / ${h}`;
      }
    }
    return PREVIEW.ASPECT_RATIO_16_9;
  }, [
    activeProjectorDisplay?.bounds?.width,
    activeProjectorDisplay?.bounds?.height,
    activeProjectorDisplay?.size?.width,
    activeProjectorDisplay?.size?.height,
  ]);

  const runStartupHealthCheck = useCallback(
    async ({ silent = false } = {}) => {
      if (!isElectron || typeof window.churchDisplay?.startupHealthCheck !== 'function') return null;
      setStartupHealthBusy(true);
      try {
        const report = await window.churchDisplay.startupHealthCheck();
        setStartupHealthReport(report || null);
        if (!silent && report?.summary) {
          const { errorCount = 0, warnCount = 0 } = report.summary;
          if (errorCount > 0) {
            showToast(`Health check found ${errorCount} critical issue(s).`, 'error');
          } else if (warnCount > 0) {
            showToast(`Health check found ${warnCount} warning(s).`, 'warning');
          } else {
            showToast('Health check passed.');
          }
        }
        return report || null;
      } catch (err) {
        if (!silent) {
          showToast(`Health check failed: ${err?.message || 'Unknown error'}`, 'error');
        }
        return null;
      } finally {
        setStartupHealthBusy(false);
      }
    },
    [isElectron, showToast]
  );

  // Scene mode sync effect (moved from ControlPanel)
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

  useEffect(() => {
    runStartupHealthCheck({ silent: true });
  }, [runStartupHealthCheck]);

  const value = useMemo(
    () => ({
      // Display / projector status
      displays,
      projectorActive,
      projectorDisplayId,
      // Projector controls
      handleStartProjector,
      handleStopProjector,
      handleMinimizeWindow,
      handleToggleMaximizeWindow,
      handleCloseWindow,
      // Preview dispatch
      currentSlide,
      previewSlide,
      previewMaskVisible,
      pushToProjector,
      handleBlackout,
      // Transition / scene settings
      transitionEnabled,
      setTransitionEnabled,
      transitionDelayMs,
      setTransitionDelayMs,
      transitionDurationMs,
      setTransitionDurationMs,
      sceneConfig,
      setSceneConfig,
      obsModeEnabled,
      setObsModeEnabled,
      // Preview geometry
      previewStageRef,
      previewStageWidth,
      previewAspectRatio,
      previewSplitEnabled,
      previewContentPanePercent,
      previewRightPanePercent,
      previewCameraScale,
      // Camera
      cameraDevices,
      cameraStatus,
      previewTestNow,
      cameraPreviewRef,
      // Video controls
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
      // YouTube
      normalizeYouTubeUrl,
      getYouTubeVideoId,
      getYouTubeEmbedUrl,
      resolveYouTubePayload,
      // Setup bundle
      handleExportSetupBundle,
      handleImportSetupBundle,
      setupTransferBusy,
      startupHealthBusy,
      startupHealthReport,
      runStartupHealthCheck,
    }),
    [
      displays,
      projectorActive,
      projectorDisplayId,
      handleStartProjector,
      handleStopProjector,
      handleMinimizeWindow,
      handleToggleMaximizeWindow,
      handleCloseWindow,
      currentSlide,
      previewSlide,
      previewMaskVisible,
      pushToProjector,
      handleBlackout,
      transitionEnabled,
      setTransitionEnabled,
      transitionDelayMs,
      setTransitionDelayMs,
      transitionDurationMs,
      setTransitionDurationMs,
      sceneConfig,
      setSceneConfig,
      obsModeEnabled,
      setObsModeEnabled,
      previewStageWidth,
      previewAspectRatio,
      previewSplitEnabled,
      previewContentPanePercent,
      previewRightPanePercent,
      previewCameraScale,
      cameraDevices,
      cameraStatus,
      previewTestNow,
      cameraPreviewRef,
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
      normalizeYouTubeUrl,
      getYouTubeVideoId,
      getYouTubeEmbedUrl,
      resolveYouTubePayload,
      handleExportSetupBundle,
      handleImportSetupBundle,
      setupTransferBusy,
      startupHealthBusy,
      startupHealthReport,
      runStartupHealthCheck,
    ]
  );

  return <ProjectorContext.Provider value={value}>{children}</ProjectorContext.Provider>;
}

export default ProjectorContext;
