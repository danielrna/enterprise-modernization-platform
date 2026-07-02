# AGENTS.md

Repo guidance for coding agents. Keep this file compact; it is loaded often.

## Project

- Enterprise Modernization Platform: CLI-first Node.js tool for Java modernization readiness evidence.
- Distribution surfaces: CLI, Docker, GitHub Action, MCP stdio, static HTML/JSON reports, GitHub Pages docs.
- Do not add SaaS backend, DB, multi-tenancy, dashboard, IDE plugin, or server service unless asked.
- Product source: `src/`, `bin/`, `scripts/`, `packs/`, `knowledge/`, `features/`, `benchmarks/`.
- Public generated assets: `docs/`.
- `benchmark-repos/` contains external checkouts; treat as generated/non-product source.

## Agent Efficiency

- Start with targeted reads: `package.json`, touched files, nearby tests, then broader search only if needed.
- Prefer `rg`/`rg --files`; avoid broad recursive dumps.
- Keep edits scoped. No unrelated refactors or churn.
- Report only key changes, verification, and blockers.
- Working tree may be dirty; inspect `git status --short` and never revert user changes unless asked.

## Commands

Main gate:

```bash
npm run check
```

Release gate:

```bash
npm run release:verify
```

Regenerate public assets:

```bash
node ./scripts/benchmark-publish.js --min-count 75
```

Targeted generators:

```bash
npm run docs:generate
npm run knowledge:generate
npm run release-notes:generate
npm run consultant:demo
npm run mcp:verify
```

## Release Sync

For releases, keep in sync:

- `package.json` version.
- `src/cli.js` `VERSION`.
- `src/mcp.js` MCP `serverInfo.version`.
- `src/hub.js` `RELEASE_VERSION`.
- README release, Docker, GitHub Action, and status references.
- `CHANGELOG.md`.
- `features/catalog.json`.
- `docs/release-notes/vX.Y.Z.{md,html}`.
- `test/emp.test.js` release-note/current-release assertions.

Before tag:

```bash
npm run check
npm run release:verify
```

Publish pattern:

```bash
git tag vX.Y.Z
git push origin main
git push origin vX.Y.Z
docker build -t danielrna/enterprise-modernization-platform:vX.Y.Z .
docker push danielrna/enterprise-modernization-platform:vX.Y.Z
gh release create vX.Y.Z --title "vX.Y.Z" --notes-file docs/release-notes/vX.Y.Z.md reports/emp-smoke-report.zip reports/emp-consultant-demo.zip
```

Verify GitHub Pages URLs after publishing.

## Evidence Rules

- Preserve honest evidence: failures, timeouts, missing dependencies, and pack mismatches are useful when accurate.
- Prefer checkout-backed reports over catalog-only reports when improving public evidence.
- Prefer Docker validation if host Maven/Gradle is unavailable.
- Use `--source clone` only for intentional public evidence refresh.
- Use `--source local` for existing `benchmark-repos/` validation.
- Do not silently downgrade checkout-backed or validation-passed evidence.
- Keep `--min-count 75` unless catalog intentionally expands.

## Generated Mapping

- `features/catalog.json` -> `docs/release-notes/`.
- `knowledge/*.json` -> `docs/knowledge-base/`.
- `packs/*.json` -> `docs/packs/`.
- `docs/benchmarks/*/report.json` -> benchmark HTML + Migration Hub summaries.
- `src/consultant-demo.js` + selected reports -> `docs/consultant-demo.html`, `reports/emp-consultant-demo.zip`.

## Style

- ES modules.
- Minimal dependencies; prefer Node built-ins.
- Use structured parsers or existing helpers when available.
- Static, plain, shareable generated pages.
- Evidence wording over marketing copy.
- Ignore sibling private notes unless explicitly asked.
