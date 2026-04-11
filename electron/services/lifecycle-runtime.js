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
        } catch (err) {
          console.warn('[Lifecycle] onBeforeQuitExtra failed:', err?.message || err);
        }
      }
      try {
        const controlWindow = controlWindowRef();
        if (controlWindow && !controlWindow.isDestroyed()) {
          controlWindow.destroy();
        }
      } catch (err) {
        console.warn('[Lifecycle] control window destroy failed:', err?.message || err);
      }
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
