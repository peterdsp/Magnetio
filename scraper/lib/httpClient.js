import http from 'node:http';
import https from 'node:https';
import { AsyncLocalStorage } from 'node:async_hooks';
import axios from 'axios';
import Bottleneck from 'bottleneck';
import { recordSuccess, recordFailure } from './providerHealth.js';
import { proxyAppliesTo, proxyAgents } from './proxy.js';

// Default browser-like headers to avoid basic bot detection
const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

const limiters = new Map();

// Jobs a provider's limiter may hold waiting. A limiter starts at most four
// jobs a second (minTime 250), so a job queued behind more than this cannot
// start before the aggregator's provider timeout has given up on it. Without a
// bound the queue grew for as long as requests arrived faster than a slow site
// answered, and every queued job kept its provider's parsed page alive until
// it ran: that is what exhausted the heap in production. When the queue is
// full the oldest waiting job is dropped, since it is the likeliest to belong
// to a request that has already been answered.
const QUEUE_HIGH_WATER = Math.max(1, parseInt(process.env.SCRAPER_LIMITER_HIGH_WATER ?? '32', 10) || 32);

function getLimiter(key) {
  if (!limiters.has(key)) {
    limiters.set(key, new Bottleneck({
      minTime: 250,
      maxConcurrent: 4,
      highWater: QUEUE_HIGH_WATER,
      strategy: Bottleneck.strategy.LEAK,
    }));
  }
  return limiters.get(key);
}

// The abort signal of the provider search a request belongs to. The aggregator
// sets it around each provider call (see runWithSignal), so every request a
// provider makes, however deep, is cancelled when the aggregator stops
// waiting, without each provider having to thread a signal through.
const signalScope = new AsyncLocalStorage();

/**
 * Run fn with every httpClient request it makes tied to signal: once the
 * signal aborts, queued requests are dropped without touching the network,
 * a request in flight is aborted, and no retry is attempted.
 *
 * @template T
 * @param {AbortSignal} signal
 * @param {() => T} fn
 * @returns {T}
 */
export function runWithSignal(signal, fn) {
  return signalScope.run(signal, fn);
}

/**
 * Throttled GET with retries and browser-like headers.
 *
 * @param {string}  url
 * @param {object}  opts
 * @param {string}  opts.limiterKey    Rate-limiter bucket (e.g. provider name)
 * @param {object}  opts.params        Query params
 * @param {object}  opts.headers       Extra headers
 * @param {number}  opts.timeout       Request timeout ms (default 12000)
 * @param {string}  opts.responseType  axios responseType (default 'text')
 * @param {number}  opts.retries       Retry count on 5xx / network error (default 2)
 * @param {Function} opts.lookup       Custom DNS lookup for SSRF-safe requests.
 *                                     When set, the connection is pinned to the
 *                                     address this lookup returns and redirects
 *                                     are disabled (see lib/ssrf.js). The URL
 *                                     still carries the hostname, so the Host
 *                                     header and TLS SNI are preserved.
 */
export async function get(url, opts = {}) {
  return request('get', url, opts);
}

/**
 * POST a JSON body, with the same rate limiting, retries, headers and
 * SSRF-pinning behaviour as get().
 *
 * Only needed by providers whose API is POST-only, such as the Knaben
 * meta-indexer. Everything else should use get().
 *
 * @param {string} url
 * @param {object} opts     as get(), plus:
 * @param {object} opts.data  the JSON request body
 */
export async function post(url, opts = {}) {
  return request('post', url, opts);
}

async function request(method, url, {
  limiterKey = 'default',
  params = {},
  headers = {},
  timeout = 12000,
  responseType = 'text',
  retries = 2,
  lookup = null,
  data = undefined,
  signal = signalScope.getStore(),
} = {}) {
  // The caller has already given up: do not queue work nobody will read.
  if (signal?.aborted) throw abortReason(signal);
  const limiter = getLimiter(limiterKey);

  // A pinned lookup routes the socket to a pre-validated IP. Disable redirects
  // (maxRedirects: 0) so a 3xx to another host can't escape the pinned target;
  // this also makes axios use the raw http/https transport, which honours the
  // agent's lookup. Agents are non-keep-alive so no socket outlives the request.
  const pinned = typeof lookup === 'function';
  const safe = pinned
    ? {
        httpAgent: new http.Agent({ lookup, keepAlive: false }),
        httpsAgent: new https.Agent({ lookup, keepAlive: false }),
        maxRedirects: 0,
      }
    // A pinned request is never proxied, deliberately. Pinning exists for the
    // one case where the URL comes from the user (torznab's Jackett or
    // Prowlarr address), and a proxy agent would replace the very agent that
    // carries the pinned lookup, silently turning the SSRF guard off. That
    // address is also normally on the operator's own LAN, so sending it out
    // through a VPN exit would break it even if it were safe. See lib/proxy.js
    // and #201.
    : (proxyAppliesTo(limiterKey) ? (proxyAgents() ?? {}) : {});

  const job = limiter.schedule(async () => {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
      // Checked before every attempt: a job that waited in the queue past its
      // caller's timeout ends here instead of fetching a page into the void.
      if (signal?.aborted) throw abortReason(signal);
      try {
        const res = await axios({
          method,
          url,
          ...(data !== undefined ? { data } : {}),
          params,
          headers: { ...DEFAULT_HEADERS, ...headers },
          timeout,
          responseType,
          ...(signal ? { signal } : {}),
          ...safe,
        });
        // Recorded here rather than in each provider: a provider catches its
        // own errors and returns [], so upstream cannot tell a dead site from
        // an empty search. See lib/providerHealth.js and #196.
        recordSuccess(limiterKey);
        return res;
      } catch (err) {
        // Cancelled by the caller, not failed by the provider: neither
        // retried nor counted against the provider's health.
        if (signal?.aborted) throw abortReason(signal);
        lastErr = err;
        const status = err.response?.status;
        // 429 is the one 4xx that means "ask again later" rather than "your
        // request is wrong", so it is retried, honouring Retry-After when the
        // server sends one. It used to be thrown with the rest of the 4xx
        // range and never retried at all.
        if (status === 429 && attempt < retries) {
          await sleep(retryAfterMs(err, attempt), signal);
          continue;
        }
        // Any other client error is final.
        if (status && status < 500) {
          recordFailure(limiterKey, err);
          throw err;
        }
        if (attempt < retries) await sleep(1000 * (attempt + 1), signal);
      }
    }
    recordFailure(limiterKey, lastErr);
    throw lastErr;
  });
  // Bottleneck rejects a job dropped from a full queue with its own error.
  const tagged = job.catch(err => {
    if (err instanceof Bottleneck.BottleneckError) err.code = 'ERR_QUEUE_DROPPED';
    throw err;
  });
  if (!signal) return tagged;

  // Settle as soon as the caller aborts rather than when the queue reaches
  // this job, so the provider code awaiting it (and the page it parsed) is
  // released now. The job itself then ends at its next abort check.
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortReason(signal));
    signal.addEventListener('abort', onAbort, { once: true });
    tagged.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

function abortReason(signal) {
  const reason = signal.reason;
  const err = new Error(reason?.message ?? (typeof reason === 'string' ? reason : 'Request aborted'));
  err.name = 'AbortError';
  err.code = 'ERR_CANCELED';
  return err;
}

/**
 * True for a request this client gave up on deliberately: cancelled because
 * its caller stopped waiting, or dropped from a full queue. Neither says
 * anything about the site, so domain rotation must not mark a domain failed
 * or move on to the next one because of it.
 */
export function isCancellation(err) {
  return err?.code === 'ERR_CANCELED' || err?.code === 'ERR_QUEUE_DROPPED';
}

// Wakes early on abort, so a cancelled job does not hold a concurrency slot
// through its retry back-off.
function sleep(ms, signal) {
  return new Promise(resolve => {
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done, { once: true });
  });
}

// Capped because the aggregator gives each provider a hard timeout anyway, so
// a server asking for a two minute wait is better treated as a failure now
// than as a request that outlives the response it belongs to.
const RETRY_AFTER_MAX_MS = 5000;

/**
 * How long to wait before retrying a 429, from the Retry-After header when
 * there is one. The header is either a number of seconds or an HTTP date.
 *
 * @returns {number} milliseconds
 */
export function retryAfterMs(err, attempt = 0) {
  const fallback = 1000 * (attempt + 1);
  const header = err?.response?.headers?.['retry-after'];
  if (header == null) return fallback;

  // Decided before Date.parse sees it: Date.parse('-5') is not NaN, so a
  // negative number would otherwise be read as a date rather than rejected.
  const trimmed = String(header).trim();
  if (!trimmed) return fallback;
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds)) {
    return seconds < 0 ? fallback : Math.min(seconds * 1000, RETRY_AFTER_MAX_MS);
  }

  const date = Date.parse(header);
  if (!Number.isNaN(date)) {
    return Math.min(Math.max(0, date - Date.now()), RETRY_AFTER_MAX_MS);
  }

  return fallback;
}
