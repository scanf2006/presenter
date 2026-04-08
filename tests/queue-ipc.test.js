const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { registerQueueIPC } = require('../electron/ipc/queue');

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function createIpcHarness() {
  const handlers = new Map();
  return {
    ipcMain: {
      handle: (channel, fn) => handlers.set(channel, fn),
    },
    invoke: (channel, ...args) => handlers.get(channel)(null, ...args),
  };
}

test('queue-save and queue-load persist queue file in userData', async () => {
  const userData = makeTempDir('cdp-queue-');
  const { ipcMain, invoke } = createIpcHarness();
  const app = { getPath: () => userData };

  registerQueueIPC({ ipcMain, app });

  const queue = [{ id: '1', title: 'Song A', payload: { type: 'lyrics', text: 'hello' } }];
  const saveResult = await invoke('queue-save', queue);
  assert.equal(saveResult.success, true);

  const queuePath = path.join(userData, 'projector-queue.json');
  assert.equal(fs.existsSync(queuePath), true);

  const loaded = await invoke('queue-load');
  assert.deepEqual(loaded, queue);

  fs.rmSync(userData, { recursive: true, force: true });
});

test('queue-load returns empty array for missing or malformed file', async () => {
  const userData = makeTempDir('cdp-queue-malformed-');
  const { ipcMain, invoke } = createIpcHarness();
  const app = { getPath: () => userData };
  registerQueueIPC({ ipcMain, app });

  assert.deepEqual(await invoke('queue-load'), []);

  const queuePath = path.join(userData, 'projector-queue.json');
  fs.writeFileSync(queuePath, '{"bad":true', 'utf8');
  assert.deepEqual(await invoke('queue-load'), []);

  fs.rmSync(userData, { recursive: true, force: true });
});
