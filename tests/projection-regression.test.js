const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

function read(relPath) {
  return fs.readFileSync(path.resolve(__dirname, '..', relPath), 'utf8');
}

test('SongManager does not manually send projector background', () => {
  const content = read('src/components/SongManager.jsx');
  assert.equal(
    content.includes('sendToProjectorBackground('),
    false,
    'SongManager should rely on unified projector dispatch for background delivery'
  );
});

test('BibleBrowser does not manually send projector background', () => {
  const content = read('src/components/BibleBrowser.jsx');
  assert.equal(
    content.includes('sendToProjectorBackground('),
    false,
    'BibleBrowser should rely on unified projector dispatch for background delivery'
  );
});

test('Unified projector dispatch does not separately send background payloads', () => {
  const content = read('src/hooks/useProjectorPreviewDispatch.js');
  assert.equal(
    content.includes('sendToProjectorBackground('),
    false,
    'Background should travel with the unified projector payload'
  );
});

test('ProjectorView renders PDF content sent from the media selector', () => {
  const content = read('src/components/ProjectorView.jsx');
  assert.equal(content.includes("import PdfRenderer from './PdfRenderer'"), true);
  assert.equal(content.includes("content?.type === 'pdf'"), true);
  assert.equal(content.includes('pageNumber={content.page || 1}'), true);
  assert.equal(content.includes("fitMode={content.fitMode || 'contain'}"), true);
});

test('PreviewStage uses the selected projector display aspect ratio', () => {
  const content = read('src/components/control-panel/preview/PreviewStage.jsx');
  assert.equal(content.includes('aspectRatio: previewAspectRatio || PREVIEW.ASPECT_RATIO_16_9'), true);
  assert.equal(content.includes('previewSlide.name} |'), false);
});

test('YouTube queueing does not wait for cache download', () => {
  const content = read('src/components/MediaManager.jsx');
  const queueIndex = content.indexOf('onAddPlaylist({\n      type: \'youtube\'');
  const cacheIndex = content.indexOf('window.churchDisplay?.youtubeCacheDownload');
  assert.ok(queueIndex >= 0, 'Expected YouTube queue item to be added');
  assert.ok(cacheIndex > queueIndex, 'Expected cache download to start after queue insertion');
});

test('YouTube cache progress is exposed to the media manager', () => {
  const preload = read('electron/preload.js');
  const media = read('src/components/MediaManager.jsx');
  assert.equal(preload.includes('onYouTubeCacheProgress'), true);
  assert.equal(media.includes('youtubeDownload.status'), true);
  assert.equal(media.includes('<progress'), true);
});

test('YouTube cache falls back to yt-dlp when stream resolution finds no format', () => {
  const ipc = read('electron/ipc/youtube.js');
  assert.equal(ipc.includes('const useYtDlpFallback = !resolved?.success || !resolved?.streamUrl'), true);
  assert.equal(ipc.includes("'youtube-download-resolve-fallback-ytdlp-start'"), true);
  assert.equal(ipc.includes('await downloadWithYtDlp(raw, outputPath, (progress) => {'), true);
});
