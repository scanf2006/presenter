const fs = require('fs');
const path = require('path');

function registerYouTubeIPC({
  ipcMain,
  appendBgDebug,
  resolveYouTubeStream,
  sanitizeFileName,
  mediaYouTubeCacheDir,
  downloadUrlToFileWithRetry,
  downloadWithYtDlp,
}) {
  ipcMain.handle('youtube-resolve', async (_event, inputUrl) => {
    return resolveYouTubeStream(inputUrl);
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
      const fileBase = sanitizeFileName(`${resolved.videoId || 'youtube'}_${resolved.title || 'video'}`) || 'youtube_video';
      const outputPath = path.join(mediaYouTubeCacheDir, `${fileBase}.mp4`);
      if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 1024 * 100) {
        try {
          await downloadUrlToFileWithRetry(resolved.streamUrl, outputPath);
        } catch (primaryErr) {
          appendBgDebug('youtube-download-primary-failed', { error: primaryErr?.message || String(primaryErr) });
          appendBgDebug('youtube-download-fallback-ytdlp-start', { url: raw });
          await downloadWithYtDlp(raw, outputPath);
          appendBgDebug('youtube-download-fallback-ytdlp-success', { outputPath });
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
      appendBgDebug('youtube-cache-download-failed', { url: raw, error: err?.message || 'Download failed.' });
      return { success: false, error: err?.message || 'Download failed.' };
    }
  });
}

module.exports = {
  registerYouTubeIPC,
};
