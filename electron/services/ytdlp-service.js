const fs = require('fs');
const path = require('path');

function createYtDlpService({
  YTDlpWrap,
  debug = () => {},
} = {}) {
  let ytdlpInstance = null;
  let ytdlpBinPath = '';

  async function getYtDlpInstance() {
    if (!YTDlpWrap) return null;
    if (ytdlpInstance) return ytdlpInstance;
    if (!ytdlpBinPath) return null;

    try {
      if (!fs.existsSync(ytdlpBinPath)) {
        debug('ytdlp-download-start', { binPath: ytdlpBinPath });
        fs.mkdirSync(path.dirname(ytdlpBinPath), { recursive: true });
        await YTDlpWrap.downloadFromGithub(ytdlpBinPath);
        debug('ytdlp-download-done', { binPath: ytdlpBinPath });
      }
      ytdlpInstance = new YTDlpWrap(ytdlpBinPath);
      return ytdlpInstance;
    } catch (err) {
      debug('ytdlp-init-failed', { error: err?.message || String(err) });
      return null;
    }
  }

  async function downloadWithYtDlp(url, outputPath) {
    const yt = await getYtDlpInstance();
    if (!yt) throw new Error('yt-dlp unavailable');
    const outDir = path.dirname(outputPath);
    const outName = path.basename(outputPath);
    fs.mkdirSync(outDir, { recursive: true });

    // Prefer progressive mp4 to avoid ffmpeg dependency.
    await yt.execPromise([
      '--no-playlist',
      '--no-warnings',
      '-f',
      'b[ext=mp4]/b',
      '--output',
      outName,
      url,
    ], { cwd: outDir });

    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 1024 * 100) {
      throw new Error('yt-dlp output file missing or too small');
    }
  }

  function setBinaryPath(nextPath) {
    ytdlpBinPath = nextPath || '';
    ytdlpInstance = null;
  }

  return {
    setBinaryPath,
    downloadWithYtDlp,
  };
}

module.exports = {
  createYtDlpService,
};
