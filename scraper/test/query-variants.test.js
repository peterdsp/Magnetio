import test from 'node:test';
import assert from 'node:assert/strict';

import { queryVariants, filterByYear } from '../providers/index.js';
import { buildSearchQuery } from '../lib/titleHelper.js';

const RALPH = {
  name: 'Wreck-It Ralph', type: 'movie', imdbId: 'tt1772341', year: 2012,
  aliases: ['Ralph Spaccatutto'], searchTags: ['ITA'],
};

const queries = meta => queryVariants(meta).map(v => buildSearchQuery(v.meta));
const record = title => ({ infoHash: title, title });
const titles = (names, meta) => filterByYear(names.map(record), meta).map(r => r.title);

test('the base pass searches the catalogue name with the year', () => {
  const [base, ...extra] = queryVariants(RALPH);
  assert.equal(base.localized, false);
  assert.equal(buildSearchQuery(base.meta), 'Wreck-It Ralph 2012');
  assert.ok(extra.every(v => v.localized));
});

test('the extra passes search the localized title and the tag without the year', () => {
  // Providers require every word in the query, and localized releases are
  // labelled with the local year or none, so the year only loses them.
  assert.deepEqual(queries(RALPH), [
    'Wreck-It Ralph 2012',
    'Ralph Spaccatutto',
    'Wreck-It Ralph ITA',
  ]);
});

test('a request without a localized title or tag is one unchanged pass', () => {
  assert.deepEqual(queries({ ...RALPH, aliases: [], searchTags: [] }), ['Wreck-It Ralph 2012']);
  assert.deepEqual(queries({ name: 'Wreck-It Ralph', type: 'movie', year: 2012 }), ['Wreck-It Ralph 2012']);
});

test('a series keeps its season and episode across the extra passes', () => {
  const gomorra = {
    name: 'Gomorrah', type: 'series', imdbId: 'tt3281796', season: 1, episode: 2,
    year: 2014, aliases: ['Gomorra - La serie'], searchTags: ['ITA'],
  };
  assert.deepEqual(queries(gomorra), [
    'Gomorrah S01E02',
    'Gomorra - La serie S01E02',
    'Gomorrah ITA S01E02',
  ]);
});

// ─── The year, put back after a year-less pass ────────────────────────────────

test('a release a year either side of the catalogue is the same film', () => {
  // Cinemeta dates It Follows to 2015, every Italian release to 2014.
  const itFollows = { name: 'It Follows', type: 'movie', year: 2015 };
  assert.deepEqual(
    titles([
      'It Follows 2014 4K HDR DV 2160p BDRemux Ita Eng x265 NAHOM',
      'It Follows 2015 iTALiAN BDRiP XviD HDi[MT] avi',
      'It Follows 2016 iTA 1080p',
    ], itFollows),
    [
      'It Follows 2014 4K HDR DV 2160p BDRemux Ita Eng x265 NAHOM',
      'It Follows 2015 iTALiAN BDRiP XviD HDi[MT] avi',
      'It Follows 2016 iTA 1080p',
    ]
  );
});

test('a sequel or another film of the same name is dropped', () => {
  assert.deepEqual(
    titles([
      'Ralph Spaccatutto 2012 iTALiAN BRRip XviD BLUWORLD',
      'Ralph spacca internet Ralph Spaccatutto 2 2019 ITA ENG Bluray 720p',
    ], RALPH),
    ['Ralph Spaccatutto 2012 iTALiAN BRRip XviD BLUWORLD']
  );

  const obsession = { name: 'Obsession', type: 'movie', year: 1976 };
  assert.deepEqual(
    titles([
      'Obsession-Complesso di colpa (1976) ITA Ac3 BDRip 1080p',
      'Obsession 2025 iTA-ENG Bluray 1080p x264-CYBER',
    ], obsession),
    ['Obsession-Complesso di colpa (1976) ITA Ac3 BDRip 1080p']
  );
});

test('a release name with no year at all is kept', () => {
  // Italian releases frequently omit it, and the name match carries the record.
  const names = [
    'Ralph Spaccatutto [XviD - Ita Ac3 5.1][TNT Village]',
    'Ralph spaccatutto DVDrip H264 Ita Ac3[MTX Group]',
    // Resolutions and codecs must not read as a year.
    'Ralph Spaccatutto iTA 2160p x265 10bit',
  ];
  assert.deepEqual(titles(names, RALPH), names);
});

test('series and yearless metadata are left alone', () => {
  const names = ['Gomorra.La.Serie.S01E02.iTALiAN.1080p', 'Gomorra 2008 iTALiAN BDRip'];
  for (const meta of [
    { name: 'Gomorrah', type: 'series', year: 2014 },
    { name: 'Gomorrah', type: 'movie', year: null },
    {},
  ]) {
    assert.deepEqual(titles(names, meta), names);
  }
});

test('a number that is part of the title is not read as a release year', () => {
  // "Blade Runner 2049" came out in 2017, and plenty of releases say so only
  // in the title.
  const blade = { name: 'Blade Runner 2049', type: 'movie', year: 2017 };
  const names = [
    'Blade Runner 2049 iTA ENG 1080p BluRay x264',
    'Blade.Runner.2049.2017.iTA.2160p',
  ];
  assert.deepEqual(titles(names, blade), names);

  // The same where the title is only a year: "1917" is a 2019 film, "2012" a
  // 2009 one, and a release of either may name the title's year alone.
  assert.deepEqual(
    titles(['1917 iTALiAN BDRip x264'], { name: '1917', type: 'movie', year: 2019 }),
    ['1917 iTALiAN BDRip x264']
  );
  assert.deepEqual(
    titles(['2012 iTA ENG 1080p BluRay x264'], { name: '2012', type: 'movie', year: 2009 }),
    ['2012 iTA ENG 1080p BluRay x264']
  );
});
