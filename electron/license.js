const crypto = require('crypto');
const os = require('os');
const { execSync } = require('child_process');

const PRODUCT_CODE = 'churchdisplay-pro';
const EULA_PROOF_VERSION = 'v1';
const EULA_PROOF_PEPPER = 'cdp-eula-proof-2026-04';

/**
 * Compare two semver-like version strings (e.g., "1.2.3" vs "1.3.0").
 * Returns: negative if a < b, 0 if equal, positive if a > b.
 */
function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

// Public key only. Keep private key offline and use it to sign license payloads.
const LICENSE_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1KEOk+gkfEDB8PUpJdIw
cWNNgFmKCM3bN8bu/qb552GGDv/NzqrDIJw94B6yS6lcVHplTLS50gjjhnSCHnCm
Hjs+Ml29NZObn1I5AfEKCBw80WIlQJtR790X4zAcG8SSxiWimqgenqIxAyrfzeAD
PTRUzkCgdG0iQ7v3bFYWQLlUzmGhw8Y9e9ghG3ab4o1IKV6V4RD8upJr+ZqJodur
GKdxr0gXYslQVBQvZkGx0AxVmkZ1YDfSUXWJQIMpZ4gSpUB88ZzlYIKqZeucOtOu
CSomk0oMjuiZCFTo6GMdqlHEwHpGCwAwcjrFh0baPawrPSV512UAA5BfHQmEpGXc
ywIDAQAB
-----END PUBLIC KEY-----
`;

function toBase64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, 'base64');
}

function parseLicenseToken(token) {
  if (!token || typeof token !== 'string') {
    return { ok: false, error: 'License key is empty.' };
  }
  const parts = token.trim().split('.');
  if (parts.length !== 3 || parts[0] !== 'CDP1') {
    return { ok: false, error: 'Invalid license key format.' };
  }

  try {
    const payloadRaw = fromBase64Url(parts[1]).toString('utf8');
    const payload = JSON.parse(payloadRaw);
    const signature = fromBase64Url(parts[2]);
    return {
      ok: true,
      payload,
      payloadRaw,
      signature,
      payloadB64: parts[1],
      signatureB64: parts[2],
    };
  } catch (err) {
    return { ok: false, error: `Malformed license key: ${err.message}` };
  }
}

function verifyLicenseToken(token, now = new Date(), appVersion = null, currentDeviceId = null) {
  const parsed = parseLicenseToken(token);
  if (!parsed.ok) {
    return parsed;
  }

  const { payload, payloadB64, signature } = parsed;
  const signedContent = `CDP1.${payloadB64}`;

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(signedContent);
  verifier.end();

  const signatureOk = verifier.verify(LICENSE_PUBLIC_KEY_PEM, signature);
  if (!signatureOk) {
    return { ok: false, error: 'License signature verification failed.' };
  }

  if (payload.product !== PRODUCT_CODE) {
    return { ok: false, error: 'License product mismatch.' };
  }

  if (payload.expiresAt) {
    const expiry = new Date(payload.expiresAt);
    if (Number.isNaN(expiry.getTime())) {
      return { ok: false, error: 'License expiry date is invalid.' };
    }
    if (now > expiry) {
      return { ok: false, error: 'License has expired.' };
    }
  }

  if (payload.deviceId) {
    if (!currentDeviceId || String(payload.deviceId) !== String(currentDeviceId)) {
      return { ok: false, error: 'License is bound to a different device.' };
    }
  }

  // M5: Basic clock-tamper detection �?reject if system time is before the issuedAt date,
  // which would indicate the clock has been set backwards to extend an expired license.
  if (payload.issuedAt) {
    const issued = new Date(payload.issuedAt);
    if (!Number.isNaN(issued.getTime()) && now < issued) {
      return {
        ok: false,
        error: 'System clock appears to be set incorrectly (before license issue date).',
      };
    }
  }

  // H8: Enforce maxVersion �?reject license if app version exceeds the licensed version.
  if (payload.maxVersion && appVersion) {
    if (compareVersions(appVersion, payload.maxVersion) > 0) {
      return {
        ok: false,
        error: `License is valid up to version ${payload.maxVersion}, but current version is ${appVersion}.`,
      };
    }
  }

  return {
    ok: true,
    payload: {
      product: payload.product,
      holder: payload.holder || 'Unknown',
      issuedAt: payload.issuedAt || null,
      expiresAt: payload.expiresAt || null,
      features: Array.isArray(payload.features) ? payload.features : [],
      maxVersion: payload.maxVersion || null,
    },
  };
}

function createReadableLicenseSummary(license) {
  if (!license || !license.payload) {
    return 'Unlicensed';
  }
  const expiry = license.payload.expiresAt
    ? `, expires ${license.payload.expiresAt}`
    : ', lifetime';
  return `${license.payload.holder}${expiry}`;
}

function tryReadWindowsMachineGuid() {
  try {
    const out = execSync(
      'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
      { stdio: ['ignore', 'pipe', 'ignore'] }
    )
      .toString('utf8')
      .trim();
    const m = out.match(/MachineGuid\s+REG_\w+\s+([^\r\n]+)/i);
    return m ? m[1].trim() : '';
  } catch (_err) {
    return '';
  }
}

function getLocalDeviceId() {
  const machineGuid = tryReadWindowsMachineGuid();
  const host = os.hostname() || '';
  const platform = `${os.platform()}-${os.arch()}`;
  const cpus = Array.isArray(os.cpus()) && os.cpus().length > 0 ? os.cpus()[0].model : '';
  const raw = [PRODUCT_CODE, machineGuid, host, platform, cpus].join('|');
  const digest = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 24);
  return `CDPDEV-${digest.toUpperCase()}`;
}


function createEulaAcceptanceProof(acceptedEulaAt, deviceId) {
  if (!acceptedEulaAt || !deviceId) return '';
  return crypto
    .createHash('sha256')
    .update([PRODUCT_CODE, EULA_PROOF_VERSION, String(deviceId), String(acceptedEulaAt), EULA_PROOF_PEPPER].join('|'))
    .digest('hex');
}

// For tooling use only (never ship private key in app):
// token = "CDP1.<base64url(payload json)>.<base64url(signature of 'CDP1.<payloadB64>')>"
function buildLicenseToken(payload, privateKeyPem) {
  const payloadRaw = JSON.stringify({ ...payload, product: PRODUCT_CODE });
  const payloadB64 = toBase64Url(payloadRaw);
  const content = `CDP1.${payloadB64}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(content);
  signer.end();
  const signature = signer.sign(privateKeyPem);
  return `CDP1.${payloadB64}.${toBase64Url(signature)}`;
}

module.exports = {
  PRODUCT_CODE,
  verifyLicenseToken,
  createReadableLicenseSummary,
  getLocalDeviceId,
  createEulaAcceptanceProof,
  buildLicenseToken,
  // L10: buildLicenseToken is for offline tooling only; do not ship in production exports.
  // Use scripts/generate-license.js to create license tokens.
};
