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
- All builds also keep the latest 200 structured diagnostic events in the app log directory. System Info exports a JSON report containing only the app version, allowlisted event names and timestamps; it excludes license data, media paths and URLs.
- Device identity queries run hidden with a five-second timeout per command; only complete successful identities are cached for the process lifetime.
- Incomplete device queries return an unavailable error, preserving stored authorization and the last displayed status. EULA acceptance cannot persist a proof based on a partial identity.
- Download cancellation is tied to a reserved task ID before the worker starts. Windows background processes are assigned kill-on-close jobs; destroying the main window exits the app so hidden windows cannot keep jobs alive.
- Display selection uses the OS monitor name rather than list order (unnamed displays fall back to position). Polling hides output after disconnection and restores the selected display on reconnection or geometry change; manual Stop clears that recovery intent.
- Manual projection and recovery share a serialized controller with request revisions. Old completions cannot publish state after a newer selection or stop, and stale display refreshes cannot override user intent.
- PPT cache reuse requires a completion marker and the exact expected set of nonempty slides. Failed attempts are cleaned before retry; conversions are serialized to avoid sharing partially written output.
- PPT stdout and stderr are drained concurrently throughout conversion, retaining at most 64 KiB per stream for errors. Timeout uses the shared monotonic process deadline.
- Diagnostics use a flushed temporary file and same-directory replacement. Corrupt logs are preserved and export reports the read error instead of silently exporting an empty log.
- YouTube downloads run one at a time with a 30-minute overall deadline and a Cancel action. Partial downloads retain the downloader's temporary suffix and failed final output is removed. PPT timeout handling terminates and reaps the converter process tree.

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
The Windows quality gate also runs Rust formatting, locked compilation and tests on master, codex branch pushes, and pull requests targeting master. Runtime resources are prepared before native compilation.
