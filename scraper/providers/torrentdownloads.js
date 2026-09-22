/**
 * TorrentDownloads provider -- scrapes torrentdownload.info search results via HTML.
 *
 * Search lives at /search?q=<query>. The old /search/?search= form now serves
 * the homepage (latest uploads), so the search page is validated before
 * parsing. Each result links to /<INFOHASH>/<slug>, which yields the hash.
 */
import * as cheerio from 'cheerio';
import { get } from '../lib/httpClient.js';
import { parseTitle, buildSearchQuery } from '../lib/titleHelper.js';
import { tryDomains, PROVIDER_DOMAINS } from '../lib/domainRotation.js';
import { logger } from '../lib/logger.js';

const DOMAINS = PROVIDER_DOMAINS.torrentdownloads;

export const id   = 'torrentdownloads';
export const name = 'TorrentDownloads';

export async function scrape(meta) {
  if (!meta?.name) return [];

  try {
    const query = buildSearchQuery(meta);

    const { data } = await tryDomains(DOMAINS, async (base) => {
      return get(`${base}/search`, {
        limiterKey: 'torrentdownloads',
        params: { q: query },
      });
    }, 'TorrentDownloads', {
      // Search pages carry '1 - 50 of N for "<query>"' or 'No Results Found'.
      validate: ({ data }) => typeof data === 'string' && /\bof [\d,]+ for "|No Results Found/i.test(data),
    });

    const $ = cheerio.load(data);
    const results = [];

    // Result rows: name | added | size | seeders | leechers. Sponsored rows
    // at the top of the table link elsewhere and carry no hash.
    $('table.table2 tr').each((_, row) => {
      const $row  = $(row);
      const cells = $row.find('td');
      if (cells.length < 5) return;

      const titleEl = cells.eq(0).find('.tt-name a').first();
      const hash    = (titleEl.attr('href') ?? '').match(/^\/([a-fA-F0-9]{40})\//)?.[1]?.toLowerCase();
      if (!hash) return;

      const title = titleEl.text().replace(/\s+/g, ' ').trim();
      if (!title) return;

      const size     = parseSize(cells.eq(2).text().trim());
      const seeders  = parseInt(cells.eq(3).text().replace(/,/g, ''), 10) || 0;
      const leechers = parseInt(cells.eq(4).text().replace(/,/g, ''), 10) || 0;

      results.push({
        infoHash: hash,
        title,
        seeders,
        leechers,
        size,
        provider: 'TorrentDownloads',
        imdbId: meta.imdbId,
        ...parseTitle(title),
      });
    });

    return results;
  } catch (err) {
    logger.warn(`[TorrentDownloads] ${err.message}`);
    return [];
  }
}

function parseSize(str) {
  if (!str) return 0;
  const m = str.replace(/,/g, '').match(/([\d.]+)\s*(B|KB|MB|GB|TB)/i);
  if (!m) return 0;
  const val   = parseFloat(m[1]);
  const units = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4 };
  return Math.round(val * (units[m[2].toLowerCase()] ?? 1));
}
