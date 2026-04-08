# ChurchDisplay Pro Code Audit Report (UTF-8 Rebuilt)

> Scope: `D:\AI\presenter`
> Audit date: 2026-04-07
> Baseline version (at audit time): `0.3.33`
> Note: This file is rebuilt in UTF-8 to replace a corrupted mojibake version.

## 1. Project Snapshot

- Stack: Electron + Vite + React 18
- App type: Church worship projection system
- Key modules:
  - `electron/main.js` (main process composition root)
  - `src/components/ControlPanel.jsx` (largest frontend control surface)
  - `src/components/ProjectorView.jsx` (projection rendering)
  - media/bible/songs storage and IPC modules

## 2. Critical Findings

1. Oversized UI component (`ControlPanel.jsx`)
- Too many responsibilities in one component (state orchestration, queue logic, settings, preview control, license modal, editor behavior).
- Recommended split:
  - hooks: `useProjectorQueue`, `useTransitionConfig`, `useLicenseManager`
  - components: top bar, sidebar, queue panel, preview panel, legal modal

2. God-object risk in main process (`electron/main.js`)
- Main file historically mixed lifecycle, window management, IPC registration, media services, bundle import/export, and recovery flows.
- Recommended direction: keep `main.js` as composition root; move assembly details to services.

3. Duplicate/obsolete preload file risk
- Historical duplicate root `preload.js` caused maintenance confusion.
- Keep only Electron preload in `electron/preload.js`.

4. Binary artifact pollution risk
- Large helper binaries (for example temporary yt-dlp executables) should never be tracked.
- Must remain ignored in `.gitignore`.

## 3. Security Findings

1. `delete-media` path traversal risk (historical)
- Deletion must validate target path is under approved media root.
- Use normalized absolute-path check against media root.

2. Media import source validation
- Import should only accept user-approved paths selected from native file dialog.

3. Local media protocol guardrails
- `local-media://` should resolve and enforce whitelist roots using safe path checks.

4. Privacy text exposure
- Avoid exposing private contact strings in window title / public UI text unintentionally.

## 4. Code Quality and Maintainability

1. Encoding corruption in comments/docs/log text
- Some files previously contained mojibake due to mixed encodings.
- Standardize UTF-8 for source/docs/scripts.

2. YouTube parsing duplication
- Similar URL parsing existed in multiple frontend locations.
- Consolidate shared parsing helpers in `src/utils/youtube.js`.

3. Magic numbers
- Timeouts/durations should use named constants.

4. Inline style overuse in large JSX files
- Move repeated style objects to CSS classes or extracted style helpers.

## 5. Performance Risks

1. Excessive rerender pressure in control panel
- Frequent state updates can trigger broad rerenders.
- Split state domains and memoize derived values.

2. Synchronous debug I/O in hot paths
- Debug log writes should avoid blocking critical UI/event loops.

## 6. Testing and Tooling Gaps

- Add baseline automated checks for:
  - queue persistence
  - projection rendering consistency
  - media import/delete safety
  - PPT/PDF flow health
- Keep lint/format/editorconfig consistent across contributors.

## 7. Priority Plan

### P0 (Immediate)
1. Path safety for destructive IPC (`delete-media`).
2. Keep temporary binaries out of repo history and `.gitignore` coverage.
3. Remove duplicate obsolete preload artifacts.

### P1 (High)
4. Continue `main.js` assembly extraction into services.
5. Split `ControlPanel.jsx` into smaller hooks/components.
6. Remove remaining duplicated YouTube logic.
7. Fix visible encoding issues in user-facing strings/docs.

### P2 (Medium)
8. Convert magic numbers to constants.
9. Reduce inline styles in large components.
10. Improve async logging strategy.

### P3 (Long-term)
11. Add integration/e2e test scaffolding.
12. Improve contributor docs and architecture docs.

## 8. Progress Since Audit (Current Branch)

- Main-process decomposition has progressed with multiple new services.
- IPC/media safety checks are in place for key operations.
- Duplicate preload artifact removed from root.
- Ignore rules include temporary binaries/log artifacts.
- Ongoing work: further composition cleanup and UI modularization.
