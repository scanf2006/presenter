const http = require('http');
const https = require('https');
const fs = require('fs');
const { URL } = require('url');

/** Block redirects to private/internal network addresses (SSRF protection). */
function isPrivateHost(hostname) {
  // IPv4 private & reserved ranges
  if (/^(127\.|10\.|192\.168\.|0\.)/.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
  // Link-local, metadata endpoints
  if (/^(169\.254\.|100\.(6[4-9]|[7-9]\d|1[0-2]\d)\.)/.test(hostname)) return true;
  // IPv6 loopback / private
  if (/^(\[::1\]|\[fc|\[fd|\[fe80:)/i.test(hostname)) return true;
  if (hostname === 'localhost' || hostname === '[::1]') return true;
  return false;
}

function createDownloadService({ networkTimeoutMs = 120000, debug = () => {} } = {}) {
  function downloadUrlToFile(fileUrl, outputPath, headers = {}, maxRedirects = 6) {
    return new Promise((resolve, reject) => {
      const cleanupTmp = () => {
        const tmpPath = `${outputPath}.download`;
        fs.unlink(tmpPath, () => {
          /* ignore cleanup errors */
        });
      };

      const visit = (url, redirectsLeft) => {
        const client = url.startsWith('https://') ? https : http;
        const req = client.get(url, { headers }, (res) => {
          const code = res.statusCode || 0;
          if (
            [301, 302, 303, 307, 308].includes(code) &&
            res.headers.location &&
            redirectsLeft > 0
          ) {
            let nextUrl;
            try {
              nextUrl = new URL(res.headers.location, url);
            } catch {
              res.resume();
              reject(new Error('Invalid redirect URL'));
              return;
            }
            if (isPrivateHost(nextUrl.hostname)) {
              res.resume();
              reject(new Error(`Redirect to private address blocked: ${nextUrl.hostname}`));
              return;
            }
            if (nextUrl.protocol !== 'https:' && nextUrl.protocol !== 'http:') {
              res.resume();
              reject(new Error(`Redirect to disallowed protocol: ${nextUrl.protocol}`));
              return;
            }
            res.resume();
            visit(nextUrl.toString(), redirectsLeft - 1);
            return;
          }
          if (code < 200 || code >= 300) {
            res.resume();
            reject(new Error(`Download failed with status ${code}`));
            return;
          }
          const tmpPath = `${outputPath}.download`;
          const ws = fs.createWriteStream(tmpPath);
          // M9-R2: Handle errors on the response stream to prevent unhandled exceptions.
          res.on('error', (err) => {
            ws.destroy();
            cleanupTmp();
            reject(err);
          });
          res.pipe(ws);
          ws.on('finish', () => {
            ws.close(() => {
              fs.rename(tmpPath, outputPath, (err) => {
                if (err) {
                  cleanupTmp();
                  reject(err);
                } else {
                  resolve();
                }
              });
            });
          });
          ws.on('error', (err) => {
            cleanupTmp();
            reject(err);
          });
        });
        req.on('error', (err) => {
          cleanupTmp();
          reject(err);
        });
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
      {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      },
      {
        Referer: 'https://www.youtube.com/',
        Origin: 'https://www.youtube.com',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
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
        debug('youtube-download-attempt-failed', {
          index: i + 1,
          error: err?.message || String(err),
        });
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
