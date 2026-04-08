const fs = require('fs');
const path = require('path');

function registerQueueIPC({ ipcMain, app }) {
  ipcMain.handle('queue-save', async (_event, queue) => {
    try {
      const queuePath = path.join(app.getPath('userData'), 'projector-queue.json');
      const safeQueue = Array.isArray(queue) ? queue : [];
      fs.writeFileSync(queuePath, JSON.stringify(safeQueue, null, 2), 'utf8');
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('queue-load', async () => {
    try {
      const queuePath = path.join(app.getPath('userData'), 'projector-queue.json');
      if (!fs.existsSync(queuePath)) return [];
      const raw = fs.readFileSync(queuePath, 'utf8');
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
