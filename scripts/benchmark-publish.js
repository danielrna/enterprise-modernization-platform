#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { BENCHMARKS, publishBenchmarks } from '../src/benchmarks.js';
import { generateBenchmarkIndex, generateMigrationHub } from '../src/hub.js';
import { generateKnowledgeBase } from '../src/knowledge-base.js';
import { generatePackDocs } from '../src/pack-docs.js';
import { buildNextActions, compactReportFindings, renderReport } from '../src/report.js';
import { generateReleaseNotes } from '../src/release-notes.js';
import { buildConsultantDemoBundle, generateConsultantDemo } from '../src/consultant-demo.js';

const DEFAULT_MIN_COUNT = BENCHMARKS.length;

const { options } = parseOptions(process.argv.slice(2));
const outDir = path.resolve(options.out || 'docs/benchmarks');
const hubDir = path.resolve(options.hub || 'docs/migration-hub');
const packDocsDir = path.resolve(options['pack-docs'] || 'docs/packs');
const knowledgeDir = path.resolve(options.knowledge || 'docs/knowledge-base');
const releaseNotesDir = path.resolve(options['release-notes'] || 'docs/release-notes');
const consultantDemoFile = path.resolve(options['consultant-demo'] || 'docs/consultant-demo.html');
const consultantDemoBundle = path.resolve(options['consultant-demo-bundle'] || 'reports/emp-consultant-demo.zip');
const source = options.source || 'existing';
const minCount = Number(options['min-count'] || DEFAULT_MIN_COUNT);

if (!Number.isInteger(minCount) || minCount < 1) {
  throw new Error(`Invalid --min-count value: ${options['min-count']}`);
}

let reports = [];
if (source === 'existing') {
  await refreshPublishedReportBundles(outDir);
  reports = await loadPublishedReportSummaries(outDir);
  await generateBenchmarkIndex({ outDir, reports });
} else {
  const result = await publishBenchmarks({
    outDir,
    source,
    only: options.only || null,
    limit: options.limit || null,
    reposDir: options['repos-dir'] || 'benchmark-repos',
    validate: Boolean(options.validate),
    validationTimeoutMs: options['validation-timeout-ms'] || undefined
  });
  reports = result.reports;
}

await generateMigrationHub({ outDir: hubDir, benchmarks: reports, benchmarksDir: outDir });
const packDocs = await generatePackDocs({ outDir: packDocsDir });
const knowledgeBase = await generateKnowledgeBase({ outDir: knowledgeDir });
const releaseNotes = await generateReleaseNotes({ outDir: releaseNotesDir });
const consultantDemo = await generateConsultantDemo({ benchmarksDir: outDir, outFile: consultantDemoFile });
const consultantBundle = await buildConsultantDemoBundle({ docsDir: path.resolve('docs'), outFile: consultantDemoBundle });

const summary = await summarizePublishedReports(outDir);
if (summary.total < minCount) {
  throw new Error(`Benchmark publishing produced ${summary.total} reports, expected at least ${minCount}.`);
}

await fs.mkdir(path.dirname(options.summary || 'reports/benchmark-publish-summary.json'), { recursive: true });
await fs.writeFile(options.summary || 'reports/benchmark-publish-summary.json', `${JSON.stringify({
  schemaVersion: 'emp.benchmark-publish.v1',
  generatedAt: new Date().toISOString(),
  source,
  outDir: path.relative(process.cwd(), outDir),
  hubDir: path.relative(process.cwd(), hubDir),
  packDocsDir: path.relative(process.cwd(), packDocsDir),
  knowledgeDir: path.relative(process.cwd(), knowledgeDir),
  releaseNotesDir: path.relative(process.cwd(), releaseNotesDir),
  consultantDemoFile: path.relative(process.cwd(), consultantDemoFile),
  consultantDemoBundle: path.relative(process.cwd(), consultantDemoBundle),
  minCount,
  catalogCount: BENCHMARKS.length,
  packDocsCount: packDocs.count,
  knowledgeArticleCount: knowledgeBase.count,
  releaseNoteFeatureCount: releaseNotes.featureCount,
  consultantDemoReportCount: consultantDemo.count,
  consultantDemoBundleFileCount: consultantBundle.fileCount,
  ...summary
}, null, 2)}\n`);

console.log(`Published ${summary.total} benchmark reports from ${source} source.`);
console.log(`Checkout-backed: ${summary.checkoutBacked}; validated passed: ${summary.validationPassed}.`);
console.log(`Migration Hub: ${path.relative(process.cwd(), hubDir)}`);
console.log(`Pack docs: ${path.relative(process.cwd(), packDocsDir)}`);
console.log(`Knowledge Base: ${path.relative(process.cwd(), knowledgeDir)}`);
console.log(`Release notes: ${path.relative(process.cwd(), releaseNotesDir)}`);
console.log(`Consultant demo: ${path.relative(process.cwd(), consultantDemoFile)}`);

async function loadPublishedReportSummaries(benchmarksDir) {
  const entries = await fs.readdir(benchmarksDir, { withFileTypes: true }).catch(() => []);
  const reports = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const report = await readJson(path.join(benchmarksDir, entry.name, 'report.json'));
    if (!report) continue;
    reports.push({
      slug: entry.name,
      name: report.project?.name || entry.name,
      repository: report.project?.source || `https://github.com/${entry.name}`,
      pack: report.pack,
      springBootVersion: report.project?.springBootVersion || 'unknown',
      readiness: report.readiness?.overall ?? null,
      findings: { total: totalFindings(report) },
      source: report.benchmark?.source || 'catalog',
      validation: report.benchmark?.validation || { status: 'not_requested' }
    });
  }
  return reports.sort((left, right) => left.name.localeCompare(right.name));
}

function totalFindings(report) {
  return report.findingDetails?.total ?? report.findings?.length ?? 0;
}

async function summarizePublishedReports(benchmarksDir) {
  const entries = await fs.readdir(benchmarksDir, { withFileTypes: true });
  const reports = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const report = await readJson(path.join(benchmarksDir, entry.name, 'report.json'));
    if (report) reports.push(report);
  }
  return {
    total: reports.length,
    checkoutBacked: reports.filter((report) => report.benchmark?.source === 'checkout').length,
    validationPassed: reports.filter((report) => report.benchmark?.validation?.status === 'passed').length,
    validationFailed: reports.filter((report) => report.benchmark?.validation?.status === 'failed').length,
    validationSkipped: reports.filter((report) => report.benchmark?.validation?.status === 'skipped').length
  };
}

async function refreshPublishedReportBundles(benchmarksDir) {
  const entries = await fs.readdir(benchmarksDir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const reportPath = path.join(benchmarksDir, entry.name, 'report.json');
    const report = await readJson(reportPath);
    if (!report) continue;
    report.nextActions = buildNextActions(report);
    if (report.benchmark && totalFindings(report) > 300) compactReportFindings(report);
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    await fs.writeFile(path.join(benchmarksDir, entry.name, 'index.html'), renderReport(report).replace(/[ \t]+$/gm, ''));
  }
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return null;
  }
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
