function openProjectorWindowWithRuntime({
  currentProjectorWindow,
  targetDisplay,
  screenManager,
  resolveProjectorDisplay,
  notifyProjectorUnavailable,
  controlWindowRef,
  createAndWireProjectorWindow,
  BrowserWindow,
  createProjectorWindowInstance,
  preloadPath,
  projectorChannel,
  bindProjectorWindowEvents,
  forceWindowZoom100,
  getProjectorScene,
  getProjectorContent,
  getProjectorBackground,
  notifyProjectorActive,
  setProjectorWindow,
  logger = console,
}) {
  if (currentProjectorWindow && !currentProjectorWindow.isDestroyed()) {
    currentProjectorWindow.close();
  }

  const display = resolveProjectorDisplay({
    targetDisplay,
    screenManager,
    notifyProjectorUnavailable,
    controlWindowRef,
    logger,
  });
  if (!display) return null;

  const nextProjectorWindow = createAndWireProjectorWindow({
    BrowserWindow,
    createProjectorWindowInstance,
    display,
    preloadPath,
    projectorChannel,
    bindProjectorWindowEvents,
    controlWindowRef,
    forceWindowZoom100,
    getProjectorScene,
    getProjectorContent,
    getProjectorBackground,
    notifyProjectorActive,
    onProjectorClosed: () => {
      setProjectorWindow(null);
    },
    logger,
  });
  setProjectorWindow(nextProjectorWindow);
  return nextProjectorWindow;
}

module.exports = {
  openProjectorWindowWithRuntime,
};
