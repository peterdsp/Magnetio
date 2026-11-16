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
  ['ta', 'Tamil'],
  ['te', 'Telugu'],
  ['ml', 'Malayalam'],
  ['kn', 'Kannada'],
  ['el', 'Greek'],
  ['sq', 'Albanian'],
];

const DEBRID_FIELDS = [
  ['rd', 'Real-Debrid', 'https://real-debrid.com/apitoken'],
  ['pm', 'Premiumize', 'https://www.premiumize.me/account'],
  ['ad', 'AllDebrid', 'https://alldebrid.com/apikeys'],
  ['dl', 'DebridLink', 'https://debrid-link.com/webapp/apikey'],
  ['ed', 'EasyDebrid', 'https://easydebrid.com/settings'],
  ['oc', 'Offcloud', 'https://offcloud.com/#/account'],
  ['tb', 'TorBox', 'https://torbox.app/settings'],
  ['pu', 'Put.io', 'https://put.io/oauth/apps'],
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
  const brandLogo = escapeHtml(manifest.logo || '');
  const brandBackground = escapeHtml(manifest.background || manifest.logo || '');
  const initialState = escapeJsonForHtml({
    sort: initialConfig.sort ?? 'qualityseeders',
    limit: initialConfig.limit ?? 10,
    qualities: initialConfig.qualities ?? [],
    languages: initialConfig.languages ?? [],
    subtitleLanguages: initialConfig.subtitleLanguages ?? ['en'],
    prewarmDebrid: initialConfig.prewarmDebrid ?? true,
    prewarmLimit: initialConfig.prewarmLimit ?? 3,
    p2pFallback: initialConfig.p2pFallback ?? false,
    onDemand: initialConfig.onDemand ?? true,
    debridCatalogs: initialConfig.debridCatalogs ?? true,
    tmdbApiKey: initialConfig.tmdbApiKey ?? '',
    torznabUrl: initialConfig.torznabUrl ?? '',
    torznabApiKey: initialConfig.torznabApiKey ?? '',
    proxyUrl: initialConfig.proxyUrl ?? '',
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
  <title>${escapeHtml(manifest.name)} - Self-Hosted Stremio Addon with 24 Providers and Debrid Support</title>
  <meta name="description" content="Magnetio is a free, open-source, self-hosted Stremio addon with 24 torrent providers, 9 debrid services, Torznab/Jackett/Prowlarr support, TMDB recommendations, and subtitle sync. Stream movies, series, and anime instantly." />
  <meta name="keywords" content="Magnetio, Stremio addon, self-hosted, torrent, debrid, Real-Debrid, Premiumize, AllDebrid, TorBox, Jackett, Prowlarr, Torznab, streaming, movies, series, anime, open source, TMDB" />
  <meta name="author" content="peterdsp" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://magnetio.peterdsp.dev/" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Magnetio - Self-Hosted Stremio Addon" />
  <meta property="og:description" content="Stream anything with 24 providers, 9 debrid services, Torznab support, and TMDB recommendations. Fully self-hosted, your API keys never leave your server." />
  <meta property="og:url" content="https://magnetio.peterdsp.dev/" />
  <meta property="og:site_name" content="Magnetio" />
  <meta property="og:image" content="${brandLogo}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Magnetio - Self-Hosted Stremio Addon" />
  <meta name="twitter:description" content="Stream anything with 24 providers, 9 debrid services, and Torznab support. Open source and self-hosted." />
  <meta name="twitter:image" content="${brandLogo}" />
  <link rel="icon" href="${brandLogo}" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="${brandLogo}" />

  <!-- JSON-LD Structured Data -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Magnetio",
    "applicationCategory": "MultimediaApplication",
    "operatingSystem": "Docker, Node.js",
    "url": "https://magnetio.peterdsp.dev",
    "description": "Self-hosted Stremio addon with 24 torrent providers, 9 debrid services, Torznab/Jackett/Prowlarr support, TMDB recommendations, and subtitle sync pipeline.",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "author": {
      "@type": "Person",
      "name": "peterdsp",
      "url": "https://github.com/peterdsp"
    },
    "softwareVersion": "${escapeHtml(manifest.version)}",
    "license": "https://github.com/peterdsp/Magnetio/blob/main/LICENSE",
    "codeRepository": "https://github.com/peterdsp/Magnetio",
    "featureList": [
      "24 torrent providers",
      "9 debrid services (Real-Debrid, Premiumize, AllDebrid, TorBox, etc.)",
      "Torznab/Jackett/Prowlarr integration",
      "TMDB similar content recommendations",
      "Subtitle search and sync pipeline",
      "Background cache prewarm",
      "Self-hosted on Raspberry Pi or any server"
    ]
  }
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    /* Magnetio's tokens, taken from its mark: the navy tile, the emerald and cyan of the magnet,
       the amber pole caps and the pale band under them. One face, Inter, as before. */
    :root {
      color-scheme: dark;
      --ground: #0b1120;
      --surface: #121a2c;
      --surface-2: #1a2438;
      --surface-3: #233049;
      --ink: #eef2f8;
      --muted: #a3b0c4;
      --emerald: #10b981;
      --emerald-strong: #0ea371;
      --cyan: #22d3ee;
      --amber: #f5a623;
      --coral: #ff6b6b;
      --band: #e5e7eb;
      --on-colour: #06121a;
      --field-line: rgba(238, 242, 248, 0.16);
      --field-line-strong: rgba(238, 242, 248, 0.32);
      --m: clamp(16px, 4vw, 56px);
      --max: 1328px;
      --s-display: clamp(40px, 5.2vw, 84px);
      --s-h2: clamp(34px, 4.4vw, 64px);
      --s-lead: 20px;
      --s-body: 17px;
      --s-small: 14px;
      --u: 0 0 999px 999px;
      --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
      --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
      --font: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; background: var(--ground); }
    body {
      min-height: 100vh;
      background: var(--ground);
      color: var(--ink);
      font-family: var(--font);
      font-size: var(--s-body);
      line-height: 1.55;
      overflow-x: hidden;
      -webkit-font-smoothing: antialiased;
    }
    a { color: inherit; }
    img, svg { display: block; max-width: 100%; }
    :focus-visible { outline: 3px solid var(--cyan); outline-offset: 3px; }
    ::selection { background: var(--emerald); color: var(--on-colour); }

    .wrap { width: 100%; max-width: calc(var(--max) + 2 * var(--m)); margin: 0 auto; padding: 0 var(--m); }
    .h2 { font-size: var(--s-h2); line-height: 1; letter-spacing: -0.035em; font-weight: 750; max-width: 16ch; }
    .lead { font-size: var(--s-lead); line-height: 1.5; max-width: 46ch; }

    /* The button is the magnet: a flat top and a round bottom. */
    .btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 10px;
      min-height: 52px; padding: 12px 30px 16px;
      border: 0; border-radius: var(--u);
      font: 650 var(--s-body)/1.2 var(--font); text-decoration: none; cursor: pointer;
      transition: transform 160ms var(--ease-out), background-color 180ms ease, color 180ms ease;
    }
    .btn:active { transform: scale(0.97); }
    .btn-primary { background: var(--emerald); color: var(--on-colour); }
    .btn-quiet { background: var(--surface-2); color: var(--ink); }
    @media (hover: hover) and (pointer: fine) {
      .btn-primary:hover { background: #34d399; }
      .btn-quiet:hover { background: var(--surface-3); }
    }
    .text-link { color: var(--ink); font-weight: 600; text-decoration: underline; text-decoration-color: transparent; text-underline-offset: 0.22em; transition: text-decoration-color 180ms ease; }
    .text-link:hover { text-decoration-color: currentColor; }

    /* ---- Navigation: the one glass layer. It floats over content, so it gets blur, a specular rim
       and a solid fallback wherever blur is missing or unwanted. ---- */
    .navbar {
      position: sticky; top: 0; z-index: 1000;
      background: rgba(11, 17, 32, 0.72);
      -webkit-backdrop-filter: blur(18px) saturate(1.5);
      backdrop-filter: blur(18px) saturate(1.5);
      box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.10); /* taste-skill-ignore: specular rim of the sticky glass bar */
    }
    .nav-inner { display: flex; align-items: center; justify-content: space-between; gap: 24px; height: 68px; }
    .nav-left { display: flex; align-items: center; gap: 12px; text-decoration: none; }
    .nav-logo { width: 34px; height: 34px; flex-shrink: 0; }
    .nav-brand { font-weight: 800; font-size: 22px; letter-spacing: -0.04em; color: var(--ink); }
    .nav-right { display: flex; align-items: center; gap: 28px; }
    .nav-links { display: flex; gap: 24px; list-style: none; }
    .nav-links a { font-size: var(--s-small); font-weight: 550; text-decoration: none; color: var(--ink); opacity: 0.86; transition: opacity 180ms ease; }
    .nav-links a:hover { opacity: 1; }
    .nav-cta { min-height: 40px; padding: 8px 20px 11px; font-size: var(--s-small); }
    @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
      .navbar, .mobile-footer { background: var(--ground); }
    }
    @media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
      .navbar, .mobile-footer { background: var(--ground); -webkit-backdrop-filter: none; backdrop-filter: none; }
    }

    /* ---- Hero: the magnet at enormous scale, cropped by the screen ---- */
    .hero { position: relative; overflow: hidden; min-height: calc(100svh - 68px); display: flex; align-items: center; }
    .hero-copy { position: relative; z-index: 2; padding: 64px 0 96px; }
    .hero-copy .wrap > div { max-width: min(52%, 760px); }
    .hero-headline { font-size: var(--s-display); line-height: 0.98; letter-spacing: -0.04em; font-weight: 800; }
    .hero-sub { margin-top: 36px; font-size: var(--s-lead); line-height: 1.5; max-width: 34ch; }
    .hero-buttons { display: flex; flex-wrap: wrap; align-items: center; gap: 16px 28px; margin-top: 40px; }
    .magnet {
      position: absolute; z-index: 1;
      height: 118svh; aspect-ratio: 380 / 454;
      right: -10vw; top: 7svh;
    }
    .magnet svg { width: 100%; height: 100%; }
    .magnet-chip {
      position: absolute; left: 31%; right: 31%; top: 22%;
      padding: 18px 18px 20px; border-radius: 14px;
      background: var(--ground); color: var(--ink);
      font-size: var(--s-small); line-height: 1.4;
    }
    .magnet-chip b { display: block; font-size: var(--s-small); font-weight: 650; margin-bottom: 8px; }
    .magnet-chip span { display: block; font: 500 14px/1.45 var(--font); color: var(--cyan); word-break: break-all; max-height: 7.3em; overflow: hidden; }

    /* ---- Section rhythm ---- */
    .section { padding: clamp(96px, 13vw, 184px) 0 0; }
    .section-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: end; gap: 24px 48px; margin-bottom: 56px; }
    .section-head .lead { max-width: 40ch; }

    /* ---- How it works: the setup as one bar, each stage as long as it takes ---- */
    .stages { display: flex; gap: 6px; height: 22vh; min-height: 176px; }
    .stage { position: relative; padding: 20px; border-radius: 0; color: var(--on-colour); min-width: 12%; }
    .stage:first-child { border-radius: 18px 0 0 18px; }
    .stage:last-child { border-radius: 0 18px 18px 0; }
    .stage-time { font-size: var(--s-lead); font-weight: 750; letter-spacing: -0.01em; }
    .stage-1 { flex: 58 1 0; background: var(--emerald); }
    .stage-2 { flex: 14 1 0; background: var(--cyan); }
    .stage-3 { flex: 28 1 0; background: var(--amber); }
    .stage-notes { display: flex; gap: 6px; margin-top: 20px; }
    .stage-notes p { min-width: 12%; max-width: 26ch; font-size: var(--s-body); padding-right: 16px; }
    .stage-notes p:nth-child(1) { flex: 58 1 0; }
    .stage-notes p:nth-child(2) { flex: 14 1 0; }
    .stage-notes p:nth-child(3) { flex: 28 1 0; }

    /* ---- Features: close-ups of the configure screen on one board ---- */
    .board { display: grid; grid-template-columns: repeat(12, 1fr); grid-auto-rows: 104px; gap: 8px; }
    .tile { position: relative; overflow: hidden; border-radius: 18px; background: var(--surface); }
    .tile-head { grid-column: span 6; grid-row: span 2; background: transparent; padding: 4px 0 0; }
    .t-6x4 { grid-column: span 6; grid-row: span 4; }
    .t-6x2 { grid-column: span 6; grid-row: span 2; }
    .t-3x4 { grid-column: span 3; grid-row: span 4; }
    .t-3x2 { grid-column: span 3; grid-row: span 2; }
    .f-emerald { background: var(--emerald); color: var(--on-colour); }
    .f-cyan { background: var(--cyan); color: var(--on-colour); }
    .f-amber { background: var(--amber); color: var(--on-colour); }
    .f-band { background: var(--band); color: var(--on-colour); }
    .f-surface { background: var(--surface-2); color: var(--ink); }
    .tile-cap { position: absolute; left: 20px; right: 20px; bottom: 18px; z-index: 2; }
    .tile-cap strong { display: block; font-size: var(--s-body); font-weight: 650; line-height: 1.3; }
    .tile-cap span { display: block; font-size: var(--s-small); line-height: 1.4; max-width: 40ch; }
    .zoom { position: absolute; pointer-events: none; font-family: var(--font); }

    /* The enlarged parts, built in em at their real proportions */
    .z-chips { font-size: 44px; left: -0.4em; top: 0.35em; display: flex; gap: 0.25em; white-space: nowrap; }
    .z-chip { padding: 0.18em 0.6em 0.26em; border-radius: 999px; background: rgba(6, 18, 26, 0.14); font-weight: 600; font-size: 0.8em; }
    .z-chip.on { background: var(--on-colour); color: var(--emerald); }
    .z-field { font-size: 34px; left: 0.6em; right: -2.5em; top: 0.6em; }
    .z-field label { display: block; font-size: 0.5em; font-weight: 650; margin-bottom: 0.35em; }
    .z-field .box { border-radius: 0.36em; background: rgba(6, 18, 26, 0.16); padding: 0.4em 0.5em; font-weight: 600; letter-spacing: 0.08em; white-space: nowrap; }
    .f-surface .z-field .box { background: var(--surface-3); font-size: 0.6em; font-weight: 500; letter-spacing: 0; color: var(--cyan); padding: 0.7em 0.8em; }
    .z-subs { font-size: 34px; left: 0.5em; }
    .z-subs .z-chip.on { color: var(--band); }
    .z-select { font-size: 40px; left: 0.5em; top: 0.45em; display: flex; align-items: center; gap: 0.3em; font-weight: 750; }
    .z-select i { font-style: normal; display: inline-grid; place-items: center; width: 1.3em; height: 1.3em; border-radius: 0.3em; background: var(--on-colour); color: var(--coral); }
    .z-like { font-size: 40px; left: 0.5em; top: 0.4em; font-weight: 750; letter-spacing: -0.03em; color: var(--cyan); white-space: nowrap; }
    .z-cmd { font-size: 28px; left: 0.7em; top: 0.7em; right: -3em; }
    .z-cmd code { display: block; font: 600 1em/1.3 ui-monospace, Menlo, monospace; color: var(--on-colour); white-space: nowrap; }
    .z-cmd code + code { opacity: 0.5; }

    /* ---- Showcase: the one switch privacy turns on ---- */
    .showcase { position: relative; overflow: hidden; height: 92svh; min-height: 620px; margin-top: clamp(96px, 13vw, 184px); background: var(--emerald); color: var(--on-colour); transition: background-color 420ms var(--ease-in-out); }
    .showcase.is-on { background: var(--amber); }
    .showcase .wrap { position: relative; z-index: 2; padding-top: clamp(56px, 8vw, 112px); }
    .showcase h2 { font-size: clamp(28px, 2.8vw, 40px); line-height: 1.1; letter-spacing: -0.03em; font-weight: 750; max-width: 18ch; }
    .showcase p { margin-top: 18px; font-size: var(--s-body); max-width: 40ch; }
    .switch {
      position: absolute; z-index: 1; right: -6vw; bottom: -6vh;
      font-size: min(23vh, 21vw);
      display: grid; justify-items: start; gap: 0.12em;
      background: none; border: 0; color: inherit; cursor: pointer; text-align: left; font-family: var(--font);
    }
    .switch-label { font-size: 0.36em; font-weight: 800; letter-spacing: -0.04em; line-height: 1; }
    .switch-track { position: relative; width: 4em; height: 2em; border-radius: 1em; background: var(--on-colour); transition: background-color 300ms ease; }
    .switch-thumb { position: absolute; top: 0.2em; left: 0.2em; width: 1.6em; height: 1.6em; border-radius: 50%; background: var(--emerald); transition: transform 420ms var(--ease-out), background-color 420ms var(--ease-in-out); }
    .showcase.is-on .switch-thumb { transform: translateX(2em); background: var(--amber); }
    .switch:focus-visible { outline: 6px solid var(--on-colour); outline-offset: 10px; }
    .switch-state { font-size: 0.22em; font-weight: 700; }

    /* ---- Configure: the working screen (app-screen rules inside) ---- */
    .configure { padding-top: clamp(96px, 13vw, 184px); }
    .config-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(300px, 400px); gap: 32px 40px; align-items: start; }
    .config-cards { display: grid; gap: 12px; }
    .config-card { background: var(--surface); border-radius: 22px; padding: 28px; display: grid; gap: 20px; }
    .config-card-title { font-weight: 700; font-size: var(--s-lead); letter-spacing: -0.02em; }
    .config-card-desc { font-size: var(--s-body); color: var(--muted); line-height: 1.6; max-width: 70ch; }
    .config-card-desc strong { color: var(--ink); }
    .config-card-desc a, .key-link { color: var(--cyan); text-decoration: none; }
    .config-card-desc a:hover, .key-link:hover { text-decoration: underline; }
    .config-card.warn { background: rgba(245, 166, 35, 0.12); }
    .config-card.warn .config-card-title { color: var(--amber); }
    .config-card.warn .config-card-desc { color: var(--ink); }
    .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .configure label { display: grid; gap: 8px; font-size: var(--s-small); color: var(--muted); font-weight: 550; }
    .configure select, .configure input[type="number"], .password-wrap input {
      width: 100%; min-height: 46px;
      border: 1px solid var(--field-line); border-radius: 12px;
      background: var(--surface-2); color: var(--ink);
      padding: 11px 14px; font: 500 15px/1.3 var(--font); outline: none;
      transition: border-color 180ms ease, background-color 180ms ease;
    }
    .password-wrap { position: relative; }
    .password-wrap input { padding-right: 44px; }
    .configure select:hover, .password-wrap input:hover { border-color: var(--field-line-strong); }
    .configure select:focus, .configure input:focus { border-color: var(--cyan); }
    .eye-toggle { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); display: flex; align-items: center; padding: 8px; background: none; border: 0; border-radius: 8px; color: var(--muted); cursor: pointer; }
    .eye-toggle:hover { color: var(--ink); background: var(--surface-3); }
    .chip-grid { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip { cursor: pointer; display: inline-flex; }
    .chip span { display: inline-block; padding: 7px 15px 8px; border-radius: 999px; background: var(--surface-2); color: var(--ink); font-size: var(--s-small); font-weight: 550; user-select: none; transition: background-color 160ms ease, color 160ms ease, transform 160ms var(--ease-out); }
    .chip:hover span { background: var(--surface-3); }
    .chip:active span { transform: scale(0.96); }
    .chip:has(input:checked) span, .chip.selected span { background: var(--emerald); color: var(--on-colour); }
    .chip input { position: absolute; opacity: 0; width: 1px; height: 1px; }
    .chip:has(input:focus-visible) span { outline: 3px solid var(--cyan); outline-offset: 2px; }

    /* The manifest URL is the output: it stays in view beside the settings on a wide screen. */
    .install-bar { position: sticky; top: 92px; }
    .install-card { background: var(--surface-2); border-radius: 22px; padding: 28px; display: grid; gap: 18px; }
    .install-card h3 { font-size: var(--s-lead); font-weight: 700; letter-spacing: -0.02em; }
    .install-card-url { font: 500 14px/1.55 var(--font); color: var(--cyan); word-break: break-all; background: var(--ground); padding: 14px 16px; border-radius: 12px; max-height: 14em; overflow: auto; }
    .install-card-actions { display: grid; gap: 10px; }
    .install-card-actions .btn { width: 100%; }
    .status { color: var(--emerald); font-size: var(--s-small); min-height: 1.3em; }

    /* ---- Lidhra, from the same maker: a content card, solid, no glass ---- */
    .lidhra-promo {
      --lp-surface: var(--surface);
      --lp-ink: var(--ink);
      --lp-muted: var(--muted);
      --lp-link: var(--cyan);
      --lp-ring: var(--cyan);
      --lp-radius: 28px;
      --lp-pad: clamp(20px, 4vw, 48px);
      --lp-title-size: var(--s-h2);
      container-type: inline-size;
      padding: var(--lp-pad);
      border-radius: var(--lp-radius);
      background: var(--lp-surface);
      color: var(--lp-ink);
      text-align: left;
    }
    .lidhra-promo__inner { display: grid; grid-template-columns: minmax(0, 1fr); gap: 32px 56px; }
    .lidhra-promo__copy { min-width: 0; }
    .lidhra-promo__title { margin: 0; max-width: 15ch; font-size: clamp(32px, 3.6vw, 52px); line-height: 1.02; letter-spacing: -0.035em; font-weight: 750; text-wrap: balance; }
    .lidhra-promo__text { margin: 24px 0 0; max-width: 44ch; font-size: var(--s-body); line-height: 1.55; }
    .lidhra-promo__facts { display: flex; gap: 14px; align-items: center; margin-top: 24px; }
    .lidhra-promo__facts p { margin: 0; font-size: var(--s-small); line-height: 1.45; color: var(--lp-muted); }
    .lidhra-promo__facts strong { color: var(--lp-ink); font-weight: 650; }
    .lidhra-promo__icon { flex: none; width: 48px; height: 48px; border-radius: 11px; }
    .lidhra-promo__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 14px 24px; margin-top: 28px; }
    .lidhra-promo__badge { display: inline-block; line-height: 0; border-radius: 9px; transition: transform 160ms var(--ease-out); }
    .lidhra-promo__badge:active { transform: scale(0.97); }
    .lidhra-promo__badge img { display: block; width: auto; height: 48px; }
    .lidhra-promo__more { font-weight: 650; color: var(--lp-link); text-decoration: none; }
    .lidhra-promo__more:hover { text-decoration: underline; }
    .lidhra-promo a:focus-visible { outline: 3px solid var(--lp-ring); outline-offset: 3px; }
    /* Inner radii are the card radius minus its padding, so the corners stay concentric. */
    .lidhra-promo__shots { order: -1; display: grid; margin: 0 0 13%; min-width: 0; overflow: visible; }
    .lidhra-promo__library, .lidhra-promo__phone { grid-area: 1 / 1; display: block; height: auto; }
    .lidhra-promo__library { width: 100%; aspect-ratio: 2 / 1; object-fit: cover; border-radius: max(10px, calc(var(--lp-radius) - var(--lp-pad) + 6px)); background: var(--ground); }
    .lidhra-promo__phone { justify-self: end; align-self: end; width: 27%; aspect-ratio: 360 / 570; margin: 0 5% -13% 0; border-radius: 16px; outline: 5px solid var(--lp-surface); background: #e9ebf2; }
    @container (min-width: 760px) {
      .lidhra-promo__inner { grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); align-items: center; }
      .lidhra-promo__shots { order: 0; margin-bottom: 9%; }
      .lidhra-promo__phone { width: 25%; margin-bottom: -9%; }
    }
    @container (min-width: 480px) and (max-width: 759px) {
      .lidhra-promo__shots { margin-bottom: 9%; }
      .lidhra-promo__phone { width: 21%; margin-bottom: -9%; }
    }

    /* ---- FAQ: questions filed like cards in a drawer ---- */
    .faq .wrap > * { max-width: 920px; margin-left: auto; margin-right: auto; }
    .faq .h2 { margin-bottom: 48px; }
    .cards { display: grid; }
    .qcard { --tab: 0px; position: relative; margin-top: -24px; padding-top: 40px; }
    .qcard:first-child { margin-top: 0; }
    .qcard-shape {
      position: absolute; inset: 0;
      clip-path: polygon(var(--tab) 0, calc(var(--tab) + 200px) 0, calc(var(--tab) + 200px) 40px, 100% 40px, 100% 100%, 0 100%, 0 40px, var(--tab) 40px);
      border-radius: 0 0 22px 22px;
    }
    .qcard:nth-child(3n+1) .qcard-shape { background: var(--surface-2); }
    .qcard:nth-child(3n+2) .qcard-shape { background: var(--surface-3); }
    .qcard:nth-child(3n) .qcard-shape { background: var(--surface); }
    .qcard:nth-child(1) { --tab: 0px; }
    .qcard:nth-child(2) { --tab: 150px; }
    .qcard:nth-child(3) { --tab: 300px; }
    .qcard:nth-child(4) { --tab: 450px; }
    .qcard:nth-child(5) { --tab: 600px; }
    @media (max-width: 1080px) { .qcard:nth-child(2) { --tab: 120px; } .qcard:nth-child(3) { --tab: 240px; } .qcard:nth-child(4) { --tab: 360px; } .qcard:nth-child(5) { --tab: 480px; } }
    .qcard-tab { position: absolute; top: 0; left: var(--tab); width: 200px; height: 40px; display: flex; align-items: center; padding: 0 20px; font-size: var(--s-small); font-weight: 650; color: var(--muted); z-index: 1; }
    .qcard button { position: relative; z-index: 1; display: block; width: 100%; text-align: left; background: none; border: 0; color: var(--ink); cursor: pointer; padding: 18px 28px 44px; font: 650 var(--s-lead)/1.3 var(--font); letter-spacing: -0.01em; }
    .qcard:last-child button { padding-bottom: 28px; }
    .qcard button:hover { color: #fff; }
    .qcard-answer { position: relative; z-index: 1; padding: 0 28px 48px; font-size: var(--s-body); max-width: calc(50ch + 56px); }
    .qcard:last-child .qcard-answer { padding-bottom: 32px; }
    .qcard-answer code { font: 500 0.92em ui-monospace, Menlo, monospace; color: var(--cyan); }
    .js .qcard:not(.open) .qcard-answer { display: none; }

    /* ---- Footer: the mark, built large from its own parts ---- */
    .site-footer { margin-top: clamp(96px, 13vw, 184px); background: var(--surface); padding: clamp(48px, 6vw, 80px) 0 32px; }
    .footer-mark { display: flex; align-items: end; gap: 4px; height: 34svh; min-height: 200px; }
    .footer-mark svg { height: 100%; width: auto; }
    .footer-mark .word { flex: 1; min-width: 0; height: 100%; display: flex; align-items: end; }
    .footer-mark .word svg { width: 100%; height: auto; max-height: 100%; }
    .footer-cols { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) minmax(0, 1.4fr); gap: 32px; margin-top: 56px; font-size: var(--s-body); }
    .footer-cols h3 { font-size: var(--s-body); font-weight: 650; margin-bottom: 10px; }
    .footer-cols ul { list-style: none; display: grid; gap: 6px; }
    .footer-cols a { text-decoration: none; color: var(--muted); transition: color 180ms ease; }
    .footer-cols a:hover { color: var(--ink); }
    .footer-note { color: var(--muted); max-width: 36ch; }
    .footer-last { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-top: 48px; font-size: var(--s-small); color: var(--muted); }
    .footer-last .btn { min-height: 40px; padding: 8px 20px 11px; font-size: var(--s-small); }

    /* ---- Mobile install bar: the second glass layer, floating over the page ---- */
    .mobile-footer {
      display: none; position: fixed; bottom: 0; left: 0; right: 0; z-index: 100;
      background: rgba(11, 17, 32, 0.78);
      -webkit-backdrop-filter: blur(18px) saturate(1.5);
      backdrop-filter: blur(18px) saturate(1.5);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.10); /* taste-skill-ignore: specular rim of the sticky glass bar */
      padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
    }
    .js .mobile-footer { transform: translateY(110%); transition: transform 320ms var(--ease-out); }
    .js .mobile-footer.is-shown { transform: none; }
    .mobile-footer .footer-actions { display: flex; gap: 10px; }
    .mobile-footer .btn { flex: 1; min-height: 46px; padding: 10px 12px 13px; font-size: 15px; }
    .mobile-footer .footer-preview { margin-top: 8px; display: none; }
    .mobile-footer .footer-preview.open { display: block; }
    .mobile-footer .preview-toggle { background: none; border: 0; color: var(--muted); font: 500 var(--s-small) var(--font); cursor: pointer; padding: 8px 0 0; text-decoration: underline; text-underline-offset: 0.2em; }
    .mobile-footer .preview-code { font: 500 14px/1.5 var(--font); color: var(--cyan); word-break: break-all; margin-top: 6px; max-height: 6em; overflow: auto; }

    /* ---- Motion: entrances that never hide content without script ---- */
    @media (prefers-reduced-motion: no-preference) {
      .js [data-rise] { opacity: 0; transform: translateY(24px); transition: opacity 700ms var(--ease-out), transform 700ms var(--ease-out); transition-delay: calc(var(--i, 0) * 75ms); }
      .js [data-rise].is-in { opacity: 1; transform: none; }
      .js .magnet { clip-path: inset(100% 0 0 0); transition: clip-path 1100ms var(--ease-in-out); }
      .js .magnet svg { transform: scale(1.12); transform-origin: 50% 100%; transition: transform 1500ms var(--ease-out); }
      .js .magnet.is-in { clip-path: inset(-10% -10% -10% -10%); }
      .js .magnet.is-in svg { transform: none; }
      .js .magnet-chip { opacity: 0; transform: translateY(16px); transition: opacity 600ms var(--ease-out) 900ms, transform 600ms var(--ease-out) 900ms; }
      .js .magnet.is-in .magnet-chip { opacity: 1; transform: none; }
      .js .stage { transform-origin: left center; }
      .tile .zoom { transition: transform 900ms var(--ease-out); }
      .tile:hover .zoom { transform: translateX(-0.12em); }
    }

    /* ---- Responsive ---- */
    @media (max-width: 1080px) {
      .nav-links { display: none; }
      .config-grid { grid-template-columns: 1fr; }
      .install-bar { display: none; }
      .mobile-footer { display: block; }
      body { padding-bottom: 104px; }
      .t-3x4 { grid-column: span 6; }
      .t-3x2 { grid-column: span 6; }
    }
    @media (max-width: 760px) {
      :root { --s-lead: 18px; --s-body: 16px; }
      .hero { min-height: calc(100svh - 68px); align-items: flex-start; }
      .hero-copy { padding: 9svh 0 62svh; }
      .hero-copy .wrap > div { max-width: none; }
      .hero-headline { font-size: 9.6vw; }
      .hero-sub { margin-top: 24px; }
      .hero-buttons { margin-top: 28px; }
      .magnet { height: auto; width: 116vw; right: auto; left: -8vw; top: auto; bottom: -34vw; }
      .magnet-chip { display: none; }
      .section-head { margin-bottom: 36px; }
      .stages { flex-direction: column; height: 70svh; min-height: 460px; }
      .stage { min-height: 72px; }
      .stage:first-child { border-radius: 18px 18px 0 0; }
      .stage:last-child { border-radius: 0 0 18px 18px; }
      .stage-notes { display: none; }
      .stage-mobile-note { display: block !important; font-size: var(--s-body); font-weight: 500; margin-top: 8px; max-width: 30ch; }
      .board { grid-template-columns: repeat(2, 1fr); grid-auto-rows: 28vw; gap: 6px; }
      .tile-head { grid-column: span 2; grid-row: span 2; }
      .t-6x4 { grid-column: span 2; grid-row: span 3; }
      .t-6x2 { grid-column: span 2; grid-row: span 2; }
      .t-3x4, .t-3x2 { grid-column: span 1; grid-row: span 3; }
      .tile-cap { left: 14px; right: 14px; bottom: 14px; }
      .tile-cap strong { font-size: 16px; }
      .tile-cap span { font-size: 14px; }
      .z-chips { font-size: 34px; }
      .z-select, .z-like { font-size: 30px; }
      .z-field { font-size: 26px; }
      .z-cmd { font-size: 18px; }
      .showcase { height: 86svh; min-height: 560px; }
      .showcase h2 { font-size: 26px; }
      .switch { right: auto; left: 16px; bottom: -4svh; font-size: 32vw; }
      .field-grid { grid-template-columns: 1fr; }
      .config-card { padding: 22px 18px; }
      .qcard { margin-top: -20px; }
      .qcard-shape { clip-path: polygon(var(--tab) 0, calc(var(--tab) + 120px) 0, calc(var(--tab) + 120px) 40px, 100% 40px, 100% 100%, 0 100%, 0 40px, var(--tab) 40px); }
      .qcard-tab { width: 120px; padding: 0 14px; }
      .qcard:nth-child(2) { --tab: 48px; }
      .qcard:nth-child(3) { --tab: 96px; }
      .qcard:nth-child(4) { --tab: 144px; }
      .qcard:nth-child(5) { --tab: 192px; }
      .qcard button { padding: 16px 20px 40px; font-size: 18px; }
      .qcard-answer { padding: 0 20px 44px; }
      .footer-mark { height: 22svh; min-height: 140px; }
      .footer-cols { grid-template-columns: 1fr 1fr; }
      .footer-note { grid-column: span 2; }
    }
  </style>
</head>
<body>

  <nav class="navbar" aria-label="Main">
    <div class="wrap nav-inner">
      <a class="nav-left" href="#top" aria-label="Magnetio, back to top">
        <img class="nav-logo" src="${brandLogo}" alt="" width="34" height="34" />
        <span class="nav-brand">${escapeHtml(manifest.name)}</span>
      </a>
      <div class="nav-right">
        <ul class="nav-links">
          <li><a href="#how">How it works</a></li>
          <li><a href="#configure">Configure</a></li>
          <li><a href="#faq">FAQ</a></li>
          <li><a href="https://github.com/peterdsp/Magnetio" target="_blank" rel="noreferrer">GitHub</a></li>
        </ul>
        <a href="#configure" class="btn btn-primary nav-cta">Configure</a>
      </div>
    </div>
  </nav>

  <main id="top">
  <!-- Hero: the magnet from the mark, at the scale of the screen -->
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero-copy">
      <div class="wrap"><div>
        <h1 class="hero-headline" id="hero-title" data-rise>Stream anything. Own your setup.</h1>
        <p class="hero-sub" data-rise style="--i:1">Magnetio is a self-hosted addon for Stremio and Nuvio. It searches 24 torrent sources and plays what it finds through your own debrid account.</p>
        <div class="hero-buttons" data-rise style="--i:2">
          <a href="#configure" class="btn btn-primary">Configure and install</a>
          <a href="https://github.com/peterdsp/Magnetio" target="_blank" rel="noreferrer" class="text-link">View on GitHub</a>
        </div>
      </div></div>
    </div>
    <div class="magnet" aria-hidden="true">
      <svg viewBox="326 284 380 454" preserveAspectRatio="xMidYMid meet">
        <defs><clipPath id="magnetBody"><rect x="300" y="528" width="440" height="240" /></clipPath></defs>
        <path clip-path="url(#magnetBody)" fill="#10b981" d="M326 284H438V543C438 586.078 472.922 621 516 621C559.078 621 594 586.078 594 543V284H706V548C706 652.934 620.934 738 516 738C411.066 738 326 652.934 326 548V284Z" />
        <rect x="326" y="284" width="112" height="120" fill="#f5a623" />
        <rect x="594" y="284" width="112" height="120" fill="#ff6b6b" />
        <rect x="326" y="422" width="112" height="88" fill="#e5e7eb" />
        <rect x="594" y="422" width="112" height="88" fill="#e5e7eb" />
      </svg>
      <div class="magnet-chip" data-ui>
        <b>Your manifest URL</b>
        <span id="heroManifest">${escapeHtml('https://magnetio.peterdsp.dev/manifest.json')}</span>
      </div>
    </div>
  </section>

  <!-- How it works -->
  <section class="section" id="how" aria-labelledby="how-title">
    <div class="wrap">
      <div class="section-head">
        <h2 class="h2" id="how-title" data-rise>From keys to playback</h2>
        <p class="lead" data-rise style="--i:1">Most of the setup is choosing what you want. Installing is one tap, and cached streams start at once.</p>
      </div>
      <div class="stages" data-ui data-rise style="--i:2">
        <div class="stage stage-1"><div class="stage-time">About a minute</div><p class="stage-mobile-note" style="display:none">First, choose qualities and languages, and paste your debrid key.</p></div>
        <div class="stage stage-2"><div class="stage-time">One tap</div><p class="stage-mobile-note" style="display:none">Then install the manifest URL in Stremio or Nuvio.</p></div>
        <div class="stage stage-3"><div class="stage-time">Seconds</div><p class="stage-mobile-note" style="display:none">Last, press play: cached results start at full speed.</p></div>
      </div>
      <div class="stage-notes" data-rise style="--i:3">
        <p>First, choose qualities and languages, and paste your debrid key.</p>
        <p>Then install the manifest URL in Stremio or Nuvio.</p>
        <p>Last, press play: cached results start at full speed.</p>
      </div>
    </div>
  </section>

  <!-- Features: close-ups of the settings below -->
  <section class="section" aria-labelledby="features-title">
    <div class="wrap">
      <div class="board">
        <div class="tile tile-head" data-rise>
          <h2 class="h2" id="features-title">What it does for you</h2>
          <p class="lead" style="margin-top:20px">Every tile is a setting you will find in Configure.</p>
        </div>
        <div class="tile t-6x2 f-surface" data-rise style="--i:1">
          <div class="zoom z-field" data-ui aria-hidden="true"><label>Torznab URL</label><div class="box">http://jackett:9117/api/v2.0/indexers/all/results/torznab</div></div>
          <div class="tile-cap"><strong>Torznab, Jackett and Prowlarr</strong><span>Point it at your own indexer manager for more sources.</span></div>
        </div>
        <div class="tile t-6x4 f-emerald" data-rise style="--i:2">
          <div class="zoom z-chips" data-ui aria-hidden="true"><span class="z-chip">4K</span><span class="z-chip on">1080p</span><span class="z-chip on">720p</span><span class="z-chip">480p</span></div>
          <div class="tile-cap"><strong>Only the releases you want</strong><span>Filter by quality and audio language, then sort by quality, seeders or size.</span></div>
        </div>
        <div class="tile t-3x4 f-cyan" data-rise style="--i:3">
          <div class="zoom z-field" data-ui aria-hidden="true"><label>Real-Debrid</label><div class="box">&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;</div></div>
          <div class="tile-cap"><strong>8 debrid services</strong><span>Real-Debrid, AllDebrid, TorBox, Premiumize and four more.</span></div>
        </div>
        <div class="tile t-3x4 f-band" data-rise style="--i:4">
          <div class="zoom z-chips z-subs" data-ui aria-hidden="true"><span class="z-chip on">Greek</span><span class="z-chip on">Albanian</span></div>
          <div class="tile-cap"><strong>Subtitles in 19 languages</strong><span>Searched, ranked and synced to the release you play.</span></div>
        </div>
        <div class="tile t-3x2 f-amber" data-rise style="--i:5">
          <div class="zoom z-select" data-ui aria-hidden="true">Prewarm <i>3</i></div>
          <div class="tile-cap"><strong>Prewarm</strong><span>Starts the top results in your account while you browse.</span></div>
        </div>
        <div class="tile t-3x2 f-surface" data-rise style="--i:6">
          <div class="zoom z-like" data-ui aria-hidden="true">More like this</div>
          <div class="tile-cap"><strong>Recommendations</strong><span>Similar titles from TMDB, with your free key.</span></div>
        </div>
        <div class="tile t-6x2 f-emerald" data-rise style="--i:7">
          <div class="zoom z-cmd" data-ui aria-hidden="true"><code>docker compose up -d</code><code>cp .env.example .env</code></div>
          <div class="tile-cap"><strong>Runs on a Raspberry Pi</strong><span>Self-hosted with Docker. Your keys stay on your server.</span></div>
        </div>
      </div>
    </div>
  </section>

  <!-- Showcase: the one switch -->
  <section class="showcase" id="privacy" aria-labelledby="privacy-title">
    <div class="wrap">
      <h2 id="privacy-title" data-rise><span id="privacyHeading">Your IP stays out of the swarm</span></h2>
      <p id="privacyText" data-rise style="--i:1">With a debrid key and P2P fallback off, every stream comes from your debrid service and never from other peers. Try the switch: it is the same setting as in Configure.</p>
    </div>
    <button type="button" class="switch" id="privacySwitch" role="switch" aria-checked="false" aria-labelledby="privacySwitchLabel" data-ui>
      <span class="switch-label" id="privacySwitchLabel">P2P fallback</span>
      <span class="switch-track"><span class="switch-thumb"></span></span>
      <span class="switch-state" id="privacySwitchState">Off, direct links only</span>
    </button>
  </section>

  <!-- Configure -->
  <section class="configure" id="configure" aria-labelledby="configure-title">
    <div class="wrap">
      <div class="section-head">
        <h2 class="h2" id="configure-title">Set up your addon</h2>
        <p class="lead">Choose your settings, then install the URL this page builds. Nothing is saved here: it all lives in the URL.</p>
      </div>
      <div class="config-grid">
      <div class="config-cards">

    <div class="config-card">
      <div class="config-card-title">Stream rules</div>
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
    </div>

    <div class="config-card">
      <div class="config-card-title">Subtitles</div>
      <div class="config-card-desc">Select every subtitle language you want returned. Magnetio provides a dedicated Stremio subtitles resource.</div>
      <label>
        Subtitle languages
        <div class="chip-grid" id="subtitleLanguages">
          ${LANGUAGES.map(([value, label]) => `<label class="chip"><input type="checkbox" value="${value}" /><span>${label}</span></label>`).join('')}
        </div>
      </label>
    </div>

    <div class="config-card">
      <div class="config-card-title">Recommendations</div>
      <div class="config-card-desc">Enable "More Like This" suggestions powered by TMDB. Get a free API key at <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer">themoviedb.org</a>.</div>
      <div class="field-grid">
        <label>
          TMDB API Key
          <div class="password-wrap">
            <input type="password" id="tmdb" autocomplete="off" placeholder="TMDB API key (v3 auth)" />
            <button type="button" class="eye-toggle" data-target="tmdb" title="Toggle visibility" aria-label="Show or hide the TMDB key">${SVG_EYE}</button>
          </div>
        </label>
      </div>
    </div>

    <div class="config-card">
      <div class="config-card-title">Torznab, Jackett, Prowlarr</div>
      <div class="config-card-desc">Connect a Torznab-compatible indexer manager. Enter the full Torznab API URL and your API key.</div>
      <div class="field-grid">
        <label>
          Torznab URL
          <div class="password-wrap">
            <input type="text" id="torznabUrl" autocomplete="off" placeholder="http://jackett:9117/api/v2.0/indexers/all/results/torznab" />
          </div>
        </label>
        <label>
          Torznab API Key
          <div class="password-wrap">
            <input type="password" id="torznabKey" autocomplete="off" placeholder="API key" />
            <button type="button" class="eye-toggle" data-target="torznabKey" title="Toggle visibility" aria-label="Show or hide the Torznab key">${SVG_EYE}</button>
          </div>
        </label>
      </div>
    </div>

    <div class="config-card warn" id="p2pWarningCard" style="display:none;">
      <div class="config-card-title">P2P exposes your IP address</div>
      <div class="config-card-desc">You have no debrid service configured. Without one, streams are fetched directly via P2P (peer-to-peer), which <strong>exposes your IP address</strong> to other peers in the torrent swarm. To protect your privacy, either add a debrid API key below or enable the Privacy Proxy and provide your own VPN or SOCKS5 proxy, so the Magnetio server routes torrent traffic through your VPN.</div>
    </div>

    <div class="config-card">
      <div class="config-card-title">Privacy proxy</div>
      <div class="config-card-desc">Stream torrents through the Magnetio server instead of connecting directly to the swarm. Your device never touches the torrent network.<br /><br /><strong>Important:</strong> without a VPN or SOCKS5 proxy configured below, the server's own IP is used for torrent connections. Each user can provide their own SOCKS5 proxy (from a VPN provider), so all torrent traffic is routed through that VPN, keeping both you and the server operator private.</div>
      <div class="field-grid">
        <label>
          P2P Privacy Proxy
          <select id="proxyStreams">
            <option value="0">Disabled</option>
            <option value="1">Enabled</option>
          </select>
        </label>
        <label id="proxyUrlLabel" style="display:none;">
          Your SOCKS5 Proxy
          <div class="password-wrap">
            <input type="password" id="proxyUrl" autocomplete="off" placeholder="socks5://user:pass@host:1080" />
            <button type="button" class="eye-toggle" data-target="proxyUrl" title="Toggle visibility" aria-label="Show or hide the proxy address">${SVG_EYE}</button>
          </div>
        </label>
      </div>
      <div class="config-card-desc" id="proxyHelpText" style="display:none;">Most VPN providers offer SOCKS5 proxy access (NordVPN, Surfshark, PIA, Mullvad and others). Enter the SOCKS5 address from your VPN provider above, so torrent traffic goes through your VPN, not through the server's IP.</div>
    </div>

    <div class="config-card">
      <div class="config-card-title">Debrid services</div>
      <div class="config-card-desc">Real-Debrid shows cached and uncached results. Enable prewarm to start the top results downloading in your account while you browse. Press play to reuse a download or start another result. Playback is ready once Real-Debrid finishes downloading.</div>
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
        <label>
          P2P fallback when Debrid misses
          <select id="p2pFallback" title="When disabled, a configured Debrid service returns direct links only">
            <option value="0">Disabled (direct only)</option>
            <option value="1">Enabled</option>
          </select>
        </label>
        <label>
          Download uncached results through Debrid
          <select id="onDemand" title="Show uncached Real-Debrid, DebridLink, Offcloud and Put.io results. Press play to download through your Debrid account. Real-Debrid prewarm can start the top results ahead of time. No direct P2P connection is needed.">
            <option value="1">Enabled</option>
            <option value="0">Disabled</option>
          </select>
        </label>
        <label>
          Add Debrid cloud catalogs
          <select id="debridCatalogs" title="When a Debrid API key is set, also expose your cloud catalog (Movies/Series) in Stremio">
            <option value="1">Enabled</option>
            <option value="0">Disabled</option>
          </select>
        </label>
      </div>
      <div class="field-grid">
        ${DEBRID_FIELDS.map(([id, label, url]) => `
          <label>
            <a class="key-link" href="${url}" target="_blank" rel="noreferrer">${label} key &#8599;</a>
            <div class="password-wrap">
              <input type="password" id="${id}" autocomplete="off" placeholder="${label} API key" />
              <button type="button" class="eye-toggle" data-target="${id}" title="Toggle visibility" aria-label="Show or hide the ${label} key">${SVG_EYE}</button>
            </div>
          </label>
        `).join('')}
      </div>
    </div>
      </div>

      <!-- Install (desktop): the output, kept in view -->
      <aside class="install-bar" id="desktopSummary" aria-labelledby="install-title">
        <div class="install-card" data-ui>
          <h3 id="install-title">Manifest URL</h3>
          <div class="install-card-url" id="manifestPreview"></div>
          <div class="install-card-actions">
            <button class="btn btn-primary" type="button" id="installBtn">Install in Stremio</button>
            <button class="btn btn-quiet" type="button" id="copyBtn">Copy URL</button>
          </div>
          <div class="status" id="status" role="status"></div>
        </div>
      </aside>
      </div>
    </div>
  </section>

  <!-- Lidhra, from the same maker: the same debrid account, on Apple devices -->
  <section class="section" aria-labelledby="lidhra-promo-title">
    <div class="wrap">
    <div class="lidhra-promo lidhra-promo--magnetio" lang="en" data-rise>
      <div class="lidhra-promo__inner">
      <div class="lidhra-promo__copy">
        <h2 class="lidhra-promo__title" id="lidhra-promo-title">Your debrid account, as a native Apple app</h2>
        <p class="lidhra-promo__text">Paste a magnet or a link and Lidhra fetches it through Real-Debrid, AllDebrid, TorBox or six other services, then downloads it natively and resumes where it stopped. Finished files wait in a library, ready to play or cast to a TV.</p>
        <div class="lidhra-promo__facts">
          <img class="lidhra-promo__icon" src="/static/lidhra/lidhra-icon.webp" width="48" height="48" alt="Lidhra app icon" loading="lazy" decoding="async">
          <p><strong>For iPhone, iPad, Mac, Apple TV and Vision Pro</strong><br>One purchase, no subscription.</p>
        </div>
        <div class="lidhra-promo__actions">
          <a class="lidhra-promo__badge" href="https://apps.apple.com/app/lidhra-debrid-downloader/id6790952504?ct=magnetio&mt=8" rel="noopener"><img src="/static/lidhra/app-store-badge-white.svg" width="144" height="48" alt="Download Lidhra on the App Store" loading="lazy" decoding="async"></a>
          <a class="lidhra-promo__more" href="https://lidhra.peterdsp.dev/" rel="noopener">See how Lidhra works</a>
        </div>
      </div>
      <figure class="lidhra-promo__shots">
        <img class="lidhra-promo__library" src="/static/lidhra/lidhra-transfers-1200.webp" srcset="/static/lidhra/lidhra-transfers-640.webp 640w, /static/lidhra/lidhra-transfers-1200.webp 1200w" sizes="(min-width: 900px) 640px, 92vw" width="1200" height="600" alt="Lidhra on Mac: downloads coming to the device and files ready in the debrid cloud, with progress bars" loading="lazy" decoding="async">
        <img class="lidhra-promo__phone" src="/static/lidhra/lidhra-add-360.webp" srcset="/static/lidhra/lidhra-add-240.webp 240w, /static/lidhra/lidhra-add-360.webp 360w" sizes="(min-width: 900px) 170px, 26vw" width="360" height="570" alt="Lidhra on iPhone: the Add a transfer sheet, with a field for a magnet or an https link" loading="lazy" decoding="async">
      </figure>
      </div>
    </div>
    </div>
  </section>

  <!-- FAQ -->
  <section class="section faq" id="faq" aria-labelledby="faq-title">
    <div class="wrap">
      <h2 class="h2" id="faq-title" data-rise>Questions, answered</h2>
      <div class="cards" data-rise style="--i:1">
        <div class="qcard open">
          <div class="qcard-shape"></div><span class="qcard-tab">Content</span>
          <button type="button" aria-expanded="true" aria-controls="qa1">Does Magnetio host any content?</button>
          <div class="qcard-answer" id="qa1">No. Magnetio does not host or distribute any content. It finds links that already exist and hands them to your player. <a class="text-link" href="https://github.com/peterdsp/Magnetio#disclaimer" target="_blank" rel="noreferrer">Read the disclaimer</a>.</div>
        </div>
        <div class="qcard">
          <div class="qcard-shape"></div><span class="qcard-tab">Debrid</span>
          <button type="button" aria-expanded="false" aria-controls="qa2">Do I need a debrid account?</button>
          <div class="qcard-answer" id="qa2">No, but without one, streams come over P2P and other peers can see your IP address. Add a debrid key, or turn on the privacy proxy with your own SOCKS5 proxy.</div>
        </div>
        <div class="qcard">
          <div class="qcard-shape"></div><span class="qcard-tab">Your keys</span>
          <button type="button" aria-expanded="false" aria-controls="qa3">Where do my API keys go?</button>
          <div class="qcard-answer" id="qa3">Into your manifest URL, and from there only to the server that runs the addon. Run your own copy and they never leave your machine. Keep the URL to yourself.</div>
        </div>
        <div class="qcard">
          <div class="qcard-shape"></div><span class="qcard-tab">Self-host</span>
          <button type="button" aria-expanded="false" aria-controls="qa4">How do I run my own copy?</button>
          <div class="qcard-answer" id="qa4">Clone the repository, copy <code>.env.example</code> to <code>.env</code>, set your public URL, then run <code>docker compose up -d</code>. A Raspberry Pi is enough. The <a class="text-link" href="https://github.com/peterdsp/Magnetio#deployment" target="_blank" rel="noreferrer">deployment guide</a> has the details.</div>
        </div>
        <div class="qcard">
          <div class="qcard-shape"></div><span class="qcard-tab">Players</span>
          <button type="button" aria-expanded="false" aria-controls="qa5">Does it work with Nuvio too?</button>
          <div class="qcard-answer" id="qa5">Yes. <a class="text-link" href="https://www.stremio.com" target="_blank" rel="noreferrer">Stremio</a> and <a class="text-link" href="https://nuvioplugin.com" target="_blank" rel="noreferrer">Nuvio</a> use the same manifest URL and the same configuration. Install it once in each.</div>
        </div>
      </div>
    </div>
  </section>
  </main>

  <!-- Footer: the mark, built large -->
  <footer class="site-footer">
    <div class="wrap">
      <div class="footer-mark" aria-hidden="true" data-rise>
        <svg viewBox="326 284 380 454">
          <defs><clipPath id="footBody"><rect x="300" y="528" width="440" height="240" /></clipPath></defs>
          <path clip-path="url(#footBody)" fill="#10b981" d="M326 284H438V543C438 586.078 472.922 621 516 621C559.078 621 594 586.078 594 543V284H706V548C706 652.934 620.934 738 516 738C411.066 738 326 652.934 326 548V284Z" />
          <rect x="326" y="284" width="112" height="120" fill="#f5a623" />
          <rect x="594" y="284" width="112" height="120" fill="#ff6b6b" />
          <rect x="326" y="422" width="112" height="88" fill="#e5e7eb" />
          <rect x="594" y="422" width="112" height="88" fill="#e5e7eb" />
        </svg>
        <div class="word"><svg viewBox="0 0 1000 262" preserveAspectRatio="xMaxYMax meet"><text x="0" y="206" fill="#eef2f8" font-family="Inter, sans-serif" font-weight="800" font-size="222" letter-spacing="-8.8" textLength="1000" lengthAdjust="spacingAndGlyphs">Magnetio</text></svg></div>
      </div>
      <div class="footer-cols">
        <div><h3>Addon</h3><ul><li><a href="#configure">Configure</a></li><li><a href="#how">How it works</a></li><li><a href="#faq">FAQ</a></li></ul></div>
        <div><h3>Code</h3><ul><li><a href="https://github.com/peterdsp/Magnetio" target="_blank" rel="noreferrer">GitHub</a></li><li><a href="https://github.com/peterdsp/Magnetio#deployment" target="_blank" rel="noreferrer">Deployment guide</a></li><li><a href="https://github.com/peterdsp/Magnetio/blob/main/LICENSE" target="_blank" rel="noreferrer">License</a></li></ul></div>
        <div><h3>Also by the maker</h3><ul><li><a href="https://lidhra.peterdsp.dev/" rel="noopener">Lidhra</a></li><li><a href="https://github.com/peterdsp" target="_blank" rel="noreferrer">peterdsp on GitHub</a></li></ul></div>
        <p class="footer-note">Magnetio does not host or distribute any content. <a href="https://github.com/peterdsp/Magnetio#disclaimer" target="_blank" rel="noreferrer">Read disclaimer</a>.</p>
      </div>
      <div class="footer-last"><span>Magnetio v${escapeHtml(manifest.version)}, open source</span><a href="#configure" class="btn btn-primary">Configure</a></div>
    </div>
  </footer>

  <!-- Mobile install bar -->
  <div class="mobile-footer" id="mobileFooter">
    <div class="footer-actions">
      <button class="btn btn-primary" type="button" id="mobileInstallBtn">Install</button>
      <button class="btn btn-quiet" type="button" id="mobileCopyBtn">Copy URL</button>
    </div>
    <button class="preview-toggle" type="button" id="mobilePreviewToggle">Show manifest URL</button>
    <div class="footer-preview" id="mobilePreview">
      <div class="preview-code" id="mobileManifestPreview"></div>
    </div>
  </div>

  <script>
    document.documentElement.classList.add('js');
    const initialConfig = ${initialState};

    (function initTheme() {
      const saved = localStorage.getItem('magnetio-theme');
      const prefer = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', saved || prefer);
      updateThemeIcon();
    })();

    function updateThemeIcon() {
      const btn = document.getElementById('themeToggle');
      if (!btn) return;
      const current = document.documentElement.getAttribute('data-theme');
      btn.innerHTML = current === 'dark' ? '${SVG_MOON}' : '${SVG_SUN}';
    }

    var themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', function() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('magnetio-theme', next);
        updateThemeIcon();
      });
    }

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
      document.getElementById('p2pFallback').value = initialConfig.p2pFallback ? '1' : '0';
      document.getElementById('onDemand').value = initialConfig.onDemand === false ? '0' : '1';
      document.getElementById('debridCatalogs').value = initialConfig.debridCatalogs === false ? '0' : '1';
      document.getElementById('proxyStreams').value = initialConfig.proxyStreams ? '1' : '0';
      document.getElementById('proxyUrl').value = initialConfig.proxyUrl || '';

      setChipGrid('qualities', initialConfig.qualities || []);
      setChipGrid('languages', initialConfig.languages || []);
      setChipGrid('subtitleLanguages', initialConfig.subtitleLanguages || ['en']);

      document.getElementById('tmdb').value = initialConfig.tmdbApiKey || '';

      document.getElementById('torznabUrl').value = initialConfig.torznabUrl || '';
      document.getElementById('torznabKey').value = initialConfig.torznabApiKey || '';

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
      if (document.getElementById('p2pFallback').value === '1') parts.push('p2pFallback=1');
      if (document.getElementById('onDemand').value === '0') parts.push('onDemand=0');
      var debridCatalogsValue = document.getElementById('debridCatalogs').value;
      if (debridCatalogsValue === '0') parts.push('debridCatalogs=0');
      var proxyValue = document.getElementById('proxyStreams').value;
      if (proxyValue === '1') parts.push('proxy=1');
      var proxyUrlVal = document.getElementById('proxyUrl').value.trim();
      if (proxyUrlVal) parts.push('proxyUrl=' + encodeURIComponent(proxyUrlVal));

      var qualities = selectedValues('qualities');
      var languages = selectedValues('languages');
      var subtitleLanguages = selectedValues('subtitleLanguages');

      if (qualities.length) parts.push('qualities=' + qualities.join(','));
      if (languages.length) parts.push('languages=' + languages.join(','));
      if (subtitleLanguages.length) parts.push('subtitleLanguages=' + subtitleLanguages.join(','));

      var tmdbKey = document.getElementById('tmdb').value.trim();
      if (tmdbKey) parts.push('tmdb=' + tmdbKey);

      var torznabUrl = document.getElementById('torznabUrl').value.trim();
      var torznabKey = document.getElementById('torznabKey').value.trim();
      if (torznabUrl) parts.push('torznabUrl=' + encodeURIComponent(torznabUrl));
      if (torznabKey) parts.push('torznabKey=' + encodeURIComponent(torznabKey));

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
      var heroEl = document.getElementById('heroManifest');
      if (heroEl) heroEl.textContent = url;
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

    // Entrances: each part rises once as its section arrives. Without script nothing is hidden.
    (function reveal() {
      var magnet = document.querySelector('.magnet');
      // The magnet is on the first screen and starts fully clipped, so it opens on the next frame.
      requestAnimationFrame(function() { requestAnimationFrame(function() { magnet.classList.add('is-in'); }); });
      var parts = document.querySelectorAll('[data-rise]');
      if (!('IntersectionObserver' in window)) { parts.forEach(function(el) { el.classList.add('is-in'); }); return; }
      var io = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
        });
      }, { threshold: 0.12 });
      parts.forEach(function(el) { io.observe(el); });
    })();

    // The phone install bar appears while the settings are on screen: the URL it holds is built there.
    (function mobileBar() {
      var bar = document.getElementById('mobileFooter');
      var area = document.getElementById('configure');
      if (!('IntersectionObserver' in window)) { bar.classList.add('is-shown'); return; }
      new IntersectionObserver(function(entries) {
        bar.classList.toggle('is-shown', entries[0].isIntersecting);
      }, { rootMargin: '0px 0px -30% 0px' }).observe(area);
    })();

    // The privacy switch is the same setting as "P2P fallback when Debrid misses".
    var privacy = document.getElementById('privacy');
    var privacySwitch = document.getElementById('privacySwitch');
    function renderPrivacy() {
      var on = document.getElementById('p2pFallback').value === '1';
      privacy.classList.toggle('is-on', on);
      privacySwitch.setAttribute('aria-checked', on ? 'true' : 'false');
      document.getElementById('privacySwitchState').textContent = on ? 'On, peers on a miss' : 'Off, direct links only';
      document.getElementById('privacyHeading').textContent = on ? 'A miss goes to the swarm' : 'Your IP stays out of the swarm';
      document.getElementById('privacyText').textContent = on
        ? 'With P2P fallback on, a title your debrid service has not got falls back to peers, and they can see your IP unless you set a SOCKS5 proxy.'
        : 'With a debrid key and P2P fallback off, every stream comes from your debrid service and never from other peers. Try the switch: it is the same setting as in Configure.';
    }
    privacySwitch.addEventListener('click', function() {
      var select = document.getElementById('p2pFallback');
      select.value = select.value === '1' ? '0' : '1';
      renderPrivacy();
      refreshPreview();
    });
    document.getElementById('p2pFallback').addEventListener('change', renderPrivacy);

    // Questions: one card open at a time.
    var qcards = document.querySelectorAll('.qcard');
    qcards.forEach(function(card) {
      card.querySelector('button').addEventListener('click', function() {
        qcards.forEach(function(other) {
          var open = other === card;
          other.classList.toggle('open', open);
          other.querySelector('button').setAttribute('aria-expanded', open ? 'true' : 'false');
        });
      });
    });

    function updateProxyVisibility() {
      var enabled = document.getElementById('proxyStreams').value === '1';
      document.getElementById('proxyUrlLabel').style.display = enabled ? '' : 'none';
      document.getElementById('proxyHelpText').style.display = enabled ? '' : 'none';
    }

    function updateP2pWarning() {
      var keys = ['rd','pm','ad','dl','ed','oc','tb','pu'];
      var hasDebrid = keys.some(function(id) { return document.getElementById(id).value.trim(); });
      document.getElementById('p2pWarningCard').style.display = hasDebrid ? 'none' : '';
    }

    document.getElementById('proxyStreams').addEventListener('change', function() {
      updateProxyVisibility();
      refreshPreview();
    });

    var keys_for_warning = ['rd','pm','ad','dl','ed','oc','tb','pu'];
    keys_for_warning.forEach(function(id) {
      document.getElementById(id).addEventListener('input', updateP2pWarning);
    });

    applyInitialState();
    updateProxyVisibility();
    updateP2pWarning();
    refreshPreview();
    renderPrivacy();
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
