function runStartupUiRuntime({
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
  logger = console,
  splashController,
  createControlWindow,
}) {
  setupIPC();

  registerBibleSongsIPC({
    ipcMain,
    getBibleDb,
    getSongsDb,
    saveSongsDb,
  });

  registerDisplayWatchRuntime({
    watchDisplayTopology,
    screen,
    controlWindowRef,
    screenManager,
    onRecover,
    logger,
  });

  splashController.createSplashWindow();
  createControlWindow();
}

module.exports = {
  runStartupUiRuntime,
};
