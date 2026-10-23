# 0.3.217

- Version: 0.3.217
- Build date: 2026-10-23
- Installer: not yet built

## Highlights

Nothing checked the project for vulnerable dependencies except by hand. Now CI
does, on both the npm and the Cargo side, including on days when nobody commits.

## Fixed Issues

- **A high-severity advisory had already appeared since the last check.** `zod`
  below 4.6.6 can exhaust memory while validating oversized collections
  ([GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)).
  It reached the tree through `eslint-plugin-react-hooks`, and it appeared with
  **no change to the dependency tree at all** — 0.3.215 left `npm audit` at zero
  and it was back to one high finding a day later. Updated to 4.6.7.

## Stability / Reliability

- **`npm audit --audit-level=high` runs in the quality gate**, so a change that
  introduces a high or critical advisory is blocked at the pull request.
- **A new `Dependency Audit` workflow runs daily** (07:00 UTC), on demand, and
  whenever a lock file changes. It reports every advisory for the log and fails
  on high or critical. The daily schedule is the point: the zod advisory is
  exactly the case a push-triggered check cannot see.
- **Rust crates are audited for the first time.** There are 513 crates in
  `Cargo.lock` and nothing had ever checked them against the RustSec database.
  The workflow installs `cargo-audit` from crates.io rather than through a
  third-party action, keeping the supply chain for a security check short, and
  caches the binary so it compiles only when the cache is cold.
- **The two locales are now held in parity by a test.** `en` and `zh-CN` had 219
  keys each and were already in perfect parity, but nothing enforced it: a key
  added to one and forgotten in the other shows a raw key or the wrong language
  on screen, and neither the build nor the lint notices.
  `tests/i18n-parity.test.js` checks that the key sets match exactly, that no
  message is blank, that every leaf is a string so nothing renders as an object,
  and that `resolveLocale` maps the tags the app passes it — including `zh`,
  `zh-TW`, and a missing value.

## Breaking Changes

- None.

## Known Issues

- Unchanged: the installer is unsigned and there is no updater; nothing stops a
  second app instance from fighting over the projector; a Rust panic surfaces as
  a silent command failure; there is no component-test tooling, which is what
  holds back splitting the three large components and moving to React 19.
- GitHub still serves the pre-rewrite objects until it garbage-collects, so the
  third-party video content remains reachable by its old SHAs.

## Validation Evidence

- `npm audit`: 0 vulnerabilities, after fixing the zod finding
- `npm test`: 59 pass (was 55)
- `npm run lint`: clean
- `npm run build`: succeeds
- All three workflow files parse as valid YAML
- The new audit workflow has not run on GitHub yet; its first scheduled run is
  the real test of the `cargo-audit` step.
- Installer not built for this version.

## Rollback

- Previous version: 0.3.216
- Reverting removes the audit steps and the parity test. The zod update is in
  `package-lock.json` and should be kept regardless.
