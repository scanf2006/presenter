#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const distAssetsDir = path.join(process.cwd(), 'dist', 'assets');

if (!fs.existsSync(distAssetsDir)) {
  console.error('[zh-build-check] FAIL');
  console.error('- dist/assets not found. Run build first.');
  process.exit(1);
}

const jsFiles = fs
  .readdirSync(distAssetsDir)
  .filter((f) => /^index-.*\.js$/.test(f))
  .sort();

if (jsFiles.length === 0) {
  console.error('[zh-build-check] FAIL');
  console.error('- No built index-*.js asset found in dist/assets.');
  process.exit(1);
}

const latest = jsFiles[jsFiles.length - 1];
const content = fs.readFileSync(path.join(distAssetsDir, latest), 'utf8');
const required = ['主菜单', '授权', '当前状态'];
const missing = required.filter((t) => !content.includes(t));

if (missing.length > 0) {
  console.error('[zh-build-check] FAIL');
  console.error(`- Built artifact ${latest} is missing tokens: ${missing.join(', ')}`);
  process.exit(1);
}

console.log(`[zh-build-check] PASS (${latest})`);
