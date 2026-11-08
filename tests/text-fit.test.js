const test = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../src/utils/textFit.js');

test('text that already fits is left alone', async () => {
  const { computeFitScale } = await load();

  assert.deepEqual(computeFitScale({ contentHeight: 400, availableHeight: 800 }), {
    scale: 1,
    overflowing: false,
  });
  // Exactly filling the box is still a fit.
  assert.deepEqual(computeFitScale({ contentHeight: 800, availableHeight: 800 }), {
    scale: 1,
    overflowing: false,
  });
});

test('overflowing text is scaled by exactly the ratio it overflows by', async () => {
  const { computeFitScale } = await load();

  assert.deepEqual(computeFitScale({ contentHeight: 1000, availableHeight: 800 }), {
    scale: 0.8,
    overflowing: false,
  });
  assert.deepEqual(computeFitScale({ contentHeight: 1600, availableHeight: 1200 }), {
    scale: 0.75,
    overflowing: false,
  });
});

test('shrinking stops at the floor and reports that it is still overflowing', async () => {
  const { computeFitScale, MIN_FIT_SCALE } = await load();

  // Four times too tall: fitting it would need 0.25, below what stays readable.
  const result = computeFitScale({ contentHeight: 4000, availableHeight: 1000 });
  assert.equal(result.scale, MIN_FIT_SCALE);
  assert.equal(result.overflowing, true, 'the operator should be told, not shown clipped text');
});

test('the floor can be overridden but stays within sane bounds', async () => {
  const { computeFitScale } = await load();

  assert.equal(computeFitScale({ contentHeight: 4000, availableHeight: 1000, minScale: 0.2 }).scale, 0.25);
  // A nonsense floor is clamped rather than trusted.
  assert.equal(computeFitScale({ contentHeight: 4000, availableHeight: 1000, minScale: 5 }).scale, 1);
  assert.equal(computeFitScale({ contentHeight: 4000, availableHeight: 1000, minScale: -3 }).scale, 0.25);
});

test('an unmeasured or empty box renders unscaled rather than guessing', async () => {
  const { computeFitScale } = await load();

  for (const args of [
    { contentHeight: 0, availableHeight: 0 },
    { contentHeight: 0, availableHeight: 800 },
    { contentHeight: 800, availableHeight: 0 },
    { contentHeight: undefined, availableHeight: 800 },
    { contentHeight: 800, availableHeight: null },
    { contentHeight: NaN, availableHeight: 800 },
    {},
  ]) {
    assert.deepEqual(
      computeFitScale(args),
      { scale: 1, overflowing: false },
      `${JSON.stringify(args)} should render unscaled`
    );
  }
});

test('negative measurements never produce a negative or inverted scale', async () => {
  const { computeFitScale } = await load();

  assert.deepEqual(computeFitScale({ contentHeight: -100, availableHeight: 800 }), {
    scale: 1,
    overflowing: false,
  });
  assert.deepEqual(computeFitScale({ contentHeight: 800, availableHeight: -100 }), {
    scale: 1,
    overflowing: false,
  });
});

test('the scale is quantized so a resize tick does not restart the transition', async () => {
  const { quantizeFitScale } = await load();

  assert.equal(quantizeFitScale(0.8), 0.8);
  assert.equal(quantizeFitScale(0.7349), 0.73);
  assert.equal(quantizeFitScale(0.7351), 0.74);
  // Two measurements a hair apart land on the same value.
  assert.equal(quantizeFitScale(0.80001), quantizeFitScale(0.80009));
  // Never scales text up past its chosen size.
  assert.equal(quantizeFitScale(1.4), 1);
  assert.equal(quantizeFitScale(0), 1);
  assert.equal(quantizeFitScale(NaN), 1);
});
