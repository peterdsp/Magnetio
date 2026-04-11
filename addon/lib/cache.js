import Keyv from 'keyv';
import KeyvRedis from '@keyv/redis';
import { logger } from './logger.js';

let _store = null;

function getStore() {
  if (_store) return _store;

  if (process.env.REDIS_URI) {
    const redis = new KeyvRedis(process.env.REDIS_URI);
    _store = new Keyv({ store: redis, namespace: 'magnetio' });
    logger.info('Cache: using Redis');
  } else {
    // In-memory fallback (suitable for single-instance / dev)
    _store = new Keyv({ namespace: 'magnetio' });
    logger.warn('Cache: no REDIS_URI set – using in-memory cache (not suitable for production)');
  }

  _store.on('error', err => logger.error(`Cache error: ${err.message}`));
  return _store;
}

/**
 * Fetch from cache; call loader on miss and store the result.
 *
 * @param {string}   key
 * @param {Function} loader    async () => value
 * @param {number}   ttl       TTL in seconds
 */
export async function cacheWrap(key, loader, ttl = 3600) {
  const store = getStore();
  const cached = await store.get(key);
  if (cached !== undefined) return cached;

  const value = await loader();
  await store.set(key, value, ttl * 1000); // Keyv uses milliseconds
  return value;
}

export async function cacheGet(key) {
  return getStore().get(key);
}

export async function cacheSet(key, value, ttl = 3600) {
  return getStore().set(key, value, ttl * 1000);
}

/**
 * Remove a specific key from the cache.
 */
export async function cacheDel(key) {
  return getStore().delete(key);
}

/**
 * Clear the entire namespace.
 */
export async function cacheClear() {
  return getStore().clear();
}
