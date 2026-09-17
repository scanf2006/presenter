const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');

test('Tauri projector window can receive events and is fullscreen only after target placement', () => {
  const tauriConfig = JSON.parse(
    fs.readFileSync(path.join(projectRoot, 'src-tauri', 'tauri.conf.json'), 'utf8')
  );
  const capability = JSON.parse(
    fs.readFileSync(path.join(projectRoot, 'src-tauri', 'capabilities', 'default.json'), 'utf8')
  );
  const projector = tauriConfig.app.windows.find((windowConfig) => windowConfig.label === 'projector');

  assert.ok(projector, 'projector window is configured');
  assert.equal(projector.fullscreen, false, 'runtime selects fullscreen after monitor placement');
  assert.ok(capability.windows.includes('projector'), 'projector can receive core event permissions');
  assert.ok(capability.permissions.includes('core:default'));
});
