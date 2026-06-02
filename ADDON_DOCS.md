<p align="center">
  <img src="https://magnetio.peterdsp.dev/og-image.png" alt="Magnetio" width="600" />
</p>

<h1 align="center">Magnetio</h1>

<p align="center">
  <strong>Self-hosted Stremio addon with 22+ torrent providers, 8 debrid services, and smart recommendations.</strong>
</p>

<p align="center">
  <a href="https://magnetio.peterdsp.dev/configure">Configure & Install</a> |
  <a href="https://github.com/peterdsp/Magnetio">Source Code</a>
</p>

---

## What is Magnetio?

Magnetio is a free, open-source Stremio addon that comes with its own built-in torrent scraper. It queries 22+ torrent providers in parallel, deduplicates results, and optionally resolves them into instant direct-download streams through your debrid service of choice.

Everything runs on your own hardware (a Raspberry Pi is enough). No cloud subscriptions, no external scraper APIs, no data leaving your network. Your API keys never leave your server.

---

## 🔎 Advanced Scraping Capabilities

- **22+ built-in torrent providers** queried in parallel (YTS, EZTV, ThePirateBay, 1337x, TorrentGalaxy, KickassTorrents, Nyaa, and more)
- **Torznab/Jackett/Prowlarr support** for 500+ additional indexers through a single universal connector
- **Smart early-return** returns results in 3-6 seconds without waiting for slow providers
- **Intelligent deduplication** by infoHash, keeping the entry with the highest seeder count
- **Content filtering** validates that results actually match the requested title, season, and episode
- **Background prewarm** pre-scrapes top 500 movies and 200 series daily for instant cache hits
- **24-hour caching** with Redis for near-instant repeated lookups

## 🎬 Streaming Provider Integration

Magnetio supports 8 debrid services for instant cached streams at full speed:

| Service | Cache Check | Library Catalog | Background Prewarm |
|:---|:---:|:---:|:---:|
| [Real-Debrid](https://real-debrid.com) | Yes | Yes | Yes |
| [Premiumize](https://premiumize.me) | Yes | Yes | No |
| [AllDebrid](https://alldebrid.com) | Yes | No | Yes |
| [DebridLink](https://debrid-link.com) | No | Yes | Yes |
| [EasyDebrid](https://easydebrid.com) | Yes | No | No |
| [Offcloud](https://offcloud.com) | No | No | Yes |
| [TorBox](https://torbox.app) | Yes | Yes | Yes |
| [Put.io](https://put.io) | No | Yes | Yes |

Without a debrid service, Magnetio returns raw torrent/magnet streams instead.

## 🛠️ Enhanced Additional Features

- **TMDB Recommendations** - "More Like This" catalog powered by TMDB for every movie and series
- **Subtitle search and sync** - OpenSubtitles integration with automatic ffsubsync/alass alignment
- **Per-user configuration** - Quality filters (4K, 1080p, 720p), language preferences, provider selection
- **Multiple sort strategies** - Quality+seeders, quality+size, seeders only, size only
- **Debrid prewarm** - Background-adds top uncached torrents to your debrid account for faster playback
- **Prometheus metrics** - Built-in analytics dashboard with request counts and unique user tracking
- **Docker Compose deploy** - One command to run the entire stack (scraper + addon + Redis)
- **Privacy-first** - Self-hosted, no telemetry, no cloud dependency, API keys stay on your server

---

## Supported Content

| Type | Sources |
|:---|:---|
| Movies | 16 providers + Torznab |
| TV Series | 16 providers + Torznab |
| Anime | 5 specialized providers (Nyaa, AnimeSaturn, SubsPlease, AnimeTosho, nekoBT) |

---

## Quick Start

### Docker (recommended)

```bash
git clone https://github.com/peterdsp/Magnetio.git
cd Magnetio
docker compose up -d
```

Open [http://localhost:7000](http://localhost:7000) to configure and install.

### With Jackett / Prowlarr

```bash
docker compose --profile jackett up -d      # Add Jackett
docker compose --profile prowlarr up -d     # Add Prowlarr
```

---

## Configuration

Visit `https://your-server:7000/configure` to set up:

1. **Stream quality and language filters**
2. **Torznab/Jackett/Prowlarr** connection (URL + API key)
3. **TMDB API key** for similar content recommendations
4. **Debrid service API keys** (with direct links to each provider's API page)
5. **Sort order and result limits**

The generated manifest URL encodes your preferences and installs into Stremio with one click.

---

## Links

- **Website**: [magnetio.peterdsp.dev](https://magnetio.peterdsp.dev)
- **Configure**: [magnetio.peterdsp.dev/configure](https://magnetio.peterdsp.dev/configure)
- **Source code**: [github.com/peterdsp/Magnetio](https://github.com/peterdsp/Magnetio)
- **License**: Apache 2.0

---

## Disclaimer

Magnetio does not host, store, or distribute any copyrighted content. It aggregates publicly available metadata (torrent hashes, magnet links) from third-party indexers. Users are solely responsible for complying with copyright laws in their jurisdiction.
