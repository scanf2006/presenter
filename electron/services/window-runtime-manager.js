function createWindowRuntimeManager({
  createAndWireControlWindow,
  setControlWindow,
  controlWindowDeps,
  openProjectorWindowWithRuntime,
  projectorWindowRef,
  setProjectorWindow,
  projectorWindowDeps,
}) {
  function createControlWindow() {
    const next = createAndWireControlWindow({
      ...controlWindowDeps,
      onClosed: () => {
        setControlWindow(null);
      },
    });
    setControlWindow(next);
  }

  function createProjectorWindow(targetDisplay) {
    openProjectorWindowWithRuntime({
      currentProjectorWindow: projectorWindowRef(),
      targetDisplay,
      ...projectorWindowDeps,
      setProjectorWindow,
    });
  }

  return {
    createControlWindow,
    createProjectorWindow,
  };
}

module.exports = {
  createWindowRuntimeManager,
};
