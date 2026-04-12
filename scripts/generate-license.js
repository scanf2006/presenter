#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PRODUCT_CODE = 'churchdisplay-pro';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

const args = parseArgs(process.argv);

function toBase64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

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

function toIsoAfterDays(days) {
  const n = Number(days);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();
}

if (args.help || args.h || args['?']) {
  console.log(
    [
      'Usage:',
      '  node scripts/generate-license.js --holder "<name>" --privateKey "<pemPath>" [options]',
      '',
      'Options:',
      '  --holder <name>          Required. License holder name.',
      '  --privateKey <path>      Private key PEM path (or use LICENSE_PRIVATE_KEY_PEM env).',
      '  --expiresAt <isoDate>    Optional. Expiry date, e.g. 2027-12-31T23:59:59Z.',
      '  --days <number>          Optional. Expiry after N days (ignored if --expiresAt is provided).',
      '  --maxVersion <semver>    Optional. Max app version, e.g. 0.3.200.',
      '  --features <csv>         Optional. Comma-separated features.',
      '  --deviceId <id>          Optional. Bind license to a specific device ID.',
      '  --help                   Show this help.',
    ].join('\n')
  );
  process.exit(0);
}

if (!args.holder) {
  console.error('Missing --holder');
  process.exit(1);
}

const privateKeyPath = args.privateKey || process.env.LICENSE_PRIVATE_KEY_PATH;
const privateKeyInline = process.env.LICENSE_PRIVATE_KEY_PEM;
if (!privateKeyPath && !privateKeyInline) {
  console.error('Provide --privateKey <pemPath> or LICENSE_PRIVATE_KEY_PEM env.');
  process.exit(1);
}

const privateKeyPem = privateKeyInline
  ? privateKeyInline
  : fs.readFileSync(path.resolve(privateKeyPath), 'utf8');
const expiresAt = args.expiresAt || toIsoAfterDays(args.days) || null;

const payload = {
  holder: args.holder,
  issuedAt: new Date().toISOString(),
  expiresAt,
  maxVersion: args.maxVersion || null,
  deviceId: args.deviceId || null,
  features: args.features ? args.features.split(',').map((x) => x.trim()).filter(Boolean) : [],
};

const token = buildLicenseToken(payload, privateKeyPem);
console.log(token);

const template = [
  'node scripts/generate-license.js',
  `--holder "${args.holder}"`,
  args.deviceId ? `--deviceId "${args.deviceId}"` : '--deviceId "CDPDEV-XXXXXXXXXXXXXXX"',
  expiresAt ? `--expiresAt "${expiresAt}"` : '',
  args.maxVersion ? `--maxVersion "${args.maxVersion}"` : '',
  args.features ? `--features "${args.features}"` : '',
  `--privateKey "${privateKeyPath || 'D:\\\\path\\\\to\\\\private.pem'}"`,
]
  .filter(Boolean)
  .join(' ');

console.error('[License Generator] Summary');
console.error(`  holder: ${args.holder}`);
console.error(`  deviceId: ${args.deviceId || '(not bound)'}`);
console.error(`  expiresAt: ${expiresAt || '(lifetime)'}`);
console.error(`  maxVersion: ${args.maxVersion || '(none)'}`);
console.error(`  features: ${args.features || '(none)'}`);
console.error('  template:');
console.error(`  ${template}`);
