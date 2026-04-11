function registerProjectorEventIPC({
  ipcMain,
  appendBgDebug,
  getProjectorWindow,
  sendToProjectorShell,
  openYouTubeWatchInProjector,
  getControlWindow,
  ensureProjectionAccess,
  getTrialStatus,
  getLatestProjectorScene,
  setLatestProjectorScene,
}) {
  function notifyTrialWarning(payload) {
    const controlWindow = typeof getControlWindow === 'function' ? getControlWindow() : null;
    if (controlWindow && !controlWindow.isDestroyed()) {
      controlWindow.webContents.send('trial-warning', payload);
    }
  }

  function gateProjection(eventTag) {
    if (typeof ensureProjectionAccess !== 'function') return { allowed: true };
    const access = ensureProjectionAccess();
    if (access.allowed) return access;

    const trial = typeof getTrialStatus === 'function' ? getTrialStatus() : null;
    appendBgDebug('trial-blocked', {
      event: eventTag,
      reason: access.reason || 'trial_expired',
      message: access.message,
    });
    notifyTrialWarning({
      code: access.reason || 'trial_expired',
      message: access.message || 'Trial expired. Please activate license.',
      trial,
    });

    sendToProjectorShell({
      type: 'text',
      text: 'Trial expired. Please activate license.',
      fontSize: 'medium',
      textColor: '#ff8080',
      timestamp: Date.now(),
    });

    return access;
  }

  ipcMain.on('send-to-projector', (_event, data) => {
    const projectorWindow = getProjectorWindow();
    if (!projectorWindow || projectorWindow.isDestroyed()) return;

    const access = gateProjection('send-to-projector');
    if (!access.allowed) return;

    appendBgDebug('send-to-projector', {
      type: data?.type,
      hasBackground: !!data?.background,
      backgroundType: data?.background?.type,
      backgroundPath: data?.background?.path,
    });

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
    const projectorWindow = getProjectorWindow();
    if (!projectorWindow || projectorWindow.isDestroyed()) return;

    const access = gateProjection('send-to-projector-background');
    if (!access.allowed) return;

    appendBgDebug('send-to-projector-background', {
      hasBackground: !!data,
      backgroundType: data?.type,
      backgroundPath: data?.path,
    });
    projectorWindow.webContents.send('projector-background', data);
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
