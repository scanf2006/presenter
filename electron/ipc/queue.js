const fsp = require('fs/promises');
const path = require('path');

function registerQueueIPC({ ipcMain, app }) {
  // R3-M: Size limit to prevent unbounded queue growth.
  const MAX_QUEUE_SIZE = 500;
  const MAX_QUEUE_BYTES = 2 * 1024 * 1024; // 2 MB

  ipcMain.handle('queue-save', async (_event, queue) => {
    try {
      const queuePath = path.join(app.getPath('userData'), 'projector-queue.json');
      let safeQueue = Array.isArray(queue) ? queue : [];
      if (safeQueue.length > MAX_QUEUE_SIZE) {
        safeQueue = safeQueue.slice(0, MAX_QUEUE_SIZE);
      }
      const json = JSON.stringify(safeQueue, null, 2);
      if (Buffer.byteLength(json, 'utf8') > MAX_QUEUE_BYTES) {
        return { success: false, error: 'Queue data exceeds maximum size.' };
      }
      // R3-M: Atomic write via temp file + rename to prevent data corruption.
      const tmpPath = queuePath + '.tmp.' + process.pid;
      await fsp.writeFile(tmpPath, json, 'utf8');
      await fsp.rename(tmpPath, queuePath);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('queue-load', async () => {
    try {
      const queuePath = path.join(app.getPath('userData'), 'projector-queue.json');
      // R3-M: Use async I/O.
      let raw;
      try {
        raw = await fsp.readFile(queuePath, 'utf8');
      } catch (readErr) {
        if (readErr?.code === 'ENOENT') return [];
        throw readErr;
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn('[Queue] load failed:', err.message);
      return [];
    }
  });
}

module.exports = {
  registerQueueIPC,
};
