const test = require('node:test');
const assert = require('node:assert/strict');

let freeTextLayout;

test.before(async () => {
  freeTextLayout = await import('../src/utils/freeTextLayout.js');
});

test('clampFreeTextLayout clamps values into bounds', () => {
  const result = freeTextLayout.clampFreeTextLayout({ xPercent: 999, yPercent: -10, scale: 99 });
  assert.equal(result.xPercent, 92);
  assert.equal(result.yPercent, 10);
  assert.equal(result.scale, 3.2);
});

test('clampFreeTextLayout falls back on invalid input', () => {
  const result = freeTextLayout.clampFreeTextLayout({});
  assert.equal(result.xPercent, 50);
  assert.equal(result.yPercent, 50);
  assert.equal(result.scale, 1);
});

test('getScaledFreeTextFontPx returns null for invalid font size', () => {
  assert.equal(freeTextLayout.getScaledFreeTextFontPx(undefined, 1), null);
  assert.equal(freeTextLayout.getScaledFreeTextFontPx(-1, 1), null);
});

test('getScaledFreeTextFontPx scales and clamps font size', () => {
  assert.equal(freeTextLayout.getScaledFreeTextFontPx(72, 0.5), 36);
  assert.equal(freeTextLayout.getScaledFreeTextFontPx(999, 1), 220);
});

test('fallback text base px mapping is stable', () => {
  assert.equal(freeTextLayout.getFallbackTextBasePx('small'), 32);
  assert.equal(freeTextLayout.getFallbackTextBasePx('medium'), 48);
  assert.equal(freeTextLayout.getFallbackTextBasePx('large'), 72);
});

test('textual type detection only accepts known textual slide types', () => {
  assert.equal(freeTextLayout.isTextualSlideType('text'), true);
  assert.equal(freeTextLayout.isTextualSlideType('bible'), true);
  assert.equal(freeTextLayout.isTextualSlideType('lyrics'), true);
  assert.equal(freeTextLayout.isTextualSlideType('video'), false);
});

test('free text content width constant remains expected value', () => {
  assert.equal(freeTextLayout.FREE_TEXT_CONTENT_WIDTH_PERCENT, 88);
});
