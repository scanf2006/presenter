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
