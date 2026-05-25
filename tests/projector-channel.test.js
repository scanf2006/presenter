const test = require('node:test');
const assert = require('node:assert/strict');

let projectorChannel;

test.before(async () => {
  projectorChannel = await import('../src/utils/projectorChannel.js');
});

test('normalizeTransitionConfig applies defaults and clamps negatives', () => {
  const a = projectorChannel.normalizeTransitionConfig({});
  assert.equal(a.enabled, true);
  assert.equal(a.delayMs, 20);
  assert.equal(a.durationMs, 60);

  const b = projectorChannel.normalizeTransitionConfig({
    enabled: false,
    delayMs: -10,
    durationMs: -3,
  });
  assert.equal(b.enabled, false);
  assert.equal(b.delayMs, 0);
  assert.equal(b.durationMs, 0);
});

test('mergeSceneConfig enforces scene bounds and booleans', () => {
  const prev = {
    mode: 'normal',
    splitDirection: 'content_left_camera_right',
    cameraDeviceId: 'old',
    cameraPanePercent: 30,
    cameraMuted: true,
    cameraCenterCropPercent: 100,
    enableCameraTestMode: false,
  };

  const next = projectorChannel.mergeSceneConfig(prev, {
    mode: 'split_camera',
    splitDirection: 'x',
    cameraDeviceId: 'new',
    cameraPanePercent: 999,
    cameraMuted: false,
    cameraCenterCropPercent: -1,
    enableCameraTestMode: true,
  });

  assert.equal(next.mode, 'split_camera');
  assert.equal(next.splitDirection, 'x');
  assert.equal(next.cameraDeviceId, 'new');
  assert.equal(next.cameraPanePercent, 40);
  assert.equal(next.cameraMuted, false);
  assert.equal(next.cameraCenterCropPercent, 100);
  assert.equal(next.enableCameraTestMode, true);
});
