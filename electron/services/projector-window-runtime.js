function notifyProjectorUnavailable(controlWindowRef) {
  const controlWindow = controlWindowRef();
  if (controlWindow && !controlWindow.isDestroyed()) {
    controlWindow.webContents.send('projector-status', {
      active: false,
      reason: 'no-external-display',
    });
  }
}

function notifyProjectorActive(controlWindowRef, display) {
  const controlWindow = controlWindowRef();
  if (controlWindow && !controlWindow.isDestroyed()) {
    controlWindow.webContents.send('projector-status', {
      active: true,
      displayId: display.id,
      displayBounds: display.bounds,
    });
  }
}

function bindProjectorWindowEvents({
  projectorWindow,
  controlWindowRef,
  onClosed,
  forceWindowZoom100,
  getProjectorScene,
  getProjectorContent,
  getProjectorBackground,
}) {
  projectorWindow.on('closed', () => {
    onClosed();
    const controlWindow = controlWindowRef();
    if (controlWindow && !controlWindow.isDestroyed()) {
      controlWindow.webContents.send('projector-status', { active: false });
    }
  });

  try {
    projectorWindow.webContents.setAudioMuted(false);
    projectorWindow.webContents.on('did-finish-load', () => {
      const replayProjectionState = () => {
        try {
          projectorWindow?.webContents?.send('projector-scene', getProjectorScene());
          const latestContent =
            typeof getProjectorContent === 'function' ? getProjectorContent() : null;
          const latestBackground =
            typeof getProjectorBackground === 'function' ? getProjectorBackground() : null;
          if (latestContent) {
            projectorWindow?.webContents?.send('projector-content', latestContent);
          }
          // Always replay background as well so background-only states can recover.
          projectorWindow?.webContents?.send('projector-background', latestBackground || null);
        } catch (err) {
          console.warn('[ProjectorWindow] replay projection state failed:', err?.message || err);
        }
      };

      try {
        forceWindowZoom100(projectorWindow);
        projectorWindow?.webContents?.setAudioMuted(false);
        // Renderer may still be mounting React listeners at did-finish-load.
        // Replay immediately and once more shortly after as a reliability guard.
        replayProjectionState();
        setTimeout(replayProjectionState, 120);
      } catch (err) {
        console.warn('[ProjectorWindow] did-finish-load post setup failed:', err?.message || err);
      }
    });
  } catch (err) {
    console.warn('[ProjectorWindow] initial audio setup failed:', err?.message || err);
  }
}

module.exports = {
  notifyProjectorUnavailable,
  notifyProjectorActive,
  bindProjectorWindowEvents,
};
