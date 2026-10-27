import test from 'node:test';
import assert from 'node:assert/strict';

import { normalise, id, name, types } from '../providers/animetosho.js';

// A real entry from https://animetosho.org/feed/json, trimmed.
const ENTRY = {
  id: 763771,
  title: 'One.Piece.Vol002.DVDRip.480p.x265.10bit.AAC.Multi-uP',
  torrent_name: 'One.Piece.Vol002.DVDRip.480p.x265.10bit.AAC.Multi-uP',
  info_hash: '78d336fe8394d33c316347cb6958559028428f20',
  info_hash_v2: null,
  magnet_uri: 'magnet:?xt=urn:btih:PDJTN7UDSTJTYMLDI7FWSWCVSAUEFDZA&tr=http%3A%2F%2Fnyaa.tracker.wf%3A7777',
  total_size: 2012372487,
  seeders: 2,
  leechers: 10,
  status: 'complete',
};

test('the provider declares the expected contract', () => {
  assert.equal(id, 'animetosho');
  assert.equal(name, 'AnimeTosho');
  assert.deepEqual(types, ['series', 'anime']);
});

test('an entry is mapped from the JSON feed fields', () => {
  const r = normalise(ENTRY, { imdbId: 'tt0388629' });

  assert.equal(r.infoHash, '78d336fe8394d33c316347cb6958559028428f20');
  assert.equal(r.size, 2012372487);
  assert.equal(r.seeders, 2);
  assert.equal(r.leechers, 10);
  assert.equal(r.provider, 'AnimeTosho');
  assert.equal(r.imdbId, 'tt0388629');
  assert.deepEqual(r.languages, ['ja']);
});

// info_hash and magnet_uri are the same torrent in different encodings. Dedup
// keys on infoHash, so both have to normalise to the same hex value.
test('the hex field and the base32 magnet agree', () => {
  const fromField  = normalise(ENTRY, {});
  const fromMagnet = normalise({ ...ENTRY, info_hash: null }, {});

  assert.equal(fromMagnet.infoHash, fromField.infoHash);
});

test('an entry with no usable hash is dropped rather than returned broken', () => {
  assert.equal(normalise({ ...ENTRY, info_hash: null, magnet_uri: null }, {}), null);
  assert.equal(normalise({ ...ENTRY, info_hash: 'nope', magnet_uri: '' }, {}), null);
});

test('an entry with no title is dropped', () => {
  assert.equal(normalise({ ...ENTRY, title: '  ', torrent_name: '' }, {}), null);
});

test('torrent_name is used when title is absent', () => {
  const r = normalise({ ...ENTRY, title: undefined }, {});
  assert.equal(r.title, ENTRY.torrent_name);
});

// The feed reports -1 for unknown peer counts, which must not reach the sort
// as a negative number.
test('unknown peer counts report zero, never a negative', () => {
  const r = normalise({ ...ENTRY, seeders: -1, leechers: -1 }, {});
  assert.equal(r.seeders, 0);
  assert.equal(r.leechers, 0);
});

test('missing numeric fields report zero rather than NaN', () => {
  const r = normalise(
    { ...ENTRY, total_size: undefined, seeders: undefined, leechers: null },
    {}
  );
  assert.equal(r.size, 0);
  assert.equal(r.seeders, 0);
  assert.equal(r.leechers, 0);
});

test('the title is parsed for quality and codec like any other record', () => {
  const r = normalise(ENTRY, {});
  assert.equal(r.quality, '480p');
  assert.equal(r.codec, 'HEVC');
  assert.equal(r.bitdepth, '10bit');
});
