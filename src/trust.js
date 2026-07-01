export function buildTrustEvidence({ scan, transformation = null }) {
  const validation = transformation?.validation || [];
  const compile = validation.find((item) => /compile|classes/i.test(item.name));
  const tests = validation.find((item) => /test/i.test(item.name));
  const rollback = transformation?.rollback;
  const binaryRiskCount = scan.findings.filter((finding) => ['java-internal-api', 'serializable-missing-serial-version'].includes(finding.code)).length;
  const publicApiRiskCount = scan.findings.filter((finding) => finding.code === 'reflection-usage').length;
  const validationPassed = validation.filter((item) => item.status === 'passed').length;
  const validationFailed = validation.filter((item) => item.status === 'failed').length;
  const checks = [
    statusCheck('Compile validation', compile?.status || 'pending', compile?.command || 'Run transform with --validate to capture compile evidence.'),
    statusCheck('Test validation', tests?.status || 'pending', tests?.command || 'Run transform with --validate to capture test evidence.'),
    statusCheck(
      'Rollback evidence',
      rollback?.status === 'created' || rollback?.status === 'rolled-back' ? 'passed' : 'pending',
      rollback?.id ? `Snapshot ${rollback.id}` : 'No rollback snapshot has been created for this report.'
    ),
    statusCheck(
      'Binary compatibility',
      binaryRiskCount ? 'warning' : 'passed',
      binaryRiskCount ? `${binaryRiskCount} binary compatibility risk(s) detected.` : 'No static binary compatibility risks detected.'
    ),
    statusCheck(
      'Public API compatibility',
      publicApiRiskCount ? 'warning' : 'passed',
      publicApiRiskCount ? `${publicApiRiskCount} public API compatibility risk(s) detected.` : 'No static public API compatibility risks detected.'
    )
  ];

  const factors = buildFactors({
    compile,
    tests,
    rollback,
    binaryRiskCount,
    publicApiRiskCount,
    benchmark: scan.benchmark,
    validationPassed,
    validationFailed,
    validationCount: validation.length
  });
  const confidence = scoreConfidence(factors);
  return {
    schemaVersion: 'emp.trust.v1',
    tier: 'professional',
    confidence,
    summary: summarizeConfidence(confidence, factors),
    checks,
    factors
  };
}

function statusCheck(name, status, note) {
  return { name, status, note };
}

function buildFactors({ compile, tests, rollback, binaryRiskCount, publicApiRiskCount, benchmark, validationPassed, validationFailed, validationCount }) {
  return [
    factor({
      id: 'compile-validation',
      name: 'Compile validation',
      status: compile?.status || 'missing',
      impact: compile?.status === 'passed' ? 22 : compile?.status === 'failed' ? -18 : -8,
      reason: compile
        ? `Compile evidence was captured with status ${compile.status}.`
        : 'Compile evidence is missing. Run transform with --validate to capture it.',
      evidence: compile?.command || null
    }),
    factor({
      id: 'test-validation',
      name: 'Test validation',
      status: tests?.status || 'missing',
      impact: tests?.status === 'passed' ? 22 : tests?.status === 'failed' ? -18 : -8,
      reason: tests
        ? `Test evidence was captured with status ${tests.status}.`
        : 'Test evidence is missing. Run transform with --validate to capture it.',
      evidence: tests?.command || null
    }),
    factor({
      id: 'rollback-evidence',
      name: 'Rollback evidence',
      status: rollback?.status === 'created' || rollback?.status === 'rolled-back' ? 'passed' : 'missing',
      impact: rollback?.status === 'created' || rollback?.status === 'rolled-back' ? 14 : -6,
      reason: rollback?.id
        ? `Rollback snapshot ${rollback.id} is available.`
        : 'Rollback evidence is missing for this report.',
      evidence: rollback?.id || null
    }),
    factor({
      id: 'binary-compatibility-risk',
      name: 'Binary compatibility risk',
      status: binaryRiskCount ? 'warning' : 'passed',
      impact: binaryRiskCount ? -Math.min(12, binaryRiskCount * 4) : 12,
      reason: binaryRiskCount
        ? `${binaryRiskCount} binary compatibility risk(s) were detected.`
        : 'No static binary compatibility risks were detected.',
      evidence: String(binaryRiskCount)
    }),
    factor({
      id: 'public-api-compatibility-risk',
      name: 'Public API compatibility risk',
      status: publicApiRiskCount ? 'warning' : 'passed',
      impact: publicApiRiskCount ? -Math.min(10, publicApiRiskCount * 3) : 10,
      reason: publicApiRiskCount
        ? `${publicApiRiskCount} public API compatibility risk(s) were detected.`
        : 'No static public API compatibility risks were detected.',
      evidence: String(publicApiRiskCount)
    }),
    factor({
      id: 'benchmark-source',
      name: 'Benchmark source',
      status: benchmark?.source === 'checkout' ? 'passed' : benchmark ? 'warning' : 'missing',
      impact: benchmark?.source === 'checkout' ? 10 : benchmark ? 2 : 0,
      reason: benchmark?.source === 'checkout'
        ? 'Report was generated from a real checkout.'
        : benchmark
        ? 'Report is catalog-backed. It proves report shape, not checkout validation.'
        : 'This report is not associated with benchmark source evidence.',
      evidence: benchmark?.source || null
    }),
    factor({
      id: 'validation-confidence',
      name: 'Validation confidence',
      status: validationFailed ? 'failed' : validationPassed ? 'passed' : 'missing',
      impact: validationFailed ? -12 : validationPassed ? Math.min(10, validationPassed * 5) : -4,
      reason: validationCount
        ? `${validationPassed}/${validationCount} validation check(s) passed.`
        : 'No validation checks were captured.',
      evidence: String(validationCount)
    })
  ];
}

function factor({ id, name, status, impact, reason, evidence = null }) {
  return { id, name, status, impact, reason, evidence };
}

function scoreConfidence(factors) {
  const baseline = 50;
  const score = baseline + factors.reduce((sum, item) => sum + item.impact, 0);
  return Math.max(0, Math.min(100, Math.round(score)));
}

function summarizeConfidence(confidence, factors) {
  const positive = factors.filter((item) => item.impact > 0).length;
  const negative = factors.filter((item) => item.impact < 0).length;
  if (confidence >= 90) return `High confidence evidence package with ${positive} positive factor(s) and ${negative} follow-up factor(s).`;
  if (confidence >= 70) return `Usable evidence with ${positive} positive factor(s) and ${negative} follow-up factor(s).`;
  if (confidence >= 50) return `Partial evidence package with ${negative} factor(s) requiring follow-up.`;
  return 'Evidence is not strong enough for Professional sign-off';
}
