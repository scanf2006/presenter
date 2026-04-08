function registerWindowProjectorIPC({
  ipcMain,
  screenManager,
  createProjectorWindow,
  forceCloseProjectorWindow,
  requestCloseControlWindow,
  getControlWindow,
  getProjectorWindow,
}) {
  ipcMain.handle('get-displays', () => {
    return screenManager.getDisplaysInfo();
  });

  ipcMain.handle('start-projector', (_event, displayId) => {
    let targetDisplay = null;
    if (displayId) {
      targetDisplay = screenManager.getAllDisplays().find((d) => d.id === displayId);
    }
    createProjectorWindow(targetDisplay);
    return { success: true };
  });

  ipcMain.handle('stop-projector', () => {
    forceCloseProjectorWindow('ipc-stop-projector');
    return { success: true };
  });

  ipcMain.handle('close-control-window', () => {
    return requestCloseControlWindow();
  });

  ipcMain.handle('minimize-control-window', () => {
    const controlWindow = getControlWindow();
    if (controlWindow && !controlWindow.isDestroyed()) {
      controlWindow.minimize();
      return { success: true };
    }
    return { success: false };
  });

  ipcMain.handle('toggle-maximize-control-window', () => {
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
  });

  ipcMain.handle('get-projector-status', () => {
    const projectorWindow = getProjectorWindow();
    return {
      active: projectorWindow !== null && !projectorWindow.isDestroyed(),
    };
  });
}

module.exports = {
  registerWindowProjectorIPC,
};
