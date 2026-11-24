import Keyv from 'keyv';
import KeyvRedis from '@keyv/redis';
import { logger } from './logger.js';

let _store = null;

// Entries the in-memory cache keeps. Keyv's default Map never shrinks: an
// expired entry is only removed when its key is read again, and most stream
// keys are read once, so the cache grew for the life of the process. Bounded,
// the least recently written entry goes first. Ignored with Redis.
const MAX_MEMORY_ENTRIES = Math.max(1, parseInt(process.env.SCRAPER_CACHE_MAX_ENTRIES ?? '1000', 10) || 1000);

/**
 * A Map that evicts its oldest entry past maxEntries. Re-setting a key moves it
 * to the back, so a refreshed entry is not the next to go.
 */
export class BoundedMap extends Map {
  constructor(maxEntries) {
    super();
    this.maxEntries = maxEntries;
  }

  set(key, value) {
    if (this.has(key)) this.delete(key);
    super.set(key, value);
    while (this.size > this.maxEntries) this.delete(this.keys().next().value);
    return this;
  }
}

// Loads already running, by key, so concurrent requests for the same uncached
// key share one scrape instead of each starting their own.
const inflight = new Map();

function getStore() {
  if (_store) return _store;
  if (process.env.REDIS_URI) {
    const redis = new KeyvRedis(process.env.REDIS_URI);
    _store = new Keyv({ store: redis, namespace: 'scraper' });
    logger.info('Scraper cache: Redis');
  } else {
    _store = new Keyv({ store: new BoundedMap(MAX_MEMORY_ENTRIES), namespace: 'scraper' });
    logger.warn('Scraper cache: in-memory (set REDIS_URI for production)');
  }
  _store.on('error', err => logger.error(`Cache error: ${err.message}`));
  return _store;
}

export async function cacheHas(key) {
  const store = getStore();
  const hit = await store.get(key);
  return hit !== undefined;
}

export async function cacheWrap(key, loader, ttlSeconds = 3600) {
  const store = getStore();
  const hit = await store.get(key);
  if (hit !== undefined) return { value: hit, cached: true };

  let pending = inflight.get(key);
  if (!pending) {
    pending = (async () => {
      const value = await loader();
      // Don't cache misses: a transient failure (e.g. a DNS blip during a Cinemeta
      // lookup) would otherwise hide a title for the whole TTL.
      const isEmpty = value == null || (Array.isArray(value) && value.length === 0);
      if (!isEmpty) {
        await store.set(key, value, ttlSeconds * 1000);
      }
      return value;
    })();
    inflight.set(key, pending);
    pending.finally(() => inflight.delete(key)).catch(() => {});
  }
  return { value: await pending, cached: false };
}
