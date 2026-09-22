/**
 * TorLock provider -- scrapes torlock2.com search results via HTML.
 * Verified torrents only (TorLock's USP).
 *
 * The search page no longer carries magnet links, so the info hash is read
 * from each result's detail page. The first rows of every search page are
 * sponsored links to external hosts; only rows with an `a.tl-name` link to a
 * local /torrent/<id>/ page are real results.
 */
import * as cheerio from 'cheerio';
import { get } from '../lib/httpClient.js';
import { parseTitle, buildSearchQuery } from '../lib/titleHelper.js';
import { tryDomains, PROVIDER_DOMAINS } from '../lib/domainRotation.js';
import { logger } from '../lib/logger.js';

const DOMAINS = PROVIDER_DOMAINS.torlock;

// Detail pages fetched per search (one request each), highest seeded first.
const MAX_DETAILS = 20;

export const id   = 'torlock';
export const name = 'TorLock';

export async function scrape(meta) {
  if (!meta?.name) return [];

  try {
    const query = buildSearchQuery(meta);
    const cat   = meta.type === 'movie' ? 'movies' : 'television';

    const { data, base } = await tryDomains(DOMAINS, async (base) => {
      const url = `${base}/${cat}/torrents/${encodeURIComponent(query)}.html`;
      const res = await get(url, { limiterKey: 'torlock' });
      return { data: res.data, base };
    }, 'TorLock');

    const $ = cheerio.load(data);
    const rows = [];

    $('table.tl-list tr').each((_, row) => {
      const $row = $(row);
      const titleEl = $row.find('a.tl-name').first();
      const title = titleEl.text().replace(/\s+/g, ' ').trim();
      if (!title) return;

      const detailHref = titleEl.attr('href') ?? '';
      if (!/^\/torrent\/\d+\//.test(detailHref)) return;

      rows.push({
        title,
        url:      `${base}${detailHref}`,
        size:     parseSize($row.find('td.ts').first().text().trim()),
        seeders:  parseInt($row.find('td.tul').first().text().trim(), 10) || 0,
        leechers: parseInt($row.find('td.tdl').first().text().trim(), 10) || 0,
      });
    });

    rows.sort((a, b) => b.seeders - a.seeders);

    const results = [];
    const batches = chunkArray(rows.slice(0, MAX_DETAILS), 5);

    for (const batch of batches) {
      const settled = await Promise.allSettled(batch.map(r => fetchInfoHash(r.url)));
      settled.forEach((s, i) => {
        const infoHash = s.status === 'fulfilled' ? s.value : null;
        if (!infoHash) return;
        const row = batch[i];
        results.push({
          infoHash,
          title:    row.title,
          seeders:  row.seeders,
          leechers: row.leechers,
          size:     row.size,
          provider: 'TorLock',
          imdbId:   meta.imdbId,
          ...parseTitle(row.title),
        });
      });
    }

    return results;
  } catch (err) {
    logger.warn(`[TorLock] ${err.message}`);
    return [];
  }
}

async function fetchInfoHash(url) {
  try {
    const { data } = await get(url, { limiterKey: 'torlock', retries: 0 });
    const $ = cheerio.load(data);
    const magnet = $('a[href^="magnet:"]').first().attr('href') ?? '';
    return extractInfoHash(magnet);
  } catch {
    return null;
  }
}

function extractInfoHash(magnet) {
  const match = magnet.match(/xt=urn:btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i);
  return match ? match[1].toLowerCase() : null;
}

function parseSize(str) {
  if (!str) return 0;
  const m = str.match(/([\d.]+)\s*(B|KB|MB|GB|TB)/i);
  if (!m) return 0;
  const val   = parseFloat(m[1]);
  const units = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4 };
  return Math.round(val * (units[m[2].toLowerCase()] ?? 1));
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}
