#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { buildLicenseToken } = require('../electron/license');

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

const payload = {
  holder: args.holder,
  issuedAt: new Date().toISOString(),
  expiresAt: args.expiresAt || null,
  maxVersion: args.maxVersion || null,
  features: args.features ? args.features.split(',').map((x) => x.trim()).filter(Boolean) : [],
};

const token = buildLicenseToken(payload, privateKeyPem);
console.log(token);
