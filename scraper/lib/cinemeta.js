import axios from 'axios';
import { cacheWrap } from './cache.js';
import { logger } from './logger.js';

const CINEMETA_BASE = 'https://v3-cinemeta.strem.io/meta';
const TIMEOUT = 8000;

/**
 * Fetch title metadata from Cinemeta for a given IMDb ID.
 * Returns { name, year, imdbId, type, season, episode }
 */
export async function getMetadata(type, id) {
  // Parse season/episode from series id like tt1234567:1:2
  const parts = id.split(':');
  const imdbId = parts[0];
  const season = parts[1] ? parseInt(parts[1], 10) : null;
  const episode = parts[2] ? parseInt(parts[2], 10) : null;

  const cacheKey = `cinemeta:${type}:${imdbId}`;
  const meta = await cacheWrap(cacheKey, async () => {
    try {
      const { data } = await axios.get(
        `${CINEMETA_BASE}/${type}/${imdbId}.json`,
        { timeout: TIMEOUT }
      );
      const m = data?.meta;
      if (!m) return null;
      return {
        name:   m.name,
        year:   m.year ? parseInt(String(m.year).slice(0, 4), 10) : null,
        imdbId: imdbId,
        type,
      };
    } catch (err) {
      logger.warn(`Cinemeta lookup failed [${imdbId}]: ${err.message}`);
      return null;
    }
  }, 86400); // cache 24h

  if (!meta) return null;
  return { ...meta, season, episode };
}
