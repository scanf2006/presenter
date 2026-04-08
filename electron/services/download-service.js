const http = require('http');
const https = require('https');
const fs = require('fs');

function createDownloadService({
  networkTimeoutMs = 120000,
  debug = () => {},
} = {}) {
  function downloadUrlToFile(fileUrl, outputPath, headers = {}, maxRedirects = 6) {
    return new Promise((resolve, reject) => {
      const visit = (url, redirectsLeft) => {
        const client = url.startsWith('https://') ? https : http;
        const req = client.get(url, { headers }, (res) => {
          const code = res.statusCode || 0;
          if ([301, 302, 303, 307, 308].includes(code) && res.headers.location && redirectsLeft > 0) {
            const nextUrl = new URL(res.headers.location, url).toString();
            res.resume();
            visit(nextUrl, redirectsLeft - 1);
            return;
          }
          if (code < 200 || code >= 300) {
            res.resume();
            reject(new Error(`Download failed with status ${code}`));
            return;
          }
          const tmpPath = `${outputPath}.download`;
          const ws = fs.createWriteStream(tmpPath);
          res.pipe(ws);
          ws.on('finish', () => {
            ws.close(() => {
              fs.rename(tmpPath, outputPath, (err) => {
                if (err) reject(err);
                else resolve();
              });
            });
          });
          ws.on('error', (err) => reject(err));
        });
        req.on('error', (err) => reject(err));
        req.setTimeout(networkTimeoutMs, () => {
          req.destroy(new Error('Download timeout'));
        });
      };
      visit(fileUrl, maxRedirects);
    });
  }

  async function downloadUrlToFileWithRetry(fileUrl, outputPath) {
    const attempts = [
      {},
      { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' },
      {
        Referer: 'https://www.youtube.com/',
        Origin: 'https://www.youtube.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      },
    ];

    let lastErr = null;
    for (let i = 0; i < attempts.length; i += 1) {
      const hdr = attempts[i];
      try {
        debug('youtube-download-attempt', { index: i + 1, headers: Object.keys(hdr) });
        await downloadUrlToFile(fileUrl, outputPath, hdr);
        return;
      } catch (err) {
        lastErr = err;
        debug('youtube-download-attempt-failed', { index: i + 1, error: err?.message || String(err) });
      }
    }
    throw lastErr || new Error('Download failed.');
  }

  return {
    downloadUrlToFile,
    downloadUrlToFileWithRetry,
  };
}

module.exports = {
  createDownloadService,
};
