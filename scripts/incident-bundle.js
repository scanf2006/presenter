const fs = require('fs');
const os = require('os');
const path = require('path');

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function safeMkdir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function fileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch (_) {
    return null;
  }
}

function copyIfExists(src, destDir, copied, missing) {
  if (!fs.existsSync(src)) {
    missing.push(src);
    return;
  }
  safeMkdir(destDir);
  const name = path.basename(src);
  const dest = path.join(destDir, name);
  fs.copyFileSync(src, dest);
  copied.push({ src, dest, bytes: fileSize(dest) });
}

function copyJsonRedacted(src, destDir, copied, missing, redactFn) {
  if (!fs.existsSync(src)) {
    missing.push(src);
    return;
  }
  safeMkdir(destDir);
  const name = path.basename(src);
  const dest = path.join(destDir, name);
  try {
    const parsed = JSON.parse(fs.readFileSync(src, 'utf8'));
    const redacted = typeof redactFn === 'function' ? redactFn(parsed) : parsed;
    fs.writeFileSync(dest, JSON.stringify(redacted, null, 2), 'utf8');
    copied.push({ src, dest, bytes: fileSize(dest), redacted: true });
  } catch (_err) {
    missing.push(`${src} (failed to parse for redaction)`);
  }
}

function copyDirIfExists(srcDir, destDir, copiedDirs, missingDirs) {
  if (!fs.existsSync(srcDir)) {
    missingDirs.push(srcDir);
    return;
  }
  safeMkdir(destDir);
  fs.cpSync(srcDir, destDir, { recursive: true, force: true });
  copiedDirs.push({ src: srcDir, dest: destDir });
}

function detectUserDataDirs(appName) {
  const dirs = [];
  const appData = process.env.APPDATA;
  if (appData) {
    dirs.push(path.join(appData, appName));
  }
  const home = os.homedir();
  dirs.push(path.join(home, 'AppData', 'Roaming', appName));
  return Array.from(new Set(dirs));
}

function readPackageMeta() {
  const pkgPath = path.join(__dirname, '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  return {
    name: pkg.name,
    version: pkg.version,
  };
}

function main() {
  const includeSensitive = process.argv.includes('--include-sensitive');
  const pkg = readPackageMeta();
  const stamp = nowStamp();
  const repoRoot = path.join(__dirname, '..');
  const bundleRoot = path.join(repoRoot, 'diagnostics');
  const bundleDir = path.join(bundleRoot, `incident-bundle-${stamp}`);
  const filesDir = path.join(bundleDir, 'files');

  safeMkdir(filesDir);

  const copiedFiles = [];
  const missingFiles = [];
  const copiedDirs = [];
  const missingDirs = [];

  const userDataCandidates = detectUserDataDirs(pkg.name);
  const existingUserDataDirs = userDataCandidates.filter((d) => fs.existsSync(d));

  const repoAppLog = path.join(repoRoot, 'app.log');
  copyIfExists(repoAppLog, path.join(filesDir, 'repo-root'), copiedFiles, missingFiles);

  for (const userDataDir of existingUserDataDirs) {
    const base = path.join(filesDir, 'userData', path.basename(userDataDir));
    copyIfExists(path.join(userDataDir, 'bg-debug.log'), base, copiedFiles, missingFiles);
    copyIfExists(path.join(userDataDir, 'app.log'), base, copiedFiles, missingFiles);
    if (includeSensitive) {
      copyIfExists(path.join(userDataDir, 'projector-queue.json'), base, copiedFiles, missingFiles);
      copyIfExists(path.join(userDataDir, 'app-settings.json'), base, copiedFiles, missingFiles);
    } else {
      copyJsonRedacted(
        path.join(userDataDir, 'app-settings.json'),
        base,
        copiedFiles,
        missingFiles,
        (doc) => ({
          ...doc,
          licenseKey: doc?.licenseKey ? '[REDACTED]' : '',
          acceptedEulaProof: doc?.acceptedEulaProof ? '[REDACTED]' : '',
        })
      );
    }
    copyDirIfExists(path.join(userDataDir, 'logs'), path.join(base, 'logs'), copiedDirs, missingDirs);
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    bundleDir,
    app: pkg,
    host: {
      platform: process.platform,
      release: os.release(),
      arch: process.arch,
      hostname: includeSensitive ? os.hostname() : '[REDACTED]',
      node: process.version,
      locale: Intl.DateTimeFormat().resolvedOptions().locale,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    userDataCandidates: includeSensitive
      ? userDataCandidates
      : userDataCandidates.map((p) => path.basename(p)),
    existingUserDataDirs: includeSensitive
      ? existingUserDataDirs
      : existingUserDataDirs.map((p) => path.basename(p)),
    includeSensitive,
    copiedFiles,
    copiedDirs,
    missingFiles,
    missingDirs,
  };

  fs.writeFileSync(path.join(bundleDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
  fs.writeFileSync(
    path.join(bundleDir, 'README.txt'),
    [
      'ChurchDisplay Pro Incident Bundle',
      `Generated: ${summary.generatedAt}`,
      `App: ${pkg.name} v${pkg.version}`,
      '',
      'Contains:',
      '- summary.json (host + copied file index)',
      '- files/ (logs and key runtime files if found)',
      includeSensitive
        ? '- mode: include-sensitive (full app-settings and queue copied)'
        : '- mode: redacted default (license fields masked, queue file omitted)',
      '',
      'Share this folder with support/development for incident analysis.',
    ].join('\n'),
    'utf8'
  );

  console.log(bundleDir);
}

main();
