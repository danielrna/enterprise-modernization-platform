# Changelog

## Unreleased

- Promoted Hypersistence Utils to checkout-backed Hibernate readiness evidence with Maven toolchain failure evidence for the required JDK 8 toolchain.
- Promoted High Performance Java Persistence to checkout-backed Hibernate readiness evidence with validation timeout evidence under the current 120-second check budget.
- Promoted Hibernate Test Case Templates to checkout-backed Hibernate readiness evidence with passing Maven compile validation and honest test failure evidence for Docker-dependent reactive tests.

## v0.1.4

- Promoted Hibernate ORM Demos to checkout-backed Hibernate readiness evidence with passing Maven-wrapper compile/test validation.

## v0.1.3

- Added Trust Engine factors with confidence impacts and explicit evidence reasons.
- Added report next actions in JSON and HTML so readiness reports recommend prioritized follow-up work.
- Added generated Knowledge Base pages, starting with Hibernate readiness guidance from pack and benchmark evidence.
- Added the first Hibernate benchmark catalog batch with 5 catalog-backed Hibernate readiness reports.
- Added the Month 7 Hibernate readiness pack with ORM usage detection and static upgrade-risk signals.
- Added release-note generation from `features/catalog.json`, including static HTML and GitHub-ready Markdown output under `docs/release-notes/`.
- Added pack documentation generation from `packs/*.json`, including static GitHub Pages output under `docs/packs/`.
- Moved benchmark catalog data to `benchmarks/catalog.json`.
- Added `npm run benchmarks:publish` to regenerate the Migration Hub from published benchmark evidence and enforce benchmark report counts.
- Expanded the public benchmark catalog to 50 reports, including 49 Spring Boot readiness reports and one Jakarta readiness report.
- Promoted XXL-JOB, Spring Cloud Bus, and Spring Cloud CircuitBreaker from catalog-only reports to checkout-backed benchmark evidence; XXL-JOB passes Docker compile/test validation.
- Promoted ELAdmin to checkout-backed Spring Boot 2.7.18 evidence with passing Docker compile/test validation.
- Pinned Mall to `dev-v2`, making it checkout-backed Spring Boot 2.7.5 evidence with validation timeout evidence under the current budget.
- Pinned Halo to `v1.6.1`, making it checkout-backed Spring Boot 2.5.12 evidence with Docker Gradle failure evidence.
- Promoted Zipkin to a checkout-backed report; its current checkout is not applicable to the Spring Boot 2 to 3 pack.
- Added Spring Boot RealWorld Example App as a checkout-backed Spring Boot 2.6.3 benchmark with passing Gradle compile/test validation.
- Added benchmark validation support for project-specific Java runtime requirements through `EMP_JAVA_<major>_HOME`.

## v0.1.2

- Added `npm run release:verify` to automate the release checklist across local tests, Docker build, Docker report generation, image-level tests, and report assertions.
- Added `npm run ci:verify` for command-equivalent GitLab CI, Jenkins, and Azure DevOps example validation.
- Added Apereo CAS 6.6 as a stronger public Spring Boot 2.x benchmark reference.
- Replaced the Apereo CAS 6.6 catalog report with checkout-backed evidence, including failed Gradle validation output from the local Java/Gradle compatibility mismatch.
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
