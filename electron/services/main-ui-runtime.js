const path = require('path');
const { createProjectorChannel } = require('./projector-channel');
const { createSplashController } = require('./splash-controller');

function createMainUiRuntime({
  normalizeYouTubeWatchUrl,
  loadProjectorShellIntoWindow,
  isDev,
  devUrl,
  BrowserWindow,
  screenManager,
  electronDir,
}) {
  const projectorChannel = createProjectorChannel({
    normalizeYouTubeWatchUrl,
    loadProjectorShell: (win) => loadProjectorShellIntoWindow({
      targetWindow: win,
      isDev,
      devUrl,
    }),
  });

  const splashController = createSplashController({
    BrowserWindow,
    path,
    screenManager,
    splashHtmlPath: electronDir,
  });

  return {
    projectorChannel,
    splashController,
  };
}

module.exports = {
  createMainUiRuntime,
};
