/**
 * TorrentGalaxy provider -- scrapes search and detail pages via HTML.
 *
 * Search lives at /get-posts/keywords:<query>:category:<Movies|TV>/. The old
 * /torrents.php endpoint now 302s to the homepage (latest uploads), so the
 * search page is validated before parsing. Result rows carry no magnet link,
 * so the magnet is read from each post's detail page.
 */
import * as cheerio from 'cheerio';
import { get } from '../lib/httpClient.js';
import { parseTitle, buildSearchQuery } from '../lib/titleHelper.js';
import { tryDomains, PROVIDER_DOMAINS } from '../lib/domainRotation.js';
import { logger } from '../lib/logger.js';

const DOMAINS = PROVIDER_DOMAINS.torrentgalaxy;

// Detail pages fetched per search; rows are ranked by seeders first.
const MAX_DETAILS = 20;

export const id   = 'torrentgalaxy';
export const name = 'TorrentGalaxy';

export async function scrape(meta) {
  if (!meta?.name) return [];

  try {
    // ':' separates path filters and '/' ends the segment, so strip them
    // (and collapse whitespace, which the site also mis-parses).
    const query = buildSearchQuery(meta).replace(/[:/\\?#]/g, ' ').replace(/\s+/g, ' ').trim();
    const cat   = meta.type === 'movie' ? 'Movies' : 'TV';

    const { data, base } = await tryDomains(DOMAINS, async (base) => {
      const url = `${base}/get-posts/keywords:${encodeURIComponent(query)}:category:${cat}/`;
      const res = await get(url, { limiterKey: 'torrentgalaxy' });
      return { data: res.data, base };
    }, 'TorrentGalaxy', {
      // A redirect to the homepage or any non-search page means the query was dropped.
      validate: ({ data }) => typeof data === 'string' && /<title>\s*Search for\b/i.test(data),
    });

    const $ = cheerio.load(data);
    const rows = [];

    $('div.tgxtablerow').each((_, row) => {
      const $row = $(row);

      const titleEl = $row.find('a.txlight[href^="/post-detail/"]').first();
      const title   = (titleEl.attr('title') || titleEl.text()).trim();
      const href    = titleEl.attr('href');
      if (!title || !href) return;
      if (!matchesEpisode(title, meta)) return;

      // Health renders as [<font><b>seeders</b></font>/<font><b>leechers</b></font>]
      const health   = $row.find('span[title="Seeders/Leechers"] b');
      const seeders  = parseInt(health.eq(0).text().replace(/,/g, ''), 10) || 0;
      const leechers = parseInt(health.eq(1).text().replace(/,/g, ''), 10) || 0;

      const sizeText = $row.find('span.badge-secondary').first().text().trim();
      const size     = parseSize(sizeText);

      rows.push({ title, url: `${base}${href}`, seeders, leechers, size });
    });

    rows.sort((a, b) => b.seeders - a.seeders);

    const results = [];
    const batches = chunkArray(rows.slice(0, MAX_DETAILS), 5);

    for (const batch of batches) {
      const settled = await Promise.allSettled(batch.map(r => fetchInfoHash(r.url)));
      settled.forEach((s, i) => {
        const infoHash = s.status === 'fulfilled' ? s.value : null;
        if (!infoHash) return;
        const { title, seeders, leechers, size } = batch[i];
        results.push({
          infoHash,
          title,
          seeders,
          leechers,
          size,
          provider: 'TorrentGalaxy',
          imdbId:   meta.imdbId,
          ...parseTitle(title),
        });
      });
    }

    return results;
  } catch (err) {
    logger.warn(`[TorrentGalaxy] ${err.message}`);
    return [];
  }
}

async function fetchInfoHash(url) {
  try {
    const { data } = await get(url, { limiterKey: 'torrentgalaxy' });
    const $ = cheerio.load(data);
    const magnet = $('a[href^="magnet:"]').first().attr('href') ?? '';
    return extractInfoHash(magnet);
  } catch {
    return null;
  }
}

/**
 * The site's search is fuzzy (a S01E01 query also returns S01E02..E10), so
 * skip other episodes before spending a detail fetch on them. Season packs
 * are kept, matching the downstream content filter.
 */
function matchesEpisode(title, meta) {
  if (meta.type !== 'series' || meta.season == null || meta.episode == null) return true;
  const s = meta.season;
  const e = meta.episode;
  if (new RegExp(`s0*${s}\\s*e0*${e}(?!\\d)`, 'i').test(title)) return true;
  if (new RegExp(`\\b${s}x0*${e}\\b`, 'i').test(title)) return true;
  if (new RegExp(`\\bs0*${s}\\s*e\\d`, 'i').test(title)) return false;
  return new RegExp(`\\bseason\\s*0*${s}\\b|\\bs0*${s}\\b`, 'i').test(title);
}

function extractInfoHash(magnet) {
  const match = magnet.match(/xt=urn:btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i);
  return match ? match[1].toLowerCase() : null;
}

function parseSize(str) {
  if (!str) return 0;
  const m = str.replace(/,/g, '').match(/([\d.]+)\s*(B|KB|MB|GB|TB)/i);
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
