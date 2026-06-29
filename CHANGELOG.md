# Changelog

## Unreleased

- Created initial public project.
- Implemented the CLI MVP with `analyze`, `benchmarks`, and `hub` commands.
- Added Java/Spring scanner orchestration, readiness scoring, JSON report output, and static HTML report rendering.
- Generated 10 static public benchmark reports and the initial Migration Hub.
- Added the `transform` command with dry-run, apply, rollback snapshots, build validation evidence, Docker packaging, and transformation report sections.
- Added benchmark source modes for catalog, local checkouts, and shallow clone-and-run public repository evidence.
- Added OpenRewrite transform engine support for Maven and Gradle targets, with native rewrite fallback through `--engine auto`.
- Added the Java 17 to 21 readiness pack, Java target update planning, Trust Engine evidence, compatibility checks, confidence scoring, and Professional report section.
- Added the enterprise rules engine, `.preflight-rules.yml` loading, rule-aware readiness scoring, report rule sections, and MCP stdio `emp.analyze` interface.
