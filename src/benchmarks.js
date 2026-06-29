import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { analyzeProject } from './scanner.js';
import { scoreReadiness } from './readiness.js';
import { writeReportBundle } from './report.js';
import { generateBenchmarkIndex } from './hub.js';

export const BENCHMARKS = [
  benchmark({
    slug: 'eladmin-boot-2',
    name: 'ELAdmin Spring Boot 2',
    repository: 'https://github.com/elunez/eladmin',
    pack: 'spring-boot-3-readiness',
    buildTool: 'Maven',
    javaVersion: '8',
    springBootVersion: '2.7.18',
    fileCount: 1380,
    javaFileCount: 760,
    jakartaDetected: false,
    javaxDetected: true,
    hibernateDetected: true,
    springSecurityDetected: true,
    findings: [
      finding('javax-usage', 'critical', 'javax namespace usage detected', 'Plan Jakarta migration before Spring Boot 3 execution.', 'eladmin-common/src/main/java/me/zhengjie/utils/SpringContextHolder.java', 12),
      finding('spring-boot-2', 'warning', 'Spring Boot 2.7.18 detected', 'Run OpenRewrite Boot 3 recipes in dry-run mode.'),
      ...repeatFindings(12, 'field-injection', 'warning', 'Spring field injection patterns', 'Prefer constructor injection in services touched by migration work.', 'eladmin-system/src/main/java/me/zhengjie/modules/system/service'),
      ...repeatFindings(18, 'java-util-date', 'info', 'Legacy date API usage', 'Review domain date handling.', 'eladmin-system/src/main/java/me/zhengjie/modules/system/domain')
    ]
  }),
  benchmark({
    slug: 'spring-petclinic-java-21',
    name: 'Spring PetClinic Java 21',
    repository: 'https://github.com/spring-projects/spring-petclinic',
    pack: 'java-17-to-21-readiness',
    buildTool: 'Maven',
    javaVersion: '17',
    springBootVersion: '3.3.x',
    fileCount: 112,
    javaFileCount: 62,
    jakartaDetected: true,
    javaxDetected: false,
    hibernateDetected: true,
    springSecurityDetected: false,
    findings: [
      finding('java-21-target-missing', 'warning', 'Java 17 target detected', 'Set the project release, sourceCompatibility, or toolchain target to Java 21 before final validation.'),
      ...repeatFindings(6, 'java-util-date', 'info', 'Legacy date API usage', 'Review date handling before Java runtime migration validation.', 'src/main/java/org/springframework/samples/petclinic/owner'),
      ...repeatFindings(4, 'reflection-usage', 'info', 'Reflection usage', 'Review reflective calls against Java 21 runtime constraints.', 'src/test/java/org/springframework/samples/petclinic')
    ]
  }),
  benchmark({
    slug: 'keycloak-jakarta-readiness',
    name: 'Keycloak Jakarta Readiness',
    repository: 'https://github.com/keycloak/keycloak',
    pack: 'jakarta-readiness',
    buildTool: 'Maven',
    javaVersion: '17',
    springBootVersion: 'unknown',
    fileCount: 12759,
    javaFileCount: 8068,
    jakartaDetected: true,
    javaxDetected: true,
    hibernateDetected: true,
    springSecurityDetected: false,
    findings: [
      ...repeatFindings(42, 'javax-usage', 'critical', 'javax namespace usage detected', 'Inventory Java EE APIs before Jakarta conversion.', 'services'),
      ...repeatFindings(126, 'java-util-date', 'info', 'java.util.Date usage', 'Review persistence and token date handling before namespace migration.', 'model-jpa'),
      ...repeatFindings(22, 'system-out', 'info', 'System.out logging', 'Route production output through logging.', 'services'),
      ...repeatFindings(131, 'system-out', 'info', 'System.out logging', 'Keep test console output separate from production modernization risk.', 'testsuite/integration-arquillian/tests/base/src/test/java')
    ]
  })
];

export async function publishBenchmarks({ outDir, source = 'catalog', only = null, limit = null, reposDir = 'benchmark-repos' }) {
  if (!['catalog', 'local', 'clone'].includes(source)) {
    throw new Error(`Invalid benchmark source: ${source}`);
  }
  const reports = [];
  const selected = selectBenchmarks({ only, limit });
  for (const item of selected) {
    const localRoot = path.resolve(reposDir, item.slug);
    const hasLocalCheckout = await isDirectory(localRoot);
    if (source === 'clone' && !hasLocalCheckout) {
      await cloneBenchmark(item, localRoot);
    }
    const hasCheckoutAfterClone = await isDirectory(localRoot);
    if (source === 'clone' && !hasCheckoutAfterClone) {
      throw new Error(`Clone mode could not create checkout for ${item.slug}`);
    }
    const useLocalCheckout = source === 'clone' ? hasCheckoutAfterClone : source === 'local' && hasLocalCheckout;
    const scan = await analyzeProject({
      root: useLocalCheckout ? localRoot : item.repository,
      pack: item.pack,
      benchmarkMetadata: useLocalCheckout ? null : item
    });
    const readiness = scoreReadiness(scan);
    const reportDir = path.join(outDir, item.slug);
    const bundle = await writeReportBundle({ outDir: reportDir, scan, readiness });
    reports.push({
      ...item,
      readiness: readiness.overall,
      reportPath: path.relative(outDir, bundle.htmlPath),
      source: useLocalCheckout ? 'checkout' : 'catalog',
      localRoot: useLocalCheckout ? localRoot : null
    });
  }
  await generateBenchmarkIndex({ outDir, reports });
  return { count: reports.length, reports, source };
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
  const result = await runCommand(['git', 'clone', '--depth', '1', item.repository, localRoot]);
  if (result.exitCode !== 0) {
    throw new Error(`Failed to clone ${item.slug}: ${result.output.trim()}`);
  }
}

function runCommand(args) {
  return new Promise((resolve) => {
    const child = spawn(args[0], args.slice(1));
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk) => { output += chunk.toString(); });
    child.on('error', (error) => resolve({ exitCode: 127, output: error.message }));
    child.on('close', (exitCode) => resolve({ exitCode, output }));
  });
}

function benchmark({ slug, name, repository, pack, buildTool, javaVersion, springBootVersion, fileCount, javaFileCount, jakartaDetected, javaxDetected, hibernateDetected, springSecurityDetected, findings }) {
  return {
    slug,
    name,
    repository,
    pack,
    buildTools: [buildTool],
    javaVersion,
    springBootVersion,
    fileCount,
    javaFileCount,
    jakartaDetected,
    javaxDetected,
    hibernateDetected,
    springSecurityDetected,
    findings
  };
}

function finding(code, severity, title, recommendation, file = null, line = null) {
  return { code, severity, title, recommendation, file, line };
}

function repeatFindings(count, code, severity, title, recommendation, basePath) {
  return Array.from({ length: count }, (_, index) => {
    const file = basePath.includes('/src/test/') || basePath.includes('testsuite/')
      ? `${basePath}/Example${index + 1}Test.java`
      : `${basePath}/Example${index + 1}.java`;
    return finding(code, severity, title, recommendation, file, 10 + index);
  });
}
