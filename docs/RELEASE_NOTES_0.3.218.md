# 0.3.218

- Version: 0.3.218
- Build date: 2026-10-23
- Installer: not yet built

## Highlights

Two live-use safeguards the app did not have: a second instance can no longer
start, and a Rust panic is no longer invisible.

## Fixed Issues

- **Two instances could run at once.** Nothing prevented it, and double-clicking
  the icon twice was enough. Both processes would then drive the same external
  display, the same projector window and the same queue file — during a service.
  The `single-instance` plugin is now registered, and it must be the first
  plugin registered to work, which a guard test checks.
- **A second launch now surfaces the running window** rather than appearing to
  do nothing: it is unminimized, shown and focused. Without that, clicking the
  icon when the app is already open behind another window looks like a failure
  to start.
- **A Rust panic left nothing behind.** There was no panic hook, so a panic
  reached the UI as a bare command failure and was gone — nothing in the
  diagnostics log, nothing to look at afterwards. `install_panic_hook` now
  records the event and logs the message and location.

## Stability / Reliability

- The panic hook keeps the panic payload out of the diagnostics file. That file
  is exportable and holds fixed event names and timestamps by design, while a
  panic message can carry file paths or user content, so the message goes to the
  log and only the event name is recorded. This is enforced by the compiler, not
  by a convention: `diagnostics::record` takes `&'static str`, so a formatted
  message cannot be passed to it. A guard test checks that signature is not
  widened later.
- The hook chains the previous hook rather than replacing it, so the default
  stderr output still appears.
- `second_instance_blocked` is recorded as a diagnostic event, so a report from
  the field can show whether someone had been launching the app repeatedly.

## Breaking Changes

- None, though the behavior change is deliberate: launching the app while it is
  already running now focuses the existing window instead of starting a second
  copy.

## Known Issues

- **Neither safeguard has been exercised in a running build.** Both need a real
  app: one needs a second process, the other a genuine panic. The guard tests
  only check the wiring. Launching the installed app twice is the check worth
  doing.
- Unchanged: the installer is unsigned and there is no updater; there is still
  no component-test tooling, which holds back splitting the three large
  components and moving to React 19. GitHub still serves the pre-rewrite
  objects.

## Validation Evidence

- `cargo check`: clean, no warnings
- `cargo clippy -- -D warnings`: clean
- `cargo test` (35), `cargo fmt --check`: pass
- `npm test`: 62 pass (was 59)
- `npm run lint`: clean
- Installer not built for this version; see Known Issues for what that leaves
  unverified.

## Rollback

- Previous version: 0.3.217
- Reverting removes both safeguards and the `tauri-plugin-single-instance`
  dependency. They are independent of each other.
