import axios from 'axios';
import { cacheWrap } from './cache.js';
import { logger } from './logger.js';

const SCRAPER_BASE_URL = process.env.SCRAPER_URL || 'http://localhost:8080';
const REQUEST_TIMEOUT  = 10_000; // 10 s

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
  const cacheKey = `streams:${type}:${id}`;

  return cacheWrap(cacheKey, async () => {
    try {
      const { data } = await axios.get(`${SCRAPER_BASE_URL}/streams/${type}/${id}`, {
        timeout: REQUEST_TIMEOUT,
        params:  { providers: config.providers?.join(',') },
      });
      return Array.isArray(data.streams) ? data.streams : [];
    } catch (err) {
      logger.warn(`Repository fetch failed [${id}]: ${err.message}`);
      return [];
    }
  }, 3600);
}
