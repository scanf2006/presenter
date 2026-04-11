function watchDisplayTopology({ screen, onDisplayInfoChanged, onRecover, logger = console }) {
  // R3-M: Debounce display-metrics-changed to prevent rapid-fire window destroy/recreate.
  let metricsDebounceTimer = null;
  const METRICS_DEBOUNCE_MS = 500;

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
    if (metricsDebounceTimer) clearTimeout(metricsDebounceTimer);
    metricsDebounceTimer = setTimeout(() => {
      metricsDebounceTimer = null;
      onDisplayInfoChanged();
      onRecover('display-metrics-changed');
    }, METRICS_DEBOUNCE_MS);
  });
}

module.exports = {
  watchDisplayTopology,
};
