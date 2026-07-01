import fs from 'node:fs/promises';
import path from 'node:path';

export async function generateKnowledgeBase({
  knowledgeDir = 'knowledge',
  outDir = 'docs/knowledge-base'
} = {}) {
  const articles = await loadArticles(knowledgeDir);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, 'index.html'), normalizeHtml(renderIndex(articles)));
  for (const article of articles) {
    await fs.writeFile(path.join(outDir, `${article.id}.html`), normalizeHtml(renderArticle(article)));
  }
  return { count: articles.length, articles, outDir };
}

async function loadArticles(knowledgeDir) {
  const entries = await fs.readdir(knowledgeDir, { withFileTypes: true }).catch(() => []);
  const articles = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const article = JSON.parse(await fs.readFile(path.join(knowledgeDir, entry.name), 'utf8'));
    articles.push(normalizeArticle(article));
  }
  return articles.sort((left, right) => left.title.localeCompare(right.title));
}

function normalizeArticle(article) {
  return {
    id: article.id,
    title: article.title,
    pack: article.pack,
    summary: article.summary || '',
    guide: article.guide || [],
    risks: article.risks || [],
    validationNotes: article.validationNotes || [],
    benchmarks: article.benchmarks || [],
    limits: article.limits || []
  };
}

function renderIndex(articles) {
  const cards = articles.map((article) => `
      <a class="tile" href="${escapeHtml(article.id)}.html">
        <strong>${escapeHtml(article.title)}</strong>
        <span>${escapeHtml(article.summary)}</span>
      </a>`).join('');
  return page('Knowledge Base', `
    <nav class="site-nav">
      <a href="../index.html">Home</a>
      <a href="../migration-hub/spring-boot-2-to-3.html">Migration Hub</a>
      <a href="../benchmarks/index.html">Benchmarks</a>
      <a href="../packs/index.html">Packs</a>
      <a href="../knowledge-base/index.html">Knowledge Base</a>
      <a href="../release-notes/index.html">Release Notes</a>
      <a href="../editions.html">Editions</a>
      <a href="../contact.html">Contact</a>
    </nav>
    <section>
      <h1>Knowledge Base</h1>
      <p>Generated modernization guidance from pack and benchmark evidence.</p>
    </section>
    <section class="layout">${cards}</section>
  `);
}

function renderArticle(article) {
  const guide = article.guide.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const risks = article.risks.map((risk) => `
      <tr>
        <td><strong>${escapeHtml(risk.name)}</strong><br><code>${escapeHtml(risk.signal)}</code></td>
        <td>${escapeHtml(risk.whyItMatters)}</td>
        <td>${escapeHtml(risk.recommendation)}</td>
      </tr>`).join('');
  const validationNotes = article.validationNotes.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const benchmarks = article.benchmarks.map((benchmark) => `
      <a class="tile" href="../benchmarks/${escapeHtml(benchmark.slug)}/index.html">
        <strong>${escapeHtml(benchmark.name)}</strong>
        <span>${escapeHtml(benchmark.note)}</span>
      </a>`).join('');
  const limits = article.limits.map((item) => `<li>${escapeHtml(item)}</li>`).join('');

  return page(article.title, `
    <nav class="site-nav">
      <a href="../index.html">Home</a>
      <a href="../migration-hub/spring-boot-2-to-3.html">Migration Hub</a>
      <a href="../benchmarks/index.html">Benchmarks</a>
      <a href="../packs/index.html">Packs</a>
      <a href="index.html">Knowledge Base</a>
      <a href="../release-notes/index.html">Release Notes</a>
      <a href="../editions.html">Editions</a>
      <a href="../contact.html">Contact</a>
    </nav>

    <section>
      <h1>${escapeHtml(article.title)}</h1>
      <p>${escapeHtml(article.summary)}</p>
    </section>

    <section class="summary">
      <div><strong>Pack</strong><span><a href="../packs/${escapeHtml(article.pack)}.html">${escapeHtml(article.pack)}</a></span></div>
      <div><strong>Risks</strong><span>${article.risks.length}</span></div>
      <div><strong>Benchmarks</strong><span>${article.benchmarks.length}</span></div>
    </section>

    <h2>Guide</h2>
    <ul>${guide}</ul>

    <h2>Common Risks</h2>
    <div class="table-scroll"><table><thead><tr><th>Risk</th><th>Why It Matters</th><th>Recommendation</th></tr></thead><tbody>${risks}</tbody></table></div>

    <h2>Validation Notes</h2>
    <ul>${validationNotes}</ul>

    <h2>Benchmark Examples</h2>
    <section class="layout">${benchmarks}</section>

    <h2>What This Does Not Prove</h2>
    <ul>${limits}</ul>
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
    .layout { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:14px; margin:18px 0; }
    .tile { display:flex; flex-direction:column; gap:6px; min-height:118px; padding:18px; background:var(--panel); border:1px solid var(--line); border-radius:8px; color:var(--ink); }
    .tile span { color:var(--muted); }
    .summary { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:12px; margin:24px 0; }
    .summary div { display:flex; flex-direction:column; gap:5px; padding:14px; background:var(--panel); border:1px solid var(--line); border-radius:8px; }
    .summary span { color:var(--muted); }
    .table-scroll { width:100%; overflow-x:auto; border-radius:8px; }
    table { width:100%; border-collapse:collapse; background:var(--panel); border:1px solid var(--line); border-radius:8px; overflow:hidden; }
    th,td { text-align:left; padding:10px 12px; border-bottom:1px solid var(--line); vertical-align:top; }
    th { font-size:12px; color:var(--muted); text-transform:uppercase; }
    li { margin:6px 0; }
    code { font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; color:var(--muted); }
    @media (max-width: 760px) { main { padding:24px 16px; } .layout,.summary { grid-template-columns:1fr; } h1 { font-size:27px; } table { min-width:760px; } }
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
