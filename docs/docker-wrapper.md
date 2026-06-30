# Docker Wrapper

The Docker image is the stable CI interface for the platform. It runs the same `emp` CLI used locally and writes reports into the mounted workspace.

## Build Locally

```bash
docker build -t emp-cli .
```

## Analyze A Repository

```bash
docker run --rm \
  -v "$PWD:/workspace" \
  emp-cli analyze . \
  --pack spring-boot-3-readiness \
  --out reports/docker-readiness
```

## Analyze With Enterprise Rules

```bash
docker run --rm \
  -v "$PWD:/workspace" \
  emp-cli analyze . \
  --pack spring-boot-3-readiness \
  --rules .preflight-rules.yml \
  --out reports/docker-readiness
```

## Dry-Run A Transformation

```bash
docker run --rm \
  -v "$PWD:/workspace" \
  emp-cli transform . \
  --pack spring-boot-3-readiness \
  --mode dry-run \
  --validate \
  --out reports/docker-transform
```

## Report Contract

Every CI integration should preserve these files as build artifacts:

- `reports/docker-readiness/index.html`
- `reports/docker-readiness/report.json`
