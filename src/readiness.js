const WEIGHTS = {
  critical: 16,
  warning: 7,
  info: 2
};

export function scoreReadiness(scan, ruleEvaluation = null) {
  if (scan.packApplicability?.applicable === false) {
    return {
      overall: null,
      categories: {},
      summary: `Pack mismatch: ${scan.packApplicability.reason}`,
      status: 'not_applicable',
      counts: countBySeverity(scan.findings)
    };
  }

  const scoringFindings = scan.findings.filter((finding) => finding.scope !== 'test');
  const categories = {
    java: categoryScore(scoringFindings, ['java-util-date', 'java-21-target-missing', 'java-internal-api'], 88),
    spring: categoryScore(scoringFindings, ['spring-boot-2', 'spring-boot-version-unknown', 'field-injection'], 86),
    jakarta: categoryScore(scoringFindings, ['javax-usage'], 95),
    build: categoryScore(scoringFindings, ['build-tool-missing'], 90),
    security: scan.dependencies.springSecurityDetected ? 82 : 76,
    architecture: categoryScore(scoringFindings, ['field-injection', 'system-out', 'reflection-usage', 'serializable-missing-serial-version'], 84)
  };
  if (ruleEvaluation?.loaded) categories.enterpriseRules = ruleCategoryScore(ruleEvaluation);

  const overall = Math.round(Object.values(categories).reduce((sum, score) => sum + score, 0) / Object.keys(categories).length);
  return {
    overall,
    categories,
    summary: summarize(overall),
    counts: countBySeverity(scan.findings)
  };
}

function categoryScore(findings, codes, base) {
  const grouped = findings
    .filter((finding) => codes.includes(finding.code))
    .reduce((groups, finding) => {
      const current = groups[finding.code] || { severity: finding.severity, count: 0 };
      current.count += 1;
      groups[finding.code] = current;
      return groups;
    }, {});
  const penalty = Object.values(grouped)
    .reduce((sum, item) => sum + occurrencePenalty(item), 0);
  return Math.max(0, Math.min(100, base - penalty));
}

function occurrencePenalty({ severity, count }) {
  const weight = WEIGHTS[severity] || 1;
  return Math.round(weight * (1 + Math.log2(Math.max(1, count))));
}

function ruleCategoryScore(ruleEvaluation) {
  const penalty = ruleEvaluation.violations.reduce((sum, violation) => {
    if (violation.severity === 'critical') return sum + 20;
    if (violation.severity === 'warning') return sum + 8;
    return sum + 2;
  }, 0);
  return Math.max(0, 100 - penalty);
}

function summarize(overall) {
  if (overall >= 85) return 'Ready for controlled migration planning';
  if (overall >= 70) return 'Ready with remediation work';
  if (overall >= 50) return 'Migration risk requires focused cleanup';
  return 'Not ready for migration execution';
}

function countBySeverity(findings) {
  return findings.reduce((counts, finding) => {
    counts[finding.severity] = (counts[finding.severity] || 0) + 1;
    return counts;
  }, { critical: 0, warning: 0, info: 0 });
}
