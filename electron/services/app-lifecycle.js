function registerAppLifecycleHandlers({
  app,
  onWindowAllClosed,
  onBeforeQuit,
  onActivate,
}) {
  app.on('window-all-closed', onWindowAllClosed);
  app.on('before-quit', onBeforeQuit);
  app.on('activate', onActivate);
}

module.exports = {
  registerAppLifecycleHandlers,
};
