import { TorrentProvider, SortType, SizeLimit } from './types.js';

// ─── Pre-built Configurations ─────────────────────────────────────────────────

export const PreConfigurations = {
  lite: {
    name: 'Magnetio Lite',
    description: 'Lightweight configuration – English-only, no cam/screener sources',
    logo:        'https://i.imgur.com/magnetio-lite.png',
    overrideId:  'lite',
    providers:   [TorrentProvider.YTS, TorrentProvider.EZTV, TorrentProvider.TORRENTGALAXY],
    qualities:   ['4k', '1080p', '720p'],
    languages:   ['en'],
    excludeSizes:[],
    sort:        SortType.QUALITY_THEN_SEEDERS,
    limit:       5,
  },
  brazuca: {
    name: 'Magnetio Brazuca',
    description: 'Brazilian-focused configuration with Portuguese language sources',
    logo:        'https://i.imgur.com/magnetio-brazuca.png',
    overrideId:  'brazuca',
    providers:   [TorrentProvider.YTS, TorrentProvider.EZTV, TorrentProvider.TORRENTGALAXY, TorrentProvider.RUTOR],
    qualities:   [],
    languages:   ['pt', 'en'],
    excludeSizes:[],
    sort:        SortType.QUALITY_THEN_SEEDERS,
    limit:       10,
  },
};

// ─── Configuration Parser ─────────────────────────────────────────────────────

/**
 * Parse a pipe-delimited configuration string into a structured object.
 *
 * Format:
 *   providers=yts,eztv|sort=qualityseeders|limit=5|RD=<api_key>|...
 *
 * Or use a preset name (e.g. "lite" / "brazuca").
 */
export function parseConfiguration(configString) {
  if (!configString) return getDefaultConfiguration();

  // Check for pre-configuration preset
  const preset = PreConfigurations[configString.toLowerCase()];
  if (preset) return { ...getDefaultConfiguration(), ...preset };

  const config = getDefaultConfiguration();

  for (const part of configString.split('|')) {
    const [key, value] = part.split('=');
    if (!key || value === undefined) continue;

    switch (key.toLowerCase()) {
      case 'providers':
        config.providers = value.toLowerCase().split(',').filter(Boolean);
        break;
      case 'sort':
        config.sort = value.toLowerCase();
        break;
      case 'limit':
        config.limit = parseInt(value, 10) || config.limit;
        break;
      case 'qualities':
        config.qualities = value.toLowerCase().split(',').filter(Boolean);
        break;
      case 'languages':
        config.languages = value.toLowerCase().split(',').filter(Boolean);
        break;
      case 'excludesizes':
        config.excludeSizes = value.toUpperCase().split(',').filter(Boolean);
        break;
      case 'maxsize':
        config.maxSize = parseInt(value, 10) || null;
        break;
      // Debrid API keys
      case 'rd':
        config.realDebridApiKey = value;
        break;
      case 'pm':
        config.premiumizeApiKey = value;
        break;
      case 'ad':
        config.allDebridApiKey = value;
        break;
      case 'dl':
        config.debridLinkApiKey = value;
        break;
      case 'ed':
        config.easyDebridApiKey = value;
        break;
      case 'oc':
        config.offcloudApiKey = value;
        break;
      case 'tb':
        config.torboxApiKey = value;
        break;
      case 'pu':
        config.putioApiKey = value;
        break;
    }
  }

  return config;
}

/**
 * Returns the manifest name/description/logo overrides for pre-configs.
 */
export function getManifestOverride(configString) {
  if (!configString) return null;
  const preset = PreConfigurations[configString.toLowerCase()];
  if (!preset) return null;
  return {
    id:          `com.magnetio.addon.${preset.overrideId}`,
    name:        preset.name,
    description: preset.description,
    logo:        preset.logo,
  };
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

function getDefaultConfiguration() {
  return {
    providers:          Object.values(TorrentProvider),
    sort:               SortType.QUALITY_THEN_SEEDERS,
    limit:              10,
    qualities:          [],           // empty = all qualities
    languages:          [],           // empty = all languages
    excludeSizes:       [],
    maxSize:            null,
    // Debrid keys (all null by default)
    realDebridApiKey:   null,
    premiumizeApiKey:   null,
    allDebridApiKey:    null,
    debridLinkApiKey:   null,
    easyDebridApiKey:   null,
    offcloudApiKey:     null,
    torboxApiKey:       null,
    putioApiKey:        null,
  };
}
