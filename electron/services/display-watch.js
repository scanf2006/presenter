function watchDisplayTopology({
  screen,
  onDisplayInfoChanged,
  onStabilizeProjector,
  onRecover,
  logger = console,
}) {
  // R3-M: Debounce display-metrics-changed to prevent rapid-fire window destroy/recreate.
  let metricsDebounceTimer = null;
  const METRICS_DEBOUNCE_MS = 500;

  screen.on('display-added', (_event, newDisplay) => {
    logger.log(`[ScreenManager] Display added: ${newDisplay.id}`);
    onDisplayInfoChanged();
    if (typeof onStabilizeProjector === 'function' && onStabilizeProjector('display-added') === true) {
      return;
    }
    onRecover('display-added');
  });

  screen.on('display-removed', (_event, oldDisplay) => {
    logger.log(`[ScreenManager] Display removed: ${oldDisplay.id}`);
    onDisplayInfoChanged();
    if (
      typeof onStabilizeProjector === 'function' &&
      onStabilizeProjector('display-removed') === true
    ) {
      return;
    }
    onRecover('display-removed');
  });

  screen.on('display-metrics-changed', () => {
    if (metricsDebounceTimer) clearTimeout(metricsDebounceTimer);
    metricsDebounceTimer = setTimeout(() => {
      metricsDebounceTimer = null;
      onDisplayInfoChanged();
      if (
        typeof onStabilizeProjector === 'function' &&
        onStabilizeProjector('display-metrics-changed') === true
      ) {
        return;
      }
      onRecover('display-metrics-changed');
    }, METRICS_DEBOUNCE_MS);
  });
}

module.exports = {
  watchDisplayTopology,
};
