import { resolveSubtitleLanguages } from './subtitles.js';
import { toSubtitleLanguageCode } from './languages.js';

// Order subtitles the way a viewer would pick them by hand: their preferred
// languages first, and within a language the file most likely to line up
// with the release they are playing.

const SOURCE_PRIORITY = {
  opensubtitles: 4,
  community: 3,
  yify: 2,
  tvsubs: 1,
};

const RELEASE_TOKEN = /\b(2160p|1080p|720p|480p|web[- ]?dl|webrip|web|bluray|blu-ray|bdrip|brrip|hdtv|hdrip|dvdrip|remux|amzn|nf|dsnp|hmax|atvp|pmtp|x264|x265|h264|h265|hevc|10bit|hdr|dv|atmos|ddp?5?\.?1|aac|proper|repack|extended|unrated|imax)\b/gi;

export function rankSubtitles(subtitles, { config = {}, filename = null } = {}) {
  const languageOrder = resolveSubtitleLanguages(config).map(toSubtitleLanguageCode);
  const wanted = tokenizeRelease(filename);
  const wantedGroup = releaseGroup(filename);

  const scored = subtitles.map((subtitle, index) => ({
    subtitle,
    index,
    langRank: languageRank(subtitle?.lang, languageOrder),
    score: scoreSubtitle(subtitle, wanted, wantedGroup),
  }));

  scored.sort((a, b) =>
    a.langRank - b.langRank
    || b.score - a.score
    || a.index - b.index);

  return scored.map(entry => entry.subtitle);
}

export function stripSubtitleMeta(subtitles) {
  return subtitles.map(subtitle => {
    if (!subtitle || typeof subtitle !== 'object') return subtitle;
    const { _meta, ...rest } = subtitle;
    return rest;
  });
}

export function scoreSubtitle(subtitle, wantedTokens = new Set(), wantedGroup = null) {
  const meta = subtitle?._meta || {};
  let score = SOURCE_PRIORITY[meta.source] || 0;

  if (meta.hashMatch) score += 100;
  if (meta.machineTranslated) score -= 50;
  if (meta.hearingImpaired) score -= 1;

  if (meta.release && wantedTokens.size) {
    const have = tokenizeRelease(meta.release);
    for (const token of have) {
      if (wantedTokens.has(token)) score += 6;
    }
    const group = releaseGroup(meta.release);
    if (group && wantedGroup && group === wantedGroup) score += 12;
  }

  if (Number.isFinite(meta.rating) && meta.rating > 0) score += Math.min(meta.rating, 10) / 10;
  if (Number.isFinite(meta.downloads) && meta.downloads > 0) score += Math.min(Math.log10(meta.downloads), 6) / 10;

  return score;
}

export function tokenizeRelease(value) {
  const tokens = new Set();
  const text = String(value || '').toLowerCase();
  if (!text) return tokens;
  for (const match of text.matchAll(RELEASE_TOKEN)) {
    tokens.add(normalizeToken(match[1]));
  }
  return tokens;
}

export function releaseGroup(value) {
  const text = String(value || '').replace(/\.(mkv|mp4|avi|srt|zip)$/i, '');
  const match = text.match(/-([a-z0-9]{2,20})(?:\[[^\]]*\])?$/i);
  return match ? match[1].toLowerCase() : null;
}

function normalizeToken(token) {
  const lower = token.toLowerCase().replace(/[\s-]/g, '');
  if (lower === 'blu-ray' || lower === 'bluray' || lower === 'bdrip' || lower === 'brrip') return 'bluray';
  if (lower === 'webdl' || lower === 'webrip' || lower === 'web') return 'web';
  if (lower === 'h264' || lower === 'x264') return 'x264';
  if (lower === 'h265' || lower === 'x265' || lower === 'hevc') return 'x265';
  return lower;
}

function languageRank(lang, order) {
  const code = String(lang || '').toLowerCase();
  const index = order.indexOf(code);
  return index === -1 ? order.length : index;
}
