# 0.3.211

- Version: 0.3.211
- Build date: 2026-10-21
- Installer: `churchdisplay-pro_0.3.211_x64-setup.exe` (zh-CN, x64 NSIS)

## Highlights

Fixes song import from christianstudy hymn pages that previously reported
"no lyrics could be parsed from this page".

## Fixed Issues

- The lyrics extractor matched from `<font size=+2>` to the *first* `</font>`.
  Pages whose lyrics block opens with an empty colour tag (for example
  `c0514.html`) therefore yielded an empty result and the import was rejected
  with the parse-failure warning, even though the page was valid. Pages that
  place a small spacer font between numbered verses were affected the same way.
- The match now runs to the `</font>` that closes the lyrics paragraph, so
  tags nested inside the block no longer truncate it. The previous, narrower
  pattern is kept as a fallback.
- Line breaks written as `<BR>` or `<Br/>` are now recognized alongside `<br>`.

## Stability / Reliability

- Parsing moved into its own `parse_lyrics_page` function with Rust unit tests
  covering a plain page, a block opening with an empty tag, a block with a
  nested spacer font, and uppercase break tags.
- Verified against six live pages (c0001, c0100, c0300, c0513, c0514, c0600):
  all return a non-empty title and lyrics.

## Breaking Changes

- None.

## Known Issues

- Blank lines between verses are still dropped, so stanzas arrive as one block.
  Addressed in 0.3.212.
- Import remains restricted to `christianstudy.com` hymn text pages by design.

## Validation Evidence

- `cargo check`, `cargo test` (32), `cargo fmt --check`: pass
- `npm test` (40), `npm run lint`: pass
- zh-CN x64 NSIS build: pass. Executable file and product versions both read
  0.3.211.
- Installer not executed; import not re-tested from an installed build.

## Rollback

- Previous version: 0.3.210
- Revert `src-tauri/src/hymn_import.rs`. Import of the affected pages fails
  again with the parse-failure warning.
