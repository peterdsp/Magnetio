import 'dotenv/config';
import crypto from 'crypto';
import { readFileSync } from 'node:fs';
import express from 'express';
import { scrapeAll, listProviders, classifyProviderIds } from './providers/index.js';
import { getMetadata } from './lib/cinemeta.js';
import { getLocalizedTitles, releaseTagsFor } from './lib/localizedTitles.js';
import { cacheWrap } from './lib/cache.js';
import { startCronJobs } from './lib/cron.js';
import { runPrewarm, getPrewarmStatus } from './lib/prewarm.js';
import { logger } from './lib/logger.js';

const app  = express();
const PORT = process.env.PORT || 8080;
const deploymentRevision = (() => {
  try {
    const value = readFileSync(new URL('./.deployment-revision', import.meta.url), 'utf8').trim();
    return /^[a-f0-9]{40}$/.test(value) ? value : undefined;
  } catch { return undefined; }
})();

// Cache TTLs
const TTL_STREAMS = parseInt(process.env.CACHE_TTL_STREAMS ?? '3600', 10);

app.use(express.json());
app.set('trust proxy', 1);

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'magnetio-scraper', version: '1.2.0', revision: deploymentRevision });
});

// ─── Provider list ────────────────────────────────────────────────────────────

app.get('/providers', (_req, res) => {
  res.json({ providers: listProviders() });
});

// ─── Streams endpoint ─────────────────────────────────────────────────────────
//
// GET /streams/:type/:id
//   :type  = movie | series | anime
//   :id    = tt1234567  (movie)
//          = tt1234567:1:2  (series season 1 episode 2)
//          = kitsu:12345    (kitsu anime ID — treated as series)
//
// Query params:
//   providers   = comma-separated provider IDs (optional)
//   languages   = comma-separated audio language codes the user asked for.
//                 Non-English codes add a localized-title and a scene-tag
//                 search pass, so Italian releases of "The Godfather" are found
//                 under "Il Padrino" and "The Godfather ITA".
//   tmdbApiKey  = TMDB key used for the localized-title lookup (optional;
//                 falls back to the server's TMDB_API_KEY)

app.get('/streams/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  const providerIds  = req.query.providers
    ? req.query.providers.split(',').map(s => s.trim()).filter(Boolean)
    : null;

  if (providerIds) {
    const { active, disabled, unknown } = classifyProviderIds(providerIds);

    // A provider this host switched off is not a typo, so it never reports as
    // one. Info, not warn: the caller's config is correct and the operator
    // chose this.
    if (disabled.length) {
      logger.info(`Providers disabled on this host, skipping: ${disabled.join(', ')}`);
    }
    // One bad id should not fail an otherwise good request, but it should not
    // vanish either, or the typo stays invisible.
    if (unknown.length && active.length) {
      logger.warn(`Ignoring unknown provider ids: ${unknown.join(', ')}`);
    }

    if (!active.length) {
      const error = unknown.length
        ? `Unknown provider ids: ${unknown.join(', ')}`
        : `Every requested provider is disabled on this host: ${disabled.join(', ')}`;
      return res.status(400).json({
        error,
        ...(unknown.length  ? { unknownProviders: unknown }   : {}),
        ...(disabled.length ? { disabledProviders: disabled } : {}),
        knownProviders: listProviders().map(p => p.id).sort(),
      });
    }
  }

  const torznabUrl    = req.query.torznabUrl || null;
  const torznabApiKey = req.query.torznabApiKey || null;
  const context = { torznabUrl, torznabApiKey };

  // String() guards against a repeated query param, which Express hands over
  // as an array: this runs before the try block, so a throw here is a 500.
  const languages = req.query.languages
    ? String(req.query.languages).split(',').map(l => l.trim().toLowerCase()).filter(Boolean)
    : [];
  const tmdbApiKey = req.query.tmdbApiKey ? String(req.query.tmdbApiKey) : (process.env.TMDB_API_KEY || null);

  if (!['movie', 'series', 'anime'].includes(type)) {
    return res.status(400).json({ error: 'Invalid type. Use movie, series, or anime.' });
  }

  const torznabSuffix = torznabUrl
    ? `:tz-${crypto.createHash('sha256').update(torznabUrl + (torznabApiKey || '')).digest('hex').slice(0, 12)}`
    : '';
  // Requested languages change which searches run, so they belong in the key.
  // The TMDB key itself must not: it is a secret, and only its presence (which
  // decides whether localized titles are available) affects the result.
  const languageSuffix = languages.length ? `:lang-${[...languages].sort().join('+')}` : '';
  const aliasSuffix    = languages.length && tmdbApiKey ? ':loc' : '';
  const cacheKey = `streams:${type}:${id}:${providerIds?.join(',') ?? 'all'}${torznabSuffix}${languageSuffix}${aliasSuffix}`;

  try {
    const { value: streams, cached } = await cacheWrap(cacheKey, async () => {
      // 1. Resolve metadata (title, year, season, episode)
      const meta = await getMetadata(type === 'anime' ? 'series' : type, id);
      if (!meta) {
        logger.warn(`No metadata for ${type}/${id}, skipping`);
        return [];
      }

      const label = meta.year ? `"${meta.name}" (${meta.year})` : `"${meta.name}"`;
      logger.info(`Scraping ${label} [${type}] from ${providerIds?.join(',') ?? 'all providers'}`);

      // 2. For non-English audio, resolve the titles the content is released
      //    under locally and the scene tags for those languages. Both are empty
      //    for an English-only request, which keeps the default path unchanged.
      const enriched = {
        ...meta,
        aliases:    await getLocalizedTitles(meta, languages, tmdbApiKey),
        searchTags: releaseTagsFor(languages),
      };

      // 3. Scrape all providers in parallel
      return scrapeAll(type, enriched, providerIds, context);
    }, TTL_STREAMS);

    res.json({ streams, cached });
  } catch (err) {
    logger.error(`Streams error [${id}]: ${err.message}`);
    res.status(500).json({ error: err.message, streams: [] });
  }
});

// ─── Prewarm ─────────────────────────────────────────────────────────────────

app.post('/prewarm', (_req, res) => {
  const { running } = getPrewarmStatus();
  if (running) return res.status(409).json({ error: 'Prewarm already running' });
  runPrewarm().catch(err => logger.error(`[Prewarm] ${err.message}`));
  res.status(202).json({ message: 'Prewarm started' });
});

app.get('/prewarm/status', (_req, res) => {
  res.json(getPrewarmStatus());
});

// ─── 404 ──────────────────────────────────────────────────────────────────────

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ─── Start ────────────────────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
  logger.info(`Magnetio scraper running on port ${PORT}`);
  startCronJobs();
});

const shutdown = () => {
  logger.info('Shutting down…');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;
