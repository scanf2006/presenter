function createProjectorChannel({
  normalizeYouTubeWatchUrl,
  loadProjectorShell,
  projectorUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
} = {}) {
  let projectorExternalMode = false;
  let projectorPendingPayload = null;

  function resetForWindow(projectorWindow) {
    projectorExternalMode = false;
    projectorPendingPayload = null;
    if (projectorWindow && !projectorWindow.isDestroyed()) {
      loadProjectorShell(projectorWindow);
    }
  }

  function openYouTubeWatchInProjector(projectorWindow, rawUrl) {
    if (!projectorWindow || projectorWindow.isDestroyed()) return false;
    const watchUrl = normalizeYouTubeWatchUrl(rawUrl);
    if (!watchUrl) return false;

    projectorExternalMode = true;
    try {
      projectorWindow.webContents.setUserAgent(projectorUserAgent);
    } catch (_) {}
    projectorWindow.loadURL(watchUrl);
    return true;
  }

  function sendToProjectorShell(projectorWindow, data) {
    if (!projectorWindow || projectorWindow.isDestroyed()) return;

    if (projectorExternalMode) {
      projectorPendingPayload = data;
      projectorWindow.webContents.once('did-finish-load', () => {
        projectorExternalMode = false;
        try { projectorWindow.webContents.setUserAgent(''); } catch (_) {}
        const payload = projectorPendingPayload;
        projectorPendingPayload = null;
        if (payload && projectorWindow && !projectorWindow.isDestroyed()) {
          try { projectorWindow.webContents.setAudioMuted(false); } catch (_) {}
          projectorWindow.webContents.send('projector-content', payload);
        }
      });
      loadProjectorShell(projectorWindow);
      return;
    }

    try { projectorWindow.webContents.setAudioMuted(false); } catch (_) {}
    projectorWindow.webContents.send('projector-content', data);
  }

  return {
    resetForWindow,
    openYouTubeWatchInProjector,
    sendToProjectorShell,
  };
}

module.exports = {
  createProjectorChannel,
};
