const test = require('node:test');
const assert = require('node:assert/strict');

const {
  evaluateProjectorHealthState,
  createProjectorHealthMonitor,
} = require('../electron/services/projector-health-monitor');

function createWindowStub(overrides = {}) {
  return {
    isDestroyed: () => false,
    getBounds: () => ({ x: 0, y: 0, width: 1920, height: 1080 }),
    isFullScreen: () => true,
    isKiosk: () => true,
    isMinimized: () => false,
    ...overrides,
  };
}

test('evaluateProjectorHealthState returns healthy for aligned fullscreen projector window', () => {
  const projectorWindow = createWindowStub();
  const targetDisplay = { bounds: { x: 0, y: 0, width: 1920, height: 1080 } };
  const result = evaluateProjectorHealthState({ projectorWindow, targetDisplay });
  assert.equal(result.healthy, true);
  assert.deepEqual(result.reasons, []);
});

test('evaluateProjectorHealthState reports common drift reasons', () => {
  const projectorWindow = createWindowStub({
    getBounds: () => ({ x: 0, y: 0, width: 1600, height: 900 }),
    isFullScreen: () => false,
    isKiosk: () => false,
    isMinimized: () => true,
  });
  const targetDisplay = { bounds: { x: 0, y: 0, width: 1920, height: 1080 } };
  const result = evaluateProjectorHealthState({ projectorWindow, targetDisplay });
  assert.equal(result.healthy, false);
  assert.deepEqual(result.reasons, [
    'bounds-mismatch',
    'fullscreen-off',
    'kiosk-off',
    'window-minimized',
  ]);
});

test('projector health monitor triggers stabilize when unhealthy', () => {
  let stabilizedReason = null;
  const projectorWindow = createWindowStub({
    isFullScreen: () => false,
  });

  const monitor = createProjectorHealthMonitor({
    getProjectorWindow: () => projectorWindow,
    getProjectorDisplayId: () => 1,
    screenManager: {
      getAllDisplays: () => [{ id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } }],
      getDisplayMatching: () => null,
    },
    stabilizeProjectorWindow: (reason) => {
      stabilizedReason = reason;
      return true;
    },
    logger: { log: () => {}, warn: () => {} },
  });

  monitor.tick();
  assert.ok(stabilizedReason && stabilizedReason.includes('health-monitor:fullscreen-off'));
});
