// Boundary guard. The page parsing itself is covered behaviorally by the Rust
// tests in hymn_import.rs; this file only guards the source restriction, which
// keeps the importer from fetching arbitrary URLs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('hymn import stays restricted to christianstudy hymn pages', () => {
  const rust = read('src-tauri', 'src', 'hymn_import.rs');

  assert.match(rust, /HYMN_PREFIX/);
  assert.match(rust, /fn safe_url/);
  // Both entry points have to go through the restriction.
  for (const entry of ['pub fn search', 'pub fn lyrics']) {
    assert.ok(rust.includes(entry), `${entry} should exist`);
  }
  assert.match(rust, /if !safe_url\(&url\)/, 'lyrics should reject a URL outside the allowed host');
  assert.match(read('src-tauri', 'src', 'lib.rs'), /songs_web_site_search/);
  assert.match(read('src', 'utils', 'tauriProjector.js'), /searchTauriHymns/);
  assert.match(read('src', 'components', 'SongManager.jsx'), /fetchTauriHymnLyrics/);
});
