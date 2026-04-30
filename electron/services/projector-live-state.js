function createProjectorLiveState() {
  let latestContent = null;
  let latestBackground = null;

  return {
    getLatestContent() {
      return latestContent;
    },
    setLatestContent(content) {
      latestContent = content || null;
    },
    getLatestBackground() {
      return latestBackground;
    },
    setLatestBackground(background) {
      latestBackground = background || null;
    },
  };
}

module.exports = {
  createProjectorLiveState,
};
