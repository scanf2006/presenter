async function runWhenReadyRuntime({
  sessionHooks,
  hydrateUserDataFromBundledSeed,
  app,
  userDataSeedMarker,
  createAppSettingsStore,
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
  hydrateUserDataFromBundledSeed(app, userDataSeedMarker, logger);

  const startupRuntime = initializeStartupRuntime({
    app,
    createAppSettingsStore,
    buildRuntimePaths,
    ensureMediaDirs,
    bgDebug,
    logger,
  });

  const { userDataDir, appSettingsStore, runtimePaths } = startupRuntime;
  setAppSettingsStore(appSettingsStore);
  mediaState.applyRuntimePaths(runtimePaths);
  ytdlpService.setBinaryPath(mediaState.getYtDlpBinPath());

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
}

module.exports = {
  runWhenReadyRuntime,
};
