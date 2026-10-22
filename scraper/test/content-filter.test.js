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

// ─── Localized titles ─────────────────────────────────────────────────────────

const GODFATHER = { name: 'The Godfather', type: 'movie', imdbId: 'tt0068646', year: 1972 };
const GOMORRA = { name: 'Gomorrah', type: 'series', imdbId: 'tt3281796', season: 1, episode: 2 };

test('a release named after the localized title is kept when it is an alias', () => {
  const records = [
    record('Il.Padrino.1972.iTALiAN.AC3.BDRip.XviD'),
    record('The.Godfather.1972.1080p.BluRay.x264'),
  ];
  // Without the alias only the English release survives, which is the whole
  // reason Italian users saw almost nothing.
  assert.deepEqual(titles(records, GODFATHER), ['The.Godfather.1972.1080p.BluRay.x264']);
  assert.deepEqual(
    titles(records, { ...GODFATHER, aliases: ['Il Padrino'] }),
    ['Il.Padrino.1972.iTALiAN.AC3.BDRip.XviD', 'The.Godfather.1972.1080p.BluRay.x264']
  );
});

test('an alias does not widen the filter to unrelated content', () => {
  const records = [
    record('Il.Padrino.1972.iTALiAN.BDRip'),
    record('Il.Postino.1994.iTALiAN.BDRip'),
    record('Padre.Padrone.1977.iTALiAN.BDRip'),
  ];
  assert.deepEqual(
    titles(records, { ...GODFATHER, aliases: ['Il Padrino'] }),
    ['Il.Padrino.1972.iTALiAN.BDRip']
  );
});

test('an alias still has to satisfy the season and episode check', () => {
  const records = [
    record('Gomorra.La.Serie.S01E02.iTALiAN.1080p'),
    record('Gomorra.La.Serie.S02E02.iTALiAN.1080p'),
    record('Gomorra.La.Serie.1x02.iTALiAN.1080p'),
  ];
  assert.deepEqual(
    titles(records, { ...GOMORRA, aliases: ['Gomorra - La serie'] }),
    ['Gomorra.La.Serie.S01E02.iTALiAN.1080p', 'Gomorra.La.Serie.1x02.iTALiAN.1080p']
  );
});

test('accents in a localized title match the unaccented release name', () => {
  const PARADISO = {
    name: 'Cinema Paradiso', type: 'movie', imdbId: 'tt0095765', year: 1988,
    aliases: ['Nuovo Cinema Paradiso'],
  };
  const records = [record('Nuovo.Cinema.Paradiso.1988.iTA.1080p.BluRay')];
  assert.deepEqual(titles(records, PARADISO), ['Nuovo.Cinema.Paradiso.1988.iTA.1080p.BluRay']);

  // ...and the other way round: an accented release name, unaccented alias.
  const AMELIE = { name: 'Amelie', type: 'movie', imdbId: 'tt0211915', year: 2001 };
  assert.deepEqual(
    titles([record('Amélie.2001.MULTi.1080p.BluRay')], AMELIE),
    ['Amélie.2001.MULTi.1080p.BluRay']
  );
});

test('an empty or non-Latin alias list leaves the filter unchanged', () => {
  const records = [record('The.Godfather.1972.1080p'), record('Il.Padrino.1972.iTALiAN')];
  for (const aliases of [[], undefined, ['Крёстный отец']]) {
    assert.deepEqual(titles(records, { ...GODFATHER, aliases }), ['The.Godfather.1972.1080p']);
  }
});
