import { getManifestOverride } from './configuration.js';
import { MochOptions } from '../moch/options.js';

const ADDON_ID      = 'com.magnetio.addon';
const ADDON_VERSION = '1.1.4';
const ADDON_NAME    = 'Magnetio';
const ADDON_LOGO    = 'https://i.imgur.com/magnetio.png';

const PROVIDERS_DESCRIPTION = [
  'YTS', 'EZTV', 'RARBG', 'TorrentGalaxy', 'ThePirateBay',
  'KickassTorrents', '1337x', 'Nyaa', 'AnimeSaturn', 'Rutor', 'Rutracker',
  'LimeTorrents', 'Bitsearch',
].join(', ');

/**
 * Build the full addon manifest for a given config.
 */
export function manifest(config) {
  const override = getManifestOverride(config?.overrideId);

  return {
    id:          override?.id          ?? ADDON_ID,
    version:     ADDON_VERSION,
    name:        override?.name        ?? getName(config),
    description: override?.description ?? getDescription(config),
    logo:        override?.logo        ?? ADDON_LOGO,
    background:  'https://i.imgur.com/magnetio-bg.jpg',
    types:       ['movie', 'series', 'anime'],
    resources:   getResources(),
    catalogs:    getCatalogs(config),
    behaviorHints: {
      configurable:      true,
      configurationRequired: false,
      p2p:               true,
    },
  };
}

/**
 * Minimal manifest returned before a user configures the addon.
 */
export function dummyManifest() {
  return {
    id:          ADDON_ID,
    version:     ADDON_VERSION,
    name:        ADDON_NAME,
    description: `${ADDON_NAME} – configure providers, subtitles and debrid services at /configure`,
    logo:        ADDON_LOGO,
    background:  'https://i.imgur.com/magnetio-bg.jpg',
    types:       ['movie', 'series', 'anime'],
    resources:   getResources(),
    catalogs:    [],
    behaviorHints: {
      configurable: true,
      p2p: true,
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getName(config) {
  const enabledMochs = getEnabledMochs(config);
  if (!enabledMochs.length) return ADDON_NAME;
  return `${ADDON_NAME} ${enabledMochs.map(m => `+${m.shortName}`).join('')}`;
}

function getDescription(config) {
  const enabledMochs = getEnabledMochs(config);
  const debridPart = enabledMochs.length
    ? `\nDebrid services: ${enabledMochs.map(m => m.name).join(', ')}.`
    : '';
  return (
    `Aggregates torrents from: ${PROVIDERS_DESCRIPTION}. Includes OpenSubtitles-powered subtitle support when configured server-side.` +
    debridPart +
    `\n\nConfigure at your Stremio settings page.`
  );
}

function getCatalogs(config) {
  return getEnabledMochs(config).flatMap(moch =>
    moch.hasCatalog
      ? [
          { id: `${moch.id}_movie`,  type: 'movie',  name: `${moch.name} – Movies`  },
          { id: `${moch.id}_series`, type: 'series', name: `${moch.name} – Series` },
        ]
      : []
  );
}

function getResources() {
  return [
    {
      name: 'stream',
      types: ['movie', 'series', 'anime'],
      idPrefixes: ['tt', 'kitsu'],
    },
    {
      name: 'subtitles',
      types: ['movie', 'series', 'anime'],
      idPrefixes: ['tt', 'kitsu'],
    },
    {
      name: 'catalog',
      types: ['movie', 'series'],
      idPrefixes: ['rd', 'pm', 'ad', 'dl', 'ed', 'oc', 'tb', 'pu'],
    },
    {
      name: 'meta',
      types: ['movie', 'series'],
      idPrefixes: ['rd', 'pm', 'ad', 'dl', 'ed', 'oc', 'tb', 'pu'],
    },
  ];
}

function getEnabledMochs(config) {
  if (!config) return [];
  return Object.values(MochOptions).filter(moch => config[moch.configKey]);
}
