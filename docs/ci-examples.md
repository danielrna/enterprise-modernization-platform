# CI Examples

These examples use Docker as the integration boundary. Replace `emp-cli` with the published image name once releases are published.

## GitLab CI

```yaml
readiness:
  image: docker:27
  services:
    - docker:27-dind
  script:
    - docker build -t emp-cli .
    - docker run --rm -v "$CI_PROJECT_DIR:/workspace" emp-cli analyze . --pack spring-boot-3-readiness --out emp-report
  artifacts:
    when: always
    paths:
      - emp-report/
```

## Jenkins

```groovy
pipeline {
  agent any
  stages {
    stage('Readiness') {
      steps {
        sh 'docker build -t emp-cli .'
        sh 'docker run --rm -v "$PWD:/workspace" emp-cli analyze . --pack spring-boot-3-readiness --out emp-report'
        archiveArtifacts artifacts: 'emp-report/**', fingerprint: true
      }
    }
  }
}
```

## Azure DevOps

```yaml
trigger:
  - main

pool:
  vmImage: ubuntu-latest

steps:
  - script: docker build -t emp-cli .
    displayName: Build EMP image

  - script: docker run --rm -v "$(Build.SourcesDirectory):/workspace" emp-cli analyze . --pack spring-boot-3-readiness --out emp-report
    displayName: Run readiness analysis

  - publish: emp-report
    artifact: emp-readiness-report
```
