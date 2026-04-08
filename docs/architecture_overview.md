# ChurchDisplay Pro Architecture Overview

## Runtime Layers

1. `electron/main.js`
- Composition root only.
- Wires services, IPC registration, window runtime, startup runtime, and lifecycle runtime.

2. `electron/services/*`
- Single-responsibility modules for:
- Window lifecycle and projector orchestration
- Media protocol/path safety
- Setup bundle import/export
- PPT runtime path resolution
- Download / YouTube fallback
- Logging and startup wiring

3. `electron/ipc/*`
- Feature-focused IPC handlers (`queue`, `setup-bundle`, `youtube`, `projector-events`, etc.).

4. `src/components/*`
- React control UI + projector view.
- `ControlPanel` is reduced to orchestration and delegates UI blocks to:
  - `src/components/control-panel/TopBar.jsx`
  - `src/components/control-panel/SidebarQueue.jsx`
  - `src/components/control-panel/MainContentArea.jsx`
  - `src/components/control-panel/PreviewPanel.jsx`
  - `src/components/control-panel/LegalModal.jsx`
  - `src/components/control-panel/ToastOverlay.jsx`

5. `src/hooks/*`
- State/action domains extracted from `ControlPanel`:
- queue, playback, projection settings, video controls, camera preview, editor transform, etc.

6. `src/constants/ui.js`
- Shared UI constants for transition limits, scene bounds, text layout/size bounds, preview constants.
- Reduces magic numbers and keeps behavior consistent across hooks/components.

## Data/Persistence

1. Queue persistence
- IPC channel `queue-save` / `queue-load`
- File: `projector-queue.json` under `app.getPath('userData')`

2. App settings + license
- JSON settings storage under userData

3. Songs and Bible DB
- SQLite-backed with bootstrap/seed runtime support

4. Setup bundle
- Smart minimal export/import with media reference collection

## Logging Strategy

1. Background debug log
- Service: `electron/services/bg-debug.js`
- Appends structured lines to `bg-debug.log` in userData
- Uses buffered asynchronous queue writes in runtime paths
- On app quit, performs final close flush

2. Goal
- Avoid blocking hot paths with sync log writes while preserving shutdown durability.

## Test Baseline

Run:

```bash
npm test
npm run lint
npm run build
```

Current baseline uses Node built-in `node:test` for zero-dependency CI-friendly checks.
