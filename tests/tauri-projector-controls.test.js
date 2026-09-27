const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('core projector controls use the Tauri bridge without Electron IPC branches', () => {
  for (const relativePath of [
    'src/hooks/useWindowProjectorControls.js',
    'src/hooks/useProjectionSettings.js',
    'src/hooks/useProjectorPreviewDispatch.js',
  ]) {
    const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
    assert.match(source, /isTauriRuntime/);
    assert.doesNotMatch(source, /churchDisplay/);
    assert.doesNotMatch(source, /isElectron/);
  }
});
