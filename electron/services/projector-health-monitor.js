function isSameBounds(a, b) {
  if (!a || !b) return false;
  return (
    Number(a.x) === Number(b.x) &&
    Number(a.y) === Number(b.y) &&
    Number(a.width) === Number(b.width) &&
    Number(a.height) === Number(b.height)
  );
}

function evaluateProjectorHealthState({ projectorWindow, targetDisplay }) {
  if (!projectorWindow || projectorWindow.isDestroyed()) {
    return { healthy: true, reasons: [] };
  }

  const reasons = [];

  const displayBounds = targetDisplay?.bounds || null;
  const windowBounds = projectorWindow.getBounds();
  if (displayBounds && !isSameBounds(windowBounds, displayBounds)) {
    reasons.push('bounds-mismatch');
  }

  if (!projectorWindow.isFullScreen()) {
    reasons.push('fullscreen-off');
  }

  if (!projectorWindow.isKiosk()) {
    reasons.push('kiosk-off');
  }

  if (projectorWindow.isMinimized()) {
    reasons.push('window-minimized');
  }

  return { healthy: reasons.length === 0, reasons };
}

function createProjectorHealthMonitor({
  getProjectorWindow,
  getProjectorDisplayId,
  screenManager,
  stabilizeProjectorWindow,
  logger = console,
  intervalMs = 1500,
}) {
  let timer = null;

  function getTargetDisplay(projectorWindow) {
    const displayId = getProjectorDisplayId?.();
    const displays = screenManager?.getAllDisplays?.() || [];
    if (displayId !== null && displayId !== undefined) {
      const byId = displays.find((d) => String(d.id) === String(displayId));
      if (byId) return byId;
    }
    return screenManager?.getDisplayMatching?.(projectorWindow.getBounds()) || null;
  }

  function tick() {
    const projectorWindow = getProjectorWindow?.();
    if (!projectorWindow || projectorWindow.isDestroyed()) return;

    const targetDisplay = getTargetDisplay(projectorWindow);
    const health = evaluateProjectorHealthState({ projectorWindow, targetDisplay });
    if (health.healthy) return;

    const reason = `health-monitor:${health.reasons.join(',')}`;
    const recovered = stabilizeProjectorWindow?.(reason) === true;
    if (recovered) {
      logger.log(`[ProjectorHealth] recovered (${health.reasons.join(',')})`);
    } else {
      logger.warn(`[ProjectorHealth] recovery failed (${health.reasons.join(',')})`);
    }
  }

  function start() {
    if (timer) return;
    timer = setInterval(tick, intervalMs);
  }

  function stop() {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
  }

  return {
    start,
    stop,
    tick,
  };
}

module.exports = {
  isSameBounds,
  evaluateProjectorHealthState,
  createProjectorHealthMonitor,
};
