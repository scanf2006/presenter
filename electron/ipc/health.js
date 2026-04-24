const fs = require('fs');
const os = require('os');
const path = require('path');

function pushCheck(checks, id, label, status, detail, action = '') {
  checks.push({ id, label, status, detail, action });
}

function statusSummary(checks) {
  return checks.reduce(
    (acc, item) => {
      if (item.status === 'error') acc.errorCount += 1;
      else if (item.status === 'warn') acc.warnCount += 1;
      else acc.okCount += 1;
      return acc;
    },
    { okCount: 0, warnCount: 0, errorCount: 0 }
  );
}

function canWriteToDir(targetDir) {
  const probeFile = path.join(
    targetDir,
    `.health-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.tmp`
  );
  fs.writeFileSync(probeFile, 'ok');
  fs.unlinkSync(probeFile);
}

function resolveBibleDataDir({ app, electronDir, processResourcesPath }) {
  let appPath = '';
  if (typeof app?.getAppPath === 'function') {
    const resolved = app.getAppPath();
    if (typeof resolved === 'string') appPath = resolved;
  }

  if (app?.isPackaged) {
    const packagedBase =
      processResourcesPath ||
      (typeof process !== 'undefined' ? process.resourcesPath : '') ||
      (appPath ? path.dirname(appPath) : '');
    if (packagedBase) return path.join(packagedBase, 'data');
    return '';
  }
  if (electronDir) return path.join(electronDir, '..', 'data');
  if (appPath) return path.join(appPath, 'data');
  return '';
}

function registerHealthIPC({
  ipcMain,
  app,
  screenManager,
  mediaDir,
  mediaYouTubeCacheDir,
  getRuntimePptConvertScriptPath,
  electronDir,
  processResourcesPath,
}) {
  ipcMain.handle('startup-health-check', async () => {
    const checks = [];

    try {
      const displays = screenManager?.getAllDisplays?.() || [];
      if (displays.length <= 0) {
        pushCheck(
          checks,
          'display',
          'Display Detection',
          'error',
          'No display detected.',
          'Check graphics driver / monitor connection.'
        );
      } else if (displays.length === 1) {
        pushCheck(
          checks,
          'display',
          'Display Detection',
          'warn',
          'Only one display detected. External projector was not found.',
          'Connect and enable extended display for projector output.'
        );
      } else {
        pushCheck(checks, 'display', 'Display Detection', 'ok', `${displays.length} displays detected.`);
      }
    } catch (err) {
      pushCheck(
        checks,
        'display',
        'Display Detection',
        'error',
        err?.message || 'Failed to read display information.'
      );
    }

    try {
      if (!mediaDir || !fs.existsSync(mediaDir)) {
        pushCheck(
          checks,
          'mediaDir',
          'Media Directory',
          'error',
          `Media directory missing: ${mediaDir || '(empty)'}`,
          'Restart app or create media folder manually.'
        );
      } else {
        const stat = fs.statSync(mediaDir);
        pushCheck(
          checks,
          'mediaDir',
          'Media Directory',
          stat.isDirectory() ? 'ok' : 'error',
          stat.isDirectory() ? mediaDir : 'Media path exists but is not a directory.'
        );
      }
    } catch (err) {
      pushCheck(
        checks,
        'mediaDir',
        'Media Directory',
        'error',
        err?.message || 'Failed to validate media directory.'
      );
    }

    try {
      if (!mediaYouTubeCacheDir || !fs.existsSync(mediaYouTubeCacheDir)) {
        pushCheck(
          checks,
          'ytCache',
          'YouTube Cache',
          'warn',
          `Cache directory missing: ${mediaYouTubeCacheDir || '(empty)'}`,
          'Create media/youtube-cache directory.'
        );
      } else {
        canWriteToDir(mediaYouTubeCacheDir);
        pushCheck(checks, 'ytCache', 'YouTube Cache', 'ok', 'Cache directory is writable.');
      }
    } catch (err) {
      pushCheck(
        checks,
        'ytCache',
        'YouTube Cache',
        'error',
        err?.message || 'Cache directory is not writable.',
        'Check folder permission or antivirus lock.'
      );
    }

    try {
      const pptScriptPath =
        typeof getRuntimePptConvertScriptPath === 'function' ? getRuntimePptConvertScriptPath() : '';
      if (!pptScriptPath || !fs.existsSync(pptScriptPath)) {
        pushCheck(
          checks,
          'pptScript',
          'PPT Converter Script',
          'error',
          `ppt-convert script missing: ${pptScriptPath || '(empty)'}`,
          'Ensure app.asar.unpacked includes electron/ppt-convert.ps1.'
        );
      } else {
        pushCheck(checks, 'pptScript', 'PPT Converter Script', 'ok', pptScriptPath);
      }
    } catch (err) {
      pushCheck(
        checks,
        'pptScript',
        'PPT Converter Script',
        'error',
        err?.message || 'Failed to resolve PPT converter script path.'
      );
    }

    try {
      const dataDir = resolveBibleDataDir({ app, electronDir, processResourcesPath });
      if (!dataDir) {
        pushCheck(
          checks,
          'bibleData',
          'Bible Data',
          'error',
          'Unable to resolve data directory path.',
          'Check packaged resources path wiring.'
        );
      } else {
      const cuvsPath = path.join(dataDir, 'bible_cuvs.db');
      const kjvPath = path.join(dataDir, 'bible_kjv.db');
      const cuvsExists = fs.existsSync(cuvsPath);
      const kjvExists = fs.existsSync(kjvPath);

      if (!cuvsExists && !kjvExists) {
        pushCheck(
          checks,
          'bibleData',
          'Bible Data',
          'error',
          `Bible DB files missing in ${dataDir}`,
          'Bundle data/bible_*.db in build extraResources.'
        );
      } else if (!cuvsExists || !kjvExists) {
        pushCheck(
          checks,
          'bibleData',
          'Bible Data',
          'warn',
          `Partial Bible DB set found in ${dataDir} (CUVS=${cuvsExists}, KJV=${kjvExists}).`
        );
      } else {
        pushCheck(checks, 'bibleData', 'Bible Data', 'ok', dataDir);
      }
      }
    } catch (err) {
      pushCheck(
        checks,
        'bibleData',
        'Bible Data',
        'error',
        err?.message || 'Failed to validate Bible data files.'
      );
    }

    try {
      const songsPath = path.join(app.getPath('userData'), 'songs.db');
      const songsDir = path.dirname(songsPath);
      if (!fs.existsSync(songsDir)) {
        pushCheck(
          checks,
          'songsDb',
          'Songs Database',
          'warn',
          `Songs DB parent folder missing: ${songsDir}`,
          'App will create it on first save.'
        );
      } else {
        canWriteToDir(songsDir);
        pushCheck(checks, 'songsDb', 'Songs Database', 'ok', songsPath);
      }
    } catch (err) {
      pushCheck(
        checks,
        'songsDb',
        'Songs Database',
        'error',
        err?.message || 'Songs DB location is not writable.',
        'Check userData folder permission.'
      );
    }

    return {
      success: true,
      checkedAt: Date.now(),
      host: os.hostname(),
      appVersion: typeof app?.getVersion === 'function' ? app.getVersion() : '',
      summary: statusSummary(checks),
      checks,
    };
  });
}

module.exports = {
  registerHealthIPC,
};
