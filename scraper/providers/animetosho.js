/**
 * AnimeTosho provider -- uses the JSON feed for anime torrents.
 * Aggregates results from Nyaa, TokyoTosho, and other anime trackers.
 */
import { get } from '../lib/httpClient.js';
import { parseTitle, buildSearchQuery } from '../lib/titleHelper.js';
import { extractInfoHash, normaliseInfoHash } from '../lib/magnetHelper.js';
import { logger } from '../lib/logger.js';

// The feed used to live on feed.animetosho.org, which no longer resolves at
// all, so every request failed and the provider returned nothing for months.
// The JSON feed on the apex carries the infoHash, size and peer counts as
// fields, which the rss2 feed no longer does.
const BASE = 'https://animetosho.org';

export const id   = 'animetosho';
export const name = 'AnimeTosho';
// Content types this provider can answer for. Anime index.
export const types = ['series', 'anime'];

export async function scrape(meta) {
  if (meta.type !== 'series' && meta.type !== 'anime') return [];
  if (!meta?.name) return [];

  try {
    const { data } = await get(`${BASE}/feed/json`, {
      limiterKey: id,
      responseType: 'json',
      params: {
        q:        buildSearchQuery(meta),
        qx:       1,
        only_tor: 1,
      },
    });

    const entries = Array.isArray(data) ? data : [];
    return entries.flatMap(entry => normalise(entry, meta) ?? []);
  } catch (err) {
    logger.warn(`[AnimeTosho] ${err.message}`);
    return [];
  }
}

export function normalise(entry, meta = {}) {
  const title = (entry.title ?? entry.torrent_name ?? '').trim();
  if (!title) return null;

  // info_hash is lowercase hex, while magnet_uri carries base32, so both go
  // through the shared normalisers rather than being trusted (see #174).
  const infoHash = normaliseInfoHash(entry.info_hash)
    ?? extractInfoHash(entry.magnet_uri ?? '');
  if (!infoHash) return null;

  return {
    ...parseTitle(title),
    infoHash,
    title,
    // The feed reports these as numbers, and -1 for unknown.
    seeders:   Math.max(0, Number(entry.seeders)  || 0),
    leechers:  Math.max(0, Number(entry.leechers) || 0),
    size:      Number(entry.total_size) || 0,
    provider:  name,
    imdbId:    meta.imdbId,
    languages: ['ja'],
  };
}
