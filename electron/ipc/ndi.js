function registerNdiIPC({ ipcMain, ndiOutputService, getControlWindow }) {
  if (ndiOutputService && typeof ndiOutputService.onStatusChanged === 'function') {
    ndiOutputService.onStatusChanged((status) => {
      const controlWindow =
        typeof getControlWindow === 'function' ? getControlWindow() : null;
      if (!controlWindow || controlWindow.isDestroyed()) return;
      controlWindow.webContents.send('ndi-status', status);
    });
  }

  ipcMain.handle('ndi-get-status', () => {
    try {
      if (!ndiOutputService || typeof ndiOutputService.getStatus !== 'function') {
        return {
          active: false,
          enabled: false,
          sourceName: 'ChurchDisplay Pro',
          width: 1280,
          height: 720,
          fps: 30,
          connections: 0,
          lastError: 'NDI service is unavailable.',
        };
      }
      return ndiOutputService.getStatus();
    } catch (err) {
      return {
        active: false,
        enabled: false,
        sourceName: 'ChurchDisplay Pro',
        width: 1280,
        height: 720,
        fps: 30,
        connections: 0,
        lastError: err?.message || String(err),
      };
    }
  });

  ipcMain.handle('ndi-start', async (_event, options = {}) => {
    try {
      if (!ndiOutputService || typeof ndiOutputService.start !== 'function') {
        return { success: false, error: 'NDI service is unavailable.' };
      }
      return await ndiOutputService.start(options);
    } catch (err) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('ndi-stop', async () => {
    try {
      if (!ndiOutputService || typeof ndiOutputService.stop !== 'function') {
        return { success: false, error: 'NDI service is unavailable.' };
      }
      return await ndiOutputService.stop();
    } catch (err) {
      return { success: false, error: err?.message || String(err) };
    }
  });
}

module.exports = {
  registerNdiIPC,
};
