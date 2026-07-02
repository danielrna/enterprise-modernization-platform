#!/usr/bin/env node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { handleMcpRequest } from '../src/mcp.js';

const root = await makeFixtureProject();

const initialize = await call({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize'
});
assertJsonRpc(initialize, 1);
assert(initialize.result.serverInfo.name === 'enterprise-modernization-platform', 'initialize returns server info');

const toolsList = await call({
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/list'
});
assertJsonRpc(toolsList, 2);
const toolNames = toolsList.result.tools.map((tool) => tool.name);
for (const name of ['emp.analyze', 'emp.packs', 'emp.benchmarks', 'emp.transformPlan']) {
  assert(toolNames.includes(name), `tools/list includes ${name}`);
}

const packs = await call({
  jsonrpc: '2.0',
  id: 3,
  method: 'tools/call',
  params: {
    name: 'emp.packs',
    arguments: { id: 'spring-boot-3-readiness' }
  }
});
assertTextPayload(packs, 3);
assert(JSON.parse(packs.result.content[0].text).id === 'spring-boot-3-readiness', 'emp.packs returns requested pack');

const benchmarks = await call({
  jsonrpc: '2.0',
  id: 4,
  method: 'tools/call',
  params: {
    name: 'emp.benchmarks',
    arguments: { pack: 'junit-5-readiness', limit: 2 }
  }
});
assertTextPayload(benchmarks, 4);
const benchmarkPayload = JSON.parse(benchmarks.result.content[0].text);
assert(Number.isInteger(benchmarkPayload.totals.total), 'emp.benchmarks returns totals');
assert(benchmarkPayload.benchmarks.length <= 2, 'emp.benchmarks honors limit');

const analysis = await call({
  jsonrpc: '2.0',
  id: 5,
  method: 'tools/call',
  params: {
    name: 'emp.analyze',
    arguments: { path: root, pack: 'spring-boot-3-readiness' }
  }
});
assertTextPayload(analysis, 5);
assert(JSON.parse(analysis.result.content[0].text).packApplicability.applicable === true, 'emp.analyze returns applicability');

const transformPlan = await call({
  jsonrpc: '2.0',
  id: 6,
  method: 'tools/call',
  params: {
    name: 'emp.transformPlan',
    arguments: { path: root, pack: 'spring-boot-3-readiness', engine: 'native' }
  }
});
assertTextPayload(transformPlan, 6);
const planPayload = JSON.parse(transformPlan.result.content[0].text);
assert(planPayload.mode === 'dry-run', 'emp.transformPlan uses dry-run mode');
assert(planPayload.plannedChanges === 1, 'emp.transformPlan returns planned change count');

console.log('MCP verification passed.');

async function call(request) {
  const response = await handleMcpRequest(request);
  assert(response.jsonrpc === '2.0', `${request.method} returns JSON-RPC 2.0`);
  return response;
}

function assertJsonRpc(response, id) {
  assert(response.id === id, `response id ${id}`);
  assert(response.result && !response.error, `response ${id} has result`);
}

function assertTextPayload(response, id) {
  assertJsonRpc(response, id);
  assert(Array.isArray(response.result.content), `response ${id} has content array`);
  assert(response.result.content[0]?.type === 'text', `response ${id} has text content`);
  JSON.parse(response.result.content[0].text);
}

function assert(condition, message) {
  if (!condition) throw new Error(`MCP verification failed: ${message}`);
}

async function makeFixtureProject() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'emp-mcp-verify-'));
  await fs.mkdir(path.join(directory, 'src/main/java/com/example'), { recursive: true });
  await fs.writeFile(path.join(directory, 'pom.xml'), `<?xml version="1.0" encoding="UTF-8"?>
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
  await fs.writeFile(path.join(directory, 'src/main/java/com/example/Demo.java'), `package com.example;

import javax.persistence.Entity;

@Entity
public class Demo {
}
`);
  return directory;
}
