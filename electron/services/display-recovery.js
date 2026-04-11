function recoverDesktopAfterDisplaySwitch({
  BrowserWindow,
  controlWindow,
  reason = 'display-change',
  debug = () => {},
  onProjectorCleared = () => {},
} = {}) {
  const safe = (win, op) => {
    try {
      op();
    } catch (err) {
      debug('desktop-recover-warning', {
        reason,
        windowId: win?.id,
        error: err?.message || String(err),
      });
    }
  };

  debug('desktop-recover-start', { reason });
  try {
    const wins = BrowserWindow.getAllWindows();
    for (const win of wins) {
      if (!win || win.isDestroyed()) continue;
      // Keep control window alive, clear any accidental topmost/fullscreen flags.
      if (controlWindow && win.id === controlWindow.id) {
        safe(win, () => win.setAlwaysOnTop(false));
        safe(win, () => win.setFullScreen(false));
        continue;
      }
      // Non-control windows are considered projection/splash leftovers.
      safe(win, () => win.setAlwaysOnTop(false));
      safe(win, () => win.setFullScreen(false));
      safe(win, () => win.setKiosk(false));
      safe(win, () => win.setSkipTaskbar(false));
      safe(win, () => win.hide());
      safe(win, () => win.close());
      try {
        if (!win.isDestroyed()) {
          win.destroy();
        }
      } catch (err) {
        debug('desktop-recover-warning', {
          reason,
          windowId: win.id,
          error: err?.message || String(err),
        });
      }
    }
  } catch (err) {
    debug('desktop-recover-warning', { reason, error: err?.message || String(err) });
  }

  onProjectorCleared();

  if (controlWindow && !controlWindow.isDestroyed()) {
    controlWindow.webContents.send('projector-status', {
      active: false,
      reason,
    });
  }
  debug('desktop-recover-end', { reason });
}

module.exports = {
  recoverDesktopAfterDisplaySwitch,
};
