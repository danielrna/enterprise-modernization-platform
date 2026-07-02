import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const DEFAULT_SELECTION = [
  {
    slug: 'spring-javaconfig-sample',
    role: 'Green Hibernate path',
    reason: 'Checkout-backed Hibernate readiness with compile and tests passed.'
  },
  {
    slug: 'hibernate-helloworld',
    role: 'Partial validation path',
    reason: 'Production compile passes while test compilation records a dependency gap.'
  },
  {
    slug: 'hypersistence-utils',
    role: 'Advanced integration risk',
    reason: 'Custom Hibernate types and Java toolchain validation failure evidence.'
  }
];

export async function generateConsultantDemo({
  benchmarksDir = 'docs/benchmarks',
  outFile = 'docs/consultant-demo.html',
  selection = DEFAULT_SELECTION
} = {}) {
  const demos = [];
  for (const item of selection) {
    const report = await readJson(path.join(benchmarksDir, item.slug, 'report.json'));
    if (!report) throw new Error(`Missing consultant demo benchmark report: ${item.slug}`);
    demos.push(normalizeDemoReport(item, report));
  }

  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, normalizeHtml(renderConsultantDemo(demos)));
  return { outFile, count: demos.length, demos };
}

export async function buildConsultantDemoBundle({
  docsDir = 'docs',
  outFile = 'reports/emp-consultant-demo.zip',
  workDir = 'reports/emp-consultant-demo',
  selection = DEFAULT_SELECTION
} = {}) {
  await fs.rm(workDir, { recursive: true, force: true });
  await fs.mkdir(workDir, { recursive: true });

  const files = [
    'index.html',
    'consultant-demo.html',
    'editions.html',
    'contact.html',
    'release-notes/index.html',
    'release-notes/v0.1.8.html',
    'release-notes/v0.1.8.md',
    'knowledge-base/index.html',
    'knowledge-base/hibernate-readiness.html',
    'knowledge-base/hibernate-validation-failures.html',
    'knowledge-base/trust-engine-evidence.html',
    'packs/index.html',
    'packs/hibernate-readiness.html',
    'benchmarks/index.html',
    ...selection.flatMap((item) => [
      `benchmarks/${item.slug}/index.html`,
      `benchmarks/${item.slug}/report.json`
    ])
  ];

  for (const file of files) {
    await copyIfExists(path.join(docsDir, file), path.join(workDir, file));
  }
  await fs.writeFile(path.join(workDir, 'README.md'), consultantReadme(selection));
  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.rm(outFile, { force: true });
  await zipDirectory(workDir, outFile);
  return { outFile, workDir, fileCount: files.length + 1 };
}

function normalizeDemoReport(item, report) {
  return {
    slug: item.slug,
    name: report.project?.name || item.slug,
    role: item.role,
    reason: item.reason,
    pack: report.pack,
    readiness: report.readiness?.overall,
    critical: report.readiness?.counts?.critical || 0,
    warning: report.readiness?.counts?.warning || 0,
    source: report.benchmark?.source || 'catalog',
    validation: report.benchmark?.validation || { status: 'not_requested', confidence: 0, checks: [] },
    nextActions: (report.nextActions || []).slice(0, 3)
  };
}

function renderConsultantDemo(demos) {
  const cards = demos.map((demo) => `
      <article class="demo-card">
        <small>${escapeHtml(demo.role)}</small>
        <h2><a href="benchmarks/${escapeHtml(demo.slug)}/index.html">${escapeHtml(demo.name)}</a></h2>
        <p>${escapeHtml(demo.reason)}</p>
        <div class="metrics">
          <span><strong>${escapeHtml(formatReadiness(demo.readiness))}</strong><small>Readiness</small></span>
          <span><strong>${escapeHtml(demo.validation.status)}</strong><small>Validation</small></span>
          <span><strong>${escapeHtml(demo.validation.confidence || 0)}%</strong><small>Confidence</small></span>
        </div>
        <ul>${demo.nextActions.map((action) => `<li>${escapeHtml(action.title)}</li>`).join('')}</ul>
      </article>`).join('');

  return page('Consultant Demo', `
    <nav class="site-nav">
      <a href="index.html">Home</a>
      <a href="consultant-demo.html">Consultant Demo</a>
      <a href="benchmarks/index.html">Benchmarks</a>
      <a href="knowledge-base/index.html">Knowledge Base</a>
      <a href="release-notes/index.html">Release Notes</a>
      <a href="editions.html">Editions</a>
      <a href="contact.html">Contact</a>
    </nav>

    <section class="hero">
      <div>
        <h1>Consultant Demo Pack</h1>
        <p>Use this page to walk a client from readiness evidence to validation evidence to paid modernization work in one short conversation.</p>
      </div>
      <aside class="proof">
        <div><strong>60</strong><span>Public reports</span></div>
        <div><strong>25</strong><span>Checkout-backed</span></div>
        <div><strong>12</strong><span>Passing validation</span></div>
      </aside>
    </section>

    <h2>Three Reports To Show</h2>
    <section class="demo-grid">${cards}</section>

    <h2>Client Conversation</h2>
    <section class="steps">
      <div><strong>1. Show readiness</strong><span>Open a report and point to applicability, score, findings, and recommended next actions.</span></div>
      <div><strong>2. Show trust</strong><span>Use checkout source, compile/test status, confidence, and JSON evidence to explain what is proven.</span></div>
      <div><strong>3. Show limits</strong><span>Use failure-pattern evidence to separate environment blockers from migration risk.</span></div>
      <div><strong>4. Sell next work</strong><span>Offer a paid validation and remediation pass before migration execution.</span></div>
    </section>

    <h2>Run This For A Client</h2>
    <pre><code>docker run --rm -v "$PWD:/workspace" danielrna/enterprise-modernization-platform:v0.2.8 analyze . --pack hibernate-readiness --out reports/hibernate-readiness</code></pre>
    <pre><code>docker run --rm -v "$PWD:/workspace" danielrna/enterprise-modernization-platform:v0.2.8 transform . --pack spring-boot-3-readiness --mode dry-run --validate --out reports/spring-boot-trust</code></pre>

    <h2>Send These Artifacts</h2>
    <section class="artifact-grid">
      <a href="benchmarks/spring-javaconfig-sample/index.html"><strong>Green-path report</strong><span>Checkout-backed compile and test pass.</span></a>
      <a href="benchmarks/hibernate-helloworld/index.html"><strong>Partial validation report</strong><span>Compile passes, tests expose dependency gap.</span></a>
      <a href="knowledge-base/hibernate-validation-failures.html"><strong>Failure-pattern guide</strong><span>Explains blockers without overselling.</span></a>
      <a href="release-notes/v0.1.8.html"><strong>Release notes</strong><span>What changed in the current release.</span></a>
    </section>

    <h2>What To Say</h2>
    <div class="table-scroll"><table>
      <thead><tr><th>Client Question</th><th>Evidence To Use</th><th>Commercial Next Step</th></tr></thead>
      <tbody>
        <tr><td>Can we start the migration?</td><td>Readiness score, applicability, critical findings, and next actions.</td><td>Paid readiness cleanup sprint.</td></tr>
        <tr><td>Can we trust the report?</td><td>Checkout-backed source, compile/test status, validation confidence, and report JSON.</td><td>Paid validation run on the client repository.</td></tr>
        <tr><td>Why did validation fail?</td><td>Failure-pattern Knowledge Base and captured command output.</td><td>Environment repair or module narrowing before migration execution.</td></tr>
      </tbody>
    </table></div>
  `);
}

function consultantReadme(selection) {
  const reports = selection.map((item) => `- ${item.role}: benchmarks/${item.slug}/index.html`).join('\n');
  return `# EMP Consultant Demo Pack

Open consultant-demo.html first.

Recommended flow:

1. Show one green checkout-backed report.
2. Show one partial or failed validation report.
3. Show the Hibernate Validation Failure Patterns Knowledge Base article.
4. Explain the paid next step: validation, remediation, then migration execution.

Included reports:

${reports}

Client command:

\`\`\`bash
docker run --rm -v "$PWD:/workspace" danielrna/enterprise-modernization-platform:v0.2.8 analyze . --pack hibernate-readiness --out reports/hibernate-readiness
\`\`\`
`;
}

async function copyIfExists(source, target) {
  const stat = await fs.stat(source).catch(() => null);
  if (!stat?.isFile()) return;
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
}

async function zipDirectory(sourceDir, outFile) {
  const absoluteOut = path.resolve(outFile);
  const result = await runCommand(['zip', '-qr', absoluteOut, '.'], { cwd: sourceDir });
  if (result.exitCode !== 0) {
    throw new Error(`Failed to create consultant demo bundle: ${result.output}`);
  }
}

function runCommand(args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(args[0], args.slice(1), { cwd: options.cwd });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk) => { output += chunk.toString(); });
    child.on('error', (error) => resolve({ exitCode: 127, output: error.message }));
    child.on('close', (exitCode) => resolve({ exitCode, output }));
  });
}

function page(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { --ink:#17202a; --muted:#64748b; --line:#d8dee8; --bg:#f7f9fb; --panel:#fff; --accent:#1769aa; --accent-dark:#0f4f84; --ok:#217a45; --warn:#966600; }
    * { box-sizing:border-box; }
    body { margin:0; font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color:var(--ink); background:var(--bg); }
    main { max-width:1120px; margin:0 auto; padding:32px 24px; }
    h1 { max-width:820px; margin:0 0 10px; font-size:38px; line-height:1.12; letter-spacing:0; }
    h2 { margin:30px 0 12px; font-size:21px; letter-spacing:0; }
    p { max-width:780px; color:var(--muted); }
    a { color:var(--accent); text-decoration:none; }
    a:hover { text-decoration:underline; }
    .site-nav { display:flex; flex-wrap:wrap; gap:10px 14px; align-items:center; margin:0 0 30px; padding-bottom:16px; border-bottom:1px solid var(--line); }
    .site-nav a { color:var(--muted); font-size:14px; }
    .site-nav a:first-child { color:var(--ink); font-weight:700; }
    .hero { display:grid; grid-template-columns:minmax(0,1fr) 330px; gap:22px; align-items:start; }
    .proof,.demo-card,.steps div,.artifact-grid a { background:var(--panel); border:1px solid var(--line); border-radius:8px; }
    .proof { display:grid; grid-template-columns:1fr; gap:10px; padding:16px; border-left:4px solid var(--ok); }
    .proof div { display:flex; justify-content:space-between; gap:12px; border-bottom:1px solid var(--line); padding-bottom:8px; }
    .proof div:last-child { border-bottom:0; padding-bottom:0; }
    .proof strong { font-size:24px; }
    .proof span, small, .steps span, .artifact-grid span { color:var(--muted); }
    .demo-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; }
    .demo-card { padding:16px; display:flex; flex-direction:column; gap:8px; min-height:320px; }
    .demo-card h2 { margin:0; font-size:20px; }
    .demo-card small { text-transform:uppercase; font-size:12px; }
    .metrics { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; margin:8px 0; }
    .metrics span { display:flex; flex-direction:column; gap:2px; padding:8px; background:#f8fafc; border:1px solid var(--line); border-radius:6px; }
    .steps { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
    .steps div { padding:14px; }
    pre { overflow:auto; padding:14px; background:#111827; color:#f8fafc; border-radius:8px; }
    code { font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
    .artifact-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
    .artifact-grid a { display:flex; flex-direction:column; gap:6px; min-height:118px; padding:14px; color:var(--ink); }
    .table-scroll { width:100%; overflow-x:auto; border-radius:8px; }
    table { width:100%; border-collapse:collapse; background:var(--panel); border:1px solid var(--line); border-radius:8px; overflow:hidden; }
    th,td { text-align:left; padding:10px 12px; border-bottom:1px solid var(--line); vertical-align:top; }
    th { font-size:12px; color:var(--muted); text-transform:uppercase; }
    li { margin:6px 0; }
    @media (max-width: 920px) { .hero,.demo-grid,.steps,.artifact-grid { grid-template-columns:1fr; } h1 { font-size:31px; } }
    @media (max-width: 640px) { main { padding:24px 16px; } table { min-width:760px; } }
  </style>
</head>
<body><main>${body}</main></body>
</html>
`;
}

function formatReadiness(value) {
  return value === null || value === undefined ? 'N/A' : `${value}%`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeHtml(html) {
  return html.replace(/[ \t]+$/gm, '');
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return null;
  }
}
