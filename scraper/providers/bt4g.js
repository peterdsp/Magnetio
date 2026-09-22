/**
 * BT4G provider -- reads the bt4gprx.com search RSS feed.
 * Supports movies and series.
 *
 * The HTML search page sits behind a Cloudflare managed challenge, while the
 * RSS feed is served directly. The feed carries title, magnet and size but no
 * peer counts, so seeders and leechers are reported as 0.
 */
import * as cheerio from 'cheerio';
import { get } from '../lib/httpClient.js';
import { parseTitle, buildSearchQuery } from '../lib/titleHelper.js';
import { logger } from '../lib/logger.js';

const BASE = 'https://bt4gprx.com';

export const id   = 'bt4g';
export const name = 'BT4G';

export async function scrape(meta) {
  if (!meta?.name) return [];

  try {
    const query = buildSearchQuery(meta);

    const { data } = await get(`${BASE}/search`, {
      limiterKey: 'bt4g',
      params: { q: query, page: 'rss', orderby: 'seeders' },
    });

    const $ = cheerio.load(data, { xmlMode: true });
    const results = [];

    $('item').each((_, item) => {
      const $item = $(item);

      const title = $item.find('title').first().text().trim();
      if (!title) return;

      const magnet = $item.find('link').first().text().trim();
      const infoHash = extractInfoHash(magnet);
      if (!infoHash || results.some(result => result.infoHash === infoHash)) return;

      // Description is "<title><br>6.64GB<br>Movie<br><infohash>"
      const description = $item.find('description').first().text();
      const size = parseSize(description.split(/<br\s*\/?>/i)[1]);

      results.push({
        infoHash,
        title,
        seeders: 0,
        leechers: 0,
        size,
        provider: 'BT4G',
        imdbId: meta.imdbId,
        ...parseTitle(title),
      });
    });

    return results;
  } catch (err) {
    logger.warn(`[BT4G] ${err.message}`);
    return [];
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
