const fs = require('fs');
const path = require('path');

function createYtDlpService({ YTDlpWrap, getYTDlpWrap, debug = () => {} } = {}) {
  let ytdlpInstance = null;
  let ytdlpBinPath = '';
  let bundledToolsPath = '';
  let resolvedYTDlpWrap = YTDlpWrap || null;

  function getBundledToolPath(name) {
    if (!bundledToolsPath) return '';
    const candidate = path.join(bundledToolsPath, name);
    return fs.existsSync(candidate) ? candidate : '';
  }

  function resolveYTDlpWrapClass() {
    if (resolvedYTDlpWrap) return resolvedYTDlpWrap;
    if (typeof getYTDlpWrap !== 'function') return null;
    try {
      resolvedYTDlpWrap = getYTDlpWrap() || null;
    } catch (_) {
      resolvedYTDlpWrap = null;
    }
    return resolvedYTDlpWrap;
  }

  async function getYtDlpInstance() {
    const YTDlpWrapClass = resolveYTDlpWrapClass();
    if (!YTDlpWrapClass) return null;
    if (ytdlpInstance) return ytdlpInstance;
    const bundledYtDlpPath = getBundledToolPath('yt-dlp.exe');
    const executablePath = bundledYtDlpPath || ytdlpBinPath;
    if (!executablePath) return null;

    try {
      if (!fs.existsSync(executablePath)) {
        debug('ytdlp-download-start', { binPath: executablePath });
        fs.mkdirSync(path.dirname(executablePath), { recursive: true });
        await YTDlpWrapClass.downloadFromGithub(executablePath);
        debug('ytdlp-download-done', { binPath: executablePath });
      }
      ytdlpInstance = new YTDlpWrapClass(executablePath);
      return ytdlpInstance;
    } catch (err) {
      debug('ytdlp-init-failed', { error: err?.message || String(err) });
      return null;
    }
  }

  async function downloadWithYtDlp(url, outputPath, onProgress = () => {}) {
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
    const denoPath = getBundledToolPath('deno.exe');
    const ffmpegPath = getBundledToolPath('ffmpeg.exe');
    fs.mkdirSync(outDir, { recursive: true });

    // Prefer MP4 video/audio streams and merge them with bundled ffmpeg.
    // M7-R2: Add a 5-minute timeout to prevent zombie child processes.
    const YTDLP_TIMEOUT_MS = 5 * 60 * 1000;
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), YTDLP_TIMEOUT_MS);
    try {
      await new Promise((resolve, reject) => {
        const downloader = yt.exec(
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
          ...(denoPath ? ['--js-runtimes', `deno:${denoPath}`] : []),
          ...(ffmpegPath ? ['--ffmpeg-location', ffmpegPath] : []),
          '-f',
          'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b',
          '--merge-output-format',
          'mp4',
          '--output',
          outName,
          url,
          ],
          { cwd: outDir },
          abortController.signal
        );
        downloader.on('progress', (progress) => {
          const percent = Number(progress?.percent);
          onProgress({ percent: Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : null });
        });
        downloader.once('close', resolve);
        downloader.once('error', reject);
      });
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

  function setBundledToolsPath(nextPath) {
    bundledToolsPath = nextPath || '';
    ytdlpInstance = null;
  }

  return {
    setBinaryPath,
    setBundledToolsPath,
    downloadWithYtDlp,
  };
}

module.exports = {
  createYtDlpService,
};
