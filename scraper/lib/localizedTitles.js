/**
 * Localized title lookup.
 *
 * Non-English scene groups usually name a release after the local title rather
 * than the original one: "Il Padrino" instead of "The Godfather", "Le Parrain"
 * instead of either. Cinemeta only ever hands us the English name, so those
 * releases are both unsearchable and dropped by the content filter.
 *
 * This module resolves the title a piece of content is released under in the
 * audio languages a user asked for, so providers can be queried with it and the
 * content filter can accept it as an alias.
 *
 * Titles come from TMDB, which needs an API key: either the per-request key the
 * addon forwards from the user's configuration, or a server-wide TMDB_API_KEY.
 * Without a key this is a no-op and nothing else changes.
 */
import axios from 'axios';
import { cacheWrap } from './cache.js';
import { logger } from './logger.js';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TIMEOUT   = 6000;

// Localized titles are stable, so cache them for a week.
const TTL = 7 * 24 * 3600;

// Cap the languages we look up: each one is an extra request, and a user who
// selects eight audio languages does not want eight search passes per provider.
const MAX_LANGUAGES = parseInt(process.env.SCRAPER_MAX_ALIAS_LANGUAGES ?? '3', 10);

/**
 * Tag each language's releases are labelled with in scene names. Searching a
 * general provider for "The Godfather ITA" surfaces Italian releases that rank
 * far below the English ones for the bare title. Unlike localized titles these
 * need no API key, so they work on every deployment.
 */
const RELEASE_TAGS = {
  it: 'ITA',
  fr: 'FRENCH',
  es: 'SPANISH',
  pt: 'PORTUGUESE',
  de: 'GERMAN',
  ru: 'RUSSIAN',
  el: 'GREEK',
  tr: 'TURKISH',
  pl: 'POLISH',
  nl: 'DUTCH',
  cs: 'CZECH',
  hu: 'HUNGARIAN',
  ro: 'ROMANIAN',
  hi: 'HINDI',
  ta: 'TAMIL',
  te: 'TELUGU',
  ar: 'ARABIC',
  ko: 'KOREAN',
  ja: 'JAPANESE',
  zh: 'CHINESE',
  sq: 'ALBANIAN',
};

/**
 * Normalize the audio languages a request asked for into the ones worth a
 * localized lookup. English is the name Cinemeta already gave us, and "multi"
 * is not a language.
 */
function targetLanguages(languages) {
  return [...new Set(
    (languages ?? [])
      .map(l => String(l).trim().toLowerCase())
      .filter(l => l && l !== 'en' && l !== 'multi')
  )].slice(0, Math.max(0, MAX_LANGUAGES));
}

/**
 * Scene tags for the requested languages, e.g. ['it'] -> ['ITA'].
 *
 * @param {string[]} languages
 * @returns {string[]}
 */
export function releaseTagsFor(languages) {
  return targetLanguages(languages)
    .map(l => RELEASE_TAGS[l])
    .filter(Boolean);
}

/**
 * Resolve the TMDB id and media type behind an IMDb id.
 * Cached separately from the titles because it never depends on a language.
 */
async function resolveTmdb(imdbId, type, apiKey) {
  const { value } = await cacheWrap(`tmdb-find:${type}:${imdbId}`, async () => {
    const { data } = await axios.get(`${TMDB_BASE}/find/${imdbId}`, {
      params: { api_key: apiKey, external_source: 'imdb_id' },
      timeout: TIMEOUT,
    });
    // Prefer the requested type, but accept the other one: Cinemeta and TMDB
    // disagree on whether some titles are a movie or a one-season show.
    const movie = data?.movie_results?.[0];
    const tv    = data?.tv_results?.[0];
    const first = type === 'movie' ? (movie ?? tv) : (tv ?? movie);
    if (!first) return null;
    return { id: first.id, endpoint: first === tv ? 'tv' : 'movie' };
  }, TTL);

  return value;
}

/**
 * Fetch one localized title. Returns null when TMDB has no translation, in
 * which case it echoes the original title and there is nothing to add.
 */
async function fetchTitle({ id, endpoint }, language, apiKey) {
  const { value } = await cacheWrap(`tmdb-title:${endpoint}:${id}:${language}`, async () => {
    const { data } = await axios.get(`${TMDB_BASE}/${endpoint}/${id}`, {
      params: { api_key: apiKey, language },
      timeout: TIMEOUT,
    });
    return data?.title ?? data?.name ?? null;
  }, TTL);

  return value;
}

/**
 * Titles the content is released under in the requested audio languages,
 * excluding the name we already have.
 *
 * @param {object}   meta       From cinemeta: { name, imdbId, type }
 * @param {string[]} languages  Audio languages the user asked for
 * @param {string}   apiKey     TMDB key; falls back to TMDB_API_KEY
 * @returns {Promise<string[]>}
 */
export async function getLocalizedTitles(meta, languages, apiKey = null) {
  const key = apiKey || process.env.TMDB_API_KEY || null;
  const targets = targetLanguages(languages);
  if (!key || !targets.length || !meta?.imdbId || !meta?.name) return [];

  try {
    const tmdb = await resolveTmdb(meta.imdbId, meta.type, key);
    if (!tmdb) {
      logger.debug(`[Localized] no TMDB match for ${meta.imdbId}`);
      return [];
    }

    const titles = await Promise.all(
      targets.map(lang =>
        fetchTitle(tmdb, lang, key).catch(err => {
          logger.debug(`[Localized] ${meta.imdbId} ${lang}: ${err.message}`);
          return null;
        })
      )
    );

    const original = compare(meta.name);
    const aliases = [];
    for (const title of titles) {
      if (!title) continue;
      const normalized = compare(title);
      if (!normalized || normalized === original) continue;
      if (aliases.some(a => compare(a) === normalized)) continue;
      aliases.push(title);
    }

    if (aliases.length) {
      logger.info(`[Localized] "${meta.name}" also known as ${aliases.map(a => `"${a}"`).join(', ')}`);
    }
    return aliases;
  } catch (err) {
    logger.warn(`[Localized] ${meta.imdbId}: ${err.message}`);
    return [];
  }
}

/**
 * Loose form used only to tell two titles apart.
 */
function compare(title) {
  return String(title)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
