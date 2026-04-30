const { createDownloadService } = require('./download-service');
const { createBgDebugAppender } = require('./bg-debug');
const { createSessionHooks } = require('./session-hooks');
const { createYtDlpService } = require('./ytdlp-service');
const { createControlWindowCloseController } = require('./control-window-close');
const { createLicenseRuntimeBridge } = require('./license-runtime');
const { createProjectorSceneState } = require('./projector-scene-state');
const { createProjectorLiveState } = require('./projector-live-state');
const { createMediaState } = require('./media-state');

function createMainRuntimeCore({
  session,
  logger,
  networkTimeoutMs,
  YTDlpWrap,
  getAppSettingsStore,
  confirmExitDialog,
}) {
  const mediaState = createMediaState();
  const bgDebug = createBgDebugAppender({ enabled: true, logger });
  const downloadService = createDownloadService({
    networkTimeoutMs,
    debug: (tag, payload) => bgDebug.append(tag, payload),
  });
  const sessionHooks = createSessionHooks({ session, logger });
  const ytdlpService = createYtDlpService({
    YTDlpWrap,
    debug: (tag, payload) => bgDebug.append(tag, payload),
  });
  const licenseRuntime = createLicenseRuntimeBridge({
    getAppSettingsStore,
  });
  const controlCloseController = createControlWindowCloseController({ confirmExitDialog });
  const projectorSceneState = createProjectorSceneState({
    mode: 'normal',
    splitDirection: 'content_left_camera_right',
    cameraDeviceId: '',
    cameraPanePercent: 30,
    cameraMuted: true,
    cameraCenterCropPercent: 100,
    enableCameraTestMode: false,
  });
  const projectorLiveState = createProjectorLiveState();

  return {
    mediaState,
    bgDebug,
    downloadService,
    sessionHooks,
    ytdlpService,
    licenseRuntime,
    controlCloseController,
    projectorSceneState,
    projectorLiveState,
  };
}

module.exports = {
  createMainRuntimeCore,
};
