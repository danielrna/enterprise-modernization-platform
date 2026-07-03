import fs from 'node:fs/promises';
import path from 'node:path';

export async function generateReleaseNotes({
  featuresFile = 'features/catalog.json',
  outDir = 'docs/release-notes'
} = {}) {
  const catalog = JSON.parse(await fs.readFile(featuresFile, 'utf8'));
  const releases = normalizeReleases(catalog.releases || []);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, 'index.html'), normalizeText(renderReleaseIndex(releases)));
  for (const release of releases) {
    await fs.writeFile(path.join(outDir, `${release.id}.html`), normalizeText(renderReleasePage(release)));
    await fs.writeFile(path.join(outDir, `${release.id}.md`), normalizeText(renderReleaseMarkdown(release)));
  }
  return { count: releases.length, featureCount: releases.reduce((sum, release) => sum + release.features.length, 0), releases, outDir };
}

function normalizeReleases(releases) {
  return releases.map((release) => ({
    id: release.id,
    title: release.title || release.id,
    date: release.date || 'Pending',
    summary: release.summary || '',
    features: (release.features || []).map((feature) => ({
      id: feature.id,
      type: feature.type || 'feature',
      name: feature.name,
      audience: feature.audience || 'Users',
      summary: feature.summary || '',
      evidence: feature.evidence || [],
      links: feature.links || []
    }))
  }));
}

function renderReleaseIndex(releases) {
  const cards = releases.map((release) => `
      <a class="tile" href="${escapeHtml(release.id)}.html">
        <strong>${escapeHtml(release.title)}</strong>
        <span>${escapeHtml(release.summary)}</span>
      </a>`).join('');
  return page('Release Notes', `
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
      <h1>Release Notes</h1>
      <p>Generated release-note pages and GitHub-ready Markdown drafts from structured feature metadata.</p>
    </section>
    <section class="layout">${cards}</section>
  `);
}

function renderReleasePage(release) {
  const featureCards = release.features.map((feature) => `
      <article class="feature">
        <small>${escapeHtml(feature.type)}</small>
        <h2>${escapeHtml(feature.name)}</h2>
        <p>${escapeHtml(feature.summary)}</p>
        <div class="meta"><strong>Audience</strong><span>${escapeHtml(feature.audience)}</span></div>
        <h3>Evidence</h3>
        <ul>${feature.evidence.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</ul>
        ${renderLinks(feature.links)}
      </article>`).join('');

  return page(`${release.title} Release Notes`, `
    <nav class="site-nav">
      <a href="../index.html">Home</a>
      <a href="../quickstart.html">Quickstart</a>
      <a href="../migration-hub/spring-boot-2-to-3.html">Migration Hub</a>
      <a href="../benchmarks/index.html">Benchmarks</a>
      <a href="../packs/index.html">Packs</a>
      <a href="index.html">Release Notes</a>
      <a href="../editions.html">Editions</a>
      <a href="../contact.html">Contact</a>
    </nav>
    <section>
      <h1>${escapeHtml(release.title)}</h1>
      <p>${escapeHtml(release.summary)}</p>
    </section>
    <section class="summary">
      <div><strong>Date</strong><span>${escapeHtml(release.date)}</span></div>
      <div><strong>Features</strong><span>${release.features.length}</span></div>
      <div><strong>Draft</strong><span><a href="${escapeHtml(release.id)}.md">Markdown</a></span></div>
    </section>
    <section class="features">${featureCards}</section>
  `);
}

function renderReleaseMarkdown(release) {
  const features = release.features.map((feature) => {
    const evidence = feature.evidence.map((item) => `- ${item}`).join('\n');
    const links = feature.links.length
      ? `\n\nLinks:\n${feature.links.map((link) => `- [${link.label}](${link.href})`).join('\n')}\n`
      : '';
    return `## ${feature.name}\n\n${feature.summary}\n\nAudience: ${feature.audience}\n\n${evidence}${links}`;
  }).join('\n');

  return `# ${release.title}\n\n${release.summary}\n\n${features}\n`;
}

function renderLinks(links) {
  if (!links.length) return '';
  return `<h3>Links</h3><div class="actions">${links.map((link) => `<a href="../${escapeHtml(link.href.replace(/^docs\//, ''))}">${escapeHtml(link.label)}</a>`).join('')}</div>`;
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
    h2 { margin:0 0 8px; font-size:21px; letter-spacing:0; }
    h3 { margin:16px 0 8px; font-size:15px; letter-spacing:0; }
    p { max-width:760px; color:var(--muted); }
    a { color:var(--accent); text-decoration:none; }
    a:hover { text-decoration:underline; }
    .site-nav { display:flex; flex-wrap:wrap; gap:10px 14px; align-items:center; margin:0 0 28px; padding-bottom:16px; border-bottom:1px solid var(--line); }
    .site-nav a { color:var(--muted); font-size:14px; }
    .site-nav a:first-child { color:var(--ink); font-weight:700; }
    .layout { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:14px; margin:24px 0; }
    .tile { display:flex; flex-direction:column; gap:6px; min-height:128px; padding:18px; background:var(--panel); border:1px solid var(--line); border-radius:8px; color:var(--ink); }
    .tile span { color:var(--muted); }
    .summary { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:12px; margin:24px 0; }
    .summary div,.feature { padding:16px; background:var(--panel); border:1px solid var(--line); border-radius:8px; }
    .summary div { display:flex; flex-direction:column; gap:5px; }
    .summary span,.meta span,small { color:var(--muted); }
    .features { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:14px; }
    .feature small { display:block; margin-bottom:8px; text-transform:uppercase; font-size:12px; }
    .meta { display:flex; gap:8px; margin:12px 0; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; }
    .actions a { display:inline-flex; align-items:center; min-height:36px; padding:7px 11px; background:#f8fafc; border:1px solid var(--line); border-radius:6px; }
    li { margin:6px 0; }
    code { font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
    @media (max-width: 760px) { main { padding:24px 16px; } .layout,.summary,.features { grid-template-columns:1fr; } h1 { font-size:27px; } }
  </style>
</head>
<body><main>${body}</main></body>
</html>
`;
}

function renderInlineMarkdown(value) {
  return escapeHtml(value).replace(/`([^`]+)`/g, '<code>$1</code>');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeText(text) {
  return `${text.replace(/[ \t]+$/gm, '').trimEnd()}\n`;
}
