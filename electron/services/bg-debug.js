const fs = require('fs');
const path = require('path');

function createBgDebugAppender({
  enabled = true,
  logger = console,
  flushIntervalMs = 120,
  maxQueueSize = 2000,
} = {}) {
  let logPath = null;
  let flushTimer = null;
  let flushing = false;
  let closed = false;
  let droppedCount = 0;
  const queue = [];

  function setUserDataDir(userDataDir) {
    logPath = path.join(userDataDir, 'bg-debug.log');
  }

  function scheduleFlush() {
    if (flushTimer || flushing || closed) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flushNow();
    }, flushIntervalMs);
  }

  function formatPayload(payload) {
    try {
      return JSON.stringify(payload);
    } catch (_) {
      return JSON.stringify({ error: 'payload-serialize-failed' });
    }
  }

  async function flushNow() {
    if (!enabled || !logPath || flushing || queue.length === 0) return;
    flushing = true;
    const batch = queue.splice(0, queue.length);
    const droppedPrefix = droppedCount > 0
      ? [`[${new Date().toISOString()}] bg-debug-drop {"droppedCount":${droppedCount}}\n`]
      : [];
    droppedCount = 0;
    try {
      await fs.promises.appendFile(logPath, droppedPrefix.concat(batch).join(''), 'utf8');
    } catch (err) {
      logger.error('[BG_DEBUG] write failed:', err.message);
    } finally {
      flushing = false;
      if (queue.length > 0) scheduleFlush();
    }
  }

  function append(tag, payload = {}) {
    if (!enabled || !logPath || closed) return;
    try {
      if (queue.length >= maxQueueSize) {
        const overflow = queue.length - maxQueueSize + 1;
        queue.splice(0, overflow);
        droppedCount += overflow;
      }
      const line = `[${new Date().toISOString()}] ${tag} ${formatPayload(payload)}\n`;
      queue.push(line);
      scheduleFlush();
    } catch (err) {
      logger.error('[BG_DEBUG] write failed:', err.message);
    }
  }

  function close() {
    closed = true;
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (!enabled || !logPath) return;
    if (queue.length === 0 && droppedCount === 0) return;
    try {
      const droppedPrefix = droppedCount > 0
        ? [`[${new Date().toISOString()}] bg-debug-drop {"droppedCount":${droppedCount}}\n`]
        : [];
      const batch = queue.splice(0, queue.length);
      droppedCount = 0;
      fs.appendFileSync(logPath, droppedPrefix.concat(batch).join(''), 'utf8');
    } catch (err) {
      logger.error('[BG_DEBUG] close flush failed:', err.message);
    }
  }

  return {
    setUserDataDir,
    append,
    flushNow,
    close,
    getLogPath: () => logPath,
  };
}

module.exports = {
  createBgDebugAppender,
};
