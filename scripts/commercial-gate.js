#!/usr/bin/env node
const { spawnSync } = require('node:child_process');

const STEPS = [
  { name: 'lint', npmArgs: ['run', '-s', 'lint'] },
  { name: 'test', npmArgs: ['run', '-s', 'test'] },
  { name: 'build', npmArgs: ['run', '-s', 'build'] },
];

function runStep(step) {
  const invocation =
    process.platform === 'win32'
      ? {
          cmd: process.env.ComSpec || 'cmd.exe',
          args: ['/d', '/s', '/c', `npm ${step.npmArgs.join(' ')}`],
        }
      : {
          cmd: 'npm',
          args: step.npmArgs,
        };
  const result = spawnSync(invocation.cmd, invocation.args, {
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) {
    console.error(`[CommercialGate] ${step.name} failed:`, result.error.message);
    return false;
  }
  if (result.status !== 0) {
    console.error(`[CommercialGate] ${step.name} exited with code ${result.status}`);
    return false;
  }
  return true;
}

function main() {
  const startedAt = Date.now();
  for (const step of STEPS) {
    console.log(`\n[CommercialGate] running ${step.name}...`);
    const ok = runStep(step);
    if (!ok) process.exit(1);
  }
  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n[CommercialGate] PASS in ${elapsedSec}s`);
}

main();
