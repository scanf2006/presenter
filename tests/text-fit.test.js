const test = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../src/utils/textFit.js');

const FITS = { scale: 1, tight: false, overflowing: false };

test('text that already fits is left alone', async () => {
  const { computeFitScale } = await load();

  assert.deepEqual(computeFitScale({ contentHeight: 400, availableHeight: 800 }), FITS);
  // Exactly filling the box is still a fit.
  assert.deepEqual(computeFitScale({ contentHeight: 800, availableHeight: 800 }), FITS);
});

test('overflowing text is scaled by exactly the ratio it overflows by', async () => {
  const { computeFitScale } = await load();

  assert.deepEqual(computeFitScale({ contentHeight: 1000, availableHeight: 800 }), {
    scale: 0.8,
    tight: false,
    overflowing: false,
  });
  assert.deepEqual(computeFitScale({ contentHeight: 1600, availableHeight: 1200 }), {
    scale: 0.75,
    tight: false,
    overflowing: false,
  });
});

test('text far too tall still fits, rather than being cut off', async () => {
  // The bug this fixes: a 0.5 floor used to stop the shrinking here and leave
  // the rest of the passage off the screen. A large Bible font with several
  // verses is routinely three or four times too tall, so this was the normal
  // case, not an edge case. Text you cannot see at all is worse than small
  // text, so it now fits and raises a flag instead.
  const { computeFitScale } = await load();

  const fourTimes = computeFitScale({ contentHeight: 4000, availableHeight: 1000 });
  assert.equal(fourTimes.scale, 0.25, 'it must shrink all the way to fit');
  assert.equal(fourTimes.overflowing, false, 'nothing should be left off the screen');
  assert.equal(fourTimes.tight, true, 'but the operator should be told it is small');

  const threeTimes = computeFitScale({ contentHeight: 3000, availableHeight: 1000 });
  assert.equal(Number(threeTimes.scale.toFixed(4)), 0.3333);
  assert.equal(threeTimes.overflowing, false);
  assert.equal(threeTimes.tight, true);
});

test('a comfortable reduction is not flagged', async () => {
  const { computeFitScale, COMFORTABLE_MIN_SCALE } = await load();

  // Just inside the comfortable range.
  const easy = computeFitScale({ contentHeight: 1000, availableHeight: 600 });
  assert.equal(easy.scale, 0.6);
  assert.equal(easy.tight, false);

  // Exactly at the threshold counts as comfortable.
  const atThreshold = computeFitScale({ contentHeight: 1000, availableHeight: 500 });
  assert.equal(atThreshold.scale, COMFORTABLE_MIN_SCALE);
  assert.equal(atThreshold.tight, false);

  // A hair below it is flagged.
  assert.equal(computeFitScale({ contentHeight: 1000, availableHeight: 499 }).tight, true);
});

test('the absolute bound is a sanity limit, and only it reports overflow', async () => {
  const { computeFitScale, ABSOLUTE_MIN_SCALE } = await load();

  // Twenty times too tall: beyond any sensible rendering.
  const absurd = computeFitScale({ contentHeight: 20000, availableHeight: 1000 });
  assert.equal(absurd.scale, ABSOLUTE_MIN_SCALE);
  assert.equal(absurd.overflowing, true, 'this is the only case that still overflows');
  assert.equal(absurd.tight, true);
});

test('the bounds can be overridden but stay within sane limits', async () => {
  const { computeFitScale } = await load();

  // A caller that wants to stop earlier can.
  assert.equal(
    computeFitScale({ contentHeight: 4000, availableHeight: 1000, minScale: 0.5 }).scale,
    0.5
  );
  // A nonsense bound is clamped rather than trusted.
  assert.equal(
    computeFitScale({ contentHeight: 4000, availableHeight: 1000, minScale: 5 }).scale,
    1
  );
  assert.equal(
    computeFitScale({ contentHeight: 4000, availableHeight: 1000, minScale: -3 }).scale,
    0.25
  );
  // The comfort threshold is independent of the bound.
  assert.equal(
    computeFitScale({ contentHeight: 1000, availableHeight: 400, comfortableMinScale: 0.2 }).tight,
    false
  );
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
    assert.deepEqual(computeFitScale(args), FITS, `${JSON.stringify(args)} should render unscaled`);
  }
});

test('negative measurements never produce a negative or inverted scale', async () => {
  const { computeFitScale } = await load();

  assert.deepEqual(computeFitScale({ contentHeight: -100, availableHeight: 800 }), FITS);
  assert.deepEqual(computeFitScale({ contentHeight: 800, availableHeight: -100 }), FITS);
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

test('quantizing keeps a heavy reduction usable rather than rounding it away', async () => {
  const { computeFitScale, quantizeFitScale } = await load();

  // A 4x reduction quantizes to 0.25, not to 0.
  const heavy = computeFitScale({ contentHeight: 4000, availableHeight: 1000 });
  assert.equal(quantizeFitScale(heavy.scale), 0.25);
  // And a 20x one to 0.1 rather than 0, which would hide the text entirely.
  const absurd = computeFitScale({ contentHeight: 20000, availableHeight: 1000 });
  assert.equal(quantizeFitScale(absurd.scale), 0.1);
  assert.ok(quantizeFitScale(absurd.scale) > 0);
});

test('a box with no layout yet is reported as unmeasured, not as zero space', async () => {
  const { usableHeight } = await load();

  for (const clientHeight of [0, -5, undefined, null, NaN, 'tall']) {
    const result = usableHeight({ clientHeight, padding: 100, reserved: 50 });
    assert.equal(result.measured, false, `${JSON.stringify(clientHeight)} is not a measurement`);
    assert.equal(result.available, 0);
  }
});

test('the usable band is the box minus its padding and whatever is reserved', async () => {
  const { usableHeight } = await load();

  assert.deepEqual(usableHeight({ clientHeight: 1080, padding: 144, reserved: 56 }), {
    available: 880,
    measured: true,
  });
  // Missing figures default to nothing reserved.
  assert.deepEqual(usableHeight({ clientHeight: 1080 }), { available: 1080, measured: true });
});

test('reservations larger than the box fall back to the box, not to nothing', async () => {
  // This is the bug behind text spilling off the top AND the bottom: the band
  // came out negative, computeFitScale read that as "not measured" and returned
  // scale 1, and the full-size text was then centred and clipped at both ends.
  const { usableHeight, computeFitScale } = await load();

  const squeezed = usableHeight({ clientHeight: 48, padding: 48, reserved: 96 });
  assert.equal(squeezed.measured, true, 'the box is real, so this is a measurement');
  assert.equal(squeezed.available, 48, 'fitting the whole box beats fitting nothing');

  // And the scale that follows actually shrinks the text.
  const fit = computeFitScale({ contentHeight: 5000, availableHeight: squeezed.available });
  assert.ok(fit.scale < 1, 'it must still scale down');
  assert.equal(fit.tight, true);
});

test('a band of exactly zero after reservations still counts as measured', async () => {
  const { usableHeight } = await load();

  const result = usableHeight({ clientHeight: 200, padding: 150, reserved: 50 });
  assert.equal(result.measured, true);
  assert.equal(result.available, 200);
});
