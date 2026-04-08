const path = require('path');

function initializeStartupRuntime({
  app,
  createAppSettingsStore,
  buildRuntimePaths,
  ensureMediaDirs,
  bgDebug,
  logger = console,
}) {
  const userDataDir = app.getPath('userData');
  bgDebug.setUserDataDir(userDataDir);

  const appSettingsPath = path.join(userDataDir, 'app-settings.json');
  const appSettingsStore = createAppSettingsStore(appSettingsPath);
  bgDebug.append('app-ready', { userData: userDataDir });

  const runtimePaths = buildRuntimePaths(userDataDir);
  ensureMediaDirs([
    runtimePaths.mediaDir,
    runtimePaths.mediaImagesDir,
    runtimePaths.mediaVideosDir,
    runtimePaths.mediaPdfDir,
    runtimePaths.mediaPptDir,
    runtimePaths.mediaYouTubeCacheDir,
  ], logger);

  return {
    userDataDir,
    appSettingsPath,
    appSettingsStore,
    runtimePaths,
  };
}

module.exports = {
  initializeStartupRuntime,
};
