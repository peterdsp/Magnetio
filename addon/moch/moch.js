import { MochOptions, MIN_API_KEY_LENGTH } from './options.js';
import { isValidToken, buildDebridStream, buildOnDemandStream, raceTimeout } from './mochHelper.js';
import { createStreamSubtitleProxies } from '../lib/subtitleProxy.js';
import { cacheGet, cacheSet } from '../lib/cache.js';
import NamedQueue from '../lib/namedQueue.js';
import pLimit from 'p-limit';
import * as RealDebrid  from './realdebrid.js';
import * as Premiumize  from './premiumize.js';
import * as AllDebrid   from './alldebrid.js';
import * as DebridLink  from './debridlink.js';
import * as EasyDebrid  from './easydebrid.js';
import * as Offcloud    from './offcloud.js';
import * as TorBox      from './torbox.js';
import * as Putio       from './putio.js';
import { logger } from '../lib/logger.js';

// Map MochOptions key → module
const MOCH_MODULES = {
  realdebrid:  RealDebrid,
  premiumize:  Premiumize,
  alldebrid:   AllDebrid,
  debridlink:  DebridLink,
  easydebrid:  EasyDebrid,
  offcloud:    Offcloud,
  torbox:      TorBox,
  putio:       Putio,
};

const PREWARM_CACHE_TTL = 60 * 60 * 6;
const PREWARM_QUEUE = new NamedQueue(4);
const RESOLVE_TIMEOUT_MS = 8_000;
const resolveLimit = pLimit(4);

// How many visible on-demand entries to emit per service that lacks a bulk
// cache-check. Kept low so the stream list stays clean and the user is not
// tempted to add many torrents to their debrid account at once.
const ON_DEMAND_LIMIT = 5;

// Hard ceiling for an on-demand /resolve call. Provider resolvers poll for the
// torrent to become ready (roughly 20-36s worst case); this bounds the whole
// request so the addon returns a clean error instead of hanging. On timeout the
// in-flight resolve keeps running and warms resolveWithCache, so a retry can hit
// the now-cached link. Override with ON_DEMAND_RESOLVE_TIMEOUT_MS.
const ON_DEMAND_RESOLVE_TIMEOUT_MS =
  parseInt(process.env.ON_DEMAND_RESOLVE_TIMEOUT_MS, 10) || 40_000;

/**
 * Enhance a list of streams using all configured debrid services.
 *
 * For each enabled service:
 *   1. Check which infoHashes are instantly available (cached).
 *   2. Re-emit cached streams as direct-download streams.
 *   3. Return direct streams, with P2P fallback only when explicitly enabled.
 *
 * @param {StreamObject[]} streams         Raw stream objects from repository
 * @param {object}         config          Addon configuration
 * @param {object}         requestContext  Current stream request context
 * @returns {Promise<StreamObject[]>}
 */
export async function applyMochs(streams, config, requestContext) {
  const enabled = getEnabledMochs(config);
  if (!enabled.length) return streams;

  const directStreams = [];    // instantly-cached, resolved to a direct link
  const onDemandStreams = [];   // visible fallbacks for services without cache-check

  await Promise.allSettled(
    enabled.map(async ({ key, moch, module }) => {
      const apiKey = config[moch.configKey];
      if (!isValidToken(apiKey, MIN_API_KEY_LENGTH)) return;

      try {
        const cachedMap = await module.getCachedStreams(streams, apiKey);
        schedulePrewarm(streams, cachedMap, apiKey, moch, module, config);

        const debridResults = await Promise.allSettled(
          streams
            .filter(stream => stream.infoHash && cachedMap.has(stream.infoHash?.toLowerCase()))
            .map(stream => resolveLimit(async () => {
              const url = await withTimeout(
                module.resolve(stream, apiKey),
                RESOLVE_TIMEOUT_MS,
                `${moch.name} resolve timed out`
              );
              return { stream, url };
            }))
        );

        for (const settled of debridResults) {
          if (settled.status !== 'fulfilled') {
            logger.warn(`Moch resolve skipped [${moch.name}]: ${settled.reason?.message}`);
            continue;
          }

          const { stream, url } = settled.value;
          if (!url) continue;

          const debridStream = buildDebridStream(stream, url, moch.name);
          const proxySubtitles = await createStreamSubtitleProxies(requestContext, debridStream, config);
          if (proxySubtitles.length) {
            debridStream.subtitles = proxySubtitles;
          }
          directStreams.push(debridStream);
        }

        // Services without a bulk cache-check produce an empty cachedMap, so
        // the loop above yields nothing and they would vanish from the list.
        // Emit visible on-demand entries instead, resolved on play. Opt-out
        // via `onDemand=0` in the config.
        if (config?.onDemand !== false && moch.instantAvailability === false && typeof module.resolve === 'function') {
          const onDemand = buildOnDemandStreams(streams, cachedMap, moch, config);
          if (onDemand.length) {
            logger.info(
              `Moch on-demand [${moch.name}]: no bulk cache-check, ` +
              `emitting ${onDemand.length} on-demand stream(s)`
            );
            onDemandStreams.push(...onDemand);
          } else {
            logger.warn(
              `Moch on-demand [${moch.name}]: no bulk cache-check and no resolvable ` +
              `candidates (missing public base URL or config context)`
            );
          }
        }
      } catch (err) {
        logger.error(`Moch error [${moch.name}]: ${err.message}`);
      }
    })
  );

  // Instant (cached) streams first, on-demand fallbacks after, so on-demand
  // entries only surface when few or no cached streams filled the list.
  const resolved = [...directStreams, ...onDemandStreams];
  const results = selectMochResults(resolved, streams, config?.p2pFallback);
  if (resolved.length) return results;

  if (config?.p2pFallback) {
    logger.warn(`No debrid streams resolved, falling back to P2P (${streams.length} raw streams)`);
  } else {
    logger.warn('No debrid streams resolved and P2P fallback is disabled');
  }
  return results;
}

/**
 * Build visible on-demand entries for a service without a bulk cache-check.
 * Each entry's URL points back at the addon's own /resolve route, which does
 * the add + unrestrict on play and 302-redirects to the real link.
 */
function buildOnDemandStreams(streams, cachedMap, moch, config) {
  const base = config?._publicBaseUrl;
  const configString = config?._configString;
  // Without an absolute base and the raw config segment we cannot build a
  // resolve URL the app can call back into. Skip rather than emit dead links.
  if (!base || !configString) return [];

  const picked = [];
  const seen = new Set();

  for (const stream of streams) {
    const infoHash = stream.infoHash?.toLowerCase();
    if (!infoHash) continue;
    if (cachedMap.has(infoHash)) continue; // already emitted as a direct stream

    const fileIdx = stream.fileIdx ?? 0;
    const key = `${infoHash}:${fileIdx}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const resolveUrl = `${base}/${configString}/resolve/${moch.id}/${infoHash}/${fileIdx}`;
    picked.push(buildOnDemandStream(stream, resolveUrl, moch.name));

    if (picked.length >= ON_DEMAND_LIMIT) break;
  }

  return picked;
}

/**
 * Resolve a single torrent on demand for a given service (used by the addon's
 * /resolve route). Returns a direct URL or null.
 */
export async function resolveOnDemandStream(config, mochId, infoHash, fileIdx) {
  const entry = findMochByShortId(mochId);
  if (!entry) return null;

  const { moch, module } = entry;
  const apiKey = config?.[moch.configKey];

  if (!isValidToken(apiKey, MIN_API_KEY_LENGTH) || typeof module.resolve !== 'function') {
    return null;
  }

  // Bound the whole resolve so the /resolve route never hangs indefinitely.
  // raceTimeout resolves to null on timeout (the underlying resolve continues
  // in the background and warms the cache for a retry).
  return raceTimeout(
    () => module.resolve({ infoHash, fileIdx }, apiKey),
    ON_DEMAND_RESOLVE_TIMEOUT_MS,
  );
}

export function selectMochResults(directStreams, rawStreams, p2pFallback = false) {
  if (directStreams.length) {
    return p2pFallback ? [...directStreams, ...rawStreams] : directStreams;
  }
  return p2pFallback ? rawStreams : [];
}

async function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch the catalog for a specific debrid service ID (e.g. "rd_movie").
 */
export async function getMochCatalog(catalogId, type, config, skip = 0) {
  const [mochId] = catalogId.split('_');
  const entry    = findMochByShortId(mochId);
  if (!entry) return [];

  const { moch, module } = entry;
  const apiKey = config[moch.configKey];

  if (!isValidToken(apiKey, MIN_API_KEY_LENGTH) || !module.getCatalog) return [];
  return module.getCatalog(apiKey, type, skip);
}

/**
 * Fetch metadata for an item with a debrid-prefixed ID (e.g. "rd:abc123").
 */
export async function getMochItemMeta(id, type, config) {
  const [prefix, itemId] = id.split(':');
  const entry            = findMochByShortId(prefix);
  if (!entry) return null;

  const { moch, module } = entry;
  const apiKey = config[moch.configKey];

  if (!isValidToken(apiKey, MIN_API_KEY_LENGTH)) return null;

  // Basic meta – extend individual modules if richer data is needed
  return { id, type, name: `${moch.name} item ${itemId}` };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEnabledMochs(config) {
  return Object.entries(MochOptions)
    .filter(([, moch]) => isValidToken(config?.[moch.configKey], MIN_API_KEY_LENGTH))
    .map(([key, moch]) => ({ key, moch, module: MOCH_MODULES[key] }))
    .filter(({ module }) => !!module);
}

function findMochByShortId(shortId) {
  const entry = Object.entries(MochOptions).find(([, m]) => m.id === shortId);
  if (!entry) return null;
  const [key, moch] = entry;
  return { key, moch, module: MOCH_MODULES[key] };
}

function schedulePrewarm(streams, cachedMap, apiKey, moch, module, config) {
  if (!config?.prewarmDebrid) return;
  if (typeof module.prewarm !== 'function') return;

  const limit = Math.max(0, Math.min(config.prewarmLimit ?? 3, 10));
  if (!limit) return;

  const candidates = pickPrewarmCandidates(streams, cachedMap, limit);
  for (const stream of candidates) {
    const queueId = `prewarm:${moch.id}:${stream.infoHash}:${stream.fileIdx ?? 0}`;
    setTimeout(() => {
      PREWARM_QUEUE.wrap({ id: queueId }, async () => {
        const cacheKey = `prewarm:${moch.id}:${stream.infoHash}:${stream.fileIdx ?? 0}`;
        if (await cacheGet(cacheKey)) return true;

        const warmed = await module.prewarm(stream, apiKey);
        if (warmed) {
          await cacheSet(cacheKey, true, PREWARM_CACHE_TTL);
          logger.info(`Prewarmed ${moch.name} torrent ${stream.infoHash}`);
        }

        return warmed;
      }).catch(err => {
        logger.warn(`Prewarm failed [${moch.name} ${stream.infoHash}]: ${err.message}`);
      });
    }, 0);
  }
}

export function pickPrewarmCandidates(streams, cachedMap, limit) {
  const picked = [];
  const seen = new Set();

  for (const stream of streams) {
    const infoHash = stream.infoHash?.toLowerCase();
    if (!infoHash) continue;
    if (cachedMap.has(infoHash)) continue;

    const key = `${infoHash}:${stream.fileIdx ?? 0}`;
    if (seen.has(key)) continue;

    picked.push(stream);
    seen.add(key);

    if (picked.length >= limit) break;
  }

  return picked;
}
