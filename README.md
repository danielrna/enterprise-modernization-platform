# Enterprise Modernization Platform

CLI-first modernization evidence for enterprise Java projects.

This repository contains the public MVP for analyzing Spring Boot modernization readiness, generating static HTML reports, publishing benchmark evidence, and running a first Spring Boot 2 to 3 transformation workflow.

## What It Does

- Scans Java/Spring repositories for modernization signals.
- Detects build metadata, Java version, Spring Boot version, Jakarta namespace readiness, and static source findings.
- Produces shareable HTML and JSON readiness reports.
- Publishes benchmark reports for public Java repositories.
- Generates a small Migration Hub for Spring Boot 2 to 3 evidence.
- Runs dry-run, apply, rollback, validation, and OpenRewrite-backed transformation flows.
- Packages the CLI in Docker with Node, Git, Maven, and Java 21.

## Quick Start

```bash
npm run check
node ./bin/emp.js analyze . --out reports/local
node ./bin/emp.js benchmarks --out docs/benchmarks
node ./bin/emp.js hub --out docs/migration-hub
```

Open the generated report:

```text
reports/local/index.html
```

## CLI

```bash
node ./bin/emp.js analyze <path> [--pack spring-boot-3-readiness] [--out reports/latest]
node ./bin/emp.js transform <path> [--mode dry-run|apply|rollback] [--engine native|openrewrite|auto] [--validate] [--out reports/transform]
node ./bin/emp.js benchmarks [--source catalog|local|clone] [--only slug[,slug]] [--limit n] [--out docs/benchmarks]
node ./bin/emp.js hub [--out docs/migration-hub]
```

## Transformation Demo

```bash
node ./bin/emp.js transform . --mode dry-run --validate --out reports/transform
node ./bin/emp.js benchmarks --source clone --only spring-petclinic --out reports/benchmarks-real
node ./bin/emp.js transform benchmark-repos/spring-petclinic --mode dry-run --engine openrewrite --out reports/openrewrite-dry-run
```

Apply mode creates rollback snapshots under `.emp/rollback/`.

## Docker

```bash
docker build -t emp-cli .
docker run --rm -v "$PWD:/workspace" emp-cli transform . --mode dry-run --validate --out reports/docker-transform
```

## Benchmarks

The checked-in benchmark reports under `docs/benchmarks/` were generated from public repository checkouts. Benchmark generation supports:

- `catalog`: deterministic metadata reports, no network required.
- `local`: analyze existing checkouts under `benchmark-repos/<slug>`.
- `clone`: shallow-clone missing repositories into `benchmark-repos/<slug>` and analyze the real checkout.

## Verification

```bash
npm run check
docker build -t emp-cli .
docker run --rm --entrypoint npm -w /app emp-cli run check
```

Current automated coverage verifies:

- Readiness analysis, report generation, benchmark publishing, and hub generation.
- Transformation dry-run, apply, rollback, validation evidence, and OpenRewrite engine selection.
- Workspace-root analysis ignores generated reports and cloned benchmark repositories.

## Status

Implemented MVP scope:

- CLI, readiness model, HTML/JSON report, 10 public benchmark reports, Migration Hub.
- Docker packaging, Spring Boot 2 to 3 transform flow, rollback evidence, validation evidence, OpenRewrite execution path.

Not included yet:

- MCP server integration.
- GitHub Action wrapper.
- Java 17 to 21 pack.
- Binary/API compatibility validation.
- Release automation.
