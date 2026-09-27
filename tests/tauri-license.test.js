const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('Tauri exposes the license and EULA command bridge', () => {
  const rust = fs.readFileSync(path.join(root, 'src-tauri', 'src', 'lib.rs'), 'utf8');
  const bridge = fs.readFileSync(path.join(root, 'src', 'utils', 'tauriProjector.js'), 'utf8');
  const actions = fs.readFileSync(path.join(root, 'src', 'hooks', 'useLicenseActions.js'), 'utf8');

  for (const command of [
    'license_get_status', 'license_get_device_id', 'license_activate',
    'license_clear', 'legal_accept_eula', 'legal_get_document',
  ]) assert.match(rust, new RegExp(command));
  assert.match(bridge, /getTauriLicenseStatus/);
  assert.match(bridge, /activateTauriLicense/);
  assert.match(actions, /isTauriRuntime/);
});

test('Tauri enforces the persisted one-hour trial in projector commands', () => {
  const rust = fs.readFileSync(path.join(root, 'src-tauri', 'src', 'license_store.rs'), 'utf8');
  const commands = fs.readFileSync(path.join(root, 'src-tauri', 'src', 'lib.rs'), 'utf8');

  assert.match(rust, /const TRIAL_DURATION_MS: u64 = 60 \* 60 \* 1000/);
  assert.match(rust, /trialConsumedMs/);
  assert.match(rust, /Instant::now\(\)/);
  assert.match(rust, /pub fn ensure_projection_access/);
  assert.match(rust, /load_with_legacy_migration/);
  assert.match(rust, /app-settings\.json/);
  assert.match(rust, /Get-CimInstance Win32_Processor/);
  assert.match(rust, /command\.creation_flags\(0x08000000\)/);
  for (const command of [
    'async fn show_projector', 'fn send_to_projector',
    'fn send_projector_transition', 'fn send_projector_media_command',
  ]) {
    const start = commands.indexOf(command);
    assert.ok(start >= 0, `${command} command should exist`);
    assert.match(commands.slice(start, start + 360), /license_store::ensure_projection_access\(&app\)\?/);
  }
});
