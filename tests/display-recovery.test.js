const test = require('node:test');
const assert = require('node:assert/strict');

test('projection selection survives reordering and detects loss and geometry changes', async () => {
  const { projectionPlacement } = await import('../src/utils/displayRecovery.js');
  const main = { id: 'DISPLAY1', bounds: { x: 0, y: 0, width: 1920, height: 1080 } };
  const external = { id: 'DISPLAY2', bounds: { x: 1920, y: 0, width: 1920, height: 1080 } };
  const original = projectionPlacement([main, external], external.id);
  assert.equal(projectionPlacement([external, main], external.id), original);
  assert.equal(projectionPlacement([main], external.id), null);
  assert.equal(projectionPlacement([main, external], external.id), original);
  assert.notEqual(projectionPlacement([{ ...external, bounds: { ...external.bounds, x: -1920 } }], external.id), original);
  assert.equal(projectionPlacement([main, external], null), null);
  assert.equal(projectionPlacement([{ ...external, isPrimary: true }], external.id), null);
});
