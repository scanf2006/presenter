const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const { watchDisplayTopology } = require('../electron/services/display-watch');

function createTopologyHarness({ stabilizeResult = false } = {}) {
  const screen = new EventEmitter();
  const calls = {
    displayInfoChanged: 0,
    stabilizeReasons: [],
    recoverReasons: [],
  };

  watchDisplayTopology({
    screen,
    onDisplayInfoChanged: () => {
      calls.displayInfoChanged += 1;
    },
    onStabilizeProjector: (reason) => {
      calls.stabilizeReasons.push(reason);
      return stabilizeResult;
    },
    onRecover: (reason) => {
      calls.recoverReasons.push(reason);
    },
    logger: { log: () => {} },
  });

  return { screen, calls };
}

test('display addition stabilizes the projector before attempting recovery', () => {
  const { screen, calls } = createTopologyHarness({ stabilizeResult: true });

  screen.emit('display-added', null, { id: 2 });

  assert.equal(calls.displayInfoChanged, 1);
  assert.deepEqual(calls.stabilizeReasons, ['display-added']);
  assert.deepEqual(calls.recoverReasons, []);
});

test('display removal falls back to recovery when stabilization cannot restore projection', () => {
  const { screen, calls } = createTopologyHarness({ stabilizeResult: false });

  screen.emit('display-removed', null, { id: 2 });

  assert.equal(calls.displayInfoChanged, 1);
  assert.deepEqual(calls.stabilizeReasons, ['display-removed']);
  assert.deepEqual(calls.recoverReasons, ['display-removed']);
});

test('rapid display metric changes result in one recovery decision', async () => {
  const { screen, calls } = createTopologyHarness({ stabilizeResult: false });

  screen.emit('display-metrics-changed');
  screen.emit('display-metrics-changed');
  screen.emit('display-metrics-changed');

  await new Promise((resolve) => setTimeout(resolve, 550));

  assert.equal(calls.displayInfoChanged, 1);
  assert.deepEqual(calls.stabilizeReasons, ['display-metrics-changed']);
  assert.deepEqual(calls.recoverReasons, ['display-metrics-changed']);
});
