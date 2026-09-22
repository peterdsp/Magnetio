/**
 * The Pirate Bay provider -- uses the apibay.org JSON API.
 *
 * The query is sent without a category filter (a single `cat` value such as
 * 207 would drop 4K movies and HD TV) and results are narrowed to the video
 * categories below client side.
 */
import { get } from '../lib/httpClient.js';
import { parseTitle, buildSearchQuery } from '../lib/titleHelper.js';
import { tryDomains, PROVIDER_DOMAINS } from '../lib/domainRotation.js';
import { logger } from '../lib/logger.js';

const DOMAINS = PROVIDER_DOMAINS.thepiratebay;

// 201 Movies, 202 Movies DVDR, 207 HD Movies, 209 3D, 211 UHD/4K Movies
const MOVIE_CATEGORIES  = new Set(['201', '202', '207', '209', '211']);
// 205 TV Shows, 208 HD TV Shows, 212 UHD/4K TV Shows
const SERIES_CATEGORIES = new Set(['205', '208', '212']);

export const id   = 'thepiratebay';
export const name = 'ThePirateBay';

export async function scrape(meta) {
  if (!meta?.name) return [];

  try {
    const query = buildSearchQuery(meta);

    const { data } = await tryDomains(DOMAINS, async (base) => {
      return get(`${base}/q.php`, {
        limiterKey: 'thepiratebay',
        responseType: 'json',
        params: { q: query },
      });
    }, 'TPB', { validate: res => Array.isArray(res?.data) });

    // apibay answers "no results" with a single placeholder row whose id is 0
    if (data[0]?.id === '0') return [];

    const categories = meta.type === 'movie' ? MOVIE_CATEGORIES : SERIES_CATEGORIES;
    return data
      .filter(t => t.info_hash && categories.has(String(t.category)))
      .map(t => normalise(t, meta));
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
