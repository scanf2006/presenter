const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function registerYouTubeIPC({
  ipcMain,
  appendBgDebug,
  resolveYouTubeStream,
  sanitizeFileName,
  mediaYouTubeCacheDir,
  downloadUrlToFileWithRetry,
  downloadWithYtDlp,
}) {
  const inflightByCacheKey = new Map();

  const buildCacheKey = (resolved, rawUrl) => {
    if (resolved?.videoId) return `vid:${resolved.videoId}`;
    const hash = crypto
      .createHash('sha1')
      .update(String(rawUrl || ''))
      .digest('hex')
      .slice(0, 12);
    return `url:${hash}`;
  };

  const cleanupStalePartFiles = (outputPath) => {
    const outDir = path.dirname(outputPath);
    const outBase = path.basename(outputPath);
    if (!fs.existsSync(outDir)) return;
    const entries = fs.readdirSync(outDir);
    entries.forEach((name) => {
      if (name === outBase) return;
      if (!name.startsWith(outBase)) return;
      if (!name.includes('.part')) return;
      const stalePath = path.join(outDir, name);
      try {
        fs.unlinkSync(stalePath);
      } catch (_) {
        // Ignore cleanup failures; downloader can still retry.
      }
    });
  };

  ipcMain.handle('youtube-resolve', async (_event, inputUrl) => {
    try {
      return await resolveYouTubeStream(inputUrl);
    } catch (err) {
      return { success: false, error: err?.message || 'Failed to resolve YouTube stream.' };
    }
  });

  ipcMain.handle('youtube-cache-download', async (_event, inputUrl) => {
    const raw = typeof inputUrl === 'string' ? inputUrl.trim() : '';
    if (!raw) return { success: false, error: 'YouTube URL is required.' };
    appendBgDebug('youtube-cache-download-start', { url: raw });

    const resolved = await resolveYouTubeStream(raw);
    if (!resolved?.success || !resolved?.streamUrl) {
      appendBgDebug('youtube-cache-download-resolve-failed', { url: raw, error: resolved?.error });
      return { success: false, error: resolved?.error || 'No playable stream found.' };
    }

    try {
      // Keep cache filenames short and deterministic on Windows to avoid rename/path issues.
      const cacheKey = buildCacheKey(resolved, raw);
      const safeBase = sanitizeFileName(cacheKey) || 'youtube_cache';
      const outputPath = path.join(mediaYouTubeCacheDir, `${safeBase}.mp4`);

      const existing = fs.existsSync(outputPath) ? fs.statSync(outputPath) : null;
      if (!existing || existing.size < 1024 * 100) {
        if (inflightByCacheKey.has(cacheKey)) {
          await inflightByCacheKey.get(cacheKey);
        } else {
          const downloadPromise = (async () => {
            try {
              cleanupStalePartFiles(outputPath);
              if (fs.existsSync(outputPath) && fs.statSync(outputPath).size < 1024 * 100) {
                fs.unlinkSync(outputPath);
              }
              try {
                await downloadUrlToFileWithRetry(resolved.streamUrl, outputPath);
              } catch (primaryErr) {
                appendBgDebug('youtube-download-primary-failed', {
                  error: primaryErr?.message || String(primaryErr),
                });
                appendBgDebug('youtube-download-fallback-ytdlp-start', { url: raw });
                await downloadWithYtDlp(raw, outputPath);
                appendBgDebug('youtube-download-fallback-ytdlp-success', { outputPath });
              }
            } finally {
              inflightByCacheKey.delete(cacheKey);
            }
          })();
          inflightByCacheKey.set(cacheKey, downloadPromise);
          await downloadPromise;
        }
      }
      appendBgDebug('youtube-cache-download-success', {
        url: raw,
        outputPath,
        size: fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0,
      });
      return {
        success: true,
        localPath: outputPath,
        title: resolved.title || 'YouTube Video',
        videoId: resolved.videoId || '',
        originalUrl: resolved.originalUrl || raw,
      };
    } catch (err) {
      appendBgDebug('youtube-cache-download-failed', {
        url: raw,
        error: err?.message || 'Download failed.',
      });
      return { success: false, error: err?.message || 'Download failed.' };
    }
  });
}

module.exports = {
  registerYouTubeIPC,
};
