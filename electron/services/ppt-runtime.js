const fs = require('fs');
const path = require('path');

function resolveRuntimePptConvertScriptPath({
  app,
  electronDir,
  resourcesPath = process.resourcesPath,
}) {
  // Dev: script exists directly in electron/.
  const direct = path.join(electronDir, 'ppt-convert.ps1');
  if (fs.existsSync(direct)) return direct;

  // Packaged: prefer unpacked script directly.
  const unpacked = path.join(resourcesPath, 'app.asar.unpacked', 'electron', 'ppt-convert.ps1');
  if (fs.existsSync(unpacked)) return unpacked;

  // Fallback: extract script from asar to userData/runtime.
  try {
    const bundled = path.join(resourcesPath, 'app.asar', 'electron', 'ppt-convert.ps1');
    if (fs.existsSync(bundled)) {
      const runtimeDir = path.join(app.getPath('userData'), 'runtime');
      fs.mkdirSync(runtimeDir, { recursive: true });
      const runtimeScript = path.join(runtimeDir, 'ppt-convert.ps1');
      fs.writeFileSync(runtimeScript, fs.readFileSync(bundled));
      return runtimeScript;
    }
  } catch (_) {}

  return direct;
}

module.exports = {
  resolveRuntimePptConvertScriptPath,
};
