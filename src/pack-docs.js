import fs from 'node:fs/promises';
import path from 'node:path';

export async function generatePackDocs({
  packsDir = 'packs',
  outDir = 'docs/packs'
} = {}) {
  const packs = await loadPacks(packsDir);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, 'index.html'), normalizeHtml(renderPackIndex(packs)));
  for (const pack of packs) {
    await fs.writeFile(path.join(outDir, `${pack.id}.html`), normalizeHtml(renderPackPage(pack)));
  }
  return { count: packs.length, packs, outDir };
}

async function loadPacks(packsDir) {
  const entries = await fs.readdir(packsDir, { withFileTypes: true });
  const packs = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const file = path.join(packsDir, entry.name);
    const pack = JSON.parse(await fs.readFile(file, 'utf8'));
    packs.push(normalizePack(pack));
  }
  return packs.sort((left, right) => left.name.localeCompare(right.name));
}

function normalizePack(pack) {
  return {
    id: pack.id,
    name: pack.name,
    vertical: pack.vertical || pack.target || 'Enterprise Modernization',
    migration: pack.migration || pack.target || pack.description || 'Modernization readiness',
    version: pack.version || '0.1.0',
    description: pack.description || `Assess ${pack.name} evidence before mandatory modernization work.`,
    categories: pack.categories || [],
    checks: pack.checks || [],
    reportSections: pack.reportSections || pack.outputs || []
  };
}

function renderPackIndex(packs) {
  const cards = packs.map((pack) => `
      <a class="tile" href="${escapeHtml(pack.id)}.html">
        <strong>${escapeHtml(pack.name)}</strong>
        <span>${escapeHtml(pack.migration)}</span>
      </a>`).join('');
  return page('Migration Packs', `
    <nav class="site-nav">
      <a href="../index.html">Home</a>
      <a href="../quickstart.html">Quickstart</a>
      <a href="../migration-hub/spring-boot-2-to-3.html">Migration Hub</a>
      <a href="../benchmarks/index.html">Benchmarks</a>
      <a href="../packs/index.html">Packs</a>
      <a href="../release-notes/index.html">Release Notes</a>
      <a href="../editions.html">Editions</a>
      <a href="../contact.html">Contact</a>
    </nav>
    <section>
      <h1>Migration Packs</h1>
      <p>Generated documentation pages from pack metadata. Each page describes the readiness scope, checks, report sections, and execution command for a mandatory modernization pack.</p>
    </section>
    <section class="layout">${cards}</section>
  `);
}

function renderPackPage(pack) {
  const checkRows = pack.checks.map((check) => `<tr><td>${escapeHtml(check.id)}</td><td>${escapeHtml(check.engine || check.severity || 'metadata')}</td><td>${escapeHtml(check.description)}</td></tr>`).join('');
  const categoryItems = pack.categories.length
    ? pack.categories.map((category) => `<li>${escapeHtml(category)}</li>`).join('')
    : '<li>Pack-specific readiness signals</li>';
  const sectionItems = pack.reportSections.length
    ? pack.reportSections.map((section) => `<li>${escapeHtml(section)}</li>`).join('')
    : '<li>HTML report</li><li>JSON report</li>';

  return page(pack.name, `
    <nav class="site-nav">
      <a href="../index.html">Home</a>
      <a href="../quickstart.html">Quickstart</a>
      <a href="../migration-hub/spring-boot-2-to-3.html">Migration Hub</a>
      <a href="../benchmarks/index.html">Benchmarks</a>
      <a href="index.html">Packs</a>
      <a href="../release-notes/index.html">Release Notes</a>
      <a href="../editions.html">Editions</a>
      <a href="../contact.html">Contact</a>
    </nav>

    <section>
      <h1>${escapeHtml(pack.name)}</h1>
      <p>${escapeHtml(pack.description)}</p>
    </section>

    <section class="summary">
      <div><strong>Vertical</strong><span>${escapeHtml(pack.vertical)}</span></div>
      <div><strong>Migration</strong><span>${escapeHtml(pack.migration)}</span></div>
      <div><strong>Pack ID</strong><span>${escapeHtml(pack.id)}</span></div>
      <div><strong>Version</strong><span>${escapeHtml(pack.version)}</span></div>
    </section>

    <h2>Run This Pack</h2>
    <pre><code>node ./bin/emp.js analyze /path/to/app --pack ${escapeHtml(pack.id)} --out reports/${escapeHtml(pack.id)}</code></pre>

    <h2>Readiness Categories</h2>
    <ul>${categoryItems}</ul>

    <h2>Checks</h2>
    <div class="table-scroll"><table><thead><tr><th>Check</th><th>Engine</th><th>Description</th></tr></thead><tbody>${checkRows}</tbody></table></div>

    <h2>Report Output</h2>
    <ul>${sectionItems}</ul>

    <h2>Evidence Workflow</h2>
    <section class="steps">
      <div><strong>Analyze</strong><span>Detect metadata, source findings, and pack applicability.</span></div>
      <div><strong>Report</strong><span>Generate static HTML and JSON evidence that can be shared without a backend.</span></div>
      <div><strong>Validate</strong><span>Use transformation validation when compile, test, rollback, and trust evidence are required.</span></div>
    </section>
  `);
}

function page(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { --ink:#17202a; --muted:#64748b; --line:#d8dee8; --bg:#f7f9fb; --panel:#fff; --accent:#1769aa; }
    * { box-sizing:border-box; }
    body { margin:0; font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color:var(--ink); background:var(--bg); }
    main { max-width:1080px; margin:0 auto; padding:32px 24px; }
    h1 { margin:0 0 8px; font-size:34px; letter-spacing:0; }
    h2 { margin:28px 0 10px; font-size:21px; letter-spacing:0; }
    p { max-width:760px; color:var(--muted); }
    a { color:var(--accent); text-decoration:none; }
    a:hover { text-decoration:underline; }
    .site-nav { display:flex; flex-wrap:wrap; gap:10px 14px; align-items:center; margin:0 0 28px; padding-bottom:16px; border-bottom:1px solid var(--line); }
    .site-nav a { color:var(--muted); font-size:14px; }
    .site-nav a:first-child { color:var(--ink); font-weight:700; }
    .layout { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:14px; margin:24px 0; }
    .tile { display:flex; flex-direction:column; gap:6px; min-height:128px; padding:18px; background:var(--panel); border:1px solid var(--line); border-radius:8px; color:var(--ink); }
    .tile span { color:var(--muted); }
    .summary { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:12px; margin:24px 0; }
    .summary div,.steps div { display:flex; flex-direction:column; gap:5px; padding:14px; background:var(--panel); border:1px solid var(--line); border-radius:8px; }
    .summary span,.steps span { color:var(--muted); }
    .steps { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:12px; }
    pre { overflow:auto; padding:14px; background:#111827; color:#f8fafc; border-radius:8px; }
    code { font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
    .table-scroll { width:100%; overflow-x:auto; border-radius:8px; }
    table { width:100%; border-collapse:collapse; background:var(--panel); border:1px solid var(--line); border-radius:8px; overflow:hidden; }
    th,td { text-align:left; padding:10px 12px; border-bottom:1px solid var(--line); vertical-align:top; }
    th { font-size:12px; color:var(--muted); text-transform:uppercase; }
    li { margin:6px 0; }
    @media (max-width: 900px) { .layout,.summary,.steps { grid-template-columns:1fr 1fr; } }
    @media (max-width: 640px) { main { padding:24px 16px; } .layout,.summary,.steps { grid-template-columns:1fr; } h1 { font-size:27px; } table { min-width:680px; } }
  </style>
</head>
<body><main>${body}</main></body>
</html>
`;
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
