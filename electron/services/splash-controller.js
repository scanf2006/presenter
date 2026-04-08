function createSplashController({
  BrowserWindow,
  path,
  screenManager,
  splashHtmlPath,
}) {
  let splashWindow = null;
  let controlWindowShown = false;
  let splashOpenedAt = 0;

  function createSplashWindow() {
    if (splashWindow && !splashWindow.isDestroyed()) return;
    const primaryDisplay = screenManager.getPrimaryDisplay();
    splashWindow = new BrowserWindow({
      width: 760,
      height: 440,
      x: primaryDisplay.workArea.x + Math.max(0, Math.floor((primaryDisplay.workArea.width - 760) / 2)),
      y: primaryDisplay.workArea.y + Math.max(0, Math.floor((primaryDisplay.workArea.height - 440) / 2)),
      frame: false,
      transparent: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      backgroundColor: '#00000000',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    splashWindow.setMenuBarVisibility(false);
    splashWindow.loadFile(path.join(splashHtmlPath, 'splash.html'));
    splashWindow.once('ready-to-show', () => {
      splashOpenedAt = Date.now();
      splashWindow?.show();
    });
  }

  function closeSplashWindow() {
    if (!splashWindow || splashWindow.isDestroyed()) return;
    splashWindow.close();
    splashWindow = null;
  }

  function revealControlWindow(controlWindow) {
    if (!controlWindow || controlWindow.isDestroyed() || controlWindowShown) return;
    controlWindowShown = true;
    closeSplashWindow();
    controlWindow.show();
    controlWindow.focus();
  }

  function computeRevealDelay(minDurationMs) {
    const elapsed = splashOpenedAt > 0 ? (Date.now() - splashOpenedAt) : 0;
    return Math.max(0, minDurationMs - elapsed);
  }

  function resetControlShown() {
    controlWindowShown = false;
  }

  return {
    createSplashWindow,
    closeSplashWindow,
    revealControlWindow,
    computeRevealDelay,
    resetControlShown,
  };
}

module.exports = {
  createSplashController,
};
