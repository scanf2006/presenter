# 0.3.210

- Version: 0.3.210
- Build date: 2026-10-21
- Installer: `churchdisplay-pro_0.3.210_x64-setup.exe` (zh-CN, x64 NSIS)

## Highlights

Build fix only. No user-visible behavior changed.

## Fixed Issues

- The zh-CN installer build failed during the frontend step with
  `[vite:html-inline-proxy] ... No matching HTML proxy module found`. Tauri
  invokes the frontend build with the project path spelled `D:\AI\presenter`
  while the folder on disk is `D:\ai\presenter`. Windows treats the two as the
  same folder; Vite's cache for the inline `<style>` block in `index.html` does
  not, so it could not resolve that block's CSS and the build stopped. Running
  `vite build` directly always worked, which is why the failure only appeared
  through `tauri build`.
- `vite.config.js` now pins `root` to the folder's real on-disk spelling
  (`realpathSync.native`), so the spelling the caller passes no longer matters.

## Breaking Changes

- None.

## Known Issues

- None introduced by this release.

## Validation Evidence

- `cargo check`, `cargo test` (28), `cargo fmt --check`: pass
- `npm test` (40), `npm run lint`: pass
- zh-CN x64 NSIS build: pass. Executable file and product versions both read
  0.3.210.
- Installer not executed; no clean-machine smoke install performed.

## Rollback

- Previous version: 0.3.209
- Revert `vite.config.js` to the previous `defineConfig` without `root`. Note
  that the build then fails again unless it is started from the folder's
  lowercase path.
