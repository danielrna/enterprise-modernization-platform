import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_RULES_FILE = '.preflight-rules.yml';
const TEXT_EXTENSIONS = new Set(['.java', '.kt', '.xml', '.gradle', '.properties', '.yml', '.yaml']);
const IGNORED_DIRS = new Set(['.emp', '.git', '.gradle', '.idea', '.mvn/wrapper', 'benchmark-repos', 'build', 'dist', 'node_modules', 'reports', 'target']);

export async function loadEnterpriseRules(root, rulesPath = null) {
  const file = rulesPath ? path.resolve(root, rulesPath) : path.join(root, DEFAULT_RULES_FILE);
  const content = await fs.readFile(file, 'utf8').catch(() => null);
  if (!content) {
    return {
      schemaVersion: 'emp.rules.v1',
      source: path.relative(root, file) || DEFAULT_RULES_FILE,
      loaded: false,
      rules: [],
      violations: []
    };
  }

  return {
    schemaVersion: 'emp.rules.v1',
    source: path.relative(root, file) || DEFAULT_RULES_FILE,
    loaded: true,
    rules: parseRules(content),
    violations: []
  };
}

export async function evaluateEnterpriseRules({ root, scan, rules }) {
  if (!rules?.loaded || !rules.rules.length) return rules || await loadEnterpriseRules(root);

  const files = await listTextFiles(root);
  const contents = await readTextFiles(root, files);
  const violations = [];
  for (const rule of rules.rules) {
    violations.push(...evaluateRule(rule, scan, contents));
  }

  return {
    ...rules,
    violations
  };
}

export function summarizeRuleImpact(ruleEvaluation) {
  const violations = ruleEvaluation?.violations || [];
  const counts = violations.reduce((result, violation) => {
    result[violation.severity] = (result[violation.severity] || 0) + 1;
    return result;
  }, { critical: 0, warning: 0, info: 0 });
  return {
    loaded: Boolean(ruleEvaluation?.loaded),
    total: violations.length,
    counts,
    passed: Boolean(ruleEvaluation?.loaded) && violations.length === 0
  };
}

function parseRules(content) {
  const rules = [];
  let current = null;
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line === 'rules:') continue;
    if (line.startsWith('- ')) {
      if (current) rules.push(normalizeRule(current));
      current = {};
      const rest = line.slice(2).trim();
      if (rest) assignKeyValue(current, rest);
      continue;
    }
    if (current && line.includes(':')) assignKeyValue(current, line);
  }
  if (current) rules.push(normalizeRule(current));
  return rules.filter((rule) => rule.name && rule.pattern);
}

function assignKeyValue(target, line) {
  const separator = line.indexOf(':');
  if (separator === -1) return;
  const key = line.slice(0, separator).trim();
  const value = stripQuotes(line.slice(separator + 1).trim());
  target[key] = value;
}

function normalizeRule(rule) {
  return {
    name: rule.name || rule.pattern || 'Unnamed enterprise rule',
    type: rule.type || 'pattern',
    pattern: rule.pattern || '',
    severity: normalizeSeverity(rule.severity || defaultSeverity(rule.type)),
    category: rule.category || categoryFor(rule.type),
    rationale: rule.rationale || '',
    remediation: rule.remediation || rule['remediation-url'] || '',
    owner: rule.owner || '',
    paths: normalizeList(rule.paths || rule.path || ''),
    excludePaths: normalizeList(rule.excludePaths || rule['exclude-paths'] || rule.exclude || '')
  };
}

function defaultSeverity(type = '') {
  if (type.startsWith('forbidden')) return 'critical';
  return 'warning';
}

function normalizeSeverity(severity) {
  return ['critical', 'warning', 'info'].includes(severity) ? severity : 'warning';
}

function categoryFor(type = '') {
  if (type.includes('package') || type.includes('api')) return 'api';
  if (type.includes('spring')) return 'spring';
  if (type.includes('call')) return 'code-quality';
  return 'enterprise';
}

function evaluateRule(rule, scan, contents) {
  const mapped = mappedFindingViolations(rule, scan);
  if (mapped.length) return mapped;

  const regex = patternToRegex(rule.pattern);
  const violations = [];
  for (const entry of contents.filter((item) => ruleAppliesToFile(rule, item.file))) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(entry.content)) !== null) {
      violations.push(ruleViolation(rule, entry.file, lineFor(entry.content, match.index), `${rule.name} matched ${rule.pattern}.`));
      if (!regex.global) break;
    }
  }
  return violations;
}

function mappedFindingViolations(rule, scan) {
  const code = ruleCode(rule);
  if (!code) return [];
  return scan.findings
    .filter((finding) => finding.code === code)
    .filter((finding) => ruleAppliesToFile(rule, finding.file || ''))
    .map((finding) => ruleViolation(rule, finding.file, finding.line, `${rule.name} matched ${finding.title}.`));
}

function ruleViolation(rule, file, line, message) {
  return {
    rule: rule.name,
    type: rule.type,
    pattern: rule.pattern,
    severity: rule.severity,
    category: rule.category,
    rationale: rule.rationale,
    remediation: rule.remediation,
    owner: rule.owner,
    file,
    line,
    message
  };
}

function ruleCode(rule) {
  if (rule.pattern === 'field-injection') return 'field-injection';
  if (rule.pattern === 'java.util.Date') return 'java-util-date';
  if (rule.pattern === 'System.out') return 'system-out';
  if (rule.pattern === 'javax.*') return 'javax-usage';
  return null;
}

function patternToRegex(pattern) {
  const escaped = pattern
    .split('*')
    .map((part) => part.replaceAll(/[|\\{}()[\]^$+?.]/g, '\\$&'))
    .join('.*');
  return new RegExp(escaped, 'g');
}

function ruleAppliesToFile(rule, file) {
  if (!file) return true;
  const normalized = file.replaceAll('\\', '/');
  const included = !rule.paths.length || rule.paths.some((pattern) => globMatches(pattern, normalized));
  const excluded = rule.excludePaths.some((pattern) => globMatches(pattern, normalized));
  return included && !excluded;
}

function globMatches(pattern, file) {
  const normalized = pattern.replaceAll('\\', '/');
  const escaped = normalized
    .replaceAll('.', '\\.')
    .replaceAll('**', '\u0000')
    .replaceAll('*', '[^/]*')
    .replaceAll('\u0000', '.*');
  return new RegExp(`^${escaped}$`).test(file);
}

async function listTextFiles(root, base = '') {
  const directory = path.join(root, base);
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const relative = path.join(base, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name) || IGNORED_DIRS.has(relative)) continue;
      files.push(...await listTextFiles(root, relative));
    } else if (entry.isFile() && (TEXT_EXTENSIONS.has(path.extname(entry.name)) || entry.name === 'build.gradle.kts')) {
      files.push(relative);
    }
  }
  return files;
}

async function readTextFiles(root, files) {
  const entries = [];
  for (const file of files) {
    const content = await fs.readFile(path.join(root, file), 'utf8').catch(() => '');
    entries.push({ file, content });
  }
  return entries;
}

function lineFor(content, index) {
  return content.slice(0, index).split('\n').length;
}

function stripQuotes(value) {
  return value.replace(/^['"]|['"]$/g, '');
}

function normalizeList(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => stripQuotes(item.trim()))
    .filter(Boolean);
}
