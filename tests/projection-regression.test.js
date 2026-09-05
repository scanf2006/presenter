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

test('Projector scene sync does not directly call sendToProjector', () => {
  const content = read('src/hooks/useProjectorSceneSync.js');
  assert.equal(
    content.includes('window.churchDisplay.sendToProjector('),
    false,
    'Scene sync should use unified resendCurrentSlideToProjector path'
  );
  assert.equal(
    content.includes('resendCurrentSlideToProjector(currentSlide)'),
    true,
    'Scene sync should call resendCurrentSlideToProjector(currentSlide)'
  );
});

test('Unified projector dispatch keeps background dedupe guard', () => {
  const content = read('src/hooks/useProjectorPreviewDispatch.js');
  assert.equal(
    content.includes('lastBackgroundSignatureRef'),
    true,
    'Expected background signature ref dedupe guard'
  );
  assert.equal(
    content.includes('if (nextSig !== lastBackgroundSignatureRef.current)'),
    true,
    'Expected conditional dedupe before sendToProjectorBackground'
  );
});

test('ProjectorView renders PDF content sent from the media selector', () => {
  const content = read('src/components/ProjectorView.jsx');
  assert.equal(content.includes("import PdfRenderer from './PdfRenderer'"), true);
  assert.equal(content.includes("content?.type === 'pdf'"), true);
  assert.equal(content.includes('pageNumber={content.page || 1}'), true);
  assert.equal(content.includes("fitMode={content.fitMode || 'contain'}"), true);
});
