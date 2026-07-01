import fs from 'node:fs/promises';
import path from 'node:path';
import { buildTrustEvidence } from './trust.js';

export async function writeReportBundle({ outDir, scan, readiness, transformation = null, rules = null }) {
  await fs.mkdir(outDir, { recursive: true });
  const report = {
    schemaVersion: 'emp.report.v1',
    generatedAt: scan.generatedAt,
    project: scan.project,
    pack: scan.pack,
    packApplicability: scan.packApplicability,
    readiness,
    productionFindings: scan.findings.filter((finding) => finding.scope !== 'test'),
    testFindings: scan.findings.filter((finding) => finding.scope === 'test'),
    findingSummary: summarizeFindings(scan.findings),
    findings: scan.findings,
    evidence: scan.evidence,
    dependencies: scan.dependencies
  };
  if (scan.benchmark) report.benchmark = scan.benchmark;
  if (transformation) report.transformation = transformation;
  if (transformation) report.trust = buildTrustEvidence({ scan, transformation });
  if (rules?.loaded) report.rules = rules;
  const jsonPath = path.join(outDir, 'report.json');
  const htmlPath = path.join(outDir, 'index.html');
  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await fs.writeFile(htmlPath, normalizeHtml(renderReport(report)));
  return { jsonPath, htmlPath, report };
}

export function renderReport(report) {
  const categories = Object.entries(report.readiness.categories)
    .map(([name, score]) => `<tr><td>${escapeHtml(label(name))}</td><td><strong>${score}%</strong></td><td><div class="bar"><span style="width:${score}%"></span></div></td></tr>`)
    .join('');
  const findingSummaryRows = renderFindingSummaryRows(report.findingSummary);
  const evidence = report.evidence
    .map((item) => `<tr><td>${escapeHtml(item.name)}</td><td><span class="pill ${item.status}">${item.status}</span></td><td>${escapeHtml(item.note || '')}</td></tr>`)
    .join('');
  const applicability = renderApplicability(report);
  const readiness = renderReadiness(report, categories);
  const transformation = renderTransformation(report.transformation);
  const trust = renderTrust(report.trust);
  const rules = renderRules(report.rules);
  const benchmarkEvidence = renderBenchmarkEvidence(report.benchmark);
  const decision = reportDecision(report);
  const primaryRisks = topFindingTypes(report.findingSummary).slice(0, 3);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(report.project.name)} Readiness Report</title>
  <style>
    :root { color-scheme: light; --ink:#15202b; --muted:#5f6b7a; --line:#d9e1ea; --bg:#f6f8fa; --panel:#fff; --accent:#1769aa; --accent-dark:#0f4f84; --ok:#217a45; --warn:#966600; --bad:#b42318; }
    * { box-sizing: border-box; }
    body { margin:0; font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color:var(--ink); background:var(--bg); }
    header { background:#102a43; color:#fff; padding:28px max(24px, calc((100vw - 1120px)/2)); }
    main { max-width:1120px; margin:0 auto; padding:24px; }
    h1,h2 { margin:0 0 12px; letter-spacing:0; }
    h1 { font-size:32px; }
    h2 { font-size:20px; margin-top:28px; }
    .meta { color:#d9e6f2; margin:0; }
    .report-nav { display:flex; flex-wrap:wrap; gap:10px 14px; margin:16px 0 0; }
    .report-nav a { color:#d9e6f2; font-size:14px; }
    .grid { display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:12px; }
    .panel { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:16px; }
    .metric { font-size:34px; font-weight:760; }
    .label { color:var(--muted); font-size:13px; }
    .decision { display:grid; grid-template-columns:minmax(0, 1fr) 300px; gap:14px; margin:0 0 18px; }
    .decision-main { border-left:4px solid var(--accent); }
    .decision-main.good { border-left-color:var(--ok); }
    .decision-main.warn { border-left-color:var(--warn); }
    .decision-main.bad { border-left-color:var(--bad); }
    .decision-main strong { display:block; margin-bottom:6px; font-size:18px; }
    .decision-list { display:flex; flex-direction:column; gap:8px; }
    .risk-list { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:12px; }
    .actions a { display:inline-flex; align-items:center; min-height:38px; padding:8px 12px; background:var(--panel); border:1px solid var(--line); border-radius:6px; color:var(--accent); }
    .actions a.primary { background:var(--accent); color:#fff; border-color:var(--accent-dark); font-weight:700; }
    .notice { border-left:4px solid var(--accent); }
    .notice.bad { border-left-color:var(--bad); }
    .table-scroll { width:100%; overflow-x:auto; border-radius:8px; }
    table { width:100%; border-collapse:collapse; background:var(--panel); border:1px solid var(--line); border-radius:8px; overflow:hidden; }
    th,td { text-align:left; padding:10px 12px; border-bottom:1px solid var(--line); vertical-align:top; }
    th { font-size:12px; color:var(--muted); text-transform:uppercase; }
    td { overflow-wrap:anywhere; }
    tr:last-child td { border-bottom:0; }
    .bar { height:9px; background:#edf2f7; border-radius:999px; overflow:hidden; }
    .bar span { display:block; height:100%; background:var(--accent); }
    .pill { display:inline-block; min-width:64px; padding:2px 8px; border-radius:999px; font-size:12px; font-weight:650; text-align:center; background:#eef2f7; color:#344054; }
    .critical,.failed { background:#ffe4e0; color:var(--bad); }
    .warning,.pending { background:#fff3c4; color:var(--warn); }
    .skipped { background:#eef2f7; color:#344054; }
    .info { background:#e7f0ff; color:#175cd3; }
    .passed { background:#dff7e8; color:var(--ok); }
    @media (max-width: 900px) { .decision { grid-template-columns:1fr; } }
    @media (max-width: 760px) { header { padding:24px 16px; } main { padding:20px 16px; } .grid { grid-template-columns:1fr 1fr; } h1 { font-size:25px; } table { min-width:720px; font-size:13px; } }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(report.project.name)} Readiness Report</h1>
    <p class="meta">${escapeHtml(report.pack)} · ${escapeHtml(report.generatedAt)} · ${escapeHtml(report.project.source)}</p>
    <nav class="report-nav">
      <a href="../../index.html">Home</a>
      <a href="../index.html">Benchmarks</a>
      <a href="../../migration-hub/spring-boot-2-to-3.html">Migration Hub</a>
      <a href="report.json">JSON</a>
    </nav>
  </header>
  <main>
    <section class="decision">
      <div class="panel decision-main ${escapeHtml(decision.tone)}">
        <strong>${escapeHtml(decision.title)}</strong>
        <div>${escapeHtml(decision.summary)}</div>
        <div class="risk-list">${primaryRisks.map((risk) => `<span class="pill ${escapeHtml(risk.severity)}">${escapeHtml(risk.total)} ${escapeHtml(risk.title)}</span>`).join('') || '<span class="pill passed">No findings</span>'}</div>
        <div class="actions">
          <a class="primary" href="report.json">Open JSON evidence</a>
          <a href="../../migration-hub/spring-boot-2-to-3.html">Read migration guide</a>
        </div>
      </div>
      <div class="panel decision-list">
        <div><strong>Recommended next step</strong><div class="label">${escapeHtml(decision.nextStep)}</div></div>
        <div><strong>Validation state</strong><div class="label">${escapeHtml(validationSummary(report))}</div></div>
        <div><strong>Evidence package</strong><div class="label">Static HTML and JSON report, shareable without a backend.</div></div>
      </div>
    </section>

    <section class="grid">
      <div class="panel"><div class="metric">${formatScore(report.readiness.overall)}</div><div class="label">Overall readiness</div></div>
      <div class="panel"><div class="metric">${report.readiness.counts.critical}</div><div class="label">Critical findings</div></div>
      <div class="panel"><div class="metric">${report.project.javaFileCount}</div><div class="label">Java files</div></div>
      <div class="panel"><div class="metric">${escapeHtml(report.project.springBootVersion)}</div><div class="label">Spring Boot</div></div>
    </section>

    <h2>Executive Summary</h2>
    <div class="panel">${escapeHtml(report.readiness.summary)}</div>

    ${applicability}
    ${readiness}

    <h2>Evidence</h2>
    <div class="table-scroll"><table><thead><tr><th>Evidence</th><th>Status</th><th>Note</th></tr></thead><tbody>${evidence}</tbody></table></div>

    ${benchmarkEvidence}
    ${transformation}
    ${trust}
    ${rules}

    <h2>Finding Summary</h2>
    <section class="grid">
      <div class="panel"><div class="metric">${report.productionFindings.length}</div><div class="label">Production code findings</div></div>
      <div class="panel"><div class="metric">${report.testFindings.length}</div><div class="label">Test code findings</div></div>
      <div class="panel"><div class="metric">${Object.keys(report.findingSummary.byCode).length}</div><div class="label">Finding types</div></div>
      <div class="panel"><div class="metric">${report.findings.length}</div><div class="label">Detailed JSON findings</div></div>
    </section>
    <div class="table-scroll"><table><thead><tr><th>Type</th><th>Total</th><th>Production</th><th>Test</th><th>Top modules</th><th>Examples</th></tr></thead><tbody>${findingSummaryRows}</tbody></table></div>
  </main>
</body>
</html>
`;
}

function renderApplicability(report) {
  const applicability = report.packApplicability;
  if (!applicability) return '';
  const status = applicability.applicable ? 'yes' : 'no';
  const className = applicability.applicable ? 'notice' : 'notice bad';
  const detected = [
    `Spring Boot: ${report.project.springBootVersion}`,
    `Java: ${report.project.javaVersion}`,
    `Build: ${report.project.buildTools.join(', ') || 'unknown'}`,
    `javax usage: ${report.dependencies.javaxDetected ? 'yes' : 'no'}`,
    `jakarta usage: ${report.dependencies.jakartaDetected ? 'yes' : 'no'}`
  ].join(' · ');
  const recommended = applicability.recommendedPack ? `<div class="label">Recommended pack: ${escapeHtml(applicability.recommendedPack)}</div>` : '';
  return `
    <h2>Pack Applicability</h2>
    <div class="panel ${className}">
      <strong>Pack applicable: ${status}</strong> · confidence ${Math.round(applicability.confidence * 100)}%
      <div>${escapeHtml(applicability.reason)}</div>
      <div class="label">Detected: ${escapeHtml(detected)}</div>
      ${recommended}
    </div>
  `;
}

function renderReadiness(report, categories) {
  if (report.readiness.status === 'not_applicable') {
    return `
      <h2>Readiness</h2>
      <div class="panel notice bad">Readiness score was not computed because this pack is not applicable to the project.</div>
    `;
  }
  return `
    <h2>Readiness</h2>
    <div class="table-scroll"><table><thead><tr><th>Category</th><th>Score</th><th>Signal</th></tr></thead><tbody>${categories}</tbody></table></div>
  `;
}

function renderFindingSummaryRows(summary) {
  const rows = Object.values(summary.byCode);
  if (!rows.length) return '<tr><td colspan="6">No findings detected.</td></tr>';
  return rows
    .sort((left, right) => right.total - left.total || left.code.localeCompare(right.code))
    .map((item) => {
      const modules = item.topModules.map((module) => `${escapeHtml(module.name)} (${module.count})`).join('<br>');
      const examples = item.examples.map((finding) => `${escapeHtml(location(finding))} · ${escapeHtml(finding.recommendation)}`).join('<br>');
      return `<tr><td><span class="pill ${item.severity}">${escapeHtml(item.severity)}</span><br>${escapeHtml(item.title)}</td><td>${item.total}</td><td>${item.production}</td><td>${item.test}</td><td>${modules || 'Project metadata'}</td><td>${examples || 'See JSON details.'}</td></tr>`;
    })
    .join('');
}

export function summarizeFindings(findings) {
  const summary = {
    production: countBySeverity(findings.filter((finding) => finding.scope !== 'test')),
    test: countBySeverity(findings.filter((finding) => finding.scope === 'test')),
    byCode: {}
  };

  for (const finding of findings) {
    const current = summary.byCode[finding.code] || {
      code: finding.code,
      title: finding.title,
      severity: finding.severity,
      total: 0,
      production: 0,
      test: 0,
      topModules: [],
      examples: [],
      modules: {}
    };
    current.total += 1;
    current[finding.scope === 'test' ? 'test' : 'production'] += 1;
    const moduleName = moduleNameFor(finding.file);
    current.modules[moduleName] = (current.modules[moduleName] || 0) + 1;
    if (current.examples.length < 5) current.examples.push(finding);
    summary.byCode[finding.code] = current;
  }

  for (const item of Object.values(summary.byCode)) {
    item.topModules = Object.entries(item.modules)
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
      .slice(0, 3);
    delete item.modules;
  }

  return summary;
}

function countBySeverity(findings) {
  return findings.reduce((counts, finding) => {
    counts[finding.severity] = (counts[finding.severity] || 0) + 1;
    return counts;
  }, { critical: 0, warning: 0, info: 0 });
}

function moduleNameFor(file) {
  if (!file) return 'project';
  const normalized = file.replaceAll('\\', '/');
  const srcIndex = normalized.indexOf('/src/');
  if (srcIndex > 0) return normalized.slice(0, srcIndex).split('/').pop() || normalized.split('/')[0];
  return normalized.split('/')[0] || 'project';
}

function renderTransformation(transformation) {
  if (!transformation) return '';
  const changes = transformation.plan.changes.length
    ? transformation.plan.changes.map((change) => `<tr><td>${escapeHtml(change.file)}</td><td>${escapeHtml(change.recipe)}</td><td>${change.replacements}</td></tr>`).join('')
    : '<tr><td colspan="3">No transformation changes planned.</td></tr>';
  const validation = transformation.validation.length
    ? transformation.validation.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td><span class="pill ${item.status}">${escapeHtml(item.status)}</span></td><td>${escapeHtml(item.command || item.note || '')}</td></tr>`).join('')
    : '<tr><td colspan="3">Validation was not requested.</td></tr>';
  const rollback = transformation.rollback
    ? `${transformation.rollback.status}${transformation.rollback.id ? ` · ${transformation.rollback.id}` : ''}`
    : 'No rollback snapshot created';
  const execution = transformation.execution?.length
    ? transformation.execution.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td><span class="pill ${item.status}">${escapeHtml(item.status)}</span></td><td>${escapeHtml(item.command || item.output || '')}</td></tr>`).join('')
    : '<tr><td colspan="3">No external rewrite engine was executed.</td></tr>';

  return `
    <h2>Transformation</h2>
    <div class="panel">
      <strong>${escapeHtml(transformation.status)}</strong> · ${escapeHtml(transformation.mode)} · ${escapeHtml(transformation.engine || transformation.plan.engine)} · ${escapeHtml(transformation.plan.summary)}
      <div class="label">Rollback: ${escapeHtml(rollback)}</div>
    </div>

    <h2>Transformation Plan</h2>
    <div class="table-scroll"><table><thead><tr><th>File</th><th>Recipe</th><th>Replacements</th></tr></thead><tbody>${changes}</tbody></table></div>

    <h2>Rewrite Execution</h2>
    <div class="table-scroll"><table><thead><tr><th>Step</th><th>Status</th><th>Command</th></tr></thead><tbody>${execution}</tbody></table></div>

    <h2>Validation</h2>
    <div class="table-scroll"><table><thead><tr><th>Check</th><th>Status</th><th>Command</th></tr></thead><tbody>${validation}</tbody></table></div>
  `;
}

function renderBenchmarkEvidence(benchmark) {
  if (!benchmark) return '';
  const commands = benchmark.commands?.length
    ? benchmark.commands.map((item) => `<tr><td>${escapeHtml(item.command)}</td><td><span class="pill ${escapeHtml(item.status || statusFromExitCode(item.exitCode))}">${escapeHtml(item.status || statusFromExitCode(item.exitCode))}</span></td><td>${escapeHtml(trimOutput(item.output))}</td></tr>`).join('')
    : '<tr><td colspan="3">No external command was needed for this benchmark source.</td></tr>';
  const validation = renderBenchmarkValidation(benchmark.validation);
  const details = [
    benchmark.ref ? `<div class="label">Git ref: ${escapeHtml(benchmark.ref)}</div>` : null,
    benchmark.checkoutPath ? `<div class="label">Checkout: ${escapeHtml(benchmark.checkoutPath)}</div>` : null,
    benchmark.analysisPath && benchmark.analysisPath !== benchmark.checkoutPath ? `<div class="label">Analyzed path: ${escapeHtml(benchmark.analysisPath)}</div>` : null,
    benchmark.gitRevision ? `<div class="label">Git revision: ${escapeHtml(benchmark.gitRevision)}</div>` : null
  ].filter(Boolean).join('\n      ');
  const detailsBlock = details ? `\n      ${details}` : '';

  return `
    <h2>Benchmark Evidence</h2>
    <div class="panel">
      <strong>${escapeHtml(benchmark.source)}</strong> · ${escapeHtml(benchmark.repository)}${detailsBlock}
    </div>
    <div class="table-scroll"><table><thead><tr><th>Command</th><th>Status</th><th>Output</th></tr></thead><tbody>${commands}</tbody></table></div>
    ${validation}
  `;
}

function renderBenchmarkValidation(validation) {
  if (!validation) return '';
  const checks = validation.checks?.length
    ? validation.checks.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td><span class="pill ${escapeHtml(item.status)}">${escapeHtml(item.status)}</span></td><td>${escapeHtml(item.command || '')}</td><td>${escapeHtml(formatDuration(item.durationMs))}</td><td>${escapeHtml(trimOutput(item.output))}</td></tr>`).join('')
    : '<tr><td colspan="5">Validation was not requested.</td></tr>';

  return `
    <h2>Benchmark Validation</h2>
    <div class="panel">
      <strong>${escapeHtml(validation.status)}</strong> · confidence ${escapeHtml(validation.confidence)}% · ${escapeHtml(validation.summary)}
    </div>
    <div class="table-scroll"><table><thead><tr><th>Check</th><th>Status</th><th>Command</th><th>Duration</th><th>Log Excerpt</th></tr></thead><tbody>${checks}</tbody></table></div>
  `;
}

function renderTrust(trust) {
  if (!trust) return '';
  const checks = trust.checks.length
    ? trust.checks.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td><span class="pill ${item.status}">${escapeHtml(item.status)}</span></td><td>${escapeHtml(item.note || '')}</td></tr>`).join('')
    : '<tr><td colspan="3">No trust checks were generated.</td></tr>';

  return `
    <h2>Trust Engine</h2>
    <div class="panel">
      <strong>${trust.confidence}%</strong> · ${escapeHtml(trust.tier)} · ${escapeHtml(trust.summary)}
    </div>
    <div class="table-scroll"><table><thead><tr><th>Check</th><th>Status</th><th>Evidence</th></tr></thead><tbody>${checks}</tbody></table></div>
  `;
}

function renderRules(rules) {
  if (!rules) return '';
  const violations = rules.violations.length
    ? rules.violations.map((item) => `<tr><td><span class="pill ${item.severity}">${escapeHtml(item.severity)}</span></td><td>${escapeHtml(item.category || 'enterprise')}</td><td>${escapeHtml(item.rule)}${ruleOwner(item)}</td><td>${escapeHtml(item.pattern)}</td><td>${escapeHtml(location(item))}</td><td>${ruleGuidance(item)}</td></tr>`).join('')
    : '<tr><td colspan="6">No enterprise rule violations detected.</td></tr>';

  return `
    <h2>Enterprise Rules</h2>
    <div class="panel">
      <strong>${rules.violations.length}</strong> violation(s) · ${escapeHtml(rules.source)}
    </div>
    <div class="table-scroll"><table><thead><tr><th>Severity</th><th>Category</th><th>Rule</th><th>Pattern</th><th>Location</th><th>Guidance</th></tr></thead><tbody>${violations}</tbody></table></div>
  `;
}

function reportDecision(report) {
  if (report.readiness.status === 'not_applicable') {
    return {
      tone: 'bad',
      title: 'Do not use this pack for migration planning yet',
      summary: report.packApplicability?.reason || 'The selected pack is not applicable to the detected project state.',
      nextStep: report.packApplicability?.recommendedPack
        ? `Run ${report.packApplicability.recommendedPack} before using this report for planning.`
        : 'Choose the applicable modernization pack and rerun analysis.'
    };
  }
  if (report.readiness.counts.critical > 0) {
    return {
      tone: 'bad',
      title: 'Migration is blocked by critical readiness risks',
      summary: `${report.readiness.counts.critical} critical finding(s) should be resolved before execution planning.`,
      nextStep: 'Triage critical findings, then capture compile and test validation evidence.'
    };
  }
  if (Number(report.readiness.overall) >= 85) {
    return {
      tone: 'good',
      title: 'Ready for controlled migration planning',
      summary: 'Readiness is strong enough to move from assessment into validation-backed planning.',
      nextStep: 'Run transformation validation and attach compile, test, rollback, and trust evidence.'
    };
  }
  return {
    tone: 'warn',
    title: 'Needs remediation before confident migration execution',
    summary: 'The report has enough signal for scoping, but the evidence is not yet strong enough for execution.',
    nextStep: 'Prioritize repeated warning patterns and rerun the report after cleanup.'
  };
}

function validationSummary(report) {
  const validation = report.benchmark?.validation || report.transformation?.validation;
  if (!validation) return 'No validation evidence captured in this report.';
  if (Array.isArray(validation)) {
    const passed = validation.filter((item) => item.status === 'passed').length;
    return `${passed}/${validation.length} validation checks passed.`;
  }
  return `${validation.status || 'unknown'}${validation.confidence !== undefined ? ` at ${validation.confidence}% confidence` : ''}.`;
}

function topFindingTypes(summary) {
  return Object.values(summary.byCode)
    .sort((left, right) => severityRank(left.severity) - severityRank(right.severity) || right.total - left.total || left.title.localeCompare(right.title));
}

function severityRank(severity) {
  if (severity === 'critical') return 0;
  if (severity === 'warning') return 1;
  return 2;
}

function ruleOwner(item) {
  return item.owner ? `<div class="label">${escapeHtml(item.owner)}</div>` : '';
}

function ruleGuidance(item) {
  const guidance = [item.rationale, item.remediation].filter(Boolean).map(escapeHtml).join('<br>');
  return guidance || 'See enterprise rules file.';
}

function label(value) {
  return value.replace(/(^|-)([a-z])/g, (_, prefix, char) => `${prefix ? ' ' : ''}${char.toUpperCase()}`);
}

function location(finding) {
  if (!finding.file) return 'Project metadata';
  return `${finding.file}${finding.line ? `:${finding.line}` : ''}`;
}

function formatScore(score) {
  return Number.isFinite(score) ? `${score}%` : 'N/A';
}

function statusFromExitCode(exitCode) {
  return exitCode === 0 ? 'passed' : 'failed';
}

function trimOutput(output) {
  const value = String(output || '').replace(/\s+/g, ' ').trim();
  return value.length > 240 ? `${value.slice(0, 237)}...` : value;
}

function formatDuration(durationMs) {
  if (!Number.isFinite(durationMs)) return 'N/A';
  if (durationMs < 1000) return `${durationMs} ms`;
  return `${(durationMs / 1000).toFixed(1)} s`;
}

function normalizeHtml(html) {
  return html.replace(/[ \t]+$/gm, '');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
