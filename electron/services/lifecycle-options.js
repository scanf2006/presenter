function buildLifecycleOptions({
  registerAppLifecycleHandlers,
  app,
  forceCloseProjectorWindow,
  controlCloseController,
  controlWindowRef,
  createControlWindow,
  onBeforeQuitExtra,
}) {
  return {
    registerAppLifecycleHandlers,
    app,
    forceCloseProjectorWindow,
    controlCloseController,
    controlWindowRef,
    createControlWindow,
    onBeforeQuitExtra,
  };
}

module.exports = {
  buildLifecycleOptions,
};
