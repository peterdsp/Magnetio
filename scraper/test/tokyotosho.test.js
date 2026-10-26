import test from 'node:test';
import assert from 'node:assert/strict';

import { listProviders } from '../providers/index.js';

test('Tokyo Toshokan is registered as a provider', () => {
  assert.ok(listProviders().some(provider => provider.id === 'tokyotosho'), 'Tokyo Toshokan provider is registered');
});

test('Tokyo Toshokan parses anime feed items and excludes other categories', async () => {
  const { parseFeed } = await import('../providers/tokyotosho.js');
  const xml = `<?xml version="1.0"?><rss><channel>
    <item><category>Anime</category><title>[Group] One Piece - 01 [1080p].mkv</title><link>https://ehtracker.org/get/4277760/6383139c533b515314c7bb5a6933ccc4899f0825.torrent</link><description><![CDATA[<a href="magnet:?xt=urn:btih:MOBRHHCTHNIVGFGHXNNGSM6MYSEZ6CBF&tr=udp">Magnet</a><br/>Size: 196.99MB]]></description></item>
    <item><category>Hentai (Manga)</category><title>One Piece unwanted</title><link>https://example.test/file.torrent</link><description><![CDATA[<a href="magnet:?xt=urn:btih:6383139c533b515314c7bb5a6933ccc4899f0825">Magnet</a>]]></description></item>
  </channel></rss>`;
  const results = parseFeed(xml, { imdbId: 'tt0388629' });

  assert.equal(results.length, 1);
  assert.equal(results[0].infoHash, '6383139c533b515314c7bb5a6933ccc4899f0825');
  assert.equal(results[0].size, 206558986);
  assert.equal(results[0].seeders, 0);
  assert.equal(results[0].leechers, 0);
  assert.equal(results[0].imdbId, 'tt0388629');
  assert.deepEqual(results[0].languages, ['ja']);
});

test('Tokyo Toshokan is selectable from an add-on configuration', async () => {
  const { TorrentProvider } = await import('../../addon/lib/types.js');

  // The scraper id and the add-on id are the same string, or the provider is
  // registered but unreachable: an explicit ?providers= list would drop it and
  // the presets built from Object.values(TorrentProvider) would skip it.
  assert.equal(TorrentProvider.TOKYOTOSHO, 'tokyotosho');
  assert.ok(Object.values(TorrentProvider).includes('tokyotosho'));
});
