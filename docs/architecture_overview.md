# ChurchDisplay Pro Architecture Overview

## Runtime Layers

1. `src-tauri/src/lib.rs`
- Tauri command registration and application composition root.
- Delegates persistence helpers to `queue_store.rs`, `setup_store.rs`, and typed projector events to `projector_events.rs`.

2. `src-tauri/src/*`
- Rust command implementations for display/projector control, media, PowerPoint conversion, songs, Bible, setup bundles, queue persistence, and YouTube cache downloads.

3. `src/utils/tauriProjector.js`
- Renderer-side Tauri command boundary. UI code should use this module rather than importing Tauri APIs directly.

4. `src/components/*`
- React control UI + projector view.
- `ControlPanel` is reduced to orchestration and delegates UI blocks to:
  - `src/components/control-panel/TopBar.jsx`
  - `src/components/control-panel/SidebarQueue.jsx`
  - `src/components/control-panel/PreviewPanel.jsx`
  - `src/components/control-panel/ToastOverlay.jsx`

5. `src/hooks/*`
- State/action domains extracted from `ControlPanel`:
- queue, playback, projection settings, video controls, and editor transform.

7. `src/constants/ui.js`
- Shared UI constants for transition limits, scene bounds, text layout/size bounds, preview constants.
- Reduces magic numbers and keeps behavior consistent across hooks/components.

## Data/Persistence

1. Queue persistence
- Tauri commands `queue_save` / `queue_load`
- File: `projector-queue.json` under Tauri app-data storage

2. App settings + license
- JSON settings storage under userData

3. Songs and Bible DB
- SQLite-backed through Tauri commands; development seed content is not shipped in the installer.

4. Setup bundle
- Smart minimal export/import with media reference collection

5. Development seed media
- `data/seed` is used only in development and is excluded from production installers.

## Logging Strategy

1. Background debug log
- Tauri uses `tauri-plugin-log` in debug builds.

2. Goal
- Avoid blocking hot paths with sync log writes while preserving shutdown durability.

## Test Baseline

Run:

```bash
npm test
npm run lint
npm run build
npm run tauri:check
```

Current baseline uses Node built-in `node:test` for zero-dependency CI-friendly checks.
