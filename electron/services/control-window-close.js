function createControlWindowCloseController({ confirmExitDialog }) {
  let allowControlWindowClose = false;

  function reset() {
    allowControlWindowClose = false;
  }

  function allowClose() {
    allowControlWindowClose = true;
  }

  function canBypassClosePrompt() {
    return allowControlWindowClose;
  }

  function confirmClose(controlWindow, dialog) {
    return confirmExitDialog(dialog, controlWindow);
  }

  function requestClose(controlWindow, dialog) {
    if (!controlWindow || controlWindow.isDestroyed()) {
      return { success: false, cancelled: true };
    }
    const result = confirmClose(controlWindow, dialog);
    if (!result.confirmed) {
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
    requestClose,
  };
}

module.exports = {
  createControlWindowCloseController,
};
