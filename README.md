# Enterprise Modernization Platform

CLI-first readiness evidence for mandatory enterprise software modernization.

This public MVP starts with Enterprise Java Readiness: Spring Boot 2 to 3, Java 17 to 21, Jakarta namespace readiness, Hibernate readiness, Spring Security 6 readiness, JUnit 5 readiness, enterprise rules, transformation evidence, and static HTML reports a consultant can share with a client.

The product is not a Java migration tool. The product is confidence that an application is ready for a mandatory technology evolution.

## Try In 5 Minutes

Release: https://github.com/danielrna/enterprise-modernization-platform/releases/tag/v0.2.0

Sample smoke-test report: https://github.com/danielrna/enterprise-modernization-platform/releases/download/v0.2.0/emp-smoke-report.zip

Spring Boot 2 to 3 Migration Hub: https://danielrna.github.io/enterprise-modernization-platform/migration-hub/spring-boot-2-to-3.html

Migration pack docs: https://danielrna.github.io/enterprise-modernization-platform/packs/

Knowledge Base: https://danielrna.github.io/enterprise-modernization-platform/knowledge-base/

Release notes: https://danielrna.github.io/enterprise-modernization-platform/release-notes/

Consultant demo: https://danielrna.github.io/enterprise-modernization-platform/consultant-demo.html

Validated benchmark references:

- https://danielrna.github.io/enterprise-modernization-platform/benchmarks/gs-spring-boot-27/index.html
- https://danielrna.github.io/enterprise-modernization-platform/benchmarks/gs-rest-service-27/index.html
- https://danielrna.github.io/enterprise-modernization-platform/benchmarks/gs-serving-web-content-27/index.html
- https://danielrna.github.io/enterprise-modernization-platform/benchmarks/spring-petclinic-rest-26/index.html
- https://danielrna.github.io/enterprise-modernization-platform/benchmarks/spring-boot-realworld/index.html

Editions: https://danielrna.github.io/enterprise-modernization-platform/editions.html

Contact: https://danielrna.github.io/enterprise-modernization-platform/contact.html

Run the analyzer on any Java or Spring repository:

```bash
git clone https://github.com/danielrna/enterprise-modernization-platform.git
cd enterprise-modernization-platform
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
docker run --rm -v "$PWD:/workspace" danielrna/enterprise-modernization-platform:v0.2.0 analyze . --pack spring-boot-3-readiness --out reports/docker-readiness
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
        uses: danielrna/enterprise-modernization-platform@v0.2.0
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
node ./bin/emp.js analyze <path> [--pack spring-boot-3-readiness|java-17-to-21-readiness|jakarta-readiness|hibernate-readiness|spring-security-6-readiness|junit-5-readiness] [--rules .preflight-rules.yml] [--out reports/latest]
node ./bin/emp.js transform <path> [--pack spring-boot-3-readiness|java-17-to-21-readiness|jakarta-readiness|hibernate-readiness|spring-security-6-readiness|junit-5-readiness] [--mode dry-run|apply|rollback] [--engine native|openrewrite|auto] [--validate] [--out reports/transform]
node ./bin/emp.js benchmarks [--source catalog|local|clone] [--only slug[,slug]] [--limit n] [--validate] [--validation-timeout-ms 120000] [--out docs/benchmarks]
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

## Consultant Workflow

Use the platform to turn a mandatory upgrade into a client-ready evidence report:

1. Run the free readiness report.
2. Send the static HTML report to the client.
3. Fix the highest-risk findings.
4. Validate compilation and tests.
5. Sell migration confidence, not a generic migration script.

The public validation set now proves the reference flow on 30 real checkouts, including real Spring Boot applications, Hibernate ORM evidence, and Spring Security evidence outside Spring Guides. The validated set includes Spring Boot `2.6.2`, `2.6.3`, and `2.7.6` projects plus Hibernate and Spring Security reports with passing, failing, and timeout validation evidence.

## Editions

- Community: readiness analysis, HTML report, JSON report, and public benchmark reference.
- Professional: validation evidence, Trust Engine report, repeatable benchmark pack, and stronger confidence trail.
- Consultant: repeated client usage, enterprise rules workflow, and reusable reporting assets.
- Organization: team usage, shared rules workflow, and CI-ready evidence reports.

Access requests are handled through the static contact page: https://danielrna.github.io/enterprise-modernization-platform/contact.html

## Enterprise Rules

The platform does not impose organization-specific rules. Each team can provide its own `.preflight-rules.yml`:

```yaml
rules:
  - name: javax forbidden
    type: forbidden-package
    pattern: javax.*
    severity: critical
    category: api
    owner: platform-team
    rationale: Spring Boot 3 requires Jakarta namespaces.
    remediation: https://github.com/openrewrite/rewrite-migrate-java
    paths: src/main/java/**
    exclude-paths: src/test/**
  - name: System.out forbidden
    type: forbidden-call
    pattern: System.out
    severity: warning
    category: code-quality
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
- `--validate`: on checkout-backed benchmarks, run compile and test commands through Maven or Gradle wrappers when available, then capture status, duration, exit code, timeout, and log excerpts.
- Benchmarks that declare a required Java runtime can resolve it through `EMP_JAVA_<major>_HOME` before validation, for example `EMP_JAVA_17_HOME=/path/to/jdk17`.

Regenerate static assets:

```bash
node ./bin/emp.js benchmarks --out docs/benchmarks
node ./bin/emp.js benchmarks --source local --validate --validation-timeout-ms 30000 --out docs/benchmarks
node ./bin/emp.js hub --out docs/migration-hub
npm run docs:generate
npm run knowledge:generate
npm run release-notes:generate
npm run consultant:demo
npm run benchmarks:publish
```

`npm run docs:generate` generates static pack documentation from `packs/*.json`. `npm run knowledge:generate` generates Knowledge Base pages from `knowledge/*.json`. `npm run release-notes:generate` generates public HTML and GitHub-ready Markdown release notes from `features/catalog.json`. `npm run consultant:demo` generates the Consultant Demo page and downloadable bundle. `npm run benchmarks:publish` uses the checked-in benchmark reports by default, regenerates the Migration Hub, pack docs, Knowledge Base, release notes, Consultant Demo, writes `reports/benchmark-publish-summary.json`, and asserts the current report count. Use `npm run benchmarks:publish -- --min-count 75` for the current benchmark gate. Use `node ./scripts/benchmark-publish.js --source local --validate` or `--source clone --validate` when intentionally refreshing checkout-backed evidence.

## Verification

```bash
npm run check
docker build -t emp-cli .
docker run --rm --entrypoint npm -w /app emp-cli run check
```

Current automated coverage verifies:

- Readiness analysis, report generation, benchmark publishing, and hub generation.
- Report next-action recommendations in JSON and HTML output.
- Trust Engine confidence factors with explicit status, impact, reason, and evidence.
- Pack documentation generation from pack metadata.
- Release-note generation from feature metadata.
- Checkout benchmark validation evidence for compilation and tests.
- Transformation dry-run, apply, rollback, validation evidence, and OpenRewrite engine selection.
- Java 17 to 21 target update planning and Trust Engine evidence.
- Enterprise rules and MCP `emp.analyze`.
- Workspace-root analysis ignores generated reports and cloned benchmark repositories.

## Current Status

Implemented through v0.2.0:

- CLI, Docker, MCP, and GitHub Action interfaces.
- Spring Boot 2 to 3 readiness and transformation workflow.
- Java 17 to 21 readiness pack.
- Jakarta readiness pack.
- Hibernate readiness pack.
- Spring Security 6 readiness pack.
- JUnit 5 readiness pack.
- Enterprise rules.
- Trust evidence and static HTML/JSON reports.
- 49 Spring Boot benchmark reports plus Jakarta readiness, 10 Hibernate readiness benchmark reports, 5 Spring Security readiness benchmark reports, and 10 JUnit readiness benchmark reports.
- Validation status in benchmark reports and the Migration Hub, including 30 checkout-backed reports and 13 reports with passing compile/test evidence.
- Consultant Demo page and downloadable consultant demo bundle.
- Spring Boot 2 to 3 Migration Hub published through GitHub Pages.

Still intentionally out of scope:

- Backend SaaS.
- Multi-tenant database.
- Custom parser, AST, or compiler.
- Complex dashboard.
- IntelliJ plugin.
