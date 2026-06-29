import path from 'node:path';
import { analyzeProject } from './scanner.js';
import { scoreReadiness } from './readiness.js';
import { loadEnterpriseRules, evaluateEnterpriseRules } from './rules.js';

export async function handleMcpRequest(request) {
  if (request.method === 'initialize') {
    return response(request.id, {
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'enterprise-modernization-platform', version: '0.1.0' },
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

  return {
    jsonrpc: '2.0',
    id: request.id ?? null,
    error: { code: -32601, message: `Unknown MCP method: ${request.method}` }
  };
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
