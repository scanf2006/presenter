const test = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../src/utils/bibleNavigation.js');

const GENESIS = { sn: 1, name: 'Genesis' };
const EXODUS = { sn: 2, name: 'Exodus' };

// A state as it looks mid-reading: a chapter open, verses loaded, two picked.
const reading = async (overrides = {}) => {
  const { initialBibleNavigation } = await load();
  return {
    ...initialBibleNavigation,
    selectedBook: GENESIS,
    selectedChapter: 3,
    verses: [{ verse: 1 }, { verse: 2 }],
    selectedVerses: [1, 2],
    versesContext: { bookSn: 1, chapter: 3, loadSeq: 7 },
    ...overrides,
  };
};

const apply = async (state, action) => {
  const { bibleNavigationReducer } = await load();
  return bibleNavigationReducer(state, action);
};

test('the starting state has nothing selected and a default translation', async () => {
  const { initialBibleNavigation, DEFAULT_BIBLE_VERSION } = await load();

  assert.equal(initialBibleNavigation.version, DEFAULT_BIBLE_VERSION);
  assert.equal(initialBibleNavigation.selectedBook, null);
  assert.equal(initialBibleNavigation.selectedChapter, null);
  assert.deepEqual(initialBibleNavigation.verses, []);
  assert.deepEqual(initialBibleNavigation.selectedVerses, []);
  assert.equal(initialBibleNavigation.versesContext, null);
});

test('switching translation drops everything loaded for the old one', async () => {
  // The bug this fixes: switching version used to reset nothing, leaving the
  // other translation's text and the verse picks in place.
  const next = await apply(await reading(), { type: 'setVersion', version: 'kjv' });

  assert.equal(next.version, 'kjv');
  assert.deepEqual(next.verses, []);
  assert.deepEqual(next.selectedVerses, []);
  assert.equal(next.versesContext, null);
  // Where the reader was is kept, so the same reference reloads in the new
  // translation rather than dumping them back at the catalogue.
  assert.equal(next.selectedBook, GENESIS);
  assert.equal(next.selectedChapter, 3);
});

test('picking a different book clears the previous verse selection', async () => {
  // Previously the verses were cleared but the SELECTION was not, so the new
  // book opened with verses from the old chapter still marked.
  const next = await apply(await reading(), { type: 'selectBook', book: EXODUS });

  assert.equal(next.selectedBook, EXODUS);
  assert.equal(next.selectedChapter, null);
  assert.deepEqual(next.verses, []);
  assert.deepEqual(next.selectedVerses, []);
  assert.equal(next.versesContext, null);
});

test('picking a new chapter clears the selection from the last one', async () => {
  const next = await apply(await reading(), { type: 'selectChapter', chapter: 4 });

  assert.equal(next.selectedChapter, 4);
  assert.deepEqual(next.selectedVerses, []);
  assert.deepEqual(next.verses, []);
  assert.equal(next.versesContext, null);
});

test('going back to the catalogue leaves nothing behind', async () => {
  const next = await apply(await reading(), { type: 'clearBook' });

  assert.equal(next.selectedBook, null);
  assert.equal(next.selectedChapter, null);
  assert.deepEqual(next.verses, []);
  assert.deepEqual(next.selectedVerses, []);
  assert.equal(next.versesContext, null);
});

test('going back to the chapter list keeps the book but drops the chapter', async () => {
  const next = await apply(await reading(), { type: 'clearChapter' });

  assert.equal(next.selectedBook, GENESIS);
  assert.equal(next.selectedChapter, null);
  assert.deepEqual(next.selectedVerses, []);
});

test('a jump sets book and chapter together', async () => {
  const next = await apply(await reading(), {
    type: 'jumpTo',
    book: EXODUS,
    chapter: 20,
  });

  assert.equal(next.selectedBook, EXODUS);
  assert.equal(next.selectedChapter, 20);
  assert.deepEqual(next.selectedVerses, []);
  assert.deepEqual(next.verses, []);
});

test('a jump without a chapter lands on the book', async () => {
  const next = await apply(await reading(), { type: 'jumpTo', book: EXODUS });

  assert.equal(next.selectedBook, EXODUS);
  assert.equal(next.selectedChapter, null);
});

test('loading verses replaces the text and stamps which chapter it is for', async () => {
  const loading = await apply(await reading(), { type: 'versesLoading' });
  assert.deepEqual(loading.verses, [], 'the old chapter must not show while loading');
  assert.equal(loading.versesContext, null);

  const rows = [{ verse: 1 }, { verse: 2 }, { verse: 3 }];
  const loaded = await apply(loading, {
    type: 'versesLoaded',
    verses: rows,
    context: { bookSn: 1, chapter: 3, loadSeq: 8 },
  });
  assert.deepEqual(loaded.verses, rows);
  assert.deepEqual(loaded.versesContext, { bookSn: 1, chapter: 3, loadSeq: 8 });
});

test('a failed load keeps the placeholder rows the caller supplies', async () => {
  const placeholder = [{ verse: 0, text: 'could not load' }];
  const next = await apply(await reading(), {
    type: 'versesFailed',
    verses: placeholder,
    context: { bookSn: 1, chapter: 3, loadSeq: 9 },
  });

  assert.deepEqual(next.verses, placeholder, 'the UI needs something to explain with');
  assert.deepEqual(next.selectedVerses, [], 'nothing projectable should stay selected');
});

test('the verse selection can be replaced and cleared', async () => {
  const picked = await apply(await reading({ selectedVerses: [] }), {
    type: 'setSelectedVerses',
    verses: [4, 5, 6],
  });
  assert.deepEqual(picked.selectedVerses, [4, 5, 6]);

  const cleared = await apply(picked, { type: 'clearSelectedVerses' });
  assert.deepEqual(cleared.selectedVerses, []);
});

test('a non-array selection never corrupts the state', async () => {
  for (const verses of [null, undefined, 'all', 42, {}]) {
    const next = await apply(await reading(), { type: 'setSelectedVerses', verses });
    assert.deepEqual(next.selectedVerses, [], `${JSON.stringify(verses)} should become []`);
  }
});

test('reset returns to the start but keeps the chosen translation', async () => {
  const next = await apply(await reading({ version: 'kjv' }), { type: 'reset' });

  assert.equal(next.version, 'kjv', 'the reader should not be switched back to Chinese');
  assert.equal(next.selectedBook, null);
  assert.equal(next.selectedChapter, null);
  assert.deepEqual(next.verses, []);
  assert.deepEqual(next.selectedVerses, []);
});

test('a no-op action returns the very same object, so React skips the render', async () => {
  const state = await reading();

  for (const action of [
    { type: 'setVersion', version: state.version },
    { type: 'setVersion', version: '' },
    { type: 'selectChapter', chapter: 3 },
    { type: 'selectBook', book: null },
    { type: 'jumpTo', book: null },
    { type: 'clearSelectedVerses' },
    { type: 'unknownAction' },
    {},
  ]) {
    const next = await apply(
      action.type === 'clearSelectedVerses' ? await reading({ selectedVerses: [] }) : state,
      action
    );
    const base =
      action.type === 'clearSelectedVerses' ? await reading({ selectedVerses: [] }) : state;
    assert.deepEqual(next, base, `${JSON.stringify(action)} should not change the state`);
  }

  // Identity, not just equality, for the plain no-ops.
  const { bibleNavigationReducer } = await load();
  assert.equal(bibleNavigationReducer(state, { type: 'nope' }), state);
  assert.equal(bibleNavigationReducer(state, { type: 'selectChapter', chapter: 3 }), state);
  assert.equal(bibleNavigationReducer(state, null), state);
});

test('loaded verses are only trusted when they match where the reader is', async () => {
  const { versesMatchSelection } = await load();

  assert.equal(versesMatchSelection(await reading()), true);
  // After a jump, the stamp no longer matches, so the old text is not shown.
  const jumped = await apply(await reading(), { type: 'jumpTo', book: EXODUS, chapter: 20 });
  assert.equal(versesMatchSelection(jumped), false);
  // A stamp from another chapter of the same book does not match either.
  assert.equal(
    versesMatchSelection(await reading({ versesContext: { bookSn: 1, chapter: 9 } })),
    false
  );
  assert.equal(versesMatchSelection({ versesContext: null }), false);
  assert.equal(versesMatchSelection(undefined), false);
});

test('toggling a verse adds it, removes it, and keeps verse order', async () => {
  const { bibleNavigationReducer, initialBibleNavigation } = await load();
  const v = (verse) => ({ verse, text: `line ${verse}` });

  let state = { ...initialBibleNavigation, selectedBook: GENESIS, selectedChapter: 1 };
  // Picked out of order, as happens when clicking around the chapter.
  state = bibleNavigationReducer(state, { type: 'toggleVerse', verse: v(5) });
  state = bibleNavigationReducer(state, { type: 'toggleVerse', verse: v(2) });
  state = bibleNavigationReducer(state, { type: 'toggleVerse', verse: v(9) });
  assert.deepEqual(
    state.selectedVerses.map((item) => item.verse),
    [2, 5, 9],
    'the projected reference is built from the first and last entry, so order matters'
  );

  // Clicking an already-picked verse removes it.
  state = bibleNavigationReducer(state, { type: 'toggleVerse', verse: v(5) });
  assert.deepEqual(
    state.selectedVerses.map((item) => item.verse),
    [2, 9]
  );

  // The same verse object twice never appears twice.
  state = bibleNavigationReducer(state, { type: 'toggleVerse', verse: v(2) });
  state = bibleNavigationReducer(state, { type: 'toggleVerse', verse: v(2) });
  assert.deepEqual(
    state.selectedVerses.map((item) => item.verse),
    [2, 9]
  );
});

test('toggling keeps the verse objects, not just their numbers', async () => {
  const { bibleNavigationReducer, initialBibleNavigation } = await load();

  const state = bibleNavigationReducer(initialBibleNavigation, {
    type: 'toggleVerse',
    verse: { verse: 16, text: 'some text' },
  });
  assert.deepEqual(state.selectedVerses, [{ verse: 16, text: 'some text' }]);
});

test('a malformed verse is ignored rather than stored', async () => {
  const { bibleNavigationReducer, initialBibleNavigation } = await load();

  for (const verse of [null, undefined, {}, { verse: 'three' }, { text: 'no number' }, 7]) {
    const next = bibleNavigationReducer(initialBibleNavigation, { type: 'toggleVerse', verse });
    assert.equal(next, initialBibleNavigation, `${JSON.stringify(verse)} should be ignored`);
  }
});

test('changing chapter clears a selection built by toggling', async () => {
  const { bibleNavigationReducer, initialBibleNavigation } = await load();

  let state = { ...initialBibleNavigation, selectedBook: GENESIS, selectedChapter: 1 };
  state = bibleNavigationReducer(state, { type: 'toggleVerse', verse: { verse: 1, text: 'a' } });
  state = bibleNavigationReducer(state, { type: 'selectChapter', chapter: 2 });
  assert.deepEqual(state.selectedVerses, []);
});
