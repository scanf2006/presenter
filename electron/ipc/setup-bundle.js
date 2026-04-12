const fs = require('fs');
const path = require('path');

function sanitizeImportedAppSettings(settingsPath, warnings) {
  try {
    if (!fs.existsSync(settingsPath)) return;
    const raw = fs.readFileSync(settingsPath, 'utf8');
    const parsed = JSON.parse(raw);
    const sanitized = {
      ...(parsed && typeof parsed === 'object' ? parsed : {}),
      licenseKey: '',
      acceptedEulaAt: null,
      acceptedEulaProof: '',
      trialConsumedMs: 0,
      trialStartedAtMs: null,
      trialLastSeenAtMs: null,
      trialClockTampered: false,
    };
    fs.writeFileSync(settingsPath, JSON.stringify(sanitized, null, 2), 'utf8');
  } catch (err) {
    warnings.push(`Failed to sanitize imported app-settings: ${err.message}`);
  }
}

function registerSetupBundleIPC({
  ipcMain,
  dialog,
  app,
  getParentWindow,
  formatBackupStamp,
  collectReferencedMediaPathsFromQueue,
  copyDirectoryMerge,
  mediaDir,
}) {
  ipcMain.handle('export-setup-bundle', async () => {
    const choose = await dialog.showOpenDialog(getParentWindow(), {
      title: 'Select export folder',
      properties: ['openDirectory', 'createDirectory', 'promptToCreate'],
    });
    if (choose.canceled || !choose.filePaths?.[0]) {
      return { success: false, cancelled: true };
    }

    try {
      const userDataDir = app.getPath('userData');
      const queuePath = path.join(userDataDir, 'projector-queue.json');
      const settingsPath = path.join(userDataDir, 'app-settings.json');
      const songsPath = path.join(userDataDir, 'songs.db');

      let queue = [];
      try {
        if (fs.existsSync(queuePath)) {
          const raw = fs.readFileSync(queuePath, 'utf8');
          const parsed = JSON.parse(raw);
          queue = Array.isArray(parsed) ? parsed : [];
        }
      } catch (_) {
        queue = [];
      }

      const targetRoot = choose.filePaths[0];
      const backupName = `churchdisplay-pro-export-${formatBackupStamp()}`;
      const backupDir = path.join(targetRoot, backupName);
      const selectedMediaDir = path.join(backupDir, 'media-selected');
      fs.mkdirSync(selectedMediaDir, { recursive: true });

      const warnings = [];
      let copiedCount = 0;
      let skippedCount = 0;
      let totalBytes = 0;

      for (const [src, dst] of [
        [settingsPath, path.join(backupDir, 'app-settings.json')],
        [queuePath, path.join(backupDir, 'projector-queue.json')],
        [songsPath, path.join(backupDir, 'songs.db')],
      ]) {
        if (!fs.existsSync(src)) continue;
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.copyFileSync(src, dst);
        copiedCount += 1;
        totalBytes += fs.statSync(src).size || 0;
      }

      const refs = collectReferencedMediaPathsFromQueue(queue, mediaDir);
      refs.missingRefs.forEach((m) => warnings.push(`Missing referenced media: ${m}`));

      refs.existing.forEach((absPath) => {
        const relative = path.relative(mediaDir, absPath);
        const dest = path.join(selectedMediaDir, relative);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(absPath, dest);
        copiedCount += 1;
        totalBytes += fs.statSync(absPath).size || 0;
      });

      const manifest = {
        bundleMode: 'minimal',
        exportedAt: new Date().toISOString(),
        appVersion: app.getVersion(),
        sourceUserData: userDataDir,
        included: ['app-settings.json', 'projector-queue.json', 'songs.db', 'media-selected'],
        mediaSelectedCount: refs.existing.length,
        missingRefs: refs.missingRefs,
      };
      fs.writeFileSync(path.join(backupDir, 'export-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
      copiedCount += 1;
      totalBytes += fs.statSync(path.join(backupDir, 'export-manifest.json')).size || 0;

      return {
        success: true,
        mode: 'minimal',
        backupDir,
        copiedCount,
        skippedCount,
        missingRefs: refs.missingRefs,
        totalBytes,
        warnings,
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('import-setup-bundle', async () => {
    const choose = await dialog.showOpenDialog(getParentWindow(), {
      title: 'Select setup export folder',
      properties: ['openDirectory'],
    });
    if (choose.canceled || !choose.filePaths?.[0]) {
      return { success: false, cancelled: true };
    }

    const importDir = choose.filePaths[0];
    try {
      const userDataDir = app.getPath('userData');
      const warnings = [];
      const missingRefs = [];
      const stats = { copiedCount: 0, skippedCount: 0, totalBytes: 0, warnings };

      for (const [name, src, dst] of [
        ['app-settings.json', path.join(importDir, 'app-settings.json'), path.join(userDataDir, 'app-settings.json')],
        ['projector-queue.json', path.join(importDir, 'projector-queue.json'), path.join(userDataDir, 'projector-queue.json')],
        ['songs.db', path.join(importDir, 'songs.db'), path.join(userDataDir, 'songs.db')],
      ]) {
        if (!fs.existsSync(src)) continue;
        try {
          fs.mkdirSync(path.dirname(dst), { recursive: true });
          fs.copyFileSync(src, dst);
          stats.copiedCount += 1;
          stats.totalBytes += fs.statSync(src).size || 0;
        } catch (err) {
          warnings.push(`Failed to import ${name}: ${err.message}`);
        }
      }
      sanitizeImportedAppSettings(path.join(userDataDir, 'app-settings.json'), warnings);

      const minimalMediaDir = path.join(importDir, 'media-selected');
      const legacyMediaDir = path.join(importDir, 'media');
      let mode = 'minimal';
      if (fs.existsSync(minimalMediaDir)) {
        copyDirectoryMerge(minimalMediaDir, mediaDir, stats);
      } else if (fs.existsSync(legacyMediaDir)) {
        mode = 'legacy-full';
        copyDirectoryMerge(legacyMediaDir, mediaDir, stats);
      } else {
        warnings.push('No media folder found in import bundle.');
      }

      return {
        success: true,
        mode,
        copiedCount: stats.copiedCount,
        skippedCount: stats.skippedCount,
        missingRefs,
        totalBytes: stats.totalBytes,
        warnings,
        restartRecommended: true,
        message: 'Import finished. Please restart app to reload queue and media cache.',
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = {
  registerSetupBundleIPC,
};
