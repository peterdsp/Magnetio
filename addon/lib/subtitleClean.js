import { parseSrt, serializeSrt, parseTimestampRange, formatTimestampRange } from './srt.js';

// Cues matching these are advertising or uploader credits wherever they
// appear in the file. Kept deliberately specific so dialogue never matches.
const STRONG_JUNK_PATTERNS = [
  /https?:\/\//i,
  /\bwww\./i,
  /\b[a-z0-9-]+\.(?:com|net|org|io|tv|me|info)\b(?!\S)/i,
  /opensubtitles/i,
  /subscene|addic7ed|podnapisi|tvsubtitles|subsource|yifysubtitles|osdb\b/i,
  /advertise your product/i,
  /become (?:a )?vip member/i,
  /support us and become/i,
  /remove all ads/i,
  /rate this subtitle/i,
  /watch (?:all )?(?:movies|series|episodes).*(?:free|online)/i,
  /bet(?:ting)? (?:site|bonus|casino)/i,
  /\bcasino\b.*\bbonus\b/i,
];

// Cues matching these are junk only when they sit at the very start or end
// of the file, where uploader credits live. In the middle they may be dialogue.
const EDGE_JUNK_PATTERNS = [
  /\b(?:subtitles?|subs|sub)\s*(?:by|from|:)\b/i,
  /\b(?:sync(?:ed|hronized)?|corrected|translated|transcribed|encoded|ripped|edited|resync(?:ed)?)\s*(?:and|&|,)?\s*(?:corrected\s*)?by\b/i,
  /\b(?:translation|sync|correction)\s*:\s*\S/i,
  /\bdownload(?:ed)? from\b/i,
  /\buploaded by\b/i,
  /\b(?:yify|yts|rarbg|ettv|eztv|torrent)\b/i,
  /\benjoy the (?:movie|film|show|episode)\b/i,
  /\bprovided by\b/i,
  /^\s*-?\s*(?:μετάφραση|υπότιτλοι|απόδοση|συγχρονισμός)\b/i,
  /\b(?:μετάφραση|υπότιτλοι|απόδοση|συγχρονισμός|επιμέλεια)\s*(?:διαλόγων)?\s*[:\-]/i,
];

const EDGE_CUE_COUNT = 5;
const MAX_CUE_DURATION_MS = 20_000;
const MIN_CUE_DURATION_MS = 200;

const HTML_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '\u2026',
  ndash: '\u2013', mdash: '\u2014', lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201c', rdquo: '\u201d',
};

/**
 * Normalize an SRT file before serving it to a player:
 * - decode HTML entities and drop ASS/SSA override tags such as {\an8}
 * - remove advertising and uploader credit cues
 * - drop cues with unusable timing, clamp absurd durations, sort and renumber
 * Returns the original text when the input cannot be parsed as SRT at all.
 */
export function cleanSrt(text) {
  const blocks = parseSrt(text);
  if (!blocks.length) return typeof text === 'string' ? text : '';

  const cues = [];
  for (const block of blocks) {
    const range = parseTimestampRange(block.timestamp);
    if (!range) continue;

    const cleaned = cleanCueText(block.text);
    if (!cleaned) continue;

    let { start, end } = range;
    if (end < start) continue;
    if (end - start < MIN_CUE_DURATION_MS) end = start + MIN_CUE_DURATION_MS;
    if (end - start > MAX_CUE_DURATION_MS) end = start + MAX_CUE_DURATION_MS;

    cues.push({ start, end, text: cleaned });
  }

  if (!cues.length) return serializeSrt(blocks);

  const kept = cues.filter((cue, index) => !isJunkCue(cue.text, index, cues.length));
  const survivors = kept.length ? kept : cues;

  survivors.sort((a, b) => a.start - b.start || a.end - b.end);

  return serializeSrt(
    survivors.map(cue => ({
      timestamp: formatTimestampRange(cue.start, cue.end),
      text: cue.text,
    })),
  );
}

export function cleanCueText(text) {
  return String(text || '')
    .replace(/\{\\[^}]*\}/g, '')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, decodeEntity)
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

export function isJunkCue(text, index, total) {
  const flat = String(text || '').replace(/<[^>]+>/g, ' ');
  if (STRONG_JUNK_PATTERNS.some(pattern => pattern.test(flat))) return true;

  const atEdge = index < EDGE_CUE_COUNT || index >= total - EDGE_CUE_COUNT;
  if (!atEdge) return false;
  return EDGE_JUNK_PATTERNS.some(pattern => pattern.test(flat));
}

function decodeEntity(match, entity) {
  const lower = entity.toLowerCase();
  if (lower.startsWith('#x')) {
    const code = parseInt(lower.slice(2), 16);
    return Number.isFinite(code) ? String.fromCodePoint(code) : match;
  }
  if (lower.startsWith('#')) {
    const code = parseInt(lower.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : match;
  }
  return HTML_ENTITIES[lower] ?? match;
}
