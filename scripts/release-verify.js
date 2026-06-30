#!/usr/bin/env node
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';

const REPORT_HTML = 'reports/release-readiness/index.html';
const REPORT_JSON = 'reports/release-readiness/report.json';

const steps = [
  {
    name: 'local syntax and tests',
    command: 'npm',
    args: ['run', 'check']
  },
  {
    name: 'Docker image build',
    command: 'docker',
    args: ['build', '-t', 'emp-cli', '.']
  },
  {
    name: 'Docker readiness report',
    command: 'docker',
    args: ['run', '--rm', '-v', `${process.cwd()}:/workspace`, 'emp-cli', 'analyze', '.', '--pack', 'spring-boot-3-readiness', '--out', 'reports/release-readiness']
  },
  {
    name: 'Docker image test suite',
    command: 'docker',
    args: ['run', '--rm', '--entrypoint', 'npm', '-w', '/app', 'emp-cli', 'run', 'check']
  }
];

for (const step of steps) {
  await run(step);
}

await assertReport();
console.log('Release verification passed.');

async function run({ name, command, args }) {
  console.log(`\n==> ${name}`);
  console.log(`${command} ${args.join(' ')}`);
  const exitCode = await new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('close', resolve);
  });
  if (exitCode !== 0) {
    throw new Error(`${name} failed with exit code ${exitCode}`);
  }
}

async function assertReport() {
  const html = await fs.readFile(REPORT_HTML, 'utf8');
  const report = JSON.parse(await fs.readFile(REPORT_JSON, 'utf8'));
  assertIncludes(html, 'Readiness Report', REPORT_HTML);
  assertIncludes(html, 'Evidence', REPORT_HTML);
  assertIncludes(html, 'Finding Summary', REPORT_HTML);
  if (report.schemaVersion !== 'emp.report.v1') {
    throw new Error(`${REPORT_JSON} has unexpected schemaVersion: ${report.schemaVersion}`);
  }
  if (report.pack !== 'spring-boot-3-readiness') {
    throw new Error(`${REPORT_JSON} has unexpected pack: ${report.pack}`);
  }
}

function assertIncludes(content, expected, file) {
  if (!content.includes(expected)) {
    throw new Error(`${file} does not include ${expected}`);
  }
}
