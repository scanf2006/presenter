const path = require('path');

function resolveDevRendererUrl() {
  const candidate =
    process.env.ELECTRON_RENDERER_URL || process.env.VITE_DEV_SERVER_URL || 'http://localhost:5199';
  try {
    const parsed = new URL(candidate);
    parsed.hash = '';
    parsed.search = '';
    return parsed.toString().replace(/\/$/, '');
  } catch (_) {
    return 'http://localhost:5199';
  }
}

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
  getProjectorContent,
  getProjectorBackground,
  notifyProjectorActive,
  setupNavigationRestrictions,
}) {
  const devUrl = resolveDevRendererUrl();

  const controlWindowDeps = {
    BrowserWindow,
    createControlWindowInstance,
    screenManager,
    title: controlWindowTitle,
    preloadPath: path.join(electronDir, 'preload.js'),
    iconPath: path.join(electronDir, '../public/icon.png'),
    isDev,
    devUrl,
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
    setupNavigationRestrictions,
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
    getProjectorContent,
    getProjectorBackground,
    notifyProjectorActive,
    logger,
    setupNavigationRestrictions,
  };

  return {
    controlWindowDeps,
    projectorWindowDeps,
  };
}

module.exports = {
  buildWindowRuntimeDeps,
};
