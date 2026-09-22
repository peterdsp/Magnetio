/**
 * Rutor provider -- scrapes rutor.info for Russian-language torrents.
 *
 * Titles look like "Russian name / English name [S01-08] (2011-2019) ...",
 * and series are released as season packs tagged [S01], [S01-08] or
 * [01x01-10 из 10], so series are searched by season rather than episode.
 */
import * as cheerio from 'cheerio';
import { get } from '../lib/httpClient.js';
import { parseTitle } from '../lib/titleHelper.js';
import { tryDomains, PROVIDER_DOMAINS } from '../lib/domainRotation.js';
import { logger } from '../lib/logger.js';

const DOMAINS = PROVIDER_DOMAINS.rutor;

// Search URL path: /search/<page>/<category>/<method><in>0/<sort>/<query>
// method 1 = all words, in 0 = title only, sort 2 = seeders descending.
const SEARCH_PATH = '/search/0/0/100/2/';

// Soundtracks and standalone audio-track releases are not playable video.
const NON_VIDEO = /\b(flac|mp3|ost|soundtrack)\b|звуковые дорожки/i;

export const id   = 'rutor';
export const name = 'Rutor';

export async function scrape(meta) {
  if (!meta?.name) return [];

  try {
    const query = buildRutorQuery(meta);

    const { data } = await tryDomains(DOMAINS, async (base) => {
      return get(`${base}${SEARCH_PATH}${encodeURIComponent(query)}`, {
        limiterKey: 'rutor',
      });
    }, 'Rutor');

    const $       = cheerio.load(data);
    const results = [];

    $('#index tr').each((_, row) => {
      const $row  = $(row);
      const title = $row.find('a[href^="/torrent/"]').first().text().replace(/\s+/g, ' ').trim();
      if (!title || NON_VIDEO.test(title)) return;

      if (meta.type === 'series' && meta.season != null && !coversSeason(title, meta.season)) return;

      const magnet   = $row.find('a[href^="magnet:"]').first().attr('href') ?? '';
      const infoHash = extractInfoHash(magnet);
      if (!infoHash) return;

      const seeders  = parseInt($row.find('span.green').first().text().trim(), 10) || 0;
      const leechers = parseInt($row.find('span.red').first().text().trim(), 10) || 0;
      // Last cell is peers; size is the one before it (a comments cell may precede).
      const sizeText = $row.find('td').eq(-2).text().trim();
      const size     = parseSize(sizeText);

      results.push({
        infoHash,
        title,
        seeders,
        leechers,
        size,
        provider:  'Rutor',
        imdbId:    meta.imdbId,
        ...parseTitle(title),
        languages: ['ru'],
      });
    });

    return results;
  } catch (err) {
    logger.warn(`[Rutor] ${err.message}`);
    return [];
  }
}

/**
 * Movies: "Name 2010". Series: "Name S01", which Rutor's all-words search
 * matches against pack tags such as [S01] and [S01-08].
 */
function buildRutorQuery(meta) {
  if (meta.type === 'series' && meta.season != null) {
    return `${meta.name} S${String(meta.season).padStart(2, '0')}`;
  }
  if (meta.year) return `${meta.name} ${meta.year}`;
  return meta.name;
}

/**
 * True when the title's season tag covers the requested season:
 * [S01], [s03], [S01-08], [S01E01-10], [01x01-10 из 10].
 */
function coversSeason(title, season) {
  const range = title.match(/\[\s*s(\d{1,2})(?:e\d+(?:-\d+)?)?(?:\s*-\s*s?(\d{1,2}))?/i);
  if (range) {
    const start = parseInt(range[1], 10);
    const end   = range[2] ? parseInt(range[2], 10) : start;
    return season >= start && season <= end;
  }
  const cross = title.match(/\[\s*(\d{1,2})x\d+/i);
  if (cross) return parseInt(cross[1], 10) === season;
  return false;
}

function extractInfoHash(magnet = '') {
  const match = magnet.match(/xt=urn:btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i);
  return match ? match[1].toLowerCase() : null;
}

function parseSize(str) {
  if (!str) return 0;
  const m = str.match(/([\d.,]+)\s*(B|KB|MB|GB|TB)/i);
  if (!m) return 0;
  const val   = parseFloat(m[1].replace(',', '.'));
  const units = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4 };
  return Math.round(val * (units[m[2].toLowerCase()] ?? 1));
}
