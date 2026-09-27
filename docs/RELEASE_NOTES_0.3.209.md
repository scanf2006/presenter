# 0.3.209

- Distinguish missing license data from corrupt or unreadable files. Errors now propagate instead of silently resetting authorization or trial state.
- Save licenses through a flushed, same-directory temporary file and atomic replacement. Serialize activation, EULA acceptance, clearing and trial persistence to prevent overlapping writes.
- Keep compatibility with missing fields in legacy Electron settings without accepting malformed values.
- Pin yt-dlp, Deno and FFmpeg downloads in `scripts/youtube-runtime.lock.json`. Validate downloaded archives and installed files with SHA-256; publish only verified staging files.
- Repair corrupt cached tools and missing FFmpeg license text. Bundle the verified FFmpeg license alongside its binary.
- Add offline tests for cache reuse, corrupt data, interrupted downloads, bad checksums, missing archive entries and license restoration.

## Maintenance

When updating a runtime tool, verify the release asset digest against its upstream GitHub release metadata, download and validate that archive, then compute hashes for the exact extracted entries. Update URL, archive hash, entry paths and file hashes together. If a pinned upstream asset is removed, preparation must fail; do not silently fall back to `latest` or accept unverified local files.

## Validation

Local checks passed: 38 frontend/tool tests, 24 Rust tests, lint, production frontend build and Chinese content checks. Real runtime preparation successfully downloaded, verified and replaced the pinned FFmpeg asset; all three bundled tools reported their versions successfully.

The Chinese x64 NSIS build completed successfully. Native executable file and product versions are both 0.3.209; staged installer runtime resources match the lock file. The installer has not been run as part of these checks.

Automated checks do not replace physical acceptance: HDMI disconnect/reconnect, sleep/wake, installed PowerPoint conversion and in-place upgrade with existing user data still require manual testing. Queue restoration behavior is unchanged in this release.
