export function buildTrustEvidence({ scan, transformation = null }) {
  const validation = transformation?.validation || [];
  const compile = validation.find((item) => /compile|classes/i.test(item.name));
  const tests = validation.find((item) => /test/i.test(item.name));
  const rollback = transformation?.rollback;
  const binaryRiskCount = scan.findings.filter((finding) => ['java-internal-api', 'serializable-missing-serial-version'].includes(finding.code)).length;
  const publicApiRiskCount = scan.findings.filter((finding) => finding.code === 'reflection-usage').length;
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

  const confidence = scoreConfidence(checks);
  return {
    schemaVersion: 'emp.trust.v1',
    tier: 'professional',
    confidence,
    summary: summarizeConfidence(confidence),
    checks
  };
}

function statusCheck(name, status, note) {
  return { name, status, note };
}

function scoreConfidence(checks) {
  const weights = { passed: 20, warning: 12, pending: 6, skipped: 4, failed: 0 };
  return checks.reduce((sum, check) => sum + (weights[check.status] ?? 0), 0);
}

function summarizeConfidence(confidence) {
  if (confidence >= 90) return 'High confidence evidence package';
  if (confidence >= 70) return 'Usable evidence with targeted follow-up';
  if (confidence >= 50) return 'Partial evidence package';
  return 'Evidence is not strong enough for Professional sign-off';
}
