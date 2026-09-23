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

const _inflight = new Map();

/**
 * Fetch from cache with stale-while-revalidate semantics.
 *
 * - Fresh hit (within TTL): return immediately.
 * - Stale hit (past TTL but within 2x TTL): return stale data, refresh in background.
 * - Miss: block on loader.
 *
 * Stored format: { data, createdAt }
 *
 * Options:
 * - nullTtl: seconds to keep a null/undefined loader result. Defaults to the
 *   normal TTL. Pass a small number so transient upstream failures are retried
 *   soon, or 0 to never cache a null result.
 */
export async function cacheWrap(key, loader, ttl = 3600, options = {}) {
  const store = getStore();
  const ttlMs = ttl * 1000;
  const nullTtlMs = options.nullTtl != null ? Math.max(0, options.nullTtl) * 1000 : null;
  const entry = await store.get(key);

  if (entry?.data !== undefined && entry.createdAt) {
    const age = Date.now() - entry.createdAt;
    if (age < ttlMs) return entry.data;

    if (!_inflight.has(key)) {
      const refresh = loader()
        .then(value => storeValue(store, key, value, ttlMs, nullTtlMs))
        .catch(err => logger.warn(`SWR refresh failed [${key}]: ${err.message}`))
        .finally(() => _inflight.delete(key));
      _inflight.set(key, refresh);
    }
    return entry.data;
  }

  const value = await loader();
  await storeValue(store, key, value, ttlMs, nullTtlMs);
  return value;
}

async function storeValue(store, key, value, ttlMs, nullTtlMs) {
  const isEmpty = Array.isArray(value) && value.length === 0;
  if (isEmpty) return;

  if (value == null && nullTtlMs != null) {
    if (nullTtlMs === 0) return;
    // Negative entries expire at exactly nullTtl: no stale-while-revalidate window.
    await store.set(key, { data: value, createdAt: Date.now() - nullTtlMs }, nullTtlMs);
    return;
  }

  await store.set(key, { data: value, createdAt: Date.now() }, ttlMs * 2);
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
