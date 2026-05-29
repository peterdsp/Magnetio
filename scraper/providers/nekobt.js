/**
 * nekoBT provider -- uses the public Torznab-compatible RSS API.
 * Anime-focused tracker with fansub content. No auth required.
 */
import * as cheerio from 'cheerio';
import { get } from '../lib/httpClient.js';
import { parseTitle, buildSearchQuery } from '../lib/titleHelper.js';
import { logger } from '../lib/logger.js';

const BASE = 'https://nekobt.to';

export const id   = 'nekobt';
export const name = 'nekoBT';

export async function scrape(meta) {
  if (meta.type !== 'series' && meta.type !== 'anime') return [];
  if (!meta?.name) return [];

  try {
    const query = buildSearchQuery(meta);

    const { data } = await get(`${BASE}/api/torznab/api`, {
      limiterKey: 'nekobt',
      params: {
        t:   'search',
        q:   query,
        cat: '5070',  // anime category
      },
    });

    const $ = cheerio.load(data, { xmlMode: true });
    const results = [];

    $('item').each((_, item) => {
      const $item = $(item);
      const title = $item.find('title').text().trim();
      if (!title) return;

      // Extract infoHash from torznab attributes or magnet link
      let infoHash = getAttr($, $item, 'infohash');
      if (!infoHash) {
        const magnetUrl = getAttr($, $item, 'magneturl')
          || $item.find('link').text().trim();
        infoHash = extractInfoHash(magnetUrl);
      }
      if (!infoHash) return;

      const seeders  = parseInt(getAttr($, $item, 'seeders') || '0', 10);
      const leechers = parseInt(getAttr($, $item, 'peers') || '0', 10) - seeders;
      const size     = parseInt($item.find('size').text().trim() || getAttr($, $item, 'size') || '0', 10);

      results.push({
        infoHash: infoHash.toLowerCase(),
        title,
        seeders:   seeders || 0,
        leechers:  Math.max(0, leechers) || 0,
        size:      size || 0,
        provider:  'nekoBT',
        imdbId:    meta.imdbId,
        languages: ['ja'],
        ...parseTitle(title),
      });
    });

    return results;
  } catch (err) {
    logger.warn(`[nekoBT] ${err.message}`);
    return [];
  }
}

/**
 * Read a torznab:attr value by name from an item.
 */
function getAttr($, $item, name) {
  let val = null;
  $item.find('torznab\\:attr, attr').each((_, el) => {
    if ($(el).attr('name') === name) {
      val = $(el).attr('value');
    }
  });
  return val;
}

function extractInfoHash(magnet = '') {
  const match = magnet.match(/xt=urn:btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i);
  if (!match) return null;
  const raw = match[1];
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
