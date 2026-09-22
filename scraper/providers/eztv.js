/**
 * EZTV provider -- uses the official EZTV JSON API.
 * Supports series only (no movies).
 */
import { get } from '../lib/httpClient.js';
import { parseTitle } from '../lib/titleHelper.js';
import { tryDomains, PROVIDER_DOMAINS } from '../lib/domainRotation.js';
import { logger } from '../lib/logger.js';

const DOMAINS = PROVIDER_DOMAINS.eztv;

// The API caps limit at 100 per page and lists newest uploads first. Long
// shows run to thousands of torrents, so cap the pages fetched per lookup.
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

export const id   = 'eztv';
export const name = 'EZTV';

export async function scrape(meta) {
  if (meta.type !== 'series') return [];

  const imdbNumeric = meta.imdbId?.replace('tt', '');
  if (!imdbNumeric) return [];

  try {
    const first   = await fetchPage(imdbNumeric, 1);
    const results = (first?.torrents ?? []).map(normalise);

    // torrents_count gives the page count up front, so the remaining pages
    // are fetched concurrently (the 'eztv' limiter still caps parallelism).
    const total = Math.min(Math.ceil((first?.torrents_count ?? 0) / PAGE_SIZE), MAX_PAGES);
    const rest  = [];
    for (let page = 2; page <= total; page++) rest.push(fetchPage(imdbNumeric, page));

    for (const r of await Promise.allSettled(rest)) {
      if (r.status === 'fulfilled') results.push(...(r.value?.torrents ?? []).map(normalise));
    }

    return filterBySeason(results, meta.season, meta.episode);
  } catch (err) {
    logger.warn(`[EZTV] ${err.message}`);
    return [];
  }
}

async function fetchPage(imdbNumeric, page) {
  const { data } = await tryDomains(DOMAINS, async (base) => {
    return get(`${base}/api/get-torrents`, {
      limiterKey: 'eztv',
      responseType: 'json',
      params: { imdb_id: imdbNumeric, limit: PAGE_SIZE, page },
    });
  }, 'EZTV');
  return data;
}

function normalise(t) {
  const parsed = parseTitle(t.title);
  return {
    infoHash:  t.hash?.toLowerCase(),
    title:     t.title,
    seeders:   t.seeds ?? 0,
    leechers:  t.peers ?? 0,
    size:      parseInt(t.size_bytes ?? '0', 10),
    provider:  'EZTV',
    imdbId:    t.imdb_id ? `tt${t.imdb_id}` : null,
    season:    t.season  ? parseInt(t.season, 10)  : null,
    episode:   t.episode ? parseInt(t.episode, 10) : null,
    ...parsed,
  };
}

function filterBySeason(torrents, season, episode) {
  if (season == null) return torrents;
  return torrents.filter(t => {
    if (t.season !== season) return false;
    if (episode != null && t.episode !== episode) return false;
    return true;
  });
}
