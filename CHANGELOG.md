# Changelog

## Unreleased

- Added `npm run release:verify` to automate the release checklist across local tests, Docker build, Docker report generation, image-level tests, and report assertions.
- Added Apereo CAS 6.6 as a stronger public Spring Boot 2.x benchmark reference.
- Extended enterprise rules with severity, category, owner, rationale, remediation, include paths, and exclude paths.

## v0.1.1

- Fixed Docker image packaging so image-level release verification includes the Dockerfile test context.

## v0.1.0

- Created initial public project.
- Implemented the CLI MVP with `analyze`, `benchmarks`, and `hub` commands.
- Added Java/Spring scanner orchestration, readiness scoring, JSON report output, and static HTML report rendering.
- Generated 10 static public benchmark reports and the initial Migration Hub.
- Added the `transform` command with dry-run, apply, rollback snapshots, build validation evidence, Docker packaging, and transformation report sections.
- Added benchmark source modes for catalog, local checkouts, and shallow clone-and-run public repository evidence.
- Added OpenRewrite transform engine support for Maven and Gradle targets, with native rewrite fallback through `--engine auto`.
- Added the Java 17 to 21 readiness pack, Java target update planning, Trust Engine evidence, compatibility checks, confidence scoring, and Professional report section.
- Added the enterprise rules engine, `.preflight-rules.yml` loading, rule-aware readiness scoring, report rule sections, and MCP stdio `emp.analyze` interface.
- Added the Docker-based GitHub Action wrapper, Docker wrapper documentation, CI examples, and a release checklist.
- Added a Docker entrypoint that supports both local `/workspace` runs and GitHub Actions `GITHUB_WORKSPACE` runs.
- Packaged GitHub Action metadata and release docs inside the Docker image so image-level verification can run the full test suite.
