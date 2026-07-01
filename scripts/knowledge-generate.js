#!/usr/bin/env node
import path from 'node:path';
import { generateKnowledgeBase } from '../src/knowledge-base.js';

const { options } = parseOptions(process.argv.slice(2));
const knowledgeDir = path.resolve(options.knowledge || 'knowledge');
const outDir = path.resolve(options.out || 'docs/knowledge-base');

const result = await generateKnowledgeBase({ knowledgeDir, outDir });
console.log(`Generated ${result.count} Knowledge Base article(s) at ${path.relative(process.cwd(), outDir)}`);

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
