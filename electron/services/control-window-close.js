const { ipcMain } = require('electron');

function createControlWindowCloseController({ confirmExitDialog }) {
  let allowControlWindowClose = false;
  let pendingExitRequest = false;

  function reset() {
    allowControlWindowClose = false;
    pendingExitRequest = false;
  }

  function allowClose() {
    allowControlWindowClose = true;
  }

  function canBypassClosePrompt() {
    return allowControlWindowClose;
  }

  /**
   * Fallback: synchronous native dialog (used only when renderer is unresponsive).
   */
  function confirmClose(controlWindow, dialog) {
    return confirmExitDialog(dialog, controlWindow);
  }

  /**
   * Ask the renderer to show an in-app confirm dialog.
   * If the renderer responds with `confirmed: true`, we allow the close and
   * call `controlWindow.close()` again (which now bypasses because
   * `allowControlWindowClose` is true).
   * If the renderer doesn't respond within 8 s, fall back to native dialog.
   */
  function requestExitViaRenderer(controlWindow, dialog) {
    if (!controlWindow || controlWindow.isDestroyed()) return;
    if (pendingExitRequest) return; // avoid double-prompt
    pendingExitRequest = true;

    let responded = false;

    const timeoutId = setTimeout(() => {
      if (responded) return;
      responded = true;
      pendingExitRequest = false;
      // Fallback to native dialog
      const result = confirmClose(controlWindow, dialog);
      if (result.confirmed) {
        allowClose();
        controlWindow.close();
      }
    }, 8000);

    ipcMain.once('confirm-exit-response', (_event, confirmed) => {
      if (responded) return;
      responded = true;
      clearTimeout(timeoutId);
      pendingExitRequest = false;
      if (confirmed) {
        allowClose();
        controlWindow.close();
      }
    });

    controlWindow.webContents.send('confirm-exit-request');
  }

  /**
   * Programmatic close request (from renderer IPC `close-control-window`).
   * The renderer already confirmed via AppDialog before calling this, so we
   * skip confirmation and just close.
   */
  function requestClose(controlWindow) {
    if (!controlWindow || controlWindow.isDestroyed()) {
      return { success: false, cancelled: true };
    }
    allowClose();
    controlWindow.close();
    return { success: true };
  }

  return {
    reset,
    allowClose,
    canBypassClosePrompt,
    confirmClose,
    requestExitViaRenderer,
    requestClose,
  };
}

module.exports = {
  createControlWindowCloseController,
};
