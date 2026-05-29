/**
 * SubsPlease provider -- uses the official SubsPlease JSON API.
 * Anime only. Returns 480p, 720p, and 1080p variants per episode.
 */
import { get } from '../lib/httpClient.js';
import { parseTitle } from '../lib/titleHelper.js';
import { logger } from '../lib/logger.js';

const BASE = 'https://subsplease.org';

export const id   = 'subsplease';
export const name = 'SubsPlease';

export async function scrape(meta) {
  if (meta.type !== 'series' && meta.type !== 'anime') return [];
  if (!meta?.name) return [];

  try {
    const { data } = await get(`${BASE}/api/`, {
      limiterKey: 'subsplease',
      responseType: 'json',
      params: {
        f: 'search',
        tz: 'UTC',
        s: meta.name,
      },
    });

    if (!data || typeof data !== 'object') return [];

    const results = [];

    for (const [, entry] of Object.entries(data)) {
      if (!entry?.downloads?.length) continue;

      // Parse episode number from entry
      const epStr = entry.episode?.toString() ?? '';
      const epNum = parseInt(epStr.replace(/v\d+$/, ''), 10);

      // If requesting a specific episode, filter
      if (meta.episode != null && !isNaN(epNum) && epNum !== meta.episode) continue;

      for (const dl of entry.downloads) {
        const magnet = dl.magnet ?? '';
        const infoHash = extractInfoHash(magnet);
        if (!infoHash) continue;

        const res = dl.res ?? '';
        const quality = res === '1080' ? '1080p' : res === '720' ? '720p' : res === '480' ? '480p' : null;

        // Extract file size from magnet xl= parameter
        const sizeMatch = magnet.match(/&xl=(\d+)/);
        const size = sizeMatch ? parseInt(sizeMatch[1], 10) : 0;

        // Build title from display name
        const dnMatch = magnet.match(/&dn=([^&]+)/);
        const title = dnMatch ? decodeURIComponent(dnMatch[1].replace(/\+/g, ' ')) : `${entry.show} - ${entry.episode} (${res}p)`;

        results.push({
          infoHash,
          title,
          seeders:   0, // SubsPlease API does not provide seeder counts
          leechers:  0,
          size,
          provider:  'SubsPlease',
          imdbId:    meta.imdbId,
          quality,
          languages: ['ja'],
          source:    'WEB',
          ...parseTitle(title),
        });
      }
    }

    return results;
  } catch (err) {
    logger.warn(`[SubsPlease] ${err.message}`);
    return [];
  }
}

function extractInfoHash(magnet) {
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
