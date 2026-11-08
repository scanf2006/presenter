const test = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../src/utils/pptViewer.js');

const SLIDES_A = ['a/slide_001.png', 'a/slide_002.png', 'a/slide_003.png'];
const SLIDES_B = ['b/slide_001.png'];

/** A deck open with slide 3 showing. */
const showingDeckA = async () => {
  const { pptViewerReducer, initialPptViewer } = await load();
  let state = pptViewerReducer(initialPptViewer, {
    type: 'convertStarted',
    sourcePath: 'C:/decks/a.pptx',
  });
  state = pptViewerReducer(state, { type: 'convertSucceeded', slides: SLIDES_A });
  return pptViewerReducer(state, { type: 'selectSlide', index: 2 });
};

test('nothing is open to begin with', async () => {
  const { initialPptViewer } = await load();

  assert.equal(initialPptViewer.status, 'idle');
  assert.equal(initialPptViewer.slides, null);
  assert.equal(initialPptViewer.slideIndex, -1);
  assert.equal(initialPptViewer.error, '');
  assert.equal(initialPptViewer.sourcePath, '');
});

test('starting a conversion drops the previous document entirely', async () => {
  // The bug: the converting flag and the new source path were set, but the
  // previous deck's slides and slide index stayed, so while B converted the
  // view showed A's slides as if they were B's.
  const { pptViewerReducer } = await load();
  const next = pptViewerReducer(await showingDeckA(), {
    type: 'convertStarted',
    sourcePath: 'C:/decks/b.pptx',
  });

  assert.equal(next.status, 'converting');
  assert.equal(next.sourcePath, 'C:/decks/b.pptx');
  assert.equal(next.slides, null, "A's slides must not show while B converts");
  assert.equal(next.slideIndex, -1);
  assert.equal(next.error, '');
});

test('a successful conversion opens the deck with no slide projected yet', async () => {
  const { pptViewerReducer, initialPptViewer, hasPptSlides, isPptConverting } = await load();

  const converting = pptViewerReducer(initialPptViewer, {
    type: 'convertStarted',
    sourcePath: 'C:/decks/a.pptx',
  });
  assert.equal(isPptConverting(converting), true);

  const ready = pptViewerReducer(converting, { type: 'convertSucceeded', slides: SLIDES_A });
  assert.equal(ready.status, 'ready');
  assert.deepEqual(ready.slides, SLIDES_A);
  assert.equal(ready.slideIndex, -1, 'opening a deck should not project a slide by itself');
  assert.equal(ready.sourcePath, 'C:/decks/a.pptx');
  assert.equal(hasPptSlides(ready), true);
  assert.equal(isPptConverting(ready), false);
});

test('a conversion that produces no slides is a failure, not an empty deck', async () => {
  const { pptViewerReducer, initialPptViewer, hasPptSlides } = await load();

  const converting = pptViewerReducer(initialPptViewer, { type: 'convertStarted' });
  for (const slides of [[], null, undefined, 'nope']) {
    const next = pptViewerReducer(converting, { type: 'convertSucceeded', slides });
    assert.equal(next.status, 'failed', `${JSON.stringify(slides)} should not read as ready`);
    assert.equal(hasPptSlides(next), false);
  }
});

test('a failure clears the document and keeps the reason', async () => {
  const { pptViewerReducer } = await load();
  const next = pptViewerReducer(await showingDeckA(), {
    type: 'convertFailed',
    error: 'PowerPoint is not installed',
  });

  assert.equal(next.status, 'failed');
  assert.equal(next.error, 'PowerPoint is not installed');
  assert.equal(next.slides, null);
  assert.equal(next.slideIndex, -1);
  assert.equal(next.sourcePath, '', 'there is no document to show any more');
});

test('a timeout fails without an inline error, since it is reported by a toast', async () => {
  const { pptViewerReducer, initialPptViewer } = await load();
  const next = pptViewerReducer(initialPptViewer, { type: 'convertFailed' });

  assert.equal(next.status, 'failed');
  assert.equal(next.error, '');
  assert.equal(next.sourcePath, '');
});

test('the slide index is clamped to the deck that is actually open', async () => {
  // The bug: nothing bounded the index, so after switching to a shorter deck
  // it could point past the end.
  const { pptViewerReducer } = await load();
  let state = pptViewerReducer(await showingDeckA(), {
    type: 'convertStarted',
    sourcePath: 'b',
  });
  state = pptViewerReducer(state, { type: 'convertSucceeded', slides: SLIDES_B });

  assert.equal(pptViewerReducer(state, { type: 'selectSlide', index: 2 }).slideIndex, 0);
  assert.equal(pptViewerReducer(state, { type: 'selectSlide', index: 99 }).slideIndex, 0);
  assert.equal(pptViewerReducer(state, { type: 'selectSlide', index: -5 }).slideIndex, -1);
});

test('selecting a slide with no deck open goes nowhere', async () => {
  const { pptViewerReducer, initialPptViewer } = await load();
  const next = pptViewerReducer(initialPptViewer, { type: 'selectSlide', index: 3 });
  assert.equal(next.slideIndex, -1);
});

test('a nonsense slide index is ignored rather than stored', async () => {
  const { pptViewerReducer } = await load();
  const open = await showingDeckA();

  for (const index of [undefined, null, NaN, 'two', {}]) {
    const next = pptViewerReducer(open, { type: 'selectSlide', index });
    assert.equal(next, open, `${JSON.stringify(index)} should be ignored`);
  }
  // A fractional index is truncated, not rejected.
  assert.equal(pptViewerReducer(open, { type: 'selectSlide', index: 1.7 }).slideIndex, 1);
});

test('closing clears everything, including a stale error', async () => {
  // The bug: opening a PDF cleared the slides but left the slide index, the
  // error and the source path, so a failed conversion's error could sit on
  // screen while a PDF was being viewed.
  const { pptViewerReducer, initialPptViewer } = await load();

  const failed = pptViewerReducer(await showingDeckA(), {
    type: 'convertFailed',
    error: 'conversion blew up',
  });
  const closed = pptViewerReducer(failed, { type: 'close' });
  assert.deepEqual(closed, initialPptViewer);

  const openThenClosed = pptViewerReducer(await showingDeckA(), { type: 'close' });
  assert.deepEqual(openThenClosed, initialPptViewer);
});

test('closing when nothing is open does not cause a render', async () => {
  const { pptViewerReducer, initialPptViewer } = await load();
  assert.equal(pptViewerReducer(initialPptViewer, { type: 'close' }), initialPptViewer);
});

test('an unknown action leaves the state untouched', async () => {
  const { pptViewerReducer } = await load();
  const open = await showingDeckA();

  assert.equal(pptViewerReducer(open, { type: 'whatever' }), open);
  assert.equal(pptViewerReducer(open, {}), open);
  assert.equal(pptViewerReducer(open, null), open);
});

test('selecting the slide already showing does not cause a render', async () => {
  const { pptViewerReducer } = await load();
  const open = await showingDeckA();
  assert.equal(pptViewerReducer(open, { type: 'selectSlide', index: open.slideIndex }), open);
});
