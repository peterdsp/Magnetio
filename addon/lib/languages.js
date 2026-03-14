// Language code → display name mapping
export const LANGUAGES = {
  'en':    'English',
  'es':    'Spanish',
  'pt':    'Portuguese',
  'fr':    'French',
  'de':    'German',
  'it':    'Italian',
  'nl':    'Dutch',
  'ru':    'Russian',
  'pl':    'Polish',
  'ja':    'Japanese',
  'ko':    'Korean',
  'zh':    'Chinese',
  'ar':    'Arabic',
  'tr':    'Turkish',
  'hi':    'Hindi',
  'sv':    'Swedish',
  'da':    'Danish',
  'fi':    'Finnish',
  'no':    'Norwegian',
  'cs':    'Czech',
  'sk':    'Slovak',
  'hu':    'Hungarian',
  'ro':    'Romanian',
  'bg':    'Bulgarian',
  'el':    'Greek',
  'he':    'Hebrew',
  'uk':    'Ukrainian',
  'multi': 'Multi-Audio',
};

// Language flags for display
export const LANGUAGE_FLAGS = {
  'en': '🇬🇧',
  'es': '🇪🇸',
  'pt': '🇵🇹',
  'fr': '🇫🇷',
  'de': '🇩🇪',
  'it': '🇮🇹',
  'nl': '🇳🇱',
  'ru': '🇷🇺',
  'pl': '🇵🇱',
  'ja': '🇯🇵',
  'ko': '🇰🇷',
  'zh': '🇨🇳',
  'ar': '🇸🇦',
  'tr': '🇹🇷',
  'hi': '🇮🇳',
  'sv': '🇸🇪',
  'da': '🇩🇰',
  'fi': '🇫🇮',
  'no': '🇳🇴',
  'cs': '🇨🇿',
  'hu': '🇭🇺',
  'ro': '🇷🇴',
  'bg': '🇧🇬',
  'el': '🇬🇷',
  'he': '🇮🇱',
  'uk': '🇺🇦',
  'multi': '🌍',
};

/**
 * Get the display name for a language code.
 */
export function getLanguageName(code) {
  return LANGUAGES[code.toLowerCase()] || code.toUpperCase();
}

/**
 * Get the flag emoji for a language code.
 */
export function getLanguageFlag(code) {
  return LANGUAGE_FLAGS[code.toLowerCase()] || '';
}

/**
 * Extract language codes from a torrent record.
 * For anime content, Japanese is excluded by default (audio is usually
 * Japanese; the "language" tag refers to subtitle language).
 */
export function getLanguages(record, isAnime = false) {
  const langs = new Set();

  if (record.languages && Array.isArray(record.languages)) {
    for (const l of record.languages) {
      if (isAnime && l === 'ja') continue;
      langs.add(l);
    }
  }

  if (record.dubbed) langs.add('dubbed');

  return Array.from(langs);
}
