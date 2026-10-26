import test from 'node:test';
import assert from 'node:assert/strict';

import { normalise, isVideo, id, name, types } from '../providers/knaben.js';

const HIT = {
  title: 'The Godfather (1972) 1080p BrRip x264 - YIFY',
  hash: '144E5E1787668A9D9F6460674F597835E957C70E',
  magnetUrl: 'magnet:?xt=urn:btih:144E5E1787668A9D9F6460674F597835E957C70E&tr=udp',
  bytes: 854600000,
  seeders: 1046,
  liveSeeders: 941,
  peers: 12,
  livePeers: 8,
  category: 'Movies / HD',
  categoryId: [2000000],
  tracker: '1337x',
};

test('the provider declares the expected contract', () => {
  assert.equal(id, 'knaben');
  assert.equal(name, 'Knaben');
  assert.deepEqual(types, ['movie', 'series', 'anime']);
});

// The API returns UPPERCASE hex, which cannot be used as it stands: dedup keys
// on infoHash, so an uppercase copy would never merge with a lowercase one.
test('an uppercase API hash is normalised to lowercase hex', () => {
  const r = normalise(HIT, { imdbId: 'tt0068646' });
  assert.equal(r.infoHash, '144e5e1787668a9d9f6460674f597835e957c70e');
});

test('a hit with no magnet falls back to the hash field', () => {
  const r = normalise({ ...HIT, magnetUrl: undefined }, {});
  assert.equal(r.infoHash, '144e5e1787668a9d9f6460674f597835e957c70e');
});

test('a hit with no usable hash is dropped rather than returned broken', () => {
  assert.equal(normalise({ ...HIT, magnetUrl: '', hash: 'nope' }, {}), null);
  assert.equal(normalise({ ...HIT, magnetUrl: undefined, hash: undefined }, {}), null);
});

test('a hit with no title is dropped', () => {
  assert.equal(normalise({ ...HIT, title: '   ' }, {}), null);
});

// `seeders` is Knaben's cached value from the origin tracker and goes stale;
// `liveSeeders` comes from a recent scrape.
test('live peer counts are preferred over the cached ones', () => {
  const r = normalise(HIT, {});
  assert.equal(r.seeders, 941);
  assert.equal(r.leechers, 8);
});

test('the cached counts are used when the live ones are missing or zero', () => {
  const r = normalise({ ...HIT, liveSeeders: 0, livePeers: 0 }, {});
  assert.equal(r.seeders, 1046);
  assert.equal(r.leechers, 12);
});

test('a hit with no peer data at all reports zero rather than undefined', () => {
  const r = normalise(
    { ...HIT, seeders: undefined, liveSeeders: undefined, peers: undefined, livePeers: undefined },
    {}
  );
  assert.equal(r.seeders, 0);
  assert.equal(r.leechers, 0);
});

test('bytes map straight to size, with no parsing', () => {
  assert.equal(normalise(HIT, {}).size, 854600000);
  assert.equal(normalise({ ...HIT, bytes: undefined }, {}).size, 0);
});

test('the title is parsed for quality, codec and source like any other record', () => {
  const r = normalise(HIT, {});
  assert.equal(r.quality, '1080p');
  assert.equal(r.codec, 'AVC');
  assert.equal(r.source, 'BluRay');
  assert.equal(r.provider, 'Knaben');
});

// Knaben serves audio, software and books from the same endpoint.
test('non-video categories are filtered out', () => {
  assert.equal(isVideo({ categoryId: [2000000] }), true);   // movies
  assert.equal(isVideo({ categoryId: [5000000] }), true);   // tv
  assert.equal(isVideo({ categoryId: [1000000] }), true);   // anime
  assert.equal(isVideo({ categoryId: [3000000] }), false);  // audio
  assert.equal(isVideo({ categoryId: [4000000] }), false);  // software
  assert.equal(normalise({ ...HIT, categoryId: [3000000] }, {}), null);
});

test('an unclassified hit is kept, for the content filter to judge', () => {
  assert.equal(isVideo({}), true);
  assert.equal(isVideo({ categoryId: [] }), true);
});
