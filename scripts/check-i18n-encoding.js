#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const target = path.join(process.cwd(), 'src', 'i18n', 'messages.js');
const text = fs.readFileSync(target, 'utf8');

const errors = [];

if (text.includes('\uFFFD') || text.includes('�')) {
  errors.push('messages.js contains replacement character (�), likely encoding corruption.');
}

const zhAnchor = "'zh-CN':";
const zhIdx = text.indexOf(zhAnchor);
if (zhIdx < 0) {
  errors.push("messages.js missing 'zh-CN' locale block.");
} else {
  const zhBlock = text.slice(zhIdx);
  const mustContain = ['主菜单', '授权', '当前状态', '队列', '圣经'];
  for (const token of mustContain) {
    if (!zhBlock.includes(token)) {
      errors.push(`zh-CN locale missing expected token: ${token}`);
    }
  }
}

if (errors.length > 0) {
  console.error('[i18n-check] FAIL');
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}

console.log('[i18n-check] PASS');
