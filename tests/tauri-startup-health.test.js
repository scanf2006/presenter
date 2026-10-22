// Wiring guards. These only check that the startup-health command is still
// reachable from the UI: the command's own behavior needs a live Tauri runtime,
// and the display-dedup logic it used to assert on is now covered by real
// behavior tests in display-topology.test.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('the startup health command stays reachable from the UI', () => {
  assert.match(read('src-tauri', 'src', 'lib.rs'), /fn startup_health_check/);
  assert.match(read('src', 'utils', 'tauriProjector.js'), /getTauriStartupHealth/);
  assert.match(read('src', 'hooks', 'useStartupHealth.js'), /getTauriStartupHealth/);
});

test('the display refresh interval is cleaned up when the hook unmounts', () => {
  const hook = read('src', 'hooks', 'useDisplayProjectorStatus.js');

  // A leaked interval keeps polling the backend after unmount, so every timer
  // the hook starts has to be cleared again.
  const started = hook.match(/window\.set(Interval|Timeout)\(/g) ?? [];
  const cleared = hook.match(/window\.clear(Interval|Timeout)\(/g) ?? [];
  assert.ok(started.length > 0, 'the hook should refresh displays on a timer');
  assert.equal(cleared.length, started.length, 'every timer should be cleared on unmount');
});

test('the display refresh reuses the previous list when nothing changed', () => {
  // Guards the wiring only; sameDisplays itself is tested behaviorally.
  const hook = read('src', 'hooks', 'useDisplayProjectorStatus.js');
  assert.match(hook, /sameDisplays\(current, nextDisplays\)\s*\?\s*current\s*:\s*nextDisplays/);
});
