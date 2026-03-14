/**
 * The Pirate Bay provider — uses the apibay.org JSON API.
 */
import { get } from '../lib/httpClient.js';
import { parseTitle, buildSearchQuery } from '../lib/titleHelper.js';
import { logger } from '../lib/logger.js';

const BASE = 'https://apibay.org';

export const id   = 'thepiratebay';
export const name = 'ThePirateBay';

export async function scrape(meta) {
  if (!meta?.name) return [];

  try {
    const query = buildSearchQuery(meta);

    const { data } = await get(`${BASE}/q.php`, {
      limiterKey: 'thepiratebay',
      responseType: 'json',
      params: { q: query, cat: meta.type === 'movie' ? '207' : '205' },
    });

    if (!Array.isArray(data) || data[0]?.id === '0') return [];

    return data.map(t => normalise(t, meta));
  } catch (err) {
    logger.warn(`[TPB] ${err.message}`);
    return [];
  }
}

function normalise(t, meta) {
  const parsed = parseTitle(t.name);
  return {
    infoHash:  t.info_hash?.toLowerCase(),
    title:     t.name,
    seeders:   parseInt(t.seeders ?? '0', 10),
    leechers:  parseInt(t.leechers ?? '0', 10),
    size:      parseInt(t.size ?? '0', 10),
    provider:  'ThePirateBay',
    imdbId:    meta.imdbId,
    ...parsed,
  };
}
