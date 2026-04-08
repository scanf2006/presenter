const path = require('path');

function buildWindowRuntimeDeps({
  BrowserWindow,
  createControlWindowInstance,
  screenManager,
  controlWindowTitle,
  electronDir,
  isDev,
  controlCloseController,
  bindControlWindowEvents,
  splashController,
  controlWindowRevealTimeoutMs,
  dialog,
  forceWindowZoom100,
  forceCloseProjectorWindow,
  onControlWindowClosed,
  splashMinVisibleMs,
  logger,
  notifyProjectorUnavailable,
  controlWindowRef,
  resolveProjectorDisplay,
  createAndWireProjectorWindow,
  createProjectorWindowInstance,
  projectorChannel,
  bindProjectorWindowEvents,
  getProjectorScene,
  notifyProjectorActive,
}) {
  const controlWindowDeps = {
    BrowserWindow,
    createControlWindowInstance,
    screenManager,
    title: controlWindowTitle,
    preloadPath: path.join(electronDir, 'preload.js'),
    iconPath: path.join(electronDir, '../public/icon.png'),
    isDev,
    devUrl: 'http://localhost:5199',
    indexPath: path.join(electronDir, '../dist/index.html'),
    controlCloseController,
    bindControlWindowEvents,
    splashController,
    revealTimeoutMs: controlWindowRevealTimeoutMs,
    dialog,
    forceWindowZoom100,
    forceCloseProjectorWindow,
    onClosed: onControlWindowClosed,
    splashMinVisibleMs,
    logger,
  };

  const projectorWindowDeps = {
    screenManager,
    notifyProjectorUnavailable,
    controlWindowRef,
    resolveProjectorDisplay,
    createAndWireProjectorWindow,
    BrowserWindow,
    createProjectorWindowInstance,
    preloadPath: path.join(electronDir, 'preload.js'),
    projectorChannel,
    bindProjectorWindowEvents,
    forceWindowZoom100,
    getProjectorScene,
    notifyProjectorActive,
    logger,
  };

  return {
    controlWindowDeps,
    projectorWindowDeps,
  };
}

module.exports = {
  buildWindowRuntimeDeps,
};
