#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const pkgJsonPath = path.join(rootDir, 'package.json');
const nodeModulesDir = path.join(rootDir, 'node_modules');
const grandioseDir = path.join(nodeModulesDir, '@stagetimerio', 'grandiose');
const grandioseDistDir = path.join(grandioseDir, 'dist');
const grandioseBuildNode = path.join(grandioseDistDir, 'grandiose.node');
const grandioseBuildDll = path.join(grandioseDistDir, 'Processing.NDI.Lib.x64.dll');
const grandioseNdiScript = path.join(grandioseDir, 'scripts', 'ndi.js');
const grandioseDistScript = path.join(grandioseDir, 'scripts', 'dist.js');
const grandioseBindingPath = path.join(grandioseDir, 'binding.gyp');

function run(command, cwd, extraEnv = {}) {
  console.log(`[NDI] ${command}`);
  execSync(command, {
    cwd,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...extraEnv,
    },
  });
}

function findPythonExecutable() {
  const candidates = [
    process.env.PYTHON,
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python311', 'python.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'python.exe'),
    'python',
    'py -3',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      execSync(`${candidate} --version`, { stdio: 'ignore', shell: true });
      return candidate;
    } catch (_) {
      // try next candidate
    }
  }
  return null;
}

function readElectronVersion() {
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  const raw = pkg?.devDependencies?.electron || '';
  const normalized = String(raw).replace(/^[~^]/, '');
  return normalized || '33.2.0';
}

function hasPreparedDist() {
  return fs.existsSync(grandioseBuildNode) && fs.existsSync(grandioseBuildDll);
}

function patchVcxprojToolsetToV143() {
  const vcxprojPath = path.join(grandioseDir, 'build', 'grandiose.vcxproj');
  if (!fs.existsSync(vcxprojPath)) return;
  const original = fs.readFileSync(vcxprojPath, 'utf8');
  if (!original.includes('<PlatformToolset>ClangCL</PlatformToolset>')) return;
  const patched = original.replace(
    '<PlatformToolset>ClangCL</PlatformToolset>',
    '<PlatformToolset>v143</PlatformToolset>'
  );
  fs.writeFileSync(vcxprojPath, patched, 'utf8');
  console.log('[NDI] Patched PlatformToolset: ClangCL -> v143');
}

function main() {
  if (!fs.existsSync(path.join(rootDir, 'node_modules'))) {
    console.error('[NDI] node_modules is missing. Run `npm install` first.');
    process.exit(1);
  }

  if (!fs.existsSync(grandioseDir)) {
    console.error(
      '[NDI] Optional dependency @stagetimerio/grandiose is not installed.\n' +
        'Please run: npm install @stagetimerio/grandiose --ignore-scripts'
    );
    process.exit(1);
  }

  if (hasPreparedDist()) {
    console.log('[NDI] grandiose dist artifacts already prepared.');
    return;
  }

  if (!fs.existsSync(grandioseNdiScript) || !fs.existsSync(grandioseDistScript)) {
    console.error('[NDI] grandiose scripts are missing. Reinstall dependency and retry.');
    process.exit(1);
  }

  const python = findPythonExecutable();
  if (!python) {
    console.error(
      '[NDI] Python not found for node-gyp. Install Python 3.11+ and retry.\n' +
        'Hint: winget install -e --id Python.Python.3.11 --scope user'
    );
    process.exit(1);
  }

  if (!fs.existsSync(grandioseBindingPath)) {
    console.error('[NDI] binding.gyp not found in grandiose package.');
    process.exit(1);
  }

  const electronVersion = readElectronVersion();
  const buildEnv = { PYTHON: python };

  run('node scripts/ndi.js', grandioseDir, buildEnv);
  run(
    `npx node-gyp configure --target=${electronVersion} --arch=x64 --dist-url=https://electronjs.org/headers --runtime=electron`,
    grandioseDir,
    buildEnv
  );
  patchVcxprojToolsetToV143();
  run(
    `npx node-gyp build --target=${electronVersion} --arch=x64 --dist-url=https://electronjs.org/headers --runtime=electron`,
    grandioseDir,
    buildEnv
  );
  run('node scripts/dist.js', grandioseDir, buildEnv);

  if (!hasPreparedDist()) {
    console.error('[NDI] Build finished but required dist artifacts are still missing.');
    process.exit(1);
  }

  console.log('[NDI] Prepared successfully.');
}

main();
