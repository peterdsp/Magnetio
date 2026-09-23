import axios from 'axios';
import pLimit from 'p-limit';
import { cacheWrap } from './cache.js';
import { logger } from './logger.js';
import { toSubtitleLanguageCode } from './languages.js';
import { resolveSubtitleLanguages } from './subtitles.js';
import { translateText } from './translationProviders.js';
import { decodeSubtitleText } from './subtitleZip.js';
import { sendSubtitle, sendSubtitleError } from './subtitleResponse.js';
import { loadYifySubtitle } from './yifySubtitles.js';
import { loadTvSubtitle } from './tvSubtitles.js';
import { loadCommunitySubtitle } from './communitySubtitles.js';
import { loadSyncedSubtitle } from './subtitleProxy.js';

const REQUEST_TIMEOUT = 20_000;
const FILE_CACHE_TTL = 60 * 60 * 24 * 30;
const FILE_NEGATIVE_TTL = 60 * 5;
const MAX_INPUT_BYTES = 768 * 1024;
const MAX_BATCH_CHARS = 4000;
const TRANSLATION_CONCURRENCY = Math.max(1, parseInt(process.env.TRANSLATION_CONCURRENCY, 10) || 3);
const TRANSLATION_SEPARATOR = '\n\n@@~~@@\n\n';
const SOURCE_LANGUAGE = 'en';
const MAX_TRANSLATIONS = 2;

// Source subtitles that already live behind one of our own proxy routes are
// resolved in-process instead of fetching our public URL from ourselves.
// That skips a network round trip through the reverse proxy, keeps the
// request out of the subtitle rate limiter, and works even when the box
// cannot resolve its own public hostname.
const INTERNAL_PROXY_LOADERS = {
  yify: loadYifySubtitle,
  tvsubs: loadTvSubtitle,
  community: loadCommunitySubtitle,
  subtitle: loadSyncedSubtitle,
};
const INTERNAL_PROXY_PATH = /^\/proxy\/(yify|tvsubs|community|subtitle)\/([A-Za-z0-9_-]+)\.srt$/;

const BLOCKED_HOSTNAMES = new Set([
  'localhost', '127.0.0.1', '::1', '0.0.0.0',
  'metadata.google.internal', 'metadata.internal',
]);

const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
};

export function attachTranslatedSubtitles(subtitles, config) {
  const languages = resolveSubtitleLanguages(config);
  const nonEnglish = languages.filter(code => code !== SOURCE_LANGUAGE);
  const target = nonEnglish[0];
  if (!target) return subtitles;

  const baseUrl = String(config?._publicBaseUrl || '').replace(/\/$/, '');
  if (!baseUrl) return subtitles;

  const englishSubs = subtitles.filter(sub => isEnglishCode(sub?.lang));
  if (!englishSubs.length) return subtitles;

  const targetSubtitleCode = toSubtitleLanguageCode(target);
  const alreadyTranslated = new Set(
    subtitles
      .filter(sub => sub?.lang === targetSubtitleCode)
      .map(sub => String(sub?.id || sub?.url || '')),
  );

  const additions = [];
  for (const source of englishSubs) {
    if (additions.length >= MAX_TRANSLATIONS) break;

    const sourceUrl = String(source?.url || '');
    if (!sourceUrl || !isHttpUrlSafe(sourceUrl)) continue;

    const payload = { url: sourceUrl, from: SOURCE_LANGUAGE, to: target };
    const proxyId = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const id = `translated-${target}-${source.id || hashString(sourceUrl)}`;
    if (alreadyTranslated.has(id)) continue;

    additions.push({
      id,
      lang: targetSubtitleCode,
      url: `${baseUrl}/proxy/translated/${proxyId}.srt`,
    });
  }

  return [...subtitles, ...additions];
}

export async function handleTranslatedSubtitleProxy(req, res) {
  const result = await loadTranslatedSubtitle(req.params.id, {
    requestHost: req.get('host'),
  });
  if (result.content) {
    sendSubtitle(res, result.content, { maxAge: 2592000, staleSeconds: 604800 });
    return;
  }
  sendSubtitleError(res, result.status, result.error);
}

export async function loadTranslatedSubtitle(rawId, { requestHost = null } = {}) {
  const proxyId = String(rawId || '').trim();
  if (!proxyId) return { status: 400, error: 'Missing subtitle id' };

  let payload;
  try {
    payload = JSON.parse(Buffer.from(proxyId, 'base64url').toString('utf8'));
  } catch {
    return { status: 400, error: 'Invalid subtitle id' };
  }

  if (!payload?.url || !payload?.from || !payload?.to) {
    return { status: 400, error: 'Invalid subtitle payload' };
  }

  // Our own proxy URLs are resolved in-process (no outbound request), so the
  // SSRF host check only applies to genuinely external sources.
  if (!resolveInternalProxy(payload.url, requestHost) && !isHttpUrlSafe(payload.url)) {
    return { status: 400, error: 'Invalid subtitle host' };
  }

  try {
    const cacheKey = `translated-subs:${proxyId}`;
    const content = await cacheWrap(
      cacheKey,
      () => downloadAndTranslate(payload, requestHost),
      FILE_CACHE_TTL,
      { nullTtl: FILE_NEGATIVE_TTL },
    );
    if (!content) return { status: 404, error: 'Subtitle translation not available' };
    return { status: 200, content };
  } catch (err) {
    logger.warn(`Translated subtitle proxy error: ${err.message}`);
    return { status: 502, error: 'Subtitle translation failed' };
  }
}

async function downloadAndTranslate(payload, requestHost) {
  const srt = await fetchSourceSubtitle(payload.url, requestHost);
  if (!srt) return null;
  return translateSrt(srt, payload.from, payload.to);
}

/**
 * Identify a source URL that points at one of our own subtitle proxies.
 * Returns { kind, id } when the path matches and the host is ours, else null.
 */
export function resolveInternalProxy(url, requestHost = null) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const match = parsed.pathname.match(INTERNAL_PROXY_PATH);
  if (!match) return null;

  const ownHosts = new Set();
  for (const candidate of [process.env.ADDON_PUBLIC_URL, process.env.PUBLIC_URL]) {
    if (!candidate) continue;
    try {
      ownHosts.add(new URL(candidate).host.toLowerCase());
    } catch {
      // ignore malformed env values
    }
  }
  if (requestHost) ownHosts.add(String(requestHost).toLowerCase());

  if (!ownHosts.has(parsed.host.toLowerCase())) return null;
  return { kind: match[1], id: match[2] };
}

async function fetchSourceSubtitle(url, requestHost) {
  const internal = resolveInternalProxy(url, requestHost);
  if (internal) {
    const result = await INTERNAL_PROXY_LOADERS[internal.kind](internal.id);
    if (!result?.content) {
      logger.warn(`Translated subtitle source unavailable [${internal.kind}]: ${result?.error || 'empty'}`);
      return null;
    }
    return normalizeSourceText(result.content);
  }

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: REQUEST_TIMEOUT,
      maxContentLength: MAX_INPUT_BYTES,
      maxBodyLength: MAX_INPUT_BYTES,
      headers: HTTP_HEADERS,
      validateStatus: status => status >= 200 && status < 400,
    });

    const buffer = Buffer.from(response.data ?? []);
    if (buffer.length > MAX_INPUT_BYTES) return null;
    return normalizeSourceText(decodeSubtitleText(buffer, SOURCE_LANGUAGE));
  } catch (err) {
    logger.warn(`Translated subtitle source fetch failed: ${err.message}`);
    return null;
  }
}

function normalizeSourceText(text) {
  const value = typeof text === 'string' ? text : String(text ?? '');
  if (!value.trim()) return null;
  if (Buffer.byteLength(value, 'utf8') > MAX_INPUT_BYTES) return null;
  return value.replace(/\r\n/g, '\n');
}

export async function translateSrt(srtText, from, to) {
  const blocks = parseSrt(srtText);
  if (!blocks.length) return null;

  const texts = blocks.map(block => block.text);
  const batches = batchTexts(texts, MAX_BATCH_CHARS);
  const limit = pLimit(TRANSLATION_CONCURRENCY);

  // Batches are independent, so run a few at once. A full-length film is
  // 15 to 30 batches; sequential calls made the first request take minutes.
  const results = await Promise.all(
    batches.map(batch => limit(() => translateBatch(batch, from, to))),
  );

  const translations = [];
  let translatedBatches = 0;
  batches.forEach((batch, index) => {
    const translated = results[index];
    if (!translated || translated.length !== batch.length) {
      translations.push(...batch);
      return;
    }
    translatedBatches++;
    translations.push(...translated);
  });

  // If nothing at all could be translated, do not serve (and cache) the
  // English text under a Greek/other label. Let the caller report failure.
  if (!translatedBatches) return null;

  for (let i = 0; i < blocks.length; i++) {
    blocks[i].text = translations[i] ?? blocks[i].text;
  }

  return serializeSrt(blocks);
}

async function translateBatch(texts, from, to) {
  if (!texts.length) return [];

  if (texts.length === 1) {
    const single = await callTranslateApi(texts[0], from, to);
    return single == null ? null : [single];
  }

  const joined = texts.join(TRANSLATION_SEPARATOR);
  const result = await callTranslateApi(joined, from, to);
  if (result == null) return null;

  const parts = result.split(TRANSLATION_SEPARATOR);
  if (parts.length === texts.length) return parts.map(part => part.trim());

  const fallback = [];
  for (const text of texts) {
    const translated = await callTranslateApi(text, from, to);
    fallback.push(translated ?? text);
  }
  return fallback;
}

async function callTranslateApi(text, from, to) {
  if (!text.trim()) return text;
  try {
    return await translateText(text, from, to);
  } catch (err) {
    logger.debug(`Translation call failed: ${err.message}`);
    return null;
  }
}

export function batchTexts(texts, maxChars) {
  const batches = [];
  let current = [];
  let currentSize = 0;
  const separatorSize = TRANSLATION_SEPARATOR.length;

  for (const text of texts) {
    const size = text.length;
    if (current.length && currentSize + separatorSize + size > maxChars) {
      batches.push(current);
      current = [];
      currentSize = 0;
    }
    current.push(text);
    currentSize += size + (current.length > 1 ? separatorSize : 0);
  }

  if (current.length) batches.push(current);
  return batches;
}

export function parseSrt(text) {
  const blocks = [];
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  let i = 0;

  while (i < lines.length) {
    while (i < lines.length && !lines[i].trim()) i++;
    if (i >= lines.length) break;

    let indexValue = null;
    const indexCandidate = lines[i].trim();
    if (/^\d+$/.test(indexCandidate)) {
      indexValue = Number(indexCandidate);
      i++;
    }

    if (i >= lines.length) break;
    const timestamp = lines[i];
    if (!timestamp.includes('-->')) {
      i++;
      continue;
    }
    i++;

    const textLines = [];
    while (i < lines.length && lines[i].trim()) {
      textLines.push(lines[i]);
      i++;
    }

    blocks.push({
      index: indexValue ?? blocks.length + 1,
      timestamp: timestamp.trim(),
      text: textLines.join('\n'),
    });
  }

  return blocks;
}

export function serializeSrt(blocks) {
  return blocks
    .map((block, idx) => `${idx + 1}\n${block.timestamp}\n${block.text}\n`)
    .join('\n');
}

function isEnglishCode(value) {
  const code = String(value || '').toLowerCase();
  return code === 'eng' || code === 'en' || code === 'english';
}

function isHttpUrlSafe(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const host = parsed.hostname;
    if (BLOCKED_HOSTNAMES.has(host)) return false;
    if (host.startsWith('10.')) return false;
    if (host.startsWith('192.168.')) return false;
    if (host.startsWith('169.254.')) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    if (host.endsWith('.local') || host.endsWith('.internal')) return false;
    return true;
  } catch {
    return false;
  }
}

function hashString(value) {
  let hash = 0;
  const str = String(value || '');
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
