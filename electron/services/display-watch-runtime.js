function registerDisplayWatchRuntime({
  watchDisplayTopology,
  screen,
  controlWindowRef,
  screenManager,
  onStabilizeProjector,
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
    onStabilizeProjector,
    onRecover,
    logger,
  });
}

module.exports = {
  registerDisplayWatchRuntime,
};
