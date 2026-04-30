function createNdiOutputService({
  getProjectorWindow,
  logger = console,
  defaultSourceName = 'ChurchDisplay Pro',
  defaultWidth = 1280,
  defaultHeight = 720,
  defaultFps = 20,
}) {
  let grandiose = null;
  let sender = null;
  let frameTimer = null;
  let frameInFlight = false;
  let statusProbeTimer = null;
  let activeFrameIntervalMs = 0;
  const statusListeners = new Set();
  let lastStatusKey = '';
  let status = {
    enabled: false,
    sourceName: defaultSourceName,
    width: defaultWidth,
    height: defaultHeight,
    fps: defaultFps,
    lastError: null,
  };

  async function ensureGrandiose() {
    if (!grandiose) {
      grandiose = require('@stagetimerio/grandiose');
    }
    return grandiose;
  }

  function getStatus() {
    let connections = 0;
    try {
      connections = sender ? sender.connections() : 0;
    } catch (_) {
      connections = 0;
    }
    return {
      ...status,
      active: !!sender,
      connections,
    };
  }

  function emitStatusIfChanged(force = false) {
    const nextStatus = getStatus();
    const key = JSON.stringify(nextStatus);
    if (!force && key === lastStatusKey) return;
    lastStatusKey = key;
    for (const listener of statusListeners) {
      try {
        listener(nextStatus);
      } catch (err) {
        logger.warn('[NDI] status listener failed:', err?.message || err);
      }
    }
  }

  function ensureStatusProbe() {
    if (statusProbeTimer) return;
    statusProbeTimer = setInterval(() => {
      emitStatusIfChanged(false);
    }, 1000);
  }

  function clearStatusProbe() {
    if (!statusProbeTimer) return;
    clearInterval(statusProbeTimer);
    statusProbeTimer = null;
  }

  function resolveFrameIntervalMs() {
    const currentStatus = getStatus();
    const baseFps = Math.max(5, Number(status.fps) || defaultFps);
    const connections = Number(currentStatus.connections || 0);

    // Adaptive strategy:
    // - No active receivers: very low-rate heartbeat to save CPU/GPU.
    // - Active receivers: normal configured fps.
    const targetFps = connections <= 0 ? 4 : baseFps;
    return Math.max(10, Math.round(1000 / targetFps));
  }

  function startFrameLoop() {
    const nextInterval = resolveFrameIntervalMs();
    if (frameTimer && activeFrameIntervalMs === nextInterval) return;
    if (frameTimer) {
      clearInterval(frameTimer);
      frameTimer = null;
    }
    activeFrameIntervalMs = nextInterval;
    frameTimer = setInterval(() => {
      void sendFrame();
    }, activeFrameIntervalMs);
  }

  function stopFrameLoop() {
    if (!frameTimer) return;
    clearInterval(frameTimer);
    frameTimer = null;
    activeFrameIntervalMs = 0;
  }

  async function sendFrame() {
    if (frameInFlight || !sender) return;
    const projectorWindow = getProjectorWindow();
    if (!projectorWindow || projectorWindow.isDestroyed()) return;
    frameInFlight = true;
    try {
      const image = await projectorWindow.webContents.capturePage();
      if (!image || image.isEmpty()) return;
      const resized = image.resize({
        width: status.width,
        height: status.height,
        quality: 'good',
      });
      const frameBuffer = resized.toBitmap();
      if (!frameBuffer || frameBuffer.length === 0) return;
      await sender.video({
        xres: status.width,
        yres: status.height,
        frameRateN: status.fps,
        frameRateD: 1,
        fourCC: grandiose.FOURCC_BGRA,
        pictureAspectRatio: status.width / status.height,
        frameFormatType: grandiose.FORMAT_TYPE_PROGRESSIVE,
        lineStrideBytes: status.width * 4,
        data: frameBuffer,
      });
      status.lastError = null;
      emitStatusIfChanged(false);
      startFrameLoop();
    } catch (err) {
      status.lastError = err?.message || String(err);
      logger.warn('[NDI] frame send failed:', status.lastError);
      emitStatusIfChanged(false);
      // Back off when repeated failures happen.
      if (activeFrameIntervalMs > 0) {
        const backoffInterval = Math.min(1000, Math.max(activeFrameIntervalMs, 250));
        if (backoffInterval !== activeFrameIntervalMs) {
          activeFrameIntervalMs = backoffInterval;
          if (frameTimer) {
            clearInterval(frameTimer);
            frameTimer = setInterval(() => {
              void sendFrame();
            }, activeFrameIntervalMs);
          }
        }
      }
    } finally {
      frameInFlight = false;
    }
  }

  async function start(options = {}) {
    if (sender) {
      emitStatusIfChanged(false);
      return { success: true, status: getStatus() };
    }
    const projectorWindow = getProjectorWindow();
    if (!projectorWindow || projectorWindow.isDestroyed()) {
      return {
        success: false,
        error: 'Projector is not active. Start projector first, then enable NDI.',
      };
    }
    const sourceName =
      typeof options.sourceName === 'string' && options.sourceName.trim()
        ? options.sourceName.trim()
        : defaultSourceName;
    const width = Number.isFinite(options.width) ? Math.max(320, Number(options.width)) : defaultWidth;
    const height = Number.isFinite(options.height)
      ? Math.max(180, Number(options.height))
      : defaultHeight;
    const fps = Number.isFinite(options.fps) ? Math.max(5, Math.min(60, Number(options.fps))) : defaultFps;

    status = {
      ...status,
      enabled: true,
      sourceName,
      width,
      height,
      fps,
      lastError: null,
    };
    try {
      await ensureGrandiose();
      if (typeof grandiose.initialize === 'function') {
        await grandiose.initialize();
      }
      sender = await grandiose.send({
        name: sourceName,
        clockVideo: true,
      });
      ensureStatusProbe();
      startFrameLoop();
      emitStatusIfChanged(true);
      return { success: true, status: getStatus() };
    } catch (err) {
      status = {
        ...status,
        enabled: false,
        lastError: err?.message || String(err),
      };
      stopFrameLoop();
      clearStatusProbe();
      if (sender) {
        try {
          await sender.destroy();
        } catch (_) {
          // no-op
        }
        sender = null;
      }
      logger.error('[NDI] failed to start:', status.lastError);
      emitStatusIfChanged(true);
      return { success: false, error: status.lastError };
    }
  }

  async function stop() {
    status = {
      ...status,
      enabled: false,
    };
    stopFrameLoop();
    clearStatusProbe();
    frameInFlight = false;
    const activeSender = sender;
    sender = null;
    if (activeSender) {
      try {
        await activeSender.destroy();
      } catch (err) {
        logger.warn('[NDI] sender destroy failed:', err?.message || err);
      }
    }
    if (grandiose && typeof grandiose.destroy === 'function') {
      try {
        await grandiose.destroy();
      } catch (err) {
        logger.warn('[NDI] destroy failed:', err?.message || err);
      }
    }
    emitStatusIfChanged(true);
    return { success: true, status: getStatus() };
  }

  function onStatusChanged(listener) {
    if (typeof listener !== 'function') return () => {};
    statusListeners.add(listener);
    emitStatusIfChanged(true);
    return () => {
      statusListeners.delete(listener);
    };
  }

  return {
    getStatus,
    start,
    stop,
    onStatusChanged,
  };
}

module.exports = {
  createNdiOutputService,
};
