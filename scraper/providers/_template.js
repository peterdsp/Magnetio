/**
 * TEMPLATE provider -- copy this file to add a new torrent site.
 *
 * This file is NOT registered in index.js and is never executed. It exists so a
 * new provider starts from the real contract instead of from a guess.
 *
 * Steps:
 *   1. cp _template.js mysite.js
 *   2. Fill in BASE, id, name, and the parsing in scrape().
 *   3. Register it in index.js (import + add to ALL_PROVIDERS).
 *   4. npm test, then:
 *      curl "localhost:8080/streams/movie/tt0068646?providers=mysite"
 *
 * Full walkthrough: ../../CONTRIBUTING.md#adding-a-torrent-provider
 */
import * as cheerio from 'cheerio';
import { get } from '../lib/httpClient.js';
import { parseTitle, buildSearchQuery } from '../lib/titleHelper.js';
// Always use the shared helpers for these two. extractInfoHash converts a
// base32 magnet hash to hex, which a hand-rolled regex does not, and dedup
// across every provider keys on that value. See the note on infoHash below.
import { extractInfoHash, parseSize } from '../lib/magnetHelper.js';
import { logger } from '../lib/logger.js';

const BASE = 'https://example.com';

// Lowercase, no spaces. This is what a user passes in ?providers=
export const id   = 'template';
// Human-readable. Used in logs and in each record's `provider` field.
export const name = 'Template';
// Content types this provider can answer for: any of 'movie', 'series',
// 'anime'. GET /providers reports it, the configure page builds its matrix
// from it, and PROVIDERS.md is generated from it. Declare only what the
// scrape() guard below actually serves, or the matrix lies.
export const types = ['movie', 'series', 'anime'];

/**
 * Search the site and return every release it offers for this content.
 *
 * Do not filter, sort, or deduplicate here. The aggregator deduplicates by
 * infoHash, and the addon filters and sorts. Returning everything is correct.
 *
 * @param {object} meta
 * @param {string} meta.name    Title to search for
 * @param {number} [meta.year]  May be null
 * @param {string} meta.imdbId  e.g. 'tt0068646'
 * @param {string} meta.type    'movie' | 'series' | 'anime'
 * @param {number} [meta.season]
 * @param {number} [meta.episode]
 * @returns {Promise<object[]>}
 */
export async function scrape(meta) {
  if (!meta?.name) return [];

  try {
    // buildSearchQuery produces "Show Name S02E03" for series and
    // "Movie Name 1972" for movies. Prefer it over building the string here.
    const query = buildSearchQuery(meta);

    // Always go through httpClient. It carries the rate limiter, the retry
    // policy, and browser-like headers. `limiterKey` must be this provider's
    // id so one slow site cannot starve the others.
    const { data } = await get(`${BASE}/search`, {
      limiterKey: id,
      params: { q: query },
    });

    const results = [];

    // ---- Shape A: an RSS or XML feed (preferred, most stable) ----------------
    const $ = cheerio.load(data, { xmlMode: true });
    $('item').each((_, item) => {
      const $item = $(item);

      const title = $item.find('title').first().text().trim();
      if (!title) return;

      const magnet = $item.find('link').first().text().trim();
      const infoHash = extractInfoHash(magnet);
      // Skip entries with no usable hash, and intra-feed duplicates.
      if (!infoHash || results.some(r => r.infoHash === infoHash)) return;

      results.push({
        infoHash,                       // REQUIRED, 40-char lowercase hex
        title,                          // REQUIRED, raw release name
        seeders:  0,                    // 0 when the site does not expose it
        leechers: 0,
        size:     parseSize($item.find('size').first().text()),
        provider: name,
        imdbId:   meta.imdbId,
        ...parseTitle(title),           // quality, codec, source, languages, hdr
      });
    });

    // ---- Shape B: a JSON API ------------------------------------------------
    // Replace the block above with something like:
    //
    //   for (const row of data?.results ?? []) {
    //     const infoHash = String(row.info_hash ?? '').toLowerCase();
    //     if (!/^[a-f0-9]{40}$/.test(infoHash)) continue;
    //     results.push({
    //       infoHash,
    //       title:    row.name,
    //       seeders:  Number(row.seeders)  || 0,
    //       leechers: Number(row.leechers) || 0,
    //       size:     Number(row.size_bytes) || 0,
    //       provider: name,
    //       imdbId:   meta.imdbId,
    //       ...parseTitle(row.name),
    //     });
    //   }

    return results;
  } catch (err) {
    // A provider must never throw. One broken site must not fail the scrape.
    logger.warn(`[${name}] ${err.message}`);
    return [];
  }
}

/*
 * Why there are no local extractInfoHash / parseSize helpers here
 * ---------------------------------------------------------------
 * Both live in ../lib/magnetHelper.js and are imported above. Do not
 * reimplement them in a provider.
 *
 * `extractInfoHash` matches the 40-char hex and the 32-char base32 forms of
 * `xt=urn:btih:`, and converts base32 to hex before returning. That conversion
 * is the part that matters: lowercasing a base32 hash leaves a 32-char string
 * that is not the torrent's infoHash. It will never deduplicate against the
 * same torrent found on another site, and a debrid service will reject it. A
 * regex that only lowercases looks correct against a hex-only site and breaks
 * silently the first time the site serves base32.
 *
 * `parseSize` turns "6.64 GB" into bytes and returns 0 for anything it cannot
 * read, which sorts the release last rather than dropping it.
 *
 * If you need a parser that is genuinely specific to your site (an odd date
 * format, a packed peer-count string), define and export it here so it can be
 * unit-tested without touching the network.
 */
