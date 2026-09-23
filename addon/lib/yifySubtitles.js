import axios from 'axios';
import { cacheWrap } from './cache.js';
import { logger } from './logger.js';
import { sendSubtitle, sendSubtitleError } from './subtitleResponse.js';
import { toSubtitleLanguageCode } from './languages.js';
import { parseStremioVideoId, resolveSubtitleLanguages } from './subtitles.js';
import { extractSrtFromZip } from './subtitleZip.js';
import { cleanSrt } from './subtitleClean.js';

const YIFY_BASE_URL = (process.env.YIFY_SUBTITLES_BASE_URL || 'https://yifysubtitles.ch').replace(/\/$/, '');
const YIFY_HOST_ALLOWLIST = /^https:\/\/yifysubtitles\.(ch|org|me)\//i;
const YIFY_TIMEOUT = 12_000;
const YIFY_LISTING_CACHE_TTL = 60 * 60 * 6;
const YIFY_FILE_CACHE_TTL = 60 * 60 * 24 * 7;
const YIFY_FILE_NEGATIVE_TTL = 60 * 5;
const MAX_PER_LANGUAGE = 2;
const MAX_TOTAL = 8;
const MAX_ZIP_BYTES = 4 * 1024 * 1024;

const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const LANGUAGE_NAME_TO_CODE = {
  'albanian': 'sq',
  'arabic': 'ar',
  'bengali': 'bn',
  'bosnian': 'bs',
  'brazilian portuguese': 'pt',
  'bulgarian': 'bg',
  'burmese': 'my',
  'cambodian/khmer': 'km',
  'chinese': 'zh',
  'chinese bg code': 'zh',
  'big 5 code': 'zh',
  'croatian': 'hr',
  'czech': 'cs',
  'danish': 'da',
  'dutch': 'nl',
  'english': 'en',
  'estonian': 'et',
  'farsi/persian': 'fa',
  'finnish': 'fi',
  'french': 'fr',
  'french (canadian)': 'fr',
  'german': 'de',
  'greek': 'el',
  'hebrew': 'he',
  'hindi': 'hi',
  'hungarian': 'hu',
  'icelandic': 'is',
  'indonesian': 'id',
  'italian': 'it',
  'japanese': 'ja',
  'korean': 'ko',
  'latvian': 'lv',
  'lithuanian': 'lt',
  'macedonian': 'mk',
  'malay': 'ms',
  'malayalam': 'ml',
  'norwegian': 'no',
  'polish': 'pl',
  'portuguese': 'pt',
  'romanian': 'ro',
  'russian': 'ru',
  'serbian': 'sr',
  'sinhala': 'si',
  'slovak': 'sk',
  'slovenian': 'sl',
  'spanish': 'es',
  'swedish': 'sv',
  'tagalog': 'tl',
  'tamil': 'ta',
  'telugu': 'te',
  'thai': 'th',
  'turkish': 'tr',
  'ukrainian': 'uk',
  'urdu': 'ur',
  'vietnamese': 'vi',
};

export async function getYifySubtitles(args, config) {
  const parsedId = parseStremioVideoId(args?.id);
  // Movies only — series are not available from this source.
  if (!parsedId.imdbId || parsedId.season != null) return [];

  const languages = resolveSubtitleLanguages(config);
  if (!languages.length) return [];

  const baseUrl = String(config?._publicBaseUrl || '').replace(/\/$/, '');
  if (!baseUrl) return [];

  const imdbId = `tt${parsedId.imdbId}`;
  const cacheKey = `yify-subs:listing:${imdbId}`;

  try {
    const candidates = await cacheWrap(
      cacheKey,
      () => fetchListing(imdbId),
      YIFY_LISTING_CACHE_TTL,
    );
    return pickCandidates(candidates, languages, baseUrl);
  } catch (err) {
    logger.warn(`YIFY subtitle lookup failed [${imdbId}]: ${err.message}`);
    return [];
  }
}

export async function handleYifySubtitleProxy(req, res) {
  const result = await loadYifySubtitle(req.params.id);
  if (result.content) {
    sendSubtitle(res, result.content, { maxAge: 604800 });
    return;
  }
  sendSubtitleError(res, result.status, result.error);
}

/**
 * Resolve a /proxy/yify/:id.srt id to subtitle text without going through
 * HTTP. Returns { status, content } on success or { status, error } otherwise.
 */
export async function loadYifySubtitle(rawId) {
  const proxyId = String(rawId || '').trim();
  if (!proxyId) return { status: 400, error: 'Missing subtitle id' };

  let zipUrl;
  try {
    zipUrl = Buffer.from(proxyId, 'base64url').toString('utf8');
  } catch {
    return { status: 400, error: 'Invalid subtitle id' };
  }

  if (!YIFY_HOST_ALLOWLIST.test(zipUrl)) {
    return { status: 400, error: 'Invalid subtitle host' };
  }

  try {
    const cacheKey = `yify-subs:srt:${proxyId}`;
    const content = await cacheWrap(
      cacheKey,
      () => downloadAndExtract(zipUrl),
      YIFY_FILE_CACHE_TTL,
      { nullTtl: YIFY_FILE_NEGATIVE_TTL },
    );
    if (!content) return { status: 404, error: 'Subtitle not available' };
    return { status: 200, content };
  } catch (err) {
    logger.warn(`YIFY subtitle proxy error: ${err.message}`);
    return { status: 502, error: 'Subtitle proxy failed' };
  }
}

async function fetchListing(imdbId) {
  const url = `${YIFY_BASE_URL}/movie-imdb/${imdbId}`;
  const response = await axios.get(url, {
    timeout: YIFY_TIMEOUT,
    headers: HTTP_HEADERS,
    validateStatus: status => status >= 200 && status < 500,
  });

  if (response.status !== 200 || typeof response.data !== 'string') return [];
  return parseListing(response.data);
}

export function parseListing(html) {
  const rows = [];
  const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;

  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    const row = match[1];
    const langMatch = row.match(/<span[^>]*class="[^"]*sub-lang[^"]*"[^>]*>\s*([^<]+?)\s*<\/span>/i);
    const linkMatch = row.match(/<a[^>]+href="(\/subtitles\/[^"#?]+)"/i);
    if (!langMatch || !linkMatch) continue;

    const languageName = langMatch[1].toLowerCase().replace(/\s+/g, ' ').trim();
    const code = LANGUAGE_NAME_TO_CODE[languageName];
    if (!code) continue;

    const slug = linkMatch[1].replace(/^\/subtitles\//, '');
    if (!slug) continue;

    const ratingMatch = row.match(/<span[^>]*class="[^"]*label[^"]*"[^>]*>\s*(-?\d+)\s*<\/span>/i);
    const rating = ratingMatch ? parseInt(ratingMatch[1], 10) : 0;

    rows.push({
      language: code,
      slug,
      zipUrl: `${YIFY_BASE_URL}/subtitle/${slug}.zip`,
      rating: Number.isFinite(rating) ? rating : 0,
    });
  }

  rows.sort((a, b) => b.rating - a.rating);
  return rows;
}

function pickCandidates(candidates, languages, baseUrl) {
  const langSet = new Set(languages);
  const perLanguage = new Map();
  const picked = [];

  for (const candidate of candidates) {
    if (!langSet.has(candidate.language)) continue;
    const count = perLanguage.get(candidate.language) || 0;
    if (count >= MAX_PER_LANGUAGE) continue;

    const proxyId = Buffer.from(candidate.zipUrl).toString('base64url');
    picked.push({
      id: `yify-${candidate.slug}`,
      lang: toSubtitleLanguageCode(candidate.language),
      url: `${baseUrl}/proxy/yify/${proxyId}.srt`,
      _meta: { source: 'yify', rating: candidate.rating, release: candidate.slug },
    });
    perLanguage.set(candidate.language, count + 1);
    if (picked.length >= MAX_TOTAL) break;
  }

  return picked;
}

async function downloadAndExtract(zipUrl) {
  // The zip endpoint answers 403 unless the request carries a same-site
  // Referer, as if the user clicked the download button on the subtitle page.
  const response = await axios.get(zipUrl, {
    responseType: 'arraybuffer',
    timeout: YIFY_TIMEOUT,
    maxContentLength: MAX_ZIP_BYTES,
    maxBodyLength: MAX_ZIP_BYTES,
    headers: {
      ...HTTP_HEADERS,
      Accept: 'application/zip,application/octet-stream,*/*;q=0.8',
      Referer: subtitlePageUrl(zipUrl),
    },
    // 4xx means the file is gone or refused: treat as "not available" so it
    // is negatively cached instead of retried on every player request.
    validateStatus: status => status >= 200 && status < 500,
  });

  if (response.status >= 400) {
    logger.debug(`Subtitle download refused [${response.status}] ${zipUrl}`);
    return null;
  }

  const buffer = Buffer.from(response.data);
  if (!buffer.length || buffer.length > MAX_ZIP_BYTES) return null;
  const srt = extractSrtFromZip(buffer, languageFromZipUrl(zipUrl));
  return srt ? cleanSrt(srt) : null;
}

function subtitlePageUrl(zipUrl) {
  const slug = String(zipUrl || '').split('/').pop()?.replace(/\.zip$/i, '') || '';
  return slug ? `${YIFY_BASE_URL}/subtitles/${slug}` : `${YIFY_BASE_URL}/`;
}

// YIFY zip slugs embed the language name, e.g. ".../subtitle/movie-greek-yify-123.zip".
export function languageFromZipUrl(zipUrl) {
  const slug = String(zipUrl || '').split('/').pop()?.replace(/\.zip$/i, '') || '';
  const tokens = slug.toLowerCase().split('-');
  for (let i = tokens.length - 1; i >= 0; i--) {
    const code = LANGUAGE_NAME_TO_CODE[tokens[i]];
    if (code) return code;
  }
  return null;
}

export { extractSrtFromZip } from './subtitleZip.js';
