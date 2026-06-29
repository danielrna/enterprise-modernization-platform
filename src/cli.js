import fs from 'node:fs/promises';
import path from 'node:path';
import { analyzeProject } from './scanner.js';
import { scoreReadiness } from './readiness.js';
import { writeReportBundle } from './report.js';
import { BENCHMARKS, publishBenchmarks } from './benchmarks.js';
import { generateMigrationHub } from './hub.js';
import { transformProject } from './transform.js';
import { loadEnterpriseRules, evaluateEnterpriseRules } from './rules.js';
import { runMcpServer } from './mcp.js';

const VERSION = '0.1.0';

export async function runCli(argv) {
  const [command, ...rest] = argv;

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  if (command === '--version' || command === '-v') {
    console.log(VERSION);
    return;
  }

  if (rest.includes('--help') || rest.includes('-h')) {
    printHelp();
    return;
  }

  if (command === 'analyze') {
    await analyzeCommand(rest);
    return;
  }

  if (command === 'benchmarks') {
    const { options } = parseOptions(rest);
    const outDir = path.resolve(options.out || 'docs/benchmarks');
    const result = await publishBenchmarks({
      outDir,
      source: options.source || 'catalog',
      only: options.only || null,
      limit: options.limit || null,
      reposDir: options['repos-dir'] || 'benchmark-repos'
    });
    console.log(`Generated ${result.count} ${result.source} benchmark reports at ${path.relative(process.cwd(), outDir)}`);
    return;
  }

  if (command === 'transform') {
    await transformCommand(rest);
    return;
  }

  if (command === 'hub') {
    const { options } = parseOptions(rest);
    const outDir = path.resolve(options.out || 'docs/migration-hub');
    await generateMigrationHub({ outDir, benchmarks: BENCHMARKS });
    console.log(`Generated Migration Hub at ${path.relative(process.cwd(), outDir)}`);
    return;
  }

  if (command === 'mcp') {
    await runMcpServer();
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

async function analyzeCommand(args) {
  const parsed = parseOptions(args);
  const target = parsed.positionals[0] || '.';
  const options = parsed.options;
  const root = path.resolve(target);
  const outDir = path.resolve(options.out || 'reports/latest');
  const pack = options.pack || 'spring-boot-3-readiness';
  const rulesPath = options.rules || null;

  await assertDirectory(root);
  const scan = await analyzeProject({ root, pack });
  const rules = await evaluateEnterpriseRules({ root, scan, rules: await loadEnterpriseRules(root, rulesPath) });
  const readiness = scoreReadiness(scan, rules);
  const bundle = await writeReportBundle({ outDir, scan, readiness, rules });

  console.log(`Analyzed ${scan.project.name}`);
  console.log(`Pack applicable: ${scan.packApplicability.applicable ? 'yes' : 'no'}`);
  console.log(`Overall readiness: ${readiness.overall === null ? 'N/A' : `${readiness.overall}%`}`);
  if (rules.loaded) console.log(`Enterprise rule violations: ${rules.violations.length}`);
  console.log(`Report: ${path.relative(process.cwd(), bundle.htmlPath)}`);
  console.log(`JSON: ${path.relative(process.cwd(), bundle.jsonPath)}`);
}

async function transformCommand(args) {
  const parsed = parseOptions(args);
  const target = parsed.positionals[0] || '.';
  const options = parsed.options;
  const root = path.resolve(target);
  const outDir = path.resolve(options.out || 'reports/transform');
  const pack = options.pack || 'spring-boot-3-readiness';
  const mode = options.mode || 'dry-run';
  const validate = Boolean(options.validate);
  const engine = options.engine || 'native';
  const recipe = options.recipe || undefined;
  const recipeArtifact = options['recipe-artifact'] || undefined;
  const rulesPath = options.rules || null;

  await assertDirectory(root);
  const transformation = await transformProject({ root, pack, mode, validate, engine, recipe, recipeArtifact });
  const scan = await analyzeProject({ root, pack });
  const rules = await evaluateEnterpriseRules({ root, scan, rules: await loadEnterpriseRules(root, rulesPath) });
  const readiness = scoreReadiness(scan, rules);
  const bundle = await writeReportBundle({ outDir, scan, readiness, transformation, rules });

  console.log(`Transform mode: ${transformation.mode}`);
  console.log(`Engine: ${transformation.engine}`);
  console.log(`Status: ${transformation.status}`);
  console.log(`Planned changes: ${transformation.plan.changes.length}`);
  if (transformation.applied.length) console.log(`Applied changes: ${transformation.applied.length}`);
  if (transformation.rollback?.id) console.log(`Rollback snapshot: ${transformation.rollback.id}`);
  if (rules.loaded) console.log(`Enterprise rule violations: ${rules.violations.length}`);
  console.log(`Report: ${path.relative(process.cwd(), bundle.htmlPath)}`);
  console.log(`JSON: ${path.relative(process.cwd(), bundle.jsonPath)}`);
}

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

async function assertDirectory(root) {
  const stat = await fs.stat(root).catch(() => null);
  if (!stat?.isDirectory()) throw new Error(`Target directory does not exist: ${root}`);
}

function printHelp() {
  console.log(`Enterprise Modernization Platform CLI ${VERSION}

Usage:
  emp analyze <path> [--pack spring-boot-3-readiness|java-17-to-21-readiness|jakarta-readiness] [--rules .preflight-rules.yml] [--out reports/latest]
  emp transform <path> [--pack spring-boot-3-readiness|java-17-to-21-readiness|jakarta-readiness] [--mode dry-run|apply|rollback] [--engine native|openrewrite|auto] [--recipe recipeId] [--recipe-artifact group:artifact:version] [--validate] [--rules .preflight-rules.yml] [--out reports/transform]
  emp benchmarks [--source catalog|local|clone] [--only slug[,slug]] [--limit n] [--out docs/benchmarks]
  emp hub [--out docs/migration-hub]
  emp mcp

Available scope:
  - Java/Spring project scanner
  - Readiness score JSON
  - Static HTML report
  - Spring Boot 2 to 3 transformation dry-run, apply, rollback, and validation evidence
  - Java 17 to 21 target update pack
  - Professional trust evidence with confidence, compatibility, compile, test, and rollback status
  - Consultant enterprise rules from .preflight-rules.yml
  - MCP stdio interface for AI clients
  - 10 public benchmark reports
  - Initial Migration Hub
`);
}
