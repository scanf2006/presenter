function recoverDesktopAfterDisplaySwitch({
  BrowserWindow,
  controlWindow,
  reason = 'display-change',
  debug = () => {},
  onProjectorCleared = () => {},
} = {}) {
  debug('desktop-recover-start', { reason });
  try {
    const wins = BrowserWindow.getAllWindows();
    for (const win of wins) {
      if (!win || win.isDestroyed()) continue;
      // Keep control window alive, clear any accidental topmost/fullscreen flags.
      if (controlWindow && win.id === controlWindow.id) {
        try { win.setAlwaysOnTop(false); } catch (_) {}
        try { win.setFullScreen(false); } catch (_) {}
        continue;
      }
      // Non-control windows are considered projection/splash leftovers.
      try { win.setAlwaysOnTop(false); } catch (_) {}
      try { win.setFullScreen(false); } catch (_) {}
      try { win.setKiosk(false); } catch (_) {}
      try { win.setSkipTaskbar(false); } catch (_) {}
      try { win.hide(); } catch (_) {}
      try { win.close(); } catch (_) {}
      try {
        if (!win.isDestroyed()) {
          win.destroy();
        }
      } catch (_) {}
    }
  } catch (_) {}

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
