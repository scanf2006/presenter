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
  const persisted = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  assert.equal(persisted.schemaVersion, 2);
  assert.ok(Array.isArray(persisted.items));

  const loaded = await invoke('queue-load');
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].id, '1');
  assert.equal(loaded[0].title, 'Song A');
  assert.equal(loaded[0].type, 'lyrics');
  assert.equal(loaded[0].section, 'songs');
  assert.deepEqual(loaded[0].payload, { type: 'lyrics', text: 'hello' });
  assert.ok(Number.isFinite(loaded[0].createdAt));

  fs.rmSync(userData, { recursive: true, force: true });
});

test('queue-load migrates legacy v1 array payload', async () => {
  const userData = makeTempDir('cdp-queue-v1-');
  const { ipcMain, invoke } = createIpcHarness();
  const app = { getPath: () => userData };
  registerQueueIPC({ ipcMain, app });

  const queuePath = path.join(userData, 'projector-queue.json');
  fs.writeFileSync(
    queuePath,
    JSON.stringify([{ title: 'Legacy', type: 'bible', payload: { type: 'bible', reference: 'John 3:16' } }]),
    'utf8'
  );

  const loaded = await invoke('queue-load');
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].title, 'Legacy');
  assert.equal(loaded[0].section, 'bible');
  assert.equal(loaded[0].type, 'bible');
  assert.ok(Number.isFinite(loaded[0].createdAt));

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
