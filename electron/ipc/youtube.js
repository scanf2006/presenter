const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getYouTubeVideoIdFromUrl } = require('../../shared/youtube.cjs');

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
      // R3-H1: Validate URL is a YouTube URL to prevent SSRF.
      const raw = typeof inputUrl === 'string' ? inputUrl.trim() : '';
      if (!raw) return { success: false, error: 'YouTube URL is required.' };
      try {
        const parsed = new URL(raw);
        const host = parsed.hostname.toLowerCase();
        const allowed = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'];
        if (!allowed.some((h) => host === h)) {
          return { success: false, error: 'Only YouTube URLs are supported.' };
        }
      } catch (_) {
        return { success: false, error: 'Invalid URL format.' };
      }
      return await resolveYouTubeStream(raw);
    } catch (err) {
      return { success: false, error: err?.message || 'Failed to resolve YouTube stream.' };
    }
  });

  ipcMain.handle('youtube-cache-download', async (event, inputUrl) => {
    const raw = typeof inputUrl === 'string' ? inputUrl.trim() : '';
    if (!raw) return { success: false, error: 'YouTube URL is required.' };
    const sendProgress = (status, extra = {}) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('youtube-cache-progress', { url: raw, status, ...extra });
      }
    };
    sendProgress('resolving');
    appendBgDebug('youtube-cache-download-start', { url: raw });

    try {
      // Keep cache filenames short and deterministic on Windows to avoid rename/path issues.
      const cachedVideoId = getYouTubeVideoIdFromUrl(raw);
      const cacheKey = buildCacheKey({ videoId: cachedVideoId }, raw);
      const safeBase = sanitizeFileName(cacheKey) || 'youtube_cache';
      const outputPath = path.join(mediaYouTubeCacheDir, `${safeBase}.mp4`);

      const existing = fs.existsSync(outputPath) ? fs.statSync(outputPath) : null;
      if (existing && existing.size >= 1024 * 100) {
        appendBgDebug('youtube-cache-download-reused', { url: raw, outputPath, size: existing.size });
        sendProgress('success', { percent: 100 });
        return {
          success: true,
          localPath: outputPath,
          title: 'YouTube Video',
          videoId: cachedVideoId,
          originalUrl: raw,
          reused: true,
        };
      }

      const resolved = await resolveYouTubeStream(raw);
      const useYtDlpFallback = !resolved?.success || !resolved?.streamUrl;
      if (useYtDlpFallback) {
        appendBgDebug('youtube-cache-download-resolve-failed', { url: raw, error: resolved?.error });
      }

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
              if (useYtDlpFallback) {
                appendBgDebug('youtube-download-resolve-fallback-ytdlp-start', { url: raw });
                sendProgress('downloading');
                await downloadWithYtDlp(raw, outputPath, (progress) => {
                  sendProgress('downloading', progress);
                });
                appendBgDebug('youtube-download-resolve-fallback-ytdlp-success', { outputPath });
              } else {
                try {
                  sendProgress('downloading');
                  await downloadUrlToFileWithRetry(resolved.streamUrl, outputPath, (progress) => {
                    sendProgress('downloading', progress);
                  });
                } catch (primaryErr) {
                  appendBgDebug('youtube-download-primary-failed', {
                    error: primaryErr?.message || String(primaryErr),
                  });
                  appendBgDebug('youtube-download-fallback-ytdlp-start', { url: raw });
                  sendProgress('downloading');
                  await downloadWithYtDlp(raw, outputPath, (progress) => {
                    sendProgress('downloading', progress);
                  });
                  appendBgDebug('youtube-download-fallback-ytdlp-success', { outputPath });
                }
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
      sendProgress('success', { percent: 100 });
      return {
        success: true,
        localPath: outputPath,
        title: resolved?.title || 'YouTube Video',
        videoId: resolved?.videoId || '',
        originalUrl: resolved?.originalUrl || raw,
      };
    } catch (err) {
      appendBgDebug('youtube-cache-download-failed', {
        url: raw,
        error: err?.message || 'Download failed.',
      });
      sendProgress('failed');
      return { success: false, error: 'Download failed.' };
    }
  });
}

module.exports = {
  registerYouTubeIPC,
};
