import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { analyzeProject } from '../src/scanner.js';
import { scoreReadiness } from '../src/readiness.js';
import { writeReportBundle } from '../src/report.js';
import { publishBenchmarks } from '../src/benchmarks.js';
import { generateMigrationHub } from '../src/hub.js';
import { transformProject } from '../src/transform.js';
import { loadEnterpriseRules, evaluateEnterpriseRules } from '../src/rules.js';
import { handleMcpRequest } from '../src/mcp.js';

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
  assert.match(await fs.readFile(bundle.htmlPath, 'utf8'), /Trust Engine/);
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

test('GitHub Action exposes Docker readiness analysis inputs', async () => {
  const action = await fs.readFile(path.resolve('action.yml'), 'utf8');
  const dockerfile = await fs.readFile(path.resolve('Dockerfile'), 'utf8');
  const entrypoint = await fs.readFile(path.resolve('docker-entrypoint.sh'), 'utf8');
  const githubDocs = await fs.readFile(path.resolve('docs/ci-github-action.md'), 'utf8');
  const dockerDocs = await fs.readFile(path.resolve('docs/docker-wrapper.md'), 'utf8');
  const ciDocs = await fs.readFile(path.resolve('docs/ci-examples.md'), 'utf8');
  const releaseDocs = await fs.readFile(path.resolve('docs/release-checklist.md'), 'utf8');

  assert.match(action, /using: docker/);
  assert.match(action, /image: Dockerfile/);
  assert.match(action, /spring-boot-3-readiness/);
  assert.match(action, /--rules/);
  assert.match(dockerfile, /docker-entrypoint\.sh/);
  assert.match(dockerfile, /COPY scripts \.\/scripts/);
  assert.match(entrypoint, /GITHUB_WORKSPACE:-\/workspace/);
  assert.match(await fs.readFile(path.resolve('package.json'), 'utf8'), /"release:verify"/);
  assert.match(await fs.readFile(path.resolve('scripts/release-verify.js'), 'utf8'), /Release verification passed/);
  assert.match(githubDocs, /actions\/upload-artifact@v4/);
  assert.match(githubDocs, /emp-report\/index\.html/);
  assert.match(dockerDocs, /docker run --rm/);
  assert.match(ciDocs, /GitLab CI/);
  assert.match(ciDocs, /Azure DevOps/);
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
