const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

async function loadSongMeta() {
  const moduleUrl = pathToFileURL(path.resolve(__dirname, '../src/utils/songMeta.js')).href;
  return import(moduleUrl);
}

test('parseSongLyricsSections supports marker mode', async () => {
  const { parseSongLyricsSections } = await loadSongMeta();
  const lyrics = '[V1]\nLine A\nLine B\n\n[C]\nChorus A';

  const sections = parseSongLyricsSections(lyrics);
  assert.equal(sections.length, 2);
  assert.equal(sections[0].tag, 'V1');
  assert.equal(sections[0].title, 'Verse 1');
  assert.deepEqual(sections[0].lines, ['Line A', 'Line B']);
  assert.equal(sections[1].tag, 'C');
  assert.equal(sections[1].title, 'Chorus');
  assert.deepEqual(sections[1].lines, ['Chorus A']);
});

test('parseSongLyricsSections supports blank-line split mode', async () => {
  const { parseSongLyricsSections } = await loadSongMeta();
  const lyrics = 'A1\nA2\n\nB1\nB2';
  const sections = parseSongLyricsSections(lyrics);

  assert.equal(sections.length, 2);
  assert.equal(sections[0].title, 'Section 1');
  assert.deepEqual(sections[0].lines, ['A1', 'A2']);
  assert.equal(sections[1].title, 'Section 2');
  assert.deepEqual(sections[1].lines, ['B1', 'B2']);
});

test('buildSongBackgroundFromSong and queue payload helpers are consistent', async () => {
  const {
    buildSongBackgroundFromSong,
    buildSongQueuePayload,
    mergeSongWithBackground,
    buildSongSaveInput,
  } = await loadSongMeta();

  const song = {
    id: 7,
    title: 'Test Song',
    author: 'Author',
    lyrics: 'L1\nL2',
    backgroundType: 'image',
    backgroundPath: 'C:/media/bg.jpg',
  };
  const bg = buildSongBackgroundFromSong(song);
  assert.deepEqual(bg, { type: 'image', path: 'C:/media/bg.jpg', name: 'bg.jpg' });

  const payload = buildSongQueuePayload({
    song,
    background: bg,
    section: { tag: 'V1', title: 'Verse 1' },
    sectionIndex: 0,
  });
  assert.equal(payload.songId, 7);
  assert.equal(payload.songTitle, 'Test Song');
  assert.deepEqual(payload.background, { type: 'image', path: 'C:/media/bg.jpg' });
  assert.equal(payload.lastSectionTag, 'V1');

  const merged = mergeSongWithBackground(song, null);
  assert.equal(merged.backgroundType, '');
  assert.equal(merged.backgroundPath, '');

  const saveInput = buildSongSaveInput(merged);
  assert.deepEqual(saveInput, {
    id: 7,
    title: 'Test Song',
    author: 'Author',
    lyrics: 'L1\nL2',
    backgroundType: '',
    backgroundPath: '',
  });
});
