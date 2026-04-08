const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { isPathWithinRoot, normalizeWithin } = require('../electron/services/path-utils');

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('isPathWithinRoot allows nested files and blocks traversal targets', () => {
  const root = makeTempDir('cdp-root-');
  const nestedDir = path.join(root, 'images');
  const outside = makeTempDir('cdp-outside-');
  fs.mkdirSync(nestedDir, { recursive: true });

  const allowed = path.join(nestedDir, 'slide.png');
  const blocked = path.join(outside, 'hack.png');
  fs.writeFileSync(allowed, 'ok');
  fs.writeFileSync(blocked, 'no');

  assert.equal(isPathWithinRoot(root, allowed), true);
  assert.equal(isPathWithinRoot(root, blocked), false);
  assert.equal(isPathWithinRoot(root, path.join(root, '..', path.basename(outside), 'hack.png')), false);

  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(outside, { recursive: true, force: true });
});

test('normalizeWithin returns null for paths outside root', () => {
  const root = makeTempDir('cdp-normalize-');
  const inside = path.join(root, 'videos', 'bg.mp4');
  const outside = path.resolve(root, '..', 'x.mp4');

  assert.equal(normalizeWithin(root, inside), inside);
  assert.equal(normalizeWithin(root, outside), null);

  fs.rmSync(root, { recursive: true, force: true });
});
