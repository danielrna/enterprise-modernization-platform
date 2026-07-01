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
    springSecurityVersion: benchmarkMetadata.springSecurityVersion || 'unknown',
    jakartaDetected: benchmarkMetadata.jakartaDetected,
    javaxDetected: benchmarkMetadata.javaxDetected,
    hibernateDetected: benchmarkMetadata.hibernateDetected,
    springSecurityDetected: benchmarkMetadata.springSecurityDetected,
    junit4Detected: benchmarkMetadata.junit4Detected || false,
    junit5Detected: benchmarkMetadata.junit5Detected || false
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
      findFirst(joined, /spring-boot-starter-parent[\s\S]{0,300}?<version>([^<]+)<\/version>/) ||
      findFirst(joined, /org\.springframework\.boot['"]:spring-boot-gradle-plugin['"]?\s+version\s+['"]([^'"]+)/) ||
      findFirst(joined, /id ['"]org\.springframework\.boot['"] version ['"]([^'"]+)/) ||
      'unknown',
    springSecurityVersion:
      findFirst(joined, /spring-security-bom[\s\S]{0,300}?<version>([^<]+)<\/version>/) ||
      findFirst(joined, /spring-security-[\w-]+<\/artifactId>\s*<version>([^<]+)<\/version>/) ||
      findFirst(joined, /org\.springframework\.security['"]:spring-security-[\w-]+['"]?\s+version\s+['"]([^'"]+)/) ||
      'unknown',
    jakartaDetected: /\bjakarta\./.test(joined),
    javaxDetected: /\bjavax\./.test(joined),
    hibernateDetected: /hibernate-core|org\.hibernate|hibernate-mapping/.test(joined),
    springSecurityDetected: /spring-boot-starter-security|spring-security/.test(joined),
    junit4Detected: /junit:junit|org\.junit\.Test|org\.junit\.Assert|org\.junit\.Before|org\.junit\.After|org\.junit\.runner\.RunWith/.test(joined),
    junit5Detected: /org\.junit\.jupiter|junit-jupiter|junit-platform/.test(joined)
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

  if (manifests.pack === 'hibernate-readiness' && !dependencies.hibernateDetected) {
    findings.push(finding('hibernate-not-detected', 'warning', 'Hibernate usage not detected', 'Confirm Hibernate ORM is present before using the Hibernate readiness pack.'));
  }

  if (manifests.pack === 'spring-security-6-readiness' && !dependencies.springSecurityDetected) {
    findings.push(finding('spring-security-not-detected', 'warning', 'Spring Security usage not detected', 'Confirm Spring Security is present before using the Spring Security 6 readiness pack.'));
  } else if (manifests.pack === 'spring-security-6-readiness' && /^5\./.test(dependencies.springSecurityVersion)) {
    findings.push(finding('spring-security-5', 'warning', `Spring Security ${dependencies.springSecurityVersion} detected`, 'Plan Spring Security 6 authorization and configuration validation.'));
  }

  if (manifests.pack === 'junit-5-readiness' && !dependencies.junit4Detected) {
    findings.push(finding('junit4-not-detected', 'warning', 'JUnit 4 usage not detected', 'Confirm JUnit 4 tests are present before using the JUnit 5 readiness pack.'));
  }

  if (manifests.pack === 'java-17-to-21-readiness' && manifests.javaVersion !== '21') {
    findings.push(finding('java-21-target-missing', 'warning', `Java ${manifests.javaVersion} target detected`, 'Set the project release, sourceCompatibility, or toolchain target to Java 21 before final validation.'));
  }

  for (const entry of contents) {
    addPatternFindings(findings, entry, /\bjava\.util\.Date\b/g, 'java-util-date', 'info', 'java.util.Date usage');
    addPatternFindings(findings, entry, /@Autowired\s+private|@Autowired\s+protected|@Autowired\s+public/g, 'field-injection', 'warning', 'Spring field injection');
    addPatternFindings(findings, entry, /System\.out\.print/g, 'system-out', 'info', 'System.out logging');
    addPatternFindings(findings, entry, /\b(sun\.misc|com\.sun\.|jdk\.internal\.)/g, 'java-internal-api', 'warning', 'JDK internal API usage');
    addPatternFindings(findings, entry, /\borg\.hibernate\.Criteria\b|\bcreateCriteria\s*\(/g, 'hibernate-legacy-criteria', 'critical', 'Legacy Hibernate Criteria API');
    addPatternFindings(findings, entry, /\borg\.hibernate\.Session\b|\bSessionFactory\b/g, 'hibernate-session-api', 'warning', 'Direct Hibernate Session API usage');
    addPatternFindings(findings, entry, /\bUserType\b|\bBasicType\b|\bCompositeUserType\b/g, 'hibernate-custom-type', 'warning', 'Hibernate custom type integration');
    addPatternFindings(findings, entry, /hibernate-mapping|\.hbm\.xml/g, 'hibernate-xml-mapping', 'warning', 'Hibernate XML mapping');
    addPatternFindings(findings, entry, /\bWebSecurityConfigurerAdapter\b/g, 'spring-security-websecurityconfigureradapter', 'critical', 'WebSecurityConfigurerAdapter usage');
    addPatternFindings(findings, entry, /\bantMatchers\s*\(|\bmvcMatchers\s*\(|\bregexMatchers\s*\(/g, 'spring-security-legacy-matchers', 'warning', 'Legacy Spring Security matcher API');
    addPatternFindings(findings, entry, /\.authorizeRequests\s*\(/g, 'spring-security-authorize-requests', 'warning', 'authorizeRequests configuration');
    addPatternFindings(findings, entry, /@EnableGlobalMethodSecurity\b/g, 'spring-security-global-method-security', 'warning', 'Global method security annotation');
    addPatternFindings(findings, entry, /\borg\.junit\.Test\b|\borg\.junit\.Before\b|\borg\.junit\.After\b|\borg\.junit\.Assert\b/g, 'junit4-api-usage', 'warning', 'JUnit 4 API usage');
    addPatternFindings(findings, entry, /\borg\.junit\.runner\.RunWith\b|@RunWith\b/g, 'junit4-runner-usage', 'warning', 'JUnit 4 runner usage');
    addPatternFindings(findings, entry, /junit:junit|<artifactId>junit<\/artifactId>/g, 'junit4-dependency', 'warning', 'JUnit 4 dependency');
    addPatternFindings(findings, entry, /junit-vintage-engine/g, 'junit-vintage-engine', 'info', 'JUnit Vintage engine dependency');
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
    { name: 'Hibernate usage detection', status: dependencies.hibernateDetected ? 'passed' : 'warning' },
    { name: 'Spring Security usage detection', status: dependencies.springSecurityDetected ? 'passed' : 'warning' },
    { name: 'JUnit 4 usage detection', status: dependencies.junit4Detected ? 'passed' : 'warning' },
    { name: 'JUnit 5 usage detection', status: dependencies.junit5Detected ? 'passed' : 'warning' },
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

  if (pack === 'hibernate-readiness') {
    const applicable = Boolean(dependencies.hibernateDetected);
    return {
      applicable,
      confidence: applicable ? 0.9 : 0.78,
      reason: applicable
        ? 'Hibernate ORM usage was detected. This pack targets Hibernate 5.x to 6.x readiness.'
        : 'Hibernate ORM usage was not detected. This pack is only useful for persistence modernization work that includes Hibernate.',
      ...(!applicable ? { recommendedPack: dependencies.javaxDetected ? 'jakarta-readiness' : 'java-17-to-21-readiness' } : {})
    };
  }

  if (pack === 'spring-security-6-readiness') {
    const applicable = Boolean(dependencies.springSecurityDetected);
    return {
      applicable,
      confidence: applicable ? 0.9 : 0.78,
      reason: applicable
        ? 'Spring Security usage was detected. This pack targets Spring Security 5.x to 6.x readiness.'
        : 'Spring Security usage was not detected. This pack is only useful for applications with Spring Security configuration or dependencies.',
      ...(!applicable ? { recommendedPack: dependencies.javaxDetected ? 'jakarta-readiness' : 'spring-boot-3-readiness' } : {})
    };
  }

  if (pack === 'junit-5-readiness') {
    const applicable = Boolean(dependencies.junit4Detected);
    return {
      applicable,
      confidence: applicable ? 0.9 : 0.78,
      reason: applicable
        ? 'JUnit 4 usage was detected. This pack targets JUnit 4 to JUnit 5 readiness.'
        : 'JUnit 4 usage was not detected. This pack is only useful for projects with JUnit 4 tests or dependencies.',
      ...(!applicable ? { recommendedPack: dependencies.springSecurityDetected ? 'spring-security-6-readiness' : 'java-17-to-21-readiness' } : {})
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
