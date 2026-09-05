const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');
const { createYtDlpService } = require('../electron/services/ytdlp-service');

test('yt-dlp uses bundled Deno and ffmpeg for split YouTube formats', async () => {
  const runtimeDir = path.resolve(__dirname, '..', 'vendor', 'youtube-runtime');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'churchdisplay-ytdlp-'));
  let receivedArgs = [];

  class FakeYtDlpWrap {
    exec(args, options) {
      receivedArgs = args;
      const emitter = new EventEmitter();
      queueMicrotask(() => {
        emitter.emit('progress', { percent: 42 });
        fs.writeFileSync(path.join(options.cwd, args[args.indexOf('--output') + 1]), Buffer.alloc(1024 * 100));
        emitter.emit('close');
      });
      return emitter;
    }
  }

  try {
    const service = createYtDlpService({ YTDlpWrap: FakeYtDlpWrap });
    service.setBundledToolsPath(runtimeDir);
    const progress = [];
    await service.downloadWithYtDlp('https://www.youtube.com/watch?v=a26IjfrjhVM', path.join(tempDir, 'video.mp4'), (item) => progress.push(item));

    assert.equal(receivedArgs.includes('--js-runtimes'), true);
    assert.equal(receivedArgs.includes('--ffmpeg-location'), true);
    assert.equal(receivedArgs.includes('bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b'), true);
    assert.equal(receivedArgs.includes('--merge-output-format'), true);
    assert.deepEqual(progress, [{ percent: 42 }]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
