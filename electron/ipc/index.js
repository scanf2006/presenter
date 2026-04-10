const { registerWindowProjectorIPC } = require('./window-projector');
const { registerProjectorEventIPC } = require('./projector-events');
const { registerYouTubeIPC } = require('./youtube');
const { registerLicenseIPC } = require('./license');
const { registerMediaIPC } = require('./media');
const { registerSetupBundleIPC } = require('./setup-bundle');
const { registerQueueIPC } = require('./queue');

function registerAllIPC(config) {
  const {
    ipcMain,
    screenManager,
    createProjectorWindow,
    forceCloseProjectorWindow,
    requestCloseControlWindow,
    getControlWindow,
    getProjectorWindow,
    appendBgDebug,
    sendToProjectorShell,
    openYouTubeWatchInProjector,
    getLatestProjectorScene,
    setLatestProjectorScene,
    resolveYouTubeStream,
    sanitizeFileName,
    mediaYouTubeCacheDir,
    downloadUrlToFileWithRetry,
    downloadWithYtDlp,
    verifyLicenseToken,
    getLicenseStatus,
    writeAppSettings,
    readLegalDocument,
    dialog,
    resolveAbsolutePath,
    normalizeForCompare,
    isPathWithinRoot,
    mediaDir,
    mediaImagesDir,
    mediaVideosDir,
    mediaPdfDir,
    mediaPptDir,
    pptConvertTimeoutMs,
    getRuntimePptConvertScriptPath,
    app,
    formatBackupStamp,
    collectReferencedMediaPathsFromQueue,
    copyDirectoryMerge,
  } = config;

  registerWindowProjectorIPC({
    ipcMain,
    screenManager,
    createProjectorWindow,
    forceCloseProjectorWindow,
    requestCloseControlWindow,
    getControlWindow,
    getProjectorWindow,
  });

  registerProjectorEventIPC({
    ipcMain,
    appendBgDebug,
    getProjectorWindow,
    sendToProjectorShell,
    openYouTubeWatchInProjector,
    getLatestProjectorScene,
    setLatestProjectorScene,
  });

  registerYouTubeIPC({
    ipcMain,
    appendBgDebug,
    resolveYouTubeStream,
    sanitizeFileName,
    mediaYouTubeCacheDir,
    downloadUrlToFileWithRetry,
    downloadWithYtDlp,
  });

  registerLicenseIPC({
    ipcMain,
    verifyLicenseToken,
    getLicenseStatus,
    writeAppSettings,
    readLegalDocument,
    appVersion: app ? app.getVersion() : null,
  });

  registerMediaIPC({
    ipcMain,
    dialog,
    getParentWindow: () =>
      getControlWindow() && !getControlWindow().isDestroyed() ? getControlWindow() : null,
    resolveAbsolutePath,
    normalizeForCompare,
    isPathWithinRoot,
    mediaDir,
    mediaImagesDir,
    mediaVideosDir,
    mediaPdfDir,
    mediaPptDir,
    pptConvertTimeoutMs,
    getRuntimePptConvertScriptPath,
  });

  registerSetupBundleIPC({
    ipcMain,
    dialog,
    app,
    getParentWindow: () =>
      getControlWindow() && !getControlWindow().isDestroyed() ? getControlWindow() : null,
    formatBackupStamp,
    collectReferencedMediaPathsFromQueue,
    copyDirectoryMerge,
    mediaDir,
  });

  registerQueueIPC({ ipcMain, app });
}

module.exports = {
  registerAllIPC,
};
