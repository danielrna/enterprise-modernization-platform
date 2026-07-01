#!/usr/bin/env node
import path from 'node:path';
import { buildConsultantDemoBundle, generateConsultantDemo } from '../src/consultant-demo.js';

const { options } = parseOptions(process.argv.slice(2));
const benchmarksDir = path.resolve(options.benchmarks || 'docs/benchmarks');
const docsDir = path.resolve(options.docs || 'docs');
const outFile = path.resolve(options.out || 'docs/consultant-demo.html');
const bundle = path.resolve(options.bundle || 'reports/emp-consultant-demo.zip');

const page = await generateConsultantDemo({ benchmarksDir, outFile });
console.log(`Generated consultant demo page with ${page.count} reports at ${path.relative(process.cwd(), outFile)}`);

if (options['skip-bundle']) {
  process.exit(0);
}

const result = await buildConsultantDemoBundle({ docsDir, outFile: bundle });
console.log(`Generated consultant demo bundle at ${path.relative(process.cwd(), result.outFile)}`);

function parseOptions(args) {
  const options = {};
  const positionals = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }
    const [key, inlineValue] = arg.slice(2).split('=', 2);
    const value = inlineValue ?? args[index + 1];
    if (inlineValue === undefined && typeof value === 'string' && !value.startsWith('--')) index += 1;
    options[key] = value === undefined || value.startsWith('--') ? true : value;
  }
  return { options, positionals };
}
