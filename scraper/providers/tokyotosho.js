/** Tokyo Toshokan RSS provider for anime releases. */
import * as cheerio from 'cheerio';
import { get } from '../lib/httpClient.js';
import { parseTitle, buildSearchQuery } from '../lib/titleHelper.js';
import { extractInfoHash, parseSize } from '../lib/magnetHelper.js';
import { logger } from '../lib/logger.js';

const BASE = 'https://www.tokyotosho.info/rss.php';

export const id = 'tokyotosho';
export const name = 'Tokyo Toshokan';
// Content types this provider can answer for. Anime index.
export const types = ['series', 'anime'];

export async function scrape(meta) {
  if ((meta.type !== 'series' && meta.type !== 'anime') || !meta?.name) return [];

  try {
    const { data } = await get(BASE, {
      limiterKey: 'tokyotosho',
      params: { terms: buildSearchQuery(meta), type: 1 },
    });
    return parseFeed(data, meta);
  } catch (err) {
    logger.warn(`[Tokyo Toshokan] ${err.message}`);
    return [];
  }
}

export function parseFeed(xml, meta = {}) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const results = [];

  $('item').each((_, item) => {
    const $item = $(item);
    const category = $item.find('category').first().text().trim().toLowerCase();
    if (category !== 'anime' && category !== 'raws') return;

    const title = $item.find('title').first().text().trim();
    if (!title) return;

    const description = $item.find('description').first().text();
    const $description = cheerio.load(description);
    const magnet = $description('a[href^="magnet:"]').first().attr('href') ?? '';
    const infoHash = extractInfoHash(magnet);
    if (!infoHash || results.some(result => result.infoHash === infoHash)) return;

    const sizeMatch = description.match(/Size:\s*([\d.]+\s*(?:B|KB|MB|GB|TB))/i);
    results.push({
      ...parseTitle(title),
      infoHash,
      title,
      seeders: 0,
      leechers: 0,
      size: sizeMatch ? parseSize(sizeMatch[1]) : 0,
      provider: name,
      imdbId: meta.imdbId,
      // A Japanese index: raws and sub groups both ship Japanese audio, and the
      // sibling anime providers tag the same way (animetosho.js, nekobt.js).
      languages: ['ja'],
    });
  });

  return results;
}
