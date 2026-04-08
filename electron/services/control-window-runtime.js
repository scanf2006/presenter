function bindControlWindowEvents({
  controlWindow,
  revealTimeoutMs,
  splashController,
  controlCloseController,
  dialog,
  forceWindowZoom100,
  forceCloseProjectorWindow,
  onClosed,
  splashMinVisibleMs,
  logger = console,
}) {
  const revealByTimer = setTimeout(() => {
    try {
      splashController.revealControlWindow(controlWindow);
    } catch (_) {}
  }, revealTimeoutMs);

  controlWindow.webContents.on('did-finish-load', () => {
    forceWindowZoom100(controlWindow);
  });

  controlWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    logger.error('[ControlWindow] did-fail-load', { errorCode, errorDescription, validatedURL });
    try {
      splashController.revealControlWindow(controlWindow);
    } catch (_) {}
  });

  controlWindow.once('ready-to-show', () => {
    clearTimeout(revealByTimer);
    const delay = splashController.computeRevealDelay(splashMinVisibleMs);
    setTimeout(() => splashController.revealControlWindow(controlWindow), delay);
  });

  controlWindow.on('close', (event) => {
    if (controlCloseController.canBypassClosePrompt()) return;
    event.preventDefault();
    const result = controlCloseController.confirmClose(controlWindow, dialog);
    if (result.confirmed) {
      controlCloseController.allowClose();
      controlWindow.close();
    }
  });

  controlWindow.on('closed', () => {
    clearTimeout(revealByTimer);
    controlCloseController.reset();
    splashController.resetControlShown();
    forceCloseProjectorWindow('control-window-closed');
    splashController.closeSplashWindow();
    onClosed();
  });
}

module.exports = {
  bindControlWindowEvents,
};
