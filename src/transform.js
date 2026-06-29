import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const TEXT_EXTENSIONS = new Set(['.java', '.kt', '.xml', '.gradle', '.properties', '.yml', '.yaml']);
const ROLLBACK_ROOT = '.emp/rollback';
const DEFAULT_RECIPE = 'org.openrewrite.java.spring.boot3.UpgradeSpringBoot_3_0';
const DEFAULT_RECIPE_ARTIFACT = 'org.openrewrite.recipe:rewrite-spring:RELEASE';

export async function transformProject({ root, pack = 'spring-boot-3-readiness', mode = 'dry-run', validate = false, engine = 'native', recipe = DEFAULT_RECIPE, recipeArtifact = DEFAULT_RECIPE_ARTIFACT }) {
  if (!['native', 'openrewrite', 'auto'].includes(engine)) throw new Error(`Unknown transform engine: ${engine}`);
  const startedAt = new Date().toISOString();
  const files = await listTextFiles(root);
  const openRewriteCommand = await detectOpenRewriteCommand(root, mode, recipe, recipeArtifact);
  const selectedEngine = selectEngine(engine, openRewriteCommand);
  const plan = await buildPlan(root, files, { pack, engine: selectedEngine, openRewriteCommand, recipe, recipeArtifact });
  const result = {
    pack,
    mode,
    engine: selectedEngine,
    requestedEngine: engine,
    startedAt,
    completedAt: null,
    status: 'pending',
    plan,
    execution: [],
    applied: [],
    rollback: null,
    validation: []
  };

  if (mode === 'dry-run') {
    if (selectedEngine === 'openrewrite') {
      const execution = await executeOpenRewrite(root, openRewriteCommand);
      result.execution.push(execution);
      result.status = execution.status === 'passed' ? 'dry-run' : 'failed';
    } else {
      result.status = 'dry-run';
    }
    result.completedAt = new Date().toISOString();
    if (validate) result.validation = await validateProject(root);
    return result;
  }

  if (mode === 'rollback') {
    result.rollback = await rollbackLatest(root);
    result.status = result.rollback.status;
    result.completedAt = new Date().toISOString();
    if (validate) result.validation = await validateProject(root);
    return result;
  }

  if (mode !== 'apply') throw new Error(`Unknown transform mode: ${mode}`);

  if (selectedEngine === 'openrewrite') {
    result.rollback = await createRollbackSnapshot(root, files);
    const execution = await executeOpenRewrite(root, openRewriteCommand);
    result.execution.push(execution);
    result.applied = await detectChangedFiles(root, result.rollback);
    result.status = execution.status === 'passed' ? (result.applied.length ? 'applied' : 'no-op') : 'failed';
    result.completedAt = new Date().toISOString();
    if (validate) result.validation = await validateProject(root);
    return result;
  }

  if (plan.changes.length) result.rollback = await createRollbackSnapshot(root, plan.changes.map((change) => change.file));
  for (const change of plan.changes) {
    const absolute = path.join(root, change.file);
    const content = await fs.readFile(absolute, 'utf8');
    const updated = rewriteContent(content, pack);
    if (updated !== content) {
      await fs.writeFile(absolute, updated);
      result.applied.push(change);
    }
  }
  result.status = result.applied.length ? 'applied' : 'no-op';
  result.completedAt = new Date().toISOString();
  if (validate) result.validation = await validateProject(root);
  return result;
}

export async function validateProject(root) {
  const commands = await detectValidationCommands(root);
  if (!commands.length) {
    return [{
      name: 'Build validation',
      status: 'skipped',
      command: null,
      note: 'No Maven or Gradle build metadata was detected.'
    }];
  }

  const results = [];
  for (const command of commands) {
    const execution = await runCommand(root, command);
    results.push({
      name: command.label,
      status: execution.exitCode === 0 ? 'passed' : 'failed',
      command: command.args.join(' '),
      exitCode: execution.exitCode,
      output: execution.output.slice(-4000)
    });
  }
  return results;
}

async function listTextFiles(root, base = '') {
  const directory = path.join(root, base);
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
  const files = [];

  for (const entry of entries) {
    const relative = path.join(base, entry.name);
    if (entry.isDirectory()) {
      if (shouldSkipDirectory(relative, entry.name)) continue;
      files.push(...await listTextFiles(root, relative));
    } else if (entry.isFile() && (TEXT_EXTENSIONS.has(path.extname(entry.name)) || entry.name === 'build.gradle.kts')) {
      files.push(relative);
    }
  }

  return files;
}

async function buildPlan(root, files, { pack, engine, openRewriteCommand, recipe, recipeArtifact }) {
  const changes = [];
  for (const file of files) {
    const absolute = path.join(root, file);
    const content = await fs.readFile(absolute, 'utf8').catch(() => '');
    const updated = rewriteContent(content, pack);
    if (updated === content) continue;
    changes.push({
      file,
      replacements: countReplacements(content, pack),
      recipe: pack === 'java-17-to-21-readiness' ? 'java-17-to-21-target' : 'javax-to-jakarta-namespace'
    });
  }

  return {
    engine: engine === 'openrewrite' ? 'openrewrite' : 'emp-native-rewrite',
    openRewrite: openRewriteCommand ? 'available' : 'unavailable',
    recipe,
    recipeArtifact,
    command: openRewriteCommand?.args.join(' ') || null,
    changes,
    summary: engine === 'openrewrite'
      ? `OpenRewrite ${openRewriteCommand ? 'will execute' : 'is unavailable'} for recipe ${recipe}.`
      : changes.length
      ? `${changes.length} file(s) require ${pack === 'java-17-to-21-readiness' ? 'Java 21 target updates' : 'Jakarta namespace rewrites'}.`
      : `No ${pack === 'java-17-to-21-readiness' ? 'Java 21 target updates' : 'Jakarta namespace rewrites'} detected.`
  };
}

function rewriteContent(content, pack) {
  if (pack === 'java-17-to-21-readiness') return rewriteJava21Target(content);
  return rewriteJakartaImports(content);
}

function rewriteJakartaImports(content) {
  return content
    .replaceAll('javax.persistence.', 'jakarta.persistence.')
    .replaceAll('javax.validation.', 'jakarta.validation.')
    .replaceAll('javax.annotation.', 'jakarta.annotation.')
    .replaceAll('javax.servlet.', 'jakarta.servlet.')
    .replaceAll('javax.transaction.', 'jakarta.transaction.')
    .replaceAll('javax.ws.rs.', 'jakarta.ws.rs.');
}

function rewriteJava21Target(content) {
  return content
    .replaceAll('<java.version>17</java.version>', '<java.version>21</java.version>')
    .replaceAll('<maven.compiler.release>17</maven.compiler.release>', '<maven.compiler.release>21</maven.compiler.release>')
    .replaceAll('<maven.compiler.source>17</maven.compiler.source>', '<maven.compiler.source>21</maven.compiler.source>')
    .replaceAll('<maven.compiler.target>17</maven.compiler.target>', '<maven.compiler.target>21</maven.compiler.target>')
    .replace(/\bsourceCompatibility\s*=\s*['"]?17['"]?/g, 'sourceCompatibility = 21')
    .replace(/\btargetCompatibility\s*=\s*['"]?17['"]?/g, 'targetCompatibility = 21')
    .replaceAll('JavaVersion.VERSION_17', 'JavaVersion.VERSION_21')
    .replace(/languageVersion\s*=\s*JavaLanguageVersion\.of\(17\)/g, 'languageVersion = JavaLanguageVersion.of(21)');
}

function countReplacements(content, pack) {
  if (pack === 'java-17-to-21-readiness') {
    const matches = content.match(/<java\.version>17<\/java\.version>|<maven\.compiler\.(release|source|target)>17<\/maven\.compiler\.(release|source|target)>|\b(source|target)Compatibility\s*=\s*['"]?17['"]?|JavaVersion\.VERSION_17|languageVersion\s*=\s*JavaLanguageVersion\.of\(17\)/g);
    return matches?.length || 0;
  }
  const matches = content.match(/\bjavax\.(persistence|validation|annotation|servlet|transaction|ws\.rs)\./g);
  return matches?.length || 0;
}

async function createRollbackSnapshot(root, files) {
  const id = timestampId();
  const snapshotRoot = path.join(root, ROLLBACK_ROOT, id);
  await fs.mkdir(snapshotRoot, { recursive: true });

  for (const file of files) {
    const source = path.join(root, file);
    const target = path.join(snapshotRoot, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(source, target);
  }

  const manifest = {
    id,
    createdAt: new Date().toISOString(),
    files
  };
  await fs.writeFile(path.join(snapshotRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await fs.mkdir(path.join(root, ROLLBACK_ROOT), { recursive: true });
  await fs.writeFile(path.join(root, ROLLBACK_ROOT, 'latest'), `${id}\n`);

  return { id, status: 'created', files: manifest.files.length };
}

async function rollbackLatest(root) {
  const latestPath = path.join(root, ROLLBACK_ROOT, 'latest');
  const id = (await fs.readFile(latestPath, 'utf8').catch(() => '')).trim();
  if (!id) return { status: 'skipped', note: 'No rollback snapshot exists.' };

  const snapshotRoot = path.join(root, ROLLBACK_ROOT, id);
  const manifestPath = path.join(snapshotRoot, 'manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  for (const file of manifest.files) {
    const source = path.join(snapshotRoot, file);
    const target = path.join(root, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(source, target);
  }

  return { id, status: 'rolled-back', files: manifest.files.length };
}

async function detectValidationCommands(root) {
  if (await exists(path.join(root, 'mvnw'))) {
    return [
      { label: 'Maven compile', args: ['./mvnw', '-q', '-DskipTests', 'compile'] },
      { label: 'Maven test', args: ['./mvnw', '-q', 'test'] }
    ];
  }
  if (await exists(path.join(root, 'pom.xml'))) {
    return [
      { label: 'Maven compile', args: ['mvn', '-q', '-DskipTests', 'compile'] },
      { label: 'Maven test', args: ['mvn', '-q', 'test'] }
    ];
  }
  if (await exists(path.join(root, 'gradlew'))) {
    return [
      { label: 'Gradle compile', args: ['./gradlew', 'classes'] },
      { label: 'Gradle test', args: ['./gradlew', 'test'] }
    ];
  }
  if (await exists(path.join(root, 'build.gradle')) || await exists(path.join(root, 'build.gradle.kts'))) {
    return [
      { label: 'Gradle compile', args: ['gradle', 'classes'] },
      { label: 'Gradle test', args: ['gradle', 'test'] }
    ];
  }
  return [];
}

async function detectOpenRewriteCommand(root, mode, recipe, recipeArtifact) {
  if (mode === 'rollback') return null;
  const goal = mode === 'apply' ? 'run' : 'dryRun';
  if (await exists(path.join(root, 'mvnw'))) {
    return {
      label: `OpenRewrite Maven ${goal}`,
      args: ['./mvnw', '-U', `org.openrewrite.maven:rewrite-maven-plugin:${goal}`, `-Drewrite.activeRecipes=${recipe}`, `-Drewrite.recipeArtifactCoordinates=${recipeArtifact}`]
    };
  }
  if (await exists(path.join(root, 'pom.xml'))) {
    return {
      label: `OpenRewrite Maven ${goal}`,
      args: ['mvn', '-U', `org.openrewrite.maven:rewrite-maven-plugin:${goal}`, `-Drewrite.activeRecipes=${recipe}`, `-Drewrite.recipeArtifactCoordinates=${recipeArtifact}`]
    };
  }
  if (await exists(path.join(root, 'gradlew'))) {
    return {
      label: `OpenRewrite Gradle ${goal}`,
      args: ['./gradlew', mode === 'apply' ? 'rewriteRun' : 'rewriteDryRun']
    };
  }
  if (await exists(path.join(root, 'build.gradle')) || await exists(path.join(root, 'build.gradle.kts'))) {
    return {
      label: `OpenRewrite Gradle ${goal}`,
      args: ['gradle', mode === 'apply' ? 'rewriteRun' : 'rewriteDryRun']
    };
  }
  return null;
}

function selectEngine(engine, openRewriteCommand) {
  if (engine === 'openrewrite') return 'openrewrite';
  if (engine === 'auto') return openRewriteCommand ? 'openrewrite' : 'native';
  return 'native';
}

async function executeOpenRewrite(root, command) {
  if (!command) {
    return {
      name: 'OpenRewrite execution',
      status: 'skipped',
      command: null,
      exitCode: null,
      output: 'No Maven or Gradle OpenRewrite execution path was detected.'
    };
  }
  const execution = await runCommand(root, command);
  return {
    name: command.label,
    status: execution.exitCode === 0 ? 'passed' : 'failed',
    command: command.args.join(' '),
    exitCode: execution.exitCode,
    output: execution.output.slice(-4000)
  };
}

async function detectChangedFiles(root, rollback) {
  if (!rollback?.id) return [];
  const snapshotRoot = path.join(root, ROLLBACK_ROOT, rollback.id);
  const manifest = JSON.parse(await fs.readFile(path.join(snapshotRoot, 'manifest.json'), 'utf8'));
  const changed = [];
  for (const file of manifest.files) {
    const before = await fs.readFile(path.join(snapshotRoot, file), 'utf8').catch(() => null);
    const after = await fs.readFile(path.join(root, file), 'utf8').catch(() => null);
    if (before !== after) changed.push({ file, replacements: 0, recipe: 'openrewrite' });
  }
  return changed;
}

function runCommand(root, command) {
  return new Promise((resolve) => {
    const child = spawn(command.args[0], command.args.slice(1), { cwd: root });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk) => { output += chunk.toString(); });
    child.on('error', (error) => resolve({ exitCode: 127, output: error.message }));
    child.on('close', (exitCode) => resolve({ exitCode, output }));
  });
}

async function exists(file) {
  return Boolean(await fs.stat(file).catch(() => null));
}

function shouldSkipDirectory(relative, name) {
  return ['.emp', '.git', '.gradle', '.idea', 'benchmark-repos', 'build', 'dist', 'node_modules', 'reports', 'target'].includes(name) ||
    relative.startsWith(ROLLBACK_ROOT);
}

function timestampId() {
  return new Date().toISOString().replaceAll(/[:.]/g, '-');
}
