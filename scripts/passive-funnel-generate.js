#!/usr/bin/env node
import path from 'node:path';
import { generatePassiveFunnel } from '../src/passive-funnel.js';

const { options } = parseOptions(process.argv.slice(2));
const outDir = path.resolve(options.out || 'docs');

const result = await generatePassiveFunnel({ outDir });
console.log(`Generated ${result.count} passive funnel pages at ${path.relative(process.cwd(), outDir)}`);

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
