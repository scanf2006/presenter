# 0.3.220

- Version: 0.3.220
- Build date: 2026-10-26
- Installer: not yet built

## Highlights

Clears six advisories in the Rust dependency tree — four of them in the TLS
stack — and retunes the audit workflow so it reports what it cannot fix instead
of failing on it.

## Fixed Issues

The Rust audit added in 0.3.217 found seven advisories on its first run, in a
tree of 513 crates that had never been checked. Six had patched releases:

| Crate | From | To | Advisories cleared |
| --- | --- | --- | --- |
| `rustls` | 0.23.45 | 0.23.46 | RUSTSEC-2026-0346, -0347, -0348, -0349 |
| `rustls-webpki` | 0.103.15 | 0.103.16 | RUSTSEC-2026-0382 |
| `webpki-roots` | 1.0.9 | 1.0.11 | RUSTSEC-2026-0381 |

What they were:

- `rustls` **-0346**: the `Debug` impls for client session values printed TLS
  secrets. **-0347**: application data buffered before an ECH rejection was
  sent to the outer server. **-0348**: Brotli certificate decompression could
  allocate up to 1 GiB before authentication. **-0349**: an unauthenticated
  ServerHello could downgrade later connections to classical key exchange.
- `rustls-webpki` **-0382**: certificate verification could accept distrusted
  intermediates.
- `webpki-roots` **-0381**: the bundled root set trusted distrusted emSign
  intermediates.

These were reachable in normal use: the app fetches hymn pages over HTTPS and
downloads the pinned yt-dlp, FFmpeg and Deno assets over HTTPS. The runtime
downloads are additionally verified by SHA-256 against
`scripts/youtube-runtime.lock.json`, so a bad certificate alone would not have
let an altered tool through, but the trust layer should be sound on its own.

## The one advisory left, and why

`rsa` 0.9.10 carries **RUSTSEC-2023-0071** (Marvin attack: key recovery through
timing sidechannels) and has **no patched release** — the fix lands in `rsa`
0.10, still a release candidate.

The audit now excludes this one advisory, and only this one, because:

- It is a timing sidechannel in **private key** operations.
- This app never performs one. `license_store.rs` imports `RsaPublicKey` and
  nothing else, and only verifies a signature. License keys are signed on the
  maintainer's machine, which is not part of the product.

**Revisit when `rsa` 0.10 is stable**, then drop the `--ignore` so the advisory
can block again. The exclusion is written into the workflow step with this
reasoning next to it, and it is narrow: running the audit without the flag still
reports the advisory, so nothing is being globally silenced.

## Stability / Reliability

- **The audit workflow no longer fails on warnings.** Its first version used
  `--deny warnings`, which also failed on the 11 unmaintained and unsound
  warnings in the tree (9 unmaintained, 2 unsound — `zvariant`, `zbus_names`,
  `glib`, `tokio`). Almost all of them sit in Tauri's transitive dependencies
  and cannot be acted on from this repository, so the audit would have been
  permanently red, and a check that is always red is a check nobody reads.
  Warnings are now reported in the log and only vulnerabilities block.

## Breaking Changes

- None. All three updates are semver-compatible patch bumps inside
  `Cargo.lock`; no manifest requirement changed.

## Known Issues

- **The daily audit has still never run.** Scheduled workflows fire only from
  the default branch, and `dependency-audit.yml` was added after the last merge,
  so `master` does not have it. The schedule starts working once this branch is
  merged. Until then the audit only runs on push.
- **`Release Installer` has never run either** (0 runs). It needs one manual
  dispatch to confirm it works.
- 14 Dependabot pull requests are open. `#14` wants `@eslint/js` 10.0.1, the
  version that breaks `npm ci`; the quality gate correctly fails it, and it will
  keep failing until closed. `#1` is a WIP branch from 2026-04-09.
- Unchanged: the installer is unsigned, there is no updater, and the
  single-instance guard, the panic hook and PDF rendering have not been checked
  in a running build.

## Validation Evidence

- `cargo audit`: 7 vulnerabilities before, 1 after — the unpatchable `rsa` one
- The gating command exits 0 with the exclusion, and still reports the advisory
  without it, confirming the exclusion is narrow
- `cargo check`: clean, no warnings
- `cargo clippy -- -D warnings`, `cargo fmt --check`: clean
- `cargo test`: 35 pass
- `npm test`: 62 pass · `npm run test:components`: 16 pass
- `npm run lint`: clean · `npm audit`: clean at high and above
- `npm run -s commercial:gate`: pass
- `dependency-audit.yml` parses as valid YAML; the retuned job has not run on
  GitHub yet.
- Installer not built for this version. The TLS stack change is in the HTTPS
  path, so hymn import and a runtime download are worth exercising in a built
  app.

## Rollback

- Previous version: 0.3.219
- Reverting `src-tauri/Cargo.lock` restores the six advisories. The workflow
  change is independent and can be reverted on its own.
