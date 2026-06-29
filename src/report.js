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
  if (transformation) report.transformation = transformation;
  if (transformation) report.trust = buildTrustEvidence({ scan, transformation });
  if (rules?.loaded) report.rules = rules;
  const jsonPath = path.join(outDir, 'report.json');
  const htmlPath = path.join(outDir, 'index.html');
  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await fs.writeFile(htmlPath, renderReport(report));
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

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(report.project.name)} Readiness Report</title>
  <style>
    :root { color-scheme: light; --ink:#15202b; --muted:#5f6b7a; --line:#d9e1ea; --bg:#f6f8fa; --panel:#fff; --accent:#1769aa; --ok:#217a45; --warn:#966600; --bad:#b42318; }
    * { box-sizing: border-box; }
    body { margin:0; font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color:var(--ink); background:var(--bg); }
    header { background:#102a43; color:#fff; padding:32px max(24px, calc((100vw - 1120px)/2)); }
    main { max-width:1120px; margin:0 auto; padding:24px; }
    h1,h2 { margin:0 0 12px; letter-spacing:0; }
    h1 { font-size:32px; }
    h2 { font-size:20px; margin-top:28px; }
    .meta { color:#d9e6f2; margin:0; }
    .grid { display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:12px; }
    .panel { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:16px; }
    .metric { font-size:34px; font-weight:760; }
    .label { color:var(--muted); font-size:13px; }
    .notice { border-left:4px solid var(--accent); }
    .notice.bad { border-left-color:var(--bad); }
    table { width:100%; border-collapse:collapse; background:var(--panel); border:1px solid var(--line); border-radius:8px; overflow:hidden; }
    th,td { text-align:left; padding:10px 12px; border-bottom:1px solid var(--line); vertical-align:top; }
    th { font-size:12px; color:var(--muted); text-transform:uppercase; }
    tr:last-child td { border-bottom:0; }
    .bar { height:9px; background:#edf2f7; border-radius:999px; overflow:hidden; }
    .bar span { display:block; height:100%; background:var(--accent); }
    .pill { display:inline-block; min-width:64px; padding:2px 8px; border-radius:999px; font-size:12px; font-weight:650; text-align:center; background:#eef2f7; color:#344054; }
    .critical,.failed { background:#ffe4e0; color:var(--bad); }
    .warning,.pending { background:#fff3c4; color:var(--warn); }
    .skipped { background:#eef2f7; color:#344054; }
    .info { background:#e7f0ff; color:#175cd3; }
    .passed { background:#dff7e8; color:var(--ok); }
    @media (max-width: 760px) { .grid { grid-template-columns:1fr 1fr; } h1 { font-size:25px; } table { font-size:13px; } }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(report.project.name)} Readiness Report</h1>
    <p class="meta">${escapeHtml(report.pack)} · ${escapeHtml(report.generatedAt)} · ${escapeHtml(report.project.source)}</p>
  </header>
  <main>
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
    <table><thead><tr><th>Evidence</th><th>Status</th><th>Note</th></tr></thead><tbody>${evidence}</tbody></table>

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
    <table><thead><tr><th>Type</th><th>Total</th><th>Production</th><th>Test</th><th>Top modules</th><th>Examples</th></tr></thead><tbody>${findingSummaryRows}</tbody></table>
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
    <table><thead><tr><th>Category</th><th>Score</th><th>Signal</th></tr></thead><tbody>${categories}</tbody></table>
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
    <table><thead><tr><th>File</th><th>Recipe</th><th>Replacements</th></tr></thead><tbody>${changes}</tbody></table>

    <h2>Rewrite Execution</h2>
    <table><thead><tr><th>Step</th><th>Status</th><th>Command</th></tr></thead><tbody>${execution}</tbody></table>

    <h2>Validation</h2>
    <table><thead><tr><th>Check</th><th>Status</th><th>Command</th></tr></thead><tbody>${validation}</tbody></table>
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
    <table><thead><tr><th>Check</th><th>Status</th><th>Evidence</th></tr></thead><tbody>${checks}</tbody></table>
  `;
}

function renderRules(rules) {
  if (!rules) return '';
  const violations = rules.violations.length
    ? rules.violations.map((item) => `<tr><td><span class="pill ${item.severity}">${escapeHtml(item.severity)}</span></td><td>${escapeHtml(item.rule)}</td><td>${escapeHtml(item.pattern)}</td><td>${escapeHtml(location(item))}</td></tr>`).join('')
    : '<tr><td colspan="4">No enterprise rule violations detected.</td></tr>';

  return `
    <h2>Enterprise Rules</h2>
    <div class="panel">
      <strong>${rules.violations.length}</strong> violation(s) · ${escapeHtml(rules.source)}
    </div>
    <table><thead><tr><th>Severity</th><th>Rule</th><th>Pattern</th><th>Location</th></tr></thead><tbody>${violations}</tbody></table>
  `;
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

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
