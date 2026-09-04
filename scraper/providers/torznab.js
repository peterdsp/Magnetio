/**
 * Torznab provider -- queries any Torznab-compatible endpoint (Jackett, Prowlarr, etc.).
 * Conditionally active: returns [] when no torznabUrl is configured.
 */
import net from 'node:net';
import { lookup } from 'node:dns/promises';
import * as cheerio from 'cheerio';
import { get } from '../lib/httpClient.js';
import { parseTitle, buildSearchQuery } from '../lib/titleHelper.js';
import { logger } from '../lib/logger.js';

export const id   = 'torznab';
export const name = 'Torznab';

const CATEGORY_MOVIES = '2000';
const CATEGORY_TV     = '5000';

export async function scrape(meta) {
  const baseUrl = meta.torznabUrl;
  const apiKey  = meta.torznabApiKey;
  if (!baseUrl) return [];

  if (!(await isUrlSafe(baseUrl))) {
    logger.warn('[Torznab] Rejected unsafe or invalid URL');
    return [];
  }

  try {
    const params = buildParams(meta, apiKey);

    const { data } = await get(baseUrl, {
      limiterKey: 'torznab',
      timeout: 15_000,
      params,
    });

    const $ = cheerio.load(data, { xmlMode: true });
    const results = [];

    $('item').each((_, el) => {
      const item = $(el);
      const record = normalise(item, meta);
      if (record) results.push(record);
    });

    const redactedUrl = (() => { try { return new URL(baseUrl).origin; } catch { return '(invalid)'; } })();
    logger.info(`[Torznab] ${results.length} results from ${redactedUrl}`);
    return results;
  } catch (err) {
    logger.warn(`[Torznab] ${err.message}`);
    return [];
  }
}

function buildParams(meta, apiKey) {
  const params = {};
  if (apiKey) params.apikey = apiKey;

  if (meta.imdbId && meta.type === 'movie') {
    params.t = 'movie';
    params.imdbid = meta.imdbId;
  } else if (meta.imdbId && (meta.type === 'series' || meta.type === 'anime')) {
    params.t = 'tvsearch';
    params.imdbid = meta.imdbId;
    if (meta.season != null) params.season = meta.season;
    if (meta.episode != null) params.ep = meta.episode;
  } else {
    params.t = 'search';
    params.q = buildSearchQuery(meta);
    params.cat = meta.type === 'movie' ? CATEGORY_MOVIES : CATEGORY_TV;
  }

  return params;
}

function normalise(item, meta) {
  const title = item.find('title').text().trim();
  if (!title) return null;

  const infoHash = extractInfoHash(item);
  if (!infoHash) return null;

  const seeders  = attrValue(item, 'seeders');
  const peers    = attrValue(item, 'peers');
  const sizeEl   = item.find('size').text();
  const encLen   = item.find('enclosure').attr('length');

  const parsed = parseTitle(title);

  const parsedSeeders = parseInt(seeders, 10);
  const parsedPeers   = parseInt(peers, 10);
  const parsedSize    = parseInt(sizeEl || encLen || '0', 10);

  return {
    infoHash,
    title,
    seeders:  Number.isFinite(parsedSeeders) ? parsedSeeders : 0,
    leechers: Number.isFinite(parsedPeers) ? Math.max(0, parsedPeers - (parsedSeeders || 0)) : 0,
    size:     Number.isFinite(parsedSize) ? parsedSize : 0,
    provider: 'Torznab',
    imdbId:   meta.imdbId || null,
    ...parsed,
  };
}

function extractInfoHash(item) {
  const hashAttr = attrValue(item, 'infohash');
  if (hashAttr) return hashAttr.toLowerCase();

  const link = item.find('link').text().trim();
  const magnetMatch = link.match(/magnet:\?xt=urn:btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i);
  if (magnetMatch) {
    const hash = magnetMatch[1];
    return hash.length === 32 ? base32ToHex(hash) : hash.toLowerCase();
  }

  const comments = item.find('comments').text().trim();
  const commentsMatch = comments.match(/magnet:\?xt=urn:btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i);
  if (commentsMatch) {
    const hash = commentsMatch[1];
    return hash.length === 32 ? base32ToHex(hash) : hash.toLowerCase();
  }

  return null;
}

function attrValue(item, attrName) {
  const el = item.find(`torznab\\:attr[name="${attrName}"], attr[name="${attrName}"]`);
  return el.length ? el.attr('value') : null;
}

const INTERNAL_SUFFIXES = ['.localhost', '.local', '.internal'];
const DNS_TIMEOUT_MS = 5_000;

/**
 * SSRF guard for the user-supplied Torznab base URL.
 *
 * A plain string match on the hostname is not enough: an internal address can
 * be written as a decimal, hex or octal integer (http://2130706433/ is
 * 127.0.0.1), as an IPv6 literal (http://[::1]/) or as an IPv4-mapped IPv6
 * address (http://[::ffff:127.0.0.1]/), none of which look like "127.0.0.1" or
 * "10.x". So we range-check the actual address bytes instead, and for real
 * hostnames we resolve them and range-check every answer.
 *
 * Async because of the DNS lookup. This narrows the attack surface but does not
 * defeat active DNS rebinding, which would need the resolved IP to be pinned at
 * connect time (a change to the HTTP layer, out of scope here).
 */
export async function isUrlSafe(urlStr) {
  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

  // new URL() canonicalises numeric IPv4 forms to dotted-decimal and returns
  // IPv6 literals wrapped in brackets. Drop the brackets so net.isIP() and the
  // range checks see a bare address.
  let host = parsed.hostname.toLowerCase();
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);

  // Literal IP (v4 or v6, in any encoding): check the bytes directly, no DNS.
  if (net.isIP(host) !== 0) return !isPrivateIp(host);

  // Hostname: reject names that never point at a public host, then resolve the
  // rest and reject if any resolved address is private or reserved.
  if (host === 'localhost' || INTERNAL_SUFFIXES.some(s => host.endsWith(s))) return false;
  return !(await resolvesToPrivate(host));
}

async function resolvesToPrivate(host) {
  try {
    const addrs = await withTimeout(lookup(host, { all: true }), DNS_TIMEOUT_MS);
    if (!addrs.length) return true;                     // no address, cannot verify
    return addrs.some(a => isPrivateIp(a.address));
  } catch {
    return true;                                        // lookup failed or timed out, fail closed
  }
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('dns timeout')), ms);
    timer.unref?.();
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * True when an IP literal (v4 or v6) is loopback, private, link-local,
 * carrier-grade NAT, multicast or otherwise not a public unicast address.
 * Anything that is not a valid literal is treated as unsafe (fail closed).
 */
export function isPrivateIp(ip) {
  const family = net.isIP(ip);
  if (family === 4) return isPrivateIpv4(ip);
  if (family === 6) return isPrivateIpv6(ip);
  return true;
}

function isPrivateIpv4(ip) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b, c] = p;
  if (a === 0)   return true;                            // 0.0.0.0/8    this host
  if (a === 10)  return true;                            // 10.0.0.0/8   private
  if (a === 127) return true;                            // 127.0.0.0/8  loopback
  if (a === 100 && b >= 64 && b <= 127) return true;     // 100.64.0.0/10 carrier-grade NAT
  if (a === 169 && b === 254) return true;               // 169.254.0.0/16 link-local (incl. 169.254.169.254 metadata)
  if (a === 172 && b >= 16 && b <= 31) return true;      // 172.16.0.0/12 private
  if (a === 192 && b === 0 && c === 0) return true;      // 192.0.0.0/24  IETF protocol assignments
  if (a === 192 && b === 168) return true;               // 192.168.0.0/16 private
  if (a === 198 && (b === 18 || b === 19)) return true;  // 198.18.0.0/15 benchmarking
  if (a >= 224) return true;                             // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved
  return false;
}

function isPrivateIpv6(addr) {
  const b = ipv6ToBytes(addr);
  if (b.length !== 16) return true;
  // IPv4-mapped ::ffff:0:0/96 and IPv4-compatible ::/96 (which also covers ::,
  // ::1 and the deprecated ::a.b.c.d form): defer to the embedded IPv4 checks.
  if (b.slice(0, 10).every(x => x === 0) && b[10] === 0xff && b[11] === 0xff)
    return isPrivateIpv4(`${b[12]}.${b[13]}.${b[14]}.${b[15]}`);
  if (b.slice(0, 12).every(x => x === 0))
    return isPrivateIpv4(`${b[12]}.${b[13]}.${b[14]}.${b[15]}`);
  if ((b[0] & 0xfe) === 0xfc) return true;                   // fc00::/7  unique local
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) return true;  // fe80::/10 link-local
  if (b[0] === 0xff) return true;                            // ff00::/8  multicast
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x0d && b[3] === 0xb8) return true; // 2001:db8::/32 docs
  return false;
}

// Expand a net.isIP()-validated IPv6 literal into its 16 bytes, first rewriting
// any embedded dotted-quad tail (e.g. ::ffff:127.0.0.1) into two hextets.
function ipv6ToBytes(addr) {
  addr = addr.toLowerCase();
  if (addr.includes('.')) {
    const idx = addr.lastIndexOf(':');
    const o = addr.slice(idx + 1).split('.').map(n => parseInt(n, 10));
    const hi = ((o[0] << 8) | o[1]).toString(16);
    const lo = ((o[2] << 8) | o[3]).toString(16);
    addr = `${addr.slice(0, idx + 1)}${hi}:${lo}`;
  }
  let groups;
  if (addr.includes('::')) {
    const [head, tail] = addr.split('::');
    const headParts = head ? head.split(':') : [];
    const tailParts = tail ? tail.split(':') : [];
    const missing = 8 - (headParts.length + tailParts.length);
    groups = [...headParts, ...Array(Math.max(0, missing)).fill('0'), ...tailParts];
  } else {
    groups = addr.split(':');
  }
  const bytes = [];
  for (const g of groups) {
    const v = parseInt(g || '0', 16);
    bytes.push((v >> 8) & 0xff, v & 0xff);
  }
  return bytes;
}

function base32ToHex(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of base32.toUpperCase()) {
    const val = alphabet.indexOf(c);
    if (val === -1) return null;
    bits += val.toString(2).padStart(5, '0');
  }
  let hex = '';
  for (let i = 0; i + 4 <= bits.length; i += 4) {
    hex += parseInt(bits.substring(i, i + 4), 2).toString(16);
  }
  return hex.length === 40 ? hex : null;
}
