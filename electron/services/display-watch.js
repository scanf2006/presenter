function watchDisplayTopology({
  screen,
  onDisplayInfoChanged,
  onRecover,
  logger = console,
}) {
  screen.on('display-added', (_event, newDisplay) => {
    logger.log(`[ScreenManager] Display added: ${newDisplay.id}`);
    onDisplayInfoChanged();
    onRecover('display-added');
  });

  screen.on('display-removed', (_event, oldDisplay) => {
    logger.log(`[ScreenManager] Display removed: ${oldDisplay.id}`);
    onDisplayInfoChanged();
    onRecover('display-removed');
  });

  screen.on('display-metrics-changed', () => {
    onDisplayInfoChanged();
    onRecover('display-metrics-changed');
  });
}

module.exports = {
  watchDisplayTopology,
};
