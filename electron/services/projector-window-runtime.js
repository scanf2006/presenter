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
  display,
  controlWindowRef,
  onClosed,
  forceWindowZoom100,
  getProjectorScene,
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
      try {
        if (display?.bounds) {
          projectorWindow.setBounds(
            {
              x: display.bounds.x,
              y: display.bounds.y,
              width: display.bounds.width,
              height: display.bounds.height,
            },
            false
          );
        }
        projectorWindow.setFullScreen(true);
        projectorWindow.setKiosk(true);
        forceWindowZoom100(projectorWindow);
        projectorWindow?.webContents?.setAudioMuted(false);
        projectorWindow?.webContents?.send('projector-scene', getProjectorScene());
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
