const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('Tauri startup health checks runtime resources and writable data directories', () => {
  const rust = fs.readFileSync(path.join(root, 'src-tauri', 'src', 'lib.rs'), 'utf8');
  const bridge = fs.readFileSync(path.join(root, 'src', 'utils', 'tauriProjector.js'), 'utf8');
  const hook = fs.readFileSync(path.join(root, 'src', 'hooks', 'useStartupHealth.js'), 'utf8');

  for (const check of ['Display Detection', 'Media Directory', 'YouTube Cache', 'PPT Converter Script', 'Bible Data', 'Songs Database']) {
    assert.match(rust, new RegExp(check));
  }
  assert.match(rust, /fn startup_health_check/);
  assert.match(bridge, /getTauriStartupHealth/);
  assert.match(hook, /getTauriStartupHealth/);
});

test('Tauri display topology refreshes periodically without redundant state updates', () => {
  const hook = fs.readFileSync(path.join(root, 'src', 'hooks', 'useDisplayProjectorStatus.js'), 'utf8');

  assert.match(hook, /window\.setInterval/);
  assert.match(hook, /5000/);
  assert.match(hook, /JSON\.stringify\(current\) === JSON\.stringify\(nextDisplays\)/);
});
