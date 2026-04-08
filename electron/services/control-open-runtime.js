function createAndWireControlWindow({
  BrowserWindow,
  createControlWindowInstance,
  screenManager,
  title,
  preloadPath,
  iconPath,
  isDev,
  devUrl,
  indexPath,
  controlCloseController,
  bindControlWindowEvents,
  splashController,
  revealTimeoutMs,
  dialog,
  forceWindowZoom100,
  forceCloseProjectorWindow,
  splashMinVisibleMs,
  onClosed,
  logger = console,
}) {
  const primaryDisplay = screenManager.getPrimaryDisplay();
  const controlWindow = createControlWindowInstance({
    BrowserWindow,
    primaryDisplay,
    title,
    preloadPath,
    iconPath,
    isDev,
    devUrl,
    indexPath,
  });

  controlCloseController.reset();
  bindControlWindowEvents({
    controlWindow,
    revealTimeoutMs,
    splashController,
    controlCloseController,
    dialog,
    forceWindowZoom100,
    forceCloseProjectorWindow,
    onClosed,
    splashMinVisibleMs,
    logger,
  });

  return controlWindow;
}

module.exports = {
  createAndWireControlWindow,
};
