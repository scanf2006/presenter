const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

async function loadQueueItemMeta() {
  const moduleUrl = pathToFileURL(path.resolve(__dirname, '../src/utils/queueItemMeta.js')).href;
  return import(moduleUrl);
}

test('resolveSectionForPayload maps payload types to sections', async () => {
  const { resolveSectionForPayload } = await loadQueueItemMeta();

  assert.equal(resolveSectionForPayload({ type: 'text' }), 'text');
  assert.equal(resolveSectionForPayload({ type: 'bible' }), 'bible');
  assert.equal(resolveSectionForPayload({ type: 'song' }), 'songs');
  assert.equal(resolveSectionForPayload({ type: 'lyrics' }), 'songs');
  assert.equal(resolveSectionForPayload({ type: 'pdf' }), 'media');
});

test('getQueueItemTitleFromPayload returns expected fallback titles', async () => {
  const { getQueueItemTitleFromPayload } = await loadQueueItemMeta();

  assert.equal(getQueueItemTitleFromPayload({ type: 'text', text: 'Line 1\nLine 2' }), 'Line 1');
  assert.equal(getQueueItemTitleFromPayload({ type: 'lyrics', text: 'V1 line\nV1 line2' }), 'V1 line');
  assert.equal(getQueueItemTitleFromPayload({ type: 'song', songTitle: 'Amazing Grace' }), 'Amazing Grace');
  assert.equal(getQueueItemTitleFromPayload({ type: 'bible', reference: 'John 3:16' }), 'John 3:16');
  assert.equal(getQueueItemTitleFromPayload({ type: 'video', name: 'clip.mp4' }), 'clip.mp4');
  assert.equal(getQueueItemTitleFromPayload({ type: 'unknown' }), 'unknown');
});

test('queue item classifiers and labels match normalized payload type', async () => {
  const { getQueueTypeLabel, isSongQueueItem, isBibleQueueItem } = await loadQueueItemMeta();

  assert.equal(getQueueTypeLabel({ payload: { type: 'youtube' } }), 'YT');
  assert.equal(getQueueTypeLabel({ payload: { type: 'ppt' } }), 'PPT');
  assert.equal(getQueueTypeLabel({ payload: { type: 'song' } }), 'SONG');
  assert.equal(getQueueTypeLabel({ payload: { type: 'lyrics' } }), 'SONG');
  assert.equal(getQueueTypeLabel({ payload: { type: 'bible' } }), 'BIBLE');

  assert.equal(isSongQueueItem({ payload: { type: 'song' } }), true);
  assert.equal(isSongQueueItem({ payload: { type: 'lyrics' } }), true);
  assert.equal(isSongQueueItem({ payload: { type: 'pdf' } }), false);
  assert.equal(isBibleQueueItem({ payload: { type: 'bible' } }), true);
  assert.equal(isBibleQueueItem({ payload: { type: 'text' } }), false);
});
