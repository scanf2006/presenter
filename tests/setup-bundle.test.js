const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { collectReferencedMediaPathsFromQueue } = require('../electron/services/setup-bundle');

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('collectReferencedMediaPathsFromQueue captures only media files inside media root', () => {
  const mediaRoot = makeTempDir('cdp-media-root-');
  const imagesDir = path.join(mediaRoot, 'images');
  const pdfDir = path.join(mediaRoot, 'pdf');
  fs.mkdirSync(imagesDir, { recursive: true });
  fs.mkdirSync(pdfDir, { recursive: true });

  const img = path.join(imagesDir, 'bg.png');
  const pdf = path.join(pdfDir, 'slides.pdf');
  fs.writeFileSync(img, 'img');
  fs.writeFileSync(pdf, 'pdf');

  const outside = makeTempDir('cdp-media-outside-');
  const outsideVideo = path.join(outside, 'hack.mp4');
  fs.writeFileSync(outsideVideo, 'video');

  const queue = [
    { payload: { type: 'lyrics', backgroundPath: img } },
    { payload: { type: 'pdf', path: pdf } },
    { payload: { type: 'video', path: outsideVideo } },
  ];

  const result = collectReferencedMediaPathsFromQueue(queue, mediaRoot);
  const sorted = [...result.existing].sort();
  assert.deepEqual(sorted, [img, pdf].sort());
  assert.deepEqual(result.missingRefs, []);

  fs.rmSync(mediaRoot, { recursive: true, force: true });
  fs.rmSync(outside, { recursive: true, force: true });
});

test('collectReferencedMediaPathsFromQueue reports missing referenced files', () => {
  const mediaRoot = makeTempDir('cdp-media-missing-');
  const missing = path.join(mediaRoot, 'videos', 'missing.mp4');
  const queue = [{ payload: { type: 'video', path: missing } }];
  const result = collectReferencedMediaPathsFromQueue(queue, mediaRoot);

  assert.equal(result.existing.length, 0);
  assert.deepEqual(result.missingRefs, [missing]);

  fs.rmSync(mediaRoot, { recursive: true, force: true });
});
