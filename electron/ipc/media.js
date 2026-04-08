const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function registerMediaIPC({
  ipcMain,
  dialog,
  getParentWindow,
  resolveAbsolutePath,
  normalizeForCompare,
  isPathWithinRoot,
  mediaDir,
  mediaImagesDir,
  mediaVideosDir,
  mediaPdfDir,
  mediaPptDir,
  pptConvertTimeoutMs,
  getRuntimePptConvertScriptPath,
}) {
  let approvedImportPaths = new Set();

  ipcMain.handle('select-files', async (_event, options) => {
    const filters = [];
    switch (options?.type) {
      case 'image':
        filters.push({ name: 'Image Files', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'] });
        break;
      case 'video':
        filters.push({ name: 'Video Files', extensions: ['mp4', 'webm', 'mkv', 'avi', 'mov'] });
        break;
      case 'pdf':
        filters.push({ name: 'PDF Files', extensions: ['pdf'] });
        break;
      case 'ppt':
        filters.push({ name: 'PPT Files', extensions: ['pptx', 'ppt'] });
        break;
      default:
        filters.push({ name: 'All Supported Files', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'mp4', 'webm', 'mkv', 'avi', 'mov', 'pdf', 'pptx', 'ppt'] });
    }
    const result = await dialog.showOpenDialog(getParentWindow(), {
      properties: ['openFile', 'multiSelections'],
      filters,
    });
    if (result.canceled) {
      approvedImportPaths = new Set();
      return [];
    }
    approvedImportPaths = new Set(
      (result.filePaths || [])
        .map((p) => resolveAbsolutePath(p))
        .filter(Boolean)
        .map((p) => normalizeForCompare(p))
    );
    return result.filePaths;
  });

  ipcMain.handle('import-files', async (_event, filePaths) => {
    const imported = [];
    const incoming = Array.isArray(filePaths) ? filePaths : [];
    for (const filePath of incoming) {
      const resolvedSource = resolveAbsolutePath(filePath);
      const approvedKey = resolvedSource ? normalizeForCompare(resolvedSource) : null;
      if (!resolvedSource || !approvedKey || !approvedImportPaths.has(approvedKey)) {
        console.warn('[MediaImport] Rejected unapproved source path:', filePath);
        continue;
      }

      const ext = path.extname(filePath).toLowerCase();
      const fileName = `${Date.now()}_${path.basename(filePath)}`;

      let targetDir;
      let fileType;
      if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'].includes(ext)) {
        targetDir = mediaImagesDir;
        fileType = 'image';
      } else if (['.mp4', '.webm', '.mkv', '.avi', '.mov'].includes(ext)) {
        targetDir = mediaVideosDir;
        fileType = 'video';
      } else if (ext === '.pdf') {
        targetDir = mediaPdfDir;
        fileType = 'pdf';
      } else if (['.pptx', '.ppt'].includes(ext)) {
        targetDir = mediaPptDir;
        fileType = 'ppt';
      } else {
        continue;
      }

      try {
        const stat = fs.statSync(resolvedSource);
        if (!stat.isFile()) {
          approvedImportPaths.delete(approvedKey);
          continue;
        }
        fs.mkdirSync(targetDir, { recursive: true });
        const destPath = path.join(targetDir, fileName);
        fs.copyFileSync(resolvedSource, destPath);

        imported.push({
          id: fileName,
          name: path.basename(resolvedSource),
          type: fileType,
          path: destPath,
          size: fs.statSync(destPath).size,
          createdAt: Date.now(),
        });
      } catch (err) {
        console.warn('[MediaImport] Failed to import file:', resolvedSource, err?.message || err);
      } finally {
        approvedImportPaths.delete(approvedKey);
      }
    }
    return imported;
  });

  ipcMain.handle('get-media-list', async (_event, type) => {
    const dirs = {
      image: mediaImagesDir,
      video: mediaVideosDir,
      pdf: mediaPdfDir,
      ppt: mediaPptDir,
    };

    const results = [];
    const scanDir = (dirPath, fileType) => {
      if (!fs.existsSync(dirPath)) return;
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          const originalName = file.replace(/^\d+_/, '');
          results.push({
            id: file,
            name: originalName,
            type: fileType,
            path: fullPath,
            size: stat.size,
            createdAt: stat.birthtimeMs,
          });
        }
      }
    };

    if (type && dirs[type]) {
      scanDir(dirs[type], type);
    } else {
      Object.entries(dirs).forEach(([t, d]) => scanDir(d, t));
    }

    return results.sort((a, b) => b.createdAt - a.createdAt);
  });

  ipcMain.handle('delete-media', async (_event, filePath) => {
    try {
      const resolved = resolveAbsolutePath(filePath);
      if (!resolved || !isPathWithinRoot(mediaDir, resolved)) {
        return { success: false, error: 'Path not allowed.' };
      }
      if (fs.existsSync(resolved)) {
        fs.unlinkSync(resolved);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('get-media-dir', () => mediaDir);

  ipcMain.handle('convert-ppt', async (_event, pptPath) => {
    let stat;
    try {
      stat = fs.statSync(pptPath);
    } catch (err) {
      return { success: false, error: 'PPT file does not exist.' };
    }
    const crypto = require('crypto');
    const hashId = crypto.createHash('md5').update(`${pptPath}_${stat.mtimeMs}`).digest('hex');
    const outputDir = path.join(mediaPptDir, `slides_${hashId}`);

    if (fs.existsSync(outputDir)) {
      const existingSlides = fs.readdirSync(outputDir)
        .filter((f) => /\.(png|jpg|jpeg)$/i.test(f))
        .sort((a, b) => {
          const numA = parseInt(a.match(/\d+/) || [0], 10);
          const numB = parseInt(b.match(/\d+/) || [0], 10);
          return numA - numB;
        })
        .map((f, index) => ({
          index,
          path: path.join(outputDir, f),
          name: f,
        }));

      if (existingSlides.length > 0) {
        console.log('[PPT] Using cached conversion output:', outputDir);
        return {
          success: true,
          slides: existingSlides,
          outputDir,
          slideCount: existingSlides.length,
        };
      }
    }
    fs.mkdirSync(outputDir, { recursive: true });

    const scriptPath = getRuntimePptConvertScriptPath();
    if (!fs.existsSync(scriptPath)) {
      return { success: false, error: `ppt-convert.ps1 not found at runtime: ${scriptPath}` };
    }

    return new Promise((resolve) => {
      const args = [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        scriptPath,
        '-PptPath',
        pptPath,
        '-OutputDir',
        outputDir,
      ];
      const child = spawn('powershell.exe', args, { windowsHide: true });
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        try { child.kill(); } catch (_) {}
      }, pptConvertTimeoutMs);

      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.stderr.on('data', (d) => { stderr += d.toString(); });
      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({ success: false, error: err?.message || 'Failed to start PowerShell for PPT conversion.' });
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (timedOut) {
          resolve({ success: false, error: 'TIMEOUT' });
          return;
        }
        if (code !== 0) {
          const raw = `${stderr}\n${stdout}`.trim();
          const msg = raw || `PowerShell exited with code ${code}`;
          resolve({ success: false, error: msg });
          return;
        }

        const slides = fs.readdirSync(outputDir)
          .filter((f) => /\.(png|jpg|jpeg)$/i.test(f))
          .sort((a, b) => {
            const numA = parseInt(a.match(/\d+/) || [0], 10);
            const numB = parseInt(b.match(/\d+/) || [0], 10);
            return numA - numB;
          })
          .map((f, index) => ({
            index,
            path: path.join(outputDir, f),
            name: f,
          }));

        resolve({
          success: true,
          slides,
          outputDir,
          slideCount: slides.length,
        });
      });
    });
  });
}

module.exports = {
  registerMediaIPC,
};
