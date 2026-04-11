function forceCloseProjectorWindowInstance(projectorWindow, reason = 'cleanup', debug = () => {}) {
  if (!projectorWindow || projectorWindow.isDestroyed()) return;
  try { projectorWindow.setAlwaysOnTop(false); } catch (err) { debug('projector-close-warning', { op: 'setAlwaysOnTop', reason, error: err?.message || String(err) }); }
  try { projectorWindow.setFullScreen(false); } catch (err) { debug('projector-close-warning', { op: 'setFullScreen', reason, error: err?.message || String(err) }); }
  try { projectorWindow.hide(); } catch (err) { debug('projector-close-warning', { op: 'hide', reason, error: err?.message || String(err) }); }
  try { projectorWindow.close(); } catch (err) { debug('projector-close-warning', { op: 'close', reason, error: err?.message || String(err) }); }
  try {
    if (!projectorWindow.isDestroyed()) {
      projectorWindow.destroy();
    }
  } catch (err) {
    debug('projector-close-warning', { op: 'destroy', reason, error: err?.message || String(err) });
  }
  debug('projector-force-close', { reason });
}

module.exports = {
  forceCloseProjectorWindowInstance,
};
