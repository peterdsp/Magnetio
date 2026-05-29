/**
 * TheRarBG provider -- scrapes search results and detail pages via HTML.
 * Successor to the original RARBG. Supports movies and TV.
 */
import * as cheerio from 'cheerio';
import { get } from '../lib/httpClient.js';
import { parseTitle, buildSearchQuery } from '../lib/titleHelper.js';
import { logger } from '../lib/logger.js';

const BASE = 'https://therarbg.com';

export const id   = 'therarbg';
export const name = 'TheRarBG';

export async function scrape(meta) {
  if (!meta?.name) return [];
  if (meta.type !== 'movie' && meta.type !== 'series') return [];

  try {
    const query = encodeURIComponent(buildSearchQuery(meta));
    const cat   = meta.type === 'movie' ? 'Movies' : 'TV';
    const url   = `${BASE}/get-posts/order:-se:category:${cat}:keywords:${query}/`;

    const { data } = await get(url, { limiterKey: 'therarbg' });
    const $ = cheerio.load(data);

    const detailUrls = [];
    $('table tbody tr').each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length < 3) return;
      const link = $(cells[1]).find('a').first();
      const href = link.attr('href');
      if (href) {
        detailUrls.push(href.startsWith('http') ? href : `${BASE}${href}`);
      }
    });

    const results = [];
    const batches = chunkArray(detailUrls.slice(0, 20), 5);

    for (const batch of batches) {
      const settled = await Promise.allSettled(batch.map(u => fetchDetail(u, meta)));
      for (const r of settled) {
        if (r.status === 'fulfilled' && r.value) results.push(r.value);
      }
    }

    return results;
  } catch (err) {
    logger.warn(`[TheRarBG] ${err.message}`);
    return [];
  }
}

async function fetchDetail(url, meta) {
  try {
    const { data } = await get(url, { limiterKey: 'therarbg' });
    const $ = cheerio.load(data);

    const magnet   = $('a[href^="magnet:"]').first().attr('href') ?? '';
    const infoHash = extractInfoHash(magnet);
    if (!infoHash) return null;

    const title = $('h1').first().text().trim()
      || $('title').text().trim().replace(/ - TheRarBG.*/, '');

    // Try to find seeders/leechers/size from the detail page info
    let seeders = 0;
    let leechers = 0;
    let size = 0;

    $('td, span, div').each((_, el) => {
      const text = $(el).text().trim();
      if (/^Seeds?:?\s*\d/i.test(text)) {
        seeders = parseInt(text.match(/\d[\d,]*/)?.[0]?.replace(/,/g, '') || '0', 10);
      }
      if (/^(?:Leech|Peer)s?:?\s*\d/i.test(text)) {
        leechers = parseInt(text.match(/\d[\d,]*/)?.[0]?.replace(/,/g, '') || '0', 10);
      }
    });

    // Try table cells in the row that likely contains stats
    const cells = $('table tbody tr td');
    if (cells.length >= 8) {
      seeders  = seeders || parseInt($(cells[6]).text().trim().replace(/,/g, ''), 10) || 0;
      leechers = leechers || parseInt($(cells[7]).text().trim().replace(/,/g, ''), 10) || 0;
      size     = size || parseSize($(cells[5]).text().trim());
    }

    return {
      infoHash,
      title: title || '',
      seeders,
      leechers,
      size,
      provider: 'TheRarBG',
      imdbId:   meta.imdbId,
      ...parseTitle(title),
    };
  } catch {
    return null;
  }
}

function extractInfoHash(magnet) {
  const match = magnet.match(/xt=urn:btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i);
  if (!match) return null;
  const raw = match[1];
  // Handle base32-encoded hashes
  if (raw.length === 32) return base32ToHex(raw);
  return raw.toLowerCase();
}

function base32ToHex(str) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of str.toUpperCase()) {
    const val = alphabet.indexOf(c);
    if (val === -1) return null;
    bits += val.toString(2).padStart(5, '0');
  }
  let hex = '';
  for (let i = 0; i + 4 <= bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex.length === 40 ? hex : null;
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
