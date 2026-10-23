# 0.3.214

- Version: 0.3.214
- Build date: 2026-10-23
- Installer: not yet built

## Highlights

Re-pins the bundled FFmpeg, which fixes the CI failure introduced from outside
the project when the pinned upstream asset was deleted. No app behavior changed.

## Fixed Issues

- **`npm run runtime:prepare` failed in CI with a 404.** The pinned FFmpeg
  archive, `autobuild-2026-09-27-13-04`, no longer exists upstream. BtbN keeps
  the build published on the last day of each month long-term — month-end tags
  going back two years are still served — but prunes mid-month daily builds
  after roughly two weeks. The old pin was a mid-month daily, so it was pruned
  and every CI run after that failed. Local builds kept working because
  `vendor/youtube-runtime/` already held the verified files and nothing had to
  be downloaded.
- FFmpeg is now pinned to `autobuild-2026-09-30-13-08`, a month-end build, so
  the pin does not expire. Pinning to the newest daily would have failed again
  within a fortnight. The reason is recorded in a `retention` field in
  `scripts/youtube-runtime.lock.json` so the next update does not repeat the
  mistake.
- The pin stays on the same FFmpeg release line, `n8.1.3`, moving from
  `-2-g45e8e0a3ff` to `-9-g29e619e767`. The `N-*` master snapshot and the
  `n9.0.2` build offered in the same release were deliberately not taken.

## Stability / Reliability

- The step that failed is working as designed: when a pinned upstream asset
  disappears, preparation must fail rather than fall back to `latest` or accept
  an unverified local file. The failure was the guard doing its job.
- `npm run lint` and `npm test`, added to CI in 0.3.212, both passed on their
  first run there. The failure was in the pre-existing runtime step only.

## Breaking Changes

- None.

## Known Issues

- Carried over from 0.3.213: `.git` is still about 496 MB; the three large React
  components are unsplit; song import is restricted to `christianstudy.com`.
- The repository is public, so the third-party video content still present in
  git history is publicly downloadable. No credentials were ever committed —
  history contains no key, token or `.env` files, and license verification uses
  an embedded RSA *public* key, with `keys/` ignored from the start.

## Validation Evidence

Following the maintenance procedure in `docs/RELEASE_NOTES_0.3.209.md`:

- Upstream asset digest read from the GitHub release metadata for
  `autobuild-2026-09-30-13-08`:
  `sha256:4a7642b2264c03e8a0ce8a3825b933ee5580656f45695a086fe7e294045ffc0a`.
- Archive downloaded to an isolated directory; its computed SHA-256 matched that
  digest exactly, and its size matched the metadata (170,611,883 bytes).
- Entry hashes computed from that verified archive:
  - `.../bin/ffmpeg.exe` → `3d2e4806d8ab7194705718e5c5b39a86d7b42ba8396c7f5e36f2abe65b7145ab`
  - `.../LICENSE.txt` → `da7eabb7bafdf7d3ae5e9f223aa5bdc1eece45ac569dc21b3b037520b4464768`,
    unchanged from the previous pin, confirming the LGPL text is identical.
- URL, archive hash, entry paths and file hashes updated together.
- `npm run runtime:prepare` run for real: it rejected the stale local
  `ffmpeg.exe`, downloaded, verified, extracted and atomically replaced it,
  reporting "Runtime assets verified." in 44 s.
- Installed files re-hashed on disk: both match. `ffmpeg -version` reports
  `n8.1.3-9-g29e619e767-20260930`, matching the pin.
- `cargo test` (35), `cargo fmt --check`, `npm test` (47), `npm run lint`,
  `npm run -s commercial:gate`: pass.
- Installer not built for this version. YouTube download and merge not exercised
  against the new binary; that needs a real download and is worth checking
  before shipping.

## Rollback

- Previous version: 0.3.213
- Reverting `scripts/youtube-runtime.lock.json` restores the old pin, which
  fails in any environment without a warm `vendor/youtube-runtime/` because the
  asset is gone upstream. A rollback therefore needs a different valid pin, not
  the old one.
