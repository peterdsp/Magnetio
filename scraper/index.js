import 'dotenv/config';
import express from 'express';
import { scrapeAll, listProviders } from './providers/index.js';
import { getMetadata } from './lib/cinemeta.js';
import { cacheWrap } from './lib/cache.js';
import { logger } from './lib/logger.js';

const app  = express();
const PORT = process.env.PORT || 8080;

// Cache TTLs
const TTL_STREAMS = parseInt(process.env.CACHE_TTL_STREAMS ?? '3600', 10);

app.use(express.json());
app.set('trust proxy', true);

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'magnetio-scraper', version: '1.1.3' });
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
//   providers  = comma-separated provider IDs (optional)

app.get('/streams/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  const providerIds  = req.query.providers
    ? req.query.providers.split(',').map(s => s.trim()).filter(Boolean)
    : null;

  if (!['movie', 'series', 'anime'].includes(type)) {
    return res.status(400).json({ error: 'Invalid type. Use movie, series, or anime.' });
  }

  const cacheKey = `streams:${type}:${id}:${providerIds?.join(',') ?? 'all'}`;

  try {
    const streams = await cacheWrap(cacheKey, async () => {
      // 1. Resolve metadata (title, year, season, episode)
      const meta = await getMetadata(type === 'anime' ? 'series' : type, id);
      if (!meta) {
        logger.warn(`No metadata for ${type}/${id}, skipping`);
        return [];
      }

      const label = meta.year ? `"${meta.name}" (${meta.year})` : `"${meta.name}"`;
      logger.info(`Scraping ${label} [${type}] from ${providerIds?.join(',') ?? 'all providers'}`);

      // 2. Scrape all providers in parallel
      return scrapeAll(type, meta, providerIds);
    }, TTL_STREAMS);

    res.json({ streams, cached: true });
  } catch (err) {
    logger.error(`Streams error [${id}]: ${err.message}`);
    res.status(500).json({ error: err.message, streams: [] });
  }
});

// ─── 404 ──────────────────────────────────────────────────────────────────────

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  logger.info(`Magnetio scraper running on port ${PORT}`);
});

export default app;
