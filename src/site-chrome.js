export function renderSiteNav(prefix = '') {
  return `<nav class="site-nav" aria-label="Site navigation">
    <a class="site-brand" href="${prefix}index.html">EMP</a>
    ${navGroup('Run', [
      ['Quickstart', `${prefix}quickstart.html`],
      ['Docker', `${prefix}docker.html`],
      ['GitHub Action', `${prefix}github-action.html`]
    ])}
    ${navGroup('Readiness', [
      ['Spring Boot 3', `${prefix}spring-boot-3-readiness.html`],
      ['Java 21', `${prefix}java-21-readiness.html`],
      ['Jakarta', `${prefix}jakarta-migration-readiness.html`],
      ['Hibernate 6', `${prefix}hibernate-6-readiness.html`],
      ['All Packs', `${prefix}packs/index.html`]
    ])}
    ${navGroup('Proof', [
      ['Examples', `${prefix}examples.html`],
      ['Benchmarks', `${prefix}benchmarks/index.html`],
      ['Migration Hub', `${prefix}migration-hub/index.html`],
      ['External Trial', `${prefix}external-trial.html`]
    ])}
    ${navGroup('Resources', [
      ['Consultants', `${prefix}consultants.html`],
      ['Consultant Demo', `${prefix}consultant-demo.html`],
      ['Knowledge Base', `${prefix}knowledge-base/index.html`],
      ['MCP', `${prefix}mcp.html`],
      ['Release Notes', `${prefix}release-notes/index.html`]
    ])}
    ${navGroup('Access', [
      ['Editions', `${prefix}editions.html`],
      ['Contact', `${prefix}contact.html`]
    ])}
  </nav>`;
}

export function siteNavStyles() {
  return `
    .site-nav { position:relative; z-index:5; display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin:0 0 34px; padding-bottom:16px; border-bottom:1px solid var(--line); }
    .site-brand { display:inline-flex; align-items:center; min-height:36px; padding:0 10px; color:var(--ink); font-weight:800; letter-spacing:0; border:1px solid var(--line); border-radius:6px; background:var(--panel); }
    .site-menu { position:relative; }
    .site-menu summary { list-style:none; cursor:pointer; display:inline-flex; align-items:center; min-height:36px; padding:0 10px; color:var(--muted); border:1px solid transparent; border-radius:6px; user-select:none; }
    .site-menu summary::-webkit-details-marker { display:none; }
    .site-menu summary:after { content:""; width:6px; height:6px; margin-left:7px; border-right:1.5px solid currentColor; border-bottom:1.5px solid currentColor; transform:rotate(45deg) translateY(-2px); }
    .site-menu[open] summary { color:var(--ink); background:var(--panel); border-color:var(--line); }
    .site-menu div { position:absolute; top:42px; left:0; min-width:210px; display:grid; gap:4px; padding:8px; background:var(--panel); border:1px solid var(--line); border-radius:8px; box-shadow:0 18px 40px rgba(15,23,42,.12); }
    .site-menu:last-child div { left:auto; right:0; }
    .site-menu a { display:flex; align-items:center; min-height:34px; padding:7px 9px; color:var(--ink); border-radius:6px; white-space:nowrap; }
    .site-menu a:hover { text-decoration:none; background:#eef6fd; color:var(--accent); }
    @media (max-width: 760px) {
      .site-nav { gap:6px; margin-bottom:26px; }
      .site-brand,.site-menu summary { min-height:34px; padding:0 9px; font-size:14px; }
      .site-menu { position:static; }
      .site-menu div { left:16px; right:16px; top:auto; min-width:0; margin-top:4px; }
    }`;
}

function navGroup(label, links) {
  return `<details class="site-menu">
      <summary>${escapeHtml(label)}</summary>
      <div>${links.map(([text, href]) => `<a href="${escapeHtml(href)}">${escapeHtml(text)}</a>`).join('')}</div>
    </details>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
