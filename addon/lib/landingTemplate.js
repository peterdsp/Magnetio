const PROVIDERS = [
  ['yts', 'YTS'],
  ['eztv', 'EZTV'],
  ['rarbg', 'RARBG'],
  ['torrentgalaxy', 'TorrentGalaxy'],
  ['thepiratebay', 'The Pirate Bay'],
  ['kickasstorrents', 'KickassTorrents'],
  ['1337x', '1337x'],
  ['nyaa', 'Nyaa'],
  ['animesaturn', 'AnimeSaturn'],
  ['rutor', 'Rutor'],
  ['rutracker', 'Rutracker'],
  ['limetorrents', 'LimeTorrents'],
  ['bitsearch', 'Bitsearch'],
];

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
    providers: initialConfig.providers ?? [],
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
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${manifest.name} Configure</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

    :root {
      --bg: #09111f;
      --panel: rgba(9, 19, 36, 0.82);
      --panel-border: rgba(140, 193, 255, 0.18);
      --text: #eef5ff;
      --muted: #8ea3c1;
      --accent: #29d6b6;
      --accent-2: #ffc857;
      --danger: #ff7b72;
      --shadow: 0 30px 80px rgba(0, 0, 0, 0.35);
      --radius: 22px;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(41, 214, 182, 0.18), transparent 30%),
        radial-gradient(circle at top right, rgba(255, 200, 87, 0.18), transparent 35%),
        linear-gradient(180deg, #08101d 0%, #0e1728 44%, #08101d 100%);
      font-family: "Space Grotesk", "Helvetica Neue", sans-serif;
      padding: 32px 20px 48px;
    }

    .shell {
      max-width: 1240px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 22px;
      align-items: start;
    }

    .panel {
      background: var(--panel);
      border: 1px solid var(--panel-border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      backdrop-filter: blur(18px);
    }

    .hero {
      padding: 30px;
      display: grid;
      gap: 18px;
    }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: var(--accent);
      font-size: 13px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .hero h1 {
      margin: 0;
      font-size: clamp(2.4rem, 6vw, 4.4rem);
      line-height: 0.98;
      letter-spacing: -0.04em;
      max-width: 9ch;
    }

    .hero p {
      margin: 0;
      color: var(--muted);
      font-size: 1rem;
      line-height: 1.6;
      max-width: 60ch;
    }

    .badges {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .badge {
      padding: 10px 14px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: var(--text);
      font-size: 0.9rem;
    }

    .stack {
      display: grid;
      gap: 18px;
    }

    .section {
      padding: 22px;
      display: grid;
      gap: 16px;
    }

    .section h2,
    .section h3 {
      margin: 0;
      font-size: 1rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--accent-2);
    }

    .section p {
      margin: 0;
      color: var(--muted);
      line-height: 1.55;
      font-size: 0.95rem;
    }

    .provider-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 10px;
    }

    .provider-chip {
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.04);
      color: var(--text);
      padding: 12px 14px;
      border-radius: 16px;
      cursor: pointer;
      text-align: left;
      transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
      font: inherit;
    }

    .provider-chip.active {
      background: linear-gradient(135deg, rgba(41, 214, 182, 0.24), rgba(41, 214, 182, 0.08));
      border-color: rgba(41, 214, 182, 0.65);
      transform: translateY(-1px);
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }

    label {
      display: grid;
      gap: 8px;
      color: var(--muted);
      font-size: 0.88rem;
    }

    input,
    select,
    textarea {
      width: 100%;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 14px;
      background: rgba(0, 0, 0, 0.18);
      color: var(--text);
      padding: 12px 14px;
      font: inherit;
      outline: none;
      transition: border-color 0.18s ease, box-shadow 0.18s ease;
    }

    select[multiple] {
      min-height: 148px;
    }

    input:focus,
    select:focus {
      border-color: rgba(41, 214, 182, 0.8);
      box-shadow: 0 0 0 3px rgba(41, 214, 182, 0.16);
    }

    .summary {
      position: sticky;
      top: 24px;
      padding: 24px;
      display: grid;
      gap: 18px;
    }

    .summary h2 {
      margin: 0;
      font-size: 1.45rem;
      letter-spacing: -0.03em;
    }

    .summary-copy {
      color: var(--muted);
      line-height: 1.55;
      font-size: 0.95rem;
    }

    .preview {
      padding: 16px;
      border-radius: 18px;
      background: rgba(0, 0, 0, 0.26);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .preview-label {
      color: var(--muted);
      font-size: 0.78rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin-bottom: 10px;
    }

    .preview-code {
      font-family: "IBM Plex Mono", monospace;
      color: #b9d5ff;
      word-break: break-all;
      line-height: 1.6;
      font-size: 0.88rem;
    }

    .actions {
      display: grid;
      gap: 10px;
    }

    .btn {
      width: 100%;
      border: none;
      border-radius: 16px;
      padding: 14px 16px;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
      transition: transform 0.16s ease, opacity 0.16s ease;
    }

    .btn:hover { transform: translateY(-1px); }

    .btn-primary {
      color: #04121a;
      background: linear-gradient(135deg, var(--accent) 0%, #7dffdd 100%);
    }

    .btn-secondary {
      color: var(--text);
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .warning {
      padding: 14px 16px;
      border-radius: 16px;
      background: rgba(255, 123, 114, 0.1);
      border: 1px solid rgba(255, 123, 114, 0.18);
      color: #ffc3bc;
      line-height: 1.55;
      font-size: 0.9rem;
    }

    .footnote {
      color: var(--muted);
      font-size: 0.84rem;
      line-height: 1.6;
    }

    .status {
      color: var(--accent);
      font-size: 0.88rem;
      min-height: 1.2rem;
    }

    a { color: #9ed7ff; }

    @media (max-width: 980px) {
      .shell {
        grid-template-columns: 1fr;
      }

      .summary {
        position: static;
      }
    }

    @media (max-width: 640px) {
      body { padding: 16px 14px 28px; }
      .hero,
      .section,
      .summary { padding: 20px; }
      .grid { grid-template-columns: 1fr; }
      .provider-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  </style>
</head>
<body>
  <div class="shell">
    <div class="stack">
      <section class="panel hero">
        <span class="eyebrow">Magnetio for Stremio</span>
        <h1>Build the exact addon URL you actually want.</h1>
        <p>Pick providers, tune stream ranking, set subtitle preferences and plug in your debrid stack. The result is a Stremio manifest URL that is ready to install as-is.</p>
        <div class="badges">
          <span class="badge">Torrent aggregation</span>
          <span class="badge">Multi-debrid direct links</span>
          <span class="badge">SDK subtitle resource</span>
        </div>
      </section>

      <section class="panel section">
        <h2>Providers</h2>
        <p>Balance breadth against noise. You can keep the broad net or trim this down to the sources you trust most.</p>
        <div class="provider-grid" id="providerGrid">
          ${PROVIDERS.map(([value, label]) => `<button class="provider-chip" type="button" data-provider="${value}">${label}</button>`).join('')}
        </div>
      </section>

      <section class="panel section">
        <h2>Stream Rules</h2>
        <div class="grid">
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
            Max streams per provider
            <select id="limit">
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
          </label>
        </div>
        <div class="grid">
          <label>
            Allowed qualities
            <select id="qualities" multiple>
              ${QUALITIES.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
            </select>
          </label>
          <label>
            Preferred audio languages
            <select id="languages" multiple>
              ${LANGUAGES.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
            </select>
          </label>
        </div>
      </section>

      <section class="panel section">
        <h2>Subtitles</h2>
        <p>Magnetio now exposes a dedicated Stremio subtitles resource. These language preferences shape subtitle lookups when the server is configured with OpenSubtitles credentials.</p>
        <label>
          Preferred subtitle languages
          <select id="subtitleLanguages" multiple>
            ${LANGUAGES.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
          </select>
        </label>
      </section>

      <section class="panel section">
        <h2>Debrid</h2>
        <p>Paste only the providers you actually use. Cached matches will be emitted as direct streams beside the P2P fallback, and Magnetio can also prewarm a few top uncached candidates in the background.</p>
        <div class="grid">
          <label>
            Debrid prewarm
            <select id="prewarm">
              <option value="1">Enabled</option>
              <option value="0">Disabled</option>
            </select>
          </label>
          <label>
            Prewarm top uncached results
            <select id="prewarmLimit">
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="5">5</option>
            </select>
          </label>
        </div>
        <div class="grid">
          ${DEBRID_FIELDS.map(([id, label]) => `
            <label>
              ${label}
              <input type="password" id="${id}" autocomplete="off" placeholder="${label} API key" />
            </label>
          `).join('')}
        </div>
      </section>
    </div>

    <aside class="panel summary">
      <div>
        <h2>Install Target</h2>
        <p class="summary-copy">This preview is the actual manifest URL Stremio will install. Re-open this page later from a configured addon URL to tweak the same setup.</p>
      </div>

      <div class="preview">
        <div class="preview-label">Manifest URL</div>
        <div class="preview-code" id="manifestPreview"></div>
      </div>

      <div class="actions">
        <button class="btn btn-primary" type="button" id="installBtn">Install in Stremio</button>
        <button class="btn btn-secondary" type="button" id="copyBtn">Copy manifest URL</button>
      </div>

      <div class="warning">
        Subtitle results require server-side OpenSubtitles setup: <code>OPENSUBTITLES_API_KEY</code> plus account credentials for downloadable subtitle links.
      </div>

      <div class="status" id="status"></div>
      <div class="footnote">
        Magnetio does not host content. Review the project disclaimer before public deployment.
        <a href="https://github.com/Magnetio/magnetio#disclaimer" target="_blank" rel="noreferrer">Read disclaimer</a>
      </div>
    </aside>
  </div>

  <script>
    const initialConfig = ${initialState};
    const providerButtons = Array.from(document.querySelectorAll('[data-provider]'));

    const configState = {
      providers: new Set(initialConfig.providers || []),
    };

    function selectedValues(id) {
      return Array.from(document.getElementById(id).selectedOptions).map(option => option.value);
    }

    function setMultiSelect(id, values) {
      const wanted = new Set(values || []);
      Array.from(document.getElementById(id).options).forEach(option => {
        option.selected = wanted.has(option.value);
      });
    }

    function applyInitialState() {
      document.getElementById('sort').value = initialConfig.sort || 'qualityseeders';
      document.getElementById('limit').value = String(initialConfig.limit || 10);
      document.getElementById('prewarm').value = initialConfig.prewarmDebrid === false ? '0' : '1';
      document.getElementById('prewarmLimit').value = String(initialConfig.prewarmLimit || 3);

      setMultiSelect('qualities', initialConfig.qualities || []);
      setMultiSelect('languages', initialConfig.languages || []);
      setMultiSelect('subtitleLanguages', initialConfig.subtitleLanguages || ['en']);

      document.getElementById('rd').value = initialConfig.realDebridApiKey || '';
      document.getElementById('pm').value = initialConfig.premiumizeApiKey || '';
      document.getElementById('ad').value = initialConfig.allDebridApiKey || '';
      document.getElementById('dl').value = initialConfig.debridLinkApiKey || '';
      document.getElementById('ed').value = initialConfig.easyDebridApiKey || '';
      document.getElementById('oc').value = initialConfig.offcloudApiKey || '';
      document.getElementById('tb').value = initialConfig.torboxApiKey || '';
      document.getElementById('pu').value = initialConfig.putioApiKey || '';

      providerButtons.forEach(button => {
        button.classList.toggle('active', configState.providers.has(button.dataset.provider));
      });
    }

    function buildConfiguration() {
      const parts = [];
      const providers = Array.from(configState.providers);
      if (providers.length) parts.push('providers=' + providers.join(','));

      const sort = document.getElementById('sort').value;
      const limit = document.getElementById('limit').value;
      const prewarm = document.getElementById('prewarm').value;
      const prewarmLimit = document.getElementById('prewarmLimit').value;
      const qualities = selectedValues('qualities');
      const languages = selectedValues('languages');
      const subtitleLanguages = selectedValues('subtitleLanguages');

      parts.push('sort=' + sort);
      parts.push('limit=' + limit);
      parts.push('prewarm=' + prewarm);
      parts.push('prewarmLimit=' + prewarmLimit);
      if (qualities.length) parts.push('qualities=' + qualities.join(','));
      if (languages.length) parts.push('languages=' + languages.join(','));
      if (subtitleLanguages.length) parts.push('subtitleLanguages=' + subtitleLanguages.join(','));

      const keyMap = {
        rd: 'rd',
        pm: 'pm',
        ad: 'ad',
        dl: 'dl',
        ed: 'ed',
        oc: 'oc',
        tb: 'tb',
        pu: 'pu',
      };

      Object.entries(keyMap).forEach(([id, key]) => {
        const value = document.getElementById(id).value.trim();
        if (value) parts.push(key + '=' + value);
      });

      return parts.join('|');
    }

    function manifestUrl() {
      const configuration = buildConfiguration();
      return configuration
        ? location.origin + '/' + configuration + '/manifest.json'
        : location.origin + '/manifest.json';
    }

    function refreshPreview() {
      document.getElementById('manifestPreview').textContent = manifestUrl();
      document.getElementById('status').textContent = '';
    }

    providerButtons.forEach(button => {
      button.addEventListener('click', () => {
        const provider = button.dataset.provider;
        if (configState.providers.has(provider)) {
          configState.providers.delete(provider);
        } else {
          configState.providers.add(provider);
        }
        button.classList.toggle('active', configState.providers.has(provider));
        refreshPreview();
      });
    });

    Array.from(document.querySelectorAll('select,input')).forEach(element => {
      element.addEventListener('change', refreshPreview);
      element.addEventListener('input', refreshPreview);
    });

    document.getElementById('installBtn').addEventListener('click', () => {
      const url = manifestUrl();
      window.open('stremio://' + url.replace(/^https?:\\/\\//, ''));
    });

    document.getElementById('copyBtn').addEventListener('click', async () => {
      const url = manifestUrl();
      try {
        await navigator.clipboard.writeText(url);
        document.getElementById('status').textContent = 'Manifest URL copied.';
      } catch {
        document.getElementById('status').textContent = 'Clipboard access failed. Copy the preview URL manually.';
      }
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
