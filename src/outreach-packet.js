import fs from 'node:fs/promises';
import path from 'node:path';

const TRIALS_DIR = 'docs/external-trials';

const BRANCHES = [
  {
    id: 'readiness-cleanup',
    title: 'Readiness Cleanup',
    offer: 'I can turn a low readiness score into a concrete cleanup plan before migration execution.',
    matcher: (trial) => trial.overall !== null && trial.overall < 70
  },
  {
    id: 'jakarta-scope',
    title: 'Jakarta Migration Scope',
    offer: 'I can scope the javax to Jakarta work and separate mechanical namespace cleanup from real migration risk.',
    matcher: (trial) => trial.actions.some((action) => /Jakarta|javax/i.test(action))
  },
  {
    id: 'validation-proof',
    title: 'Validation And Dry-Run Proof',
    offer: 'I can run dry-run transformation and validation evidence before anyone commits to a migration sprint.',
    matcher: (trial) => trial.overall !== null && trial.overall >= 70
  },
  {
    id: 'pack-selection',
    title: 'Pack Selection Help',
    offer: 'I can help choose the right modernization pack instead of forcing a misleading Spring Boot 2 to 3 score.',
    matcher: (trial) => trial.overall === null
  }
];

export async function generateOutreachPacket({
  trialsDir = TRIALS_DIR,
  outFile = 'docs/outreach-packet.html'
} = {}) {
  const trials = await loadTrials(trialsDir);
  const branches = BRANCHES.map((branch) => ({
    ...branch,
    trials: trials.filter(branch.matcher)
  }));
  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, normalizeHtml(renderOutreachPacket({ trials, branches })));
  return { outFile, trialCount: trials.length, branchCount: branches.length };
}

async function loadTrials(trialsDir) {
  const entries = await fs.readdir(trialsDir, { withFileTypes: true }).catch(() => []);
  const trials = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const report = await readJson(path.join(trialsDir, entry.name, 'report.json'));
    if (!report) continue;
    trials.push(normalizeTrial(entry.name, report));
  }
  return trials.sort((left, right) => {
    if (left.overall === null && right.overall !== null) return 1;
    if (left.overall !== null && right.overall === null) return -1;
    return (left.overall ?? 0) - (right.overall ?? 0);
  });
}

function normalizeTrial(slug, report) {
  const repository = repositoryName(slug);
  return {
    slug,
    repository,
    reportHref: `external-trials/${slug}/index.html`,
    jsonHref: `external-trials/${slug}/report.json`,
    overall: report.readiness?.overall ?? null,
    springBootVersion: report.project?.springBootVersion || 'unknown',
    javaVersion: report.project?.javaVersion || 'unknown',
    findings: report.findings?.length || 0,
    critical: report.readiness?.counts?.critical || 0,
    warning: report.readiness?.counts?.warning || 0,
    actions: (report.nextActions || []).map((action) => action.title).slice(0, 3)
  };
}

function repositoryName(slug) {
  const known = {
    'bezkoder-spring-boot-data-jpa-mysql': 'bezkoder/spring-boot-data-jpa-mysql',
    'bezkoder-spring-boot-jpa-postgresql': 'bezkoder/spring-boot-jpa-postgresql',
    'callicoder-spring-boot-mysql-rest-api': 'callicoder/spring-boot-mysql-rest-api-tutorial',
    'dsyer-spring-boot-angular': 'dsyer/spring-boot-angular',
    'geekidea-spring-boot-assembly': 'geekidea/spring-boot-assembly',
    'gs-accessing-data-jpa': 'spring-guides/gs-accessing-data-jpa',
    'mertakdut-spring-boot-sample-project': 'mertakdut/Spring-Boot-Sample-Project',
    'rameshmf-thymeleaf-crud': 'RameshMF/springboot-thymeleaf-crud-pagination-sorting-webapp',
    'shekhargulati-spring-boot-maven-angular-starter': 'shekhargulati/spring-boot-maven-angular-starter'
  };
  return known[slug] || slug;
}

function renderOutreachPacket({ trials, branches }) {
  return page('EMP Outreach Packet', `
    <nav class="site-nav">
      <a href="index.html">Home</a>
      <a href="quickstart.html">Quickstart</a>
      <a href="external-trial.html">External Trial</a>
      <a href="outreach-packet.html">Outreach Packet</a>
      <a href="consultant-demo.html">Consultant Demo</a>
      <a href="release-notes/index.html">Release Notes</a>
      <a href="contact.html">Contact</a>
    </nav>

    <section class="hero">
      <h1>Outreach Packet</h1>
      <p>Use these external-trial snapshots to start consultant conversations around paid modernization work. The goal is not more benchmark volume; it is learning which offer branch gets a reply.</p>
    </section>

    <section class="summary">
      <div><strong>${trials.length}</strong><span>External trial snapshots</span></div>
      <div><strong>${trials.filter((trial) => trial.overall !== null).length}</strong><span>Applicable reports</span></div>
      <div><strong>${trials.filter((trial) => trial.overall === null).length}</strong><span>Pack-selection cases</span></div>
      <div><strong>75</strong><span>Benchmarks unchanged</span></div>
    </section>

    <h2>Offer Branches</h2>
    <section class="branch-grid">${branches.map(renderBranch).join('')}</section>

    <h2>Copy And Send</h2>
    <section class="copy-grid">${branches.map(renderCopyBlock).join('')}</section>

    <h2>Trial Matrix</h2>
    <div class="table-scroll"><table>
      <thead><tr><th>Repository</th><th>Stack</th><th>Score</th><th>Top Actions</th><th>Evidence</th></tr></thead>
      <tbody>${trials.map(renderTrialRow).join('')}</tbody>
    </table></div>
  `);
}

function renderBranch(branch) {
  const links = branch.trials.slice(0, 4).map((trial) => `<a href="${escapeHtml(trial.reportHref)}">${escapeHtml(trial.repository)}</a>`).join('');
  return `
      <article class="branch">
        <small>${branch.trials.length} examples</small>
        <h3>${escapeHtml(branch.title)}</h3>
        <p>${escapeHtml(branch.offer)}</p>
        <div class="links">${links}</div>
      </article>`;
}

function renderCopyBlock(branch) {
  const example = branch.trials[0];
  const reportLine = example ? ` I have a public example here: ${example.repository}.` : '';
  return `
      <article class="copy">
        <h3>${escapeHtml(branch.title)}</h3>
        <pre><code>${escapeHtml(`Hi {{name}}, I am testing a no-backend readiness report for mandatory Java modernization. ${branch.offer}${reportLine}\n\nIf you send me one Spring Boot repository or migration scenario, I will return a static HTML/JSON readiness report and the first paid follow-up options.`)}</code></pre>
      </article>`;
}

function renderTrialRow(trial) {
  return `
        <tr>
          <td>${escapeHtml(trial.repository)}</td>
          <td>Spring Boot ${escapeHtml(trial.springBootVersion)}<br>Java ${escapeHtml(trial.javaVersion)}</td>
          <td>${trial.overall === null ? '<span class="pill warn">N/A</span>' : `<span class="pill ${trial.overall < 70 ? 'bad' : 'ok'}">${trial.overall}%</span>`}</td>
          <td>${trial.actions.map(escapeHtml).join('<br>') || 'No next action recorded'}</td>
          <td><a href="${escapeHtml(trial.reportHref)}">HTML</a> · <a href="${escapeHtml(trial.jsonHref)}">JSON</a></td>
        </tr>`;
}

function page(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { --ink:#17202a; --muted:#64748b; --line:#d8dee8; --bg:#f7f9fb; --panel:#fff; --accent:#1769aa; --ok:#217a45; --warn:#966600; --bad:#b42318; }
    * { box-sizing:border-box; }
    body { margin:0; font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color:var(--ink); background:var(--bg); }
    main { max-width:1120px; margin:0 auto; padding:32px 24px; }
    h1 { margin:0 0 10px; font-size:38px; line-height:1.12; letter-spacing:0; }
    h2 { margin:30px 0 12px; font-size:21px; letter-spacing:0; }
    h3 { margin:0 0 8px; font-size:18px; letter-spacing:0; }
    p { max-width:820px; color:var(--muted); }
    a { color:var(--accent); text-decoration:none; }
    a:hover { text-decoration:underline; }
    pre { overflow:auto; white-space:pre-wrap; padding:14px; background:#102033; color:#eef6fd; border-radius:8px; }
    code { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; }
    .site-nav { display:flex; flex-wrap:wrap; gap:10px 14px; align-items:center; margin:0 0 30px; padding-bottom:16px; border-bottom:1px solid var(--line); }
    .site-nav a { color:var(--muted); font-size:14px; }
    .site-nav a:first-child { color:var(--ink); font-weight:700; }
    .summary,.branch-grid,.copy-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin:22px 0; }
    .branch-grid,.copy-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
    .summary div,.branch,.copy { padding:16px; background:var(--panel); border:1px solid var(--line); border-radius:8px; }
    .summary strong { display:block; font-size:24px; }
    .summary span,.branch small { color:var(--muted); }
    .links { display:flex; flex-direction:column; gap:6px; margin-top:12px; }
    table { width:100%; border-collapse:collapse; background:var(--panel); border:1px solid var(--line); border-radius:8px; overflow:hidden; }
    th,td { text-align:left; padding:10px 12px; border-bottom:1px solid var(--line); vertical-align:top; }
    th { font-size:12px; color:var(--muted); text-transform:uppercase; }
    .pill { display:inline-flex; min-width:64px; justify-content:center; padding:2px 8px; border-radius:999px; font-size:12px; font-weight:700; background:#eef2f7; color:#344054; }
    .pill.ok { background:#e9f7ef; color:var(--ok); }
    .pill.warn { background:#fff8e6; color:var(--warn); }
    .pill.bad { background:#fff1f0; color:var(--bad); }
    @media (max-width: 820px) { main { padding:24px 16px; } .summary,.branch-grid,.copy-grid { grid-template-columns:1fr; } h1 { font-size:30px; } table { min-width:760px; } .table-scroll { overflow:auto; } }
  </style>
</head>
<body><main>${body}</main></body>
</html>`;
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return null;
  }
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
  return `${html.replace(/[ \t]+$/gm, '').trimEnd()}\n`;
}
