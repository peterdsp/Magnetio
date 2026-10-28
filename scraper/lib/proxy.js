/**
 * Optional outbound proxy for provider requests.
 *
 * Some providers answer fine from one network and refuse another: measured on
 * the production host, animetosho returns 403 and bt4g returns 429, while both
 * return results from a different IP with the same code, headers and
 * User-Agent. That is IP reputation, and the only thing that moves it is
 * leaving by a different exit (#201).
 *
 * Off unless SCRAPER_PROXY_URL is set, so nothing changes for anyone who does
 * not want it.
 *
 *   SCRAPER_PROXY_URL=socks5h://127.0.0.1:1080
 *   SCRAPER_PROXY_PROVIDERS=animetosho,bt4g    # optional, default is all
 *
 * Scoping to the providers that need it is the better default in practice: one
 * exit for all 24 adds a single point of failure for the twenty that are
 * already fine, and a VPN exit is usually slower than a direct route.
 */
import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { logger } from './logger.js';

const SOCKS_SCHEMES = new Set(['socks:', 'socks4:', 'socks4a:', 'socks5:', 'socks5h:']);
const HTTP_SCHEMES  = new Set(['http:', 'https:']);

let configured = null;

function config() {
  if (configured) return configured;

  const url = (process.env.SCRAPER_PROXY_URL ?? '').trim();
  const only = (process.env.SCRAPER_PROXY_PROVIDERS ?? '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

  configured = { url, only: new Set(only), agents: null, warned: false };
  if (url) {
    logger.info(
      `Outbound proxy enabled for ${only.length ? only.join(', ') : 'all providers'}`
    );
  }
  return configured;
}

/**
 * Whether a provider's requests should go through the proxy.
 *
 * @param {string} limiterKey  the provider id, as httpClient passes it
 */
export function proxyAppliesTo(limiterKey) {
  const { url, only } = config();
  if (!url) return false;
  if (!only.size) return true;
  return only.has(String(limiterKey ?? '').toLowerCase());
}

/**
 * Agents for the configured proxy, or null when there is no usable proxy.
 *
 * Built once and reused. A malformed or unsupported URL is reported once and
 * then ignored, because a typo in an env var should not take every provider
 * down with it.
 */
export function proxyAgents() {
  const state = config();
  if (!state.url) return null;
  if (state.agents) return state.agents;

  let scheme;
  try {
    scheme = new URL(state.url).protocol;
  } catch {
    if (!state.warned) {
      logger.error(`SCRAPER_PROXY_URL is not a valid URL, ignoring it: ${state.url}`);
      state.warned = true;
    }
    return null;
  }

  try {
    if (SOCKS_SCHEMES.has(scheme)) {
      const agent = new SocksProxyAgent(state.url);
      state.agents = { httpAgent: agent, httpsAgent: agent };
    } else if (HTTP_SCHEMES.has(scheme)) {
      const agent = new HttpsProxyAgent(state.url);
      state.agents = { httpAgent: agent, httpsAgent: agent };
    } else {
      if (!state.warned) {
        logger.error(`SCRAPER_PROXY_URL scheme "${scheme}" is not supported, ignoring it`);
        state.warned = true;
      }
      return null;
    }
  } catch (err) {
    if (!state.warned) {
      logger.error(`SCRAPER_PROXY_URL could not be used, ignoring it: ${err.message}`);
      state.warned = true;
    }
    return null;
  }

  return state.agents;
}

/** Test seam: forget the cached configuration so env changes take effect. */
export function resetProxy() {
  configured = null;
}
