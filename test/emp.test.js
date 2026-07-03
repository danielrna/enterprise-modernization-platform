import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { analyzeProject } from '../src/scanner.js';
import { scoreReadiness } from '../src/readiness.js';
import { writeReportBundle } from '../src/report.js';
import { BENCHMARKS, publishBenchmarks } from '../src/benchmarks.js';
import { generateMigrationHub } from '../src/hub.js';
import { generateKnowledgeBase } from '../src/knowledge-base.js';
import { generatePackDocs } from '../src/pack-docs.js';
import { generateReleaseNotes } from '../src/release-notes.js';
import { buildConsultantDemoBundle, generateConsultantDemo } from '../src/consultant-demo.js';
import { transformProject } from '../src/transform.js';
import { loadEnterpriseRules, evaluateEnterpriseRules } from '../src/rules.js';
import { handleMcpRequest } from '../src/mcp.js';

test('CLI version matches package metadata', async () => {
  const packageJson = JSON.parse(await fs.readFile(path.resolve('package.json'), 'utf8'));
  const result = await runNode(['./bin/emp.js', '--version']);

  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout.trim(), packageJson.version);
});

test('analyzes a Spring Boot project and writes HTML/JSON reports', async () => {
  const root = await makeSpringProject();
  const outDir = path.join(root, 'report');

  const scan = await analyzeProject({ root });
  const readiness = scoreReadiness(scan);
  const bundle = await writeReportBundle({ outDir, scan, readiness });

  assert.equal(scan.project.buildTools.includes('Maven'), true);
  assert.equal(scan.project.javaVersion, '17');
  assert.equal(scan.project.springBootVersion, '2.7.18');
  assert.equal(scan.packApplicability.applicable, true);
  assert.equal(scan.dependencies.javaxDetected, true);
  assert.equal(scan.findings.some((finding) => finding.code === 'javax-usage'), true);
  assert.equal(readiness.counts.critical, 1);
  assert.match(await fs.readFile(bundle.htmlPath, 'utf8'), /Readiness Report/);
  const report = JSON.parse(await fs.readFile(bundle.jsonPath, 'utf8'));
  assert.equal(report.schemaVersion, 'emp.report.v1');
  assert.equal(report.packApplicability.applicable, true);
  assert.equal(report.productionFindings.length, report.findings.length);
  assert.equal(report.findingSummary.byCode['javax-usage'].production, 1);
  assert.equal(report.nextActions.some((action) => action.id === 'plan-jakarta-migration'), true);
  assert.match(await fs.readFile(bundle.htmlPath, 'utf8'), /Recommended Next Actions/);
});

test('compact benchmark reports preserve finding totals and representative details', async () => {
  const root = await makeSpringProject();
  const outDir = path.join(root, 'compact-report');
  const scan = await analyzeProject({ root });
  const originalTotal = scan.findings.length;
  const originalJavaxProduction = scan.findings.filter((finding) => finding.code === 'javax-usage' && finding.scope !== 'test').length;
  const originalProduction = scan.findings.filter((finding) => finding.scope !== 'test').length;
  const originalTest = scan.findings.filter((finding) => finding.scope === 'test').length;
  for (let index = 0; index < 40; index += 1) {
    scan.findings.push({
      code: 'javax-usage',
      severity: 'critical',
      title: 'javax namespace usage detected',
      recommendation: 'Migrate Java EE imports to Jakarta equivalents for Spring Boot 3.',
      file: `src/main/java/com/example/Legacy${index}.java`,
      line: 10 + index,
      scope: 'production'
    });
  }
  for (let index = 0; index < 20; index += 1) {
    scan.findings.push({
      code: 'system-out',
      severity: 'warning',
      title: 'System.out usage',
      recommendation: 'Replace console output with structured logging.',
      file: `src/test/java/com/example/Logging${index}Test.java`,
      line: 5 + index,
      scope: 'test'
    });
  }

  const readiness = scoreReadiness(scan);
  const bundle = await writeReportBundle({ outDir, scan, readiness, compactFindings: true, maxDetailedFindings: 12 });
  const report = JSON.parse(await fs.readFile(bundle.jsonPath, 'utf8'));
  const html = await fs.readFile(bundle.htmlPath, 'utf8');

  assert.equal(report.findingDetails.compacted, true);
  assert.equal(report.findingDetails.total, originalTotal + 60);
  assert.equal(report.findingDetails.productionTotal, originalProduction + 40);
  assert.equal(report.findingDetails.testTotal, originalTest + 20);
  assert.equal(report.findings.length, 12);
  assert.equal(report.findingSummary.byCode['javax-usage'].production, originalJavaxProduction + 40);
  assert.equal(report.findingSummary.byCode['system-out'].test, 20);
  assert.equal(report.nextActions.find((action) => action.id === 'plan-jakarta-migration').evidenceCount, originalJavaxProduction + 40);
  assert.equal(html.includes(`>${originalProduction + 40}</div><div class="label">Production code findings`), true);
  assert.equal(html.includes(`>${originalTest + 20}</div><div class="label">Test code findings`), true);
  assert.equal(html.includes(`>${originalTotal + 60}</div><div class="label">Total findings`), true);
});

test('publishes the benchmark catalog and migration hub', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'emp-benchmarks-'));
  const benchmarksDir = path.join(root, 'benchmarks');
  const hubDir = path.join(root, 'hub');

  const result = await publishBenchmarks({ outDir: benchmarksDir, source: 'catalog', limit: 2 });
  result.reports[0].validation = { status: 'passed', confidence: 95 };
  await generateMigrationHub({ outDir: hubDir, benchmarks: result.reports, benchmarksDir: path.join(root, 'missing-benchmarks') });

  assert.equal(result.count, 2);
  assert.match(await fs.readFile(path.join(benchmarksDir, 'index.html'), 'utf8'), /Benchmark Reports/);
  const hub = await fs.readFile(path.join(hubDir, 'spring-boot-2-to-3.html'), 'utf8');
  assert.match(hub, /Spring Boot 2 to 3 Migration/);
  assert.match(hub, /Spring Petclinic/);
  assert.match(hub, /Findings/);
  assert.match(hub, /Validated Benchmark/);
  assert.match(hub, /Compile \+ tests/);
  assert.match(await fs.readFile(path.join(hubDir, 'spring-boot-3-readiness.html'), 'utf8'), /Spring Boot 3 Readiness Evidence Hub/);
});

test('benchmark catalog includes Hibernate readiness evidence', () => {
  const hibernateBenchmarks = BENCHMARKS.filter((benchmark) => benchmark.pack === 'hibernate-readiness');

  assert.equal(hibernateBenchmarks.length >= 5, true);
  assert.equal(hibernateBenchmarks.some((benchmark) => benchmark.slug === 'hibernate-demos'), true);
  assert.equal(hibernateBenchmarks.some((benchmark) => benchmark.slug === 'hypersistence-utils'), true);
  assert.equal(hibernateBenchmarks.find((benchmark) => benchmark.slug === 'hibernate-demos')?.checkoutSubdir, 'hibernate-search/hsearch-with-elasticsearch');
  assert.equal(hibernateBenchmarks.every((benchmark) => benchmark.hibernateDetected), true);
});

test('benchmark catalog includes Spring Security readiness evidence', () => {
  const securityBenchmarks = BENCHMARKS.filter((benchmark) => benchmark.pack === 'spring-security-6-readiness');

  assert.equal(securityBenchmarks.length, 5);
  assert.equal(securityBenchmarks.some((benchmark) => benchmark.slug === 'spring-security-samples-legacy'), true);
  assert.equal(securityBenchmarks.some((benchmark) => benchmark.slug === 'spring-petclinic-rest-security'), true);
  assert.equal(securityBenchmarks.every((benchmark) => benchmark.springSecurityDetected), true);
});

test('benchmark catalog includes JUnit 5 readiness evidence', () => {
  const junitBenchmarks = BENCHMARKS.filter((benchmark) => benchmark.pack === 'junit-5-readiness');

  assert.equal(junitBenchmarks.length, 10);
  assert.equal(junitBenchmarks.some((benchmark) => benchmark.slug === 'junit4-samples'), true);
  assert.equal(junitBenchmarks.some((benchmark) => benchmark.slug === 'testcontainers-junit4'), true);
  assert.equal(junitBenchmarks.every((benchmark) => benchmark.junit4Detected), true);
});

test('generates documentation pages from pack metadata', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'emp-pack-docs-'));
  const outDir = path.join(root, 'packs');

  const result = await generatePackDocs({ packsDir: path.resolve('packs'), outDir });
  const index = await fs.readFile(path.join(outDir, 'index.html'), 'utf8');
  const springBoot = await fs.readFile(path.join(outDir, 'spring-boot-3-readiness.html'), 'utf8');
  const java = await fs.readFile(path.join(outDir, 'java-17-to-21-readiness.html'), 'utf8');
  const hibernate = await fs.readFile(path.join(outDir, 'hibernate-readiness.html'), 'utf8');
  const security = await fs.readFile(path.join(outDir, 'spring-security-6-readiness.html'), 'utf8');
  const junit = await fs.readFile(path.join(outDir, 'junit-5-readiness.html'), 'utf8');

  assert.equal(result.count, 6);
  assert.match(index, /Migration Packs/);
  assert.match(index, /Spring Boot 3 Readiness/);
  assert.match(index, /Hibernate Readiness/);
  assert.match(index, /Spring Security 6 Readiness/);
  assert.match(index, /JUnit 5 Readiness/);
  assert.match(springBoot, /Spring Boot 2\.x to 3\.x/);
  assert.match(springBoot, /openrewrite-dry-run/);
  assert.match(springBoot, /node \.\/bin\/emp\.js analyze \/path\/to\/app --pack spring-boot-3-readiness/);
  assert.match(java, /binary compatibility/);
  assert.match(hibernate, /Hibernate 5\.x to 6\.x readiness/);
  assert.match(security, /Spring Security 5\.x to 6\.x readiness/);
  assert.match(junit, /JUnit 4 to JUnit 5 readiness/);
});

test('generates Knowledge Base pages from structured guidance', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'emp-knowledge-base-'));
  const outDir = path.join(root, 'knowledge-base');

  const result = await generateKnowledgeBase({ knowledgeDir: path.resolve('knowledge'), outDir });
  const index = await fs.readFile(path.join(outDir, 'index.html'), 'utf8');
  const hibernate = await fs.readFile(path.join(outDir, 'hibernate-readiness.html'), 'utf8');
  const security = await fs.readFile(path.join(outDir, 'spring-security-6-readiness.html'), 'utf8');
  const junit = await fs.readFile(path.join(outDir, 'junit-5-readiness.html'), 'utf8');
  const trust = await fs.readFile(path.join(outDir, 'trust-engine-evidence.html'), 'utf8');

  assert.equal(result.count, 5);
  assert.match(index, /Knowledge Base/);
  assert.match(index, /Hibernate Readiness Knowledge Base/);
  assert.match(index, /Hibernate Validation Failure Patterns/);
  assert.match(index, /Spring Security 6 Readiness Knowledge Base/);
  assert.match(index, /JUnit 5 Readiness Knowledge Base/);
  assert.match(index, /Trust Engine Evidence Guide/);
  assert.match(hibernate, /Legacy Criteria API/);
  assert.match(hibernate, /What This Does Not Prove/);
  assert.match(hibernate, /hibernate-demos/);
  assert.match(security, /WebSecurityConfigurerAdapter/);
  assert.match(junit, /JUnit 4 API usage/);
  assert.match(trust, /Catalog-only evidence/);
  assert.match(trust, /junit4-samples/);
});

test('generates release notes from feature metadata', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'emp-release-notes-'));
  const outDir = path.join(root, 'release-notes');

  const result = await generateReleaseNotes({ featuresFile: path.resolve('features/catalog.json'), outDir });
  const releaseId = result.releases[0].id;
  const index = await fs.readFile(path.join(outDir, 'index.html'), 'utf8');
  const html = await fs.readFile(path.join(outDir, `${releaseId}.html`), 'utf8');
  const markdown = await fs.readFile(path.join(outDir, `${releaseId}.md`), 'utf8');

  assert.equal(result.count, 30);
  assert.equal(result.featureCount >= 4, true);
  assert.match(index, /Release Notes/);
  assert.match(index, /v0\.5\.6/);
  assert.match(index, /v0\.5\.1/);
  assert.match(html, /Outreach Packet/);
  assert.match(html, /75 checkout-backed reports/);
  assert.match(markdown, new RegExp(`# ${releaseId}`));
  assert.match(markdown, /## Outreach Packet/);
});

test('generates Consultant Demo page and bundle', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'emp-consultant-demo-'));
  const page = path.join(root, 'consultant-demo.html');
  const bundle = path.join(root, 'emp-consultant-demo.zip');

  const result = await generateConsultantDemo({ outFile: page });
  const bundleResult = await buildConsultantDemoBundle({ outFile: bundle, workDir: path.join(root, 'bundle') });
  const html = await fs.readFile(page, 'utf8');
  const bundleStat = await fs.stat(bundle);

  assert.equal(result.count, 3);
  assert.match(html, /Consultant Demo Pack/);
  assert.match(html, /Spring JavaConfig Sample/);
  assert.match(html, /Client Conversation/);
  assert.equal(bundleResult.fileCount > 10, true);
  assert.equal(bundleStat.size > 1000, true);
});

test('local benchmark reports include checkout evidence', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'emp-benchmark-local-'));
  const reposDir = path.join(root, 'repos');
  const checkout = path.join(reposDir, 'spring-petclinic');
  const outDir = path.join(root, 'benchmarks');
  await fs.mkdir(path.join(checkout, 'src/main/java/com/example'), { recursive: true });
  await fs.writeFile(path.join(checkout, 'pom.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>2.7.18</version>
  </parent>
  <properties>
    <java.version>17</java.version>
  </properties>
</project>
`);
  await fs.writeFile(path.join(checkout, 'src/main/java/com/example/Demo.java'), `package com.example;

import javax.persistence.Entity;

@Entity
public class Demo {
}
`);

  const result = await publishBenchmarks({ outDir, source: 'local', only: 'spring-petclinic', reposDir });
  const report = JSON.parse(await fs.readFile(path.join(outDir, 'spring-petclinic', 'report.json'), 'utf8'));
  const html = await fs.readFile(path.join(outDir, 'spring-petclinic', 'index.html'), 'utf8');

  assert.equal(result.reports[0].source, 'checkout');
  assert.equal(report.project.name, 'Spring Petclinic');
  assert.equal(report.project.source, 'https://github.com/spring-projects/spring-petclinic');
  assert.equal(report.benchmark.source, 'checkout');
  assert.equal(report.benchmark.repository, 'https://github.com/spring-projects/spring-petclinic');
  assert.match(html, /Benchmark Evidence/);
});

test('validated local benchmark reports include compile and test evidence', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'emp-benchmark-validation-'));
  const reposDir = path.join(root, 'repos');
  const checkout = path.join(reposDir, 'gs-spring-boot-27');
  const projectRoot = path.join(checkout, 'complete');
  const outDir = path.join(root, 'benchmarks');
  await fs.mkdir(path.join(projectRoot, 'src/main/java/com/example'), { recursive: true });
  await fs.writeFile(path.join(projectRoot, 'pom.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>2.7.18</version>
  </parent>
  <properties>
    <java.version>17</java.version>
  </properties>
</project>
`);
  await fs.writeFile(path.join(projectRoot, 'mvnw'), `#!/bin/sh
echo "fake maven $*"
exit 0
`);
  await fs.chmod(path.join(projectRoot, 'mvnw'), 0o755);
  await fs.writeFile(path.join(projectRoot, 'src/main/java/com/example/Demo.java'), `package com.example;

import javax.persistence.Entity;

@Entity
public class Demo {
}
`);

  const result = await publishBenchmarks({
    outDir,
    source: 'local',
    only: 'gs-spring-boot-27',
    reposDir,
    validate: true,
    validationTimeoutMs: 5000
  });
  const report = JSON.parse(await fs.readFile(path.join(outDir, 'gs-spring-boot-27', 'report.json'), 'utf8'));
  const html = await fs.readFile(path.join(outDir, 'gs-spring-boot-27', 'index.html'), 'utf8');

  assert.equal(result.reports[0].validation.status, 'passed');
  assert.equal(report.project.name, 'Spring Guide Boot 2.7 Sample');
  assert.equal(report.benchmark.ref, 'boot-2.7');
  assert.equal(report.benchmark.analysisPath.endsWith('gs-spring-boot-27/complete'), true);
  assert.equal(report.benchmark.validation.status, 'passed');
  assert.equal(report.benchmark.validation.checks.length, 2);
  assert.equal(report.benchmark.validation.checks.every((check) => check.status === 'passed'), true);
  assert.match(html, /Benchmark Validation/);
  assert.match(html, /Compilation/);
  assert.match(html, /Tests/);
});

test('benchmark validation timeouts force-close attached child processes', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'emp-benchmark-timeout-'));
  const reposDir = path.join(root, 'repos');
  const checkout = path.join(reposDir, 'spring-petclinic');
  const outDir = path.join(root, 'benchmarks');
  await fs.mkdir(path.join(checkout, 'src/main/java/com/example'), { recursive: true });
  await fs.writeFile(path.join(checkout, 'pom.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>2.7.18</version>
  </parent>
  <properties>
    <java.version>17</java.version>
  </properties>
</project>
`);
  await fs.writeFile(path.join(checkout, 'mvnw'), `#!/bin/sh
echo "starting stubborn validation child"
(trap '' TERM; while true; do sleep 1; done) &
wait
`);
  await fs.chmod(path.join(checkout, 'mvnw'), 0o755);
  await fs.writeFile(path.join(checkout, 'src/main/java/com/example/Demo.java'), `package com.example;

import javax.persistence.Entity;

@Entity
public class Demo {
}
`);

  const startedAt = Date.now();
  const result = await publishBenchmarks({
    outDir,
    source: 'local',
    only: 'spring-petclinic',
    reposDir,
    validate: true,
    validationTimeoutMs: 200
  });
  const durationMs = Date.now() - startedAt;
  const report = JSON.parse(await fs.readFile(path.join(outDir, 'spring-petclinic', 'report.json'), 'utf8'));

  assert.equal(durationMs < 5000, true);
  assert.equal(result.reports[0].validation.status, 'failed');
  assert.equal(report.benchmark.validation.checks.length, 2);
  assert.equal(report.benchmark.validation.checks.every((check) => check.timedOut), true);
  assert.equal(report.benchmark.validation.checks.every((check) => [124, 143, null].includes(check.exitCode)), true);
  assert.match(report.benchmark.validation.checks[0].output, /Command timed out after 200 ms/);
});

test('benchmark validation can require a specific Java runtime', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'emp-benchmark-java-runtime-'));
  const reposDir = path.join(root, 'repos');
  const checkout = path.join(reposDir, 'spring-boot-realworld');
  const outDir = path.join(root, 'benchmarks');
  const javaHome = path.join(root, 'jdk17');
  const previousJavaHome = process.env.EMP_JAVA_17_HOME;

  await fs.mkdir(path.join(checkout, 'src/main/java/com/example'), { recursive: true });
  await fs.mkdir(path.join(javaHome, 'bin'), { recursive: true });
  await fs.writeFile(path.join(checkout, 'build.gradle'), `
plugins {
  id 'org.springframework.boot' version '2.6.3'
}
`);
  await fs.writeFile(path.join(checkout, 'gradlew'), `#!/bin/sh
test "$JAVA_HOME" = "${javaHome}" || exit 42
echo "fake gradle $*"
exit 0
`);
  await fs.chmod(path.join(checkout, 'gradlew'), 0o755);
  await fs.writeFile(path.join(checkout, 'src/main/java/com/example/Demo.java'), `package com.example;

import javax.persistence.Entity;

@Entity
public class Demo {
}
`);

  try {
    process.env.EMP_JAVA_17_HOME = javaHome;
    const result = await publishBenchmarks({
      outDir,
      source: 'local',
      only: 'spring-boot-realworld',
      reposDir,
      validate: true,
      validationTimeoutMs: 5000
    });
    const report = JSON.parse(await fs.readFile(path.join(outDir, 'spring-boot-realworld', 'report.json'), 'utf8'));

    assert.equal(result.reports[0].validation.status, 'passed');
    assert.equal(report.benchmark.validation.checks.length, 2);
    assert.equal(report.benchmark.validation.checks.every((check) => check.command.startsWith('JAVA_HOME=<JDK 17>')), true);
    assert.equal(JSON.stringify(report).includes(javaHome), false);
  } finally {
    if (previousJavaHome === undefined) delete process.env.EMP_JAVA_17_HOME;
    else process.env.EMP_JAVA_17_HOME = previousJavaHome;
  }
});

test('Pack mismatch suppresses readiness score for non-applicable Spring Boot report', async () => {
  const root = await makeSpringProject();
  const pom = path.join(root, 'pom.xml');
  await fs.writeFile(pom, (await fs.readFile(pom, 'utf8')).replace('<version>2.7.18</version>', '<version>4.0.0-SNAPSHOT</version>'));

  const scan = await analyzeProject({ root, pack: 'spring-boot-3-readiness' });
  const readiness = scoreReadiness(scan);

  assert.equal(scan.packApplicability.applicable, false);
  assert.equal(readiness.overall, null);
  assert.equal(readiness.status, 'not_applicable');
  assert.match(readiness.summary, /Pack mismatch/);
});

test('Reports separate test findings and aggregate repeated finding types', async () => {
  const root = await makeSpringProject();
  const outDir = path.join(root, 'report');
  await fs.mkdir(path.join(root, 'src/test/java/com/example'), { recursive: true });
  await fs.writeFile(path.join(root, 'src/main/java/com/example/Logging.java'), `package com.example;

public class Logging {
  void run() {
    System.out.println("prod");
  }
}
`);
  await fs.writeFile(path.join(root, 'src/test/java/com/example/LoggingTest.java'), `package com.example;

public class LoggingTest {
  void run() {
    System.out.println("test");
    System.out.println("again");
  }
}
`);

  const scan = await analyzeProject({ root });
  const readiness = scoreReadiness(scan);
  const bundle = await writeReportBundle({ outDir, scan, readiness });
  const report = JSON.parse(await fs.readFile(bundle.jsonPath, 'utf8'));
  const html = await fs.readFile(bundle.htmlPath, 'utf8');

  assert.equal(report.findingSummary.byCode['system-out'].production, 1);
  assert.equal(report.findingSummary.byCode['system-out'].test, 2);
  assert.equal(report.productionFindings.some((finding) => finding.file?.includes('Logging.java')), true);
  assert.equal(report.testFindings.some((finding) => finding.file?.includes('LoggingTest.java')), true);
  assert.match(html, /Finding Summary/);
});

test('dry-run, apply, and rollback preserve project files', async () => {
  const root = await makeSpringProject();
  const sourceFile = path.join(root, 'src/main/java/com/example/Demo.java');
  const original = await fs.readFile(sourceFile, 'utf8');

  const dryRun = await transformProject({ root, mode: 'dry-run' });
  assert.equal(dryRun.status, 'dry-run');
  assert.equal(dryRun.plan.changes.length, 1);
  assert.equal(await fs.readFile(sourceFile, 'utf8'), original);

  const apply = await transformProject({ root, mode: 'apply' });
  assert.equal(apply.status, 'applied');
  assert.equal(apply.applied.length, 1);
  assert.match(await fs.readFile(sourceFile, 'utf8'), /jakarta\.persistence\.Entity/);
  assert.equal(apply.rollback.status, 'created');

  const rollback = await transformProject({ root, mode: 'rollback' });
  assert.equal(rollback.status, 'rolled-back');
  assert.equal(await fs.readFile(sourceFile, 'utf8'), original);
});

test('validation is captured and explicit OpenRewrite does not silently downgrade', async () => {
  const root = await makeSpringProject();

  const validationOnly = await transformProject({ root, mode: 'dry-run', validate: true });
  assert.equal(validationOnly.validation.length, 2);
  assert.equal(validationOnly.validation.every((item) => item.status === 'failed'), true);

  const openRewrite = await transformProject({ root, mode: 'dry-run', engine: 'openrewrite' });
  assert.equal(openRewrite.engine, 'openrewrite');
  assert.equal(openRewrite.status, 'failed');
  assert.equal(openRewrite.execution[0].status, 'failed');
});

test('Java 17 to 21 pack plans target updates and reports trust evidence', async () => {
  const root = await makeSpringProject();
  const outDir = path.join(root, 'report');
  const pom = path.join(root, 'pom.xml');

  await fs.writeFile(path.join(root, 'src/main/java/com/example/LegacyPayload.java'), `package com.example;

import java.io.Serializable;
import java.lang.reflect.Method;

public class LegacyPayload implements Serializable {
  public Method method;
}
`);

  const dryRun = await transformProject({ root, pack: 'java-17-to-21-readiness', mode: 'dry-run' });
  assert.equal(dryRun.status, 'dry-run');
  assert.equal(dryRun.plan.changes.length, 1);
  assert.match(dryRun.plan.changes[0].recipe, /java-17-to-21-target/);
  assert.match(await fs.readFile(pom, 'utf8'), /<java\.version>17<\/java\.version>/);

  const apply = await transformProject({ root, pack: 'java-17-to-21-readiness', mode: 'apply' });
  assert.equal(apply.status, 'applied');
  assert.match(await fs.readFile(pom, 'utf8'), /<java\.version>21<\/java\.version>/);

  const scan = await analyzeProject({ root, pack: 'java-17-to-21-readiness' });
  const readiness = scoreReadiness(scan);
  const bundle = await writeReportBundle({ outDir, scan, readiness, transformation: apply });
  const report = JSON.parse(await fs.readFile(bundle.jsonPath, 'utf8'));

  assert.equal(report.trust.schemaVersion, 'emp.trust.v1');
  assert.equal(report.trust.tier, 'professional');
  assert.equal(report.trust.checks.some((check) => check.name === 'Binary compatibility'), true);
  assert.equal(report.trust.checks.some((check) => check.name === 'Public API compatibility'), true);
  assert.equal(report.trust.factors.some((factor) => factor.id === 'compile-validation' && factor.status === 'missing'), true);
  assert.equal(report.trust.factors.some((factor) => factor.id === 'binary-compatibility-risk' && factor.impact < 0), true);
  assert.match(await fs.readFile(bundle.htmlPath, 'utf8'), /Trust Factors/);
});

test('Trust Engine factors reward passing validation evidence', async () => {
  const root = await makeSpringProject();
  const outDir = path.join(root, 'report');
  await fs.writeFile(path.join(root, 'mvnw'), `#!/bin/sh
echo "fake maven $*"
exit 0
`);
  await fs.chmod(path.join(root, 'mvnw'), 0o755);

  const transformation = await transformProject({ root, mode: 'apply', validate: true });
  const scan = await analyzeProject({ root });
  const readiness = scoreReadiness(scan);
  const bundle = await writeReportBundle({ outDir, scan, readiness, transformation });
  const report = JSON.parse(await fs.readFile(bundle.jsonPath, 'utf8'));

  assert.equal(report.trust.factors.some((factor) => factor.id === 'compile-validation' && factor.status === 'passed' && factor.impact > 0), true);
  assert.equal(report.trust.factors.some((factor) => factor.id === 'test-validation' && factor.status === 'passed' && factor.impact > 0), true);
  assert.equal(report.trust.factors.some((factor) => factor.id === 'rollback-evidence' && factor.status === 'passed'), true);
  assert.equal(report.trust.confidence >= 80, true);
});

test('Hibernate readiness pack detects ORM upgrade risks', async () => {
  const root = await makeSpringProject();
  const outDir = path.join(root, 'report');
  await fs.writeFile(path.join(root, 'pom.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <dependencies>
    <dependency>
      <groupId>org.hibernate</groupId>
      <artifactId>hibernate-core</artifactId>
      <version>5.6.15.Final</version>
    </dependency>
  </dependencies>
  <properties>
    <java.version>17</java.version>
  </properties>
</project>
`);
  await fs.writeFile(path.join(root, 'src/main/java/com/example/Persistence.java'), `package com.example;

import org.hibernate.Criteria;
import org.hibernate.Session;
import org.hibernate.SessionFactory;
import org.hibernate.usertype.UserType;

public class Persistence {
  private SessionFactory sessionFactory;
  Criteria criteria(Session session) {
    return session.createCriteria(Persistence.class);
  }
  UserType type;
}
`);
  await fs.mkdir(path.join(root, 'src/main/resources/com/example'), { recursive: true });
  await fs.writeFile(path.join(root, 'src/main/resources/com/example/Persistence.hbm.xml'), '<hibernate-mapping></hibernate-mapping>');

  const scan = await analyzeProject({ root, pack: 'hibernate-readiness' });
  const readiness = scoreReadiness(scan);
  const bundle = await writeReportBundle({ outDir, scan, readiness });
  const report = JSON.parse(await fs.readFile(bundle.jsonPath, 'utf8'));
  const html = await fs.readFile(bundle.htmlPath, 'utf8');

  assert.equal(scan.packApplicability.applicable, true);
  assert.equal(scan.dependencies.hibernateDetected, true);
  assert.equal(scan.findings.some((finding) => finding.code === 'hibernate-legacy-criteria'), true);
  assert.equal(scan.findings.some((finding) => finding.code === 'hibernate-session-api'), true);
  assert.equal(scan.findings.some((finding) => finding.code === 'hibernate-custom-type'), true);
  assert.equal(scan.findings.some((finding) => finding.code === 'hibernate-xml-mapping'), true);
  assert.equal(Object.hasOwn(readiness.categories, 'hibernate'), true);
  assert.equal(report.nextActions.some((action) => action.id === 'review-hibernate-upgrade-risks'), true);
  assert.match(html, /Review Hibernate API and mapping upgrade risks/);
});

test('Hibernate readiness pack reports mismatch when Hibernate is absent', async () => {
  const root = await makeSpringProject();
  const sourceFile = path.join(root, 'src/main/java/com/example/Demo.java');
  await fs.writeFile(sourceFile, 'package com.example;\npublic class Demo {}\n');

  const scan = await analyzeProject({ root, pack: 'hibernate-readiness' });
  const readiness = scoreReadiness(scan);

  assert.equal(scan.dependencies.hibernateDetected, false);
  assert.equal(scan.packApplicability.applicable, false);
  assert.equal(readiness.status, 'not_applicable');
  assert.match(readiness.summary, /Hibernate ORM usage was not detected/);
});

test('Spring Security 6 readiness pack detects security configuration risks', async () => {
  const root = await makeSpringProject();
  const outDir = path.join(root, 'report');
  await fs.writeFile(path.join(root, 'pom.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <dependencies>
    <dependency>
      <groupId>org.springframework.security</groupId>
      <artifactId>spring-security-config</artifactId>
      <version>5.8.11</version>
    </dependency>
  </dependencies>
  <properties>
    <java.version>17</java.version>
  </properties>
</project>
`);
  await fs.writeFile(path.join(root, 'src/main/java/com/example/SecurityConfig.java'), `package com.example;

import org.springframework.security.config.annotation.method.configuration.EnableGlobalMethodSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityConfigurerAdapter;

@EnableGlobalMethodSecurity(prePostEnabled = true)
public class SecurityConfig extends WebSecurityConfigurerAdapter {
  void configure() {
    http().authorizeRequests().antMatchers("/admin/**").hasRole("ADMIN");
  }
  Http http() {
    return new Http();
  }
  static class Http {
    Http authorizeRequests() { return this; }
    Http antMatchers(String pattern) { return this; }
    Http hasRole(String role) { return this; }
  }
}
`);

  const scan = await analyzeProject({ root, pack: 'spring-security-6-readiness' });
  const readiness = scoreReadiness(scan);
  const bundle = await writeReportBundle({ outDir, scan, readiness });
  const report = JSON.parse(await fs.readFile(bundle.jsonPath, 'utf8'));
  const html = await fs.readFile(bundle.htmlPath, 'utf8');

  assert.equal(scan.packApplicability.applicable, true);
  assert.equal(scan.dependencies.springSecurityDetected, true);
  assert.equal(scan.dependencies.springSecurityVersion, '5.8.11');
  assert.equal(scan.findings.some((finding) => finding.code === 'spring-security-5'), true);
  assert.equal(scan.findings.some((finding) => finding.code === 'spring-security-websecurityconfigureradapter'), true);
  assert.equal(scan.findings.some((finding) => finding.code === 'spring-security-legacy-matchers'), true);
  assert.equal(scan.findings.some((finding) => finding.code === 'spring-security-authorize-requests'), true);
  assert.equal(scan.findings.some((finding) => finding.code === 'spring-security-global-method-security'), true);
  assert.equal(Object.hasOwn(readiness.categories, 'security'), true);
  assert.equal(report.nextActions.some((action) => action.id === 'review-spring-security-6-risks'), true);
  assert.match(html, /Review Spring Security 6 configuration risks/);
});

test('Spring Security 6 readiness pack reports mismatch when Spring Security is absent', async () => {
  const root = await makeSpringProject();
  const sourceFile = path.join(root, 'src/main/java/com/example/Demo.java');
  await fs.writeFile(sourceFile, 'package com.example;\npublic class Demo {}\n');

  const scan = await analyzeProject({ root, pack: 'spring-security-6-readiness' });
  const readiness = scoreReadiness(scan);

  assert.equal(scan.dependencies.springSecurityDetected, false);
  assert.equal(scan.packApplicability.applicable, false);
  assert.equal(readiness.status, 'not_applicable');
  assert.match(readiness.summary, /Spring Security usage was not detected/);
});

test('JUnit 5 readiness pack detects JUnit 4 migration risks', async () => {
  const root = await makeSpringProject();
  const outDir = path.join(root, 'report');
  await fs.writeFile(path.join(root, 'pom.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <dependencies>
    <dependency>
      <groupId>junit</groupId>
      <artifactId>junit</artifactId>
      <version>4.13.2</version>
      <scope>test</scope>
    </dependency>
  </dependencies>
  <properties>
    <java.version>17</java.version>
  </properties>
</project>
`);
  await fs.mkdir(path.join(root, 'src/test/java/com/example'), { recursive: true });
  await fs.writeFile(path.join(root, 'src/test/java/com/example/DemoTest.java'), `package com.example;

import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(DemoRunner.class)
public class DemoTest {
  @Before
  public void setUp() {}

  @Test
  public void works() {
    Assert.assertTrue(true);
  }
}

class DemoRunner {}
`);

  const scan = await analyzeProject({ root, pack: 'junit-5-readiness' });
  const readiness = scoreReadiness(scan);
  const bundle = await writeReportBundle({ outDir, scan, readiness });
  const report = JSON.parse(await fs.readFile(bundle.jsonPath, 'utf8'));
  const html = await fs.readFile(bundle.htmlPath, 'utf8');

  assert.equal(scan.packApplicability.applicable, true);
  assert.equal(scan.dependencies.junit4Detected, true);
  assert.equal(scan.findings.some((finding) => finding.code === 'junit4-api-usage'), true);
  assert.equal(scan.findings.some((finding) => finding.code === 'junit4-runner-usage'), true);
  assert.equal(scan.findings.some((finding) => finding.code === 'junit4-dependency'), true);
  assert.equal(Object.hasOwn(readiness.categories, 'testing'), true);
  assert.equal(report.nextActions.some((action) => action.id === 'review-junit-5-migration-risks'), true);
  assert.match(html, /Review JUnit 4 to JUnit 5 migration risks/);
});

test('JUnit 5 readiness pack reports mismatch when JUnit 4 is absent', async () => {
  const root = await makeSpringProject();
  const sourceFile = path.join(root, 'src/test/java/com/example/DemoTest.java');
  await fs.mkdir(path.dirname(sourceFile), { recursive: true });
  await fs.writeFile(sourceFile, 'package com.example;\npublic class DemoTest {}\n');

  const scan = await analyzeProject({ root, pack: 'junit-5-readiness' });
  const readiness = scoreReadiness(scan);

  assert.equal(scan.dependencies.junit4Detected, false);
  assert.equal(scan.packApplicability.applicable, false);
  assert.equal(readiness.status, 'not_applicable');
  assert.match(readiness.summary, /JUnit 4 usage was not detected/);
});

test('enterprise rules affect readiness and appear in reports', async () => {
  const root = await makeSpringProject();
  const outDir = path.join(root, 'report');
  await fs.writeFile(path.join(root, '.preflight-rules.yml'), `rules:
  - name: javax forbidden
    type: forbidden-package
    pattern: javax.*
  - name: System.out forbidden
    type: forbidden-call
    pattern: System.out
`);
  await fs.writeFile(path.join(root, 'src/main/java/com/example/Logging.java'), `package com.example;

public class Logging {
  void run() {
    System.out.println("x");
  }
}
`);

  const scan = await analyzeProject({ root });
  const rules = await evaluateEnterpriseRules({ root, scan, rules: await loadEnterpriseRules(root) });
  const readiness = scoreReadiness(scan, rules);
  const bundle = await writeReportBundle({ outDir, scan, readiness, rules });
  const report = JSON.parse(await fs.readFile(bundle.jsonPath, 'utf8'));

  assert.equal(rules.loaded, true);
  assert.equal(rules.violations.length, 2);
  assert.equal(readiness.categories.enterpriseRules, 60);
  assert.equal(report.rules.violations.length, 2);
  assert.match(await fs.readFile(bundle.htmlPath, 'utf8'), /Enterprise Rules/);
});

test('enterprise rules support metadata and path scoping', async () => {
  const root = await makeSpringProject();
  const outDir = path.join(root, 'report');
  await fs.mkdir(path.join(root, 'src/test/java/com/example'), { recursive: true });
  await fs.writeFile(path.join(root, '.preflight-rules.yml'), `rules:
  - name: production console output
    type: forbidden-call
    pattern: System.out
    severity: warning
    category: code-quality
    owner: platform-team
    rationale: Production output must use structured logging.
    remediation: https://example.com/logging-standard
    paths: src/main/java/**
    exclude-paths: src/test/**
`);
  await fs.writeFile(path.join(root, 'src/main/java/com/example/Logging.java'), `package com.example;

public class Logging {
  void run() {
    System.out.println("prod");
  }
}
`);
  await fs.writeFile(path.join(root, 'src/test/java/com/example/LoggingTest.java'), `package com.example;

public class LoggingTest {
  void run() {
    System.out.println("test");
  }
}
`);

  const scan = await analyzeProject({ root });
  const rules = await evaluateEnterpriseRules({ root, scan, rules: await loadEnterpriseRules(root) });
  const readiness = scoreReadiness(scan, rules);
  const bundle = await writeReportBundle({ outDir, scan, readiness, rules });
  const report = JSON.parse(await fs.readFile(bundle.jsonPath, 'utf8'));
  const html = await fs.readFile(bundle.htmlPath, 'utf8');

  assert.equal(rules.rules[0].category, 'code-quality');
  assert.equal(rules.rules[0].owner, 'platform-team');
  assert.deepEqual(rules.rules[0].paths, ['src/main/java/**']);
  assert.deepEqual(rules.rules[0].excludePaths, ['src/test/**']);
  assert.equal(rules.violations.length, 1);
  assert.equal(rules.violations[0].file, 'src/main/java/com/example/Logging.java');
  assert.equal(report.rules.violations[0].rationale, 'Production output must use structured logging.');
  assert.match(html, /platform-team/);
  assert.match(html, /code-quality/);
});

test('MCP analyze returns rule-aware readiness evidence', async () => {
  const root = await makeSpringProject();
  await fs.writeFile(path.join(root, '.preflight-rules.yml'), `rules:
  - name: javax forbidden
    type: forbidden-package
    pattern: javax.*
`);

  const result = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 7,
    method: 'tools/call',
    params: {
      name: 'emp.analyze',
      arguments: { path: root }
    }
  });
  const payload = JSON.parse(result.result.content[0].text);

  assert.equal(result.id, 7);
  assert.equal(payload.packApplicability.applicable, true);
  assert.equal(payload.rules.loaded, true);
  assert.equal(payload.rules.violations.length, 1);
  assert.equal(payload.readiness.categories.enterpriseRules, 80);
});

test('MCP exposes modernization pack metadata beyond analysis', async () => {
  const list = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 8,
    method: 'tools/list'
  });
  assert.equal(list.result.tools.some((tool) => tool.name === 'emp.packs'), true);

  const packsResult = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 9,
    method: 'tools/call',
    params: {
      name: 'emp.packs',
      arguments: {}
    }
  });
  const packsPayload = JSON.parse(packsResult.result.content[0].text);
  assert.equal(packsPayload.packs.some((pack) => pack.id === 'junit-5-readiness'), true);
  assert.equal(packsPayload.packs.every((pack) => Number.isInteger(pack.checkCount)), true);

  const detailResult = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 10,
    method: 'tools/call',
    params: {
      name: 'emp.packs',
      arguments: { id: 'junit-5-readiness' }
    }
  });
  const detailPayload = JSON.parse(detailResult.result.content[0].text);
  assert.equal(detailPayload.id, 'junit-5-readiness');
  assert.equal(detailPayload.checks.some((check) => check.id === 'junit4-detection'), true);

  const missingResult = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 11,
    method: 'tools/call',
    params: {
      name: 'emp.packs',
      arguments: { id: 'missing-pack' }
    }
  });
  assert.equal(missingResult.error.code, -32602);
});

test('MCP exposes published benchmark evidence summaries', async () => {
  const list = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 12,
    method: 'tools/list'
  });
  assert.equal(list.result.tools.some((tool) => tool.name === 'emp.benchmarks'), true);

  const summaryResult = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 13,
    method: 'tools/call',
    params: {
      name: 'emp.benchmarks',
      arguments: { pack: 'junit-5-readiness', source: 'checkout', limit: 3 }
    }
  });
  const summary = JSON.parse(summaryResult.result.content[0].text);
  assert.equal(summary.filters.pack, 'junit-5-readiness');
  assert.equal(summary.filters.source, 'checkout');
  assert.equal(summary.totals.checkoutBacked >= 1, true);
  assert.equal(summary.filters.limit, summary.benchmarks.length);
  assert.equal(summary.benchmarks.length <= 3, true);
  assert.equal(summary.benchmarks.every((benchmark) => benchmark.pack === 'junit-5-readiness'), true);
  assert.equal(summary.benchmarks.every((benchmark) => benchmark.source === 'checkout'), true);
  assert.equal(summary.benchmarks.every((benchmark) => benchmark.reportPath.endsWith('/index.html')), true);

  const passedResult = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 14,
    method: 'tools/call',
    params: {
      name: 'emp.benchmarks',
      arguments: { validationStatus: 'passed', limit: 2 }
    }
  });
  const passed = JSON.parse(passedResult.result.content[0].text);
  assert.equal(passed.benchmarks.every((benchmark) => benchmark.validationStatus === 'passed'), true);
  assert.equal(passed.totals.validationPassed >= passed.benchmarks.length, true);
});

test('MCP transformPlan returns a dry-run plan without mutating files', async () => {
  const root = await makeSpringProject();
  const sourceFile = path.join(root, 'src/main/java/com/example/Demo.java');
  const before = await fs.readFile(sourceFile, 'utf8');

  const list = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 15,
    method: 'tools/list'
  });
  assert.equal(list.result.tools.some((tool) => tool.name === 'emp.transformPlan'), true);

  const planResult = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 16,
    method: 'tools/call',
    params: {
      name: 'emp.transformPlan',
      arguments: { path: root, pack: 'spring-boot-3-readiness', engine: 'native' }
    }
  });
  const plan = JSON.parse(planResult.result.content[0].text);
  const after = await fs.readFile(sourceFile, 'utf8');

  assert.equal(plan.mode, 'dry-run');
  assert.equal(plan.status, 'dry-run');
  assert.equal(plan.engine, 'native');
  assert.equal(plan.planEngine, 'emp-native-rewrite');
  assert.equal(plan.plannedChanges, 1);
  assert.equal(plan.changes[0].file, 'src/main/java/com/example/Demo.java');
  assert.equal(plan.changes[0].recipe, 'javax-to-jakarta-namespace');
  assert.equal(plan.appliedChanges, 0);
  assert.equal(after, before);
});

test('MCP docs and smoke verification are packaged', async () => {
  const packageJson = await fs.readFile(path.resolve('package.json'), 'utf8');
  const mcpDocs = await fs.readFile(path.resolve('docs/mcp.html'), 'utf8');
  const home = await fs.readFile(path.resolve('docs/index.html'), 'utf8');
  const verifier = await fs.readFile(path.resolve('scripts/mcp-verify.js'), 'utf8');

  assert.match(packageJson, /"mcp:verify"/);
  assert.match(packageJson, /npm run mcp:verify/);
  assert.match(mcpDocs, /emp\.transformPlan/);
  assert.match(mcpDocs, /Recommended Workflow/);
  assert.match(home, /mcp\.html/);
  assert.match(verifier, /emp\.benchmarks/);
});

test('GitHub Action exposes Docker readiness analysis inputs', async () => {
  const action = await fs.readFile(path.resolve('action.yml'), 'utf8');
  const dockerfile = await fs.readFile(path.resolve('Dockerfile'), 'utf8');
  const entrypoint = await fs.readFile(path.resolve('docker-entrypoint.sh'), 'utf8');
  const githubDocs = await fs.readFile(path.resolve('docs/ci-github-action.md'), 'utf8');
  const quickstart = await fs.readFile(path.resolve('docs/quickstart.html'), 'utf8');
  const externalTrial = await fs.readFile(path.resolve('docs/external-trial.html'), 'utf8');
  const outreachPacket = await fs.readFile(path.resolve('docs/outreach-packet.html'), 'utf8');
  const dockerDocs = await fs.readFile(path.resolve('docs/docker-wrapper.md'), 'utf8');
  const ciDocs = await fs.readFile(path.resolve('docs/ci-examples.md'), 'utf8');
  const releaseDocs = await fs.readFile(path.resolve('docs/release-checklist.md'), 'utf8');

  assert.match(action, /using: docker/);
  assert.match(action, /image: Dockerfile/);
  assert.match(action, /spring-boot-3-readiness/);
  assert.match(action, /--rules/);
  assert.match(dockerfile, /docker-entrypoint\.sh/);
  assert.match(dockerfile, /zip/);
  assert.match(dockerfile, /COPY scripts \.\/scripts/);
  assert.match(dockerfile, /COPY features \.\/features/);
  assert.match(dockerfile, /COPY knowledge \.\/knowledge/);
  assert.match(entrypoint, /GITHUB_WORKSPACE:-\/workspace/);
  assert.match(await fs.readFile(path.resolve('package.json'), 'utf8'), /"release:verify"/);
  assert.match(await fs.readFile(path.resolve('package.json'), 'utf8'), /"ci:verify"/);
  assert.match(await fs.readFile(path.resolve('package.json'), 'utf8'), /"docs:generate"/);
  assert.match(await fs.readFile(path.resolve('package.json'), 'utf8'), /"knowledge:generate"/);
  assert.match(await fs.readFile(path.resolve('package.json'), 'utf8'), /"release-notes:generate"/);
  assert.match(await fs.readFile(path.resolve('package.json'), 'utf8'), /pack-docs\.js/);
  assert.match(await fs.readFile(path.resolve('package.json'), 'utf8'), /knowledge-base\.js/);
  assert.match(await fs.readFile(path.resolve('package.json'), 'utf8'), /release-notes\.js/);
  assert.match(await fs.readFile(path.resolve('scripts/ci-examples-verify.js'), 'utf8'), /command_equivalent_verified/);
  assert.match(await fs.readFile(path.resolve('scripts/release-verify.js'), 'utf8'), /Release verification passed/);
  assert.match(await fs.readFile(path.resolve('scripts/benchmark-publish.js'), 'utf8'), /generatePackDocs/);
  assert.match(await fs.readFile(path.resolve('scripts/benchmark-publish.js'), 'utf8'), /generateKnowledgeBase/);
  assert.match(await fs.readFile(path.resolve('scripts/benchmark-publish.js'), 'utf8'), /generateReleaseNotes/);
  assert.match(githubDocs, /actions\/upload-artifact@v4/);
  assert.match(quickstart, /Run a readiness report in 5 minutes/);
  assert.match(quickstart, /danielrna\/enterprise-modernization-platform:v0\.5\.6/);
  assert.match(quickstart, /emp-readiness-report/);
  assert.match(quickstart, /Common First-Run Friction/);
  assert.match(externalTrial, /External Trial Proof/);
  assert.match(externalTrial, /28680350526/);
  assert.match(externalTrial, /emp-readiness-report/);
  assert.match(externalTrial, /Docker Trial Runs/);
  assert.match(externalTrial, /callicoder\/spring-boot-mysql-rest-api-tutorial/);
  assert.match(externalTrial, /mertakdut\/Spring-Boot-Sample-Project/);
  assert.match(externalTrial, /9 external-trial snapshots/);
  assert.match(externalTrial, /Conversion Case Studies/);
  assert.match(outreachPacket, /Outreach Packet/);
  assert.match(outreachPacket, /Readiness Cleanup/);
  assert.match(outreachPacket, /Copy And Send/);
  assert.match(githubDocs, /emp-report\/index\.html/);
  assert.match(dockerDocs, /docker run --rm/);
  assert.match(ciDocs, /GitLab CI/);
  assert.match(ciDocs, /Azure DevOps/);
  assert.match(ciDocs, /command-equivalent Docker runs/);
  assert.match(ciDocs, /Hosted GitLab\/Jenkins\/Azure validation still requires real projects/);
  assert.match(releaseDocs, /npm run ci:verify/);
  assert.match(releaseDocs, /Publish the Docker image/);
  assert.match(releaseDocs, /Validate the GitHub Action from a separate .* repository/);
});

test('Generated reports and cloned benchmark repositories are ignored at the workspace root', async () => {
  const root = await makeSpringProject();
  await fs.mkdir(path.join(root, 'benchmark-repos/noisy/src/main/java'), { recursive: true });
  await fs.writeFile(path.join(root, 'benchmark-repos/noisy/src/main/java/Noisy.java'), 'import javax.persistence.Entity;');
  await fs.mkdir(path.join(root, 'reports/old'), { recursive: true });
  await fs.writeFile(path.join(root, 'reports/old/Noisy.java'), 'import javax.persistence.Entity;');

  const sourceFile = path.join(root, 'src/main/java/com/example/Demo.java');
  await fs.writeFile(sourceFile, 'package com.example;\npublic class Demo {}\n');

  const scan = await analyzeProject({ root });
  const transform = await transformProject({ root, mode: 'dry-run' });

  assert.equal(scan.dependencies.javaxDetected, false);
  assert.equal(transform.plan.changes.length, 0);
});

async function makeSpringProject() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'emp-project-'));
  await fs.mkdir(path.join(root, 'src/main/java/com/example'), { recursive: true });
  await fs.writeFile(path.join(root, 'pom.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>2.7.18</version>
  </parent>
  <properties>
    <java.version>17</java.version>
  </properties>
</project>
`);
  await fs.writeFile(path.join(root, 'src/main/java/com/example/Demo.java'), `package com.example;

import javax.persistence.Entity;

@Entity
public class Demo {
}
`);
  return root;
}

async function runNode(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: process.cwd() });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (exitCode) => {
      resolve({ exitCode, stdout, stderr });
    });
  });
}
