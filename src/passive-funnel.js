import fs from 'node:fs/promises';
import path from 'node:path';

const RELEASE_VERSION = 'v0.5.6';
const DOCKER_IMAGE = `danielrna/enterprise-modernization-platform:${RELEASE_VERSION}`;
const GITHUB_ACTION = `danielrna/enterprise-modernization-platform@${RELEASE_VERSION}`;
const BASE_URL = 'https://danielrna.github.io/enterprise-modernization-platform';

const PAGES = [
  {
    slug: 'spring-boot-3-readiness',
    title: 'Spring Boot 3 Readiness Check',
    description: 'Run a static Spring Boot 2 to 3 readiness report with Docker or GitHub Actions before migration execution.',
    h1: 'Spring Boot 3 readiness check',
    intro: 'Use this page when a Spring Boot 2.x application needs evidence before the mandatory move to Spring Boot 3.x.',
    pack: 'spring-boot-3-readiness',
    commandOut: 'reports/spring-boot-3-readiness',
    useWhen: 'Spring Boot 2.x to 3.x planning, Jakarta risk discovery, and migration readiness scoring.',
    signals: [
      'Spring Boot version and build metadata detection',
      'javax to jakarta namespace risk',
      'Static source findings and prioritized next actions',
      'Shareable HTML and JSON reports'
    ],
    proofLinks: [
      ['Validated Spring Guide report', 'benchmarks/gs-spring-boot-27/index.html'],
      ['Spring Boot evidence hub', 'migration-hub/spring-boot-3-readiness.html'],
      ['External trial proof', 'external-trial.html']
    ]
  },
  {
    slug: 'java-21-readiness',
    title: 'Java 21 Readiness Check',
    description: 'Generate Java 17 to 21 readiness evidence for mandatory LTS runtime planning.',
    h1: 'Java 21 readiness check',
    intro: 'Use this page when a Java service needs runtime upgrade planning before moving from Java 17 to Java 21.',
    pack: 'java-17-to-21-readiness',
    commandOut: 'reports/java-21-readiness',
    useWhen: 'Java LTS migration planning, runtime metadata review, and client-owned Java modernization rules.',
    signals: [
      'Detected Java version and build tool metadata',
      'Java LTS target planning',
      'Enterprise rule violations from .preflight-rules.yml',
      'Static evidence for readiness review before validation'
    ],
    proofLinks: [
      ['Java pack documentation', 'packs/java-17-to-21-readiness.html'],
      ['Benchmark index', 'benchmarks/index.html'],
      ['Quickstart', 'quickstart.html']
    ]
  },
  {
    slug: 'jakarta-migration-readiness',
    title: 'Jakarta Migration Readiness Check',
    description: 'Find javax to jakarta migration scope and produce static readiness evidence.',
    h1: 'Jakarta migration readiness check',
    intro: 'Use this page when Java EE namespace usage needs to be scoped before Spring Boot 3, Hibernate 6, or Jakarta EE migration work.',
    pack: 'jakarta-readiness',
    commandOut: 'reports/jakarta-readiness',
    useWhen: 'javax package cleanup, Jakarta namespace migration planning, and API compatibility review.',
    signals: [
      'javax package findings',
      'Jakarta migration risk categories',
      'Pack applicability and readiness scoring',
      'HTML and JSON evidence for migration planning'
    ],
    proofLinks: [
      ['Jakarta evidence hub', 'migration-hub/jakarta-readiness.html'],
      ['Jakarta pack documentation', 'packs/jakarta-readiness.html'],
      ['Outreach packet examples', 'outreach-packet.html']
    ]
  },
  {
    slug: 'hibernate-6-readiness',
    title: 'Hibernate 6 Readiness Check',
    description: 'Assess Hibernate 5 to 6 modernization risk with static readiness reports and benchmark evidence.',
    h1: 'Hibernate 6 readiness check',
    intro: 'Use this page when a persistence layer needs Hibernate 5.x to 6.x migration evidence before implementation starts.',
    pack: 'hibernate-readiness',
    commandOut: 'reports/hibernate-6-readiness',
    useWhen: 'Hibernate 5.x to 6.x planning, persistence risk review, and validation-scoped consultant work.',
    signals: [
      'Hibernate usage detection',
      'ORM upgrade-risk findings',
      'Validation failure-pattern guidance',
      'Checkout-backed benchmark references'
    ],
    proofLinks: [
      ['Hibernate evidence hub', 'migration-hub/hibernate-readiness.html'],
      ['Hibernate validation failure guide', 'knowledge-base/hibernate-validation-failures.html'],
      ['Consultant demo', 'consultant-demo.html']
    ]
  }
];

const CHANNELS = [
  {
    slug: 'github-action',
    title: 'EMP GitHub Action',
    description: 'Copy a GitHub Actions workflow that runs EMP readiness analysis and uploads static report artifacts.',
    h1: 'GitHub Action readiness report',
    intro: 'Use the GitHub Action when the passive path should work inside a repository without installing Node.js or running a hosted service.',
    body: renderGitHubActionPage
  },
  {
    slug: 'docker',
    title: 'EMP Docker Readiness Reports',
    description: 'Run EMP from Docker and generate static HTML and JSON modernization readiness reports.',
    h1: 'Docker readiness report',
    intro: 'Use Docker when the target repository is local and the first run should not require a Node.js install.',
    body: renderDockerPage
  },
  {
    slug: 'examples',
    title: 'EMP Readiness Examples',
    description: 'Review public benchmark and external-trial examples before running EMP on a repository.',
    h1: 'Readiness report examples',
    intro: 'Use these examples to understand good, partial, failed, timeout, and not-applicable evidence before running a new repository.',
    body: renderExamplesPage
  },
  {
    slug: 'consultants',
    title: 'EMP for Java Consultants',
    description: 'Turn mandatory Java modernization work into static readiness evidence and paid validation follow-up.',
    h1: 'Modernization evidence for Java consultants',
    intro: 'Use EMP to create passive client-facing proof: run a report, share the artifact, and let the evidence explain the next paid step.',
    body: renderConsultantsPage
  }
];

export async function generatePassiveFunnel({ outDir = 'docs' } = {}) {
  await fs.mkdir(outDir, { recursive: true });
  const written = [];
  for (const pageDef of PAGES) {
    const file = path.join(outDir, `${pageDef.slug}.html`);
    await fs.writeFile(file, normalizeHtml(renderPackLanding(pageDef)));
    written.push(file);
  }
  for (const pageDef of CHANNELS) {
    const file = path.join(outDir, `${pageDef.slug}.html`);
    await fs.writeFile(file, normalizeHtml(renderChannelLanding(pageDef)));
    written.push(file);
  }
  const sitemapFile = path.join(outDir, 'sitemap.xml');
  const robotsFile = path.join(outDir, 'robots.txt');
  await fs.writeFile(sitemapFile, renderSitemap());
  await fs.writeFile(robotsFile, renderRobots());
  written.push(sitemapFile, robotsFile);
  return { count: written.length, files: written };
}

function renderPackLanding(pageDef) {
  return page(pageDef, `
    ${nav()}
    <section class="hero">
      <div>
        <h1>${escapeHtml(pageDef.h1)}</h1>
        <p>${escapeHtml(pageDef.intro)}</p>
        <div class="actions">
          <a class="primary" href="#run">Run with Docker</a>
          <a href="#github-action">Use GitHub Action</a>
          <a href="${escapeHtml(pageDef.proofLinks[0][1])}">Review proof</a>
        </div>
      </div>
      ${proofBox()}
    </section>

    <h2>Use When</h2>
    <p>${escapeHtml(pageDef.useWhen)}</p>

    <h2>Readiness Signals</h2>
    <section class="grid">${pageDef.signals.map((signal) => `<div><strong>${escapeHtml(signal)}</strong><span>Included in the generated report evidence.</span></div>`).join('')}</section>

    <h2 id="run">Run With Docker</h2>
    <pre><code>docker run --rm -v "$PWD:/workspace" ${DOCKER_IMAGE} analyze . --pack ${escapeHtml(pageDef.pack)} --out ${escapeHtml(pageDef.commandOut)}</code></pre>
    <p>Open <code>${escapeHtml(pageDef.commandOut)}/index.html</code>. The same folder contains <code>report.json</code> for automation, agents, and later comparison.</p>

    <h2 id="github-action">Run In GitHub Actions</h2>
    ${workflowBlock(pageDef.pack)}

    <h2>Proof To Review</h2>
    <section class="links">${pageDef.proofLinks.map(([label, href]) => `<a href="${escapeHtml(href)}"><strong>${escapeHtml(label)}</strong><span>Open static evidence for this path.</span></a>`).join('')}</section>

    <h2>What This Does Not Require</h2>
    <section class="grid">
      <div><strong>No hosted backend</strong><span>The output is static HTML and JSON.</span></div>
      <div><strong>No account</strong><span>The Community path runs from Docker or source checkout.</span></div>
      <div><strong>No custom parser</strong><span>The product orchestrates proven modernization signals and engines.</span></div>
      <div><strong>No dashboard</strong><span>The report is the primary product surface.</span></div>
    </section>

    <h2>FAQ</h2>
    ${faqBlock(pageDef.pack)}
  `);
}

function renderChannelLanding(pageDef) {
  return page(pageDef, `
    ${nav()}
    <section class="hero">
      <div>
        <h1>${escapeHtml(pageDef.h1)}</h1>
        <p>${escapeHtml(pageDef.intro)}</p>
      </div>
      ${proofBox()}
    </section>
    ${pageDef.body()}
  `);
}

function renderGitHubActionPage() {
  return `
    <h2>Copy This Workflow</h2>
    ${workflowBlock('spring-boot-3-readiness')}
    <h2>Choose A Pack</h2>
    ${packTable()}
    <h2>Expected Artifact</h2>
    <section class="grid">
      <div><strong>index.html</strong><span>Static report for review and client sharing.</span></div>
      <div><strong>report.json</strong><span>Machine-readable evidence for CI and AI clients.</span></div>
      <div><strong>Passed run</strong><span>Means the report was generated successfully.</span></div>
      <div><strong>Low score</strong><span>Means migration risk was found, not that the workflow failed.</span></div>
    </section>
  `;
}

function renderDockerPage() {
  return `
    <h2>Local Repository</h2>
    <pre><code>cd /path/to/java-app
docker run --rm -v "$PWD:/workspace" ${DOCKER_IMAGE} analyze . --pack spring-boot-3-readiness --out reports/emp-readiness</code></pre>
    <h2>Transformation Dry Run</h2>
    <pre><code>docker run --rm -v "$PWD:/workspace" ${DOCKER_IMAGE} transform . --pack spring-boot-3-readiness --mode dry-run --validate --out reports/emp-transform</code></pre>
    <h2>Choose A Pack</h2>
    ${packTable()}
    <h2>First-Run Checks</h2>
    <section class="grid">
      <div><strong>Run from app root</strong><span>Multi-sample repositories often need a subdirectory.</span></div>
      <div><strong>Read not-applicable results</strong><span>They prevent claiming a score for the wrong migration.</span></div>
      <div><strong>Keep artifacts</strong><span>Reports are the passive conversion asset.</span></div>
      <div><strong>Escalate to validation</strong><span>Use transform dry-run when compile/test evidence is required.</span></div>
    </section>
  `;
}

function renderExamplesPage() {
  return `
    <h2>Start With Known Evidence</h2>
    <section class="links">
      <a href="benchmarks/gs-spring-boot-27/index.html"><strong>Passing Spring Boot report</strong><span>Checkout-backed Spring Boot 2.7 evidence.</span></a>
      <a href="external-trials/mertakdut-spring-boot-sample-project/index.html"><strong>Low-readiness external trial</strong><span>Shows cleanup and paid follow-up scope.</span></a>
      <a href="external-trials/geekidea-spring-boot-assembly/index.html"><strong>Jakarta/runtime planning trial</strong><span>Shows older Spring Boot and Java signals.</span></a>
      <a href="external-trials/bezkoder-spring-boot-jpa-postgresql/index.html"><strong>Not-applicable trial</strong><span>Shows pack-selection evidence for an already-upgraded app.</span></a>
      <a href="benchmarks/hibernate-helloworld/index.html"><strong>Partial validation report</strong><span>Compile/test evidence exposes a dependency gap.</span></a>
      <a href="benchmarks/index.html"><strong>All benchmark reports</strong><span>75 public checkout-backed reports.</span></a>
    </section>
    <h2>Read Evidence Honestly</h2>
    <section class="grid">
      <div><strong>Passed</strong><span>Compile or tests completed in the validation environment.</span></div>
      <div><strong>Failed</strong><span>The exact failure is useful migration scope evidence.</span></div>
      <div><strong>Timeout</strong><span>Heavy builds need module narrowing or a larger validation budget.</span></div>
      <div><strong>Not applicable</strong><span>The selected pack should not claim a score for that repository.</span></div>
    </section>
  `;
}

function renderConsultantsPage() {
  return `
    <h2>Passive Consultant Flow</h2>
    <section class="steps">
      <div><strong>1. Publish the runnable path</strong><span>Link to Docker or GitHub Action instructions instead of asking for a call.</span></div>
      <div><strong>2. Let evidence qualify the lead</strong><span>The report reveals readiness, applicability, findings, and next actions.</span></div>
      <div><strong>3. Sell validation</strong><span>Paid work starts when the client needs compile/test confidence or remediation.</span></div>
      <div><strong>4. Reuse the artifact</strong><span>The same static report works for engineers, managers, and consultants.</span></div>
    </section>
    <h2>Client-Facing Links</h2>
    <section class="links">
      <a href="quickstart.html"><strong>Quickstart</strong><span>First run without a meeting.</span></a>
      <a href="spring-boot-3-readiness.html"><strong>Spring Boot 3 readiness</strong><span>Most direct mandatory-upgrade page.</span></a>
      <a href="examples.html"><strong>Examples</strong><span>Show report outcomes before asking for a trial.</span></a>
      <a href="consultant-demo.html"><strong>Consultant demo</strong><span>Evidence walkthrough and bundle.</span></a>
      <a href="editions.html"><strong>Editions</strong><span>Community, Professional, Consultant, and Organization paths.</span></a>
      <a href="contact.html"><strong>Access request</strong><span>Static email path for paid use.</span></a>
    </section>
    <h2>Commercial Next Steps</h2>
    <section class="grid">
      <div><strong>Readiness cleanup</strong><span>Fix high-risk findings before migration execution.</span></div>
      <div><strong>Jakarta scope</strong><span>Separate mechanical namespace work from deeper framework risk.</span></div>
      <div><strong>Validation proof</strong><span>Run dry-run transformation with compile and test evidence.</span></div>
      <div><strong>Pack selection</strong><span>Choose the right mandatory modernization path.</span></div>
    </section>
  `;
}

function packTable() {
  const packs = [
    ['Spring Boot 2 to 3', 'spring-boot-3-readiness', 'spring-boot-3-readiness.html', 'Spring Boot 3 readiness'],
    ['Java 17 to 21', 'java-17-to-21-readiness', 'java-21-readiness.html', 'Java 21 readiness'],
    ['javax to jakarta', 'jakarta-readiness', 'jakarta-migration-readiness.html', 'Jakarta migration readiness'],
    ['Hibernate 5 to 6', 'hibernate-readiness', 'hibernate-6-readiness.html', 'Hibernate 6 readiness'],
    ['Spring Security 5 to 6', 'spring-security-6-readiness', 'packs/spring-security-6-readiness.html', 'Spring Security pack'],
    ['JUnit 4 to 5', 'junit-5-readiness', 'packs/junit-5-readiness.html', 'JUnit pack']
  ];
  return `<section class="pack-grid">${packs.map(([need, pack, href, label]) => `
    <a href="${escapeHtml(href)}">
      <strong>${escapeHtml(need)}</strong>
      <code>${escapeHtml(pack)}</code>
      <span>${escapeHtml(label)}</span>
    </a>`).join('')}
  </section>`;
}

function workflowBlock(pack) {
  return `<pre><code>name: EMP Readiness

on:
  workflow_dispatch:
  pull_request:

jobs:
  readiness:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run EMP readiness
        uses: ${GITHUB_ACTION}
        with:
          path: .
          pack: ${escapeHtml(pack)}
          out: emp-report

      - name: Upload EMP report
        uses: actions/upload-artifact@v4
        with:
          name: emp-readiness-report
          path: emp-report</code></pre>`;
}

function faqBlock(pack) {
  return `<div class="faq">
    <details open><summary>Does this apply code changes?</summary><p>No. The readiness command measures migration risk and writes static evidence. Use transform dry-run separately when you need change planning and validation evidence.</p></details>
    <details><summary>What files should I share?</summary><p>Share <code>index.html</code> for human review and <code>report.json</code> for CI, automation, or AI clients.</p></details>
    <details><summary>What if the report is not applicable?</summary><p>Check that the command ran from the actual application directory, then choose a more relevant pack. The selected pack here is <code>${escapeHtml(pack)}</code>.</p></details>
    <details><summary>Does it require a server?</summary><p>No. Docker, GitHub Actions, static HTML, and JSON are enough for the first passive trial.</p></details>
  </div>`;
}

function proofBox() {
  return `<aside class="proof" aria-label="Published evidence">
    <div><span>Public reports</span><strong>75</strong></div>
    <div><span>Checkout-backed</span><strong>75</strong></div>
    <div><span>Passing validation</span><strong>17</strong></div>
    <div><span>Backend required</span><strong>0</strong></div>
  </aside>`;
}

function nav() {
  return `<nav class="site-nav">
    <a href="index.html">Home</a>
    <a href="quickstart.html">Quickstart</a>
    <a href="docker.html">Docker</a>
    <a href="github-action.html">GitHub Action</a>
    <a href="examples.html">Examples</a>
    <a href="consultants.html">Consultants</a>
    <a href="benchmarks/index.html">Benchmarks</a>
    <a href="packs/index.html">Packs</a>
    <a href="release-notes/index.html">Release Notes</a>
  </nav>`;
}

function page(pageDef, body) {
  const canonical = `${BASE_URL}/${pageDef.slug}.html`;
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${BASE_URL}/#website`,
        name: 'Enterprise Modernization Platform',
        url: `${BASE_URL}/`
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${BASE_URL}/#software`,
        name: 'Enterprise Modernization Platform',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Docker, GitHub Actions, Node.js',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'CHF' },
        url: `${BASE_URL}/`
      },
      {
        '@type': 'WebPage',
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: pageDef.title,
        description: pageDef.description,
        isPartOf: { '@id': `${BASE_URL}/#website` },
        about: { '@id': `${BASE_URL}/#software` }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}/` },
          { '@type': 'ListItem', position: 2, name: pageDef.title, item: canonical }
        ]
      }
    ]
  }).replaceAll('<', '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(pageDef.title)}</title>
  <meta name="description" content="${escapeHtml(pageDef.description)}">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Enterprise Modernization Platform">
  <meta property="og:title" content="${escapeHtml(pageDef.title)}">
  <meta property="og:description" content="${escapeHtml(pageDef.description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(pageDef.title)}">
  <meta name="twitter:description" content="${escapeHtml(pageDef.description)}">
  <script type="application/ld+json">${structuredData}</script>
  <style>
    :root { --ink:#17202a; --muted:#64748b; --line:#d8dee8; --bg:#f7f9fb; --panel:#fff; --accent:#1769aa; --accent-dark:#0f4f84; --ok:#217a45; }
    * { box-sizing:border-box; }
    body { margin:0; font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color:var(--ink); background:var(--bg); }
    main { max-width:1120px; margin:0 auto; padding:32px 24px; }
    h1 { margin:0 0 10px; font-size:42px; line-height:1.08; letter-spacing:0; }
    h2 { margin:30px 0 12px; font-size:21px; letter-spacing:0; }
    p { max-width:780px; color:var(--muted); }
    a { color:var(--accent); text-decoration:none; }
    a:hover { text-decoration:underline; }
    code { font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
    pre { overflow:auto; white-space:pre-wrap; padding:14px; background:#102033; color:#eef6fd; border-radius:8px; }
    .site-nav { display:flex; flex-wrap:wrap; gap:10px 14px; align-items:center; margin:0 0 34px; padding-bottom:16px; border-bottom:1px solid var(--line); }
    .site-nav a { color:var(--muted); font-size:14px; }
    .site-nav a:first-child { color:var(--ink); font-weight:700; }
    .hero { display:grid; grid-template-columns:minmax(0,1fr) 300px; gap:26px; align-items:start; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:20px; }
    .actions a { display:inline-flex; align-items:center; min-height:42px; padding:9px 13px; background:var(--panel); border:1px solid var(--line); border-radius:6px; }
    .actions a.primary { background:var(--accent); color:#fff; border-color:var(--accent-dark); font-weight:700; }
    .proof { display:flex; flex-direction:column; gap:0; padding:16px; background:var(--panel); border:1px solid var(--line); border-left:4px solid var(--ok); border-radius:8px; }
    .proof div { display:flex; justify-content:space-between; gap:14px; padding:9px 0; border-bottom:1px solid var(--line); }
    .proof div:last-child { border-bottom:0; }
    .proof span,.grid span,.links span,.steps span { color:var(--muted); }
    .proof strong { font-size:22px; }
    .grid,.links,.steps,.pack-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin:18px 0; }
    .steps { grid-template-columns:repeat(4,minmax(0,1fr)); }
    .grid div,.links a,.steps div,.pack-grid a { display:flex; flex-direction:column; gap:6px; min-height:112px; padding:16px; background:var(--panel); border:1px solid var(--line); border-radius:8px; color:var(--ink); }
    .pack-grid code { overflow-wrap:anywhere; color:var(--accent-dark); }
    .faq { display:grid; gap:10px; max-width:840px; }
    details { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:12px 14px; }
    summary { cursor:pointer; font-weight:700; }
    details p { margin:8px 0 0; }
    table { width:100%; border-collapse:collapse; background:var(--panel); border:1px solid var(--line); border-radius:8px; overflow:hidden; }
    th,td { text-align:left; padding:10px 12px; border-bottom:1px solid var(--line); vertical-align:top; }
    th { font-size:12px; color:var(--muted); text-transform:uppercase; }
    .table-scroll { overflow:auto; }
    @media (max-width: 860px) { main { padding:24px 16px; } .hero,.grid,.links,.steps,.pack-grid { grid-template-columns:1fr; } h1 { font-size:31px; } table { min-width:720px; } }
  </style>
</head>
<body><main>${body}</main></body>
</html>`;
}

function renderSitemap() {
  const pages = [
    '',
    'quickstart.html',
    'spring-boot-3-readiness.html',
    'java-21-readiness.html',
    'jakarta-migration-readiness.html',
    'hibernate-6-readiness.html',
    'docker.html',
    'github-action.html',
    'examples.html',
    'consultants.html',
    'external-trial.html',
    'outreach-packet.html',
    'consultant-demo.html',
    'benchmarks/index.html',
    'packs/index.html',
    'migration-hub/index.html',
    'knowledge-base/index.html',
    'release-notes/index.html'
  ];
  const urls = pages.map((pagePath) => {
    const loc = pagePath ? `${BASE_URL}/${pagePath}` : `${BASE_URL}/`;
    const priority = pagePath === '' ? '1.0' : pagePath.includes('readiness') || pagePath === 'github-action.html' || pagePath === 'docker.html' ? '0.9' : '0.7';
    return `  <url><loc>${escapeHtml(loc)}</loc><changefreq>weekly</changefreq><priority>${priority}</priority></url>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function renderRobots() {
  return `User-agent: *\nAllow: /\nSitemap: ${BASE_URL}/sitemap.xml\n`;
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
