const test = require('node:test');
const assert = require('node:assert/strict');

let projectorChannel;

test.before(async () => {
  projectorChannel = await import('../src/utils/projectorChannel.js');
});

test('normalizeTransitionConfig applies defaults and clamps negatives', () => {
  const a = projectorChannel.normalizeTransitionConfig({});
  assert.equal(a.enabled, true);
  assert.equal(a.delayMs, 20);
  assert.equal(a.durationMs, 60);

  const b = projectorChannel.normalizeTransitionConfig({
    enabled: false,
    delayMs: -10,
    durationMs: -3,
  });
  assert.equal(b.enabled, false);
  assert.equal(b.delayMs, 0);
  assert.equal(b.durationMs, 0);
});
