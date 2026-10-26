/**
 * Knaben provider -- a meta-indexer with a documented JSON API.
 *
 * Knaben aggregates many trackers behind one endpoint, so this single provider
 * widens coverage across all of them. The API is POST-only, which is why
 * lib/httpClient.js has a post() helper.
 */
import { post } from '../lib/httpClient.js';
import { parseTitle, buildSearchQuery } from '../lib/titleHelper.js';
import { extractInfoHash, normaliseInfoHash } from '../lib/magnetHelper.js';
import { logger } from '../lib/logger.js';

const API = 'https://api.knaben.org/v1';

export const id   = 'knaben';
export const name = 'Knaben';
// Content types this provider can answer for. A meta-indexer: whatever its
// member trackers carry.
export const types = ['movie', 'series', 'anime'];

// Knaben's own category ranges. 2000000 is Movies, 5000000 TV, 100000 Anime.
// Audio, software and books share the endpoint and are never wanted here.
const VIDEO_CATEGORY_PREFIXES = [2, 5, 1];

export async function scrape(meta) {
  if (!meta?.name) return [];

  try {
    const { data } = await post(API, {
      limiterKey: id,
      responseType: 'json',
      data: {
        query:           buildSearchQuery(meta),
        // "100%" is the one setting that matters. "score" sorts by Knaben's own
        // relevance metric and returns unrelated software for a title query,
        // and "all_words" returns nothing at all.
        search_type:     '100%',
        size:            50,
        order_by:        'seeders',
        order_direction: 'desc',
        hide_unsafe:     true,
      },
    });

    const hits = Array.isArray(data?.hits) ? data.hits : [];
    return hits.flatMap(hit => normalise(hit, meta) ?? []);
  } catch (err) {
    logger.warn(`[Knaben] ${err.message}`);
    return [];
  }
}

export function isVideo(hit) {
  const ids = Array.isArray(hit.categoryId) ? hit.categoryId : [];
  if (!ids.length) return true;  // unclassified: let the content filter decide
  return ids.some(c => VIDEO_CATEGORY_PREFIXES.includes(Math.floor(c / 1000000)));
}

export function normalise(hit, meta) {
  if (!isVideo(hit)) return null;

  const title = (hit.title ?? '').trim();
  if (!title) return null;

  // `hash` is uppercase hex, so it cannot be used as it stands, and the magnet
  // may carry base32. Both go through the shared normalisers (see #174).
  const infoHash = extractInfoHash(hit.magnetUrl ?? '') ?? normaliseInfoHash(hit.hash);
  if (!infoHash) return null;

  // `seeders` is the value Knaben cached from the origin tracker and goes
  // stale; `liveSeeders` comes from a recent scrape. Prefer the live figure,
  // fall back when it is missing or zero.
  const seeders  = hit.liveSeeders || hit.seeders || 0;
  const leechers = hit.livePeers   || hit.peers   || 0;

  return {
    ...parseTitle(title),
    infoHash,
    title,
    seeders,
    leechers,
    size:     Number(hit.bytes) || 0,
    provider: name,
    imdbId:   meta.imdbId,
  };
}
