# Copyright Protection Checklist (ChurchDisplay Pro)

## Already implemented in code

- Proprietary license file: `LICENSE`
- EULA text: `EULA.md`
- In-app "Copyright & License" panel for:
  - viewing license status
  - entering activation key
  - clearing key
  - recording EULA acceptance
- Signed offline license verification in Electron main process
  - format: `CDP1.<payload>.<signature>`
  - algorithm: `RSA-SHA256`
  - public key is embedded in app
  - private key must stay offline
- App settings persistence under `userData/app-settings.json`

## How to issue a license key

1. Keep private key in a secure location, never in this repo.
2. Run:

```bash
npm run license:generate -- --holder "Toronto Living Stone Church" --expiresAt "2027-12-31T23:59:59.000Z" --privateKey "C:\\keys\\cdp-private.pem"
```

3. Send generated key to the customer for activation.

## Recommended release hardening

- Sign Windows installers with EV code-signing certificate.
- Disable renderer devtools in packaged builds.
- Keep key issuance service-side (do not ship private key).
- Add server-side activation logs and key revocation list.
- Add anti-tamper checks (hash integrity checks for core files).
