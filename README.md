# Enterprise Modernization Platform

CLI-first readiness evidence for mandatory enterprise software modernization.

This public MVP starts with Enterprise Java Readiness: Spring Boot 2 to 3, Java 17 to 21, Jakarta namespace readiness, enterprise rules, transformation evidence, and static HTML reports a consultant can share with a client.

The product is not a Java migration tool. The product is confidence that an application is ready for a mandatory technology evolution.

## Try In 5 Minutes

Release: https://github.com/danielrna/enterprise-modernization-platform-public/releases/tag/v0.1.0

Sample smoke-test report: https://github.com/danielrna/enterprise-modernization-platform-public/releases/download/v0.1.0/emp-smoke-report.zip

Run the analyzer on any Java or Spring repository:

```bash
git clone https://github.com/danielrna/enterprise-modernization-platform-public.git
cd enterprise-modernization-platform-public
npm run check
node ./bin/emp.js analyze /path/to/spring-app --out reports/readiness
```

Open the generated report:

```text
reports/readiness/index.html
```

## Docker

Run the published Docker image:

```bash
docker run --rm -v "$PWD:/workspace" danielrna/enterprise-modernization-platform:v0.1.0 analyze . --pack spring-boot-3-readiness --out reports/docker-readiness
```

Or build the CLI image locally:

```bash
docker build -t emp-cli .
```

Run a readiness report against the current repository:

```bash
docker run --rm -v "$PWD:/workspace" emp-cli analyze . --pack spring-boot-3-readiness --out reports/docker-readiness
```

Run a transformation dry-run with validation evidence:

```bash
docker run --rm -v "$PWD:/workspace" emp-cli transform . --mode dry-run --validate --out reports/docker-transform
```

## GitHub Action

Use this repository as a Docker action:

```yaml
name: EMP Readiness

on:
  workflow_dispatch:
  push:

jobs:
  readiness:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run EMP readiness
        uses: danielrna/enterprise-modernization-platform-public@v0.1.0
        with:
          path: .
          pack: spring-boot-3-readiness
          out: emp-report

      - name: Upload EMP report
        uses: actions/upload-artifact@v4
        with:
          name: emp-readiness-report
          path: emp-report
```

## CLI

```bash
node ./bin/emp.js analyze <path> [--pack spring-boot-3-readiness|java-17-to-21-readiness|jakarta-readiness] [--rules .preflight-rules.yml] [--out reports/latest]
node ./bin/emp.js transform <path> [--pack spring-boot-3-readiness|java-17-to-21-readiness|jakarta-readiness] [--mode dry-run|apply|rollback] [--engine native|openrewrite|auto] [--validate] [--out reports/transform]
node ./bin/emp.js benchmarks [--source catalog|local|clone] [--only slug[,slug]] [--limit n] [--out docs/benchmarks]
node ./bin/emp.js hub [--out docs/migration-hub]
node ./bin/emp.js mcp
```

## What It Does

- Scans Java/Spring repositories for modernization signals.
- Detects build metadata, Java version, Spring Boot version, Jakarta namespace readiness, and static source findings.
- Produces shareable HTML and JSON readiness reports.
- Publishes benchmark reports for public Java repositories.
- Generates a Migration Hub for Spring Boot 2 to 3 evidence.
- Runs dry-run, apply, rollback, validation, and OpenRewrite-backed transformation flows.
- Captures trust evidence for compilation, tests, rollback, binary compatibility, public API compatibility, breaking API count, and confidence.
- Applies client-owned enterprise rules from `.preflight-rules.yml`.
- Exposes an MCP stdio interface for AI clients through `emp.analyze`.
- Packages the CLI in Docker with Node, Git, Maven, and Java 21.

## Enterprise Rules

The platform does not impose organization-specific rules. Each team can provide its own `.preflight-rules.yml`:

```yaml
rules:
  - name: javax forbidden
    type: forbidden-package
    pattern: javax.*
  - name: System.out forbidden
    type: forbidden-call
    pattern: System.out
```

Run with:

```bash
node ./bin/emp.js analyze /path/to/app --rules .preflight-rules.yml --out reports/client-readiness
```

## Transformation Demo

```bash
node ./bin/emp.js transform /path/to/app --mode dry-run --validate --out reports/transform
node ./bin/emp.js benchmarks --source clone --only spring-petclinic --out reports/benchmarks-real
node ./bin/emp.js transform benchmark-repos/spring-petclinic --mode dry-run --engine openrewrite --out reports/openrewrite-dry-run
```

Apply mode creates rollback snapshots under `.emp/rollback/`.

## Benchmarks And Migration Hub

Checked-in benchmark reports under `docs/benchmarks/` provide public evidence from open source Java projects.

Benchmark generation supports:

- `catalog`: deterministic metadata reports, no network required.
- `local`: analyze existing checkouts under `benchmark-repos/<slug>`.
- `clone`: shallow-clone missing repositories into `benchmark-repos/<slug>` and analyze the real checkout.

Regenerate static assets:

```bash
node ./bin/emp.js benchmarks --out docs/benchmarks
node ./bin/emp.js hub --out docs/migration-hub
```

## Verification

```bash
npm run check
docker build -t emp-cli .
docker run --rm --entrypoint npm -w /app emp-cli run check
```

Current automated coverage verifies:

- Readiness analysis, report generation, benchmark publishing, and hub generation.
- Transformation dry-run, apply, rollback, validation evidence, and OpenRewrite engine selection.
- Java 17 to 21 target update planning and Trust Engine evidence.
- Enterprise rules and MCP `emp.analyze`.
- Workspace-root analysis ignores generated reports and cloned benchmark repositories.

## Current Status

Implemented v0.1 scope:

- CLI, Docker, MCP, and GitHub Action interfaces.
- Spring Boot 2 to 3 readiness and transformation workflow.
- Java 17 to 21 readiness pack.
- Jakarta readiness pack.
- Enterprise rules.
- Trust evidence and static HTML/JSON reports.
- 10 public benchmark reports.
- Initial Spring Boot 2 to 3 Migration Hub.

Still intentionally out of scope:

- Backend SaaS.
- Multi-tenant database.
- Custom parser, AST, or compiler.
- Complex dashboard.
- IntelliJ plugin.
