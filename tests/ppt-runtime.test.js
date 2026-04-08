const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { resolveRuntimePptConvertScriptPath } = require('../electron/services/ppt-runtime');

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('resolveRuntimePptConvertScriptPath prefers dev electron script', () => {
  const root = makeTempDir('cdp-ppt-dev-');
  const electronDir = path.join(root, 'electron');
  fs.mkdirSync(electronDir, { recursive: true });
  const devScript = path.join(electronDir, 'ppt-convert.ps1');
  fs.writeFileSync(devScript, 'Write-Host dev');

  const result = resolveRuntimePptConvertScriptPath({
    app: { getPath: () => path.join(root, 'userData') },
    electronDir,
    resourcesPath: path.join(root, 'resources'),
  });

  assert.equal(result, devScript);
  fs.rmSync(root, { recursive: true, force: true });
});

test('resolveRuntimePptConvertScriptPath falls back to unpacked packaged script', () => {
  const root = makeTempDir('cdp-ppt-unpacked-');
  const electronDir = path.join(root, 'electron');
  const resources = path.join(root, 'resources');
  const unpacked = path.join(resources, 'app.asar.unpacked', 'electron');
  fs.mkdirSync(unpacked, { recursive: true });
  const unpackedScript = path.join(unpacked, 'ppt-convert.ps1');
  fs.writeFileSync(unpackedScript, 'Write-Host unpacked');

  const result = resolveRuntimePptConvertScriptPath({
    app: { getPath: () => path.join(root, 'userData') },
    electronDir,
    resourcesPath: resources,
  });

  assert.equal(result, unpackedScript);
  fs.rmSync(root, { recursive: true, force: true });
});

test('resolveRuntimePptConvertScriptPath extracts from asar to runtime when needed', () => {
  const root = makeTempDir('cdp-ppt-asar-');
  const electronDir = path.join(root, 'electron');
  const resources = path.join(root, 'resources');
  const asarScriptDir = path.join(resources, 'app.asar', 'electron');
  const userData = path.join(root, 'userData');
  fs.mkdirSync(asarScriptDir, { recursive: true });
  fs.mkdirSync(userData, { recursive: true });
  const bundledScript = path.join(asarScriptDir, 'ppt-convert.ps1');
  fs.writeFileSync(bundledScript, 'Write-Host bundled');

  const result = resolveRuntimePptConvertScriptPath({
    app: { getPath: () => userData },
    electronDir,
    resourcesPath: resources,
  });

  const runtimeScript = path.join(userData, 'runtime', 'ppt-convert.ps1');
  assert.equal(result, runtimeScript);
  assert.equal(fs.existsSync(runtimeScript), true);
  assert.equal(fs.readFileSync(runtimeScript, 'utf8'), 'Write-Host bundled');

  fs.rmSync(root, { recursive: true, force: true });
});
