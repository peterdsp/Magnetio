/**
 * Provider aggregator -- runs all enabled scrapers in parallel
 * and returns a unified, deduplicated list of torrent records.
 */
import pLimit from 'p-limit';
import * as yts              from './yts.js';
import * as eztv             from './eztv.js';
import * as thepiratebay     from './thepiratebay.js';
import * as torrentgalaxy    from './torrentgalaxy.js';
import * as leetx            from './leetx.js';
import * as kickasstorrents  from './kickasstorrents.js';
import * as nyaa             from './nyaa.js';
import * as animesaturn      from './animesaturn.js';
import * as rutor            from './rutor.js';
import * as rutracker        from './rutracker.js';
import * as limetorrents     from './limetorrents.js';
import * as bitsearch        from './bitsearch.js';
import * as bt4g             from './bt4g.js';
import * as btdig            from './btdig.js';
import * as glotorrents      from './glotorrents.js';
import * as torlock          from './torlock.js';
import * as torrentdownloads from './torrentdownloads.js';
import { logger } from '../lib/logger.js';

const ALL_PROVIDERS = [
  yts,
  eztv,
  thepiratebay,
  torrentgalaxy,
  leetx,
  kickasstorrents,
  nyaa,
  animesaturn,
  rutor,
  rutracker,
  limetorrents,
  bitsearch,
  bt4g,
  btdig,
  glotorrents,
  torlock,
  torrentdownloads,
];

// Max 4 providers running simultaneously
const limit = pLimit(4);
const PROVIDER_TIMEOUT_MS = 22_000;

/**
 * Scrape all (or a subset of) providers for a given content item.
 *
 * @param {string}   type        'movie' | 'series' | 'anime'
 * @param {object}   meta        From cinemeta: { name, year, imdbId, season, episode }
 * @param {string[]} providerIds Optional whitelist of provider IDs
 * @returns {Promise<TorrentRecord[]>}
 */
export async function scrapeAll(type, meta, providerIds = null) {
  const providers = ALL_PROVIDERS.filter(p =>
    !providerIds || providerIds.includes(p.id)
  );

  const settled = await Promise.allSettled(
    providers.map(p =>
      limit(async () => {
        const start   = Date.now();
        const results = await withTimeout(
          p.scrape({ ...meta, type }),
          PROVIDER_TIMEOUT_MS,
          `${p.name} timed out`
        );
        logger.debug(`[${p.name}] ${results.length} results in ${Date.now() - start}ms`);
        return results;
      })
    )
  );

  const raw = settled.flatMap(r => {
    if (r.status === 'fulfilled') return r.value;
    logger.warn(`Provider error: ${r.reason?.message}`);
    return [];
  });

  return deduplicate(raw);
}

async function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Deduplicate by infoHash, keeping the entry with the highest seeder count.
 */
function deduplicate(records) {
  const map = new Map();
  for (const r of records) {
    if (!r.infoHash) continue;
    const existing = map.get(r.infoHash);
    if (!existing || (r.seeders ?? 0) > (existing.seeders ?? 0)) {
      map.set(r.infoHash, r);
    }
  }
  return Array.from(map.values());
}

/**
 * List all available provider IDs.
 */
export function listProviders() {
  return ALL_PROVIDERS.map(p => ({ id: p.id, name: p.name }));
}
