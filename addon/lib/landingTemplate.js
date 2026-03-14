/**
 * Generates the HTML for the Magnetio configuration / landing page.
 */
export function landingTemplate(manifest) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${manifest.name} – Configure</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: #0f0f0f;
      color: #e0e0e0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2rem 1rem;
    }
    header {
      text-align: center;
      margin-bottom: 2.5rem;
    }
    header img { width: 80px; margin-bottom: 1rem; border-radius: 16px; }
    h1 { font-size: 2rem; color: #fff; }
    p.subtitle { color: #888; margin-top: .4rem; }
    .card {
      background: #1a1a1a;
      border: 1px solid #2e2e2e;
      border-radius: 12px;
      padding: 1.5rem;
      width: 100%;
      max-width: 640px;
      margin-bottom: 1.5rem;
    }
    .card h2 { font-size: 1.1rem; color: #fff; margin-bottom: 1rem; }
    label { display: block; color: #aaa; font-size: .85rem; margin-bottom: .25rem; }
    select, input[type="text"], input[type="password"] {
      width: 100%;
      background: #0f0f0f;
      border: 1px solid #333;
      border-radius: 8px;
      color: #e0e0e0;
      padding: .5rem .75rem;
      font-size: .95rem;
      margin-bottom: .9rem;
      outline: none;
      transition: border-color .2s;
    }
    select:focus, input:focus { border-color: #6c63ff; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
    .debrid-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
    button.install {
      display: block;
      width: 100%;
      max-width: 640px;
      padding: .85rem;
      background: #6c63ff;
      color: #fff;
      font-size: 1.05rem;
      font-weight: 600;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      transition: background .2s;
    }
    button.install:hover { background: #574fd6; }
    .info { font-size: .8rem; color: #666; text-align: center; margin-top: 1rem; }
    a { color: #6c63ff; }
  </style>
</head>
<body>
  <header>
    <h1>⚡ ${manifest.name}</h1>
    <p class="subtitle">Advanced Stremio addon with multi-debrid support</p>
  </header>

  <div class="card">
    <h2>Providers</h2>
    <label for="providers">Torrent Providers</label>
    <select id="providers" multiple>
      <option value="yts"           selected>YTS</option>
      <option value="eztv"          selected>EZTV</option>
      <option value="rarbg"         selected>RARBG</option>
      <option value="torrentgalaxy" selected>TorrentGalaxy</option>
      <option value="thepiratebay"  selected>The Pirate Bay</option>
      <option value="kickasstorrents">KickassTorrents</option>
      <option value="1337x"          selected>1337x</option>
      <option value="nyaa">Nyaa (Anime)</option>
      <option value="animesaturn">AnimeSaturn</option>
      <option value="rutor">Rutor</option>
      <option value="rutracker">Rutracker</option>
    </select>
  </div>

  <div class="card">
    <h2>Stream Preferences</h2>
    <div class="grid-2">
      <div>
        <label for="sort">Sort By</label>
        <select id="sort">
          <option value="qualityseeders">Quality → Seeders</option>
          <option value="qualitysize">Quality → Size</option>
          <option value="seeders">Seeders</option>
          <option value="size">Size</option>
        </select>
      </div>
      <div>
        <label for="limit">Max streams per source</label>
        <select id="limit">
          <option value="5">5</option>
          <option value="10" selected>10</option>
          <option value="20">20</option>
          <option value="50">50</option>
        </select>
      </div>
    </div>
    <label for="languages">Preferred Languages (optional)</label>
    <select id="languages" multiple>
      <option value="en">English</option>
      <option value="es">Spanish</option>
      <option value="pt">Portuguese</option>
      <option value="fr">French</option>
      <option value="de">German</option>
      <option value="it">Italian</option>
      <option value="ru">Russian</option>
      <option value="ja">Japanese</option>
      <option value="ko">Korean</option>
      <option value="zh">Chinese</option>
      <option value="multi">Multi-Audio</option>
    </select>
  </div>

  <div class="card">
    <h2>Debrid Services <span style="font-weight:400;color:#666;font-size:.85rem">– optional, enables cached streams</span></h2>
    <div class="debrid-grid">
      <div>
        <label>Real-Debrid API Key</label>
        <input type="password" id="rd" placeholder="RD_API_KEY" />
      </div>
      <div>
        <label>Premiumize API Key</label>
        <input type="password" id="pm" placeholder="PM_API_KEY" />
      </div>
      <div>
        <label>AllDebrid API Key</label>
        <input type="password" id="ad" placeholder="AD_API_KEY" />
      </div>
      <div>
        <label>DebridLink API Key</label>
        <input type="password" id="dl" placeholder="DL_API_KEY" />
      </div>
      <div>
        <label>EasyDebrid API Key</label>
        <input type="password" id="ed" placeholder="ED_API_KEY" />
      </div>
      <div>
        <label>Offcloud API Key</label>
        <input type="password" id="oc" placeholder="OC_API_KEY" />
      </div>
      <div>
        <label>TorBox API Key</label>
        <input type="password" id="tb" placeholder="TB_API_KEY" />
      </div>
      <div>
        <label>Put.io API Key</label>
        <input type="password" id="pu" placeholder="PU_API_KEY" />
      </div>
    </div>
  </div>

  <button class="install" onclick="install()">Install in Stremio</button>
  <p class="info">
    By using this addon you agree to the
    <a href="https://github.com/Magnetio/magnetio#disclaimer">disclaimer</a>.
    Magnetio does not host any content.
  </p>

  <script>
    function buildConfig() {
      const providers = Array.from(document.getElementById('providers').selectedOptions)
                              .map(o => o.value).join(',');
      const sort      = document.getElementById('sort').value;
      const limit     = document.getElementById('limit').value;
      const languages = Array.from(document.getElementById('languages').selectedOptions)
                              .map(o => o.value).join(',');

      const parts = [
        'providers=' + providers,
        'sort='      + sort,
        'limit='     + limit,
      ];
      if (languages) parts.push('languages=' + languages);

      const debridFields = ['rd','pm','ad','dl','ed','oc','tb','pu'];
      for (const f of debridFields) {
        const val = document.getElementById(f).value.trim();
        if (val) parts.push(f + '=' + val);
      }

      return parts.join('|');
    }

    function install() {
      const config      = buildConfig();
      const manifestUrl = location.origin + '/' + config + '/manifest.json';
      window.open('stremio://' + manifestUrl.replace(/^https?:\/\//, ''));
    }
  </script>
</body>
</html>`;
}
