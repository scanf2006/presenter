function registerProjectorEventIPC({
  ipcMain,
  appendBgDebug,
  getProjectorWindow,
  sendToProjectorShell,
  openYouTubeWatchInProjector,
  getLatestProjectorScene,
  setLatestProjectorScene,
}) {
  ipcMain.on('send-to-projector', (_event, data) => {
    appendBgDebug('send-to-projector', {
      type: data?.type,
      hasBackground: !!data?.background,
      backgroundType: data?.background?.type,
      backgroundPath: data?.background?.path,
    });

    const projectorWindow = getProjectorWindow();
    if (!projectorWindow || projectorWindow.isDestroyed()) return;

    if (data?.type === 'youtube') {
      const youtubeUrl = data?.url || (data?.videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(data.videoId)}` : '');
      const opened = openYouTubeWatchInProjector(youtubeUrl);
      if (!opened) {
        sendToProjectorShell({
          type: 'text',
          text: 'Failed to open YouTube URL',
          fontSize: 'medium',
          timestamp: Date.now(),
        });
      }
      return;
    }

    sendToProjectorShell(data);
  });

  ipcMain.on('send-to-projector-background', (_event, data) => {
    appendBgDebug('send-to-projector-background', {
      hasBackground: !!data,
      backgroundType: data?.type,
      backgroundPath: data?.path,
    });
    const projectorWindow = getProjectorWindow();
    if (projectorWindow && !projectorWindow.isDestroyed()) {
      projectorWindow.webContents.send('projector-background', data);
    }
  });

  ipcMain.on('projector-transition', (_event, transitionData) => {
    const projectorWindow = getProjectorWindow();
    if (projectorWindow && !projectorWindow.isDestroyed()) {
      projectorWindow.webContents.send('projector-transition', transitionData);
    }
  });

  ipcMain.on('projector-scene', (_event, sceneData) => {
    const nextScene = {
      ...getLatestProjectorScene(),
      ...(sceneData || {}),
      mode: sceneData?.mode === 'split_camera' ? 'split_camera' : 'normal',
    };
    setLatestProjectorScene(nextScene);
    appendBgDebug('projector-scene', {
      mode: nextScene.mode,
      cameraPanePercent: nextScene.cameraPanePercent,
      enableCameraTestMode: nextScene.enableCameraTestMode === true,
      projectorActive: !!(getProjectorWindow() && !getProjectorWindow().isDestroyed()),
    });
    const projectorWindow = getProjectorWindow();
    if (projectorWindow && !projectorWindow.isDestroyed()) {
      projectorWindow.webContents.send('projector-scene', nextScene);
    }
  });

  ipcMain.on('projector-blackout', () => {
    const projectorWindow = getProjectorWindow();
    if (projectorWindow && !projectorWindow.isDestroyed()) {
      projectorWindow.webContents.send('projector-blackout');
    }
  });

  ipcMain.on('projector-command', (_event, data) => {
    const projectorWindow = getProjectorWindow();
    if (projectorWindow && !projectorWindow.isDestroyed()) {
      projectorWindow.webContents.send('projector-command', data);
    }
  });
}

module.exports = {
  registerProjectorEventIPC,
};
