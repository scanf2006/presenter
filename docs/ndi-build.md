# NDI Build & Package Workflow

## One-command NDI package (recommended)

```bash
npm run electron:build:ndi:unsigned
```

This command will:
1. Prepare `@stagetimerio/grandiose` native binaries for current Electron version.
2. Build renderer (`vite build`).
3. Build installer with `electron-builder`.

## NDI prepare only

```bash
npm run ndi:prepare
```

Use this when you only want to verify/rebuild NDI artifacts.

## Verify packaged NDI runtime files

After `electron-builder` finishes and `dist/win-unpacked` exists:

```bash
npm run ndi:verify:package
```

Or run the full build + verify workflow:

```bash
npm run electron:build:ndi:unsigned:verify
```

## Notes

- The script checks for:
  - `node_modules/@stagetimerio/grandiose`
  - `dist/grandiose.node`
  - `dist/Processing.NDI.Lib.x64.dll`
- If artifacts are missing, it runs `node-gyp` against the Electron headers version from `package.json`.
- On Windows, Python is required for `node-gyp`.

## Packaging config requirement

Both normal build config and lite build config must include:

```json
"asarUnpack": [
  "node_modules/@stagetimerio/grandiose/dist/**"
]
```

Without this, packaged app may fail to load NDI native modules from `app.asar`.
