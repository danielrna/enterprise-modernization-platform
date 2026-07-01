# Unreleased

Content engine improvements plus the first Month 7 mandatory pack expansion for Hibernate readiness.

## Hibernate readiness pack

Add a Hibernate 5.x to 6.x readiness pack with ORM usage detection, pack applicability, static risk findings, readiness scoring, generated docs, and CLI visibility.

Audience: Java consultants and persistence modernization teams

- Adds `packs/hibernate-readiness.json`.
- Detects Hibernate ORM usage from dependencies, source imports, and XML mappings.
- Flags legacy Criteria API, direct Session API usage, custom type integrations, Hibernate XML mappings, and overlapping Jakarta namespace work.

Links:
- [Hibernate pack docs](docs/packs/hibernate-readiness.html)

## Pack documentation generation

Generate static pack documentation from `packs/*.json`, including supported checks, readiness categories, report sections, and execution commands.

Audience: Consultants and technical evaluators

- Adds `npm run docs:generate`.
- Publishes static pages under `docs/packs/`.
- Wires pack docs into the benchmark publishing content workflow.

Links:
- [Pack docs](docs/packs/index.html)

## Release notes from feature metadata

Generate public release-note pages and a GitHub-ready Markdown draft from structured feature metadata.

Audience: Maintainers and release operators

- Adds `npm run release-notes:generate`.
- Publishes release-note pages under `docs/release-notes/`.
- Includes the generated Markdown draft in the same static output directory.

Links:
- [Release notes](docs/release-notes/index.html)

## Repeatable benchmark publishing

Regenerate the Migration Hub from checked-in benchmark evidence, enforce the benchmark count gate, and preserve checkout-backed validation evidence.

Audience: Maintainers and buyers reviewing public proof

- Adds `npm run benchmarks:publish`.
- Verifies the Month 6 benchmark gate with `--min-count 50`.
- Writes `reports/benchmark-publish-summary.json` during publication.

Links:
- [Benchmark reports](docs/benchmarks/index.html)
- [Migration Hub](docs/migration-hub/index.html)

## Expanded checkout-backed benchmark evidence

Promote additional public repositories from catalog-only reports to checkout-backed evidence, including honest pass, failure, timeout, and applicability results.

Audience: Consultants and enterprise reviewers

- Public catalog contains 50 benchmark reports.
- 16 reports are checkout-backed.
- 7 checkout benchmarks currently pass compile and test validation.

Links:
- [Validated benchmark reference](docs/benchmarks/spring-boot-realworld/index.html)
