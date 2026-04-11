async function runWhenReadyRuntime({
  sessionHooks,
  hydrateUserDataFromBundledSeed,
  app,
  userDataSeedMarker,
  createAppSettingsStore,
  getDeviceId,
  buildRuntimePaths,
  ensureMediaDirs,
  bgDebug,
  initializeStartupRuntime,
  mediaState,
  ytdlpService,
  bootstrapCoreServices,
  protocol,
  registerLocalMediaProtocol,
  resolveAbsolutePath,
  isPathWithinRoot,
  initBibleAndSongsDatabases,
  initSqlJs,
  dbStore,
  electronDir,
  runStartupUiRuntime,
  setupIPC,
  registerBibleSongsIPC,
  ipcMain,
  getBibleDb,
  getSongsDb,
  saveSongsDb,
  registerDisplayWatchRuntime,
  watchDisplayTopology,
  screen,
  controlWindowRef,
  screenManager,
  onRecover,
  splashController,
  createControlWindow,
  setAppSettingsStore,
  logger = console,
}) {
  sessionHooks.setupYouTubeRequestHeaders();
  sessionHooks.setupMediaPermissionHandlers();
  // H5: Apply Content Security Policy to all sessions.
  if (typeof sessionHooks.setupContentSecurityPolicy === 'function') {
    sessionHooks.setupContentSecurityPolicy();
  }
  hydrateUserDataFromBundledSeed(app, userDataSeedMarker, logger);

  const startupRuntime = initializeStartupRuntime({
    app,
    createAppSettingsStore,
    getDeviceId,
    buildRuntimePaths,
    ensureMediaDirs,
    bgDebug,
    logger,
  });

  const { userDataDir, appSettingsStore, runtimePaths } = startupRuntime;
  setAppSettingsStore(appSettingsStore);
  mediaState.applyRuntimePaths(runtimePaths);
  ytdlpService.setBinaryPath(mediaState.getYtDlpBinPath());

  // M3-R2: Wrap non-critical init in try/catch so a failure (e.g. corrupt DB)
  // doesn't kill the entire startup. The app can run in degraded mode.
  try {
    await bootstrapCoreServices({
      protocol,
      registerLocalMediaProtocol,
      resolveAbsolutePath,
      isPathWithinRoot,
      mediaDir: mediaState.getMediaDir(),
      userDataDir,
      logger,
      initBibleAndSongsDatabases,
      initSqlJs,
      dbStore,
      electronDir,
    });
  } catch (err) {
    logger.error('[Startup] bootstrapCoreServices failed (non-fatal):', err?.message || err);
  }

  try {
    runStartupUiRuntime({
      setupIPC,
      registerBibleSongsIPC,
      ipcMain,
      getBibleDb,
      getSongsDb,
      saveSongsDb: () => saveSongsDb(userDataDir),
      registerDisplayWatchRuntime,
      watchDisplayTopology,
      screen,
      controlWindowRef,
      screenManager,
      onRecover,
      logger,
      splashController,
      createControlWindow,
    });
  } catch (err) {
    logger.error('[Startup] runStartupUiRuntime failed (non-fatal):', err?.message || err);
  }
}

module.exports = {
  runWhenReadyRuntime,
};
