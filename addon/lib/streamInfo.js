import { getLanguageFlag, getLanguageName } from './languages.js';
import { extractQuality } from './sort.js';

const ADDON_PREFIX = '⚡ Magnetio';

/**
 * Convert a raw torrent record into a Stremio stream object.
 */
export function toStreamInfo(record, config) {
  const quality    = extractQuality(record);
  const langs      = (record.languages ?? []).map(getLanguageFlag).join('');
  const sizeStr    = record.size ? formatSize(record.size) : '';
  const seedersStr = record.seeders != null ? `👥 ${record.seeders}` : '';
  const provStr    = record.provider ? `[${record.provider}]` : '';

  const name  = `${ADDON_PREFIX}\n${quality.toUpperCase()} ${langs}`.trim();
  const title = [
    record.title || record.name,
    [seedersStr, sizeStr, provStr].filter(Boolean).join(' '),
  ].filter(Boolean).join('\n');

  const stream = {
    name,
    title,
    infoHash:  record.infoHash,
    fileIdx:   record.fileIdx ?? undefined,
    sources:   buildSources(record),
    behaviorHints: {
      bingeGroup:      getBingeGroup(record, quality),
      notWebReady:     false,
    },
  };

  if (record.subtitles?.length) {
    stream.subtitles = enrichSubtitles(record.subtitles, record.infoHash, record.fileIdx);
  }

  return cleanObject(stream);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSources(record) {
  const sources = [`magnet:?xt=urn:btih:${record.infoHash}`];
  if (record.trackers?.length) {
    const trackers = record.trackers.map(t => `tr=${encodeURIComponent(t)}`).join('&');
    sources[0] += `&${trackers}`;
  }
  return sources;
}

function getBingeGroup(record, quality) {
  if (record.fileIdx != null) {
    // Series: group by infoHash so episodes are binged together
    return `magnetio|${record.infoHash}`;
  }
  // Movies: group by codec/bitdepth to separate HDR vs SDR versions
  const codec    = record.codec    ?? '';
  const bitdepth = record.bitdepth ?? '';
  return `magnetio|${quality}|${codec}|${bitdepth}`;
}

function enrichSubtitles(subs, infoHash, fileIdx) {
  return subs.map(sub => {
    if (sub.url) return sub;
    const idx = fileIdx != null ? fileIdx : sub.fileIdx;
    return {
      ...sub,
      url: `http://localhost:11470/${infoHash}/${idx}/subtitle.${sub.lang}`,
    };
  });
}

export function formatSize(bytes) {
  if (!bytes) return '';
  const units = ['B', 'kB', 'MB', 'GB', 'TB'];
  let val = bytes;
  let ui  = 0;
  while (val >= 1024 && ui < units.length - 1) { val /= 1024; ui++; }
  return `💾 ${val.toFixed(1)} ${units[ui]}`;
}

function cleanObject(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v != null && v !== '')
  );
}
