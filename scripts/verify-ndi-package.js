#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const targetDirArg = process.argv[2];
const unpackedRoot = targetDirArg
  ? path.resolve(rootDir, targetDirArg)
  : path.join(rootDir, 'dist', 'win-unpacked');

const expectedFiles = [
  path.join(
    unpackedRoot,
    'resources',
    'app.asar.unpacked',
    'node_modules',
    '@stagetimerio',
    'grandiose',
    'dist',
    'grandiose.node'
  ),
  path.join(
    unpackedRoot,
    'resources',
    'app.asar.unpacked',
    'node_modules',
    '@stagetimerio',
    'grandiose',
    'dist',
    'Processing.NDI.Lib.x64.dll'
  ),
];

function fail(message) {
  console.error(`[NDI Verify] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(unpackedRoot)) {
  fail(`Target unpacked directory does not exist: ${unpackedRoot}`);
}

const missing = expectedFiles.filter((filePath) => !fs.existsSync(filePath));
if (missing.length > 0) {
  console.error('[NDI Verify] Missing files:');
  for (const filePath of missing) {
    console.error(`  - ${filePath}`);
  }
  fail('NDI runtime files are missing from packaged output.');
}

console.log(`[NDI Verify] OK: ${unpackedRoot}`);
for (const filePath of expectedFiles) {
  console.log(`  ✓ ${path.relative(unpackedRoot, filePath)}`);
}
