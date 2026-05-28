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

/**
 * Generates the HTML for the Magnetio configuration / landing page.
 */
export function landingTemplate(manifest, initialConfig = {}) {
  const initialState = escapeJsonForHtml({
    sort: initialConfig.sort ?? 'qualityseeders',
    limit: initialConfig.limit ?? 10,
    qualities: initialConfig.qualities ?? [],
    languages: initialConfig.languages ?? [],
    subtitleLanguages: initialConfig.subtitleLanguages ?? ['en'],
    prewarmDebrid: initialConfig.prewarmDebrid ?? true,
    prewarmLimit: initialConfig.prewarmLimit ?? 3,
    p2pFallback: initialConfig.p2pFallback === true,
    realDebridApiKey: initialConfig.realDebridApiKey ?? '',
    premiumizeApiKey: initialConfig.premiumizeApiKey ?? '',
    allDebridApiKey: initialConfig.allDebridApiKey ?? '',
    debridLinkApiKey: initialConfig.debridLinkApiKey ?? '',
    easyDebridApiKey: initialConfig.easyDebridApiKey ?? '',
    offcloudApiKey: initialConfig.offcloudApiKey ?? '',
    torboxApiKey: initialConfig.torboxApiKey ?? '',
    putioApiKey: initialConfig.putioApiKey ?? '',
  });

  return \`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>\${manifest.name} Configure</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

    :root {
      color-scheme: light dark;
      --bg: #fafafa;
      --surface: #ffffff;
      --border: rgba(0, 0, 0, 0.08);
      --text: #1a1a1a;
      --muted: #6b7280;
      --accent: #6d5cff;
      --accent-hover: #5a47e6;
      --accent-subtle: rgba(109, 92, 255, 0.08);
      --input-bg: #f5f5f5;
      --radius: 12px;
      --radius-sm: 8px;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0a0a0a;
        --surface: #141414;
        --border: rgba(255, 255, 255, 0.08);
        --text: #e5e5e5;
        --muted: #737373;
        --accent: #8b7dff;
        --accent-hover: #a094ff;
        --accent-subtle: rgba(139, 125, 255, 0.1);
        --input-bg: #1a1a1a;
      }
    }

    * { box-sizing: border-box; margin: 0; }

    body {
      font-family: "Inter", -apple-system, system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      -webkit-font-smoothing: antialiased;
    }

    .app {
      width: 100%;
      max-width: 480px;
    }

    .header {
      text-align: center;
      margin-bottom: 32px;
    }

    .logo {
      font-size: 20px;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    .logo span { color: var(--accent); }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
    }

    .group {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
    }

    .group:last-child { border-bottom: none; }

    .group-title {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 12px;
    }

    .row {
      display: flex;
      gap: 8px;
    }

    .field {
      flex: 1;
      min-width: 0;
    }

    .field + .field { margin-top: 0; }
    .field-stack .field + .field { margin-top: 8px; }
    .field-stack { display: flex; flex-direction: column; }

    .field label {
      display: block;
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 4px;
    }

    select, input {
      width: 100%;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--input-bg);
      color: var(--text);
      padding: 8px 10px;
      font: inherit;
      font-size: 13px;
      outline: none;
      transition: border-color 0.15s;
    }

    select:focus, input:focus {
      border-color: var(--accent);
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .chip {
      padding: 5px 10px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text);
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s;
      user-select: none;
    }

    .chip:hover { border-color: var(--accent); }
    .chip.active {
      background: var(--accent-subtle);
      border-color: var(--accent);
      color: var(--accent);
    }

    .debrid-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .debrid-grid input {
      font-size: 12px;
      padding: 7px 9px;
    }

    .debrid-grid label {
      font-size: 11px;
    }

    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 0;
    }

    .toggle-row + .toggle-row {
      margin-top: 6px;
    }

    .toggle-label {
      font-size: 13px;
    }

    .toggle {
      position: relative;
      width: 36px;
      height: 20px;
      appearance: none;
      -webkit-appearance: none;
      background: var(--border);
      border-radius: 10px;
      border: none;
      padding: 0;
      cursor: pointer;
      transition: background 0.2s;
      flex-shrink: 0;
    }

    .toggle::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: white;
      transition: transform 0.2s;
    }

    .toggle:checked {
      background: var(--accent);
    }

    .toggle:checked::after {
      transform: translateX(16px);
    }

    .actions {
      padding: 16px 20px;
      display: flex;
      gap: 8px;
    }

    .btn {
      flex: 1;
      border: none;
      border-radius: var(--radius-sm);
      padding: 10px 16px;
      font: inherit;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.15s;
    }

    .btn:hover { opacity: 0.85; }

    .btn-primary {
      background: var(--accent);
      color: white;
    }

    .btn-secondary {
      background: var(--input-bg);
      color: var(--text);
      border: 1px solid var(--border);
    }

    .status {
      text-align: center;
      font-size: 12px;
      color: var(--accent);
      min-height: 18px;
      padding: 0 20px 12px;
    }

    .footnote {
      text-align: center;
      font-size: 11px;
      color: var(--muted);
      margin-top: 16px;
    }

    .footnote a { color: var(--accent); text-decoration: none; }

    @media (max-width: 520px) {
      .debrid-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="app">
    <div class="header">
      <div class="logo"><span>M</span>agnetio</div>
    </div>

    <div class="card">
      <div class="group">
        <div class="group-title">Streams</div>
        <div class="row">
          <div class="field">
            <label>Sort</label>
            <select id="sort">
              <option value="qualityseeders">Quality + seeders</option>
              <option value="qualitysize">Quality + size</option>
              <option value="seeders">Seeders</option>
              <option value="size">Size</option>
            </select>
          </div>
          <div class="field">
            <label>Limit</label>
            <select id="limit">
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
          </div>
        </div>
      </div>

      <div class="group">
        <div class="group-title">Quality</div>
        <div class="chips" id="qualityChips">
          \${QUALITIES.map(([v, l]) => \`<button type="button" class="chip" data-value="\${v}">\${l}</button>\`).join('')}
        </div>
      </div>

      <div class="group">
        <div class="group-title">Audio</div>
        <div class="chips" id="langChips">
          \${LANGUAGES.map(([v, l]) => \`<button type="button" class="chip" data-value="\${v}">\${l}</button>\`).join('')}
        </div>
      </div>

      <div class="group">
        <div class="group-title">Subtitles</div>
        <div class="chips" id="subChips">
          \${LANGUAGES.map(([v, l]) => \`<button type="button" class="chip" data-value="\${v}">\${l}</button>\`).join('')}
        </div>
      </div>

      <div class="group">
        <div class="group-title">Debrid</div>
        <div class="toggle-row">
          <span class="toggle-label">Prewarm cache</span>
          <input type="checkbox" class="toggle" id="prewarm" />
        </div>
        <div class="toggle-row">
          <span class="toggle-label">P2P fallback</span>
          <input type="checkbox" class="toggle" id="p2pFallback" />
        </div>
        <div class="row" style="margin-top:10px">
          <div class="field">
            <label>Prewarm limit</label>
            <select id="prewarmLimit">
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="5">5</option>
            </select>
          </div>
        </div>
        <div class="debrid-grid" style="margin-top:10px">
          \${DEBRID_FIELDS.map(([id, label]) => \`
            <div class="field">
              <label>\${label}</label>
              <input type="password" id="\${id}" autocomplete="off" placeholder="API key" />
            </div>
          \`).join('')}
        </div>
      </div>

      <div class="actions">
        <button class="btn btn-primary" type="button" id="installBtn">Install</button>
        <button class="btn btn-secondary" type="button" id="copyBtn">Copy URL</button>
      </div>
      <div class="status" id="status"></div>
    </div>

    <div class="footnote">
      <a href="https://github.com/Magnetio/magnetio#disclaimer" target="_blank" rel="noreferrer">Disclaimer</a>
    </div>
  </div>

  <script>
    const initialConfig = \${initialState};

    function chipGroup(containerId) {
      const chips = document.querySelectorAll('#' + containerId + ' .chip');
      chips.forEach(chip => {
        chip.addEventListener('click', () => {
          chip.classList.toggle('active');
          refreshPreview();
        });
      });
      return {
        getValues() {
          return Array.from(document.querySelectorAll('#' + containerId + ' .chip.active'))
            .map(c => c.dataset.value);
        },
        setValues(vals) {
          const set = new Set(vals || []);
          chips.forEach(c => c.classList.toggle('active', set.has(c.dataset.value)));
        }
      };
    }

    const qualityChips = chipGroup('qualityChips');
    const langChips = chipGroup('langChips');
    const subChips = chipGroup('subChips');

    function applyInitialState() {
      document.getElementById('sort').value = initialConfig.sort || 'qualityseeders';
      document.getElementById('limit').value = String(initialConfig.limit || 10);
      document.getElementById('prewarm').checked = initialConfig.prewarmDebrid !== false;
      document.getElementById('prewarmLimit').value = String(initialConfig.prewarmLimit || 3);
      document.getElementById('p2pFallback').checked = !!initialConfig.p2pFallback;

      qualityChips.setValues(initialConfig.qualities);
      langChips.setValues(initialConfig.languages);
      subChips.setValues(initialConfig.subtitleLanguages);

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
      const parts = [];
      parts.push('sort=' + document.getElementById('sort').value);
      parts.push('limit=' + document.getElementById('limit').value);
      parts.push('prewarm=' + (document.getElementById('prewarm').checked ? '1' : '0'));
      parts.push('prewarmLimit=' + document.getElementById('prewarmLimit').value);
      parts.push('p2pFallback=' + (document.getElementById('p2pFallback').checked ? '1' : '0'));

      const qualities = qualityChips.getValues();
      const languages = langChips.getValues();
      const subtitleLanguages = subChips.getValues();

      if (qualities.length) parts.push('qualities=' + qualities.join(','));
      if (languages.length) parts.push('languages=' + languages.join(','));
      if (subtitleLanguages.length) parts.push('subtitleLanguages=' + subtitleLanguages.join(','));

      const keys = { rd:'rd', pm:'pm', ad:'ad', dl:'dl', ed:'ed', oc:'oc', tb:'tb', pu:'pu' };
      Object.entries(keys).forEach(([id, key]) => {
        const v = document.getElementById(id).value.trim();
        if (v) parts.push(key + '=' + v);
      });

      return parts.join('|');
    }

    function manifestUrl() {
      const c = buildConfiguration();
      return c ? location.origin + '/' + c + '/manifest.json' : location.origin + '/manifest.json';
    }

    function refreshPreview() {
      document.getElementById('status').textContent = '';
    }

    document.querySelectorAll('select,input').forEach(el => {
      el.addEventListener('change', refreshPreview);
      el.addEventListener('input', refreshPreview);
    });

    document.getElementById('installBtn').addEventListener('click', () => {
      window.open('stremio://' + manifestUrl().replace(/^https?:\\/\\//, ''));
    });

    document.getElementById('copyBtn').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(manifestUrl());
        document.getElementById('status').textContent = 'Copied';
        setTimeout(() => document.getElementById('status').textContent = '', 2000);
      } catch {
        document.getElementById('status').textContent = 'Copy failed';
      }
    });

    applyInitialState();
    refreshPreview();
  </script>
</body>
</html>\`;
}

function escapeJsonForHtml(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}
