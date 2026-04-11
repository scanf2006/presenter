function registerWindowProjectorIPC({
  ipcMain,
  screenManager,
  createProjectorWindow,
  forceCloseProjectorWindow,
  requestCloseControlWindow,
  getControlWindow,
  getProjectorWindow,
  ensureProjectionAccess,
  getTrialStatus,
}) {
  function notifyTrialWarning(payload) {
    const controlWindow = getControlWindow();
    if (controlWindow && !controlWindow.isDestroyed()) {
      controlWindow.webContents.send('trial-warning', payload);
    }
  }

  ipcMain.handle('get-displays', () => {
    try {
      return screenManager.getDisplaysInfo();
    } catch (err) {
      console.error('[WindowIPC] get-displays error:', err?.message);
      return [];
    }
  });

  ipcMain.handle('start-projector', (_event, displayId) => {
    try {
      if (typeof ensureProjectionAccess === 'function') {
        const access = ensureProjectionAccess();
        if (!access.allowed) {
          notifyTrialWarning({
            code: access.reason || 'trial_expired',
            message: access.message || 'Trial expired. Please activate license.',
            trial: typeof getTrialStatus === 'function' ? getTrialStatus() : null,
          });
          return {
            success: false,
            error: access.message || 'Trial expired. Please activate license to continue projection.',
          };
        }
      }
      let targetDisplay = null;
      if (displayId) {
        targetDisplay = screenManager.getAllDisplays().find((d) => d.id === displayId);
      }
      createProjectorWindow(targetDisplay);
      return { success: true };
    } catch (err) {
      console.error('[WindowIPC] start-projector error:', err?.message);
      return { success: false, error: err?.message || 'Failed to start projector.' };
    }
  });

  ipcMain.handle('stop-projector', () => {
    try {
      forceCloseProjectorWindow('ipc-stop-projector');
      return { success: true };
    } catch (err) {
      console.error('[WindowIPC] stop-projector error:', err?.message);
      return { success: false, error: err?.message || 'Failed to stop projector.' };
    }
  });

  ipcMain.handle('close-control-window', () => {
    try {
      return requestCloseControlWindow();
    } catch (err) {
      console.error('[WindowIPC] close-control-window error:', err?.message);
      return { success: false };
    }
  });

  ipcMain.handle('minimize-control-window', () => {
    try {
      const controlWindow = getControlWindow();
      if (controlWindow && !controlWindow.isDestroyed()) {
        controlWindow.minimize();
        return { success: true };
      }
      return { success: false };
    } catch (err) {
      console.error('[WindowIPC] minimize-control-window error:', err?.message);
      return { success: false };
    }
  });

  ipcMain.handle('toggle-maximize-control-window', () => {
    try {
      const controlWindow = getControlWindow();
      if (controlWindow && !controlWindow.isDestroyed()) {
        if (controlWindow.isMaximized()) {
          controlWindow.unmaximize();
          return { success: true, isMaximized: false };
        }
        controlWindow.maximize();
        return { success: true, isMaximized: true };
      }
      return { success: false, isMaximized: false };
    } catch (err) {
      console.error('[WindowIPC] toggle-maximize error:', err?.message);
      return { success: false, isMaximized: false };
    }
  });

  ipcMain.handle('get-projector-status', () => {
    try {
      const projectorWindow = getProjectorWindow();
      return {
        active: projectorWindow !== null && !projectorWindow.isDestroyed(),
      };
    } catch (err) {
      return { active: false };
    }
  });
}

module.exports = {
  registerWindowProjectorIPC,
};
