import { getLanguageFlag, toSubtitleLanguageCode } from './languages.js';
import { extractQuality } from './sort.js';
import { getBestTrackers } from './magnetHelper.js';

const ADDON_PREFIX = '⚡ Magnetio';

function getPublicBaseUrl(config) {
  return (config?._publicBaseUrl || process.env.ADDON_PUBLIC_URL || '').replace(/\/$/, '');
}

/**
 * Convert a raw torrent record into a Stremio stream object.
 */
export function toStreamInfo(record, config) {
  const quality    = extractQuality(record);
  const langs      = (record.languages ?? []).map(getLanguageFlag).join('');
  const sizeStr    = record.size ? formatSize(record.size) : '';
  const seedersStr = record.seeders != null ? `👥 ${record.seeders}` : '';
  const sourceStr  = [record.source, record.codec, record.hdr ? 'HDR' : null].filter(Boolean).join(' · ');
  const filename   = record.fileName || record.title || record.name;

  const name  = `${ADDON_PREFIX}\n${quality.toUpperCase()} ${langs}`.trim();
  const description = [
    record.title || record.name,
    sourceStr,
    [seedersStr, sizeStr].filter(Boolean).join(' '),
  ].filter(Boolean).join('\n');

  const baseUrl = getPublicBaseUrl(config);
  const useProxy = config?.proxyStreams && baseUrl;
  const fileIdx = record.fileIdx ?? undefined;

  // NOTE: only `title` is emitted, never `description`. Several Stremio clients
  // (Windows 6.0.1-beta, Android/Google TV) silently drop stream objects that
  // carry a `description` field, so the whole list renders empty. Torrentio and
  // other working addons use `title` only. See issue #111 / PR #126.
  const stream = {
    name,
    title: description,
    behaviorHints: {
      bingeGroup:      getBingeGroup(record, quality),
      filename:        filename || undefined,
      videoSize:       record.size || undefined,
    },
  };

  if (useProxy) {
    const proxyParams = config.proxyUrl
      ? `?p=${encodeURIComponent(Buffer.from(config.proxyUrl).toString('base64url'))}`
      : '';
    stream.url = `${baseUrl}/proxy/stream/${record.infoHash}/${fileIdx ?? 0}${proxyParams}`;
    stream.behaviorHints.notWebReady = true;
    const proxyLabel = config.proxyUrl ? '🛡️ VPN Proxy' : '🛡️ Privacy Proxy';
    stream.title = description + '\n' + proxyLabel;
  } else {
    stream.infoHash = record.infoHash;
    stream.fileIdx = fileIdx;
    // Peer-discovery hints for the client's torrent engine. Restored after
    // PR #124 accidentally removed buildSources() (regression of PR #118):
    // without a `sources` array, P2P streams have no trackers/DHT to resolve.
    stream.sources = buildSources(record);
  }

  if (record.subtitles?.length) {
    stream.subtitles = enrichSubtitles(record.subtitles);
  }

  return cleanObject(stream);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build the `sources` array for a P2P (infoHash) stream: a `dht:<infoHash>`
 * entry followed by `tracker:<url>` entries. Matches the format Torrentio and
 * other working addons emit so clients can discover peers. Any per-record
 * trackers are merged with the shared best-tracker list and de-duplicated.
 */
function buildSources(record) {
  const trackers = [...new Set([...(record.trackers ?? []), ...getBestTrackers()])]
    .filter(tracker => tracker.startsWith('udp://') || tracker.startsWith('http://') || tracker.startsWith('https://'))
    .map(tracker => `tracker:${tracker}`);
  return [`dht:${record.infoHash}`, ...trackers];
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
