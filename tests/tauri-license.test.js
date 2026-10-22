// Wiring and boundary guards. The licensing rules themselves (trial
// exhaustion, expiry, device and version binding, legacy migration, atomic
// saves) are covered behaviorally by the Rust tests in license_store.rs; this
// file only guards what those tests cannot see: that the commands are wired to
// the UI, and that no projector command can run without an access check.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const { allRust, rustContaining } = require('./helpers/rust-sources');

test('Tauri exposes the license and EULA command bridge', () => {
  const rust = allRust();

  for (const command of [
    'license_get_status',
    'license_get_device_id',
    'license_activate',
    'license_clear',
    'legal_accept_eula',
    'legal_get_document',
  ]) {
    assert.match(rust, new RegExp(command), `${command} should stay exposed`);
  }
  assert.match(read('src', 'utils', 'tauriProjector.js'), /getTauriLicenseStatus/);
  assert.match(read('src', 'utils', 'tauriProjector.js'), /activateTauriLicense/);
  assert.match(read('src', 'hooks', 'useLicenseActions.js'), /isTauriRuntime/);
});

test('every projector command checks projection access before it runs', () => {
  // The paid boundary: a new projector command that forgets this check would
  // hand out projection for free, and no unit test of license_store would
  // notice, because the command simply never asks it.
  for (const command of [
    'async fn show_projector',
    'fn send_to_projector',
    'fn send_projector_transition',
    'fn send_projector_media_command',
  ]) {
    const source = rustContaining(command);
    const start = source.indexOf(command);
    assert.ok(start >= 0, `${command} should exist`);
    assert.match(
      source.slice(start, start + 360),
      /license_store::ensure_projection_access\(&app\)\?/,
      `${command} should check projection access`
    );
  }
});
