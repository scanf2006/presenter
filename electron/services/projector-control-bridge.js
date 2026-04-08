function createProjectorControlBridge({
  controlCloseController,
  controlWindowRef,
  dialog,
  projectorChannel,
  projectorWindowRef,
}) {
  function requestCloseControlWindow() {
    return controlCloseController.requestClose(controlWindowRef(), dialog);
  }

  function openYouTubeWatchInProjector(rawUrl) {
    return projectorChannel.openYouTubeWatchInProjector(projectorWindowRef(), rawUrl);
  }

  function sendToProjectorShell(data) {
    projectorChannel.sendToProjectorShell(projectorWindowRef(), data);
  }

  return {
    requestCloseControlWindow,
    openYouTubeWatchInProjector,
    sendToProjectorShell,
  };
}

module.exports = {
  createProjectorControlBridge,
};
