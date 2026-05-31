<p align="center">
  <img src="https://img.shields.io/badge/Magnetio-v1.1.5-10b981?style=for-the-badge&labelColor=1a1a2e" alt="Magnetio Version" />
  <img src="https://img.shields.io/badge/license-Apache--2.0-blue?style=for-the-badge&labelColor=1a1a2e" alt="License" />
  <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=for-the-badge&logo=node.js&labelColor=1a1a2e" alt="Node.js" />
  <img src="https://img.shields.io/badge/docker-ready-2496ed?style=for-the-badge&logo=docker&labelColor=1a1a2e" alt="Docker" />
  <img src="https://img.shields.io/badge/stremio-addon-7b5bf5?style=for-the-badge&labelColor=1a1a2e" alt="Stremio Addon" />
  <img src="https://img.shields.io/badge/debrid-8%20services-ff6b6b?style=for-the-badge&labelColor=1a1a2e" alt="Debrid Services" />
  <img src="https://img.shields.io/badge/torznab-Jackett%20%2F%20Prowlarr-f5a623?style=for-the-badge&labelColor=1a1a2e" alt="Torznab Jackett Prowlarr" />
</p>

<h1 align="center">Magnetio</h1>

<p align="center">
  <strong>A fully self-hosted Stremio addon with 22+ torrent providers, 8 debrid services, Torznab/Jackett/Prowlarr integration, and TMDB recommendations.</strong>
</p>

<p align="center">
  No external scraper dependency. No third-party backend. Your API keys never leave your server.<br />
  <a href="https://magnetio.peterdsp.dev">magnetio.peterdsp.dev</a> | <a href="https://magnetio.peterdsp.dev/configure">Configure and Install</a>
</p>

---

## What is Magnetio?

Magnetio is an open-source, self-hostable **Stremio addon** that comes with its own **built-in torrent scraper**. It queries 22 torrent providers in parallel (including Torznab-compatible indexers via Jackett or Prowlarr), deduplicates results, and optionally resolves them into **instant direct-download streams** through your debrid service of choice.

Everything runs on your own hardware (a Raspberry Pi is enough). No cloud subscriptions, no external scraper APIs, no data leaving your network.

### Why Magnetio?

| | Magnetio | Typical Stremio addons |
|:---|:---:|:---:|
| Fully in-house scraping | Yes | Depends on external APIs |
| Self-hosted, private | Yes | Often cloud-hosted |
| 22 torrent providers + Torznab | Yes | Varies |
| Jackett / Prowlarr support | Yes | Rare |
| 8 debrid services | Yes | 1-3 typically |
| Background prewarm | Yes | No |
| Per-user config (providers, quality, language) | Yes | Limited |
| Subtitle sync pipeline | Yes | No |
| Redis caching with stale-while-revalidate | Yes | Basic or none |
| Prometheus metrics | Yes | Rare |
| Docker Compose one-command deploy | Yes | Varies |

---

## How It Works

```
                          You open a movie in Stremio
                                     |
                                     v
                    +---------------------------------+
                    |     Magnetio Addon (:7000)      |
                    |  Receives stream/catalog/meta   |
                    |  request from Stremio client    |
                    +---------------------------------+
                                     |
                         Calls internal scraper
                                     |
                                     v
                    +---------------------------------+
                    |    Magnetio Scraper (:8080)     |
                    |  Queries up to 21 providers     |
                    |  in parallel (max 4 concurrent) |
                    |  22s timeout per provider       |
                    +---------------------------------+
                                     |
                    Deduplicates by infoHash (keeps
                    highest-seeder entry per hash)
                                     |
                    Content-filters results against
                    the actual requested title/season
                                     |
                                     v
                    +---------------------------------+
                    |     Back to Addon               |
                    |  Applies quality/language/size   |
                    |  filters from user config       |
                    |  Sorts by chosen strategy       |
                    +---------------------------------+
                                     |
                          If debrid keys present:
                      check instant availability
                      on each configured service
                                     |
                          +---------+---------+
                          |                   |
                       Cached              Not cached
                     Resolve to           Keep as P2P
                     direct HTTP          magnet fallback
                     stream URL           (or prewarm it)
                          |                   |
                          +---------+---------+
                                     |
                                     v
                       Return sorted stream list
                       to Stremio for playback
```

When a torrent is already cached on your debrid service, Stremio plays it as a direct HTTP stream at full speed. No buffering, no seeding wait, no port forwarding.

---

## Supported Torrent Providers

Magnetio ships with **22 providers** covering movies, TV series, and anime, plus Torznab support for connecting external indexer managers.

### Movies and TV

| Provider | ID | Content | Method |
|:---|:---|:---|:---|
| YTS | `yts` | Movies only | JSON API |
| EZTV | `eztv` | Series only | JSON API |
| The Pirate Bay | `thepiratebay` | Movies, Series | JSON API (apibay.org) |
| TorrentGalaxy | `torrentgalaxy` | Movies, Series | HTML scraper |
| 1337x | `leetx` | Movies, Series | HTML scraper (detail pages) |
| KickassTorrents | `kickasstorrents` | Movies, Series | HTML scraper |
| LimeTorrents | `limetorrents` | Movies, Series | HTML scraper |
| Bitsearch | `bitsearch` | Movies, Series | HTML scraper |
| BT4G | `bt4g` | Movies, Series | HTML scraper |
| BTDig | `btdig` | Movies, Series | HTML scraper |
| GloTorrents | `glotorrents` | Movies, Series | HTML scraper |
| TorLock | `torlock` | Movies, Series | HTML scraper |
| TorrentDownloads | `torrentdownloads` | Movies, Series | HTML scraper |
| TheRarBG | `therarbg` | Movies, Series | HTML scraper (RARBG successor) |
| Rutor | `rutor` | Movies, Series | HTML scraper (Russian) |
| Rutracker | `rutracker` | Movies, Series | HTML scraper (Russian) |

### Anime

| Provider | ID | Method |
|:---|:---|:---|
| Nyaa | `nyaa` | Atom RSS feed |
| AnimeSaturn | `animesaturn` | HTML scraper (Italian) |
| SubsPlease | `subsplease` | JSON API (fansubs) |
| AnimeTosho | `animetosho` | RSS feed (aggregator) |
| nekoBT | `nekobt` | Torznab API (fansubs) |

### Torznab / Jackett / Prowlarr

| Provider | ID | Method |
|:---|:---|:---|
| Torznab | `torznab` | Torznab XML API (any compatible endpoint) |

The Torznab provider is a universal connector that works with any Torznab-compatible indexer manager. Configure the API URL and key on the configure page. Magnetio will search all indexers you have set up in your Jackett or Prowlarr instance.

- **[Jackett](https://github.com/Jackett/Jackett)** - translates queries to 500+ tracker-specific requests. Free, open-source (MIT).
- **[Prowlarr](https://github.com/Prowlarr/Prowlarr)** - newer indexer manager with tighter *arr integration. Free, open-source (GPL-3.0).

Both are available as optional Docker Compose services (see [Quick Start](#quick-start)).

All providers run in parallel with a concurrency limit of 4 and a 22-second timeout. Results are deduplicated by `infoHash`, keeping the entry with the highest seeder count.

---

## Debrid Services

Debrid services cache torrents server-side and serve them as direct HTTP links, giving you instant, full-speed streams with no seeding required.

| Service | Code | Cache Check | Catalog | Prewarm |
|:---|:---:|:---:|:---:|:---:|
| [Real-Debrid](https://real-debrid.com) | `RD` | Yes | Yes | Yes |
| [Premiumize](https://premiumize.me) | `PM` | Yes | Yes | No |
| [AllDebrid](https://alldebrid.com) | `AD` | Yes | No | Yes |
| [DebridLink](https://debrid-link.com) | `DL` | No | Yes | Yes |
| [EasyDebrid](https://easydebrid.com) | `ED` | Yes | No | No |
| [Offcloud](https://offcloud.com) | `OC` | No | No | Yes |
| [TorBox](https://torbox.app) | `TB` | Yes | Yes | Yes |
| [Put.io](https://put.io) | `PU` | No | Yes | Yes |

You can configure multiple debrid services simultaneously. Each one is checked independently for cached content.

---

## Quick Start

### Docker Compose (recommended)

```bash
git clone https://github.com/peterdsp/Magnetio.git
cd Magnetio

# Start all three services (scraper + addon + redis)
docker compose up -d

# Optional: include Jackett for 500+ additional indexers
docker compose --profile jackett up -d

# Optional: include Prowlarr instead (or alongside)
docker compose --profile prowlarr up -d

# Open in browser
open http://localhost:7000
```

That is it. The addon runs on port 7000, the scraper on 8080, and Redis on 6379. Jackett runs on 9117 and Prowlarr on 9696 (both optional). All services share a Docker bridge network.

### Node.js (manual, two terminals)

**Terminal 1 (Scraper):**
```bash
cd scraper
npm install
cp .env.example .env    # edit if needed
node index.js            # listens on :8080
```

**Terminal 2 (Addon):**
```bash
cd addon
npm install
cp .env.example .env    # set SCRAPER_URL=http://localhost:8080
node index.js            # listens on :7000
```

Open `http://localhost:7000` to access the configuration page.

---

## Configuration

### Visual Configuration Page

Navigate to `http://your-server:7000` in a browser. The configuration page lets you:

1. **Set quality filters** (4K, 1080p, 720p, 480p, CAM)
2. **Set language preferences** for streams and subtitles
3. **Connect Torznab indexers** (Jackett, Prowlarr, or any Torznab endpoint)
4. **Enter debrid API keys** (with show/hide toggle)
5. **Configure sort order and result limits**
6. **Enable or disable background prewarm**
7. **Copy the manifest URL** or click **Install in Stremio**

The generated URL encodes your preferences in a pipe-delimited config string that becomes part of the manifest path. No server-side storage of user settings.

### Manual URL Format

```
https://your-server:7000/providers=yts,eztv,1337x|sort=qualityseeders|limit=10|RD=YOUR_KEY/manifest.json
```

### All Configuration Parameters

| Parameter | Values | Default | Description |
|:---|:---|:---|:---|
| `providers` | Comma-separated provider IDs | All 21 | Which torrent providers to query |
| `sort` | `qualityseeders`, `qualitysize`, `seeders`, `size` | `qualityseeders` | How to rank streams |
| `limit` | `1` to `50` | `10` | Max streams returned per request |
| `qualities` | `4k`, `1080p`, `720p`, `480p`, `cam` | All | Quality whitelist |
| `languages` | ISO codes (`en`, `es`, `pt`, `fr`, `de`, `it`, `ja`, `ru`, ...) | All | Stream language filter |
| `subtitleLanguages` | ISO codes | `en` | Subtitle language preference |
| `torznabUrl` | Full Torznab API URL | - | Torznab endpoint (Jackett/Prowlarr) |
| `torznabKey` | API key | - | Torznab API key |
| `prewarm` | `1`, `0`, `true`, `false` | `1` | Background-add top uncached torrents to debrid |
| `prewarmLimit` | `0` to `10` | `3` | How many uncached results to prewarm per service |
| `excludeSizes` | Size thresholds like `1GB,2GB` | None | Exclude streams below these sizes |
| `maxSize` | Bytes | None | Maximum file size |
| `RD` | API key | - | Real-Debrid |
| `PM` | API key | - | Premiumize |
| `AD` | API key | - | AllDebrid |
| `DL` | API key | - | DebridLink |
| `ED` | API key | - | EasyDebrid |
| `OC` | API key | - | Offcloud |
| `TB` | API key | - | TorBox |
| `PU` | API key | - | Put.io |

### Presets

Quick-start configurations for common use cases:

| Preset | What it does |
|:---|:---|
| `lite` | English-only, no CAM/screener, 3 providers, limit 5 |
| `brazuca` | Portuguese-focused, 4 providers, limit 10 |

Use a preset: `https://your-server:7000/lite/manifest.json`

---

## Architecture

Magnetio is a three-service stack, each with a clear responsibility:

```
magnetio/
|
|   docker-compose.yml             # Orchestrates all three services
|
+-- scraper/                       # Torrent scraper backend
|   |   index.js                   # Express server (:8080)
|   |   package.json
|   +-- lib/
|   |   |   cache.js               # Redis/in-memory cache (Keyv)
|   |   |   catalog.js             # Cinemeta top-content fetcher for prewarm
|   |   |   cinemeta.js            # IMDb ID to title/year/season/episode resolver
|   |   |   cron.js                # Scheduled prewarm job (node-cron)
|   |   |   httpClient.js          # Throttled Axios client with retries (Bottleneck)
|   |   |   logger.js              # Winston structured logging
|   |   |   magnetHelper.js        # Shared infoHash extraction, base32, size parsing
|   |   |   prewarm.js             # Prewarm orchestrator (scrapes top content into cache)
|   |   +-- titleHelper.js         # Quality/codec/source/language/HDR parser
|   +-- providers/
|       |   index.js               # Parallel aggregator, deduplication, content filter
|       |   yts.js                 # ...21 built-in provider modules
|       |   torznab.js             # Universal Torznab provider (Jackett/Prowlarr)
|       +-- ...
|
+-- addon/                         # Stremio addon frontend
|   |   index.js                   # Express server (:7000) + Prometheus metrics
|   |   serverless.js              # Stremio SDK router + configure + subtitle proxy
|   |   addon.js                   # Stremio resource handlers (stream/catalog/meta/subtitles)
|   |   package.json
|   +-- lib/
|   |   |   manifest.js            # Dynamic Stremio manifest generation
|   |   |   configuration.js       # Config URL parser + presets
|   |   |   repository.js          # HTTP client to call the scraper service
|   |   |   sort.js                # Quality-tiered stream sorting
|   |   |   filter.js              # Quality/language/size stream filtering
|   |   |   streamInfo.js          # Torrent record to Stremio stream object mapper
|   |   |   subtitles.js           # OpenSubtitles search integration
|   |   |   subtitleProxy.js       # Subtitle download + sync pipeline
|   |   |   cache.js               # Redis/in-memory cache (Keyv)
|   |   |   languages.js           # Language codes, names, flag emojis
|   |   |   magnetHelper.js        # Best-tracker list + magnet URI builder
|   |   |   namedQueue.js          # Request deduplication (prevents duplicate in-flight)
|   |   |   landingTemplate.js     # HTML/CSS/JS for the visual config page
|   |   |   types.js               # Shared enums and type definitions
|   |   +-- logger.js              # Winston structured logging
|   +-- moch/                      # Debrid service integrations
|       |   moch.js                # Debrid orchestrator (cache check + resolve)
|       |   mochHelper.js          # Shared utils, per-key blacklisting
|       |   options.js             # Debrid service registry
|       |   static.js              # Static stream injections
|       |   realdebrid.js          # Real-Debrid API client
|       |   premiumize.js          # Premiumize API client
|       |   alldebrid.js           # AllDebrid API client
|       |   debridlink.js          # DebridLink API client
|       |   easydebrid.js          # EasyDebrid API client
|       |   offcloud.js            # Offcloud API client
|       |   torbox.js              # TorBox API client
|       +-- putio.js               # Put.io API client
|
+-- .github/workflows/
    +-- deploy.yml                 # CI/CD: validate, test, deploy via GitHub Actions
```

### Service Communication

```
+------------------+         +-------------------+         +--------+
|  Stremio Client  | ------> |  Addon (:7000)    | ------> | Redis  |
|  (your TV/phone) |  HTTP   |  stream/catalog   |  cache  | (:6379)|
+------------------+         |  debrid resolve   | <------ +--------+
                              +--------+----------+              ^
                                       |                         |
                                       | HTTP :8080              |
                                       v                         |
                              +-------------------+              |
                              | Scraper (:8080)   | ------------>+
                              | provider queries  |    cache
                              | dedup + filter    |
                              +-------------------+
```

---

## API Reference

### Addon Endpoints (`:7000`)

| Method | Path | Description |
|:---|:---|:---|
| `GET` | `/` | Visual configuration page |
| `GET` | `/configure` | Stremio configuration endpoint |
| `GET` | `/manifest.json` | Root addon manifest (default config) |
| `GET` | `/:config/manifest.json` | User-configured addon manifest |
| `GET` | `/:config/stream/:type/:id.json` | Stream results for a title |
| `GET` | `/:config/catalog/:type/:id.json` | Debrid catalog (library browsing) |
| `GET` | `/:config/meta/:type/:id.json` | Title metadata |
| `GET` | `/:config/subtitles/:type/:id.json` | Subtitle results |
| `GET` | `/proxy/subtitle/:id.srt` | Subtitle proxy with optional sync |
| `GET` | `/health` | Health check (`{ status: "ok" }`) |
| `GET` | `/stats` | Analytics dashboard (request counts, unique users) |
| `GET` | `/swagger` | Prometheus metrics UI (auth required) |

### Scraper Endpoints (`:8080`)

| Method | Path | Description |
|:---|:---|:---|
| `GET` | `/health` | Health check |
| `GET` | `/providers` | List all available provider IDs and names |
| `GET` | `/streams/:type/:id` | Scrape all providers for a title |
| `GET` | `/streams/:type/:id?providers=yts,eztv` | Scrape specific providers only |
| `POST` | `/prewarm` | Manually trigger cache prewarm |
| `GET` | `/prewarm/status` | Check prewarm job status |

### Stream Record Shape

Each torrent result from the scraper follows this structure:

```json
{
  "infoHash":  "a1b2c3d4e5f6...",
  "title":     "Movie.Name.2024.1080p.BluRay.x264-GROUP",
  "seeders":   248,
  "leechers":  12,
  "size":      8589934592,
  "provider":  "1337x",
  "quality":   "1080p",
  "codec":     "AVC",
  "source":    "BluRay",
  "languages": ["en"],
  "hdr":       null,
  "imdbId":    "tt1234567"
}
```

---

## Caching Strategy

Both services use **Keyv** backed by Redis (falls back to in-memory if Redis is unavailable).

| What | TTL | Notes |
|:---|:---|:---|
| Scraper stream results | 1 hour | Per title, deduplicated |
| Addon stream responses | 1 hour | Stale-while-revalidate: 1h, stale-on-error: 4h |
| Empty results | Never cached | Prevents cache poisoning from transient failures |
| Prewarm scraper cache | 4 hours | Pre-populated by scheduled job |
| Debrid prewarm flags | 6 hours | Prevents re-adding already-prewarmed torrents |
| Addon router instances | 5 min | LRU with max 64 entries |
| Subtitle proxy cache | 1 hour | Per stream-specific subtitle |

---

## Special Features

### Background Prewarm

Magnetio can proactively warm the cache and your debrid accounts:

- **Scraper prewarm**: A cron job (default: daily at 4 AM) fetches the top 50 movies and 20 series from Cinemeta, scrapes all providers for each, and stores results in Redis. When a user later requests one of these titles, the response is instant.
- **Debrid prewarm**: After filtering and sorting streams for a user request, Magnetio background-adds the top uncached torrents (configurable, default 3) to your debrid account. This is non-blocking. By the time you click play, the torrent may already be downloading or fully cached.

### Subtitle Sync Pipeline

For debrid/direct HTTP streams, Magnetio can serve stream-specific subtitles:

1. Fingerprints the media file (filename, size, OpenSubtitles hash via byte-range)
2. Searches OpenSubtitles for the best match
3. Downloads the subtitle
4. Optionally runs `ffsubsync` (audio-based alignment) or `alass` (split/framerate correction)
5. Caches and serves the corrected `.srt`

This works reliably for debrid streams where the addon has access to the final HTTP URL.

### Content Filtering

The scraper validates that returned torrents actually match the requested content:

- For movies: title must contain at least part of the movie name
- For series: title must contain a matching season/episode marker (S01E02, 1x02, "Season 1", etc.)
- Word matching with a 50% threshold for multi-word titles
- Prevents unrelated results from polluting the stream list

### Analytics

Redis-backed, best-effort usage tracking:

- Daily request counts and per-type breakdowns (stream, catalog, subtitle, page views)
- Unique users via HyperLogLog (privacy-preserving, no PII stored)
- 7-day rolling history
- Available at `/stats`

### Request Deduplication

A `NamedQueue` system prevents duplicate in-flight requests. If 10 users request the same movie at the same instant, the scraper runs once and all 10 get the same result.

---

## Deployment

### Production with Docker Compose

```bash
# Clone and configure
git clone https://github.com/peterdsp/Magnetio.git
cd Magnetio
cp .env.example .env

# Edit .env with your settings (at minimum):
# ADDON_PUBLIC_URL=https://your-domain.com
# METRICS_PASSWORD=your-secure-password

# Launch
docker compose up -d
```

### GitHub Actions CI/CD

The included workflow (`.github/workflows/deploy.yml`) handles automated deployment:

1. **Validate**: `npm ci` + `npm test` on Node 22
2. **Deploy**: `rsync` to your server, preserving `.env` files
3. **Build**: `docker compose up -d --build --remove-orphans` on the target
4. **Health check**: Optional ping to your `/health` endpoint

The workflow runs on a self-hosted GitHub Actions runner. Push to `main` triggers automatic deployment.

### Exposing to the Internet

Stremio requires HTTPS for addon URLs. Common approaches:

- **Cloudflare Tunnel** or **Cloudflare DNS proxy** pointing to your server
- **Nginx reverse proxy** with Let's Encrypt SSL
- **Tailscale** or **WireGuard** for private access

The `ADDON_PUBLIC_URL` environment variable controls what base URL appears in manifests. The landing page uses `location.origin` which automatically resolves to your public domain when accessed through it.

---

## Environment Variables

### Addon (`addon/.env`)

| Variable | Default | Description |
|:---|:---|:---|
| `PORT` | `7000` | HTTP port |
| `REDIS_URI` | In-memory | Redis connection string |
| `SCRAPER_URL` | `http://localhost:8080` | Internal scraper service URL |
| `ADDON_PUBLIC_URL` | Auto-detected | Public URL for manifest and subtitle links |
| `METRICS_USER` | `admin` | Username for `/swagger` metrics |
| `METRICS_PASSWORD` | `magnetio` | Password for `/swagger` metrics |
| `OPENSUBTITLES_API_KEY` | - | Enables subtitle resource |
| `OPENSUBTITLES_USERNAME` | - | OpenSubtitles account (for downloads) |
| `OPENSUBTITLES_PASSWORD` | - | OpenSubtitles account password |
| `OPENSUBTITLES_USER_AGENT` | `Magnetio v1.0.0` | User-Agent for OpenSubtitles API |
| `FFSUBSYNC_PATH` | Auto-detected | Path to `ffsubsync` binary |
| `ALASS_PATH` | Auto-detected | Path to `alass` binary |
| `SUBTITLE_SYNC_MAX_OFFSET_SECONDS` | `300` | Max offset for ffsubsync |
| `ALASS_SPLIT_PENALTY` | `10` | Split penalty for alass |
| `LOG_LEVEL` | `info` | Winston log level |

### Scraper (`scraper/.env`)

| Variable | Default | Description |
|:---|:---|:---|
| `PORT` | `8080` | HTTP port |
| `REDIS_URI` | In-memory | Redis connection string |
| `CACHE_TTL_STREAMS` | `3600` | Stream result cache TTL (seconds) |
| `PREWARM_CRON` | `0 4 * * *` | Cron schedule for prewarm job |
| `PREWARM_MOVIES` | `50` | Number of top movies to prewarm |
| `PREWARM_SERIES` | `20` | Number of top series to prewarm |
| `LOG_LEVEL` | `info` | Winston log level |

### Optional Services

| Variable | Default | Description |
|:---|:---|:---|
| `JACKETT_PORT` | `9117` | Exposed port for Jackett UI (profile: `jackett`) |
| `PROWLARR_PORT` | `9696` | Exposed port for Prowlarr UI (profile: `prowlarr`) |
| `TZ` | `Etc/UTC` | Timezone for Jackett/Prowlarr containers |

Start optional services with Docker Compose profiles:

```bash
docker compose --profile jackett up -d                    # Jackett only
docker compose --profile prowlarr up -d                   # Prowlarr only
docker compose --profile jackett --profile prowlarr up -d # Both
```

---

## Tech Stack

| Layer | Technology |
|:---|:---|
| Runtime | Node.js >= 18 (CI runs on 22) |
| Module system | ES Modules throughout |
| HTTP framework | Express 4 |
| Stremio integration | stremio-addon-sdk |
| HTML parsing | Cheerio |
| HTTP client | Axios |
| Rate limiting | Bottleneck (scraper), p-limit + p-queue (addon) |
| Caching | Redis 7 Alpine via Keyv |
| Monitoring | swagger-stats + prom-client (Prometheus) |
| Scheduling | node-cron |
| Logging | Winston |
| Subtitle sync | ffsubsync, alass (optional) |
| Containerization | Docker Compose v3.9 |
| CI/CD | GitHub Actions (self-hosted runner) |

---

## Development

```bash
# Start Redis (or use in-memory fallback)
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Terminal 1: Scraper
cd scraper && npm install && npm run dev

# Terminal 2: Addon
cd addon && npm install && npm run dev
```

### Running Tests

```bash
cd addon && npm test
```

---

## Disclaimer

Magnetio does not host, store, or distribute any copyrighted content. It aggregates publicly available metadata (torrent hashes, magnet links) from third-party indexers. Users are solely responsible for complying with copyright laws in their jurisdiction.

Debrid service integrations are convenience features. API keys are passed through configuration URLs and are never stored server-side beyond the caching TTL.

---

## License

[Apache License 2.0](LICENSE)
