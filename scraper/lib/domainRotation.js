import { logger } from './logger.js';

const domainHealth = new Map();
const COOLDOWN_MS = 5 * 60 * 1000;

function isHealthy(domain) {
  const entry = domainHealth.get(domain);
  if (!entry) return true;
  if (Date.now() - entry.failedAt > COOLDOWN_MS) {
    domainHealth.delete(domain);
    return true;
  }
  return false;
}

function markFailed(domain) {
  domainHealth.set(domain, { failedAt: Date.now() });
}

function markHealthy(domain) {
  domainHealth.delete(domain);
}

export async function tryDomains(domains, requestFn, providerName) {
  const healthy = domains.filter(isHealthy);
  const candidates = healthy.length > 0 ? healthy : domains;

  for (const domain of candidates) {
    try {
      const result = await requestFn(domain);
      markHealthy(domain);
      return result;
    } catch (err) {
      const status = err.response?.status;
      const isBadDomain = !status || status >= 500 || status === 403;
      if (isBadDomain) {
        markFailed(domain);
        logger.debug(`[${providerName}] domain ${domain} failed (${status ?? err.code ?? err.message}), trying next`);
      } else {
        throw err;
      }
    }
  }

  throw new Error(`[${providerName}] all domains exhausted`);
}

export const UNBLOCKIT = 'unblockit.download';

export const PROVIDER_DOMAINS = {
  '1337x': [
    'https://1337x.to',
    'https://1337x.st',
    'https://1337x.gd',
    `https://1337x.${UNBLOCKIT}`,
  ],
  eztv: [
    'https://eztv.re',
    'https://eztvx.to',
    `https://eztv.${UNBLOCKIT}`,
  ],
  limetorrents: [
    'https://www.limetorrents.fun',
    'https://www.limetorrents.lol',
    `https://limetorrents.${UNBLOCKIT}`,
  ],
  kickasstorrents: [
    'https://katcr.to',
    'https://kickasstorrents.to',
    `https://kickasstorrents.${UNBLOCKIT}`,
  ],
  torrentgalaxy: [
    'https://torrentgalaxy.one',
    'https://torrentgalaxy.to',
    `https://torrentgalaxy.${UNBLOCKIT}`,
  ],
  yts: [
    'https://yts.do',
    'https://yts.mx',
    `https://yts.${UNBLOCKIT}`,
  ],
  thepiratebay: [
    'https://apibay.org',
    'https://thepiratebay.org',
    `https://thepiratebay.${UNBLOCKIT}`,
  ],
  glotorrents: [
    'https://glodls.to',
    'https://gtso.cc',
  ],
  torlock: [
    'https://torlock2.com',
    'https://torlock.com',
  ],
  torrentdownloads: [
    'https://torrentdownload.info',
    'https://torrentdownloads.pro',
  ],
};
