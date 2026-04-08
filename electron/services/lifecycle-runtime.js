function setupLifecycleRuntime({
  registerAppLifecycleHandlers,
  app,
  forceCloseProjectorWindow,
  controlCloseController,
  controlWindowRef,
  createControlWindow,
  onBeforeQuitExtra,
}) {
  registerAppLifecycleHandlers({
    app,
    onWindowAllClosed: () => {
      forceCloseProjectorWindow('window-all-closed');
      app.quit();
    },
    onBeforeQuit: () => {
      controlCloseController.allowClose();
      forceCloseProjectorWindow('before-quit');
      if (typeof onBeforeQuitExtra === 'function') {
        try {
          onBeforeQuitExtra();
        } catch (_) {}
      }
      try {
        const controlWindow = controlWindowRef();
        if (controlWindow && !controlWindow.isDestroyed()) {
          controlWindow.destroy();
        }
      } catch (_) {}
    },
    onActivate: () => {
      const controlWindow = controlWindowRef();
      if (controlWindow === null) {
        createControlWindow();
      }
    },
  });
}

module.exports = {
  setupLifecycleRuntime,
};
