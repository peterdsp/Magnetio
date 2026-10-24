import { SortType, Quality } from './types.js';

// Audio tag meaning "several tracks bundled", which may include a wanted one.
export const MULTI_AUDIO = 'multi';

// Seeder thresholds
const HEALTHY_SEEDER_COUNT = 5;
const SEEDED_SEEDER_COUNT  = 1;

// Quality ordering (index 0 = best)
const QUALITY_ORDER = [
  Quality.UHD_8K,
  Quality.UHD_4K,
  Quality.FHD,
  Quality.HD,
  Quality.SD,
  Quality.CAM,
  Quality.UNKNOWN,
];

/**
 * Sort streams by language preference first, then by the configured sort strategy.
 *
 * Preference follows the order the languages were configured in, so
 * languages=it,en ranks Italian audio above English instead of lumping both
 * into one "preferred" bucket. That ordering is the whole point of listing a
 * second language: it is a fallback, not an equal.
 */
export function sortStreams(streams, config) {
  const preferredLangs = config?.languages ?? [];
  if (!preferredLangs.length) return _sortStreams(streams, config);

  const buckets = new Map();
  for (const stream of streams) {
    const rank = languageRank(stream, preferredLangs);
    if (!buckets.has(rank)) buckets.set(rank, []);
    buckets.get(rank).push(stream);
  }

  return [...buckets.keys()]
    .sort((a, b) => a - b)
    .flatMap(rank => _sortStreams(buckets.get(rank), config));
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function _sortStreams(streams, config) {
  const sort = config?.sort ?? SortType.QUALITY_THEN_SEEDERS;

  switch (sort) {
    case SortType.QUALITY_THEN_SIZE:
      return sortByQuality(streams, (a, b) => b.size - a.size);

    case SortType.SEEDERS:
      return sortBySeeders(streams);

    case SortType.SIZE:
      return [...streams].sort((a, b) => b.size - a.size);

    case SortType.QUALITY_THEN_SEEDERS:
    default:
      return sortByQuality(streams, (a, b) => b.seeders - a.seeders);
  }
}

/**
 * Group by quality tier and sort within each tier by the given comparator.
 * Prioritises "healthy" streams (≥5 seeders) over merely "seeded" (≥1).
 */
function sortByQuality(streams, tiebreak) {
  const groups = new Map();
  for (const q of QUALITY_ORDER) groups.set(q, { healthy: [], seeded: [], unhealthy: [] });

  for (const s of streams) {
    const q     = extractQuality(s);
    const group = groups.get(q) ?? groups.get(Quality.UNKNOWN);
    if      (s.seeders >= HEALTHY_SEEDER_COUNT) group.healthy.push(s);
    else if (s.seeders >= SEEDED_SEEDER_COUNT)  group.seeded.push(s);
    else                                         group.unhealthy.push(s);
  }

  const result = [];
  for (const { healthy, seeded, unhealthy } of groups.values()) {
    result.push(
      ...healthy.sort(tiebreak),
      ...seeded.sort(tiebreak),
      ...unhealthy.sort(tiebreak),
    );
  }
  return result;
}

function sortBySeeders(streams) {
  return [...streams].sort((a, b) => {
    const aHealthy = a.seeders >= HEALTHY_SEEDER_COUNT;
    const bHealthy = b.seeders >= HEALTHY_SEEDER_COUNT;
    if (aHealthy !== bHealthy) return bHealthy ? 1 : -1;
    return b.seeders - a.seeders;
  });
}

/**
 * Derive the Quality tier from stream metadata.
 */
export function extractQuality(stream) {
  const info = [stream.quality, stream.resolution, stream.title, stream.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/\b(cam|camrip|ts|telesync|telecine|hdcam)\b/.test(info)) return Quality.CAM;
  if (/\b(8k|7680)\b/.test(info))                                 return Quality.UHD_8K;
  if (/\b(4k|2160p|uhd)\b/.test(info))                            return Quality.UHD_4K;
  if (/\b(1080p|fhd|fullhd)\b/.test(info))                        return Quality.FHD;
  if (/\b(720p|hd)\b/.test(info))                                  return Quality.HD;
  if (/\b(480p|sd)\b/.test(info))                                  return Quality.SD;
  return Quality.UNKNOWN;
}

/**
 * Lower is better. An explicit match ranks at its position in the configured
 * list. A multi-audio release ranks after every explicit match but ahead of
 * unrelated audio, because it very likely carries the wanted track without
 * saying so. Anything else sorts last.
 */
function languageRank(stream, langs) {
  const streamLangs = stream.languages ?? [];

  let best = Infinity;
  for (const lang of streamLangs) {
    const index = langs.indexOf(lang);
    if (index !== -1 && index < best) best = index;
  }
  if (best !== Infinity) return best;

  if (streamLangs.includes(MULTI_AUDIO)) return langs.length;
  return langs.length + 1;
}
