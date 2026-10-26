# Contributing to Magnetio

Thanks for being here. Magnetio is a self-hosted Stremio addon, and the most
useful contributions are usually small and self-contained: a new torrent
provider, a new debrid service, a bug fix in title parsing.

This guide is written so that **adding a provider is your first contribution**,
not your fifth. You do not need to understand the whole codebase.

- [Ground rules](#ground-rules)
- [Repository layout](#repository-layout)
- [Running it locally](#running-it-locally)
- [Adding a torrent provider](#adding-a-torrent-provider)
- [Adding a debrid service](#adding-a-debrid-service)
- [Tests](#tests)
- [Style](#style)
- [Opening the pull request](#opening-the-pull-request)

---

## Ground rules

1. **No credentials in the repo.** Magnetio's whole premise is that the user's
   API keys never leave the user's server. Never commit a key, a token, or a
   real debrid account. `gitleaks` runs in CI and will fail your PR.
2. **No em-dash in prose, code, or commit messages.** Use commas, periods,
   parentheses, colons, or a regular hyphen. This is a house style rule and it
   is enforced in review.
3. **Every outbound request goes through `lib/httpClient.js`.** It carries the
   rate limiter, the retry policy, and the browser-like headers. Do not call
   `axios` or `fetch` directly from a provider.
4. **Use the shared helpers in `lib/magnetHelper.js`** for infohash extraction
   and size parsing, rather than reimplementing them in a provider. A
   hand-rolled infohash regex is a correctness bug, not a style preference:
   see [Return the right record shape](#3-return-the-right-record-shape).
5. **A provider must never throw.** Wrap the body in `try/catch`, log the
   failure with `logger.warn`, and return `[]`. One broken site must not take
   down a scrape.
6. **Apache-2.0.** By opening a PR you agree your contribution ships under the
   repository's license.

---

## Repository layout

```
addon/                 The Stremio addon: manifest, streams, sorting, subtitles
  moch/                Debrid services (Real-Debrid, Premiumize, TorBox, ...)
  lib/                 Config, filtering, sorting, subtitle pipeline
scraper/               The in-house torrent scraper back end
  providers/           One file per torrent site. This is where you start.
  lib/                 HTTP client, rate limiting, title parsing, SSRF guard
  test/                node:test suites
site/                  The landing and configure pages
deploy/                systemd units and monitoring for a self-hosted box
```

The addon and the scraper are two separate Node services that talk over HTTP.
A provider change only touches `scraper/`.

---

## Running it locally

You need Node 20 or newer.

```bash
git clone https://github.com/peterdsp/Magnetio.git
cd Magnetio

# Scraper
cd scraper
cp .env.example .env
npm install
npm start           # listens on :8080

# Addon, in a second terminal
cd ../addon
cp .env.example .env
npm install
npm start           # listens on :7000
```

Sanity checks against the running scraper:

```bash
curl localhost:8080/health
curl localhost:8080/providers
curl "localhost:8080/streams/movie/tt0068646"            # The Godfather
curl "localhost:8080/streams/series/tt0944947:2:3"       # Game of Thrones S02E03
curl "localhost:8080/streams/movie/tt0068646?providers=bt4g"   # one provider only
```

That last form is how you test your own provider in isolation.

---

## Adding a torrent provider

This is the best first contribution. A provider is one file, one export, and no
knowledge of the rest of the system.

### 1. Copy the template

```bash
cd scraper/providers
cp _template.js mysite.js
```

### 2. Implement the contract

A provider module exports exactly three things:

| Export | Type | Notes |
|---|---|---|
| `id` | `string` | lowercase, no spaces. Users pass this in `?providers=` |
| `name` | `string` | human-readable, used in logs and in the `provider` field |
| `scrape(meta)` | `async function` | returns `Promise<TorrentRecord[]>` |

`meta` is what the scraper knows about the requested content:

```js
{
  name: 'The Godfather',   // title to search for
  year: 1972,              // may be null
  imdbId: 'tt0068646',
  type: 'movie',           // 'movie' | 'series' | 'anime'
  season: 2,               // series only, may be undefined
  episode: 3,              // series only, may be undefined
}
```

Build your query string with `buildSearchQuery(meta)` from
`lib/titleHelper.js` rather than concatenating by hand. It produces
`"Show Name S02E03"` for series and `"Movie Name 1972"` for movies.

### 3. Return the right record shape

```js
{
  infoHash: 'a1b2...',     // REQUIRED, 40-char hex, lowercase
  title:    'The Godfather 1972 1080p BluRay x264',  // REQUIRED, raw release name
  seeders:  142,           // 0 if the site does not expose it
  leechers: 7,             // 0 if the site does not expose it
  size:     8589934592,    // bytes, 0 if unknown
  provider: 'MySite',      // same string as your `name` export
  imdbId:   meta.imdbId,   // pass it through
  ...parseTitle(title),    // adds quality, codec, source, languages, hdr, bitdepth
}
```

Two rules that matter more than they look:

- **`infoHash` must be 40-char lowercase hex, and you must get it from
  `extractInfoHash` in `lib/magnetHelper.js`.** Do not write your own regex.
  A `btih` value arrives in two encodings, 40-char hex and 32-char base32, and
  the shared helper converts base32 to hex. Lowercasing a base32 hash instead
  leaves a 32-char string that is *not* the torrent's infoHash: it will never
  deduplicate against the same torrent found on another site, and a debrid
  service will reject it. The bug stays invisible until the site serves its
  first base32 magnet. Use `parseSize` from the same module for the same
  reason.
- **Do not pre-filter or pre-sort.** Return everything the site gave you.
  `providers/index.js` deduplicates, `addon/lib/filter.js` filters, and
  `addon/lib/sort.js` sorts. A provider that tries to be clever fights the
  pipeline.

### 4. Register it

In `scraper/providers/index.js`, add the import alongside the others and add
the module to `ALL_PROVIDERS`:

```js
import * as mysite from './mysite.js';

const ALL_PROVIDERS = [
  // ...
  mysite,
];
```

### 5. Verify

```bash
cd scraper
npm test                                              # contract test picks it up automatically
curl "localhost:8080/streams/movie/tt0068646?providers=mysite"
curl "localhost:8080/streams/series/tt0944947:2:3?providers=mysite"
```

The contract test in `test/provider-contract.test.js` checks every registered
provider's shape without hitting the network. It will tell you if your `id` is
not unique, if `scrape` is missing, or if the module is not wired into the
aggregator.

### Which sites are worth adding

Prefer, in this order:

1. **Sites with an RSS or JSON search endpoint.** They are stable, cheap, and do
   not break on a CSS change. `bt4g.js` is the model.
2. **Sites behind a Torznab-compatible indexer.** Often you do not need a new
   provider at all: `torznab.js` already covers anything Jackett or Prowlarr can
   reach. Check that first.
3. **HTML scraping with `cheerio`.** Works, but expect to maintain it.

Avoid sites that require an account to search, that sit behind a Cloudflare
managed challenge on every path, or that have no magnet links.

### Reading an existing provider first

| File | Why it is a good reference |
|---|---|
| `subsplease.js` | Simplest correct case: RSS feed, shared magnet helper |
| `bt4g.js` | RSS feed with the size packed into the description |
| `yts.js` | Clean JSON API with real metadata |
| `nyaa.js` | Anime, non-standard season and episode naming |
| `torznab.js` | Generic indexer protocol, ID-based matching |
| `rutracker.js` | Non-Latin titles, `iconv-lite` for legacy encodings |

---

## Adding a debrid service

Slightly more involved than a provider, but still self-contained. Debrid
modules live in `addon/moch/` and are registered in two places:

1. `addon/moch/options.js`, which declares the config key and display name.
2. The `MOCH_MODULES` map in `addon/moch/moch.js`.

A debrid module exports:

| Export | Purpose |
|---|---|
| `getCachedStreams(streams, apiKey)` | bulk cache check, returns a map keyed by infoHash |
| `resolve({ apiKey, infoHash, fileIndex, ... })` | turn one infoHash into a direct link |

Not every service has a bulk cache-check endpoint. If yours does not, return
`null` from `getCachedStreams` and the addon falls back to on-demand entries
automatically (see `ON_DEMAND_LIMIT` in `moch.js`). `easydebrid.js` is the
shortest complete example; `realdebrid.js` is the most thorough.

**You do not need a paid account to open the PR.** Say so in the description
and a maintainer will verify against a live key before merging.

---

## Tests

```bash
cd scraper && npm test
cd addon   && npm test
```

Tests use the built-in `node:test` runner. No framework, no config.

```js
import test from 'node:test';
import assert from 'node:assert/strict';

test('describes the behaviour, not the function name', () => {
  assert.deepEqual(actual, expected);
});
```

What needs a test:

- Any change to title parsing, filtering, sorting, or season and episode
  matching. These are pure functions and regressions here are silent and
  user-visible. See `test/content-filter.test.js`.
- A parsing helper inside your provider (a size parser, an infohash extractor).
  Export it and test it directly.

What does not need a test: the network call itself. We do not mock the sites.
The contract test covers the module shape.

---

## Style

- ES modules, `async`/`await`, two-space indent. Match the file you are editing.
- Comments explain **why**, not what. The existing codebase is dense with
  comments that record a decision or a site quirk, which is the useful kind.
  Follow that.
- `logger.info` for a normal scrape result, `logger.warn` for a provider that
  failed. Never `console.log`.
- Prefix log lines with the provider in brackets: `logger.warn(\`[MySite] ${err.message}\`)`.
- No em-dash. See [Ground rules](#ground-rules).

---

## Opening the pull request

1. Branch off `main`: `git checkout -b provider/mysite`
2. Keep the diff minimal. One provider, or one fix, per PR. Unrelated
   refactors will be asked to come out.
3. Commit messages: `feat(scraper): add MySite provider`,
   `fix(scraper): correct BT4G size parsing`. Conventional prefixes, present
   tense.
4. In the description, say what you actually verified. Paste the output of your
   `?providers=mysite` call. A PR that shows real results from a real query
   gets merged quickly.

CI runs tests and a secret scan. Both must pass.

### Reviews

Maintained by one person in a European timezone, so expect a first response
within a few days rather than a few hours. If a PR goes quiet for a week, a
comment is welcome and not rude.

---

## Where to start

Issues labelled [`good first issue`](https://github.com/peterdsp/Magnetio/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
are each scoped to a single file, and name the file to copy and the interface to
implement. Comment on one to claim it so two people do not do the same work.

Found something not on the list? Open an issue first for anything larger than a
bug fix, so we can agree the shape before you write it.
