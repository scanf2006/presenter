function createProjectorRecoveryBridge({
  getProjectorWindow,
  setProjectorWindow,
  appendBgDebug,
  forceCloseProjectorWindowInstance,
  recoverDisplayDesktop,
  BrowserWindow,
  getControlWindow,
}) {
  function forceCloseProjectorWindow(reason = 'cleanup') {
    forceCloseProjectorWindowInstance(
      getProjectorWindow(),
      reason,
      (tag, payload) => appendBgDebug(tag, payload),
    );
  }

  function recoverDesktopAfterDisplaySwitch(reason = 'display-change') {
    recoverDisplayDesktop({
      BrowserWindow,
      controlWindow: getControlWindow(),
      reason,
      debug: (tag, payload) => appendBgDebug(tag, payload),
      onProjectorCleared: () => {
        setProjectorWindow(null);
      },
    });
  }

  return {
    forceCloseProjectorWindow,
    recoverDesktopAfterDisplaySwitch,
  };
}

module.exports = {
  createProjectorRecoveryBridge,
};
