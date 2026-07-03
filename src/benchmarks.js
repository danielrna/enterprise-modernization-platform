import path from 'node:path';
import fs from 'node:fs/promises';
import { execFileSync, spawn } from 'node:child_process';
import os from 'node:os';
import { analyzeProject } from './scanner.js';
import { scoreReadiness } from './readiness.js';
import { writeReportBundle } from './report.js';
import { generateBenchmarkIndex } from './hub.js';

const CATALOG_URL = new URL('../benchmarks/catalog.json', import.meta.url);

export const BENCHMARKS = await loadBenchmarkCatalog();

const DEFAULT_VALIDATION_TIMEOUT_MS = 120000;
const TIMEOUT_TERMINATE_GRACE_MS = 500;
const TIMEOUT_FORCE_RESOLVE_MS = 1000;

async function loadBenchmarkCatalog() {
  const catalog = JSON.parse(await fs.readFile(CATALOG_URL, 'utf8'));
  if (!Array.isArray(catalog)) throw new Error('Benchmark catalog must be an array.');

  const slugs = new Set();
  for (const item of catalog) {
    if (!item.slug || !item.name || !item.repository || !item.pack) {
      throw new Error('Benchmark catalog entries require slug, name, repository, and pack.');
    }
    if (slugs.has(item.slug)) throw new Error(`Duplicate benchmark slug: ${item.slug}`);
    slugs.add(item.slug);
    if (!Array.isArray(item.buildTools) || !item.buildTools.length) {
      throw new Error(`Benchmark ${item.slug} requires at least one build tool.`);
    }
    if (!Array.isArray(item.findings) && !Array.isArray(item.findingGroups)) {
      throw new Error(`Benchmark ${item.slug} requires findings or findingGroups.`);
    }
    item.findings = [
      ...(item.findings || []),
      ...(item.findingGroups || []).flatMap((group) => expandFindingGroup(item.slug, group))
    ];
    delete item.findingGroups;
    for (const finding of item.findings) {
      if (!finding.code || !finding.severity || !finding.title || !finding.recommendation) {
        throw new Error(`Benchmark ${item.slug} contains an invalid finding.`);
      }
    }
  }

  return catalog;
}

function expandFindingGroup(slug, group) {
  const { count, code, severity, title, recommendation, basePath } = group;
  if (!Number.isInteger(count) || count < 1 || !code || !severity || !title || !recommendation || !basePath) {
    throw new Error(`Benchmark ${slug} contains an invalid finding group.`);
  }
  return Array.from({ length: count }, (_, index) => {
    const file = basePath.includes('/src/test/') || basePath.includes('testsuite/')
      ? `${basePath}/Example${index + 1}Test.java`
      : `${basePath}/Example${index + 1}.java`;
    return { code, severity, title, recommendation, file, line: 10 + index };
  });
}

export async function publishBenchmarks({ outDir, source = 'catalog', only = null, limit = null, reposDir = 'benchmark-repos', validate = false, validationTimeoutMs = DEFAULT_VALIDATION_TIMEOUT_MS }) {
  if (!['catalog', 'local', 'clone'].includes(source)) {
    throw new Error(`Invalid benchmark source: ${source}`);
  }
  const reports = [];
  const selected = selectBenchmarks({ only, limit });
  for (const item of selected) {
    const localRoot = path.resolve(reposDir, item.slug);
    const analysisRoot = path.join(localRoot, item.checkoutSubdir || '');
    const hasLocalCheckout = await isDirectory(localRoot);
    const benchmarkEvidence = {
      slug: item.slug,
      name: item.name,
      repository: item.repository,
      ref: item.ref || null,
      requestedSource: source,
      source: 'catalog',
      checkoutPath: null,
      analysisPath: null,
      gitRevision: null,
      commands: [],
      validation: {
        requested: Boolean(validate),
        status: validate ? 'skipped' : 'not_requested',
        confidence: 0,
        checks: [],
        summary: validate ? 'Validation requires a local checkout.' : 'Validation was not requested.'
      }
    };
    if (source === 'clone' && !hasLocalCheckout) {
      const clone = await cloneBenchmark(item, localRoot);
      benchmarkEvidence.commands.push(clone);
    }
    const hasCheckoutAfterClone = await isDirectory(localRoot);
    if (source === 'clone' && !hasCheckoutAfterClone) {
      throw new Error(`Clone mode could not create checkout for ${item.slug}`);
    }
    const useLocalCheckout = source === 'clone' ? hasCheckoutAfterClone : source === 'local' && hasLocalCheckout;
    if (useLocalCheckout) {
      benchmarkEvidence.source = 'checkout';
      benchmarkEvidence.checkoutPath = path.relative(process.cwd(), localRoot);
      benchmarkEvidence.analysisPath = path.relative(process.cwd(), analysisRoot);
      benchmarkEvidence.gitRevision = await getGitRevision(localRoot);
      if (source === 'clone' && hasLocalCheckout) {
        benchmarkEvidence.commands.push({
          command: `reuse checkout ${benchmarkEvidence.checkoutPath}`,
          exitCode: 0,
          status: 'passed',
          output: 'Existing checkout reused.'
        });
      }
    }
    const scan = await analyzeProject({
      root: useLocalCheckout ? analysisRoot : item.repository,
      pack: item.pack,
      benchmarkMetadata: useLocalCheckout ? null : item
    });
    scan.project.name = item.name;
    scan.project.root = useLocalCheckout ? benchmarkEvidence.analysisPath : item.repository;
    scan.project.source = item.repository;
    if (validate && useLocalCheckout) {
      benchmarkEvidence.validation = await validateBenchmarkCheckout({
        root: analysisRoot,
        timeoutMs: Number(validationTimeoutMs) || DEFAULT_VALIDATION_TIMEOUT_MS,
        javaVersion: item.validationJavaVersion
      });
    }
    scan.benchmark = benchmarkEvidence;
    const readiness = scoreReadiness(scan);
    const reportDir = path.join(outDir, item.slug);
    const bundle = await writeReportBundle({ outDir: reportDir, scan, readiness, compactFindings: true });
    reports.push({
      ...item,
      readiness: readiness.overall,
      reportPath: path.relative(outDir, bundle.htmlPath),
      source: benchmarkEvidence.source,
      validation: benchmarkEvidence.validation,
      localRoot: useLocalCheckout ? localRoot : null
    });
  }
  await generateBenchmarkIndex({ outDir, reports: await loadPublishedReportsForIndex(outDir, reports) });
  return { count: reports.length, reports, source };
}

async function loadPublishedReportsForIndex(outDir, fallbackReports) {
  const entries = await fs.readdir(outDir, { withFileTypes: true }).catch(() => []);
  const reports = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    const report = await readJson(path.join(outDir, slug, 'report.json'));
    if (!report) continue;
    reports.push({
      slug,
      name: report.project?.name || slug,
      repository: report.project?.source || `https://github.com/${slug}`,
      readiness: report.readiness?.overall ?? null,
      source: report.benchmark?.source || 'catalog',
      validation: report.benchmark?.validation || { status: 'not_requested' }
    });
  }
  return reports.length ? reports.sort(comparePublishedReports) : fallbackReports;
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

function comparePublishedReports(left, right) {
  return left.name.localeCompare(right.name);
}

async function isDirectory(directory) {
  const stat = await fs.stat(directory).catch(() => null);
  return Boolean(stat?.isDirectory());
}

function selectBenchmarks({ only, limit }) {
  const names = only ? new Set(String(only).split(',').map((name) => name.trim()).filter(Boolean)) : null;
  const selected = BENCHMARKS.filter((item) => !names || names.has(item.slug));
  if (names && selected.length !== names.size) {
    const found = new Set(selected.map((item) => item.slug));
    const missing = [...names].filter((name) => !found.has(name));
    throw new Error(`Unknown benchmark slug(s): ${missing.join(', ')}`);
  }
  const max = limit ? Number(limit) : selected.length;
  if (!Number.isInteger(max) || max < 1) throw new Error(`Invalid benchmark limit: ${limit}`);
  return selected.slice(0, max);
}

async function cloneBenchmark(item, localRoot) {
  await fs.mkdir(path.dirname(localRoot), { recursive: true });
  const branchArgs = item.ref ? ['--branch', item.ref] : [];
  const args = ['git', 'clone', '--depth', '1', ...branchArgs, item.repository, localRoot];
  const result = await runCommand(args);
  if (result.exitCode !== 0) {
    throw new Error(`Failed to clone ${item.slug}: ${result.output.trim()}`);
  }
  return {
    command: ['git', 'clone', '--depth', '1', ...branchArgs, item.repository, path.relative(process.cwd(), localRoot)].join(' '),
    exitCode: result.exitCode,
    status: 'passed',
    output: sanitizeCommandOutput(result.output).trim()
  };
}

async function getGitRevision(root) {
  const result = await runCommand(['git', 'rev-parse', 'HEAD'], { cwd: root });
  return result.exitCode === 0 ? result.output.trim() : null;
}

async function validateBenchmarkCheckout({ root, timeoutMs, javaVersion = null }) {
  const plan = await validationPlan(root);
  const javaRuntime = javaVersion ? await resolveJavaRuntime(javaVersion) : null;
  if (javaVersion && !javaRuntime) {
    return {
      requested: true,
      status: 'failed',
      confidence: 25,
      checks: [
        {
          name: `Java ${javaVersion} runtime`,
          status: 'failed',
          command: `resolve Java ${javaVersion}`,
          durationMs: 0,
          exitCode: 1,
          output: `Set EMP_JAVA_${javaVersion}_HOME or install a Java ${javaVersion} runtime before validation.`,
          timedOut: false
        }
      ],
      summary: '1 validation check(s) failed.'
    };
  }
  if (!plan.length) {
    return {
      requested: true,
      status: 'skipped',
      confidence: 15,
      checks: [
        {
          name: 'Build tool detection',
          status: 'skipped',
          command: null,
          durationMs: 0,
          exitCode: null,
          output: 'No Maven or Gradle build file was detected at the checkout root.'
        }
      ],
      summary: 'Validation skipped because no supported root build file was detected.'
    };
  }

  const checks = [];
  for (const step of plan) {
    const result = await runCommand(step.args, { cwd: root, timeoutMs, env: javaRuntime?.env });
    checks.push({
      name: step.name,
      status: statusFromExitCode(result.exitCode, result.timedOut),
      command: [javaRuntime?.label, step.args.join(' ')].filter(Boolean).join(' '),
      durationMs: result.durationMs,
      exitCode: result.exitCode,
      output: validationOutput(result, timeoutMs),
      timedOut: result.timedOut
    });
  }
  const status = validationStatus(checks);
  return {
    requested: true,
    status,
    confidence: validationConfidence(checks),
    checks,
    summary: validationSummary(status, checks)
  };
}

async function validationPlan(root) {
  if (await isFile(path.join(root, 'mvnw'))) {
    return [
      { name: 'Compilation', args: ['./mvnw', '-q', '-DskipTests', 'compile'] },
      { name: 'Tests', args: ['./mvnw', '-q', 'test'] }
    ];
  }
  if (await isFile(path.join(root, 'pom.xml'))) {
    return [
      { name: 'Compilation', args: ['mvn', '-q', '-DskipTests', 'compile'] },
      { name: 'Tests', args: ['mvn', '-q', 'test'] }
    ];
  }
  if (await isFile(path.join(root, 'gradlew'))) {
    return [
      { name: 'Compilation', args: ['./gradlew', 'compileJava', '--no-daemon'] },
      { name: 'Tests', args: ['./gradlew', 'test', '--no-daemon'] }
    ];
  }
  if (await isFile(path.join(root, 'build.gradle')) || await isFile(path.join(root, 'build.gradle.kts'))) {
    return [
      { name: 'Compilation', args: ['gradle', 'compileJava', '--no-daemon'] },
      { name: 'Tests', args: ['gradle', 'test', '--no-daemon'] }
    ];
  }
  return [];
}

async function resolveJavaRuntime(version) {
  const envName = `EMP_JAVA_${version}_HOME`;
  const javaHome = process.env[envName] || await macosJavaHome(version);
  if (!javaHome) return null;
  return {
    label: `JAVA_HOME=<JDK ${version}>`,
    env: {
      ...process.env,
      JAVA_HOME: javaHome,
      PATH: `${path.join(javaHome, 'bin')}${path.delimiter}${process.env.PATH || ''}`
    }
  };
}

async function macosJavaHome(version) {
  if (process.platform !== 'darwin') return null;
  const result = await runCommand(['/usr/libexec/java_home', '-v', String(version)]);
  return result.exitCode === 0 ? result.output.trim() : null;
}

async function isFile(file) {
  const stat = await fs.stat(file).catch(() => null);
  return Boolean(stat?.isFile());
}

function validationStatus(checks) {
  if (!checks.length) return 'skipped';
  if (checks.some((check) => check.status === 'failed')) return 'failed';
  if (checks.some((check) => check.status === 'skipped')) return 'skipped';
  return 'passed';
}

function validationConfidence(checks) {
  if (!checks.length) return 15;
  const passed = checks.filter((check) => check.status === 'passed').length;
  const failed = checks.filter((check) => check.status === 'failed').length;
  if (failed) return Math.max(25, Math.round((passed / checks.length) * 70));
  return Math.min(98, 55 + passed * 20);
}

function validationSummary(status, checks) {
  if (status === 'passed') return 'Compilation and tests completed successfully.';
  if (status === 'failed') return `${checks.filter((check) => check.status === 'failed').length} validation check(s) failed.`;
  return 'Validation was skipped or incomplete.';
}

function statusFromExitCode(exitCode, timedOut) {
  if (timedOut) return 'failed';
  return exitCode === 0 ? 'passed' : 'failed';
}

function trimCommandOutput(output) {
  const value = sanitizeCommandOutput(String(output || '')).trim();
  if (!value) return '';
  return value.length > 1200 ? `${value.slice(-1200)}` : value;
}

function validationOutput(result, timeoutMs) {
  const output = trimCommandOutput(result.output);
  if (result.timedOut && output) return `${output}\nCommand timed out after ${timeoutMs} ms.`;
  if (result.timedOut) return `Command timed out after ${timeoutMs} ms.`;
  return output;
}

function sanitizeCommandOutput(output) {
  const home = process.env.HOME || null;
  const user = process.env.USER || null;
  const hostname = os.hostname();
  let sanitized = home ? output.replaceAll(home, '~') : output;
  if (user) sanitized = sanitized.replaceAll(`started by ${user}`, 'started by <user>');
  if (hostname) sanitized = sanitized.replaceAll(hostname, '<host>');
  return sanitized
    .replace(/ on [A-Za-z0-9.-]+\.local /g, ' on <host> ')
    .replace(/~\/IdeaProjects\/[^\s:)]+/g, '~/<workspace>')
    .replace(/\/Users\/[^/\s:)]+/g, '~')
    .replace(/\/private\/var\/folders\/[^\s:)]+/g, '<tmp>');
}

function runCommand(args, options = {}) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(args[0], args.slice(1), { cwd: options.cwd, detached: Boolean(options.timeoutMs), env: options.env || process.env });
    let output = '';
    let timedOut = false;
    let settled = false;
    let terminateTimeout = null;
    let forceResolveTimeout = null;
    const finish = (exitCode, finalOutput = output) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      if (terminateTimeout) clearTimeout(terminateTimeout);
      if (forceResolveTimeout) clearTimeout(forceResolveTimeout);
      resolve({ exitCode, output: finalOutput, durationMs: Date.now() - startedAt, timedOut });
    };
    const timeout = options.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          killProcessTree(child, 'SIGTERM', options.cwd);
          terminateTimeout = setTimeout(() => {
            killProcessTree(child, 'SIGKILL', options.cwd);
          }, TIMEOUT_TERMINATE_GRACE_MS);
          forceResolveTimeout = setTimeout(() => {
            finish(124);
          }, TIMEOUT_FORCE_RESOLVE_MS);
        }, options.timeoutMs)
      : null;
    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk) => { output += chunk.toString(); });
    child.on('error', (error) => {
      finish(127, error.message);
    });
    child.on('close', (exitCode) => {
      finish(exitCode ?? (timedOut ? 124 : 1));
    });
  });
}

function killProcessTree(child, signal, cwd = null) {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
  killProcessesMatchingCwd(cwd, signal, child.pid);
}

function killProcessesMatchingCwd(cwd, signal, rootPid) {
  if (!cwd) return;
  const output = processListOutput();
  if (!output) {
    return;
  }
  for (const line of output.split('\n')) {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/);
    if (!match) continue;
    const pid = Number(match[1]);
    const ppid = Number(match[2]);
    const command = match[3];
    if (!Number.isInteger(pid) || pid === process.pid || pid === rootPid) continue;
    if (ppid === rootPid || command.includes(cwd)) {
      try {
        process.kill(pid, signal);
      } catch {
        // The process may have exited between ps and kill.
      }
    }
  }
}

function processListOutput() {
  for (const args of [
    ['-axo', 'pid=,ppid=,command='],
    ['-o', 'pid=,ppid=,args=']
  ]) {
    try {
      return execFileSync('ps', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
      // Some minimal containers expose only a subset of ps options.
    }
  }
  return '';
}
