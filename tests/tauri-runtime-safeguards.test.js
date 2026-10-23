// Guards for two runtime safeguards that cannot be exercised without a live
// Tauri app: they need a real window and a real second process. Both are
// labelled as guards rather than pretending to be behavior tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const { rustContaining } = require('./helpers/rust-sources');

test('the single-instance plugin is registered before every other plugin', () => {
  // The plugin only works when it is registered first; put another plugin
  // ahead of it and a second instance starts anyway, with both processes
  // driving the same projector window and queue file.
  const source = rustContaining('tauri_plugin_single_instance::init');
  assert.ok(source, 'the single-instance plugin should be registered');

  const first = source.indexOf('.plugin(');
  const single = source.indexOf('.plugin(tauri_plugin_single_instance::init');
  assert.equal(single, first, 'single-instance must be the first .plugin() call');
});

test('a second instance surfaces the running window instead of doing nothing', () => {
  const source = rustContaining('tauri_plugin_single_instance::init');
  const start = source.indexOf('tauri_plugin_single_instance::init');
  const callback = source.slice(start, start + 500);

  assert.match(callback, /set_focus\(\)/, 'it should focus the existing window');
  assert.match(callback, /show\(\)/, 'a hidden window should be shown');
});

test('a panic is recorded, and its payload is kept out of the diagnostics file', () => {
  const source = rustContaining('fn install_panic_hook');
  assert.ok(source, 'a panic hook should be installed');
  assert.match(source, /panic::set_hook/);
  assert.match(source, /install_panic_hook\(app\.handle\(\)\.clone\(\)\)/, 'it should be installed at setup');

  // The privacy side is enforced by the compiler, not by this test: record()
  // takes &'static str, so a formatted panic message cannot be passed to it.
  // This only checks that signature has not been widened.
  const diagnostics = rustContaining('pub fn record');
  assert.match(
    diagnostics,
    /pub fn record\(app: &AppHandle, event: &'static str\)/,
    'record() must keep taking &\'static str so dynamic payloads cannot be persisted'
  );
});
