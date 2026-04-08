function forceCloseProjectorWindowInstance(projectorWindow, reason = 'cleanup', debug = () => {}) {
  if (!projectorWindow || projectorWindow.isDestroyed()) return;
  try { projectorWindow.setAlwaysOnTop(false); } catch (_) {}
  try { projectorWindow.setFullScreen(false); } catch (_) {}
  try { projectorWindow.hide(); } catch (_) {}
  try { projectorWindow.close(); } catch (_) {}
  try {
    if (!projectorWindow.isDestroyed()) {
      projectorWindow.destroy();
    }
  } catch (_) {}
  debug('projector-force-close', { reason });
}

module.exports = {
  forceCloseProjectorWindowInstance,
};
