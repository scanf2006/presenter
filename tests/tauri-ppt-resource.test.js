const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const { rustContaining } = require('./helpers/rust-sources');

test('Tauri owns and bundles its PPT conversion script', () => {
  const script = path.join(root, 'src-tauri', 'scripts', 'ppt-convert.ps1');
  const config = fs.readFileSync(path.join(root, 'src-tauri', 'tauri.conf.json'), 'utf8');
  const rust = rustContaining('fn ppt_script_path');

  assert.equal(fs.existsSync(script), true);
  assert.match(config, /"scripts\/ppt-convert\.ps1": "ppt-convert\.ps1"/);
  assert.doesNotMatch(config, /\.\.\/electron\/ppt-convert\.ps1/);
  const start = rust.indexOf('fn ppt_script_path');
  assert.ok(start >= 0);
  assert.match(rust.slice(start, start + 700), /\.join\("scripts"\)/);
  assert.doesNotMatch(rust.slice(start, start + 700), /\.join\("electron"\)/);
});
