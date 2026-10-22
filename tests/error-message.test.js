const test = require('node:test');
const assert = require('node:assert/strict');

test('a Tauri string rejection keeps the backend reason instead of becoming "Unknown error"', async () => {
  const { describeError } = await import('../src/utils/errorMessage.js');

  // Rust commands reject with a bare string, which has no `.message`.
  assert.equal(
    describeError('Trial expired. Please activate license to continue projection.'),
    'Trial expired. Please activate license to continue projection.'
  );
  assert.equal(describeError(new Error('Projector window is unavailable.')), 'Projector window is unavailable.');
});

test('describeError falls back only when there is no reason to show', async () => {
  const { describeError } = await import('../src/utils/errorMessage.js');

  assert.equal(describeError(undefined), 'Unknown error');
  assert.equal(describeError(null), 'Unknown error');
  assert.equal(describeError('   '), 'Unknown error');
  assert.equal(describeError({}), 'Unknown error');
  assert.equal(describeError(new Error('')), 'Unknown error');
  assert.equal(describeError({}, 'Queue could not be saved'), 'Queue could not be saved');
});
