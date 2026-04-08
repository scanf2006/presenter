const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createBgDebugAppender } = require('../electron/services/bg-debug');

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('bg-debug append + flushNow writes queued logs', async () => {
  const userData = makeTempDir('cdp-bgdebug-');
  const debug = createBgDebugAppender({ flushIntervalMs: 10000 });
  debug.setUserDataDir(userData);
  debug.append('event-a', { ok: true });
  debug.append('event-b', { n: 2 });
  await debug.flushNow();

  const logPath = path.join(userData, 'bg-debug.log');
  const content = fs.readFileSync(logPath, 'utf8');
  assert.equal(content.includes('event-a'), true);
  assert.equal(content.includes('event-b'), true);

  fs.rmSync(userData, { recursive: true, force: true });
});

test('bg-debug close flushes remaining queue', () => {
  const userData = makeTempDir('cdp-bgdebug-close-');
  const debug = createBgDebugAppender({ flushIntervalMs: 10000 });
  debug.setUserDataDir(userData);
  debug.append('event-close', { x: 1 });
  debug.close();

  const logPath = path.join(userData, 'bg-debug.log');
  const content = fs.readFileSync(logPath, 'utf8');
  assert.equal(content.includes('event-close'), true);

  fs.rmSync(userData, { recursive: true, force: true });
});
