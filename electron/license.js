const crypto = require('crypto');

const PRODUCT_CODE = 'churchdisplay-pro';

// Public key only. Keep private key offline and use it to sign license payloads.
const LICENSE_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyxfky0sWY27OxCUbZD0C
jgIY//lftKlQRq8D738cGB9cajOSkGnFqUauTk3YM3nk0nSZn68jqhzk7Bf3VupG
Ov2vvuwt9DLG9rM/FumEOG4yWpiH9bcCdUZTXI8Ay+V9+Y1QY72uWcXn2+hFXwWT
E/w0+v4bGv6CDTDrMYVr7oLq9vDBlmtGcKJJejwH3QLUHcfhIGx4vF8VT4pD8uFS
VsY8EZ7Fz+V7xbgPXn4UGtij1LW3XUfkOQOkEZbDoCQUGjpfW1rEn/tdE1Ard7ke
Jh+2X2dqB3B96WTfk8bnmpcqf1T7tU1lzMEHAnTFXkwm9t4gzyOVUUPz0+51kfNN
8wIDAQAB
-----END PUBLIC KEY-----`;

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

function verifyLicenseToken(token, now = new Date()) {
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
  const expiry = license.payload.expiresAt ? `, expires ${license.payload.expiresAt}` : ', lifetime';
  return `${license.payload.holder}${expiry}`;
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
  buildLicenseToken,
};

