function createProjectorChannel({
  normalizeYouTubeWatchUrl,
  loadProjectorShell,
  projectorUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
} = {}) {
  let projectorExternalMode = false;
  let projectorPendingPayload = null;
  // M8-R2: Track the pending did-finish-load handler to prevent listener accumulation.
  let pendingLoadHandler = null;

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
    } catch (err) {
      console.warn('[ProjectorChannel] setUserAgent failed:', err?.message || err);
    }
    projectorWindow.loadURL(watchUrl);
    return true;
  }

  function sendToProjectorShell(projectorWindow, data) {
    if (!projectorWindow || projectorWindow.isDestroyed()) return;

    if (projectorExternalMode) {
      projectorPendingPayload = data;
      // M8-R2: Remove previous listener before adding a new one to prevent accumulation.
      if (pendingLoadHandler) {
        try { projectorWindow.webContents.removeListener('did-finish-load', pendingLoadHandler); } catch (_) { /* ignore */ }
      }
      pendingLoadHandler = () => {
        pendingLoadHandler = null;
        projectorExternalMode = false;
        try { projectorWindow.webContents.setUserAgent(''); } catch (err) { console.warn('[ProjectorChannel] reset userAgent failed:', err?.message || err); }
        const payload = projectorPendingPayload;
        projectorPendingPayload = null;
        if (payload && projectorWindow && !projectorWindow.isDestroyed()) {
          try { projectorWindow.webContents.setAudioMuted(false); } catch (err) { console.warn('[ProjectorChannel] unmute after shell load failed:', err?.message || err); }
          projectorWindow.webContents.send('projector-content', payload);
        }
      };
      projectorWindow.webContents.once('did-finish-load', pendingLoadHandler);
      loadProjectorShell(projectorWindow);
      return;
    }

    try { projectorWindow.webContents.setAudioMuted(false); } catch (err) { console.warn('[ProjectorChannel] unmute before send failed:', err?.message || err); }
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
