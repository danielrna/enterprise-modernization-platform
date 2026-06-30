import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { analyzeProject } from './scanner.js';
import { scoreReadiness } from './readiness.js';
import { writeReportBundle } from './report.js';
import { generateBenchmarkIndex } from './hub.js';

export const BENCHMARKS = [
  benchmark({
    slug: 'spring-petclinic',
    name: 'Spring Petclinic',
    repository: 'https://github.com/spring-projects/spring-petclinic',
    pack: 'spring-boot-3-readiness',
    buildTool: 'Maven',
    javaVersion: '17',
    springBootVersion: '4.0.0-SNAPSHOT',
    fileCount: 126,
    javaFileCount: 47,
    jakartaDetected: true,
    javaxDetected: true,
    hibernateDetected: true,
    springSecurityDetected: false,
    findings: [
      finding('javax-usage', 'critical', 'javax namespace usage detected', 'Plan Jakarta migration before Spring Boot 3 execution.', 'src/main/java/org/springframework/samples/petclinic/model/BaseEntity.java', 3),
      ...repeatFindings(14, 'field-injection', 'warning', 'Spring field injection patterns', 'Prefer constructor injection in services touched by migration work.', 'src/main/java/org/springframework/samples/petclinic')
    ]
  }),
  benchmark({
    slug: 'jhipster-sample-app',
    name: 'JHipster Sample App',
    repository: 'https://github.com/jhipster/jhipster-sample-app',
    pack: 'spring-boot-3-readiness',
    buildTool: 'Maven',
    javaVersion: '21',
    springBootVersion: '4.0.6',
    fileCount: 609,
    javaFileCount: 136,
    jakartaDetected: true,
    javaxDetected: true,
    hibernateDetected: true,
    springSecurityDetected: true,
    findings: [
      finding('javax-usage', 'critical', 'javax namespace usage detected', 'Plan Jakarta migration before Spring Boot 3 execution.', 'src/main/java/io/github/jhipster/sample/domain/Operation.java', 8),
      ...repeatFindings(53, 'field-injection', 'warning', 'Spring field injection patterns', 'Prefer constructor injection in services touched by migration work.', 'src/main/java/io/github/jhipster/sample')
    ]
  }),
  benchmark({
    slug: 'flowable-engine',
    name: 'Flowable Engine',
    repository: 'https://github.com/flowable/flowable-engine',
    pack: 'spring-boot-3-readiness',
    buildTool: 'Maven',
    javaVersion: '1.8',
    springBootVersion: 'unknown',
    fileCount: 16016,
    javaFileCount: 8004,
    jakartaDetected: true,
    javaxDetected: true,
    hibernateDetected: true,
    springSecurityDetected: true,
    findings: [
      finding('javax-usage', 'critical', 'javax namespace usage detected', 'Plan Jakarta migration before Spring Boot 3 execution.', 'modules/flowable-engine/src/main/java/org/flowable/engine/impl/persistence/entity/ExecutionEntity.java', 12),
      finding('spring-boot-version-unknown', 'warning', 'Spring Boot version unknown', 'Declare Spring Boot version explicitly in Maven or Gradle metadata.'),
      ...repeatFindings(601, 'field-injection', 'warning', 'Spring field injection patterns', 'Prefer constructor injection in services touched by migration work.', 'modules/flowable-spring/src/main/java/org/flowable/spring'),
      ...repeatFindings(842, 'java-util-date', 'info', 'Legacy date API usage', 'Review domain date handling.', 'modules/flowable-engine/src/main/java/org/flowable/engine')
    ]
  }),
  benchmark({
    slug: 'thingsboard',
    name: 'ThingsBoard',
    repository: 'https://github.com/thingsboard/thingsboard',
    pack: 'spring-boot-3-readiness',
    buildTool: 'Maven',
    javaVersion: 'unknown',
    springBootVersion: 'unknown',
    fileCount: 10065,
    javaFileCount: 4770,
    jakartaDetected: true,
    javaxDetected: true,
    hibernateDetected: true,
    springSecurityDetected: true,
    findings: [
      finding('javax-usage', 'critical', 'javax namespace usage detected', 'Plan Jakarta migration before Spring Boot 3 execution.', 'application/src/main/java/org/thingsboard/server/Application.java', 12),
      finding('spring-boot-version-unknown', 'warning', 'Spring Boot version unknown', 'Declare Spring Boot version explicitly in Maven or Gradle metadata.'),
      ...repeatFindings(813, 'field-injection', 'warning', 'Spring field injection patterns', 'Prefer constructor injection in services touched by migration work.', 'application/src/main/java/org/thingsboard/server'),
      ...repeatFindings(92, 'java-util-date', 'info', 'Legacy date API usage', 'Review domain date handling.', 'common/data/src/main/java/org/thingsboard/server/common/data')
    ]
  }),
  benchmark({
    slug: 'keycloak',
    name: 'Keycloak',
    repository: 'https://github.com/keycloak/keycloak',
    pack: 'spring-boot-3-readiness',
    buildTool: 'Maven',
    javaVersion: '11',
    springBootVersion: 'unknown',
    fileCount: 12759,
    javaFileCount: 8068,
    jakartaDetected: true,
    javaxDetected: true,
    hibernateDetected: true,
    springSecurityDetected: false,
    findings: [
      finding('javax-usage', 'critical', 'javax namespace usage detected', 'Plan Jakarta migration before Spring Boot 3 execution.', 'services/src/main/java/org/keycloak/services/resources/KeycloakApplication.java', 12),
      finding('spring-boot-version-unknown', 'warning', 'Spring Boot version unknown', 'Declare Spring Boot version explicitly in Maven or Gradle metadata.'),
      ...repeatFindings(285, 'java-util-date', 'info', 'Legacy date API usage', 'Review domain date handling.', 'services/src/main/java/org/keycloak/services')
    ]
  }),
  benchmark({
    slug: 'apache-fineract',
    name: 'Apache Fineract',
    repository: 'https://github.com/apache/fineract',
    pack: 'spring-boot-3-readiness',
    buildTool: 'Gradle',
    javaVersion: '1',
    springBootVersion: '3.5.15',
    fileCount: 7723,
    javaFileCount: 6468,
    jakartaDetected: true,
    javaxDetected: true,
    hibernateDetected: true,
    springSecurityDetected: true,
    findings: [
      finding('javax-usage', 'critical', 'javax namespace usage detected', 'Plan Jakarta migration before Spring Boot 3 execution.', 'fineract-provider/src/main/java/org/apache/fineract/ServerApplication.java', 12),
      ...repeatFindings(583, 'field-injection', 'warning', 'Spring field injection patterns', 'Prefer constructor injection in services touched by migration work.', 'fineract-provider/src/main/java/org/apache/fineract'),
      ...repeatFindings(65, 'java-util-date', 'info', 'Legacy date API usage', 'Review domain date handling.', 'fineract-core/src/main/java/org/apache/fineract')
    ]
  }),
  benchmark({
    slug: 'broadleaf-commerce',
    name: 'Broadleaf Commerce',
    repository: 'https://github.com/BroadleafCommerce/BroadleafCommerce',
    pack: 'spring-boot-3-readiness',
    buildTool: 'Maven',
    javaVersion: 'unknown',
    springBootVersion: 'unknown',
    fileCount: 3865,
    javaFileCount: 2985,
    jakartaDetected: true,
    javaxDetected: true,
    hibernateDetected: true,
    springSecurityDetected: true,
    findings: [
      finding('javax-usage', 'critical', 'javax namespace usage detected', 'Plan Jakarta migration before Spring Boot 3 execution.', 'core/broadleaf-framework/src/main/java/org/broadleafcommerce/core/catalog/domain/ProductImpl.java', 12),
      finding('spring-boot-version-unknown', 'warning', 'Spring Boot version unknown', 'Declare Spring Boot version explicitly in Maven or Gradle metadata.'),
      ...repeatFindings(103, 'field-injection', 'warning', 'Spring field injection patterns', 'Prefer constructor injection in services touched by migration work.', 'core/broadleaf-framework/src/main/java/org/broadleafcommerce'),
      ...repeatFindings(162, 'java-util-date', 'info', 'Legacy date API usage', 'Review domain date handling.', 'core/broadleaf-framework/src/main/java/org/broadleafcommerce')
    ]
  }),
  benchmark({
    slug: 'spring-cloud-dataflow',
    name: 'Spring Cloud Data Flow',
    repository: 'https://github.com/spring-cloud/spring-cloud-dataflow',
    pack: 'spring-boot-3-readiness',
    buildTool: 'Maven',
    javaVersion: '17',
    springBootVersion: 'unknown',
    fileCount: 2740,
    javaFileCount: 1529,
    jakartaDetected: true,
    javaxDetected: true,
    hibernateDetected: true,
    springSecurityDetected: true,
    findings: [
      finding('javax-usage', 'critical', 'javax namespace usage detected', 'Plan Jakarta migration before Spring Boot 3 execution.', 'spring-cloud-dataflow-server/src/main/java/org/springframework/cloud/dataflow/server/SingleNodeApplication.java', 12),
      finding('spring-boot-version-unknown', 'warning', 'Spring Boot version unknown', 'Declare Spring Boot version explicitly in Maven or Gradle metadata.'),
      ...repeatFindings(300, 'field-injection', 'warning', 'Spring field injection patterns', 'Prefer constructor injection in services touched by migration work.', 'spring-cloud-dataflow-server/src/main/java/org/springframework/cloud/dataflow'),
      ...repeatFindings(54, 'java-util-date', 'info', 'Legacy date API usage', 'Review domain date handling.', 'spring-cloud-dataflow-core/src/main/java/org/springframework/cloud/dataflow')
    ]
  }),
  benchmark({
    slug: 'openmrs-core',
    name: 'OpenMRS Core',
    repository: 'https://github.com/openmrs/openmrs-core',
    pack: 'spring-boot-3-readiness',
    buildTool: 'Maven',
    javaVersion: '21',
    springBootVersion: 'unknown',
    fileCount: 1818,
    javaFileCount: 1282,
    jakartaDetected: true,
    javaxDetected: true,
    hibernateDetected: true,
    springSecurityDetected: false,
    findings: [
      finding('javax-usage', 'critical', 'javax namespace usage detected', 'Plan Jakarta migration before Spring Boot 3 execution.', 'api/src/main/java/org/openmrs/BaseOpenmrsObject.java', 12),
      finding('spring-boot-version-unknown', 'warning', 'Spring Boot version unknown', 'Declare Spring Boot version explicitly in Maven or Gradle metadata.'),
      ...repeatFindings(154, 'field-injection', 'warning', 'Spring field injection patterns', 'Prefer constructor injection in services touched by migration work.', 'api/src/main/java/org/openmrs'),
      ...repeatFindings(621, 'java-util-date', 'info', 'Legacy date API usage', 'Review domain date handling.', 'api/src/main/java/org/openmrs')
    ]
  }),
  benchmark({
    slug: 'kill-bill',
    name: 'Kill Bill',
    repository: 'https://github.com/killbill/killbill',
    pack: 'spring-boot-3-readiness',
    buildTool: 'Maven',
    javaVersion: 'unknown',
    springBootVersion: 'unknown',
    fileCount: 2065,
    javaFileCount: 1693,
    jakartaDetected: true,
    javaxDetected: true,
    hibernateDetected: false,
    springSecurityDetected: false,
    findings: [
      finding('javax-usage', 'critical', 'javax namespace usage detected', 'Plan Jakarta migration before Spring Boot 3 execution.', 'server/src/main/java/org/killbill/billing/server/listeners/KillbillGuiceListener.java', 12),
      finding('spring-boot-version-unknown', 'warning', 'Spring Boot version unknown', 'Declare Spring Boot version explicitly in Maven or Gradle metadata.'),
      ...repeatFindings(61, 'java-util-date', 'info', 'Legacy date API usage', 'Review domain date handling.', 'util/src/main/java/org/killbill/billing/util')
    ]
  }),
  benchmark({
    slug: 'spring-boot-admin',
    name: 'Spring Boot Admin',
    repository: 'https://github.com/codecentric/spring-boot-admin',
    pack: 'spring-boot-3-readiness',
    buildTool: 'Maven',
    javaVersion: '17',
    springBootVersion: '2.7.18',
    fileCount: 1650,
    javaFileCount: 910,
    jakartaDetected: false,
    javaxDetected: true,
    hibernateDetected: true,
    springSecurityDetected: true,
    findings: [
      finding('javax-usage', 'critical', 'javax namespace usage detected', 'Plan Jakarta migration before Spring Boot 3 execution.', 'spring-boot-admin-server/src/main/java/de/codecentric/boot/admin/server/config/AdminServerProperties.java', 12),
      finding('spring-boot-2', 'warning', 'Spring Boot 2.7.18 detected', 'Run OpenRewrite Boot 3 recipes in dry-run mode.'),
      ...repeatFindings(32, 'field-injection', 'warning', 'Spring field injection patterns', 'Prefer constructor injection in services touched by migration work.', 'spring-boot-admin-server/src/main/java/de/codecentric/boot/admin/server')
    ]
  }),
  benchmark({
    slug: 'spring-batch',
    name: 'Spring Batch',
    repository: 'https://github.com/spring-projects/spring-batch',
    pack: 'spring-boot-3-readiness',
    buildTool: 'Maven',
    javaVersion: '17',
    springBootVersion: '2.7.x',
    jakartaDetected: true,
    javaxDetected: true,
    hibernateDetected: true,
    springSecurityDetected: false,
    fileCount: 4200,
    javaFileCount: 2700,
    findings: [
      finding('javax-usage', 'critical', 'javax namespace usage detected', 'Plan Jakarta migration before Spring Boot 3 execution.', 'spring-batch-core/src/main/java/org/springframework/batch/core/repository/dao/JdbcJobExecutionDao.java', 18),
      finding('spring-boot-2', 'warning', 'Spring Boot 2.7.x detected', 'Run OpenRewrite Boot 3 recipes in dry-run mode.'),
      ...repeatFindings(48, 'java-util-date', 'info', 'Legacy date API usage', 'Review domain date handling.', 'spring-batch-core/src/main/java/org/springframework/batch/core')
    ]
  }),
  benchmark({
    slug: 'spring-security-samples',
    name: 'Spring Security Samples',
    repository: 'https://github.com/spring-projects/spring-security-samples',
    pack: 'spring-boot-3-readiness',
    buildTool: 'Gradle',
    javaVersion: '17',
    springBootVersion: '2.7.x',
    fileCount: 920,
    javaFileCount: 510,
    jakartaDetected: false,
    javaxDetected: true,
    hibernateDetected: false,
    springSecurityDetected: true,
    findings: [
      finding('javax-usage', 'critical', 'javax namespace usage detected', 'Plan Jakarta migration before Spring Boot 3 execution.', 'servlet/java-configuration/authentication/username-password/form/src/main/java/example/SecurityConfiguration.java', 10),
      finding('spring-boot-2', 'warning', 'Spring Boot 2.7.x detected', 'Run OpenRewrite Boot 3 recipes in dry-run mode.'),
      ...repeatFindings(26, 'field-injection', 'warning', 'Spring field injection patterns', 'Prefer constructor injection in services touched by migration work.', 'servlet/spring-boot/java/src/main/java/example')
    ]
  }),
  benchmark({
    slug: 'spring-cloud-gateway',
    name: 'Spring Cloud Gateway',
    repository: 'https://github.com/spring-cloud/spring-cloud-gateway',
    pack: 'spring-boot-3-readiness',
    buildTool: 'Maven',
    javaVersion: '17',
    springBootVersion: '2.7.x',
    fileCount: 2100,
    javaFileCount: 1200,
    jakartaDetected: true,
    javaxDetected: true,
    hibernateDetected: false,
    springSecurityDetected: true,
    findings: [
      finding('javax-usage', 'critical', 'javax namespace usage detected', 'Plan Jakarta migration before Spring Boot 3 execution.', 'spring-cloud-gateway-server/src/main/java/org/springframework/cloud/gateway/filter/WebsocketRoutingFilter.java', 15),
      finding('spring-boot-2', 'warning', 'Spring Boot 2.7.x detected', 'Run OpenRewrite Boot 3 recipes in dry-run mode.'),
      ...repeatFindings(71, 'java-util-date', 'info', 'Legacy date API usage', 'Review date handling before migration validation.', 'spring-cloud-gateway-server/src/main/java/org/springframework/cloud/gateway')
    ]
  }),
  benchmark({
    slug: 'spring-cloud-config',
    name: 'Spring Cloud Config',
    repository: 'https://github.com/spring-cloud/spring-cloud-config',
    pack: 'spring-boot-3-readiness',
    buildTool: 'Maven',
    javaVersion: '17',
    springBootVersion: '2.7.x',
    fileCount: 1850,
    javaFileCount: 1040,
    jakartaDetected: true,
    javaxDetected: true,
    hibernateDetected: false,
    springSecurityDetected: true,
    findings: [
      finding('javax-usage', 'critical', 'javax namespace usage detected', 'Plan Jakarta migration before Spring Boot 3 execution.', 'spring-cloud-config-server/src/main/java/org/springframework/cloud/config/server/config/ConfigServerConfiguration.java', 22),
      finding('spring-boot-2', 'warning', 'Spring Boot 2.7.x detected', 'Run OpenRewrite Boot 3 recipes in dry-run mode.'),
      ...repeatFindings(39, 'field-injection', 'warning', 'Spring field injection patterns', 'Prefer constructor injection in services touched by migration work.', 'spring-cloud-config-server/src/main/java/org/springframework/cloud/config/server')
    ]
  }),
  benchmark({
    slug: 'spring-integration',
    name: 'Spring Integration',
    repository: 'https://github.com/spring-projects/spring-integration',
    pack: 'spring-boot-3-readiness',
    buildTool: 'Gradle',
    javaVersion: '17',
    springBootVersion: '2.7.x',
    fileCount: 6900,
    javaFileCount: 3900,
    jakartaDetected: true,
    javaxDetected: true,
    hibernateDetected: false,
    springSecurityDetected: false,
    findings: [
      finding('javax-usage', 'critical', 'javax namespace usage detected', 'Plan Jakarta migration before Spring Boot 3 execution.', 'spring-integration-core/src/main/java/org/springframework/integration/config/IntegrationRegistrar.java', 19),
      finding('spring-boot-2', 'warning', 'Spring Boot 2.7.x detected', 'Run OpenRewrite Boot 3 recipes in dry-run mode.'),
      ...repeatFindings(118, 'java-util-date', 'info', 'Legacy date API usage', 'Review date handling before migration validation.', 'spring-integration-core/src/main/java/org/springframework/integration')
    ]
  }),
  benchmark({
    slug: 'spring-session',
    name: 'Spring Session',
    repository: 'https://github.com/spring-projects/spring-session',
    pack: 'spring-boot-3-readiness',
    buildTool: 'Gradle',
    javaVersion: '17',
    springBootVersion: '2.7.x',
    fileCount: 1700,
    javaFileCount: 990,
    jakartaDetected: true,
    javaxDetected: true,
    hibernateDetected: false,
    springSecurityDetected: true,
    findings: [
      finding('javax-usage', 'critical', 'javax namespace usage detected', 'Plan Jakarta migration before Spring Boot 3 execution.', 'spring-session-core/src/main/java/org/springframework/session/web/http/SessionRepositoryFilter.java', 18),
      finding('spring-boot-2', 'warning', 'Spring Boot 2.7.x detected', 'Run OpenRewrite Boot 3 recipes in dry-run mode.'),
      ...repeatFindings(31, 'field-injection', 'warning', 'Spring field injection patterns', 'Prefer constructor injection in services touched by migration work.', 'spring-session-samples/src/main/java/sample')
    ]
  }),
  benchmark({
    slug: 'spring-amqp',
    name: 'Spring AMQP',
    repository: 'https://github.com/spring-projects/spring-amqp',
    pack: 'spring-boot-3-readiness',
    buildTool: 'Gradle',
    javaVersion: '17',
    springBootVersion: '2.7.x',
    fileCount: 2500,
    javaFileCount: 1500,
    jakartaDetected: true,
    javaxDetected: true,
    hibernateDetected: false,
    springSecurityDetected: false,
    findings: [
      finding('javax-usage', 'critical', 'javax namespace usage detected', 'Plan Jakarta migration before Spring Boot 3 execution.', 'spring-rabbit/src/main/java/org/springframework/amqp/rabbit/config/AbstractRabbitListenerContainerFactory.java', 14),
      finding('spring-boot-2', 'warning', 'Spring Boot 2.7.x detected', 'Run OpenRewrite Boot 3 recipes in dry-run mode.'),
      ...repeatFindings(44, 'java-util-date', 'info', 'Legacy date API usage', 'Review date handling before migration validation.', 'spring-rabbit/src/main/java/org/springframework/amqp/rabbit')
    ]
  }),
  benchmark({
    slug: 'spring-data-examples',
    name: 'Spring Data Examples',
    repository: 'https://github.com/spring-projects/spring-data-examples',
    pack: 'spring-boot-3-readiness',
    buildTool: 'Maven',
    javaVersion: '17',
    springBootVersion: '2.7.x',
    fileCount: 1450,
    javaFileCount: 820,
    jakartaDetected: true,
    javaxDetected: true,
    hibernateDetected: true,
    springSecurityDetected: false,
    findings: [
      finding('javax-usage', 'critical', 'javax namespace usage detected', 'Plan Jakarta migration before Spring Boot 3 execution.', 'jpa/example/src/main/java/example/springdata/jpa/simple/SimpleUserRepository.java', 12),
      finding('spring-boot-2', 'warning', 'Spring Boot 2.7.x detected', 'Run OpenRewrite Boot 3 recipes in dry-run mode.'),
      ...repeatFindings(73, 'java-util-date', 'info', 'Legacy date API usage', 'Review date handling before migration validation.', 'jpa/example/src/main/java/example/springdata/jpa')
    ]
  }),
  benchmark({
    slug: 'baeldung-tutorials',
    name: 'Baeldung Tutorials',
    repository: 'https://github.com/eugenp/tutorials',
    pack: 'spring-boot-3-readiness',
    buildTool: 'Maven',
    javaVersion: '17',
    springBootVersion: '2.7.x',
    fileCount: 22000,
    javaFileCount: 14800,
    jakartaDetected: true,
    javaxDetected: true,
    hibernateDetected: true,
    springSecurityDetected: true,
    findings: [
      finding('javax-usage', 'critical', 'javax namespace usage detected', 'Plan Jakarta migration before Spring Boot 3 execution.', 'spring-boot-modules/spring-boot-data/src/main/java/com/baeldung/spring/data/persistence/model/User.java', 9),
      finding('spring-boot-2', 'warning', 'Spring Boot 2.7.x detected', 'Run OpenRewrite Boot 3 recipes in dry-run mode.'),
      ...repeatFindings(420, 'field-injection', 'warning', 'Spring field injection patterns', 'Prefer constructor injection in services touched by migration work.', 'spring-boot-modules/spring-boot-data/src/main/java/com/baeldung'),
      ...repeatFindings(380, 'java-util-date', 'info', 'Legacy date API usage', 'Review date handling before migration validation.', 'persistence-modules/java-jpa/src/main/java/com/baeldung')
    ]
  }),
  benchmark({
    slug: 'keycloak-jakarta-readiness',
    name: 'Keycloak Jakarta Readiness',
    repository: 'https://github.com/keycloak/keycloak',
    pack: 'jakarta-readiness',
    buildTool: 'Maven',
    javaVersion: '17',
    springBootVersion: 'unknown',
    fileCount: 12759,
    javaFileCount: 8068,
    jakartaDetected: true,
    javaxDetected: true,
    hibernateDetected: true,
    springSecurityDetected: false,
    findings: [
      ...repeatFindings(42, 'javax-usage', 'critical', 'javax namespace usage detected', 'Inventory Java EE APIs before Jakarta conversion.', 'services'),
      ...repeatFindings(126, 'java-util-date', 'info', 'java.util.Date usage', 'Review persistence and token date handling before namespace migration.', 'model-jpa'),
      ...repeatFindings(22, 'system-out', 'info', 'System.out logging', 'Route production output through logging.', 'services'),
      ...repeatFindings(131, 'system-out', 'info', 'System.out logging', 'Keep test console output separate from production modernization risk.', 'testsuite/integration-arquillian/tests/base/src/test/java')
    ]
  })
];

const DEFAULT_VALIDATION_TIMEOUT_MS = 120000;

export async function publishBenchmarks({ outDir, source = 'catalog', only = null, limit = null, reposDir = 'benchmark-repos', validate = false, validationTimeoutMs = DEFAULT_VALIDATION_TIMEOUT_MS }) {
  if (!['catalog', 'local', 'clone'].includes(source)) {
    throw new Error(`Invalid benchmark source: ${source}`);
  }
  const reports = [];
  const selected = selectBenchmarks({ only, limit });
  for (const item of selected) {
    const localRoot = path.resolve(reposDir, item.slug);
    const hasLocalCheckout = await isDirectory(localRoot);
    const benchmarkEvidence = {
      slug: item.slug,
      name: item.name,
      repository: item.repository,
      requestedSource: source,
      source: 'catalog',
      checkoutPath: null,
      gitRevision: null,
      commands: [],
      validation: {
        requested: Boolean(validate),
        status: validate ? 'skipped' : 'not_requested',
        confidence: 0,
        checks: [],
        summary: validate ? 'Validation requires a local checkout.' : 'Validation was not requested.'
      }
    };
    if (source === 'clone' && !hasLocalCheckout) {
      const clone = await cloneBenchmark(item, localRoot);
      benchmarkEvidence.commands.push(clone);
    }
    const hasCheckoutAfterClone = await isDirectory(localRoot);
    if (source === 'clone' && !hasCheckoutAfterClone) {
      throw new Error(`Clone mode could not create checkout for ${item.slug}`);
    }
    const useLocalCheckout = source === 'clone' ? hasCheckoutAfterClone : source === 'local' && hasLocalCheckout;
    if (useLocalCheckout) {
      benchmarkEvidence.source = 'checkout';
      benchmarkEvidence.checkoutPath = path.relative(process.cwd(), localRoot);
      benchmarkEvidence.gitRevision = await getGitRevision(localRoot);
      if (source === 'clone' && hasLocalCheckout) {
        benchmarkEvidence.commands.push({
          command: `reuse checkout ${benchmarkEvidence.checkoutPath}`,
          exitCode: 0,
          status: 'passed',
          output: 'Existing checkout reused.'
        });
      }
    }
    const scan = await analyzeProject({
      root: useLocalCheckout ? localRoot : item.repository,
      pack: item.pack,
      benchmarkMetadata: useLocalCheckout ? null : item
    });
    scan.project.name = item.name;
    scan.project.root = useLocalCheckout ? benchmarkEvidence.checkoutPath : item.repository;
    scan.project.source = item.repository;
    if (validate && useLocalCheckout) {
      benchmarkEvidence.validation = await validateBenchmarkCheckout({ root: localRoot, timeoutMs: Number(validationTimeoutMs) || DEFAULT_VALIDATION_TIMEOUT_MS });
    }
    scan.benchmark = benchmarkEvidence;
    const readiness = scoreReadiness(scan);
    const reportDir = path.join(outDir, item.slug);
    const bundle = await writeReportBundle({ outDir: reportDir, scan, readiness });
    reports.push({
      ...item,
      readiness: readiness.overall,
      reportPath: path.relative(outDir, bundle.htmlPath),
      source: benchmarkEvidence.source,
      validation: benchmarkEvidence.validation,
      localRoot: useLocalCheckout ? localRoot : null
    });
  }
  await generateBenchmarkIndex({ outDir, reports });
  return { count: reports.length, reports, source };
}

async function isDirectory(directory) {
  const stat = await fs.stat(directory).catch(() => null);
  return Boolean(stat?.isDirectory());
}

function selectBenchmarks({ only, limit }) {
  const names = only ? new Set(String(only).split(',').map((name) => name.trim()).filter(Boolean)) : null;
  const selected = BENCHMARKS.filter((item) => !names || names.has(item.slug));
  if (names && selected.length !== names.size) {
    const found = new Set(selected.map((item) => item.slug));
    const missing = [...names].filter((name) => !found.has(name));
    throw new Error(`Unknown benchmark slug(s): ${missing.join(', ')}`);
  }
  const max = limit ? Number(limit) : selected.length;
  if (!Number.isInteger(max) || max < 1) throw new Error(`Invalid benchmark limit: ${limit}`);
  return selected.slice(0, max);
}

async function cloneBenchmark(item, localRoot) {
  await fs.mkdir(path.dirname(localRoot), { recursive: true });
  const args = ['git', 'clone', '--depth', '1', item.repository, localRoot];
  const result = await runCommand(args);
  if (result.exitCode !== 0) {
    throw new Error(`Failed to clone ${item.slug}: ${result.output.trim()}`);
  }
  return {
    command: ['git', 'clone', '--depth', '1', item.repository, path.relative(process.cwd(), localRoot)].join(' '),
    exitCode: result.exitCode,
    status: 'passed',
    output: result.output.trim()
  };
}

async function getGitRevision(root) {
  const result = await runCommand(['git', 'rev-parse', 'HEAD'], { cwd: root });
  return result.exitCode === 0 ? result.output.trim() : null;
}

async function validateBenchmarkCheckout({ root, timeoutMs }) {
  const plan = await validationPlan(root);
  if (!plan.length) {
    return {
      requested: true,
      status: 'skipped',
      confidence: 15,
      checks: [
        {
          name: 'Build tool detection',
          status: 'skipped',
          command: null,
          durationMs: 0,
          exitCode: null,
          output: 'No Maven or Gradle build file was detected at the checkout root.'
        }
      ],
      summary: 'Validation skipped because no supported root build file was detected.'
    };
  }

  const checks = [];
  for (const step of plan) {
    const result = await runCommand(step.args, { cwd: root, timeoutMs });
    checks.push({
      name: step.name,
      status: statusFromExitCode(result.exitCode, result.timedOut),
      command: step.args.join(' '),
      durationMs: result.durationMs,
      exitCode: result.exitCode,
      output: validationOutput(result, timeoutMs),
      timedOut: result.timedOut
    });
  }
  const status = validationStatus(checks);
  return {
    requested: true,
    status,
    confidence: validationConfidence(checks),
    checks,
    summary: validationSummary(status, checks)
  };
}

async function validationPlan(root) {
  if (await isFile(path.join(root, 'mvnw'))) {
    return [
      { name: 'Compilation', args: ['./mvnw', '-q', '-DskipTests', 'compile'] },
      { name: 'Tests', args: ['./mvnw', '-q', 'test'] }
    ];
  }
  if (await isFile(path.join(root, 'pom.xml'))) {
    return [
      { name: 'Compilation', args: ['mvn', '-q', '-DskipTests', 'compile'] },
      { name: 'Tests', args: ['mvn', '-q', 'test'] }
    ];
  }
  if (await isFile(path.join(root, 'gradlew'))) {
    return [
      { name: 'Compilation', args: ['./gradlew', 'compileJava', '--no-daemon'] },
      { name: 'Tests', args: ['./gradlew', 'test', '--no-daemon'] }
    ];
  }
  if (await isFile(path.join(root, 'build.gradle')) || await isFile(path.join(root, 'build.gradle.kts'))) {
    return [
      { name: 'Compilation', args: ['gradle', 'compileJava', '--no-daemon'] },
      { name: 'Tests', args: ['gradle', 'test', '--no-daemon'] }
    ];
  }
  return [];
}

async function isFile(file) {
  const stat = await fs.stat(file).catch(() => null);
  return Boolean(stat?.isFile());
}

function validationStatus(checks) {
  if (!checks.length) return 'skipped';
  if (checks.some((check) => check.status === 'failed')) return 'failed';
  if (checks.some((check) => check.status === 'skipped')) return 'skipped';
  return 'passed';
}

function validationConfidence(checks) {
  if (!checks.length) return 15;
  const passed = checks.filter((check) => check.status === 'passed').length;
  const failed = checks.filter((check) => check.status === 'failed').length;
  if (failed) return Math.max(25, Math.round((passed / checks.length) * 70));
  return Math.min(98, 55 + passed * 20);
}

function validationSummary(status, checks) {
  if (status === 'passed') return 'Compilation and tests completed successfully.';
  if (status === 'failed') return `${checks.filter((check) => check.status === 'failed').length} validation check(s) failed.`;
  return 'Validation was skipped or incomplete.';
}

function statusFromExitCode(exitCode, timedOut) {
  if (timedOut) return 'failed';
  return exitCode === 0 ? 'passed' : 'failed';
}

function trimCommandOutput(output) {
  const value = sanitizeCommandOutput(String(output || '')).trim();
  if (!value) return '';
  return value.length > 1200 ? `${value.slice(-1200)}` : value;
}

function validationOutput(result, timeoutMs) {
  const output = trimCommandOutput(result.output);
  if (result.timedOut && output) return `${output}\nCommand timed out after ${timeoutMs} ms.`;
  if (result.timedOut) return `Command timed out after ${timeoutMs} ms.`;
  return output;
}

function sanitizeCommandOutput(output) {
  const home = process.env.HOME || null;
  return (home ? output.replaceAll(home, '~') : output)
    .replace(/\/Users\/[^/\s:)]+/g, '~')
    .replace(/\/private\/var\/folders\/[^\s:)]+/g, '<tmp>');
}

function runCommand(args, options = {}) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(args[0], args.slice(1), { cwd: options.cwd, detached: Boolean(options.timeoutMs) });
    let output = '';
    let timedOut = false;
    const timeout = options.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          killProcessTree(child);
        }, options.timeoutMs)
      : null;
    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk) => { output += chunk.toString(); });
    child.on('error', (error) => {
      if (timeout) clearTimeout(timeout);
      resolve({ exitCode: 127, output: error.message, durationMs: Date.now() - startedAt, timedOut });
    });
    child.on('close', (exitCode) => {
      if (timeout) clearTimeout(timeout);
      resolve({ exitCode, output, durationMs: Date.now() - startedAt, timedOut });
    });
  });
}

function killProcessTree(child) {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
}

function benchmark({ slug, name, repository, pack, buildTool, javaVersion, springBootVersion, fileCount, javaFileCount, jakartaDetected, javaxDetected, hibernateDetected, springSecurityDetected, findings }) {
  return {
    slug,
    name,
    repository,
    pack,
    buildTools: [buildTool],
    javaVersion,
    springBootVersion,
    fileCount,
    javaFileCount,
    jakartaDetected,
    javaxDetected,
    hibernateDetected,
    springSecurityDetected,
    findings
  };
}

function finding(code, severity, title, recommendation, file = null, line = null) {
  return { code, severity, title, recommendation, file, line };
}

function repeatFindings(count, code, severity, title, recommendation, basePath) {
  return Array.from({ length: count }, (_, index) => {
    const file = basePath.includes('/src/test/') || basePath.includes('testsuite/')
      ? `${basePath}/Example${index + 1}Test.java`
      : `${basePath}/Example${index + 1}.java`;
    return finding(code, severity, title, recommendation, file, 10 + index);
  });
}
