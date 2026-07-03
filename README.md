# Enterprise Modernization Platform

CLI-first readiness evidence for mandatory enterprise software modernization.

This public MVP starts with Enterprise Java Readiness: Spring Boot 2 to 3, Java 17 to 21, Jakarta namespace readiness, Hibernate readiness, Spring Security 6 readiness, JUnit 5 readiness, enterprise rules, transformation evidence, and static HTML reports a consultant can share with a client.

The product is not a Java migration tool. The product is confidence that an application is ready for a mandatory technology evolution.

## Try In 5 Minutes

The fastest path is Docker. Run this from the Java repository you want to inspect:

```bash
docker run --rm -v "$PWD:/workspace" danielrna/enterprise-modernization-platform:v0.5.6 analyze . --pack spring-boot-3-readiness --out reports/emp-readiness
```

Open the report:

```text
reports/emp-readiness/index.html
```

You should expect a static HTML report plus `reports/emp-readiness/report.json`. A low score or failed validation does not mean the tool failed; it means the report found migration risk, missing build metadata, Java/toolchain mismatch, dependency issues, test failures, or timeout evidence that should be handled before migration execution.

If the report says the selected pack is not applicable, first confirm that you ran the command from the actual application directory. Multi-sample repositories often need a subdirectory such as `complete/` instead of the repository root. If the application is already on Spring Boot 3.x, use a more relevant pack such as `jakarta-readiness`, `java-17-to-21-readiness`, `spring-security-6-readiness`, or `junit-5-readiness`.

Release: https://github.com/danielrna/enterprise-modernization-platform/releases/tag/v0.5.6

Sample smoke-test report: https://github.com/danielrna/enterprise-modernization-platform/releases/download/v0.5.6/emp-smoke-report.zip

Quickstart: https://danielrna.github.io/enterprise-modernization-platform/quickstart.html

External trial proof and case study: https://danielrna.github.io/enterprise-modernization-platform/external-trial.html

Outreach packet: https://danielrna.github.io/enterprise-modernization-platform/outreach-packet.html

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

Local source checkout path:

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

Run the published Docker image from the target repository:

```bash
docker run --rm -v "$PWD:/workspace" danielrna/enterprise-modernization-platform:v0.5.6 analyze . --pack spring-boot-3-readiness --out reports/docker-readiness
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

Copy this into an external Java repository as `.github/workflows/emp-readiness.yml`:

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
        uses: danielrna/enterprise-modernization-platform@v0.5.6
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

After the workflow completes, download the `emp-readiness-report` artifact and open `index.html`.

## CLI

```bash
node ./bin/emp.js analyze <path> [--pack spring-boot-3-readiness|java-17-to-21-readiness|jakarta-readiness|hibernate-readiness|spring-security-6-readiness|junit-5-readiness] [--rules .preflight-rules.yml] [--out reports/latest]
node ./bin/emp.js transform <path> [--pack spring-boot-3-readiness|java-17-to-21-readiness|jakarta-readiness|hibernate-readiness|spring-security-6-readiness|junit-5-readiness] [--mode dry-run|apply|rollback] [--engine native|openrewrite|auto] [--validate] [--out reports/transform]
node ./bin/emp.js benchmarks [--source catalog|local|clone] [--only slug[,slug]] [--limit n] [--validate] [--validation-timeout-ms 120000] [--out docs/benchmarks]
node ./bin/emp.js hub [--out docs/migration-hub]
node ./bin/emp.js mcp
npm run mcp:verify
```

The MCP stdio server exposes:

- `emp.analyze`: run readiness analysis with optional enterprise rules.
- `emp.packs`: list modernization packs or return detailed metadata for one pack.
- `emp.benchmarks`: summarize published benchmark evidence with optional pack, source, validation-status, and limit filters.
- `emp.transformPlan`: create a dry-run transformation plan without applying file changes.

See the generated MCP guide at `docs/mcp.html` for JSON-RPC examples and the recommended AI workflow.

## What It Does

- Scans Java/Spring repositories for modernization signals.
- Detects build metadata, Java version, Spring Boot version, Jakarta namespace readiness, and static source findings.
- Produces shareable HTML and JSON readiness reports.
- Publishes benchmark reports for public Java repositories.
- Generates a Migration Hub for Spring Boot 2 to 3 evidence.
- Runs dry-run, apply, rollback, validation, and OpenRewrite-backed transformation flows.
- Captures trust evidence for compilation, tests, rollback, binary compatibility, public API compatibility, breaking API count, and confidence.
- Applies client-owned enterprise rules from `.preflight-rules.yml`.
- Exposes an MCP stdio interface for AI clients through `emp.analyze`, `emp.packs`, `emp.benchmarks`, and `emp.transformPlan`.
- Packages the CLI in Docker with Node, Git, Maven, and Java 21.

## Consultant Workflow

Use the platform to turn a mandatory upgrade into a client-ready evidence report:

1. Run the free readiness report.
2. Send the static HTML report to the client.
3. Fix the highest-risk findings.
4. Validate compilation and tests.
5. Sell migration confidence, not a generic migration script.

The public validation set now proves the reference flow on 75 real checkouts, including real Spring Boot applications, Hibernate ORM evidence, Spring Security evidence, JUnit migration evidence, and heavyweight platform repositories outside Spring Guides. The validated set includes Spring Boot `2.6.2`, `2.6.3`, and `2.7.6` projects plus passing, failing, Java compatibility, and timeout validation evidence.

The external GitHub Action path has also been validated from the separate `danielrna/emp-action-smoke-test` repository. Run `28679821177` used `danielrna/enterprise-modernization-platform@v0.5.4`, completed successfully, and uploaded an `emp-readiness-report` artifact containing `index.html` and `report.json`.

Additional Docker-first external trials were run against public repositories outside the 75-report benchmark catalog:

- `callicoder/spring-boot-mysql-rest-api-tutorial`: Spring Boot 2.5.5, Maven, Java 11, applicable to the Spring Boot 3 readiness pack, 82% readiness, with Jakarta namespace migration as the top action.
- `mertakdut/Spring-Boot-Sample-Project`: Spring Boot 2.1.3, Java 8, Maven, applicable at 59% readiness, with Spring Security review and readiness cleanup as the strongest offer branch.
- `shekhargulati/spring-boot-maven-angular-starter`: Spring Boot 2.2.6, Java 8, Maven, applicable at 81% readiness, with validation and dry-run transformation as the natural follow-up.
- `dsyer/spring-boot-angular`: Spring Boot 2.6.0, Java 8, Maven, applicable at 83% readiness, with Spring Boot 3 validation as the next action.
- `geekidea/spring-boot-assembly`: Spring Boot 2.1.0, Java 8, Maven, applicable at 73% readiness, with Jakarta namespace migration and runtime planning as the top action.
- `spring-guides/gs-accessing-data-jpa`: root-level run completed, but the selected pack was not applicable because the repository is a multi-sample guide and should be run from an application subdirectory.
- `RameshMF/springboot-thymeleaf-crud-pagination-sorting-webapp`: run completed, but Spring Boot 3.0.4 made the Spring Boot 2 to 3 pack non-applicable.
- `bezkoder/spring-boot-data-jpa-mysql`: run completed, but Spring Boot 3.1.5 made the Spring Boot 2 to 3 pack non-applicable.
- `bezkoder/spring-boot-jpa-postgresql`: run completed, but Spring Boot 3.1.0 made the Spring Boot 2 to 3 pack non-applicable.

How to read the evidence:

- `checkout-backed` means the report was generated from a real repository checkout, not only curated catalog metadata.
- `passed` validation means compile and test commands completed in the validation environment.
- `failed` validation is still useful when the output shows an exact compiler error, missing toolchain, dependency failure, or test failure.
- `timeout` evidence is honest evidence for heavyweight builds; it proves where a consultant should narrow modules, raise budgets, or prepare the client environment.
- `not applicable` means the selected pack did not match the repository enough to claim a readiness score.

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

Implemented through v0.5.6:

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
- Validation status in benchmark reports and the Migration Hub, including 75 checkout-backed reports and 17 reports with passing compile/test evidence.
- Consultant Demo page and downloadable consultant demo bundle.
- Spring Boot 2 to 3 Migration Hub published through GitHub Pages.

Current roadmap phase: Phase 2, Distribution and Conversion Proof, is complete. Phase 1 Evidence Depth produced 75 checkout-backed public reports. Phase 2 made that proof runnable through Docker and GitHub Actions, validated the action path from an external-style repository, and added 9 Docker-first external trial runs outside the benchmark catalog.

Current growth branch: conversion proof. The product should use the 9 external trial snapshots to test consultant outreach and paid follow-up offers before adding another pack or increasing benchmark volume.

The Outreach Packet groups those 9 snapshots into offer branches and copy/paste messages for testing replies from Java consultants and teams.

Still intentionally out of scope:

- Backend SaaS.
- Multi-tenant database.
- Custom parser, AST, or compiler.
- Complex dashboard.
- IntelliJ plugin.
