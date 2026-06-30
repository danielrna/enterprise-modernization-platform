# GitHub Action

The repository can run as a Docker action and publish a static readiness report artifact.

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
        uses: danielrna/enterprise-modernization-platform-public@v0.1.0
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

The artifact contains:

- `emp-report/index.html`
- `emp-report/report.json`
