function forceWindowZoom100(win) {
  if (!win || win.isDestroyed()) return;
  try {
    win.webContents.setZoomFactor(1);
  } catch (_) {}
  try {
    win.webContents.setVisualZoomLevelLimits(1, 1);
  } catch (_) {}
}

function confirmExitDialog(dialog, win) {
  if (!win || win.isDestroyed()) return { confirmed: false };
  const choice = dialog.showMessageBoxSync(win, {
    type: 'question',
    buttons: ['Exit', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
    title: 'Confirm Exit',
    message: 'Are you sure you want to exit ChurchDisplay Pro?',
    detail: 'Unsaved temporary changes may be lost.',
  });
  return { confirmed: choice === 0 };
}

module.exports = {
  forceWindowZoom100,
  confirmExitDialog,
};
