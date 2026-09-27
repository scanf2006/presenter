const test = require('node:test');
const assert = require('node:assert/strict');
const displays = [{ id: 'external', bounds: { x: 100 } }, { id: 'other', bounds: { x: 200 } }];
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };

test('a failed projection does not block a later stop', async () => {
  const { createProjectionController } = await import('../src/utils/projectionController.js');
  const states = []; let hidden = false;
  const controller = createProjectionController({ show: async () => { throw new Error('unavailable'); }, hide: async () => { hidden = true; }, onState: (state) => states.push(state) });
  await assert.rejects(controller.select('external', displays), /unavailable/);
  assert.equal(states.at(-1).active, false);
  await controller.select(null, displays);
  assert.ok(hidden);
  assert.deepEqual(states.at(-1), { selected: null, active: false });
});

test('stop wins against an in-flight start and stale display refresh', async () => {
  const { createProjectionController } = await import('../src/utils/projectionController.js');
  const started = deferred(); const finish = deferred(); const states = []; const calls = [];
  const controller = createProjectionController({
    show: async () => { calls.push('show'); started.resolve(); await finish.promise; },
    hide: async () => { calls.push('hide'); }, onState: (state) => states.push(state),
  });
  const start = controller.select('external', displays);
  await started.promise;
  const oldRevision = controller.revision();
  const stop = controller.select(null, displays);
  await controller.refresh(displays, oldRevision);
  finish.resolve();
  await Promise.all([start, stop]);
  assert.deepEqual(calls, ['show', 'hide']);
  assert.deepEqual(states.at(-1), { selected: null, active: false });
  assert.ok(states.every((state) => !state.active));
});

test('manual selection wins over an in-flight automatic recovery', async () => {
  const { createProjectionController } = await import('../src/utils/projectionController.js');
  const started = deferred(); const finish = deferred(); const calls = []; const states = [];
  const controller = createProjectionController({
    show: async (id) => { calls.push(id); if (id === 'external') { started.resolve(); await finish.promise; } },
    hide: async () => {}, onState: (state) => states.push(state),
  });
  await controller.select('external', []);
  const recovery = controller.refresh(displays, controller.revision());
  await started.promise;
  const manual = controller.select('other', displays);
  finish.resolve();
  await Promise.all([recovery, manual]);
  assert.deepEqual(calls, ['external', 'other']);
  assert.deepEqual(states.at(-1), { selected: 'other', active: true });
});
