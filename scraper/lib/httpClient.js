import http from 'node:http';
import https from 'node:https';
import axios from 'axios';
import Bottleneck from 'bottleneck';

// Default browser-like headers to avoid basic bot detection
const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

const limiters = new Map();

function getLimiter(key) {
  if (!limiters.has(key)) {
    limiters.set(key, new Bottleneck({ minTime: 250, maxConcurrent: 4 }));
  }
  return limiters.get(key);
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
export async function get(url, {
  limiterKey = 'default',
  params = {},
  headers = {},
  timeout = 12000,
  responseType = 'text',
  retries = 2,
  lookup = null,
} = {}) {
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
    : {};

  return limiter.schedule(async () => {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await axios.get(url, {
          params,
          headers: { ...DEFAULT_HEADERS, ...headers },
          timeout,
          responseType,
          ...safe,
        });
        return res;
      } catch (err) {
        lastErr = err;
        const status = err.response?.status;
        // Don't retry on client errors (4xx)
        if (status && status < 500) throw err;
        if (attempt < retries) await sleep(1000 * (attempt + 1));
      }
    }
    throw lastErr;
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
