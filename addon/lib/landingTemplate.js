const QUALITIES = [
  ['4k', '4K'],
  ['1080p', '1080p'],
  ['720p', '720p'],
  ['480p', '480p'],
  ['cam', 'CAM'],
];

const LANGUAGES = [
  ['en', 'English'],
  ['es', 'Spanish'],
  ['pt', 'Portuguese'],
  ['fr', 'French'],
  ['de', 'German'],
  ['it', 'Italian'],
  ['ru', 'Russian'],
  ['ja', 'Japanese'],
  ['ko', 'Korean'],
  ['zh', 'Chinese'],
  ['ar', 'Arabic'],
  ['tr', 'Turkish'],
  ['hi', 'Hindi'],
  ['el', 'Greek'],
  ['sq', 'Albanian'],
];

const DEBRID_FIELDS = [
  ['rd', 'Real-Debrid'],
  ['pm', 'Premiumize'],
  ['ad', 'AllDebrid'],
  ['dl', 'DebridLink'],
  ['ed', 'EasyDebrid'],
  ['oc', 'Offcloud'],
  ['tb', 'TorBox'],
  ['pu', 'Put.io'],
];

const SVG_SUN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
const SVG_MOON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
const SVG_EYE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const SVG_EYE_OFF = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export function landingTemplate(manifest, initialConfig = {}) {
  const initialState = escapeJsonForHtml({
    sort: initialConfig.sort ?? 'qualityseeders',
    limit: initialConfig.limit ?? 10,
    qualities: initialConfig.qualities ?? [],
    languages: initialConfig.languages ?? [],
    subtitleLanguages: initialConfig.subtitleLanguages ?? ['en'],
    prewarmDebrid: initialConfig.prewarmDebrid ?? true,
    prewarmLimit: initialConfig.prewarmLimit ?? 3,
    realDebridApiKey: initialConfig.realDebridApiKey ?? '',
    premiumizeApiKey: initialConfig.premiumizeApiKey ?? '',
    allDebridApiKey: initialConfig.allDebridApiKey ?? '',
    debridLinkApiKey: initialConfig.debridLinkApiKey ?? '',
    easyDebridApiKey: initialConfig.easyDebridApiKey ?? '',
    offcloudApiKey: initialConfig.offcloudApiKey ?? '',
    torboxApiKey: initialConfig.torboxApiKey ?? '',
    putioApiKey: initialConfig.putioApiKey ?? '',
  });

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(manifest.name)} Configure</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    [data-theme="dark"] {
      --bg: #0f1117;
      --surface: #1a1d27;
      --border: #2a2d3a;
      --text-primary: #e8eaed;
      --text-secondary: #9ca3af;
      --accent: #34d399;
      --accent-hover: #6ee7b7;
      --accent-subtle: rgba(52, 211, 153, 0.12);
      --input-bg: #141620;
      --chip-bg: #1e2130;
      --chip-bg-active: rgba(52, 211, 153, 0.18);
      --chip-border-active: #34d399;
      --code-bg: #0d0f15;
      --shadow: 0 1px 3px rgba(0,0,0,0.3);
      --footer-bg: #1a1d27;
    }

    [data-theme="light"] {
      --bg: #f8f9fb;
      --surface: #ffffff;
      --border: #e2e5eb;
      --text-primary: #111827;
      --text-secondary: #6b7280;
      --accent: #10b981;
      --accent-hover: #059669;
      --accent-subtle: rgba(16, 185, 129, 0.1);
      --input-bg: #f3f4f6;
      --chip-bg: #f3f4f6;
      --chip-bg-active: rgba(16, 185, 129, 0.12);
      --chip-border-active: #10b981;
      --code-bg: #f0f1f3;
      --shadow: 0 1px 3px rgba(0,0,0,0.08);
      --footer-bg: #ffffff;
    }

    * { box-sizing: border-box; margin: 0; }

    body {
      min-height: 100vh;
      color: var(--text-primary);
      background: var(--bg);
      font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
      padding: 32px 20px 48px;
      transition: background 0.2s, color 0.2s;
    }

    .shell {
      max-width: 1100px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 24px;
      align-items: start;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      box-shadow: var(--shadow);
      transition: background 0.2s, border-color 0.2s;
    }

    /* Header */
    .header {
      padding: 24px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-logo {
      width: 28px;
      height: 28px;
      border-radius: 6px;
    }

    .header-title {
      font-size: 1.1rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .version-badge {
      padding: 3px 10px;
      border-radius: 999px;
      background: var(--accent-subtle);
      color: var(--accent);
      font-size: 0.75rem;
      font-weight: 600;
    }

    .theme-toggle {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--input-bg);
      color: var(--text-secondary);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: border-color 0.2s;
    }

    .theme-toggle:hover {
      border-color: var(--accent);
      color: var(--accent);
    }

    /* Hero */
    .hero {
      padding: 0 28px 28px;
    }

    .hero h1 {
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1.3;
      margin-bottom: 8px;
    }

    .hero p {
      color: var(--text-secondary);
      font-size: 0.92rem;
      line-height: 1.6;
    }

    .stack { display: grid; gap: 20px; }

    /* Section cards */
    .section {
      padding: 24px 28px;
      display: grid;
      gap: 18px;
    }

    .section-title {
      font-size: 0.92rem;
      font-weight: 600;
      padding-left: 12px;
      border-left: 3px solid var(--accent);
    }

    .section-desc {
      color: var(--text-secondary);
      font-size: 0.88rem;
      line-height: 1.55;
    }

    .field-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    label {
      display: grid;
      gap: 6px;
      color: var(--text-secondary);
      font-size: 0.82rem;
      font-weight: 500;
    }

    select, input[type="number"] {
      width: 100%;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--input-bg);
      color: var(--text-primary);
      padding: 10px 12px;
      font: inherit;
      font-size: 0.88rem;
      outline: none;
      transition: border-color 0.15s;
    }

    select:focus, input:focus {
      border-color: var(--accent);
    }

    /* Chip grids */
    .chip-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .chip {
      cursor: pointer;
      display: inline-flex;
      font-size: 0.82rem;
      font-weight: 500;
    }

    .chip span {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 999px;
      background: var(--chip-bg);
      border: 1px solid var(--border);
      color: var(--text-secondary);
      transition: all 0.15s;
      user-select: none;
    }

    .chip:has(input:checked) span,
    .chip.selected span {
      background: var(--chip-bg-active);
      border-color: var(--chip-border-active);
      color: var(--accent);
    }

    .chip input { display: none; }

    /* Password fields */
    .password-wrap {
      position: relative;
    }

    .password-wrap input {
      width: 100%;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--input-bg);
      color: var(--text-primary);
      padding: 10px 40px 10px 12px;
      font: inherit;
      font-size: 0.88rem;
      outline: none;
      transition: border-color 0.15s;
    }

    .password-wrap input:focus {
      border-color: var(--accent);
    }

    .eye-toggle {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
    }

    .eye-toggle:hover { color: var(--accent); }

    /* Summary sidebar */
    .summary {
      position: sticky;
      top: 24px;
      padding: 24px;
      display: grid;
      gap: 18px;
    }

    .summary h2 {
      font-size: 1.1rem;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    .summary-desc {
      color: var(--text-secondary);
      font-size: 0.88rem;
      line-height: 1.55;
    }

    .preview {
      padding: 14px;
      border-radius: 12px;
      background: var(--code-bg);
      border: 1px solid var(--border);
    }

    .preview-label {
      color: var(--text-secondary);
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .preview-code {
      font-family: "JetBrains Mono", monospace;
      color: var(--accent);
      word-break: break-all;
      line-height: 1.6;
      font-size: 0.8rem;
    }

    .actions { display: grid; gap: 10px; }

    .btn {
      width: 100%;
      border: none;
      border-radius: 12px;
      padding: 12px 16px;
      font: inherit;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s;
    }

    .btn:hover { opacity: 0.88; }

    .btn-primary {
      color: #fff;
      background: var(--accent);
    }

    [data-theme="dark"] .btn-primary { color: #0f1117; }

    .btn-secondary {
      color: var(--text-primary);
      background: transparent;
      border: 1px solid var(--border);
    }

    .btn-secondary:hover {
      border-color: var(--accent);
    }

    .status {
      color: var(--accent);
      font-size: 0.84rem;
      min-height: 1.2rem;
    }

    .footnote {
      color: var(--text-secondary);
      font-size: 0.8rem;
      line-height: 1.5;
    }

    .footnote a { color: var(--accent); }

    /* Mobile footer */
    .mobile-footer {
      display: none;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: var(--footer-bg);
      border-top: 1px solid var(--border);
      padding: 12px 16px;
      z-index: 100;
    }

    .mobile-footer .footer-actions {
      display: flex;
      gap: 10px;
    }

    .mobile-footer .btn { flex: 1; padding: 11px 12px; font-size: 0.85rem; }

    .mobile-footer .footer-preview {
      margin-top: 8px;
      display: none;
    }

    .mobile-footer .footer-preview.open {
      display: block;
    }

    .mobile-footer .preview-toggle {
      background: none;
      border: none;
      color: var(--text-secondary);
      font-size: 0.78rem;
      cursor: pointer;
      padding: 6px 0 0;
      text-decoration: underline;
    }

    .mobile-footer .preview-code {
      font-family: "JetBrains Mono", monospace;
      color: var(--accent);
      word-break: break-all;
      font-size: 0.72rem;
      line-height: 1.5;
      margin-top: 6px;
    }

    @media (max-width: 980px) {
      .shell { grid-template-columns: 1fr; }
      .summary { position: static; display: none; }
      .mobile-footer { display: block; }
      body { padding-bottom: 90px; }
    }

    @media (max-width: 640px) {
      body { padding: 16px 12px 90px; }
      .header, .hero, .section { padding-left: 20px; padding-right: 20px; }
      .field-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <div class="stack">
      <div class="card">
        <div class="header">
          <div class="header-left">
            <img class="header-logo" src="${escapeHtml(manifest.logo)}" alt="" />
            <span class="header-title">${escapeHtml(manifest.name)}</span>
            <span class="version-badge">v${escapeHtml(manifest.version)}</span>
          </div>
          <button class="theme-toggle" id="themeToggle" type="button" title="Toggle theme">
            ${SVG_MOON}
          </button>
        </div>
        <div class="hero">
          <h1>Configure your addon</h1>
          <p>Tune stream ranking, subtitle preferences and debrid services. The result is a manifest URL ready to install in Stremio.</p>
        </div>
      </div>

      <section class="card section">
        <h2 class="section-title">Stream Rules</h2>
        <div class="field-grid">
          <label>
            Sort order
            <select id="sort">
              <option value="qualityseeders">Quality then seeders</option>
              <option value="qualitysize">Quality then size</option>
              <option value="seeders">Seeders only</option>
              <option value="size">Size only</option>
            </select>
          </label>
          <label>
            Max streams
            <select id="limit">
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
          </label>
        </div>

        <label>
          Allowed qualities
          <div class="chip-grid" id="qualities">
            ${QUALITIES.map(([value, label]) => `<label class="chip"><input type="checkbox" value="${value}" /><span>${label}</span></label>`).join('')}
          </div>
        </label>

        <label>
          Audio languages
          <div class="chip-grid" id="languages">
            ${LANGUAGES.map(([value, label]) => `<label class="chip"><input type="checkbox" value="${value}" /><span>${label}</span></label>`).join('')}
          </div>
        </label>
      </section>

      <section class="card section">
        <h2 class="section-title">Subtitles</h2>
        <p class="section-desc">Select every subtitle language you want returned. Magnetio provides a dedicated Stremio subtitles resource.</p>
        <label>
          Subtitle languages
          <div class="chip-grid" id="subtitleLanguages">
            ${LANGUAGES.map(([value, label]) => `<label class="chip"><input type="checkbox" value="${value}" /><span>${label}</span></label>`).join('')}
          </div>
        </label>
      </section>

      <section class="card section">
        <h2 class="section-title">Debrid Services</h2>
        <p class="section-desc">Add API keys for your debrid services. Cached torrents resolve as direct streams automatically.</p>
        <div class="field-grid">
          <label>
            Debrid prewarm
            <select id="prewarm">
              <option value="1">Enabled</option>
              <option value="0">Disabled</option>
            </select>
          </label>
          <label>
            Prewarm top uncached
            <select id="prewarmLimit">
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="5">5</option>
            </select>
          </label>
        </div>
        <div class="field-grid">
          ${DEBRID_FIELDS.map(([id, label]) => `
            <label>
              ${label}
              <div class="password-wrap">
                <input type="password" id="${id}" autocomplete="off" placeholder="${label} API key" />
                <button type="button" class="eye-toggle" data-target="${id}" title="Toggle visibility">${SVG_EYE}</button>
              </div>
            </label>
          `).join('')}
        </div>
      </section>
    </div>

    <aside class="card summary" id="desktopSummary">
      <div>
        <h2>Install Target</h2>
        <p class="summary-desc">This is the manifest URL Stremio will install. Re-open from a configured URL to adjust settings later.</p>
      </div>

      <div class="preview">
        <div class="preview-label">Manifest URL</div>
        <div class="preview-code" id="manifestPreview"></div>
      </div>

      <div class="actions">
        <button class="btn btn-primary" type="button" id="installBtn">Install in Stremio</button>
        <button class="btn btn-secondary" type="button" id="copyBtn">Copy manifest URL</button>
      </div>

      <div class="status" id="status"></div>
      <div class="footnote">
        Magnetio does not host content.
        <a href="https://github.com/Magnetio/magnetio#disclaimer" target="_blank" rel="noreferrer">Read disclaimer</a>
      </div>
    </aside>
  </div>

  <div class="mobile-footer" id="mobileFooter">
    <div class="footer-actions">
      <button class="btn btn-primary" type="button" id="mobileInstallBtn">Install</button>
      <button class="btn btn-secondary" type="button" id="mobileCopyBtn">Copy URL</button>
    </div>
    <button class="preview-toggle" type="button" id="mobilePreviewToggle">Show manifest URL</button>
    <div class="footer-preview" id="mobilePreview">
      <div class="preview-code" id="mobileManifestPreview"></div>
    </div>
  </div>

  <script>
    const initialConfig = ${initialState};

    (function initTheme() {
      const saved = localStorage.getItem('magnetio-theme');
      const prefer = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', saved || prefer);
      updateThemeIcon();
    })();

    function updateThemeIcon() {
      const btn = document.getElementById('themeToggle');
      const current = document.documentElement.getAttribute('data-theme');
      btn.innerHTML = current === 'dark' ? '${SVG_MOON}' : '${SVG_SUN}';
    }

    document.getElementById('themeToggle').addEventListener('click', function() {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('magnetio-theme', next);
      updateThemeIcon();
    });

    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function(e) {
      if (!localStorage.getItem('magnetio-theme')) {
        document.documentElement.setAttribute('data-theme', e.matches ? 'light' : 'dark');
        updateThemeIcon();
      }
    });

    function selectedValues(id) {
      return Array.from(document.querySelectorAll('#' + id + ' input:checked')).map(function(el) { return el.value; });
    }

    function setChipGrid(id, values) {
      var wanted = new Set(values || []);
      document.querySelectorAll('#' + id + ' input[type="checkbox"]').forEach(function(cb) {
        cb.checked = wanted.has(cb.value);
        var chip = cb.closest('.chip');
        if (chip) chip.classList.toggle('selected', cb.checked);
      });
    }

    document.querySelectorAll('.chip-grid').forEach(function(grid) {
      grid.addEventListener('change', function(e) {
        if (e.target.type === 'checkbox') {
          var chip = e.target.closest('.chip');
          if (chip) chip.classList.toggle('selected', e.target.checked);
          refreshPreview();
        }
      });
    });

    function applyInitialState() {
      document.getElementById('sort').value = initialConfig.sort || 'qualityseeders';
      document.getElementById('limit').value = String(initialConfig.limit || 10);
      document.getElementById('prewarm').value = initialConfig.prewarmDebrid === false ? '0' : '1';
      document.getElementById('prewarmLimit').value = String(initialConfig.prewarmLimit || 3);

      setChipGrid('qualities', initialConfig.qualities || []);
      setChipGrid('languages', initialConfig.languages || []);
      setChipGrid('subtitleLanguages', initialConfig.subtitleLanguages || ['en']);

      document.getElementById('rd').value = initialConfig.realDebridApiKey || '';
      document.getElementById('pm').value = initialConfig.premiumizeApiKey || '';
      document.getElementById('ad').value = initialConfig.allDebridApiKey || '';
      document.getElementById('dl').value = initialConfig.debridLinkApiKey || '';
      document.getElementById('ed').value = initialConfig.easyDebridApiKey || '';
      document.getElementById('oc').value = initialConfig.offcloudApiKey || '';
      document.getElementById('tb').value = initialConfig.torboxApiKey || '';
      document.getElementById('pu').value = initialConfig.putioApiKey || '';
    }

    function buildConfiguration() {
      var parts = [];
      parts.push('sort=' + document.getElementById('sort').value);
      parts.push('limit=' + document.getElementById('limit').value);
      parts.push('prewarm=' + document.getElementById('prewarm').value);
      parts.push('prewarmLimit=' + document.getElementById('prewarmLimit').value);

      var qualities = selectedValues('qualities');
      var languages = selectedValues('languages');
      var subtitleLanguages = selectedValues('subtitleLanguages');

      if (qualities.length) parts.push('qualities=' + qualities.join(','));
      if (languages.length) parts.push('languages=' + languages.join(','));
      if (subtitleLanguages.length) parts.push('subtitleLanguages=' + subtitleLanguages.join(','));

      var keys = ['rd','pm','ad','dl','ed','oc','tb','pu'];
      keys.forEach(function(id) {
        var val = document.getElementById(id).value.trim();
        if (val) parts.push(id + '=' + val);
      });

      return parts.join('|');
    }

    function manifestUrl() {
      var config = buildConfiguration();
      return config
        ? location.origin + '/' + config + '/manifest.json'
        : location.origin + '/manifest.json';
    }

    function refreshPreview() {
      var url = manifestUrl();
      document.getElementById('manifestPreview').textContent = url;
      var mobileEl = document.getElementById('mobileManifestPreview');
      if (mobileEl) mobileEl.textContent = url;
      document.getElementById('status').textContent = '';
    }

    document.querySelectorAll('select, input').forEach(function(el) {
      el.addEventListener('change', refreshPreview);
      el.addEventListener('input', refreshPreview);
    });

    function handleInstall() {
      var url = manifestUrl();
      window.open('stremio://' + url.replace(/^https?:\\/\\//, ''));
    }

    function handleCopy() {
      var url = manifestUrl();
      navigator.clipboard.writeText(url).then(function() {
        document.getElementById('status').textContent = 'Manifest URL copied.';
      }).catch(function() {
        document.getElementById('status').textContent = 'Copy failed. Use the preview URL manually.';
      });
    }

    document.getElementById('installBtn').addEventListener('click', handleInstall);
    document.getElementById('copyBtn').addEventListener('click', handleCopy);
    document.getElementById('mobileInstallBtn').addEventListener('click', handleInstall);
    document.getElementById('mobileCopyBtn').addEventListener('click', handleCopy);

    document.getElementById('mobilePreviewToggle').addEventListener('click', function() {
      var preview = document.getElementById('mobilePreview');
      var open = preview.classList.toggle('open');
      this.textContent = open ? 'Hide manifest URL' : 'Show manifest URL';
    });

    document.querySelectorAll('.eye-toggle').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var input = document.getElementById(this.getAttribute('data-target'));
        var showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        this.innerHTML = showing ? '${SVG_EYE}' : '${SVG_EYE_OFF}';
      });
    });

    applyInitialState();
    refreshPreview();
  </script>
</body>
</html>`;
}

function escapeJsonForHtml(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}
