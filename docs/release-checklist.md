# Release Checklist

Use this checklist before publishing a tagged release.

## Verification

- Run the automated release verifier:

```bash
npm run release:verify
```

The verifier runs `npm run check`, builds the Docker image, generates the Docker readiness report, runs the image test suite, and checks the generated release report.

Manual equivalent:

- Run `npm run check`.
- Build the Docker image with `docker build -t emp-cli .`.
- Run a local Docker readiness report:

```bash
docker run --rm -v "$PWD:/workspace" emp-cli analyze . --pack spring-boot-3-readiness --out reports/release-readiness
```

- Run the Docker image test suite:

```bash
docker run --rm --entrypoint npm -w /app emp-cli run check
```

- Confirm `reports/release-readiness/index.html` exists and contains the expected pack, score, evidence, and finding summary.
- Validate the GitHub Action from a separate smoke-test repository after the tag is pushed.

## Release Artifacts

- Update `CHANGELOG.md`.
- Confirm `README.md` public status matches the release.
- Tag the release.
- Publish the Docker image if distributing outside GitHub Actions.
- Upload or link a sample readiness report.

## Post-Release

- Regenerate benchmark reports if pack behavior changed.
- Regenerate the Migration Hub if benchmark reports changed.
- Review benchmark coverage and add new public reports when behavior changes.
