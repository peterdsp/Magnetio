/**
 * Provider aggregator -- runs all enabled scrapers in parallel
 * and returns a unified, deduplicated list of torrent records.
 */
import pLimit from 'p-limit';
import * as yts              from './yts.js';
import * as eztv             from './eztv.js';
import * as thepiratebay     from './thepiratebay.js';
import * as torrentgalaxy    from './torrentgalaxy.js';
import * as leetx            from './leetx.js';
import * as kickasstorrents  from './kickasstorrents.js';
import * as nyaa             from './nyaa.js';
import * as animesaturn      from './animesaturn.js';
import * as rutor            from './rutor.js';
import * as rutracker        from './rutracker.js';
import * as limetorrents     from './limetorrents.js';
import * as bitsearch        from './bitsearch.js';
import * as bt4g             from './bt4g.js';
import * as btdig            from './btdig.js';
import * as glotorrents      from './glotorrents.js';
import * as torlock          from './torlock.js';
import * as torrentdownloads from './torrentdownloads.js';
import * as therarbg         from './therarbg.js';
import * as subsplease       from './subsplease.js';
import * as animetosho       from './animetosho.js';
import * as nekobt           from './nekobt.js';
import * as tokyotosho       from './tokyotosho.js';
import * as torznab          from './torznab.js';
import { logger } from '../lib/logger.js';

const ALL_PROVIDERS = [
  yts,
  eztv,
  thepiratebay,
  torrentgalaxy,
  leetx,
  kickasstorrents,
  nyaa,
  animesaturn,
  rutor,
  rutracker,
  limetorrents,
  bitsearch,
  bt4g,
  btdig,
  glotorrents,
  torlock,
  torrentdownloads,
  therarbg,
  subsplease,
  animetosho,
  nekobt,
  tokyotosho,
  torznab,
];

// Providers disabled on this host via env (comma-separated provider ids), e.g.
// SCRAPER_DISABLED_PROVIDERS=glotorrents,kickasstorrents,1337x
// Disabled providers are skipped even when a client explicitly requests them.
const DISABLED_PROVIDERS = new Set(
  (process.env.SCRAPER_DISABLED_PROVIDERS ?? "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
);
const ACTIVE_PROVIDERS = ALL_PROVIDERS.filter(p => !DISABLED_PROVIDERS.has(p.id));
if (DISABLED_PROVIDERS.size) {
  logger.info(`Disabled providers: ${[...DISABLED_PROVIDERS].join(", ")}`);
}

const limit = pLimit(Math.max(1, parseInt(process.env.SCRAPER_CONCURRENCY ?? '12', 10) || 12));
const PROVIDER_TIMEOUT_MS = parseInt(process.env.SCRAPER_PROVIDER_TIMEOUT_MS ?? '15000', 10);
const HARD_TIMEOUT_MS     = parseInt(process.env.SCRAPER_HARD_TIMEOUT_MS     ?? String(PROVIDER_TIMEOUT_MS + 2000), 10);
const EARLY_RETURN_MS     = parseInt(process.env.SCRAPER_EARLY_RETURN_MS     ?? '6000', 10);
const MIN_EARLY_RESULTS   = parseInt(process.env.SCRAPER_MIN_EARLY_RESULTS   ?? '10', 10);

// Extra search passes for non-English audio. Each pass re-queries every
// provider with a different name, so these stay low on purpose. Both default to
// one and only ever fire when a request actually asks for another language.
const MAX_ALIAS_QUERIES = parseInt(process.env.SCRAPER_MAX_ALIAS_QUERIES ?? '1', 10);
const MAX_TAG_QUERIES   = parseInt(process.env.SCRAPER_MAX_TAG_QUERIES   ?? '1', 10);

// Years a release name may differ from the catalogue's and still be the same
// film: a late local release or a festival year shifts it by one either way.
const YEAR_SLACK = 1;
const YEAR_IN_NAME = /\b(?:19|20)\d{2}\b/g;

/**
 * Scrape all (or a subset of) providers for a given content item.
 * Uses early-return: responds after EARLY_RETURN_MS if enough results
 * are collected, without waiting for slow providers.
 *
 * @param {string}   type        'movie' | 'series' | 'anime'
 * @param {object}   meta        From cinemeta: { name, year, imdbId, season, episode }
 * @param {string[]} providerIds Optional whitelist of provider IDs
 * @param {object}   context     Optional per-request context (e.g. { torznabUrl, torznabApiKey })
 * @returns {Promise<TorrentRecord[]>}
 */
export async function scrapeAll(type, meta, providerIds = null, context = {}) {
  const providers = ACTIVE_PROVIDERS.filter(p =>
    !providerIds || providerIds.includes(p.id)
  );

  // One job per provider per query variant. With no localized titles or
  // release tags there is exactly one variant, so this is the original fan-out.
  const queries = queryVariants(meta);
  const jobs = providers.flatMap(p =>
    queries.map(({ meta: query, localized }) => ({
      provider: p,
      query,
      localized,
      label: localized ? `${p.name} "${query.name}"` : p.name,
    }))
  );
  if (queries.length > 1) {
    logger.info(`Extra search passes: ${queries.slice(1).map(q => `"${q.meta.name}"`).join(', ')}`);
  }

  const collected = [];
  let matchedCount = 0;
  let resolved = false;
  const startedAt = Date.now();
  let completedCount = 0;
  // The base pass usually satisfies the early-return threshold on its own, and
  // it returns English releases. Returning there would cut off the localized
  // passes and hand a user who asked for Italian an English-only list, so the
  // early return waits for them. The hard timeout still applies.
  let pendingLocalized = jobs.filter(j => j.localized).length;

  return new Promise((resolve) => {
    const finalize = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(earlyTimer);
      clearTimeout(hardTimer);

      logger.info(`Scrape totals: ${collected.length} raw, ${completedCount}/${jobs.length} searches responded`);
      const deduped = deduplicate(collected);
      const matched = filterByContent(deduped, meta);
      if (deduped.length !== matched.length) {
        logger.info(`Content filter: ${deduped.length} -> ${matched.length} (dropped ${deduped.length - matched.length} unrelated)`);
      }
      resolve(matched);
    };

    // Early return: after EARLY_RETURN_MS, return if we have enough results.
    // Counts only results that pass the content filter, so a provider that
    // dumps an unrelated feed can't trigger an early return that ends empty.
    const earlyTimer = setTimeout(() => {
      if (!resolved && !pendingLocalized && matchedCount >= MIN_EARLY_RESULTS) {
        logger.info(`Early return: ${matchedCount} matching results from ${completedCount}/${jobs.length} searches after ${EARLY_RETURN_MS}ms`);
        finalize();
      }
    }, EARLY_RETURN_MS);

    // Hard deadline: cut off after HARD_TIMEOUT_MS even if providers are still pending
    const hardTimer = setTimeout(() => {
      if (!resolved) {
        logger.info(`Hard timeout: ${collected.length} results from ${completedCount}/${jobs.length} searches after ${HARD_TIMEOUT_MS}ms`);
        finalize();
      }
    }, HARD_TIMEOUT_MS);

    // Launch every provider/query pair in parallel (concurrency-limited)
    const tasks = jobs.map(({ provider: p, query, label, localized }) =>
      limit(async () => {
        if (resolved) return;
        const start = Date.now();
        try {
          const results = await withTimeout(
            p.scrape({ ...query, ...context, type }),
            PROVIDER_TIMEOUT_MS,
            `${p.name} timed out`
          );
          // An extra pass searches without the year, so another film of the
          // same name, or a sequel, can come back with it.
          const kept = localized ? filterByYear(results, meta) : results;
          logger.info(`[${label}] ${kept.length} results in ${Date.now() - start}ms`);
          collected.push(...kept);
          matchedCount += filterByContent(kept, meta).length;
        } catch (err) {
          logger.warn(`[${label}] ${err.message} (${Date.now() - start}ms)`);
        } finally {
          completedCount++;
          if (localized) pendingLocalized--;
          // If all providers finished, return immediately
          if (completedCount >= jobs.length) finalize();
          // Past the early-return window: return as soon as enough results land
          else if (!pendingLocalized && Date.now() - startedAt >= EARLY_RETURN_MS && matchedCount >= MIN_EARLY_RESULTS) {
            logger.info(`Early return: ${matchedCount} matching results from ${completedCount}/${jobs.length} searches after ${Date.now() - startedAt}ms`);
            finalize();
          }
        }
      })
    );

    // Safety: if Promise.all somehow resolves before timers
    Promise.allSettled(tasks).then(finalize);
  });
}

/**
 * Names to search each provider for: the catalogue name first, then any
 * localized title the content is released under, then the catalogue name with
 * the scene tag for the requested language ("The Godfather ITA"), which surfaces
 * localized releases that rank far below the English ones for the bare title.
 *
 * The extra passes search without the year. Providers treat every word in a
 * query as required, and a localized release is routinely labelled with
 * another year than the catalogue's (the local release, a festival cut) or with
 * none at all: "It Follows ITA 2015" returns nothing from TorrentDownloads
 * while "It Follows ITA" returns the 2014 Italian BDRemux. `filterByYear`
 * puts the year back afterwards, where a mismatch costs a result rather than
 * the whole pass.
 *
 * Providers read the name off `meta.name`, so a variant is just a meta copy.
 * Results are still filtered against the original meta, aliases included.
 */
export function queryVariants(meta) {
  const variants = [{ meta, localized: false }];
  if (!meta?.name) return variants;

  for (const alias of (meta.aliases ?? []).slice(0, Math.max(0, MAX_ALIAS_QUERIES))) {
    variants.push({ meta: { ...meta, name: alias, year: null }, localized: true });
  }
  for (const tag of (meta.searchTags ?? []).slice(0, Math.max(0, MAX_TAG_QUERIES))) {
    variants.push({ meta: { ...meta, name: `${meta.name} ${tag}`, year: null }, localized: true });
  }
  return variants;
}

/**
 * Drop movie records whose name carries a year other than the requested one,
 * used on the passes that searched without it.
 *
 * A release name states the original release year, which can sit a year either
 * side of the catalogue's, so allow that much slack. A name with no year at all
 * is kept: localized releases frequently omit it ("Ralph Spaccatutto [XviD -
 * Ita Ac3 5.1]"), and the name match is the signal there.
 *
 * Series are left alone: their year is the first season's, while the release
 * names carry the episode's, and the season and episode check already covers
 * them.
 */
export function filterByYear(records, meta) {
  if (meta?.type !== 'movie' || !meta.year) return records;
  const year = Number(meta.year);
  if (!Number.isFinite(year)) return records;

  // A number that belongs to the title is not a release year: "Blade Runner
  // 2049" and "1917" would otherwise disagree with their own catalogue year
  // and drop every release that omits it.
  const inTitle = new Set(
    [meta.name, ...(meta.aliases ?? [])].flatMap(n => String(n ?? '').match(YEAR_IN_NAME) ?? [])
  );

  return records.filter(r => {
    const years = (String(r.title ?? '').match(YEAR_IN_NAME) ?? []).filter(y => !inTitle.has(y));
    if (!years.length) return true;
    return years.some(y => Math.abs(Number(y) - year) <= YEAR_SLACK);
  });
}

async function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Deduplicate by infoHash, keeping the entry with the highest seeder count.
 */
function deduplicate(records) {
  const map = new Map();
  for (const r of records) {
    if (!r.infoHash) continue;
    const existing = map.get(r.infoHash);
    if (!existing || (r.seeders ?? 0) > (existing.seeders ?? 0)) {
      map.set(r.infoHash, r);
    }
  }
  return Array.from(map.values());
}

/**
 * Filter out torrents whose title does not match the requested content.
 * For series: title must contain a season/episode marker matching the request.
 * For movies: title must contain at least part of the movie name.
 * Torznab records matched by IMDb ID skip the name check, and only fail the
 * series check on an explicit marker for another season or episode: the
 * indexer already got the ID (plus season and episode), and their titles are
 * often localized.
 */
export function filterByContent(records, meta) {
  if (!meta?.name) return records;

  // The original name plus any localized title the content is released under,
  // so an "Il Padrino" release passes the filter for "The Godfather".
  const matchers = [meta.name, ...(meta.aliases ?? [])]
    .map(name => buildNameMatcher(name, meta.year))
    .filter(Boolean);
  if (!matchers.length) return records;

  return records.filter(r => {
    if (!r.title) return false;
    const norm = normalizeTitle(r.title);

    // matchedById records are matched by ID upstream; skip the name check.
    if (!r.matchedById && !matchers.some(matches => matches(norm))) return false;

    if (meta.type === 'series' && meta.season != null) {
      const s = meta.season;
      const e = meta.episode;
      const hasSeasonEp = new RegExp(
        e != null
          ? `s0*${s}\\s*e0*${e}\\b`
          : `s0*${s}(e\\d|\\b)`,
        'i'
      ).test(r.title);
      const hasLooseEp = e != null && new RegExp(
        `\\b${s}x0*${e}\\b`, 'i'
      ).test(r.title);
      const hasSeasonPack = new RegExp(
        `\\bseason\\s*0*${s}\\b|\\bcomplete\\b.*\\bs0*${s}\\b`,
        'i'
      ).test(r.title);
      if (!hasSeasonEp && !hasLooseEp && !hasSeasonPack) {
        // ID matches only fail on a marker for another season or episode.
        if (!r.matchedById || hasAnySeasonMarker(r.title, e != null)) return false;
      }
    }

    return true;
  });
}

/**
 * Build a predicate that tests a normalized torrent title against one name.
 * Returns null for a name that normalizes to nothing to match against.
 *
 * Short names are matched as a whole phrase, and the word after it must look
 * like release metadata, or the name must be followed by the year, so
 * "Brother" does not match "Brother Bear" but still matches the Italian habit
 * of joining both titles: "Obsession-Complesso di colpa (1976) ITA". Longer
 * names only need half their words, which absorbs punctuation and subtitle
 * differences between a release name and the catalogue one.
 */
function buildNameMatcher(name, year = null) {
  const words = normalizeTitle(String(name ?? '')).split(/\s+/).filter(w => w.length > 1);
  if (!words.length) return null;

  if (words.length <= 2) {
    // Built from a number, never from the string, so a stray value from a
    // caller cannot reach the pattern.
    const yearRegex = Number.isInteger(Number(year)) ? new RegExp(`\\b${Number(year)}\\b`) : null;
    const phraseRegex = new RegExp(`\\b${words.map(escapeRegex).join('\\s+')}\\b`);
    return norm => {
      const match = phraseRegex.exec(norm);
      if (!match) return false;
      const after = norm.slice(match.index + match[0].length).trim();
      const nextWord = after.match(/^([a-z0-9]+)/);
      if (!nextWord || isTorrentMetadata(nextWord[1])) return true;
      return yearRegex != null && yearRegex.test(norm);
    };
  }

  const wordRegexes = words.map(w => new RegExp(`\\b${escapeRegex(w)}\\b`));
  const needed = Math.max(1, Math.ceil(words.length * 0.5));
  return norm => wordRegexes.filter(re => re.test(norm)).length >= needed;
}

/**
 * Same markers as the series check above, for any season or episode number.
 */
function hasAnySeasonMarker(title, withEpisode) {
  return new RegExp(
    withEpisode
      ? `s\\d+\\s*e\\d+\\b|\\b\\d{1,2}x\\d{1,3}\\b|\\bseason\\s*\\d+\\b|\\bcomplete\\b.*\\bs\\d+\\b`
      : `s\\d+(e\\d|\\b)|\\bseason\\s*\\d+\\b|\\bcomplete\\b.*\\bs\\d+\\b`,
    'i'
  ).test(title);
}

function isTorrentMetadata(word) {
  return /^(s\d|season|episode|ep\d|web|hdtv|bluray|bdrip|dvd|hdrip|cam|x26|h26|hevc|avc|xvid|aac|ac3|dts|multi|dual|repack|proper|internal|extended|unrated|complete|full|part|the)/.test(word)
    || /^\d/.test(word);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Decompose accents before dropping non-ASCII, so an accented localized title
 * ("Nuovo Cinema Paradiso", "Amelie") still matches its unaccented form.
 * Titles in a non-Latin script normalize to nothing and are matched by ID.
 */
function normalizeTitle(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * List all available provider IDs.
 */
export function listProviders() {
  return ACTIVE_PROVIDERS.map(p => ({ id: p.id, name: p.name, types: [...p.types] }));
}

/**
 * The provider module registered under an id, or undefined.
 *
 * Callers must never map an id back to a filename: the two are allowed to
 * differ (leetx.js registers as `1337x`), so guessing breaks on exactly the
 * provider that is hardest to guess.
 *
 * @param {string} id
 * @returns {object|undefined}
 */
export function getProvider(id) {
  return ACTIVE_PROVIDERS.find(p => p.id === id);
}

/**
 * Sort requested provider ids into the three cases a caller can hit.
 *
 * `active` is what will actually be scraped. `disabled` is registered here but
 * switched off by SCRAPER_DISABLED_PROVIDERS, so the caller's config is right
 * and the host operator made that choice. `unknown` is the only one that means
 * a typo, and keeping it apart from `disabled` is the whole point: the provider
 * id is not always the site's name (providers/leetx.js registers as `1337x`),
 * so a wrong id and a provider this host turned off need different answers.
 *
 * @param {string[]} requestedIds
 * @returns {{ active: string[], disabled: string[], unknown: string[] }}
 */
export function classifyProviderIds(requestedIds) {
  const registered = new Set(ALL_PROVIDERS.map(p => p.id));
  const active     = new Set(ACTIVE_PROVIDERS.map(p => p.id));

  return {
    active:   requestedIds.filter(id => active.has(id)),
    disabled: requestedIds.filter(id => registered.has(id) && !active.has(id)),
    unknown:  requestedIds.filter(id => !registered.has(id)),
  };
}
