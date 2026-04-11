# ⚡ Magnetio

> **A better, open-source alternative to Torrentio** — advanced Stremio addon with multi-provider torrent aggregation and full multi-debrid support.

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/docker-ready-blue)](https://hub.docker.com)

---

## What is Magnetio?

Magnetio is a **fully in-house, self-hostable Stremio addon** with its own built-in torrent scraper — no external scraper service required. It aggregates torrents from multiple providers directly and optionally resolves them to **instant, direct-download streams** through your debrid service of choice.

Unlike Torrentio:
- **100% in-house** — built-in scrapers for every provider, no third-party back-end needed
- **Self-hosted** — your API keys never leave your server
- **Multi-debrid** — connect up to 8 debrid services simultaneously
- **Configurable** — per-user provider selection, quality filters, language preferences
- **Modern stack** — ES Modules, Redis caching, Prometheus metrics, Docker-first

## Services

| Service | Description | Port |
|---|---|---|
| `scraper` | In-house torrent scraper (queries all providers) | 8080 |
| `addon` | Stremio addon (user-facing, debrid integration) | 7000 |
| `redis` | Shared cache for both services | 6379 |

---

## Supported Torrent Providers

| Provider | Movies | Series | Anime |
|---|:---:|:---:|:---:|
| YTS | ✅ | ❌ | ❌ |
| EZTV | ❌ | ✅ | ❌ |
| RARBG (mirror) | ✅ | ✅ | ❌ |
| TorrentGalaxy | ✅ | ✅ | ❌ |
| The Pirate Bay | ✅ | ✅ | ❌ |
| KickassTorrents | ✅ | ✅ | ❌ |
| 1337x | ✅ | ✅ | ❌ |
| Nyaa | ❌ | ❌ | ✅ |
| AnimeSaturn | ❌ | ❌ | ✅ |
| Rutor | ✅ | ✅ | ❌ |
| Rutracker | ✅ | ✅ | ❌ |

---

## Debrid Service Support

Debrid services cache torrents server-side and serve them as direct HTTP links — giving you **instant, full-speed streams** with no seeding required.

| Service | Cache Check | Catalog | Short Code |
|---|:---:|:---:|:---:|
| [Real-Debrid](https://real-debrid.com) | ✅ | ✅ | `RD` |
| [Premiumize](https://premiumize.me) | ✅ | ✅ | `PM` |
| [AllDebrid](https://alldebrid.com) | ✅ | ❌ | `AD` |
| [DebridLink](https://debrid-link.com) | ❌ | ✅ | `DL` |
| [EasyDebrid](https://easydebrid.com) | ✅ | ❌ | `ED` |
| [Offcloud](https://offcloud.com) | ❌ | ❌ | `OC` |
| [TorBox](https://torbox.app) | ✅ | ✅ | `TB` |
| [Put.io](https://put.io) | ❌ | ✅ | `PU` |

### How debrid integration works

```
User requests stream
       │
       ▼
Magnetio fetches torrent records from providers
       │
       ▼
For each configured debrid service:
  ├── Check instant availability (cache hit?)
  │     ├── YES → resolve to direct download URL → inject as stream
  │     └── NO  → keep original P2P magnet stream as fallback
       │
       ▼
Return sorted, filtered stream list to Stremio
```

When a torrent is cached on your debrid service, Stremio plays it as a direct HTTP stream at full speed — no buffering, no seeding wait.

---

## Quick Start

### Option 1: Docker Compose (recommended)

```bash
git clone https://github.com/yourname/magnetio.git
cd magnetio

# Start the full stack (scraper + addon + Redis)
docker compose up -d

# Addon is now available at http://localhost:7000
# Scraper API is available at http://localhost:8080
```

### Option 2: Node.js (two terminals)

**Terminal 1 — Scraper:**
```bash
cd scraper
npm install
cp .env.example .env
node index.js       # listens on :8080
```

**Terminal 2 — Addon:**
```bash
cd addon
npm install
cp .env.example .env
# Set SCRAPER_URL=http://localhost:8080 in .env
node index.js       # listens on :7000
```

The addon will be available at `http://localhost:7000`.

---

## Configuration

Open `http://localhost:7000` in your browser to access the **visual configuration page** where you can:

1. Select torrent providers
2. Set quality and language preferences
3. Set subtitle language preferences
4. Enter debrid API keys
5. Copy the manifest URL or click **Install in Stremio**

Magnetio also now exposes:

- `GET /manifest.json` for a root installable addon manifest
- `GET /configure` for the Stremio configuration page
- `GET /:config/configure` to reopen and edit an existing configured addon URL

### Manual configuration URL

You can also build the configuration URL manually:

```
http://your-server:7000/providers=yts,eztv,1337x|sort=qualityseeders|limit=10|RD=YOUR_RD_KEY|PM=YOUR_PM_KEY/manifest.json
```

#### Configuration parameters

| Parameter | Values | Default | Description |
|---|---|---|---|
| `providers` | comma-separated list | all | Torrent providers to use |
| `sort` | `qualityseeders`, `qualitysize`, `seeders`, `size` | `qualityseeders` | Stream sort order |
| `limit` | integer | `10` | Max streams per source |
| `qualities` | `4k,1080p,720p,480p,cam` | all | Quality whitelist |
| `languages` | `en,es,pt,fr,...` | all | Language whitelist |
| `subtitleLanguages` | `en,es,pt,fr,...` | `en` | Subtitle language preference |
| `excludeSizes` | `1GB,2GB,5GB,...` | none | Exclude streams below these sizes |
| `RD` | API key | — | Real-Debrid API key |
| `PM` | API key | — | Premiumize API key |
| `AD` | API key | — | AllDebrid API key |
| `DL` | API key | — | DebridLink API key |
| `ED` | API key | — | EasyDebrid API key |
| `OC` | API key | — | Offcloud API key |
| `TB` | API key | — | TorBox API key |
| `PU` | API key | — | Put.io API key |

### Pre-built configurations

| Preset | Description |
|---|---|
| `lite` | English-only, no cam/screener, minimal providers |
| `brazuca` | Portuguese-focused configuration |

Use a preset by visiting: `http://your-server:7000/lite/manifest.json`

---

## Environment Variables

### Addon (`addon/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `7000` | HTTP port |
| `REDIS_URI` | *(in-memory)* | Redis URI for distributed caching |
| `SCRAPER_URL` | `http://localhost:8080` | URL of the Magnetio scraper service |
| `METRICS_USER` | `admin` | Username for `/swagger` metrics UI |
| `METRICS_PASSWORD` | `magnetio` | Password for metrics UI |
| `OPENSUBTITLES_API_KEY` | — | Enables the addon subtitle resource via OpenSubtitles |
| `OPENSUBTITLES_USERNAME` | — | OpenSubtitles account username for downloadable subtitle links |
| `OPENSUBTITLES_PASSWORD` | — | OpenSubtitles account password for downloadable subtitle links |
| `OPENSUBTITLES_USER_AGENT` | `Magnetio v1.0.0` | Custom User-Agent sent to OpenSubtitles |
| `LOG_LEVEL` | `info` | Logging level |

### Scraper (`scraper/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | HTTP port |
| `REDIS_URI` | *(in-memory)* | Redis URI for result caching |
| `CACHE_TTL_STREAMS` | `3600` | Stream cache TTL in seconds |
| `LOG_LEVEL` | `info` | Logging level |

---

## Architecture

```
┌─────────────────────────────────────────┐
│              Stremio Client             │
└───────────────────┬─────────────────────┘
                    │ HTTP :7000
┌───────────────────▼─────────────────────┐
│          Magnetio Addon (:7000)         │
│  ┌─────────────┐  ┌──────────────────┐  │
│  │  Stream     │  │  Catalog / Meta  │  │
│  │  Handler    │  │  Handler         │  │
│  └──────┬──────┘  └────────┬─────────┘  │
│         │                  │            │
│  ┌──────▼──────────────────▼─────────┐  │
│  │       Filter + Sort Engine        │  │
│  └──────────────────┬────────────────┘  │
│                     │                   │
│  ┌──────────────────▼────────────────┐  │
│  │        Debrid Moch Layer          │  │
│  │  RD | PM | AD | DL | ED | OC | TB │  │
│  └──────────────────┬────────────────┘  │
│                     │                   │
│  ┌──────────────────▼────────────────┐  │
│  │         Redis Cache (:6379)       │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
                    │ HTTP :8080
┌───────────────────▼─────────────────────┐
│     Magnetio Scraper (:8080)            │
│     (fully in-house, no deps)           │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │  Provider Aggregator (parallel)  │   │
│  └──────────────────────────────────┘   │
│                                         │
│  YTS   EZTV  TPB   TGX   1337x  KAT    │
│  Nyaa  AnimeSaturn  Rutor  Rutracker    │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │  Cinemeta metadata lookup        │   │
│  │  Title parser + deduplication    │   │
│  │  Redis cache (:6379)             │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Configuration landing page |
| `GET` | `/configure` | Stremio configuration page |
| `GET` | `/manifest.json` | Root addon manifest |
| `GET` | `/health` | Health check |
| `GET` | `/:config/manifest.json` | Addon manifest |
| `GET` | `/:config/stream/:type/:id.json` | Stream results |
| `GET` | `/:config/catalog/:type/:id.json` | Debrid catalog |
| `GET` | `/:config/meta/:type/:id.json` | Item metadata |
| `GET` | `/:config/subtitles/:type/:id.json` | Subtitle results |
| `GET` | `/swagger` | Prometheus metrics (auth required) |

---

## Development

```bash
# Terminal 1 — scraper
cd scraper && npm install && npm run dev

# Terminal 2 — addon
cd addon && npm install && npm run dev
```

### Project Structure

```
magnetio/
├── docker-compose.yml         # Full stack: scraper + addon + Redis
│
├── scraper/                   # In-house torrent scraper back-end
│   ├── index.js               # Express API server (:8080)
│   ├── lib/
│   │   ├── cinemeta.js        # IMDb → title/year/season/episode lookup
│   │   ├── titleHelper.js     # Quality, codec, language parser
│   │   ├── httpClient.js      # Throttled HTTP client with retries
│   │   ├── cache.js           # Redis/in-memory cache
│   │   └── logger.js          # Winston logger
│   └── providers/
│       ├── index.js           # Parallel aggregator + deduplication
│       ├── yts.js             # YTS JSON API
│       ├── eztv.js            # EZTV JSON API
│       ├── thepiratebay.js    # apibay.org JSON API
│       ├── torrentgalaxy.js   # HTML scraper
│       ├── leetx.js           # HTML scraper (detail pages)
│       ├── kickasstorrents.js # HTML scraper
│       ├── nyaa.js            # Atom RSS feed
│       ├── animesaturn.js     # HTML scraper (Italian anime)
│       ├── rutor.js           # HTML scraper (Russian)
│       └── rutracker.js       # HTML scraper (Russian, topic resolve)
│
└── addon/                     # Stremio addon (:7000)
    ├── index.js               # Express server + metrics
    ├── serverless.js          # SDK router + configure endpoints
    ├── addon.js               # Stremio builder (stream/catalog/meta/subtitles)
    ├── lib/
    │   ├── manifest.js        # Dynamic manifest generation
    │   ├── configuration.js   # Config parser + presets (lite, brazuca)
    │   ├── repository.js      # Calls scraper service
    │   ├── sort.js            # Quality-tiered sort
    │   ├── filter.js          # Quality/language/size filters
    │   ├── streamInfo.js      # Record → Stremio stream object
    │   ├── subtitles.js       # OpenSubtitles integration
    │   ├── cache.js           # Redis/in-memory cache
    │   ├── languages.js       # Language codes + flag emojis
    │   ├── magnetHelper.js    # Tracker list + magnet builder
    │   ├── namedQueue.js      # Request deduplication
    │   ├── landingTemplate.js # HTML config page
    │   ├── types.js           # Shared enums
    │   └── logger.js          # Winston logger
    └── moch/
        ├── moch.js            # Debrid orchestrator
        ├── mochHelper.js      # Shared utils + per-key blacklist
        ├── options.js         # Debrid service registry
        ├── static.js          # Static stream injections
        ├── realdebrid.js      # Real-Debrid
        ├── premiumize.js      # Premiumize
        ├── alldebrid.js       # AllDebrid
        ├── debridlink.js      # DebridLink
        ├── easydebrid.js      # EasyDebrid
        ├── offcloud.js        # Offcloud
        ├── torbox.js          # TorBox
        └── putio.js           # Put.io
```

### Scraper API

The scraper exposes a simple REST API consumed by the addon:

```
GET /health                           → { status: "ok" }
GET /providers                        → [ { id, name }, ... ]
GET /streams/:type/:id                → { streams: [...] }
GET /streams/:type/:id?providers=yts,eztv  → filtered by provider
```

Stream record shape:
```json
{
  "infoHash":  "abc123...",
  "title":     "Movie.Name.2024.1080p.BluRay.x264",
  "seeders":   248,
  "leechers":  12,
  "size":      8589934592,
  "provider":  "1337x",
  "quality":   "1080p",
  "codec":     "AVC",
  "source":    "BluRay",
  "languages": ["en"],
  "imdbId":    "tt1234567"
}
```

---

## Comparison with Torrentio

| Feature | Torrentio | Magnetio |
|---|:---:|:---:|
| Open source | ✅ | ✅ |
| Self-hostable | ✅ | ✅ |
| Real-Debrid | ✅ | ✅ |
| Premiumize | ✅ | ✅ |
| AllDebrid | ✅ | ✅ |
| DebridLink | ✅ | ✅ |
| TorBox | ✅ | ✅ |
| Put.io | ✅ | ✅ |
| EasyDebrid | ✅ | ✅ |
| Offcloud | ✅ | ✅ |
| Redis caching | ✅ | ✅ |
| Prometheus metrics | ✅ | ✅ |
| Docker Compose | ❌ | ✅ |
| Visual config page | ✅ | ✅ |
| Pre-built presets | ✅ | ✅ |
| ES Modules | ❌ | ✅ |
| Per-key blacklisting | ❌ | ✅ |
| Health check endpoint | ❌ | ✅ |

---

## Disclaimer

Magnetio does not host, store, or distribute any copyrighted content. It aggregates publicly available metadata (torrent hashes, magnet links) from third-party indexers. Users are solely responsible for complying with copyright laws in their jurisdiction.

Debrid service integrations are provided as convenience features. API keys are passed through configuration URLs and are never stored server-side beyond the caching TTL.

---

## License

[Apache License 2.0](LICENSE)
