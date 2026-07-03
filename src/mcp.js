import path from 'node:path';
import fs from 'node:fs/promises';
import { analyzeProject } from './scanner.js';
import { scoreReadiness } from './readiness.js';
import { loadEnterpriseRules, evaluateEnterpriseRules } from './rules.js';
import { transformProject } from './transform.js';

const PACKS_URL = new URL('../packs/', import.meta.url);
const BENCHMARKS_URL = new URL('../docs/benchmarks/', import.meta.url);

export async function handleMcpRequest(request) {
  if (request.method === 'initialize') {
    return response(request.id, {
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'enterprise-modernization-platform', version: '0.5.2' },
      capabilities: { tools: {} }
    });
  }

  if (request.method === 'tools/list') {
    return response(request.id, {
      tools: [
        {
          name: 'emp.analyze',
          description: 'Run EMP readiness analysis with optional enterprise rules.',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              pack: { type: 'string' },
              rules: { type: 'string' }
            }
          }
        },
        {
          name: 'emp.packs',
          description: 'List available EMP modernization packs or return details for one pack.',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' }
            }
          }
        },
        {
          name: 'emp.benchmarks',
          description: 'Summarize published EMP benchmark evidence with optional filters.',
          inputSchema: {
            type: 'object',
            properties: {
              pack: { type: 'string' },
              source: { type: 'string' },
              validationStatus: { type: 'string' },
              limit: { type: 'number' }
            }
          }
        },
        {
          name: 'emp.transformPlan',
          description: 'Create a dry-run transformation plan without applying file changes.',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              pack: { type: 'string' },
              engine: { type: 'string' },
              recipe: { type: 'string' },
              recipeArtifact: { type: 'string' }
            }
          }
        }
      ]
    });
  }

  if (request.method === 'tools/call' && request.params?.name === 'emp.analyze') {
    const args = request.params.arguments || {};
    const root = path.resolve(args.path || '.');
    const pack = args.pack || 'spring-boot-3-readiness';
    const rules = await loadEnterpriseRules(root, args.rules || null);
    const scan = await analyzeProject({ root, pack });
    const ruleEvaluation = await evaluateEnterpriseRules({ root, scan, rules });
    const readiness = scoreReadiness(scan, ruleEvaluation);
    return response(request.id, {
      content: [{
        type: 'text',
        text: JSON.stringify({
          project: scan.project,
          pack,
          packApplicability: scan.packApplicability,
          readiness,
          rules: ruleEvaluation
        }, null, 2)
      }]
    });
  }

  if (request.method === 'tools/call' && request.params?.name === 'emp.packs') {
    const args = request.params.arguments || {};
    const packs = await loadPackCatalog();
    const selected = args.id ? packs.find((pack) => pack.id === args.id) : null;
    if (args.id && !selected) {
      return {
        jsonrpc: '2.0',
        id: request.id ?? null,
        error: { code: -32602, message: `Unknown EMP pack: ${args.id}` }
      };
    }
    const payload = selected || {
      packs: packs.map((pack) => ({
        id: pack.id,
        name: pack.name,
        vertical: pack.vertical,
        migration: pack.migration,
        version: pack.version,
        categories: pack.categories,
        checkCount: pack.checks?.length || 0
      }))
    };
    return response(request.id, {
      content: [{
        type: 'text',
        text: JSON.stringify(payload, null, 2)
      }]
    });
  }

  if (request.method === 'tools/call' && request.params?.name === 'emp.benchmarks') {
    const args = request.params.arguments || {};
    const benchmarks = await loadBenchmarkSummaries();
    const filtered = benchmarks.filter((benchmark) => {
      if (args.pack && benchmark.pack !== args.pack) return false;
      if (args.source && benchmark.source !== args.source) return false;
      if (args.validationStatus && benchmark.validationStatus !== args.validationStatus) return false;
      return true;
    });
    const limit = normalizeLimit(args.limit, filtered.length);
    return response(request.id, {
      content: [{
        type: 'text',
        text: JSON.stringify({
          totals: summarizeBenchmarks(filtered),
          filters: {
            pack: args.pack || null,
            source: args.source || null,
            validationStatus: args.validationStatus || null,
            limit
          },
          benchmarks: filtered.slice(0, limit)
        }, null, 2)
      }]
    });
  }

  if (request.method === 'tools/call' && request.params?.name === 'emp.transformPlan') {
    const args = request.params.arguments || {};
    const root = path.resolve(args.path || '.');
    const transformation = await transformProject({
      root,
      pack: args.pack || 'spring-boot-3-readiness',
      mode: 'dry-run',
      validate: false,
      engine: args.engine || 'native',
      recipe: args.recipe || undefined,
      recipeArtifact: args.recipeArtifact || undefined
    });
    return response(request.id, {
      content: [{
        type: 'text',
        text: JSON.stringify({
          pack: transformation.pack,
          mode: transformation.mode,
          status: transformation.status,
          engine: transformation.engine,
          requestedEngine: transformation.requestedEngine,
          planEngine: transformation.plan.engine,
          summary: transformation.plan.summary,
          plannedChanges: transformation.plan.changes.length,
          changes: transformation.plan.changes.map((change) => ({
            file: change.file,
            recipe: change.recipe,
            replacements: change.replacements
          })),
          command: transformation.plan.command,
          openRewrite: transformation.plan.openRewrite,
          appliedChanges: transformation.applied.length,
          validation: transformation.validation
        }, null, 2)
      }]
    });
  }

  return {
    jsonrpc: '2.0',
    id: request.id ?? null,
    error: { code: -32601, message: `Unknown MCP method: ${request.method}` }
  };
}

async function loadPackCatalog() {
  const entries = await fs.readdir(PACKS_URL, { withFileTypes: true });
  const packs = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    packs.push(JSON.parse(await fs.readFile(new URL(entry.name, PACKS_URL), 'utf8')));
  }
  return packs.sort((left, right) => left.id.localeCompare(right.id));
}

async function loadBenchmarkSummaries() {
  const entries = await fs.readdir(BENCHMARKS_URL, { withFileTypes: true }).catch(() => []);
  const benchmarks = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const reportUrl = new URL(`${entry.name}/report.json`, BENCHMARKS_URL);
    const report = await readJson(reportUrl);
    if (!report) continue;
    benchmarks.push({
      slug: entry.name,
      name: report.project?.name || entry.name,
      pack: typeof report.pack === 'string' ? report.pack : report.pack?.id || null,
      readiness: report.readiness?.overall ?? null,
      readinessStatus: report.readiness?.status || null,
      source: report.benchmark?.source || 'catalog',
      validationStatus: report.benchmark?.validation?.status || 'not_requested',
      validationConfidence: report.benchmark?.validation?.confidence ?? 0,
      findings: report.findingDetails?.total ?? report.findings?.length ?? 0,
      reportPath: `docs/benchmarks/${entry.name}/index.html`,
      reportUrl: `https://danielrna.github.io/enterprise-modernization-platform/benchmarks/${entry.name}/`
    });
  }
  return benchmarks.sort((left, right) => left.name.localeCompare(right.name));
}

async function readJson(url) {
  try {
    return JSON.parse(await fs.readFile(url, 'utf8'));
  } catch {
    return null;
  }
}

function summarizeBenchmarks(benchmarks) {
  return {
    total: benchmarks.length,
    checkoutBacked: benchmarks.filter((benchmark) => benchmark.source === 'checkout').length,
    catalogBacked: benchmarks.filter((benchmark) => benchmark.source === 'catalog').length,
    validationPassed: benchmarks.filter((benchmark) => benchmark.validationStatus === 'passed').length,
    validationFailed: benchmarks.filter((benchmark) => benchmark.validationStatus === 'failed').length,
    validationSkipped: benchmarks.filter((benchmark) => benchmark.validationStatus === 'skipped').length,
    validationNotRequested: benchmarks.filter((benchmark) => benchmark.validationStatus === 'not_requested').length
  };
}

function normalizeLimit(value, fallback) {
  if (value === undefined || value === null) return fallback;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1) return fallback;
  return Math.min(limit, fallback);
}

export async function runMcpServer({ input = process.stdin, output = process.stdout } = {}) {
  const raw = await readAll(input);
  for (const line of raw.split('\n').map((item) => item.trim()).filter(Boolean)) {
    const request = JSON.parse(line);
    const result = await handleMcpRequest(request);
    output.write(`${JSON.stringify(result)}\n`);
  }
}

function response(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function readAll(stream) {
  return new Promise((resolve, reject) => {
    let data = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => { data += chunk; });
    stream.on('end', () => resolve(data));
    stream.on('error', reject);
  });
}
