import React, { createContext, useContext, useRef, useState, useMemo } from 'react';
import useDisplayProjectorStatus from '../hooks/useDisplayProjectorStatus';
import useProjectionSettings from '../hooks/useProjectionSettings';
import useProjectorPreviewDispatch from '../hooks/useProjectorPreviewDispatch';
import useWindowProjectorControls from '../hooks/useWindowProjectorControls';
import usePreviewVideoControls from '../hooks/usePreviewVideoControls';
import useYouTubeProjection from '../hooks/useYouTubeProjection';
import useObservedWidth from '../hooks/useObservedWidth';
import useSetupBundleActions from '../hooks/useSetupBundleActions';
import useStartupHealth from '../hooks/useStartupHealth';
import usePreviewLayoutMetrics from '../hooks/usePreviewLayoutMetrics';
import { isTauriRuntime, sendTauriProjectorMediaCommand } from '../utils/tauriProjector';
import { useAppContext } from './AppContext';

const ProjectorContext = createContext(null);

export function useProjectorContext() {
  const ctx = useContext(ProjectorContext);
  if (!ctx) throw new Error('useProjectorContext must be used within ProjectorProvider');
  return ctx;
}

export function ProjectorProvider({ children }) {
  const { showToast, showAlert, showConfirm } = useAppContext();
  const isTauri = isTauriRuntime();

  const previewStageRef = useRef(null);
  const [setupTransferBusy, setSetupTransferBusy] = useState(false);

  const {
    displays,
    projectorActive,
    projectorDisplayId,
    startProjector,
    stopProjector,
    refreshDisplays,
  } = useDisplayProjectorStatus({ isTauri });

  const {
    transitionEnabled,
    setTransitionEnabled,
    transitionDelayMs,
    setTransitionDelayMs,
    transitionDurationMs,
    setTransitionDurationMs,
  } = useProjectionSettings();

  const {
    currentSlide,
    previewSlide,
    previewMaskVisible,
    pushToProjector,
    blackout: handleBlackout,
  } = useProjectorPreviewDispatch({
    transitionEnabled,
    transitionDelayMs,
    transitionDurationMs,
    showToast,
    suppressDeliveryWarnings: !projectorActive,
  });

  const { normalizeYouTubeUrl, getYouTubeVideoId, getYouTubeEmbedUrl, resolveYouTubePayload } =
    useYouTubeProjection();

  const {
    startProjector: handleStartProjector,
    stopProjector: handleStopProjector,
    minimizeWindow: handleMinimizeWindow,
    toggleMaximizeWindow: handleToggleMaximizeWindow,
    closeWindow: handleCloseWindow,
  } = useWindowProjectorControls({
    startProjector,
    stopProjector,
    showConfirm,
  });

  const { exportSetupBundle: handleExportSetupBundle, importSetupBundle: handleImportSetupBundle } =
    useSetupBundleActions({
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
  } = usePreviewVideoControls({
    onMediaCommand: isTauri ? sendTauriProjectorMediaCommand : undefined,
  });

  const previewStageWidth = useObservedWidth(previewStageRef, []);
  const { previewAspectRatio } = usePreviewLayoutMetrics({ displays, projectorDisplayId });

  const { startupHealthBusy, startupHealthReport, runStartupHealthCheck } = useStartupHealth({
    showToast,
  });
  const value = useMemo(
    () => ({
      // Display / projector status
      displays,
      projectorActive,
      projectorDisplayId,
      refreshDisplays,
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
      // Preview geometry
      previewStageRef,
      previewStageWidth,
      previewAspectRatio,
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
      refreshDisplays,
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
      previewStageWidth,
      previewAspectRatio,
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
