const fs = require('fs');
const path = require('path');

function createYtDlpService({ YTDlpWrap, debug = () => {} } = {}) {
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
    // M3: Validate URL format to prevent CLI injection via crafted strings
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error('Invalid URL provided to yt-dlp');
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error(`Disallowed protocol for yt-dlp: ${parsed.protocol}`);
    }

    const yt = await getYtDlpInstance();
    if (!yt) throw new Error('yt-dlp unavailable');
    const outDir = path.dirname(outputPath);
    const outName = path.basename(outputPath);
    fs.mkdirSync(outDir, { recursive: true });

    // Prefer progressive mp4 to avoid ffmpeg dependency.
    // M7-R2: Add a 5-minute timeout to prevent zombie child processes.
    const YTDLP_TIMEOUT_MS = 5 * 60 * 1000;
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), YTDLP_TIMEOUT_MS);
    try {
      await yt.execPromise(
        [
          '--no-playlist',
          '--no-warnings',
          '--no-part',
          '--concurrent-fragments',
          '1',
          '--retries',
          '3',
          '--fragment-retries',
          '3',
          '-f',
          'b[ext=mp4]/b',
          '--output',
          outName,
          url,
        ],
        { cwd: outDir, signal: abortController.signal }
      );
    } catch (err) {
      if (abortController.signal.aborted) {
        throw new Error('yt-dlp download timed out after 5 minutes');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

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
