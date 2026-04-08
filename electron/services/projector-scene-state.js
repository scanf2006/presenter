function createProjectorSceneState(initialScene) {
  let latestProjectorScene = { ...initialScene };

  function getScene() {
    return latestProjectorScene;
  }

  function setScene(nextScene) {
    latestProjectorScene = nextScene;
  }

  return {
    getScene,
    setScene,
  };
}

module.exports = {
  createProjectorSceneState,
};
