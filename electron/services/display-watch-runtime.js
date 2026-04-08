function registerDisplayWatchRuntime({
  watchDisplayTopology,
  screen,
  controlWindowRef,
  screenManager,
  onRecover,
  logger = console,
}) {
  watchDisplayTopology({
    screen,
    onDisplayInfoChanged: () => {
      const controlWindow = controlWindowRef();
      if (controlWindow && !controlWindow.isDestroyed()) {
        controlWindow.webContents.send('displays-changed', screenManager.getDisplaysInfo());
      }
    },
    onRecover,
    logger,
  });
}

module.exports = {
  registerDisplayWatchRuntime,
};
