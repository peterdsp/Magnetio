import axios from 'axios';
import { cacheWrap } from './cache.js';
import { logger } from './logger.js';

const CINEMETA_BASE = 'https://v3-cinemeta.strem.io/meta';
const TIMEOUT = 8000;

/**
 * Try fetching metadata from Cinemeta for a given type and IMDB ID.
 * Returns the meta object or null.
 */
async function fetchCinemeta(type, imdbId) {
  try {
    const { data } = await axios.get(
      `${CINEMETA_BASE}/${type}/${imdbId}.json`,
      { timeout: TIMEOUT }
    );
    const m = data?.meta;
    if (!m || !m.name) return null;
    return {
      name: m.name,
      year: m.year ? parseInt(String(m.year).slice(0, 4), 10) : null,
      imdbId,
      type,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch title metadata from Cinemeta for a given IMDb ID.
 * Returns { name, year, imdbId, type, season, episode }
 *
 * Fallback strategy when the primary type returns nothing:
 *  1. Try the opposite type (movie <-> series)
 *  2. Return a minimal stub so providers can still search by IMDB ID
 *
 * Uses a 1h cache TTL so fallback/stub results get retried relatively soon.
 * Successful cinemeta hits also cache for 1h (harmless, the API is fast).
 */
export async function getMetadata(type, id) {
  const parts = id.split(':');
  const imdbId = parts[0];
  const season = parts[1] ? parseInt(parts[1], 10) : null;
  const episode = parts[2] ? parseInt(parts[2], 10) : null;

  const cacheKey = `cinemeta:${type}:${imdbId}`;

  const meta = await cacheWrap(cacheKey, async () => {
    // Primary lookup
    const primary = await fetchCinemeta(type, imdbId);
    if (primary) return primary;

    // Fallback: try the opposite type
    const altType = type === 'movie' ? 'series' : 'movie';
    logger.info(`Cinemeta miss for ${type}/${imdbId}, trying ${altType}`);
    const alt = await fetchCinemeta(altType, imdbId);
    if (alt) {
      logger.info(`Cinemeta fallback hit: ${altType}/${imdbId} -> "${alt.name}"`);
      return { ...alt, type };
    }

    // Last resort: minimal stub so providers that search by IMDB ID can still work
    logger.warn(`Cinemeta has no data for ${imdbId}, using IMDB ID stub`);
    return { name: imdbId, year: null, imdbId, type };
  }, 3600); // 1h cache - short enough to retry failures, fine for successes

  if (!meta) return null;
  return { ...meta, season, episode };
}
