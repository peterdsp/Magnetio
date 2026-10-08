import test from 'node:test';
import assert from 'node:assert/strict';

import { filterByContent } from '../providers/index.js';

const titles = (records, meta) => filterByContent(records, meta).map(r => r.title);
const record = (title, extra = {}) => ({ infoHash: title, title, ...extra });

const BROTHER = { name: 'Brother', type: 'movie', imdbId: 'tt0118767', year: 1997 };
const GOT = { name: 'Game of Thrones', type: 'series', imdbId: 'tt0944947', season: 2, episode: 3 };

test('ID-matched movie with a localized title is kept', () => {
  const records = [
    record('Брат (1997) BDRip 1080p', { matchedById: true }),
    record('Брат (1997) BDRip 1080p'),
  ];
  assert.deepEqual(titles(records, BROTHER), ['Брат (1997) BDRip 1080p']);
});

test('ID-matched series with a localized title is kept', () => {
  const title = 'Игра престолов (2 сезон: 1-10 серии из 10) / 2012 / BDRip';
  const records = [record(title, { matchedById: true }), record(title)];
  assert.deepEqual(titles(records, GOT), [title]);
});

test('ID-matched series fail only on a marker for another season or episode', () => {
  const pass = [
    'Game of Thrones Season 2 Complete',
    'Игра престолов (2 сезон: 1-10 серии из 10)',
    // Russian labels are not parsed: no Latin marker, so the indexer is trusted
    'Игра престолов (Сезон 5)',
  ];
  const fail = [
    'Game.of.Thrones.S05E03.1080p.BluRay',
    'Game.of.Thrones.S02E05.1080p.BluRay',
  ];
  const records = [...pass, ...fail].map(t => record(t, { matchedById: true }));
  assert.deepEqual(titles(records, GOT), pass);
});

test('movies without an ID match still need the English name', () => {
  const records = [
    record('Brother (1997) 1080p BluRay'),
    record('Brother Bear (2003) 1080p'),
    record('Брат (1997) BDRip 1080p'),
  ];
  assert.deepEqual(titles(records, BROTHER), ['Brother (1997) 1080p BluRay']);
});

test('series without an ID match still need the name and season', () => {
  const records = [
    record('Game of Thrones S02E03 1080p'),
    record('Game of Thrones Season 2 Complete'),
    record('Game of Thrones S03E03 1080p'),
    record('Game of Thrones S02E05 1080p'),
    record('House of the Dragon S02E03 1080p'),
  ];
  assert.deepEqual(titles(records, GOT), [
    'Game of Thrones S02E03 1080p',
    'Game of Thrones Season 2 Complete',
  ]);
});
