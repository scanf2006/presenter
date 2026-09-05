const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { registerYouTubeIPC } = require('../electron/ipc/youtube');

test('youtube cache reuses an existing video file before resolving or downloading', async () => {
  const mediaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-youtube-cache-'));
  const handlers = new Map();
  const events = [];
  const videoId = 'a26IjfrjhVM';
  const outputPath = path.join(mediaDir, `vid_${videoId}.mp4`);
  fs.writeFileSync(outputPath, Buffer.alloc(1024 * 100));

  try {
    registerYouTubeIPC({
      ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
      appendBgDebug: () => {},
      resolveYouTubeStream: async () => { throw new Error('resolver should not run'); },
      sanitizeFileName: (value) => value.replace(':', '_'),
      mediaYouTubeCacheDir: mediaDir,
      downloadUrlToFileWithRetry: async () => { throw new Error('download should not run'); },
      downloadWithYtDlp: async () => { throw new Error('yt-dlp should not run'); },
    });

    const result = await handlers.get('youtube-cache-download')(
      { sender: { isDestroyed: () => false, send: (_channel, payload) => events.push(payload) } },
      `https://www.youtube.com/watch?v=${videoId}`
    );

    assert.equal(result.success, true);
    assert.equal(result.reused, true);
    assert.equal(result.localPath, outputPath);
    assert.equal(events.at(-1).status, 'success');
  } finally {
    fs.rmSync(mediaDir, { recursive: true, force: true });
  }
});
