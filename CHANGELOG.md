# Changelog

## Unreleased

## v0.4.1

- Added benchmark report finding compaction so large checkout-backed reports keep full finding totals and summaries while capping detailed JSON findings to representative samples.
- Regenerated published benchmark reports with compacted detail arrays, reducing the Baeldung Hibernate Tutorials JSON report from about 12 MB to about 260 KB while preserving 17,621 total findings and passing validation evidence.
- Preserved the `v0.4.0` evidence counts: 75 public reports, 50 checkout-backed reports, and 17 passing validation reports.

## v0.4.0

- Promoted Baeldung Hibernate Tutorials to checkout-backed Hibernate readiness evidence with passing Docker-backed Maven compile/test validation.
- Promoted Spring Petclinic, Spring Cloud Zookeeper, Spring Cloud Vault, and Spring Cloud Commons to checkout-backed Spring Boot readiness evidence with honest compile-pass, timeout, and test failure evidence.
- Raised checkout-backed benchmark evidence to 50 reports and passing validation evidence to 17 reports while preserving the 75-report public catalog.

## v0.3.1

- Restored explicit GitHub Pages deployment with `actions/deploy-pages@v4`, unique Pages artifacts, and the `github-pages` environment after branch-only publishing left the public site on an old snapshot.
- Preserved the `v0.3.0` evidence counts: 75 public reports, 45 checkout-backed reports, and 16 passing validation reports.

## v0.3.0

- Promoted JHipster Sample App, Spring Cloud Config, Spring Cloud Consul, Spring Cloud Task, and Spring Cloud OpenFeign to checkout-backed Spring Boot readiness evidence with honest Java compatibility, timeout, and passing validation evidence.
- Raised checkout-backed benchmark evidence to 45 reports and passing validation evidence to 16 reports while preserving the 75-report public catalog.

## v0.2.9

- Promoted Mockito JUnit 4 Samples, PowerMock JUnit 4, REST Assured JUnit 4, and Testcontainers JUnit 4 to checkout-backed JUnit readiness evidence with honest Gradle/Maven timeout, dependency, compiler, and Java compatibility evidence.
- Added a versioned `emp-release-loop` Codex skill for repetitive EMP benchmark and release workflows.
- Raised checkout-backed benchmark evidence to 40 reports while preserving the 75-report public catalog and 15 passing validation reports.

## v0.2.8

- Promoted JUnit Quickcheck and WireMock JUnit 4 to checkout-backed JUnit readiness evidence with honest Maven dependency/test failure and Gradle timeout validation evidence.
- Raised checkout-backed benchmark evidence to 36 reports while preserving the 75-report public catalog and 15 passing validation reports.

## v0.2.7

- Added the Trust Engine Evidence Guide Knowledge Base article for explaining confidence factors, validation evidence, pack applicability, and report limits.

## v0.2.6

- Promoted JUnit 4 Samples to checkout-backed JUnit readiness evidence with passing Maven compile/test validation.
- Promoted Spring Petclinic JUnit to checkout-backed evidence with passing Maven compile validation and honest test-timeout evidence.
- Raised checkout-backed benchmark evidence to 34 reports and passing validation evidence to 15 reports while preserving the 75-report public catalog.

## v0.2.5

- Added an MCP documentation page and `npm run mcp:verify` smoke verification for all MCP tools.

## v0.2.4

- Added the MCP `emp.transformPlan` tool so AI clients can inspect dry-run transformation plans without applying changes.

## v0.2.3

- Added the MCP `emp.benchmarks` tool so AI clients can summarize published benchmark evidence by pack, source, and validation status.

## v0.2.2

- Added the MCP `emp.packs` tool so AI clients can discover available modernization packs before running analysis.

## v0.2.1

- Promoted Spring Petclinic REST JUnit to checkout-backed JUnit readiness evidence with passing Maven compile/test validation.
- Promoted AssertJ Examples JUnit 4 to checkout-backed module evidence with passing Maven compile validation and honest Neo4j-related test failure evidence.
- Raised checkout-backed benchmark evidence to 32 reports and passing validation evidence to 14 reports while preserving the 75-report public catalog.

## v0.2.0

- Promoted JHipster Sample Security and Keycloak Security Adapter to checkout-backed Spring Security readiness evidence, completing the initial Spring Security checkout batch.
- Added the JUnit 5 readiness pack for JUnit 4 to JUnit 5 modernization planning.
- Added JUnit 4/JUnit 5 static detection, JUnit migration findings, testing readiness scoring, and report next actions.
- Added the JUnit 5 Readiness Knowledge Base article and 10 catalog-backed JUnit readiness benchmark reports, raising the public benchmark catalog to 75 reports.
- Added pack-specific Migration Hub evidence pages for every modernization pack.

## v0.1.9

- Promoted Spring Petclinic REST Security, Spring Boot RealWorld Security, and Spring Security Samples Legacy to checkout-backed Spring Security readiness evidence.
- Added passing Maven compile/test validation evidence for Spring Petclinic REST Security.
- Preserved honest Gradle/JDK failure evidence for Spring Boot RealWorld Security and Spring Security Samples Legacy.
- Raised checkout-backed benchmark evidence to 28 reports and passing validation evidence to 13 reports.

## v0.1.8

- Added the Spring Security 6 readiness pack for Spring Security 5.x to 6.x modernization planning.
- Added Spring Security static risk findings for WebSecurityConfigurerAdapter, legacy matcher APIs, authorizeRequests configuration, and global method security annotations.
- Added the Spring Security 6 Readiness Knowledge Base article.
- Added five catalog-backed Spring Security readiness benchmark reports, raising the public benchmark catalog to 65 reports.

## v0.1.7

- Added a static Consultant Demo page that packages green-path, partial-validation, and advanced Hibernate evidence for client conversations.
- Added `npm run consultant:demo` to generate `docs/consultant-demo.html` and `reports/emp-consultant-demo.zip`.
- Added the consultant demo to the benchmark publishing workflow and release verification surface.

## v0.1.6

- Added five more Hibernate readiness benchmark reports, raising the public benchmark catalog to 60 reports.
- Promoted Spring JavaConfig Sample, Spring 4 Hibernate 5 Example, Hibernate Spatial 5 Sample, Java Hibernate Hello World, and Bookstore Spring Hibernate to checkout-backed evidence.
- Added four more passing Hibernate compile/test validation reports, raising validated passing evidence to 12 reports.
- Added the Hibernate Validation Failure Patterns Knowledge Base article.

## v0.1.5

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
