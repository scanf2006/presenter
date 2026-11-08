const test = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../src/utils/songWorkspace.js');

// Placeholder text only; nothing here stands in for a real song.
const SONG_A = { id: 1, title: 'Song A', author: 'Author A', lyrics: 'line one\nline two' };
const SONG_B = { id: 2, title: 'Song B', author: '', lyrics: 'other line' };

// ── the editor ──────────────────────────────────────────────────────────────

test('the editor starts closed and empty', async () => {
  const { initialSongEditor, isEditorOpen, isEditingNewSong } = await load();

  assert.deepEqual(initialSongEditor, { song: null, title: '', author: '', lyrics: '' });
  assert.equal(isEditorOpen(initialSongEditor), false);
  assert.equal(isEditingNewSong(initialSongEditor), false);
});

test('opening an existing song fills the form from it', async () => {
  const { songEditorReducer, initialSongEditor, isEditorOpen, isEditingNewSong } = await load();
  const next = songEditorReducer(initialSongEditor, { type: 'openExisting', song: SONG_A });

  assert.equal(next.song, SONG_A);
  assert.equal(next.title, 'Song A');
  assert.equal(next.author, 'Author A');
  assert.equal(next.lyrics, 'line one\nline two');
  assert.equal(isEditorOpen(next), true);
  assert.equal(isEditingNewSong(next), false);
});

test('a song with no author opens with an empty author rather than undefined', async () => {
  const { songEditorReducer, initialSongEditor } = await load();
  const next = songEditorReducer(initialSongEditor, { type: 'openExisting', song: SONG_B });

  assert.equal(next.author, '', 'an undefined author must not reach a controlled input');
  assert.equal(next.title, 'Song B');
});

test('opening a new song clears the form and takes the starter text', async () => {
  const { songEditorReducer, isEditingNewSong } = await load();
  const editingA = songEditorReducer(undefined, { type: 'openExisting', song: SONG_A });
  const next = songEditorReducer(editingA, { type: 'openNew', lyrics: 'starter text' });

  assert.deepEqual(next.song, { id: null });
  assert.equal(next.title, '', "the previous song's title must not carry over");
  assert.equal(next.author, '');
  assert.equal(next.lyrics, 'starter text');
  assert.equal(isEditingNewSong(next), true);
});

test('an imported song opens as new with its fetched text', async () => {
  const { songEditorReducer, initialSongEditor, isEditingNewSong } = await load();
  const next = songEditorReducer(initialSongEditor, {
    type: 'openImported',
    title: 'Fetched Title',
    lyrics: 'fetched line',
  });

  assert.deepEqual(next.song, { id: null });
  assert.equal(next.title, 'Fetched Title');
  assert.equal(next.author, '');
  assert.equal(next.lyrics, 'fetched line');
  assert.equal(isEditingNewSong(next), true);
});

test('closing the editor drops the text as well as the subject', async () => {
  // This is the gap: setEditingSong(null) on its own left all three fields
  // populated, so every entry point had to overwrite them.
  const { songEditorReducer, initialSongEditor, isEditorOpen } = await load();
  const editing = songEditorReducer(initialSongEditor, { type: 'openExisting', song: SONG_A });
  const closed = songEditorReducer(editing, { type: 'close' });

  assert.deepEqual(closed, initialSongEditor);
  assert.equal(isEditorOpen(closed), false);
});

test('typing updates one field and leaves the others alone', async () => {
  const { songEditorReducer, initialSongEditor } = await load();
  let state = songEditorReducer(initialSongEditor, { type: 'openExisting', song: SONG_A });

  state = songEditorReducer(state, { type: 'setField', field: 'title', value: 'Renamed' });
  assert.equal(state.title, 'Renamed');
  assert.equal(state.author, 'Author A');
  assert.equal(state.lyrics, 'line one\nline two');
  assert.equal(state.song, SONG_A, 'the subject does not change while typing');

  state = songEditorReducer(state, { type: 'setField', field: 'lyrics', value: 'rewritten' });
  assert.equal(state.lyrics, 'rewritten');
  assert.equal(state.title, 'Renamed');
});

test('a null or undefined field value becomes an empty string', async () => {
  const { songEditorReducer, initialSongEditor } = await load();
  let state = songEditorReducer(initialSongEditor, { type: 'openExisting', song: SONG_A });

  state = songEditorReducer(state, { type: 'setField', field: 'author', value: null });
  assert.equal(state.author, '', 'a controlled input must never receive null');
});

test('an unknown field is ignored rather than added to the state', async () => {
  const { songEditorReducer, initialSongEditor } = await load();
  const next = songEditorReducer(initialSongEditor, {
    type: 'setField',
    field: 'somethingElse',
    value: 'x',
  });
  assert.equal(next, initialSongEditor);
});

test('editor no-ops return the identical object', async () => {
  const { songEditorReducer, initialSongEditor } = await load();
  const editing = songEditorReducer(initialSongEditor, { type: 'openExisting', song: SONG_A });

  assert.equal(songEditorReducer(initialSongEditor, { type: 'close' }), initialSongEditor);
  assert.equal(songEditorReducer(editing, { type: 'openExisting', song: null }), editing);
  assert.equal(
    songEditorReducer(editing, { type: 'setField', field: 'title', value: 'Song A' }),
    editing
  );
  assert.equal(songEditorReducer(editing, { type: 'nope' }), editing);
  assert.equal(songEditorReducer(editing, null), editing);
});

// ── the selection ───────────────────────────────────────────────────────────

test('nothing is selected to begin with', async () => {
  const { initialSongSelection, NO_SECTION } = await load();

  assert.equal(initialSongSelection.song, null);
  assert.equal(initialSongSelection.sectionIndex, NO_SECTION);
});

test('opening a different song starts with no section chosen', async () => {
  // A section number only means something inside the song it came from, and
  // the next song may be shorter.
  const { songSelectionReducer, initialSongSelection, NO_SECTION } = await load();
  let state = songSelectionReducer(initialSongSelection, { type: 'selectSong', song: SONG_A });
  state = songSelectionReducer(state, { type: 'selectSection', index: 4 });
  assert.equal(state.sectionIndex, 4);

  state = songSelectionReducer(state, { type: 'selectSong', song: SONG_B });
  assert.equal(state.song, SONG_B);
  assert.equal(state.sectionIndex, NO_SECTION, 'section 4 may not exist in the new song');
});

test('the same song with new data keeps the section the reader is on', async () => {
  const { songSelectionReducer, initialSongSelection } = await load();
  let state = songSelectionReducer(initialSongSelection, { type: 'selectSong', song: SONG_A });
  state = songSelectionReducer(state, { type: 'selectSection', index: 2 });

  // Saving a style or background re-emits the same song.
  const restyled = { ...SONG_A, songStyle: { fontSizePx: 80 } };
  const next = songSelectionReducer(state, { type: 'updateSong', song: restyled });
  assert.equal(next.song, restyled);
  assert.equal(next.sectionIndex, 2, 'the reader is still looking at this section');
});

test('a different song arriving as an update is treated as a selection', async () => {
  const { songSelectionReducer, initialSongSelection, NO_SECTION } = await load();
  let state = songSelectionReducer(initialSongSelection, { type: 'selectSong', song: SONG_A });
  state = songSelectionReducer(state, { type: 'selectSection', index: 3 });

  const next = songSelectionReducer(state, { type: 'updateSong', song: SONG_B });
  assert.equal(next.song, SONG_B);
  assert.equal(next.sectionIndex, NO_SECTION, 'it must not inherit the other song index');
});

test('clearing the selection clears the section with it', async () => {
  // The gap: setSelectedSong(null) on its own left the section index behind.
  const { songSelectionReducer, initialSongSelection } = await load();
  let state = songSelectionReducer(initialSongSelection, { type: 'selectSong', song: SONG_A });
  state = songSelectionReducer(state, { type: 'selectSection', index: 1 });

  assert.deepEqual(songSelectionReducer(state, { type: 'clearSong' }), initialSongSelection);
});

test('deleting the song on screen clears the selection, other songs do not', async () => {
  const { songSelectionReducer, initialSongSelection } = await load();
  let state = songSelectionReducer(initialSongSelection, { type: 'selectSong', song: SONG_A });
  state = songSelectionReducer(state, { type: 'selectSection', index: 1 });

  // Deleting a different song leaves the screen alone.
  assert.equal(songSelectionReducer(state, { type: 'songRemoved', songId: 99 }), state);
  // Deleting the one being shown clears it, index included.
  assert.deepEqual(
    songSelectionReducer(state, { type: 'songRemoved', songId: SONG_A.id }),
    initialSongSelection
  );
});

test('the blank card is a valid section, and anything below it is not', async () => {
  const { songSelectionReducer, initialSongSelection, BLANK_SECTION, NO_SECTION } = await load();
  const state = songSelectionReducer(initialSongSelection, { type: 'selectSong', song: SONG_A });

  assert.equal(
    songSelectionReducer(state, { type: 'selectSection', index: BLANK_SECTION }).sectionIndex,
    BLANK_SECTION
  );
  assert.equal(
    songSelectionReducer(state, { type: 'selectSection', index: NO_SECTION }).sectionIndex,
    NO_SECTION
  );
  // Below the blank sentinel is not a thing.
  assert.equal(songSelectionReducer(state, { type: 'selectSection', index: -3 }), state);
});

test('a non-integer section index is ignored rather than stored', async () => {
  const { songSelectionReducer, initialSongSelection } = await load();
  const state = songSelectionReducer(initialSongSelection, { type: 'selectSong', song: SONG_A });

  for (const index of [null, undefined, '2', 1.5, NaN, {}]) {
    assert.equal(
      songSelectionReducer(state, { type: 'selectSection', index }),
      state,
      `${JSON.stringify(index)} should be ignored`
    );
  }
});

test('selection no-ops return the identical object', async () => {
  const { songSelectionReducer, initialSongSelection } = await load();
  const state = songSelectionReducer(initialSongSelection, { type: 'selectSong', song: SONG_A });

  assert.equal(songSelectionReducer(initialSongSelection, { type: 'clearSong' }), initialSongSelection);
  assert.equal(songSelectionReducer(state, { type: 'selectSong', song: null }), state);
  assert.equal(songSelectionReducer(state, { type: 'updateSong', song: null }), state);
  assert.equal(songSelectionReducer(state, { type: 'selectSection', index: state.sectionIndex }), state);
  assert.equal(songSelectionReducer(state, { type: 'nope' }), state);
  assert.equal(songSelectionReducer(state, null), state);
});
