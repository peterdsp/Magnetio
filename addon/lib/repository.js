import axios from 'axios';
import { cacheWrap } from './cache.js';
import { logger } from './logger.js';

const SCRAPER_BASE_URL = process.env.SCRAPER_URL || 'http://localhost:8080';
const REQUEST_TIMEOUT  = 20_000;

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

/**
 * Fetch torrent stream records from the scraper back-end.
 *
 * The scraper is responsible for querying configured torrent providers and
 * returning a normalised list of torrent records.
 *
 * @param {'movie'|'series'|'anime'} type
 * @param {string}                   id     IMDb or Kitsu ID
 * @param {object}                   config Addon configuration
 * @returns {Promise<TorrentRecord[]>}
 */
export async function getStreams(type, id, config) {
  const providerKey = config?.providers?.length ? config.providers.join(',') : 'all';
  const torznabSuffix = config.torznabUrl
    ? `:tz-${simpleHash(config.torznabUrl + (config.torznabApiKey || ''))}`
    : '';
  // Audio languages reach the scraper, where a non-English one adds a localized
  // title and a scene-tag search pass, so they change the result set and have to
  // be part of the key. The TMDB key only decides whether localized titles are
  // available, so its presence is keyed but never the secret itself.
  // The order is the user's preference order, and the scraper only looks up the
  // first few languages, so it is sent as configured. The cache key sorts its
  // own copy instead, since reordering the same languages yields the same
  // searches.
  const languages = config.languages?.length ? config.languages : [];
  const languageSuffix = languages.length ? `:lang-${[...languages].sort().join('+')}` : '';
  const aliasSuffix    = languages.length && config.tmdbApiKey ? ':loc' : '';
  const cacheKey = `streams:${type}:${id}:${providerKey}${torznabSuffix}${languageSuffix}${aliasSuffix}`;

  return cacheWrap(cacheKey, async () => {
    const params = { providers: config.providers?.join(',') };
    if (config.torznabUrl) {
      params.torznabUrl = config.torznabUrl;
      params.torznabApiKey = config.torznabApiKey || '';
    }
    if (languages.length) {
      params.languages = languages.join(',');
      // Optional: without a key the scraper falls back to its own TMDB_API_KEY,
      // and without either it just skips the localized-title lookup.
      if (config.tmdbApiKey) params.tmdbApiKey = config.tmdbApiKey;
    }

    const fetchOnce = async () => {
      const { data } = await axios.get(`${SCRAPER_BASE_URL}/streams/${type}/${id}`, {
        timeout: REQUEST_TIMEOUT,
        params,
      });
      return Array.isArray(data.streams) ? data.streams : [];
    };

    try {
      const results = await fetchOnce();
      if (results.length === 0) {
        await new Promise(r => setTimeout(r, 1000));
        return fetchOnce();
      }
      return results;
    } catch (err) {
      logger.warn(`Repository fetch failed [${id}]: ${err.message}`);
      return [];
    }
  }, 3600);
}
