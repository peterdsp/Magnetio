import test from 'node:test';
import assert from 'node:assert/strict';

import { sortStreams } from '../lib/sort.js';
import { applyFilters } from '../lib/filter.js';
import { parseConfiguration } from '../lib/configuration.js';
import { SortType } from '../lib/types.js';

const stream = (name, languages, extra = {}) => ({
  name,
  title: name,
  languages,
  seeders: 100,
  size: 2 * 1024 ** 3,
  ...extra,
});

const names = list => list.map(s => s.name);
const IT_EN = { languages: ['it', 'en'], sort: SortType.SEEDERS };

test('configured language order decides ranking, not just membership', () => {
  const streams = [
    stream('english', ['en'], { seeders: 900 }),
    stream('italian', ['it'], { seeders: 10 }),
  ];
  // Italian wins despite 90x fewer seeders: it is the first configured language.
  assert.deepEqual(names(sortStreams(streams, IT_EN)), ['italian', 'english']);

  // Reversing the preference reverses the grouping.
  assert.deepEqual(
    names(sortStreams(streams, { ...IT_EN, languages: ['en', 'it'] })),
    ['english', 'italian']
  );
});

test('a dual-audio release ranks with its best configured language', () => {
  const streams = [
    stream('english', ['en'], { seeders: 900 }),
    stream('ita-eng', ['en', 'it'], { seeders: 5 }),
  ];
  assert.deepEqual(names(sortStreams(streams, IT_EN)), ['ita-eng', 'english']);
});

test('multi-audio ranks below every explicit match but above unrelated audio', () => {
  const streams = [
    stream('german', ['de'], { seeders: 900 }),
    stream('multi', ['multi'], { seeders: 500 }),
    stream('english', ['en'], { seeders: 100 }),
    stream('italian', ['it'], { seeders: 1 }),
  ];
  assert.deepEqual(
    names(sortStreams(streams, IT_EN)),
    ['italian', 'english', 'multi', 'german']
  );
});

test('the sort is stable within a language bucket', () => {
  const streams = [
    stream('it-low', ['it'], { seeders: 5 }),
    stream('it-high', ['it'], { seeders: 500 }),
  ];
  assert.deepEqual(names(sortStreams(streams, IT_EN)), ['it-high', 'it-low']);
});

test('no configured languages leaves ordering to the sort strategy alone', () => {
  const streams = [
    stream('low', ['it'], { seeders: 5 }),
    stream('high', ['de'], { seeders: 500 }),
  ];
  assert.deepEqual(
    names(sortStreams(streams, { languages: [], sort: SortType.SEEDERS })),
    ['high', 'low']
  );
});

// ─── Whitelist ────────────────────────────────────────────────────────────────

test('the language whitelist keeps multi-audio releases', () => {
  // A MULTi release does not name its tracks, and most carry the wanted one.
  // Dropping them is how an Italian user lost results they could have played.
  const streams = [
    stream('italian', ['it']),
    stream('multi', ['multi']),
    stream('german', ['de']),
  ];
  assert.deepEqual(
    names(applyFilters(streams, { languages: ['it'] })),
    ['italian', 'multi']
  );
});

test('an empty whitelist filters nothing', () => {
  const streams = [stream('german', ['de']), stream('italian', ['it'])];
  assert.deepEqual(names(applyFilters(streams, { languages: [] })), ['german', 'italian']);
});

// ─── Preset ───────────────────────────────────────────────────────────────────

test('the italia preset queries every provider and prefers Italian over English', () => {
  const config = parseConfiguration('italia');
  assert.equal(config.languages[0], 'it', 'Italian must be first for the sort to rank it first');
  assert.ok(config.languages.includes('en'), 'English stays as a fallback');
  // Narrowing providers is what made the preset return less than no preset at
  // all on a host that already disables some of them.
  assert.ok(config.providers.length >= 20, `expected the full provider list, got ${config.providers.length}`);
  assert.ok(config.providers.includes('therarbg'));
});
