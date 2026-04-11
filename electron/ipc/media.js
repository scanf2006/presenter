const fs = require('fs');
const fsp = require('fs/promises');
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
        filters.push({
          name: 'Image Files',
          extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'],
        });
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
        filters.push({
          name: 'All Supported Files',
          extensions: [
            'jpg',
            'jpeg',
            'png',
            'gif',
            'bmp',
            'webp',
            'svg',
            'mp4',
            'webm',
            'mkv',
            'avi',
            'mov',
            'pdf',
            'pptx',
            'ppt',
          ],
        });
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
        // R3-H4: Use async I/O to avoid blocking the main process.
        const stat = await fsp.stat(resolvedSource);
        if (!stat.isFile()) {
          approvedImportPaths.delete(approvedKey);
          continue;
        }
        await fsp.mkdir(targetDir, { recursive: true });
        const destPath = path.join(targetDir, fileName);
        await fsp.copyFile(resolvedSource, destPath);

        const destStat = await fsp.stat(destPath);
        imported.push({
          id: fileName,
          name: path.basename(resolvedSource),
          type: fileType,
          path: destPath,
          size: destStat.size,
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
    // M9: Use async I/O to avoid blocking the main process.
    const scanDir = async (dirPath, fileType) => {
      try {
        await fsp.access(dirPath);
      } catch {
        return;
      }
      let files;
      try {
        files = await fsp.readdir(dirPath);
      } catch (err) {
        console.warn('[MediaList] Failed to read directory:', dirPath, err?.message);
        return;
      }
      for (const file of files) {
        try {
          const fullPath = path.join(dirPath, file);
          const stat = await fsp.stat(fullPath);
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
        } catch (fileErr) {
          // File may have been deleted between readdir and stat — skip it.
          continue;
        }
      }
    };

    if (type && dirs[type]) {
      await scanDir(dirs[type], type);
    } else {
      await Promise.all(Object.entries(dirs).map(([t, d]) => scanDir(d, t)));
    }

    return results.sort((a, b) => b.createdAt - a.createdAt);
  });

  ipcMain.handle('delete-media', async (_event, filePath) => {
    try {
      const resolved = resolveAbsolutePath(filePath);
      if (!resolved || !isPathWithinRoot(mediaDir, resolved)) {
        return { success: false, error: 'Path not allowed.' };
      }
      // R3-H5: Use async I/O to avoid blocking the main process.
      try {
        await fsp.access(resolved);
        await fsp.unlink(resolved);
      } catch (accessErr) {
        // File already deleted or doesn't exist — treat as success.
        if (accessErr?.code !== 'ENOENT') throw accessErr;
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Failed to delete file.' };
    }
  });

  ipcMain.handle('get-media-dir', () => mediaDir);

  ipcMain.handle('convert-ppt', async (_event, pptPath) => {
    // H1: Validate pptPath is within media directory to prevent path traversal.
    const resolvedPptPath = resolveAbsolutePath(pptPath);
    if (!resolvedPptPath || !isPathWithinRoot(mediaDir, resolvedPptPath)) {
      return { success: false, error: 'PPT path is not allowed.' };
    }
    let stat;
    try {
      stat = fs.statSync(resolvedPptPath);
    } catch (err) {
      return { success: false, error: 'PPT file does not exist.' };
    }
    const crypto = require('crypto');
    const hashId = crypto
      .createHash('md5')
      .update(`${resolvedPptPath}_${stat.mtimeMs}`)
      .digest('hex');
    const outputDir = path.join(mediaPptDir, `slides_${hashId}`);

    if (fs.existsSync(outputDir)) {
      const existingSlides = fs
        .readdirSync(outputDir)
        .filter((f) => /\.(png|jpg|jpeg)$/i.test(f))
        .sort((a, b) => {
          const numA = parseInt((a.match(/\d+/) || ['0'])[0], 10);
          const numB = parseInt((b.match(/\d+/) || ['0'])[0], 10);
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
      return { success: false, error: `ppt-convert.ps1 not found at runtime.` };
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
        resolvedPptPath,
        '-OutputDir',
        outputDir,
      ];
      const child = spawn('powershell.exe', args, { windowsHide: true });
      // R3-M: Cap stdout/stderr accumulation to prevent memory exhaustion.
      const MAX_OUTPUT = 64 * 1024;
      let stdout = '';
      let stderr = '';
      let stdoutCapped = false;
      let stderrCapped = false;
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        try {
          child.kill();
        } catch (killErr) {
          console.warn('[PPT] failed to kill conversion process:', killErr?.message || killErr);
        }
      }, pptConvertTimeoutMs);

      child.stdout.on('data', (d) => {
        if (!stdoutCapped) {
          stdout += d.toString();
          if (stdout.length > MAX_OUTPUT) {
            stdout = stdout.slice(0, MAX_OUTPUT);
            stdoutCapped = true;
          }
        }
      });
      child.stderr.on('data', (d) => {
        if (!stderrCapped) {
          stderr += d.toString();
          if (stderr.length > MAX_OUTPUT) {
            stderr = stderr.slice(0, MAX_OUTPUT);
            stderrCapped = true;
          }
        }
      });
      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          success: false,
          error: err?.message || 'Failed to start PowerShell for PPT conversion.',
        });
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

        const slides = fs
          .readdirSync(outputDir)
          .filter((f) => /\.(png|jpg|jpeg)$/i.test(f))
          .sort((a, b) => {
            const numA = parseInt((a.match(/\d+/) || ['0'])[0], 10);
            const numB = parseInt((b.match(/\d+/) || ['0'])[0], 10);
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
