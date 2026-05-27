import { getLanguageFlag, toSubtitleLanguageCode } from './languages.js';
import { getBestTrackers } from './magnetHelper.js';
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
  const sourceStr  = [record.source, record.codec, record.hdr ? 'HDR' : null].filter(Boolean).join(' · ');
  const filename   = record.fileName || record.title || record.name;

  const name  = `${ADDON_PREFIX}\n${quality.toUpperCase()} ${langs}`.trim();
  const description = [
    record.title || record.name,
    sourceStr,
    [seedersStr, sizeStr, provStr].filter(Boolean).join(' '),
  ].filter(Boolean).join('\n');

  const stream = {
    name,
    title: description,
    description,
    infoHash:  record.infoHash,
    fileIdx:   record.fileIdx ?? 0,
    sources:   buildSources(record),
    behaviorHints: {
      bingeGroup:      getBingeGroup(record, quality),
      filename:        filename || undefined,
      videoSize:       record.size || undefined,
    },
  };

  if (record.subtitles?.length) {
    stream.subtitles = enrichSubtitles(record.subtitles);
  }

  return cleanObject(stream);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSources(record) {
  const trackers = [...new Set([...(record.trackers ?? []), ...getBestTrackers()])]
    .filter(Boolean)
    .filter(tracker => tracker.startsWith('udp://') || tracker.startsWith('http://') || tracker.startsWith('https://'))
    .slice(0, 20)
    .map(tracker => `tracker:${tracker}`);

  return trackers.length ? trackers : undefined;
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

function enrichSubtitles(subs) {
  return subs.map(sub => {
    return {
      lang: toSubtitleLanguageCode(sub.lang),
      url: sub.url,
    };
  }).filter(sub => sub.url);
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
