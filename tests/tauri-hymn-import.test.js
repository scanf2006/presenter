const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('Tauri hymn import keeps a strict christianstudy hymn source boundary', () => {
  const rust = fs.readFileSync(path.join(root, 'src-tauri', 'src', 'hymn_import.rs'), 'utf8');
  const commands = fs.readFileSync(path.join(root, 'src-tauri', 'src', 'lib.rs'), 'utf8');
  const bridge = fs.readFileSync(path.join(root, 'src', 'utils', 'tauriProjector.js'), 'utf8');
  const songs = fs.readFileSync(path.join(root, 'src', 'components', 'SongManager.jsx'), 'utf8');

  assert.match(rust, /HYMN_PREFIX/);
  assert.match(rust, /safe_url/);
  assert.match(commands, /songs_web_site_search/);
  assert.match(bridge, /searchTauriHymns/);
  assert.match(songs, /fetchTauriHymnLyrics/);
});
