/**
 * Shared torrent title parsing utilities.
 * Extracts quality, codec, size, language hints from raw torrent names.
 */

const QUALITY_PATTERNS = [
  { re: /\b(8k|7680[xX]4320)\b/i,              quality: '8k'    },
  { re: /\b(2160p|4k|uhd)\b/i,                  quality: '4k'    },
  { re: /\b1080p\b/i,                            quality: '1080p' },
  { re: /\b720p\b/i,                             quality: '720p'  },
  { re: /\b480p\b/i,                             quality: '480p'  },
  // "ts" is a telesync tag, but it is also a common release group name, and a
  // group is suffixed after a dash: "DVDRip.XviD-TS" is a DVDRip by a group
  // called TS, not a cam. Without the lookbehind it scored as the worst tier
  // and was dropped by anyone excluding cams.
  { re: /\b(cam|camrip|telesync|telecine|hdcam)\b|(?<!-)\bts\b/i, quality: 'cam' },
];

const CODEC_PATTERNS = [
  { re: /\b(x265|hevc|h\.?265)\b/i, codec: 'HEVC' },
  { re: /\b(x264|avc|h\.?264)\b/i,  codec: 'AVC'  },
  { re: /\bav1\b/i,                  codec: 'AV1'  },
];

// First match wins, so the specific tags come first and the ambiguous one
// last. A bare "web" collides with titles that contain the word: before this
// order, "Spider.Web.2023.DVDRip.XviD" reported WEB-DL, because "Web" in the
// film's own name was tested before the real DVDRip tag.
const SOURCE_PATTERNS = [
  { re: /\b(bluray|blu-ray|bdrip|brrip)\b/i,  source: 'BluRay'   },
  { re: /\b(webrip|web-rip)\b/i,               source: 'WEBRip'   },
  { re: /\b(webdl|web-dl)\b/i,                 source: 'WEB-DL'   },
  { re: /\bhdrip\b/i,                           source: 'HDRip'    },
  { re: /\bdvdrip\b/i,                          source: 'DVDRip'   },
  { re: /\bhdtv\b/i,                            source: 'HDTV'     },
  // Only when nothing more specific said otherwise.
  { re: /\bweb\b/i,                             source: 'WEB-DL'   },
];

// Scene releases label the audio track with a short tag far more often than
// with the full language name: "iTA" is the norm and "italian" the exception.
// A tag only counts as an audio track when it is not prefixed with "sub", so
// "ENG.SUB-ITA" is reported as English audio with Italian subtitles rather
// than as an Italian track.
const notSubtitled = tag => new RegExp(`(?<!\\bsub[\\s._-]{0,2})\\b(?:${tag})\\b`, 'i');

const LANGUAGE_PATTERNS = [
  { re: /\bmulti\b/i,     lang: 'multi' },
  { re: notSubtitled('eng|english'),          lang: 'en' },
  { re: notSubtitled('ita|italian[oa]?'),     lang: 'it' },
  { re: /\bfrench\b/i,    lang: 'fr'    },
  { re: /\bspanish\b/i,   lang: 'es'    },
  { re: /\bportuguese\b/i,lang: 'pt'    },
  { re: /\bgerman\b/i,    lang: 'de'    },
  { re: /\brussian\b/i,   lang: 'ru'    },
  { re: /\bkorean\b/i,    lang: 'ko'    },
  { re: /\bjapanese\b/i,  lang: 'ja'    },
  { re: /\bchinese\b/i,   lang: 'zh'    },
  { re: /\barabic\b/i,    lang: 'ar'    },
  { re: /\bturkish\b/i,   lang: 'tr'    },
  { re: /\bhindi\b/i,     lang: 'hi'    },
  { re: /\b(tamil|tam)\b/i,       lang: 'ta' },
  { re: /\b(telugu|tel)\b/i,      lang: 'te' },
  { re: /\bmalayalam\b/i,         lang: 'ml' },
  { re: /\bkannada\b/i,           lang: 'kn' },
  { re: /\b(greek|ellinika|ελληνικά)\b/i, lang: 'el' },
  { re: /\b(albanian|shqip)\b/i, lang: 'sq' },
  { re: /\bdubbed\b/i,    lang: 'dubbed'},
];

export function parseTitle(title) {
  if (!title) return {};

  let quality = null;
  for (const { re, quality: q } of QUALITY_PATTERNS) {
    if (re.test(title)) { quality = q; break; }
  }

  let codec = null;
  for (const { re, codec: c } of CODEC_PATTERNS) {
    if (re.test(title)) { codec = c; break; }
  }

  let source = null;
  for (const { re, source: s } of SOURCE_PATTERNS) {
    if (re.test(title)) { source = s; break; }
  }

  const languages = [];
  for (const { re, lang } of LANGUAGE_PATTERNS) {
    if (re.test(title)) languages.push(lang);
  }
  // Default to English if no language detected
  if (!languages.length && !/\b(dubbed|multi)\b/i.test(title)) {
    languages.push('en');
  }

  const hdr = /\b(hdr|hdr10|dolby.?vision|dv)\b/i.test(title);
  const bitdepth = hdr ? '10bit' : (/\b10.?bit\b/i.test(title) ? '10bit' : null);

  return { quality, codec, source, languages, hdr, bitdepth };
}

/**
 * Build a search query string for a given piece of content.
 * For anime:  "Show Name 1095"     (absolute episode number)
 * For series: "Show Name S01E02"
 * For movies: "Movie Name 2024"
 *
 * Anime is indexed by absolute episode number rather than SxxEyy, and anime
 * releases are not labelled with the series year. Providers treat every word
 * in the query as required, so the scene shapes match nothing at all: against
 * Tokyo Toshokan, "One Piece S01E1095" returns a single batch pack and
 * "One Piece 1999" returns nothing, while "One Piece 1095" returns the
 * episode. Before this, every anime provider was effectively dead on any
 * request that named one.
 *
 * The number is used exactly as given. Zero-padding is deliberately not
 * applied: measured against Tokyo Toshokan, "Naruto 5" returns 85 results and
 * "Naruto 05" returns 49, while "Frieren 5" returns 27 and "Frieren 05"
 * returns 37, so neither form dominates and inventing one would trade one set
 * of misses for another.
 */
export function buildSearchQuery(meta) {
  if (meta.type === 'anime') {
    return meta.episode != null ? `${meta.name} ${meta.episode}` : meta.name;
  }
  if (meta.type === 'series' && meta.season != null && meta.episode != null) {
    const s = String(meta.season).padStart(2, '0');
    const e = String(meta.episode).padStart(2, '0');
    return `${meta.name} S${s}E${e}`;
  }
  if (meta.year) return `${meta.name} ${meta.year}`;
  return meta.name;
}
