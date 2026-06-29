import fs from 'node:fs/promises';
import path from 'node:path';

const IGNORED_DIRS = new Set(['.emp', '.git', '.gradle', '.idea', '.mvn/wrapper', 'benchmark-repos', 'build', 'dist', 'node_modules', 'reports', 'target']);
const TEXT_EXTENSIONS = new Set(['.java', '.kt', '.xml', '.gradle', '.properties', '.yml', '.yaml']);

export async function analyzeProject({ root, pack = 'spring-boot-3-readiness', benchmarkMetadata = null }) {
  if (benchmarkMetadata) return analyzeBenchmarkMetadata({ root, pack, benchmarkMetadata });

  const files = await walk(root);
  const textFiles = files.filter((file) => TEXT_EXTENSIONS.has(path.extname(file)) || file.endsWith('build.gradle.kts'));
  const contents = await readTextFiles(root, textFiles);
  const manifests = detectManifests(textFiles, contents, pack);
  const dependencies = detectDependencies(contents);
  const findings = detectFindings(contents, dependencies, manifests);
  const packApplicability = evaluatePackApplicability({ pack, manifests, dependencies });

  return {
    generatedAt: new Date().toISOString(),
    pack,
    project: {
      name: path.basename(root),
      root,
      source: 'local',
      buildTools: manifests.buildTools,
      javaVersion: manifests.javaVersion,
      springBootVersion: dependencies.springBootVersion,
      fileCount: files.length,
      javaFileCount: textFiles.filter((file) => file.endsWith('.java')).length
    },
    dependencies,
    packApplicability,
    findings,
    evidence: buildEvidence(findings, manifests, dependencies)
  };
}

async function analyzeBenchmarkMetadata({ root, pack, benchmarkMetadata }) {
  const findings = benchmarkMetadata.findings.map((finding) => ({ ...finding }));
  for (const finding of findings) finding.scope = classifyScope(finding.file);
  const manifests = { buildTools: benchmarkMetadata.buildTools, javaVersion: benchmarkMetadata.javaVersion, pack };
  const dependencies = {
    springBootVersion: benchmarkMetadata.springBootVersion,
    jakartaDetected: benchmarkMetadata.jakartaDetected,
    javaxDetected: benchmarkMetadata.javaxDetected,
    hibernateDetected: benchmarkMetadata.hibernateDetected,
    springSecurityDetected: benchmarkMetadata.springSecurityDetected
  };
  return {
    generatedAt: new Date().toISOString(),
    pack,
    project: {
      name: benchmarkMetadata.name,
      root,
      source: benchmarkMetadata.repository,
      buildTools: benchmarkMetadata.buildTools,
      javaVersion: benchmarkMetadata.javaVersion,
      springBootVersion: benchmarkMetadata.springBootVersion,
      fileCount: benchmarkMetadata.fileCount,
      javaFileCount: benchmarkMetadata.javaFileCount
    },
    dependencies,
    packApplicability: evaluatePackApplicability({ pack, manifests, dependencies }),
    findings,
    evidence: buildEvidence(findings, manifests, dependencies)
  };
}

async function walk(root, base = '') {
  const directory = path.join(root, base);
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
  const files = [];

  for (const entry of entries) {
    const relative = path.join(base, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name) || IGNORED_DIRS.has(relative)) continue;
      files.push(...await walk(root, relative));
    } else if (entry.isFile()) {
      files.push(relative);
    }
  }

  return files;
}

async function readTextFiles(root, files) {
  const entries = [];
  for (const file of files) {
    const absolute = path.join(root, file);
    const content = await fs.readFile(absolute, 'utf8').catch(() => '');
    entries.push({ file, content });
  }
  return entries;
}

function detectManifests(files, contents, pack = 'spring-boot-3-readiness') {
  const buildTools = [];
  if (files.includes('pom.xml')) buildTools.push('Maven');
  if (files.some((file) => file === 'build.gradle' || file === 'build.gradle.kts')) buildTools.push('Gradle');

  const joined = contents.map((entry) => entry.content).join('\n');
  const javaVersion =
    findFirst(joined, /<java\.version>([^<]+)<\/java\.version>/) ||
    findFirst(joined, /<maven\.compiler\.release>([^<]+)<\/maven\.compiler\.release>/) ||
    findFirst(joined, /sourceCompatibility\s*=\s*['"]?(\d+)/) ||
    findFirst(joined, /JavaVersion\.VERSION_(\d+)/) ||
    'unknown';

  return { buildTools, javaVersion, pack };
}

function detectDependencies(contents) {
  const joined = contents.map((entry) => entry.content).join('\n');
  return {
    springBootVersion:
      findFirst(joined, /spring-boot-starter-parent[\s\S]{0,300}<version>([^<]+)<\/version>/) ||
      findFirst(joined, /org\.springframework\.boot['"]:spring-boot-gradle-plugin['"]?\s+version\s+['"]([^'"]+)/) ||
      findFirst(joined, /id ['"]org\.springframework\.boot['"] version ['"]([^'"]+)/) ||
      'unknown',
    jakartaDetected: /\bjakarta\./.test(joined),
    javaxDetected: /\bjavax\./.test(joined),
    hibernateDetected: /hibernate-core|org\.hibernate/.test(joined),
    springSecurityDetected: /spring-boot-starter-security|spring-security/.test(joined)
  };
}

function detectFindings(contents, dependencies, manifests) {
  const findings = [];
  if (manifests.buildTools.length === 0) {
    findings.push(finding('build-tool-missing', 'critical', 'Build tool not detected', 'Add Maven or Gradle metadata before automated readiness checks.'));
  }

  if (manifests.pack === 'spring-boot-3-readiness' && dependencies.springBootVersion === 'unknown') {
    findings.push(finding('spring-boot-version-unknown', 'warning', 'Spring Boot version unknown', 'Declare Spring Boot version explicitly in Maven or Gradle metadata.'));
  } else if (manifests.pack === 'spring-boot-3-readiness' && /^2\./.test(dependencies.springBootVersion)) {
    findings.push(finding('spring-boot-2', 'warning', `Spring Boot ${dependencies.springBootVersion} detected`, 'Plan Spring Boot 3 and Jakarta compatibility validation.'));
  }

  if (dependencies.javaxDetected) {
    findings.push(finding('javax-usage', 'critical', 'javax namespace usage detected', 'Migrate Java EE imports to Jakarta equivalents for Spring Boot 3.'));
  }

  if (manifests.pack === 'java-17-to-21-readiness' && manifests.javaVersion !== '21') {
    findings.push(finding('java-21-target-missing', 'warning', `Java ${manifests.javaVersion} target detected`, 'Set the project release, sourceCompatibility, or toolchain target to Java 21 before final validation.'));
  }

  for (const entry of contents) {
    addPatternFindings(findings, entry, /\bjava\.util\.Date\b/g, 'java-util-date', 'info', 'java.util.Date usage');
    addPatternFindings(findings, entry, /@Autowired\s+private|@Autowired\s+protected|@Autowired\s+public/g, 'field-injection', 'warning', 'Spring field injection');
    addPatternFindings(findings, entry, /System\.out\.print/g, 'system-out', 'info', 'System.out logging');
    addPatternFindings(findings, entry, /\b(sun\.misc|com\.sun\.|jdk\.internal\.)/g, 'java-internal-api', 'warning', 'JDK internal API usage');
    addSerializableFindings(findings, entry);
    addPublicReflectionFindings(findings, entry);
  }

  return findings;
}

function addPatternFindings(findings, entry, pattern, code, severity, title) {
  let match;
  while ((match = pattern.exec(entry.content)) !== null) {
    const line = entry.content.slice(0, match.index).split('\n').length;
    findings.push(finding(code, severity, title, `Review ${title} before modernization.`, entry.file, line));
  }
}

function addSerializableFindings(findings, entry) {
  const serializableClass = /class\s+\w+[^{]*(?:implements\s+[^{]*\bSerializable\b)/g;
  if (!serializableClass.test(entry.content)) return;
  if (/\bserialVersionUID\b/.test(entry.content)) return;
  findings.push(finding('serializable-missing-serial-version', 'warning', 'Serializable type without serialVersionUID', 'Add an explicit serialVersionUID before Java runtime migration validation.', entry.file, 1));
}

function addPublicReflectionFindings(findings, entry) {
  addPatternFindings(findings, entry, /\bClass\.forName\s*\(|\.getDeclared(Method|Field|Constructor)s?\s*\(/g, 'reflection-usage', 'info', 'Reflection usage');
}

function buildEvidence(findings, manifests, dependencies) {
  return [
    { name: 'Build metadata', status: manifests.buildTools?.length ? 'passed' : 'failed' },
    { name: 'Spring Boot version detection', status: dependencies.springBootVersion && dependencies.springBootVersion !== 'unknown' ? 'passed' : 'warning' },
    { name: 'Jakarta namespace readiness', status: dependencies.javaxDetected ? 'failed' : 'passed' },
    { name: 'Static source checks', status: findings.length ? 'warning' : 'passed' },
    { name: 'OpenRewrite dry-run readiness', status: 'pending', note: 'OpenRewrite execution is available through transform --engine openrewrite when Maven or Gradle execution is available.' }
  ];
}

function finding(code, severity, title, recommendation, file = null, line = null) {
  return { code, severity, title, recommendation, file, line, scope: classifyScope(file) };
}

function findFirst(text, regex) {
  const match = regex.exec(text);
  return match?.[1]?.trim();
}

function evaluatePackApplicability({ pack, manifests, dependencies }) {
  if (pack === 'spring-boot-3-readiness') {
    if (/^2\./.test(dependencies.springBootVersion)) {
      return {
        applicable: true,
        confidence: 0.95,
        reason: 'Spring Boot 2.x was detected. This pack targets Spring Boot 2.x to 3.x migrations.',
        targetVersion: '3.x'
      };
    }
    if (dependencies.springBootVersion === 'unknown') {
      return {
        applicable: false,
        confidence: 0.9,
        reason: 'Spring Boot 2.x was not detected. This pack targets Spring Boot 2.x to 3.x migrations.',
        recommendedPack: dependencies.javaxDetected ? 'jakarta-readiness' : 'java-17-to-21-readiness'
      };
    }
    return {
      applicable: false,
      confidence: 0.94,
      reason: `Spring Boot ${dependencies.springBootVersion} was detected, not Spring Boot 2.x. This pack targets Spring Boot 2.x to 3.x migrations.`,
      recommendedPack: dependencies.javaxDetected ? 'jakarta-readiness' : 'java-17-to-21-readiness'
    };
  }

  if (pack === 'java-17-to-21-readiness') {
    const applicable = manifests.javaVersion === '17';
    return {
      applicable,
      confidence: applicable ? 0.9 : 0.82,
      reason: applicable
        ? 'Java 17 was detected. This pack targets Java 17 to 21 migrations.'
        : `Java ${manifests.javaVersion} was detected. This pack targets Java 17 to 21 migrations.`,
      ...(!applicable && dependencies.javaxDetected ? { recommendedPack: 'jakarta-readiness' } : {})
    };
  }

  if (pack === 'jakarta-readiness') {
    const applicable = Boolean(dependencies.javaxDetected);
    return {
      applicable,
      confidence: applicable ? 0.92 : 0.76,
      reason: applicable
        ? 'javax namespace usage was detected. This pack targets javax to jakarta readiness.'
        : 'javax namespace usage was not detected. This pack is only useful for Java EE to Jakarta namespace migrations.',
      ...(!applicable ? { recommendedPack: 'java-17-to-21-readiness' } : {})
    };
  }

  return {
    applicable: true,
    confidence: 0.5,
    reason: `No applicability rules are defined for ${pack}.`
  };
}

function classifyScope(file) {
  if (!file) return 'production';
  const normalized = file.replaceAll('\\', '/').toLowerCase();
  if (
    normalized.includes('/src/test/') ||
    normalized.startsWith('src/test/') ||
    normalized.includes('/test/') ||
    normalized.startsWith('test/') ||
    normalized.includes('/tests/') ||
    normalized.startsWith('tests/') ||
    normalized.includes('testsuite/')
  ) {
    return 'test';
  }
  return 'production';
}
