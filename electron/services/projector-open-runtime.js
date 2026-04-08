function resolveProjectorDisplay({
  targetDisplay,
  screenManager,
  notifyProjectorUnavailable,
  controlWindowRef,
  logger = console,
}) {
  const display = targetDisplay || screenManager.getProjectorDisplay();
  if (display) return display;

  logger.log('[ScreenManager] No external display detected, projector window not created.');
  notifyProjectorUnavailable(controlWindowRef);
  return null;
}

function createAndWireProjectorWindow({
  BrowserWindow,
  createProjectorWindowInstance,
  display,
  preloadPath,
  projectorChannel,
  bindProjectorWindowEvents,
  controlWindowRef,
  forceWindowZoom100,
  getProjectorScene,
  notifyProjectorActive,
  onProjectorClosed,
  logger = console,
}) {
  const projectorWindow = createProjectorWindowInstance({
    BrowserWindow,
    display,
    preloadPath,
  });

  projectorChannel.resetForWindow(projectorWindow);

  bindProjectorWindowEvents({
    projectorWindow,
    controlWindowRef,
    onClosed: onProjectorClosed,
    forceWindowZoom100,
    getProjectorScene,
  });

  notifyProjectorActive(controlWindowRef, display);
  logger.log(`[ScreenManager] Projector window opened on display ${display.id} (${display.bounds.width}x${display.bounds.height})`);
  return projectorWindow;
}

module.exports = {
  resolveProjectorDisplay,
  createAndWireProjectorWindow,
};
