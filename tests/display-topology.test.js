const test = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../src/utils/displayTopology.js');

const display = (overrides = {}) => ({
  id: 1,
  label: 'Primary Display',
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  size: { width: 1920, height: 1080 },
  isPrimary: true,
  ...overrides,
});

test('a repeated refresh of an unchanged topology is treated as unchanged', async () => {
  const { sameDisplays } = await load();
  assert.equal(sameDisplays([display()], [display()]), true);
});

test('field order coming back differently is still the same topology', async () => {
  const { sameDisplays } = await load();
  const reordered = {
    isPrimary: true,
    size: { height: 1080, width: 1920 },
    bounds: { height: 1080, width: 1920, y: 0, x: 0 },
    label: 'Primary Display',
    id: 1,
  };
  assert.equal(sameDisplays([display()], [reordered]), true);
});

test('an unplugged, added or resized display is reported as a change', async () => {
  const { sameDisplays } = await load();
  const second = display({ id: 2, label: 'Secondary Display', isPrimary: false });
  assert.equal(sameDisplays([display(), second], [display()]), false);
  assert.equal(sameDisplays([display()], [display(), second]), false);
  assert.equal(
    sameDisplays([display()], [display({ bounds: { x: 0, y: 0, width: 1280, height: 720 } })]),
    false
  );
});

test('a display moved to another position is a change even at the same size', async () => {
  const { sameDisplays } = await load();
  const moved = display({ bounds: { x: 1920, y: 0, width: 1920, height: 1080 } });
  assert.equal(sameDisplays([display()], [moved]), false);
});

test('the primary flag and label are part of the topology', async () => {
  const { sameDisplays } = await load();
  assert.equal(sameDisplays([display()], [display({ isPrimary: false })]), false);
  assert.equal(sameDisplays([display()], [display({ label: 'Projector' })]), false);
});

test('a missing or malformed display list never reads as unchanged', async () => {
  const { sameDisplays } = await load();
  assert.equal(sameDisplays(undefined, []), false);
  assert.equal(sameDisplays([], undefined), false);
  assert.equal(sameDisplays(null, null), true, 'identical references stay equal');
  assert.equal(sameDisplays([], []), true, 'no displays attached is a stable state');
});
