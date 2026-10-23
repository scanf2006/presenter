# Commercial Release Checklist

This checklist is the release gate for production-quality builds.

## 1. Quality Gate (Required)

- Run `npm run -s commercial:gate`
- Confirm:
  - lint passes with no errors
  - test suite passes
  - production build passes

## 2. Projector Stability Validation (Required)

- Verify external display start/stop works across at least:
  - single display
  - dual display extended mode
- Validate emergency projector exit shortcut:
  - `Ctrl+Shift+P` exits kiosk/fullscreen projector mode
- Trigger display topology changes (plug/unplug monitor or USB dock)
  - confirm projector output remains recoverable

## 3. Free Text Consistency (Required)

- Use same payload and validate behavior in:
  - text editor canvas
  - control-panel preview
  - projector output
- Validate at multiple font sizes (`48`, `96`, `180`)
- Confirm no unexpected line-wrap divergence

## 4. Startup Health & Diagnostics (Required)

- Run startup health check in app UI
- Confirm no critical errors
- If warnings exist, record risk + mitigation in release notes

## 5. Packaging & Smoke Install (Required)

- Build target installer package
- Install on clean Windows machine (or VM)
- Smoke test:
  - app launch
  - projector start
  - free text send
  - media send (image/video)
  - startup health check
  - open a PDF (render and thumbnail)

### Code signing (not yet in place)

The installer is currently **unsigned**: `Get-AuthenticodeSignature` on the
built `*-setup.exe` reports `NotSigned`, and `src-tauri/tauri.conf.json` sets no
certificate. Customers therefore see a Windows SmartScreen warning on download
and a publisher of "Unknown" in the UAC prompt, which for paid software reads as
if the download were untrustworthy.

Signing cannot be set up from the repository alone — it needs a certificate that
has to be bought and held somewhere safe. To close this:

1. Obtain an OV or EV code-signing certificate. Since June 2023 the private key
   must live on FIPS-140-2 hardware or in a cloud signing service, so a plain
   `.pfx` on disk is no longer an option for a new certificate.
2. Make it reachable from the build machine (hardware token, or a cloud signing
   service such as Azure Trusted Signing).
3. Point Tauri at it, under `bundle.windows` in `src-tauri/tauri.conf.json`:
   - `certificateThumbprint` for a certificate in the Windows store, or
   - `signCommand` to delegate to the signing service's own CLI.
4. Keep the thumbprint or signing command out of git if it is sensitive; pass it
   through the environment in CI.
5. Verify after building: `Get-AuthenticodeSignature <installer>` must report
   `Valid`, and the publisher name must appear in the UAC prompt.

Until then, record in the release notes that the installer is unsigned, so the
SmartScreen warning is a known and expected part of the customer's first
install rather than a surprise.

## 6. Release Notes (Required)

- Document:
  - user-visible changes
  - fixed defects
  - known issues
  - rollback instructions

## 7. Sign-off

- Engineering sign-off
- QA sign-off
- Product owner sign-off
