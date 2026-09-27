const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');

test('Tauri startup splash is rendered in the main window before React mounts', () => {
  const tauriConfig = JSON.parse(
    fs.readFileSync(path.join(projectRoot, 'src-tauri', 'tauri.conf.json'), 'utf8')
  );
  const mainWindow = tauriConfig.app.windows.find((windowConfig) => !windowConfig.label);
  const appSource = fs.readFileSync(path.join(projectRoot, 'src', 'App.jsx'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');

  assert.equal(mainWindow.visible, true);
  assert.equal(mainWindow.backgroundColor, '#060816');
  assert.equal(mainWindow.width, 1400);
  assert.equal(mainWindow.height, 900);
  assert.match(indexHtml, /id="boot-splash"/);
  assert.match(indexHtml, /Preparing your worship session/);
  assert.match(appSource, /boot-splash--leaving/);
});
