import { extractQuality } from './sort.js';
import { Quality } from './types.js';

const SIZE_LIMITS = {
  '1GB':   1  * 1024 ** 3,
  '2GB':   2  * 1024 ** 3,
  '3GB':   3  * 1024 ** 3,
  '5GB':   5  * 1024 ** 3,
  '10GB':  10 * 1024 ** 3,
  '20GB':  20 * 1024 ** 3,
  '50GB':  50 * 1024 ** 3,
};

/**
 * Apply user-configured filters to a sorted stream list.
 *
 * Filters applied (in order):
 *  1. Quality whitelist (if configured)
 *  2. Language whitelist (if configured)
 *  3. Exclude specific size buckets
 *  4. Maximum absolute size cap
 *  5. Limit total stream count
 */
export function applyFilters(streams, config) {
  let result = streams;

  // 1. Quality whitelist
  if (config.qualities?.length) {
    result = result.filter(s => {
      const q = extractQuality(s);
      return config.qualities.includes(q);
    });
  }

  // 2. Language whitelist
  if (config.languages?.length) {
    const preferred = result.filter(s =>
      (s.languages ?? []).some(l => config.languages.includes(l))
    );
    // Keep non-matching only if preferred set is empty (graceful fallback)
    result = preferred.length ? preferred : result;
  }

  // 3. Excluded size buckets (e.g. ['1GB', '2GB'])
  if (config.excludeSizes?.length) {
    result = result.filter(s => {
      for (const label of config.excludeSizes) {
        const cap = SIZE_LIMITS[label.toUpperCase()];
        if (cap && s.size && s.size <= cap) return false;
      }
      return true;
    });
  }

  // 4. Absolute max size cap (in bytes)
  if (config.maxSize) {
    result = result.filter(s => !s.size || s.size <= config.maxSize);
  }

  // 5. Limit count
  const limit = config.limit ?? 10;
  return result.slice(0, limit * 5); // fetch extra; moch layer will trim further
}
