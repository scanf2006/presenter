# 0.3.216

- Version: 0.3.216
- Build date: 2026-10-23
- Installer: not yet built

## Highlights

Fixes the CI failure introduced by 0.3.215. No app behavior changed.

## Fixed Issues

- **`npm ci` failed in CI with `ERESOLVE`, so every check was skipped.** The
  ESLint 9 migration in 0.3.215 pulled in `@eslint/js@10.0.1`, whose
  `peerOptional` requirement is `eslint@^10.0.0`, against the `eslint@9.39.5`
  the project deliberately stays on. `npm install` tolerates an unmet optional
  peer; `npm ci` does not, so the failure appeared only in CI. `@eslint/js` is
  now pinned to `^9.39.5`, the version `eslint@9.39.5` itself depends on.
- **`engines.node` excluded the machine the project is developed on.** 0.3.215
  declared `>=22 <23` to match CI, but local development runs Node 24, so the
  constraint was wrong the moment it was written — npm only warns about
  `engines` by default, which is why nothing complained. It now reads `>=22`.
  `.nvmrc` still says 22, the version CI uses and the one the suite is verified
  against.

## Stability / Reliability

- Verified the way CI does it rather than the way local development does:
  `node_modules` deleted, then `npm ci` from the lock file. That is the step
  that failed, and `npm install` would not have caught it.

## Breaking Changes

- None.

## Known Issues

- Unchanged from 0.3.215: PDF rendering has not been exercised in the running
  app; the installer is unsigned; `.git` still carries the media history; the
  three large React components are unsplit; song import is restricted to
  `christianstudy.com`; React 19 is held back for lack of component tests.

## Validation Evidence

- `rm -rf node_modules && npm ci`: succeeds
- `npm audit`: 0 vulnerabilities
- `npm run lint`: clean
- `npm test`: 55 pass
- `npm run build`: succeeds
- `npm run -s commercial:gate`: pass
- Installer not built for this version.

## Rollback

- Previous version: 0.3.215
- Reverting this restores the `npm ci` failure, so prefer fixing forward.
